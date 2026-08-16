# SYSTEM ARCHITECTURE — Consultoria / Zona Nutri

Documento canônico pós-Etapas 1–6. Serve como referência única para novos desenvolvedores.
Timezone operacional: `America/Fortaleza` (UTC-3). SLA sempre em **dias úteis**.

---

## 1. Matriz de fontes canônicas

| Conceito | Fonte canônica | Observações |
|---|---|---|
| Atleta (cadastro) | `clients` | 149 registros. `athlete_user_id` liga ao auth. |
| Estado operacional | `clients` + `src/lib/athleteState.ts` (`getAthleteState`) | Derivado (ativo/congelado/encerrado/arquivado). Serviço: `useAthleteLifecycle`. |
| Congelamento | `clients.is_frozen` | Gate de todas as automações. |
| Evento operacional | `operational_events` | Auditoria (0 registros — ver Riscos). |
| Prova-alvo | `np_athlete_races` (`is_active`) | Índice único parcial `uq_np_athlete_races_one_active`. |
| Plano alimentar (container) | `meal_plans` | 1 por atleta (38). |
| Versão do plano | `meal_plan_versions` | Único published por plano: `uq_meal_plan_versions_one_published`. |
| Publicação | RPC `publish_meal_plan_version` | Transacional, supersede a anterior. |
| Check-in programado | `athlete_checkin_schedules` | Periodicidade em semanas; mensal = 28 dias. |
| Ocorrência do check-in | `checkin_dispatches` | Único por `(schedule_id, occurrence_date)` para ocorrências ≥ 2026-08-16. |
| Resposta | `checkin_responses` | 436 registros, todas com `form_version_id`. |
| Feedback | `checkin_feedbacks` (`publication_status='published'`) | Atleta só lê published. |
| Proposta de ajuste | `meal_plan_change_proposals` | IA/check-in nunca edita plano direto. |
| Revisão estrutural | `nutrition_reviews` | Ciclo 28 dias; único por `(client_id, cycle_key, scheduled_for)`. |
| Formulário | `checkin_forms` / `anamnese_forms` + `*_form_versions` | Versões imutáveis. |
| Semântica de pergunta | `question_key` / `metric_key` / `form_question_semantics` | Fallback textual apenas legado, logado. |
| Consulta real | `appointments` | Fonte única do que aconteceu. |
| Direito/convite de consulta | `consultation_schedules` | Pipeline; nunca é "consulta". |
| Disponibilidade | `scheduling_settings` + `scheduling_time_blocks` + `scheduling_blocks` | `availability_rules` = legado. |
| Tarefa manual | `tasks` (manual) | Derivadas vêm do Dashboard, não de linhas em `tasks`. |
| Execução de IA | `ai_runs` | Auditoria de cada execução. |
| Prompt | `ai_prompt_versions` | Único ativo por `(user_id, context_key)`. |

---

## 2. Ciclos de vida

### Athlete lifecycle
`lead → contratado (clients) → operacional → [congelado ⇄ operacional] → encerrado → renovado (mesmo client_id) → arquivado`
- Serviço único: `useAthleteLifecycle`.
- Congelado/encerrado: sai das filas (check-in, review, invite), histórico preservado, nada é apagado.
- Cron `auto-inactivate-expired` (06:00 UTC) encerra contratos vencidos.

### Plan lifecycle
`draft (editor + localStorage) → meal_plan_versions(draft) → publish_meal_plan_version() → published (única) → superseded`
- Versão publicada é imutável; atleta lê apenas published.

### Check-in lifecycle
`athlete_checkin_schedules → process-checkin-dispatches (cron 10:00 UTC) → checkin_dispatches → resposta pública → checkin_responses → análise IA (ai_runs) → checkin_feedbacks(draft) → published`
- Motor único: `process-checkin-dispatches`. `send-checkin-reminders` é stub desativado (sem cron).

### Review lifecycle
`materialize_nutrition_reviews (28 dias, só atletas sem consulta recorrente) → nutrition_reviews(pending) → decisão no_change | change → proposal → draft → publish → review vinculada ao result_plan_version_id`

### Consultation lifecycle
`consultation_schedules (direito) → send-booking-link → booking público/autenticado → create_call_booking / create_public_booking_appointment → appointments → Google Calendar (não bloqueante) → remarcação/cancelamento por status, nunca delete`

### Form lifecycle
`form → edição → nova form_version → dispatch aponta para form_version_id → resposta fica presa à versão respondida`

### AI lifecycle
`ai_prompt_versions(active) → run-ai-skill / analyze-checkin → ai_runs → análise/proposta`
- IA nunca publica feedback, nunca fecha response, nunca altera plano publicado, nunca conclui review.

---

## 3. Automações ativas (cron)

| Job | Frequência | Função | Idempotência |
|---|---|---|---|
| process-checkin-dispatches-daily | 10:00 UTC | check-in | índice único (schedule, occurrence) + skip de existentes |
| process-consultation-schedules-daily | 10:00 UTC | convites de consulta | estado do schedule |
| send-consultation-reminder-24h | 11:00 UTC | lembrete 24h | flag no schedule |
| send-reminder-15m | 1 min | lembrete 15 min | flag de envio |
| send-call-booking-reminders | 15 min | calls comerciais | flag de envio |
| send-booking-followup | 12:00 UTC | follow-up de agendamento | **duplicata removida na Etapa 6** |
| send-task-reminders-every-minute | 1 min | tarefas | `task_notifications` |
| ajustes-mensais | seg 07:00 | notificações de ajuste | ciclo mensal |
| auto-inactivate-expired-clients | 06:00 UTC | ciclo de vida | idempotente por estado |
| np-send-race-prep-whatsapp-daily | 13:00 UTC | NutriPeriodiza | `np_event_dispatches` |
| admin-weekly-summary / eod-confirmation | semanal / diário | resumo admin | leitura |
| zn-promote-pending-to-lead-daily, zn-sync-retry | diário / 1 min | comercial ZN | outbox |
