
# ZN Assessoria — Relatório de arquitetura e proposta

Nenhum arquivo será alterado nesta etapa. Aprove a proposta antes da implementação.

## 1. Como o projeto está organizado hoje

**Frontend (React + Vite + Tailwind + shadcn)**
- `src/pages/*` — páginas roteadas em `src/App.tsx` (~50 rotas). Rotas admin protegidas por `ProtectedRoute adminOnly`, rotas de atleta por `AthleteRoute`, rotas públicas livres (`/agendar`, `/anamnese-form`, `/onboarding`, etc.).
- `src/components/{admin,athlete,clients,dashboard,financial,scheduling,…}` — componentes por domínio.
- `src/hooks/*` — camada de dados via React Query, uma chave por domínio (`useClients`, `useFinancialData`, `usePayments`, `useAdminSettings`, `useLayoutSettings`).
- `src/lib/*` — utilitários de domínio (planos, dispatch, formatação).
- Sidebar dirigida por dados: `useLayoutSettings` + `DEFAULT_SIDEBAR_ITEMS` (arrastável, ocultável em Settings → Layout).

**Backend (Supabase / Lovable Cloud)**
- 60+ Edge Functions em `supabase/functions/*`, sem `_shared` estruturado por domínio (só helpers soltos).
- Cliente auto-gerado em `src/integrations/supabase/client.ts`.
- Tabelas centrais: `clients` (68 col.), `payments`, `appointments`, `consultation_schedules`, `kiwify_purchases`, `user_roles`, `financial_transactions`, `whatsapp_*`, `plan_templates`.
- Muitos triggers e RPCs `SECURITY DEFINER` com `search_path` fixo (`create_public_lead_appointment`, `sync_pipeline_on_plan_change`, `is_client_eligible_for_booking`, etc.).
- Autenticação: Supabase Auth + tabela `user_roles` (roles `admin` / `athlete`), função `has_role()`.

**Integrações já existentes**
- **Asaas (nova, criada nas últimas mensagens):** colunas `asaas_customer_id`, `asaas_subscription_id`, `asaas_subscription_status` em `clients`; `asaas_payment_id`, `asaas_invoice_url` em `payments`. Funções: `asaas-create-subscription`, `asaas-cancel-subscription`, `asaas-webhook` (genérico, upsert em `payments`, único evento).
- **Kiwify:** `kiwify-webhook` cria cliente com `registration_source='kiwify'`, `athlete_status='pending_anamnese'`, popula `kiwify_purchases`. Modelo de referência para o fluxo do ZN.
- **Z-API (WhatsApp):** central única `send-whatsapp` + variantes; templates em `whatsapp_templates` com opt-in/out.
- **Google Calendar / Meet:** OAuth em `google_oauth_connections`, funções `google-oauth-*`, `create-calendar-event`, `refresh-google-token`.
- **Firebase Cloud Messaging:** `push_tokens`, service-worker em `public/firebase-messaging-sw.js`.
- **Gemini / Lovable AI Gateway:** análises de anamnese, check-in, planos.

## 2. Pontos-chave descobertos

- `clients` é hoje um "god table" da consultoria (68 colunas com check-in, agenda, plano, congelamento, financeiro, prova alvo). Injetar o fluxo ZN aqui é viável tecnicamente, mas viola a exigência de **cadastro separado** — o usuário quer um pipeline paralelo (dashboard próprio, listagem própria, RLS clara).
- `payments` está acoplada a `clients` (`client_id NOT NULL`) e mistura conceitos de "receita da consultoria" e "cobrança recorrente". Reaproveitar para ZN misturaria receita nos gráficos LTV/financeiro.
- `asaas-webhook` já existe mas está genérico e faz upsert direto em `payments`. Precisa evoluir para roteador de eventos com separação de responsabilidades e suporte a múltiplos produtos (consultoria vs ZN Assessoria).
- Sidebar é dirigida por `useLayoutSettings` — adicionar item novo exige atualizar `DEFAULT_SIDEBAR_ITEMS` + `iconMap` + criar rota; a lógica de merge preserva itens do usuário.
- Não há módulo `_shared` de serviços em Edge Functions. Regras de negócio hoje ficam dentro de cada handler.

## 3. Arquitetura proposta

