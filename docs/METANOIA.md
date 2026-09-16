# Metanóia — programa de comportamento alimentar

Programa de 12 semanas para corredores, operado pela consultoria. O zonanutriapp
entra só para montar e mostrar o plano alimentar (fases 2 e 3).

## A jornada do atleta (fase 1)

1. **Landing `/metanoia`** (`src/pages/Metanoia.tsx`). O botão "Quero começar" abre o
   WhatsApp do nutricionista com a mensagem pronta (`src/lib/metanoia.ts`).
2. **Conversa no WhatsApp.** O nutricionista confirma a vaga e envia o link do
   formulário único: `https://rogersfeitosa.com.br/anamnese-form/5c4f1b2e-9d3a-4e8b-8f6a-2a7c1d9e0b11`.
3. **Formulário único "Anamnese Completa · Metanóia"** (id fixo acima). É a
   Anamnese Completa mais os blocos que o app precisa (WhatsApp, nível de
   atividade diária, meta de peso e composição) e a seção comportamental
   (7 notas de 0 a 10 e 3 perguntas abertas, chaves `aval_*`). A fonte da lista
   é `src/lib/metanoiaAnamnese.ts`; a migração é gerada por
   `npm run gerar:metanoia`.
4. **Envio do formulário** (`process-anamnese-submission`). Reconhece o id fixo,
   cria ou atualiza o atleta com o plano do programa (`camposDoPlanoMetanoia`:
   consultoria, trimestral, 3 consultas a cada 4 semanas, check-in semanal,
   `registration_source = metanoia`, `onboarding_status = awaiting_payment`,
   inativo até pagar), gera um link de pagamento do Asaas por atleta e devolve
   `payment_link`. O formulário redireciona para ele. Sem `ASAAS_API_KEY`, a
   resposta fica salva, o atleta vê "o link chega no WhatsApp" e o nutricionista
   recebe o aviso para enviar à mão.
5. **Pagamento confirmado** (`asaas-webhook`, `PAYMENT_CONFIRMED` ou
   `PAYMENT_RECEIVED`). Localiza o atleta pela referência externa (id do cadastro)
   ou pelo link de pagamento, registra o pagamento, ativa o atleta por 12 semanas
   (`vigenciaMetanoia`) e envia o convite de agendamento por WhatsApp
   (`_shared/conviteDeAgendamento.ts`, modelo `weekly_booking_link`). Uma vez só:
   parcelas seguintes e reenvios encontram `onboarding_status = paid`.
6. **Agendamento** pelo link (`/agendar/:slug?bt=token`). Ao marcar, a página
   pública envia a confirmação pelo `send-whatsapp`, que só sai com a chave
   `CONSULTORIA_ZAPI_SEND_ENABLED=true`. A primeira consulta cria as próximas
   (`bootstrap_pipeline_from_first_appointment`) com cadência `4_weeks`:
   semanas 1, 5 e 9.
7. **Pacote para o app.** Na resposta da anamnese, "Baixar PDF → Pacote para o
   app (JSON)" gera o arquivo que a ponte automática (fase 3) também usa
   (`src/lib/anamnesePackage.ts`): respostas por `question_key`, seção
   comportamental separada em notas e abertas, e `nao_mapeadas` para o que não
   tem chave.

## Segredos e configuração (Supabase → Edge Functions → Secrets)

| Chave | Para quê |
|---|---|
| `ASAAS_API_KEY` | Criar links de pagamento. Sem ela, o fluxo degrada para envio manual. |
| `ASAAS_ENV` | `production` para a API real. Qualquer outro valor usa o sandbox. |
| `ASAAS_WEBHOOK_TOKEN` | Token que o Asaas manda no header `asaas-access-token`. Cadastre o mesmo valor no webhook do painel Asaas. |
| `CONSULTORIA_ZAPI_SEND_ENABLED` | `true` libera o `send-whatsapp` legado (confirmação de agendamento e envios do painel). |

Webhook no painel do Asaas: `https://ikjntlmpnilxyugidhoz.supabase.co/functions/v1/asaas-webhook`,
eventos de pagamento (`PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`,
`PAYMENT_REFUNDED`, `PAYMENT_DELETED`), com o token acima.

O valor do programa mora em `onboarding_plans` (slug `metanoia`, inativo para não
aparecer em `/plans`). A landing não mostra preço.

## Testes

- `npm test` cobre `src/lib/metanoia.spec.ts` (constantes espelhadas nas funções,
  composição do formulário) e `src/lib/anamnesePackage.spec.ts`.
- `tests/checkin/metanoia_webhook_test.ts` (Deno) cobre a ativação pelo webhook,
  o convite, a idempotência e o link de pagamento. Sem Deno instalado, roda pela
  ponte vitest descrita em `docs/checkin-release-paused.md`.
