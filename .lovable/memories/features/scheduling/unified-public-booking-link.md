---
name: Unified Public Booking Link
description: Link único /agendar/{slug}?bt={token} para Settings, WhatsApp e e-mail; mesma fonte de horários (availability_rules)
type: feature
---
- Rota única: `https://rogersfeitosa.com.br/agendar/{slug}` (PublicBooking.tsx). Sem `?bt` → lead flow; com `?bt={booking_links.token}` → atleta cadastrado.
- Fonte única de horários: `availability_rules` via `useAvailabilityRulesByAdmin` (fallback para `scheduling_time_blocks` quando vazio). `scheduling_time_blocks` deixou de ser fonte de verdade no público.
- Athlete-token flow chama RPC `create_public_booking_appointment(p_token, p_date, p_time)` — sem necessidade de e-mail (token identifica o atleta via `get_public_booking_context`).
- Edge functions geram a URL pela `scheduling_settings.booking_link_slug` do admin:
  - `send-booking-link/index.ts` → `buildBookingUrl(token)`
  - `process-scheduled-booking-links/index.ts` → idem
- Rota legada `/booking/:token` (PublicBookingConsult.tsx) permanece ativa para retrocompatibilidade.