**Princípio:** ZN Assessoria é um **módulo isolado** dentro do mesmo projeto Supabase — tabelas próprias, edge functions próprias, dashboard próprio. Compartilha apenas `auth.users` (dono/admin) e ferramentas transversais (WhatsApp, e-mail, IA).

**Camadas do backend (services, sem regra dentro do webhook):**

```text
Asaas → asaas-webhook (roteador fino)
           │  valida assinatura, faz parse, idempotência
           ▼
        events/ (payload cru salvo em zn_webhook_events)
           │
           ▼
   PaymentService  → registra/atualiza zn_payments
           │
           ▼
 SubscriptionService → cria/atualiza zn_subscriptions, calcula
           │           data_inicio, data_expiracao, status
           ▼
   AthleteService  → cria/localiza zn_athletes (match por e-mail + cpf)
           │
           ▼
ExternalSyncService (stub) → futura chamada ao Zona Nutri
```

Cada serviço vira um módulo em `supabase/functions/_shared/zn/` (`PaymentService.ts`, `SubscriptionService.ts`, `AthleteService.ts`, `IntegrationService.ts`, `types.ts`). O webhook fica com ~30 linhas: valida token, insere evento cru, dispara o roteador. Reprocessamento futuro (retry, dead-letter) fica trivial porque o evento cru está persistido.

**Modelo de dados novo (todos em `public.zn_*`, isolados do resto):**

- `zn_athletes` — `id, user_id (admin dono), name, email UNIQUE por admin, phone, cpf_cnpj, asaas_customer_id, status ('pending'|'active'|'inactive'), first_payment_at, created_at, updated_at`. Trigger `updated_at`.
- `zn_subscriptions` — `id, athlete_id, plan ('monthly'|'semiannual'|'annual'), status ('pending'|'active'|'overdue'|'suspended'|'cancelled'|'expired'), start_date, expires_at, asaas_customer_id, asaas_subscription_id, last_payment_id, cancel_reason, canceled_at, created_at, updated_at`.
- `zn_payments` — `id, subscription_id, athlete_id, asaas_payment_id UNIQUE, amount, status ('pending'|'confirmed'|'received'|'overdue'|'refunded'|'failed'), billing_type, due_date, paid_at, invoice_url, raw_event jsonb, created_at, updated_at`.
- `zn_webhook_events` — `id, asaas_event_id UNIQUE, event_type, received_at, processed_at, status, error, payload jsonb`. Idempotência forte.
- `zn_plans` — catálogo `id, code UNIQUE ('mensal'|'semestral'|'anual'), name, duration_months, price, is_active`. Editável em Settings.
- `zn_integration_outbox` — fila para o Zona Nutri: `id, athlete_id, event_type, payload, status ('pending'|'sent'|'failed'), attempts, last_error, sent_at`. **Vazio no envio agora**, worker é implementado depois.

Todas com `GRANT` para `authenticated` (leitura/escrita do admin dono via RLS `user_id = auth.uid()`) e `service_role` (webhook). Anon **não**.

**Frontend novo:**

- Rota `/zn-assessoria` — dashboard principal (`src/pages/ZnAssessoria.tsx`): KPIs (assinaturas ativas, MRR, atletas pendentes, receita 30d), lista de atletas ZN, lista de assinaturas com status colorido, lista de pagamentos recentes, painel de eventos crus do webhook para debug.
- Sub-rota `/zn-assessoria/atletas/:id` — detalhe do atleta ZN, histórico de pagamentos, ações (cancelar assinatura, reenviar link).
- Hooks: `useZnAthletes`, `useZnSubscriptions`, `useZnPayments`, `useZnPlans`, `useZnWebhookEvents`.
- Componentes: `ZnKpiRow`, `ZnAthletesTable`, `ZnSubscriptionsTable`, `ZnPaymentsTable`, `ZnEventLogTable`, `ZnPlanBadge`, `ZnStatusBadge`.
- Sidebar: novo item `{ key: '/zn-assessoria', label: 'ZN Assessoria', icon: Trophy }` em `DEFAULT_SIDEBAR_ITEMS` + `iconMap`.

## 4. Reaproveitamento vs criação

