# ETAPA 6 — Auditoria final, estabilização e consolidação do legado

Data: 2026-08-16. Escopo: auditoria (sem redesign, sem novas features).

## A. Resumo executivo

O sistema **tem fonte de verdade única para todos os processos críticos** e está apto a continuar evoluindo.
Não foram encontrados dois motores executando o mesmo processo de check-in, consulta, revisão ou publicação de plano.

Corrigido nesta etapa (mudanças mínimas e comprovadas):
1. **Cron duplicado removido** — `send-booking-followup` estava agendado duas vezes (jobid 12 e 15, ambos 12:00 UTC diário) → risco real de mensagem duplicada. Restou um único job.
2. **Hard delete de consulta eliminado** — `AthleteSummaryConsultCard` fazia `appointments.delete()`; agora marca `status='cancelled'` (histórico clínico preservado).

Riscos abertos relevantes: parallel store legado `ai_analyses.raw_response` para plano, e funções edge sensíveis com `verify_jwt=false` + `service_role` sem autenticação interna (detalhe em D e J).

`typecheck` OK · `tests` 175/175 OK · `build` OK.

## B. Fontes canônicas
Ver `docs/SYSTEM_ARCHITECTURE.md` (matriz completa + ciclos de vida).

## C. Legado

| Item | Tipo | Status | Readers | Writers | Motivo | Ação |
|---|---|---|---|---|---|---|
| `scheduled_checkins` (1.141 linhas) | tabela | LEGACY_ACTIVE | `useScheduledCheckins`, `useClients`, `useBackup`, `CheckinAuditTab`, `CheckinScheduleAuditBanner`, `audit-checkin-schedules`, `fix-checkin-schedules`, `kiwify-webhook` | `kiwify-webhook`, `fix-checkin-schedules` | ainda alimenta telas de auditoria; motor de envio já é canônico | manter read-only; migrar auditoria antes de remover |
| `send-checkin-reminders` | edge fn | COMPATIBILITY | 0 | 0 | stub que só responde `deprecated`; sem cron | manter como stub |
| `availability_rules` (6 linhas) | tabela | LEGACY_ACTIVE | `PublicBooking`, `useConsultations` | 0 | rota pública antiga ainda lê | migrar leitura p/ `scheduling_time_blocks`, depois remover |
| `dashboard_dismissals` (45 linhas) | tabela | LEGACY_UNUSED | apenas `types.ts` | 0 | Dashboard 2B não depende de dismissals | SAFE_TO_REMOVE LATER (preservar histórico) |
| `ai_analyses.raw_response` (plano/pending_update) | coluna JSON | LEGACY_ACTIVE | ~20 arquivos (editor, hub, PDF, edge fns) | `update-meal-plan`, `checkin-plan-patch`, `finalize-plan`, `import-meal-plan`, `generate-base-plan` | ainda é store paralelo do plano ao lado de `meal_plan_versions` | **maior dívida restante**; migrar writers em etapa dedicada |
| `first_consultation_date` | coluna | COMPATIBILITY | pipeline/bootstrap | pipeline | não é usada como appointment | manter |
| `ai_analyses_dedup_backup` | tabela | LEGACY_UNUSED | 0 | 0 | backup de dedupe; RLS on sem policy | manter congelada |

Nada foi removido do banco além do cron duplicado. Nenhum arquivo foi deletado (nenhum candidato com 0 dependências comprovadas).

## D. Segurança

- **RLS**: todas as tabelas públicas têm RLS habilitado; apenas `ai_analyses_dedup_backup` está com RLS sem policy (fechada = sem acesso, correto).
- **Isolamento do atleta** validado nas políticas: `meal_plan_versions` (só `status='published'` do próprio `athlete_user_id`), `checkin_feedbacks` (só `published`), `checkin_responses`, `appointments`, `np_athlete_races`. Atleta **não** acessa drafts, `ai_runs`, `ai_prompt_versions`, `meal_plan_change_proposals` (todas restritas a `auth.uid() = user_id`).
- **Ponto de atenção (HIGH)**: `checkin_responses` tem policy de INSERT `Anyone can submit responses` sem `WITH CHECK` — necessária hoje para o formulário público, mas permite insert arbitrário. Recomendação: mover submissão pública para edge function com token do dispatch.
- **Edge functions** (`verify_jwt=false` + `service_role`, **sem autenticação interna**): `send-booking-link`, `create-calendar-event`, `cancel-calendar-event`, `reschedule-appointment`, `process-checkin-dispatches`, `process-consultation-schedules`, `send-consultation-reminder`, `send-reminder-15m`, `send-adjustment-notifications`, `start-onboarding`, `process-scheduled-booking-links`, `send-admin-*`. Podem ser disparadas por terceiros. Recomendação: exigir `CRON_SECRET`/`requireAdmin` (padrão já existente em `_shared/adminAuth.ts`, usado por `analyze-athlete` e `analyze-checkin`).
- **Webhooks legítimos** com token próprio: `asaas-webhook`, `zn-asaas-webhook` (validam `ASAAS_WEBHOOK_TOKEN`). `kiwify-webhook` e `whatsapp-webhook` continuam públicos por natureza.

