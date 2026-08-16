# ETAPA 3B — Inventário e migração do módulo de Check-in

Data: 2026-08-16 (America/Fortaleza)

## 1. Inventário antes da migração

Snapshot gravado em `checkin_migration_report` (label `etapa3b_before`, imutável):

| Métrica | Valor |
|---|---|
| checkin_responses | 436 |
| checkin_feedbacks | 384 |
| checkin_feedbacks com status `sent` | 382 |
| checkin_dispatches | 1.133 |
| checkin_dispatches sem `schedule_id` (legado) | 28 |
| athlete_checkin_schedules (total) | 111 |
| athlete_checkin_schedules ativos | 38 |
| scheduled_checkins (legado, total) | 1.141 |
| scheduled_checkins futuros | 181 |
| scheduled_checkins `pending` | 157 |
| checkin_ai_analyses | 72 |

### O que existia em duplicidade

| Origem | Papel anterior | Decisão |
|---|---|---|
| `athlete_checkin_schedules` | Agendamento por atleta (frequência, dias, horário) | **CANÔNICO** |
| `scheduled_checkins` | Fila legada de envios | **LEGADO / somente leitura**. Continua sendo alimentada pelo trigger de ponte para não quebrar telas antigas. Não é mais fonte de envio. |
| `checkin_dispatches` | Registro de envio | **CANÔNICO** — evidência da ocorrência |
| `checkin_responses` | Resposta do atleta | **CANÔNICO** — agora com estado próprio |
| `checkin_feedbacks` | Devolutiva | **CANÔNICO** — agora com ciclo de publicação próprio |
| `process-checkin-dispatches` | Motor de envio | **MOTOR ÚNICO** |
| `send-checkin-reminders` | Segundo motor de envio (cron a cada 5 min) | **DESATIVADO** — cron removido, função virou stub que nunca envia |

## 2. Motor único de envio

- Cron `send-checkin-reminders` (a cada 5 min) foi **removido**. Restou apenas `process-checkin-dispatches-daily` (10:00 UTC, com guarda de segunda-feira).
- Idempotência agora é garantida **pelo banco**: índice único `(schedule_id, occurrence_date)` para ocorrências a partir de 16/08/2026, considerando apenas status `scheduled|pending|sent`. O histórico anterior (que continha duplicatas legadas) foi preservado intacto.
- Cada dispatch grava `occurrence_date` (fuso America/Fortaleza), `channel`, `source`, `scheduled_for`, `response_deadline` e `metadata`.
- Violação de unicidade no motor não é mais erro: é contabilizada como `duplicate_occurrence` (skip).

## 3. Periodicidade canônica

`src/lib/periodicity.ts` passa a trabalhar em múltiplos de semana:

| Frequência | Semanas | Dias | Tolerância |
|---|---|---|---|
| weekly | 1 | 7 | 9 |
| biweekly | 2 | 14 | 16 |
| three_weeks | 3 | 21 | 23 |
| monthly | 4 | **28** | 30 |
| bimonthly | 8 | 56 | 58 |
| quarterly | 12 | 84 | 86 |

- Tolerância canônica = intervalo + 2 dias.
- **Frequência diária deixou de existir** (removida da UI, do motor e bloqueada por constraint em `athlete_checkin_schedules`). Valores legados `daily` são normalizados para `weekly`.

## 4. Estados canônicos

**Resposta (`checkin_responses.review_status`)**
`received` → `reviewing` → `reviewed` → `closed` (com `closed_reason`, `reviewed_by`, `reviewed_at`, `closed_at`).

Backfill: respostas com feedback `sent` viraram `closed` (`legacy_feedback_sent`); com feedback `approved` viraram `reviewed`.

**Feedback (`checkin_feedbacks.publication_status`)**
`draft` → `approved` → `published` | `not_published` (com `published_at`, `published_by`).

Backfill: 382 feedbacks `sent` viraram `published`.

Na tela de revisão:
- **Finalizar sem feedback** → feedback `not_published`, resposta `closed` (`reviewed_without_feedback`).
- **Aprovar Feedback** → feedback `approved`, resposta `reviewed`.
- **Publicar feedback** → envia WhatsApp **e** publica na área do atleta; feedback `published`, resposta `closed` (`feedback_published`).

## 5. Correções de resposta

Nova tabela `checkin_response_corrections`: guarda `original_value`, `corrected_value`, `reason`, `corrected_by`. Correções nunca sobrescrevem o histórico em silêncio. Foi adicionada a política que permite ao nutricionista dono do formulário editar a resposta (antes a edição falhava silenciosamente por ausência de política de atualização).

## 6. Propostas de alteração do plano

Nova tabela `meal_plan_change_proposals` (`pending` | `accepted` | `rejected` | `converted_to_draft`), ligada ao check-in de origem e à versão publicada vigente.

`checkin-plan-patch` **não altera mais o plano publicado**: registra o patch analítico e cria uma proposta pendente para decisão humana. A publicação continua exclusiva do fluxo canônico da Etapa 3A (`publish_meal_plan_version`).

## 7. Área do atleta

Nova política: o atleta autenticado enxerga **apenas** feedbacks com `publication_status = 'published'` dos seus próprios check-ins. Rascunhos e feedbacks não publicados são invisíveis para ele.

## 8. Pendências conhecidas

- `scheduled_checkins` segue povoada pelo trigger de ponte; sua remoção definitiva deve ocorrer em uma etapa posterior, após as telas legadas serem migradas.
- A UI de propostas de plano (aceitar/rejeitar/converter em rascunho) ainda não foi construída — a camada de dados já existe.
