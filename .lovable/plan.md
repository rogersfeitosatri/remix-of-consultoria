## Visão geral

Novo fluxo de onboarding **isolado** para novos atletas: escolha do plano → registro como `pending` → link de pagamento via WhatsApp → webhook Mercado Pago confirma → ativação automática (consultoria) ou pipeline de consultas (consultas). **Atletas existentes não são afetados.**

Vou usar nomes/tabelas novas (prefixo `onboarding_`) para não conflitar com `plan_templates`, `payments` e `financial_transactions` já existentes.

---

## FASE 1 — Fundação (esta entrega)

**Banco:**
- `onboarding_plans` — 6 linhas fixas (slug, categoria, periodicidade, duração, consultas, frequência check-in, **payment_link**, **price**). Seed com seus valores: 497 / 797 / 1497 / 997 / 1697 / 2997.
- `onboarding_payment_settings` — `mp_public_key`, `reminder_days`, `webhook_secret`. (Access Token vai como secret `MP_ACCESS_TOKEN`.)
- `clients` (alter): adicionar `selected_plan_id`, `onboarding_status` (`pending|payment_sent|confirmed|active`), `plan_sent_at`. Sem alterar nada nas linhas existentes.
- 3 templates novos em `whatsapp_templates` (slugs `onboarding_payment_link`, `onboarding_confirmation_consultoria`, `onboarding_confirmation_consultas`, `onboarding_payment_reminder`).

**Admin UI:** Nova página `/configuracoes/onboarding` com 3 seções: Mercado Pago (public key + botão pedir secret do access token), Planos (tabela editável dos 6 planos: link MP + valor), Lembrete (dias).

**Pergunta importante:** o atleta **não vê valores** na anamnese — só o nome do plano (conforme você pediu).

---

## FASE 2 — Pergunta 0 + envio do link

- Nova rota pública `/onboarding/plano/:slug?` (ou via link da anamnese) com tela dedicada de seleção de plano (6 cards, **sem valores**).
- Após escolher, segue para a anamnese pública já existente carregando o `selected_plan_id` em estado.
- Ao enviar a anamnese: edge function cria o `client` com `onboarding_status='pending'` + `selected_plan_id`, envia WhatsApp com template `onboarding_payment_link` (variáveis: `{nome_atleta}`, `{plano_nome}`, `{link_pagamento}`), seta status para `payment_sent`.

---

## FASE 3 — Webhook MP + ativação

- Edge function pública `mp-webhook` (sem JWT): valida assinatura, busca o pagamento via API do MP com o `MP_ACCESS_TOKEN`, idempotência por `mp_payment_id`.
- Identifica o cliente pelo `external_reference` (preferencial) ou e-mail/telefone do pagador.
- Cria registro em `financial_transactions` (categoria "Plano", método retornado pelo MP) e em `payments`.
- Atualiza `client`: `onboarding_status='confirmed'`, `start_date`, `end_date` (start + duração do plano).
- Dispara WhatsApp:
  - Consultoria → template `onboarding_confirmation_consultoria` (aguarda admin marcar plano enviado → check-ins mensais a partir de `plan_sent_at + 1 mês`).
  - Consultas → template `onboarding_confirmation_consultas` com link de agendamento da 1ª consulta (usa fluxo existente). Check-ins quinzenais só são gerados quando a 1ª consulta for confirmada (segunda mais próxima após `data_1a_consulta + 7 dias`).

---

## FASE 4 — Lembrete + alerta de renovação

- Cron diário: para `clients` com `onboarding_status='payment_sent'` há ≥ `reminder_days`, envia template `onboarding_payment_reminder`.
- Webhook detecta pagamento de atleta já ativo → cria entrada em `renewal_alerts` e mostra card no dashboard admin com botões "Atualizar automaticamente" / "Manter manual".

---

## Detalhes técnicos

- Cálculo "4 dias úteis" via função SQL `add_business_days(date, int)` excluindo sáb/dom (feriados em uma tabela `holidays_br` simples).
- Timezone `America/Fortaleza` (memory rule).
- Idempotência: `UNIQUE(mp_payment_id)` em `payments` (nova coluna).
- Segurança: webhook valida `x-signature` do MP. RLS: tudo só admin; `onboarding_plans.SELECT` público (sem expor `payment_link` para anônimos — apenas `slug`, `name`, `description`).
- Templates em `whatsapp_templates` com `is_active` (cumprindo memory "All Automatic Messages in Central").

---

## O que vou entregar agora

**Apenas Fase 1**: migration + página admin de configurações + seed dos planos + 4 templates novos + pedido do secret `MP_ACCESS_TOKEN`. Ao final você confirma os 6 links do Mercado Pago e aprovo a Fase 2.

Posso seguir?
