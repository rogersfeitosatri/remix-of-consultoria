# Etapa 3A — Inventário pré-migration e resultado do backfill

## Antes
- `ai_analyses`: 53 registros; 46 com payload JSON válido.
- Chaves encontradas: `meal_plan` (39), `saved_plans` (5, todas com 1 plano), `attached_plans` (1 vazia), `active_plan_id` (4), `zona_nutri_sent_at`.
- `meal_plan_status`: 33 linhas (pending/sent/outros).

## Depois (tabela `meal_plan_migration_report`)
- 38 atletas migrados → 38 versões criadas, todas publicadas (1 por atleta).
- 15 atletas sem plano (`no_plan`) — nada foi criado.
- 0 casos com duas versões publicadas; 38 `meal_plans` com `current_version_id`.
- Nenhuma coluna/linha legada foi apagada: `ai_analyses.raw_response`, `saved_plans`,
  `attached_plans` e `meal_plan_status` continuam intactos.
