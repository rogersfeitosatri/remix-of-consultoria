# Etapa 6B — Fim do `ai_analyses.raw_response` como store do plano alimentar

## Regra
O plano alimentar vive **exclusivamente** em `meal_plans` + `meal_plan_versions`.
`ai_analyses` guarda apenas ANÁLISE (diagnóstico, alertas, gasto energético,
macros de referência) e, em `raw_response`, apenas a saída bruta de IA marcada
como `{_audit_only: true}`.

## Camadas
- Frontend: `src/lib/planStore.ts` (`loadWorkingPlan` / `saveWorkingPlan` /
  `saveWorkingOrientations`) e o hook `useWorkingPlan` / `useSaveWorkingPlan`.
- Edge: `supabase/functions/_shared/mealPlanStore.ts` (mesmo contrato em Deno).
- Publicação: `create_meal_plan_version` + `publish_meal_plan_version` (RPC
  transacional). Versão publicada é imutável e única.

## Writers migrados
Frontend: `MealPlanEditor` (salvar, proposta, desfazer, gerar IA),
`MealPlanDetail` (persistStructured, variações de dia, aplicar/desfazer ajuste,
criar do zero), `EditableMealPlan`, `EditableStrategicOrientations`,
`MealPlanHub`, `AttachedPlanPanel` (planos anexados viram versões
`source='attached_plan'`).

Edge: `update-meal-plan`, `import-meal-plan`, `generate-base-plan`,
`finalize-plan`, `analyze-athlete`, `audit-meal-plan`, `checkin-plan-patch`,
`send-meal-plan-to-zona-nutri`.

## Propostas de ajuste
`raw_response.pending_update` foi substituído por `meal_plan_change_proposals`
(status `pending` → aplicar/desfazer). Nenhuma proposta altera a versão
publicada sem publicação explícita.

## Leituras legadas (read-only, medidas)
Quando um atleta ainda não tem nenhuma versão canônica, o sistema pode ler o
plano legado apenas para exibição, sempre registrando o evento operacional
`legacy_meal_plan_fallback_used`. Superfícies: área do atleta, hub de planos,
painel de planos anexados e `planStore`.

## Backfill
`public.backfill_legacy_meal_plans()` (idempotente, `service_role`) migra
qualquer plano legado restante para uma versão publicada com
`needs_review = true` e registra o resultado em `meal_plan_legacy_report`
(leitura só para admin).

Execução em produção: 38 atletas já migrados na Etapa 3A, 15 sem plano
(`no_plan`), 0 pendentes, 0 divergências de conteúdo.
