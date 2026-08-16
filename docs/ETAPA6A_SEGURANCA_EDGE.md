# Etapa 6A — Hardening de segurança das edge functions + check-in público

Corrige os dois riscos HIGH da auditoria final (Etapa 6). Nenhuma funcionalidade
nova; nenhuma mudança de fluxo operacional.

## Modelo de confiança

Categorias (implementadas em `supabase/functions/_shared/authGuard.ts`):

| Cat | Nome | Quem pode chamar | Como é validado |
|-----|------|------------------|-----------------|
| A | ADMIN AUTHENTICATED | admin logado | JWT + `user_roles.role = 'admin'` |
| B | ATHLETE AUTHENTICATED | atleta logado | JWT + `clients.athlete_user_id = auth.uid()` |
| C | INTERNAL / CRON | cron e outras functions | service_role key **ou** header `x-internal-secret` (`private.internal_secrets`) — admin também é aceito para disparo manual |
| D | SIGNED WEBHOOK | provedor externo | token/assinatura do provedor |
| E | PUBLIC TOKEN-SCOPED | link enviado ao atleta | token do dispatch/booking + rate limit |
| F | OAUTH CALLBACK | Google | state/PKCE |

Regra central: **service_role é autorização de infraestrutura, nunca identidade**.
Toda função que usa service_role autentica o caller ANTES de tocar o banco.

## Matriz das funções tratadas

Categoria C (`requireInternal` + `restrictedCors` + `logSecurityEvent`):

- send-booking-link
- send-booking-followup
- process-scheduled-booking-links
- process-checkin-dispatches
- process-consultation-schedules
- send-consultation-reminder
- send-reminder-15m
- send-call-booking-reminders
- send-task-reminders
- send-race-prep-whatsapp
- send-adjustment-notifications
- send-admin-weekly-summary
- send-admin-eod-confirmation
- cancel-calendar-event
- reschedule-appointment
- auto-inactivate-expired
- zn-sync-retry

Categoria A + E (misto): **create-calendar-event**
Admin/interno passa por `requireInternal`. O fluxo público de agendamento é
aceito apenas como continuação imediata do agendamento recém-criado:
appointment `scheduled`, criado há < 15 min, sem evento de calendário ainda
(idempotente) e sob rate limit por IP. Um anônimo não consegue escolher um
`appointment_id` arbitrário.

Categoria E (novo): **submit-public-checkin**

## Check-in público

Antes: o browser anônimo inseria direto em `checkin_responses` (policy aberta
`Anyone can submit responses`).

Agora:

1. `PublicCheckinForm` chama `submit-public-checkin`.
2. A autorização é o **dispatch** (o convite realmente enviado):
   token `?t=` quando existe; links legados caem em telefone + último dispatch
   `sent` do atleta.
3. O servidor deriva `client_id`, `form_id` e `form_version_id` do dispatch —
   nunca do payload.
4. Revalida: telefone confere com o atleta do dispatch, atleta operacional
   (ativo, não congelado, não arquivado), prazo (`checkin_response_window_hours`,
   padrão 36h) e ausência de resposta anterior para a mesma ocorrência.
5. Só perguntas conhecidas do formulário/versão são aceitas; valores são
   sanitizados (primitivos e arrays), objetos arbitrários descartados.
6. Rate limit por IP (`hit_rate_limit`, 15/h) e log em `operational_events`.
7. Mensagens públicas são genéricas — não revelam existência de atleta nem erro
   de SQL.

RLS: `Anyone can submit responses` removida e `INSERT` revogado de `anon`.
O dono do formulário (admin autenticado) continua podendo registrar respostas.

## Crons

Todos os jobs `pg_cron` passaram a enviar `x-internal-secret`
(`private.edge_headers()`), em vez de depender apenas da anon key.

## Verificação executada

- processador chamado com anon key → `401 Unauthorized`
- INSERT anônimo direto em `checkin_responses` → `permission denied`
- token inválido → `INVALID_LINK`
- token válido + telefone de outro atleta → `INVALID_LINK`
- dispatch fora da janela → `EXPIRED`
- dispatch válido → `success: true`, pergunta desconhecida descartada
- reenvio do mesmo dispatch → `ALREADY_SUBMITTED`
- `tsgo --noEmit` e `vitest` (175 testes) sem erro
