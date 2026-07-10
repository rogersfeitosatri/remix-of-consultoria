# Integrations API — Consultoria (servidor central)

A Consultoria é o servidor central do ecossistema e o **único** sistema que
conversa com o Asaas. Sistemas externos (Zona Nutri e futuros) consomem esta
API para operar sobre assinaturas.

## Base URL

```
https://vhzxnatgwravidvbehwi.supabase.co/functions/v1/integrations-api
```

## Autenticação

Toda requisição precisa de um dos dois headers:

```
Authorization: Bearer <INTEGRATIONS_API_KEY>
```
ou
```
x-api-key: <INTEGRATIONS_API_KEY>
```

Header opcional recomendado para rastreabilidade nos logs:

```
x-source-system: zona-nutri
```

`INTEGRATIONS_API_KEY` é gerado e armazenado como secret na Consultoria.
Múltiplas chaves são suportadas separando por vírgula no secret — assim novos
consumidores podem ser adicionados sem refatoração.

## Headers obrigatórios

| Header          | Valor                            |
|-----------------|----------------------------------|
| Authorization   | `Bearer <API_KEY>` (ou x-api-key)|
| Content-Type    | `application/json` (POST)        |

## Códigos HTTP

| Código | Significado                                              |
|--------|----------------------------------------------------------|
| 200    | Sucesso                                                  |
| 400    | Erro de validação (`error: "validation_error"`)          |
| 401    | Não autenticado (`error: "unauthorized"`)                |
| 404    | Atleta ou assinatura não encontrada / rota inexistente   |
| 409    | Estado incompatível (ex.: reativar sem checkout novo)    |
| 500    | Erro interno                                             |

Erros seguem sempre o formato:

```json
{ "success": false, "error": "<codigo>", "message": "..." }
```

---

## 1) Cancelar assinatura

`POST /subscription/cancel`

### Request
```json
{
  "athleteId": "uuid-do-atleta",
  "motivoCancelamento": "opcional"
}
```

### Response 200
```json
{
  "success": true,
  "status": "cancelled",
  "subscriptionId": "uuid",
  "cancelledAt": "2026-07-10T14:22:00Z"
}
```

Fluxo interno: cancela no Asaas (DELETE), grava `status=cancelled`,
`cancelled_at`, `cancellation_reason`.

---

## 2) Consultar assinatura

`GET /subscription/{athleteId}`

### Response 200
```json
{
  "success": true,
  "athleteId": "uuid",
  "status": "active",
  "plano": "monthly",
  "dataInicio": "2026-06-01T00:00:00Z",
  "dataExpiracao": "2026-07-01T00:00:00Z",
  "proximaCobranca": "2026-07-01",
  "assinaturaAtiva": true,
  "subscriptionId": "uuid"
}
```

`plano` ∈ `monthly | semiannual | annual`.
`status` ∈ `pending | active | overdue | suspended | cancelled | expired`.
`assinaturaAtiva` = `status === "active"` **e** `dataExpiracao` no futuro.

---

## 3) Alterar plano

`POST /subscription/change-plan`

### Request
```json
{
  "athleteId": "uuid",
  "novoPlano": "annual"
}
```

`novoPlano` ∈ `monthly | semiannual | annual`.

### Response 200
```json
{
  "success": true,
  "subscriptionId": "uuid",
  "plano": "annual",
  "dataExpiracao": "2027-06-01T00:00:00Z",
  "changed": true
}
```

Se o plano recebido for igual ao atual, retorna `changed: false` sem chamar
o Asaas.

---

## 4) Reativar assinatura

`POST /subscription/reactivate`

### Request
```json
{ "athleteId": "uuid" }
```

### Response 200
```json
{ "success": true, "subscriptionId": "uuid", "status": "active" }
```

### Response 409 (assinatura já apagada no Asaas)
```json
{
  "success": false,
  "error": "requires_new_checkout",
  "message": "Assinatura cancelada — é necessário gerar novo checkout no Asaas"
}
```

---

## Logs e auditoria

Cada chamada é registrada em `public.zn_integration_api_logs` com:
- `created_at`, `endpoint`, `method`, `source_system`
- `status_code`, `success`, `error_message`
- `duration_ms`, `request_payload`, `response_payload`
- `athlete_id`, `subscription_id` (quando identificáveis)

Apenas admins da Consultoria têm acesso de leitura (RLS).

## Organização de código

```
supabase/functions/
  integrations-api/index.ts         ← Controller / router
  _shared/integrations/
    auth.ts                          ← autenticação por API key
    logger.ts                        ← logs em zn_integration_api_logs
    dtos.ts                          ← DTOs + validators
    asaas.ts                         ← cliente Asaas
    SubscriptionIntegrationService.ts← regra de negócio
```

Endpoints do painel admin permanecem em suas próprias functions
(`asaas-cancel-subscription`, etc.) e **não** compartilham rotas com esta API
pública.