| Área | Reaproveitar | Criar novo |
|---|---|---|
| Auth / RLS pattern | `has_role`, padrão `user_id = auth.uid()` | RLS específica das tabelas `zn_*` |
| Layout / sidebar | `useLayoutSettings`, `iconMap` | Item + rota `/zn-assessoria` |
| Asaas HTTP client | `ASAAS_BASE`, `ASAAS_API_KEY`, mapa de ciclos | Wrapper `_shared/zn/asaasClient.ts` |
| Webhook base | `asaas-webhook` (evolui, não é excluído) | Roteamento + serviços |
| WhatsApp | `send-whatsapp` + `whatsapp_templates` | Templates ZN (welcome, cobrança vencida) — em fase futura |
| Financeiro | `payments`/`financial_transactions` | **Não misturar** — ZN tem seus próprios pagamentos |
| Cadastro atleta | Padrão do `kiwify-webhook` como referência | Tabelas `zn_*` independentes |

## 5. Arquivos que serão criados / alterados (só ao aprovar)

**Criar:**
- Migração `zn_assessoria_schema.sql`: tabelas `zn_athletes`, `zn_subscriptions`, `zn_payments`, `zn_webhook_events`, `zn_plans`, `zn_integration_outbox` (com GRANTs, RLS, triggers `updated_at`).
- `supabase/functions/_shared/zn/types.ts` — tipos TS compartilhados.
- `supabase/functions/_shared/zn/asaasClient.ts` — wrapper HTTP + assinatura webhook.
- `supabase/functions/_shared/zn/PaymentService.ts`
- `supabase/functions/_shared/zn/SubscriptionService.ts` — calcula datas, status, mapeia ciclo.
- `supabase/functions/_shared/zn/AthleteService.ts` — dedup por e-mail + CPF por admin.
- `supabase/functions/_shared/zn/IntegrationService.ts` — stub (enqueue em `zn_integration_outbox`, sem HTTP).
- `supabase/functions/zn-asaas-webhook/index.ts` — endpoint dedicado do ZN (independente do `asaas-webhook` da consultoria).
- `supabase/functions/zn-process-events/index.ts` — worker que consome `zn_webhook_events` pendentes (futuro retry).
- `src/pages/ZnAssessoria.tsx`, `src/pages/ZnAthleteDetail.tsx`.
- `src/hooks/useZn*.tsx` (5 hooks).
- `src/components/zn/*` (tabelas + KPIs + badges).

**Alterar:**
- `src/App.tsx` — adicionar rotas `/zn-assessoria` e `/zn-assessoria/atletas/:id`.
- `src/hooks/useLayoutSettings.tsx` — adicionar item em `DEFAULT_SIDEBAR_ITEMS`.
- `src/components/layout/Sidebar.tsx` — adicionar entrada no `iconMap`.
- `supabase/config.toml` — `[functions.zn-asaas-webhook] verify_jwt = false`.

**Não alterar / não misturar:**
- `clients`, `payments`, `financial_transactions`, `kiwify_*`, `asaas-webhook` da consultoria — permanecem intocados.

## 6. Justificativas técnicas resumidas

- **Isolamento em tabelas `zn_*`**: evita poluição de RLS/gráficos da consultoria e permite dropar/refatorar o módulo sem risco. Requisito explícito de "cadastro separado".
- **Persistir evento cru antes de processar**: idempotência (`asaas_event_id UNIQUE`), replay de falhas, auditoria — princípio "webhook fino, serviços grossos" que o usuário pediu.
- **Outbox para Zona Nutri**: desacopla a integração externa. Quando implementarmos o sync, é só adicionar um worker que consome a fila; o resto não muda.
- **Plans em tabela**: mensal/semestral/anual editáveis (preço, duração) sem mexer em código.
- **Status expansíveis**: enum textual + guarda no `SubscriptionService` para transições válidas — pronto para crescer.

## 7. O que NÃO faremos agora

- HTTP para Zona Nutri (só stub + outbox).
- Templates WhatsApp específicos do ZN (fase seguinte).
- UI de autoatendimento do atleta ZN (fase seguinte).
- Migrar `asaas-webhook` da consultoria (fica isolado, o novo endpoint é `zn-asaas-webhook`).

---

**Aprovando este plano**, implemento nesta ordem: (1) migração schema, (2) shared services, (3) `zn-asaas-webhook`, (4) sidebar/rota + dashboard mínimo (KPIs + tabelas). Cada passo verificável antes do próximo.
