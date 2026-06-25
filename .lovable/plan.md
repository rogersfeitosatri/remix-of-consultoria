## Objetivo
Ter **um único link público** — `https://rogersfeitosa.com.br/agendar/{slug}` (ex.: `/agendar/agendarf`) — usado em Settings, landing, WhatsApp e e-mails. Ele mostra **exatamente** os mesmos dias/horários do link atual que funciona, e diferencia atleta x lead pelo e-mail informado.

## Situação atual (causa do problema)

Existem duas rotas com fontes de dados distintas:

| Rota | Página | Fonte dos horários |
|---|---|---|
| `/agendar/{slug}` (Settings) | `PublicBooking.tsx` | `scheduling_time_blocks` (blocos manuais — vazios) |
| `/booking/{token}` (WhatsApp) | `PublicBookingConsult.tsx` | `availability_rules` + `scheduling_blocks` + `appointments` (funciona) |

Resultado: o link do Settings parece "sem horários" porque está olhando a tabela errada.

## Solução

**Refatorar `PublicBooking` (`/agendar/{slug}`) para usar a mesma lógica de disponibilidade do `PublicBookingConsult`**, e transformá-lo no único link oficial — usado por todos os fluxos.

### 1. Unificar fonte de horários em `/agendar/{slug}`

Em `src/pages/PublicBooking.tsx`:
- Trocar a leitura de `scheduling_time_blocks` por `get_public_scheduling_settings_by_user` + `availability_rules` + `get_public_scheduling_blocks` + `get_public_appointment_slots` (mesmas RPCs já usadas pelo `PublicBookingConsult`).
- Manter `availableDates` / `availableSlots` calculados a partir de `availability_rules` (regra semanal), respeitando `min_advance_hours`, `max_advance_days` e buffers de `scheduling_settings`.

### 2. Identificação por e-mail (atleta x lead)

Fluxo na tela:
1. Tela inicial pede e-mail (e telefone opcional).
2. Ao avançar, chama `validate_booking_email_v2` com o e-mail:
   - **Atleta ativo encontrado** → segue como atleta: ao confirmar, cria registro em `appointments` via `create_public_booking_appointment` (mesma RPC do fluxo atual do WhatsApp), com toda a validação de elegibilidade já existente (ativo, não congelado, dentro da janela).
   - **Não encontrado / não elegível** → segue como lead: pede nome completo, cria registro em `consultation_schedules` via `create_public_lead_appointment`.
3. Mensagens claras quando o atleta está inativo/congelado/expirado ("Sua conta não está elegível para agendamento — fale com o nutricionista").

### 3. Aposentar a rota `/booking/{token}` (com retrocompatibilidade)

- Manter a rota `/booking/:token` viva por enquanto, mas convertê-la em **redirecionamento 302/Navigate** para `/agendar/{slug}` (preservando `?email={email_do_atleta}` extraído do `booking_links.token` para pular o passo do e-mail).
- Isso garante que qualquer link `/booking/...` já entregue continue funcionando.

### 4. Todos os envios passam a usar o link único

Atualizar para gerar `${appUrl}/agendar/{slug}?email={email_url_encoded}`:
- `supabase/functions/send-booking-link/index.ts` (linhas 266 e 393)
- `supabase/functions/process-scheduled-booking-links/index.ts` (linha 228)
- `supabase/functions/_shared/transactional-email-templates/booking-link.tsx` (exemplo do template)
- Qualquer outra função que monte `/booking/${token}` (varrer e ajustar).

O parâmetro `?email=` apenas pré-preenche e pula a etapa de identificação — a validação real continua server-side via RPC.

### 5. Settings

Manter exatamente como está no print (`/agendar/{slug}`). Adicionar uma nota curta abaixo do campo: "Este é o link usado em todos os envios automáticos (WhatsApp e e-mail)."

## Detalhes técnicos

- Nenhuma alteração de schema necessária. Todas as RPCs já existem (`get_public_scheduling_settings_by_user`, `get_public_scheduling_blocks`, `get_public_appointment_slots`, `validate_booking_email_v2`, `create_public_booking_appointment`, `create_public_lead_appointment`).
- `booking_links.token` continua sendo gerado/armazenado (para auditoria e para extrair o e-mail no redirect), mas deixa de aparecer em mensagens.
- Tabela `scheduling_time_blocks` permanece, mas deixa de ser fonte do link público — pode ser revisada/removida em iteração futura.
- Testes pós-deploy: (a) abrir `/agendar/agendarf` anônimo → ver dias/horários reais; (b) informar e-mail de atleta ativo → criar `appointments`; (c) informar e-mail novo → criar lead em `consultation_schedules`; (d) abrir `/booking/{token}` antigo → redireciona para `/agendar/agendarf?email=...` e mostra slots; (e) disparar `send-booking-link` para um atleta e conferir que a URL no WhatsApp aponta para `/agendar/...`.

## Fora do escopo
- Não alterar o fluxo de Strategic Call (`/agendar-call/{slug}`) — segue independente.
- Não mexer no NutriPeriodiza nem em check-ins.
- Não alterar regras de elegibilidade existentes (Booking Validation V2 permanece).
