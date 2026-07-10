# Wizard público de assinatura ZN + Auto-onboarding

## Objetivo
Substituir os 3 links fixos do Asaas por um funil próprio: atleta escolhe plano na landing `zonanutri.com/diet` → wizard enxuto em `rogersfeitosa.com.br/zn/assinar` → sistema cria cadastro, gera cobrança Asaas e devolve link de pagamento. Após pagamento, fluxo automático já existente (webhook → ativação → sync Zona Nutri → WhatsApp) assume.

---

## 1. Wizard público (frontend)

Nova página `src/pages/PublicZnSubscribe.tsx` na rota `/zn/assinar?plano=mensal|semestral|anual`.

Formato wizard em 3 passos, mobile-first, com barra de progresso.

**Passo 1 — Identificação**
- Nome completo
- E-mail
- WhatsApp (máscara E.164, validação BR)
- CPF (obrigatório, com validação de dígito)

**Passo 2 — Perfil rápido**
- Objetivo de composição corporal (select: perder peso / manter / ganhar peso)
- Prova alvo? (sim/não). Se sim: qual prova + data
- Peso atual (kg) + altura (cm)

**Passo 3 — Confirmação**
- Resumo do plano escolhido + valor + condições de parcelamento
- Botão "Ir para pagamento" → chama edge function → redireciona pro `invoiceUrl` do Asaas

Design herda tokens do `index.css` (mesma estética da `PlansLanding`).

## 2. Edge function `zn-create-subscription`

Nova função pública (sem JWT) em `supabase/functions/zn-create-subscription/index.ts`.

Recebe: `{ plan_choice, name, email, phone, cpf, body_goal, target_race, target_race_date, weight, height }`.

Fluxo:
1. Valida payload com Zod
2. Resolve `owner_user_id` (admin dono do módulo ZN — usa o mesmo `ADMIN_USER_ID` que já é referenciado no PaymentOrchestrator)
3. Chama `AthleteService.findOrCreate` → cria/reutiliza registro em `zn_athletes` com `status='pending'`, `plan_choice`, campos do perfil
4. Cria customer no Asaas (`POST /customers`) se ainda não existe
5. Cria assinatura Asaas com `externalReference="zn:{athlete_id}"`, ciclo e valor conforme tabela:
   | Plano | Valor | Ciclo | Parcelas |
   |---|---|---|---|
   | Mensal | 69,90 | MONTHLY | 1x |
   | Semestral | 299,00 | SEMIANNUALLY | até 6x |
   | Anual | 419,90 | YEARLY | até 12x |
6. Busca `invoiceUrl` da primeira cobrança e retorna ao cliente

## 3. Blindagem do webhook (multi-tenant Asaas)

`PaymentOrchestrator.ts` passa a exigir `externalReference` começando com `zn:` OU `subscription.value` batendo com um dos 3 valores ZN. Eventos que não casam → `status: skipped, reason: 'not_zn_subscription'`. Isso permite que sua conta Asaas seja usada para outros serviços sem contaminar o módulo ZN.

## 4. Schema — novos campos em `zn_athletes`

Migration adicionando (sem alterar dados existentes):
- `plan_choice` text (monthly/semestral/annual escolhido no wizard)
- `body_goal` text (lose/maintain/gain)
- `target_race` text, `target_race_date` date
- `weight_kg` numeric, `height_cm` numeric
- `subscription_started_at` timestamptz (nullable — preenchido quando `PAYMENT_CONFIRMED` chega)

## 5. Aba "Leads" em `/clients`

- Cron diário `zn-mark-leads`: marca `zn_athletes` com `status='pending'` há +7 dias como `status='lead'`
- Nova aba na página `Clients.tsx`: Ativos / Congelados / Inativos / **Leads**
- Lista mostra: nome, plano escolhido, WhatsApp, dias desde inscrição, botões: "Reenviar link de pagamento" (regenera invoice Asaas) e "Excluir lead"

## 6. Migração para produção Asaas (etapa final, após testes em sandbox)

Após o wizard funcionar em sandbox:
1. Trocar `ASAAS_ENV` para `production`
2. Trocar `ASAAS_API_KEY` para chave de produção
3. Cadastrar webhook `https://<projeto>.supabase.co/functions/v1/asaas-webhook` no painel de produção do Asaas
4. Atualizar botões da landing `zonanutri.com/diet` para apontar pra `rogersfeitosa.com.br/zn/assinar?plano=...`
5. Excluir os 3 links fixos antigos do Asaas

## O que fica de fora deste plano
- Envio automático de credenciais do Zona Nutri: já coberto pelo sync existente (`ExternalSyncService`) — o Zona Nutri é quem cria login e envia; nada muda aqui.
- Alterações no fluxo de check-in / anamnese completa da consultoria — o atleta ZN preenche a anamnese completa depois, dentro do app, como já acontece.

---

## Detalhes técnicos (para revisão técnica opcional)

- Rota pública adicionada em `App.tsx` via `lazy()` (regra do projeto).
- Wizard usa `react-hook-form` + `zod` (padrão do projeto).
- `zn-create-subscription` importa `AthleteService` e `asaasRequest` de `_shared/`.
- Cron `zn-mark-leads` roda diariamente às 03:00 America/Fortaleza via `pg_cron` + `net.http_post` chamando a edge function.
- Verificação anti-duplicidade: se e-mail já existe em `zn_athletes` com `status in ('active','pending')`, wizard bloqueia com mensagem "Já existe cadastro — verifique seu WhatsApp".
