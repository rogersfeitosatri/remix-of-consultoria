# Etapa 6C — Observabilidade real + teste de banco limpo

## 1. Por que `operational_events` e `ai_runs` estavam zerados

- **`operational_events`**: o registro dependia de chamadas manuais no frontend
  (`logOperationalEvent`), que não cobriam mudanças feitas por RPC, edge functions,
  crons ou SQL direto. Nada era gravado quando o caminho não passava pela tela.
- **`ai_runs`**: só `analyze-checkin` instrumentava execuções; a geração de plano
  (`generate-base-plan`) rodava sem abrir/fechar run.

Não havia bloqueio de RLS/grant: `service_role` e `authenticated` já tinham acesso.

## 2. Camada canônica de eventos (banco)

- Função `log_operational_event(...)` (`SECURITY DEFINER`, `search_path` fixo).
- Triggers que gravam independentemente de quem executa a ação:
  - `clients` → congelar/descongelar, encerrar/reativar, arquivar/desarquivar
    (usa `is_frozen`, `is_active`, `archived_at`; arquivar não duplica encerramento);
  - `appointments` → agendado, cancelado, remarcado, concluído;
  - `checkin_responses` → recebido e revisado;
  - `checkin_feedbacks` → feedback publicado;
  - `nutrition_reviews` → revisão concluída.
- As chamadas manuais duplicadas foram removidas do frontend
  (`useFreezePlan`, `useAthleteLifecycle`, `useNutritionReviews`, `usePublishCurrentPlan`).
- Índices adicionados em `operational_events` e `ai_runs` para auditoria.

## 3. `ai_runs`

- `generate-base-plan` passou a abrir (`startAiRun`) e fechar (`finishAiRun`) run,
  registrando provider/modelo/duração, uso de fallback determinístico e erro real.
- `analyze-checkin` e o playground (`run-ai-skill`) já usavam a mesma pipeline.

## 4. Validação end-to-end (executada em produção, sem eventos falsos)

| Teste | Resultado |
| --- | --- |
| Congelar + descongelar um atleta real (estado final igual ao inicial) | `client_frozen` e `client_unfrozen` gravados com `source='db'` |
| Análise de check-in real via `analyze-checkin` | `ai_runs`: `checkin_analysis / production / succeeded`, openai, 9,6 s |

## 5. Teste de banco limpo

`scripts/test-fresh-db.sh` sobe um Postgres vazio, recria o mínimo da plataforma
(roles, `auth`, `storage`, stubs de `cron`/`net`) e reaplica as 248 migrações.

Resultado atual: **247 aplicadas, 0 falhas, 162 tabelas em `public`**.

- Extensões exclusivas da plataforma (`pg_graphql`, `supabase_vault`, `pg_net`,
  `pg_cron`, `pgmq`, `http`) são ignoradas pelo harness.
- 1 migração é um **seed de dados** que depende de uma conta real existente
  (perguntas da Anamnese Completa) — ignorada no teste de schema.
- Correção aplicada: a migração `dashboard_dismissals` agora é reexecutável
  (`DROP POLICY IF EXISTS` antes de criar).