## E. Automações e idempotência
Lista completa em `SYSTEM_ARCHITECTURE.md` §3. Após a remoção do job duplicado, **um processador por processo**.
Garantias verificadas em banco: `uq_checkin_dispatch_occurrence`, `uq_meal_plan_versions_one_published`, `uq_nutrition_reviews_cycle_date`, `uq_np_athlete_races_one_active`, `ai_prompt_versions_one_active`.

## F. Integridade de dados (contagens reais)

clients 149 (4 congelados) · meal_plans 38 · versions published 38 / draft 0 · schedules 111 · dispatches 1.133 · responses 436 · feedbacks 385 · nutrition_reviews 63 · appointments 180 · consultation_schedules 248 · anamnese_responses 92 · tasks 165 · ai_prompt_versions 1 · ai_runs 0 · operational_events 0.

Órfãos: **0** em response→client, response→form_version, feedback→response, appointment→client, version→meal_plan, race→client, proposal→client.

Duplicidades: **0** planos published duplicados, **0** provas ativas duplicadas, **0** prompts ativos duplicados, **0** reviews duplicadas. 1 par de appointments mesma data/hora (agendamento manual legítimo — reportado, não alterado). 141 pares de dispatch com mesma `(client, occurrence_date)` — todos **anteriores** ao índice único (padrão `failed → retry sent`); 0 casos novos após 2026-08-16.

`checkin_dispatches` com `schedule_id` nulo: 28 (envios manuais/reenvios — esperado).

## G. Testes ponta a ponta
Suíte automatizada (175 testes) cobre as regras de negócio dos cenários 11–18 e 25–27 em nível de domínio:
`nutritionReview.spec` (ciclo 28 dias, semanal/quinzenal/mensal, consulta única vs recorrente, no_change vs change), `athleteState.spec` (congelamento/encerramento/arquivamento), `calendarProjection.spec` (consulta real vs convite), `conditionalVisibility.test` (semântica + fallback legado logado), `dashboardOperations.spec` (sem duplicidade; "tudo em dia" só sem erro de query), `planV2/composer/mdImport` (plano).
Cenários que dependem de disparo real (WhatsApp, Google Calendar, Asaas) não foram executados contra produção para não gerar mensagens/eventos reais — permanecem como verificação manual.

## H. Performance
Índices únicos e de `client_id` presentes nas entidades quentes. Dashboard e Área do Atleta usam `Promise.all` (sem N+1). Nenhum problema evidente corrigido. Bundle principal 3,7 MB (gzip 1,03 MB) — code splitting fica como item futuro.

## I. Migrations
239 migrations, ordenação temporal válida, build do schema sem dependência de dados de produção nos arquivos recentes. A migration desta etapa é idempotente (só remove o cron se ambos existirem). Não foi possível provisionar um banco vazio isolado a partir deste ambiente — validação "fresh install" fica pendente (risco MEDIUM em J).

## J. Riscos restantes

| Sev | Risco | Componente | Recomendação |
|---|---|---|---|
| HIGH | Funções edge sensíveis públicas com service_role sem auth interna | booking/calendar/dispatch processors | aplicar `requireAdmin`/`CRON_SECRET` |
| HIGH | Store paralelo do plano em `ai_analyses.raw_response` | editor + 5 edge fns | etapa dedicada de migração para `meal_plan_versions` |
| HIGH | INSERT anônimo irrestrito em `checkin_responses` | RLS | submissão via edge function com token |
| MEDIUM | `operational_events` e `ai_runs` com 0 registros | observabilidade | confirmar gravação em produção |
| MEDIUM | Fresh-database test não executado | migrations | rodar em projeto vazio |
| MEDIUM | `availability_rules` ainda lida por `PublicBooking` | agendamento | migrar leitura |
| LOW | `dashboard_dismissals`, `scheduled_checkins`, `ai_analyses_dedup_backup` sem uso canônico | banco | cleanup futuro |
| LOW | Bundle único grande | build | code splitting |

## K. Itens futuros (não implementados)
Migração do plano fora de `raw_response`; hardening das edge functions; submissão pública via token; cleanup de tabelas legadas; code splitting; testes E2E automatizados com fixtures.

## L. Arquivos removidos
Nenhum. Nenhum candidato atingiu o critério de 0 readers/writers/triggers/crons/dependências.

## M. Legado preservado
Ver seção C — preservado por ter reader ativo, valor histórico/auditoria ou por ser rota pública já enviada a atletas.

## N. Resultado dos comandos
- `tsgo --noEmit` → exit 0
- `vitest run` → 20 arquivos, 175 testes, todos passando
- `bun run build` → exit 0 (apenas warning de tamanho de chunk)
