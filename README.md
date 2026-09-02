# Consultoria — Rogers Feitosa

Plataforma de nutrição e treinamento para atletas de endurance.
Frontend em Vite + React, backend em Supabase (Postgres, Auth, Storage e Edge Functions).

Produção: [rogersfeitosa.com.br](https://rogersfeitosa.com.br)

## Stack

| Camada | Tecnologia |
|---|---|
| Build | Vite 5 + TypeScript |
| UI | React 18, shadcn/ui, Tailwind CSS |
| Dados | Supabase (Postgres + RLS), TanStack Query |
| Automação | Edge Functions (Deno) + pg_cron |
| Push | Firebase Cloud Messaging (PWA) |
| Hospedagem | Vercel |

## Rodar local

Requer Node.js 20 ou superior.

```sh
git clone https://github.com/rogersfeitosatri/remix-of-consultoria.git
cd remix-of-consultoria
npm ci
cp .env.example .env      # preencher com as chaves do projeto Supabase
npm run dev               # http://localhost:8080
```

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento na porta 8080 |
| `npm run build` | build de produção em `dist/` |
| `npm run preview` | serve o build local |
| `npm run lint` | ESLint |
| `npm test` | Vitest |

## Variáveis de ambiente

O `.env.example` lista as 12 variáveis de build. Todas são publicáveis: entram no
bundle e ficam visíveis no navegador. Segredos de servidor (service role, OpenAI,
Asaas, Z-API, Google OAuth) vivem apenas nas secrets das Edge Functions.

No Vercel elas ficam em **Project Settings → Environment Variables**, cadastradas
nos três ambientes (Production, Preview, Development).

## Deploy

Push na branch `main` dispara o deploy de produção no Vercel. Qualquer outra
branch gera um deploy de preview com URL própria.

A configuração de build está no `vercel.json`:
- rewrite de todas as rotas para `index.html`, necessário para o react-router
- `Cache-Control` longo nos assets com hash e curto no service worker e no manifest

## Backend

```sh
supabase link --project-ref <ref>
supabase db push                    # aplica as migrações de supabase/migrations
supabase functions deploy           # publica as Edge Functions
supabase secrets set --env-file .env.secrets
```

Para provar que o schema sobe do zero, sem depender do banco atual:

```sh
bash scripts/test-fresh-db.sh
```

## Documentação

| Documento | Conteúdo |
|---|---|
| `docs/SYSTEM_ARCHITECTURE.md` | fontes canônicas, ciclos de vida, crons ativos |
| `docs/INTEGRATIONS_API.md` | API pública de integrações |
| `docs/ETAPA6A_SEGURANCA_EDGE.md` | modelo de segurança das Edge Functions |
| `docs/ETAPA6C_OBSERVABILIDADE.md` | logs, métricas e auditoria |
