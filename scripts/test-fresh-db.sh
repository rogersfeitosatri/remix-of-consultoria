#!/usr/bin/env bash
# ETAPA 6C — Teste de banco limpo.
#
# Sobe um Postgres local vazio, recria o mínimo da plataforma (roles, schema auth,
# stubs de cron/net/storage) e reaplica TODAS as migrações em ordem.
# Objetivo: provar que o schema é reprodutível do zero, sem depender do banco atual.
#
# Uso: bash scripts/test-fresh-db.sh
set -uo pipefail

DIR=${FRESHDB_DIR:-/tmp/freshdb}
PORT=${FRESHDB_PORT:-55432}
PSQL="psql -h $DIR -p $PORT -U postgres -d postgres"

rm -rf "$DIR"; mkdir -p "$DIR"
if [ "$(id -u)" = "0" ]; then
  # Postgres não roda como root: usa um uid não privilegiado.
  grep -q '^pgtest:' /etc/passwd || echo "pgtest:x:65534:65534::$DIR:/bin/bash" >> /etc/passwd
  chown -R 65534:65534 "$DIR"
  RUN="setpriv --reuid=65534 --regid=65534 --clear-groups env HOME=$DIR"
else
  RUN="env"
fi

$RUN initdb -D "$DIR/data" -U postgres >/dev/null || exit 1
$RUN pg_ctl -D "$DIR/data" -o "-p $PORT -k $DIR" -l "$DIR/log" start >/dev/null || exit 1
for _ in $(seq 1 30); do pg_isready -h "$DIR" -p "$PORT" >/dev/null && break; sleep 1; done

$PSQL -q -v ON_ERROR_STOP=1 <<'SQL' || exit 1
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role authenticator noinherit login;
create role supabase_admin superuser login;
grant anon, authenticated, service_role to authenticator;
create schema if not exists auth;
create schema if not exists extensions;
create schema if not exists storage;
create schema if not exists vault;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
alter database postgres set search_path = public, extensions;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create table storage.buckets (
  id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now()
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text, name text,
  owner uuid, metadata jsonb, created_at timestamptz default now()
);
alter table storage.objects enable row level security;
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create or replace function auth.role() returns text language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true),''),'anon') $$;
create or replace function auth.jwt() returns jsonb language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claims', true),'')::jsonb,'{}'::jsonb) $$;
create schema if not exists cron;
create or replace function cron.schedule(text, text, text) returns bigint language sql as $$ select 1::bigint $$;
create or replace function cron.unschedule(text) returns boolean language sql as $$ select true $$;
create table if not exists cron.job (jobid bigserial primary key, jobname text, schedule text, command text);
create schema if not exists net;
create or replace function storage.foldername(name text) returns text[] language sql immutable as
  $$ select string_to_array(name, '/') $$;
create schema if not exists pgmq;
create or replace function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb,
  headers jsonb default '{}'::jsonb, timeout_milliseconds int default 5000) returns bigint language sql as $$ select 1::bigint $$;
SQL

# Seeds de DADOS que dependem de uma conta real (não existem em banco vazio).
DATA_SEEDS='20260721144633'

ok=0; fail=0; skipped=0; : > "$DIR/failures.txt"
for f in $(ls supabase/migrations/*.sql | sort); do
  case "$(basename "$f")" in
    *"$DATA_SEEDS"*) skipped=$((skipped+1)); continue;;
  esac
  # Extensões providas pela plataforma não existem num Postgres puro.
  # transaction_timeout só existe do PostgreSQL 17 em diante; o dump inicial vem
  # de um Supabase 17.6. Num Postgres 16 local a linha aborta a primeira migração
  # e derruba as 180 seguintes em cascata — falha do ambiente, não do schema.
  sed -E '/SET transaction_timeout/Id; /CREATE EXTENSION[^;]*(pg_graphql|supabase_vault|pg_stat_statements|pg_cron|pg_net|pgsodium|pgmq|"http"|'http')/Id' "$f" > "$DIR/current.sql"
  if out=$($PSQL -q -v ON_ERROR_STOP=1 -f "$DIR/current.sql" 2>&1); then
    ok=$((ok+1))
  else
    fail=$((fail+1))
    { echo "=== $f"; echo "$out" | grep -m2 'ERROR:'; } >> "$DIR/failures.txt"
  fi
done

echo "aplicadas=$ok falharam=$fail seeds_de_dados_ignorados=$skipped"
$PSQL -tAc "select count(*) || ' tabelas em public' from information_schema.tables where table_schema='public' and table_type='BASE TABLE';"
[ "$fail" -gt 0 ] && { echo '--- falhas ---'; cat "$DIR/failures.txt"; }
$RUN pg_ctl -D "$DIR/data" stop >/dev/null 2>&1
exit $([ "$fail" -eq 0 ] && echo 0 || echo 1)
