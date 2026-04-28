# RELATÓRIO DE COMPATIBILIDADE — NutriPeriodiza

> Auditoria executada conforme ETAPA 0 do briefing. **Nenhuma alteração foi feita no projeto.**
> Read-only. Aguardando aprovação antes de qualquer migration ou código.

---

## 1. TABELAS EXISTENTES (5 pedidas pelo prompt)

| Tabela pedida | Existe? | Conflito |
|---|---|---|
| `athlete_race_goals` | ❌ Não | **Conflito conceitual** — já existe `target_races` (biblioteca compartilhada de provas) e o campo `athlete_profiles.target_race` (texto livre + `target_deadline`). Criar uma 3ª estrutura de prova-alvo geraria fragmentação severa. |
| `gut_training_logs` | ❌ Não | Nenhum — pode ser criada limpa. |
| `nutrition_phase_protocols` | ❌ Não | **Sobreposição parcial** com `athlete_periodization` (já tem `cho_gkg`, `protein_gkg`, `intra_cho_gh`, `pre_training_cho_gkg`, `caffeine_mg_kg`, `carb_loading_type`, `phase_name`, `daily_strategies` jsonb) e `np_periodization_weeks` (planejamento por semana). Criar a tabela nova duplicaria conceitos. |
| `nutrition_protocol_defaults` | ❌ Não | Nenhum — não há tabela equivalente de defaults editáveis pelo admin. |
| `evolution_summaries` | ❌ Não | Existe `analyze-evolution` edge function e `periodiza_admin_instructions`, mas nada que persista resumos gerados para o atleta. Pode ser criada limpa. |

## 2. CAMPOS REFERENCIADOS EM `clients`

| Campo pedido | Existe? | Tipo atual |
|---|---|---|
| `clients.athlete_status` | ✅ Sim | text — porém os valores em uso são `lead`, `pending_plan`, `active`, `frozen`, `inactive`, `plan_completed` (mais amplos que os 2 do briefing) |
| `clients.consultation_frequency` | ✅ Sim | text (`monthly`, `six_weeks`, `4_weeks`, `6_weeks`, `weekly`, `biweekly`) |
| `consultation_schedules` | ✅ Sim | tabela ativa no pipeline V6 |

## 3. SISTEMA DE CHECKINS ATUAL

- **Rota:** `/forms` (componente `src/pages/Forms.tsx`) — abas `checkin`, `agendados`, `conferencia`, `anamnese`, `banco`.
- **Tabela de formulários:** `checkin_forms` (campos: `id, user_id, title, description, is_active`). Cada form tem perguntas dinâmicas em outra tabela.
- **Vínculo atleta → form:** `athlete_checkin_schedules` (`client_id`, `checkin_form_id`, `frequency_type`, `weekly_days`, `send_time`, `due_in_hours`, `is_active`).
- **Como criar novo checkin fixo:** novos `checkin_forms` são criados pelo admin via UI ou via `useCreateDefaultCheckinForm`. **Não existe noção de "form de sistema fixo/imutável"** — todos são per-admin.
- **Implicação para o briefing:** o "Checkin de Periodização Nutricional" pode ser criado como um `checkin_form` per-admin via seed automático, OU como tabela nova com perguntas hard-coded. Recomendação: **seed via `checkin_forms` + `checkin_questions`**, mantendo paridade com o sistema atual.

## 4. PERFIL DO ATLETA (`/clients/:clientId`)

- **Componente:** `src/pages/ClientDetail.tsx`.
- **Abas existentes (TabsList em `ClientDetail.tsx` linhas 497-516):** `timeline`, `anamnese`, `evolution`, `history`, `pipeline`.
- **Como adicionar "Periodização":** adicionar `<TabsTrigger value="periodization">` + `<TabsContent value="periodization">` apontando para um novo componente `<PeriodizationTab clientId={...} />`. **Não quebra nenhuma das abas atuais.**
- ⚠️ Já existe módulo `/periodization` (página dedicada `NutritionalPeriodization.tsx`) com `athlete_periodization`, `np_periodization_weeks`, `periodization_method`, etc. **A "aba Periodização" do briefing é um SEGUNDO módulo, focado em GUT TRAINING + protocolos de prova**, distinto da Jornada de Periodização Metabólica existente. Precisa ser nomeado distintamente para evitar confusão (sugestão: aba **"Treino Intestinal"** ou **"Race Prep"**).

## 5. CONFIGURAÇÕES DO ADMIN

- **Rota:** `/settings` (componente `Settings.tsx`).
- **Onde encaixar editor de protocolos padrão (Parte 8):** nova seção dentro de Settings, ou rota dedicada `/settings/nutriperiodiza-protocols`. Recomendação: nova aba dentro de Settings, padrão consistente com `LandingPageSettingsSection`, `MessageTemplatesSection`, `LayoutCustomizationSection`.

## 6. WHATSAPP

- **Mecanismo:** Z-API via Edge Functions (`send-whatsapp`, `send-strategic-call-whatsapp`, `send-booking-link`).
- **Núcleo:** `supabase/functions/send-whatsapp/index.ts` — usado para todos os disparos operacionais (check-in, lembretes, confirmações).
- **Tabela de logs:** `whatsapp_message_logs` com `template_key`, `client_id`, `consultation_schedule_id`, `status`, `blocked_reason`, função RPC `check_booking_send_duplicate`.
- **Como adicionar 4 novos eventos do briefing:** criar novos `template_key`s (`nutriperiodiza_checkin_received`, `nutriperiodiza_carbloading_3w`, `nutriperiodiza_gi_high`, `nutriperiodiza_race_week`) e disparar via `send-whatsapp` existente. **Não precisa nova função.** Opcional: cron diário no Edge para os eventos baseados em data (carbo-loading 3w, race week).
- **Número admin:** já memorizado — `+5599984817697` (Check-in/operacional).

## 7. CADASTRO DO ATLETA

- **Componente:** `src/components/clients/ClientForm.tsx`. Etapas atuais: dados pessoais → plano → consultas → check-ins.
- **Onde inserir prova-alvo:** já existe `TargetRaceAlert` integrado ao perfil; o cadastro de prova ocorre **fora** do ClientForm (perfil ou aba Periodização atual). **Recomendação:** manter prova-alvo como entidade `target_races` + `athlete_profiles.target_race` existente; **NÃO** criar `athlete_race_goals` nova. Adicionar campos faltantes em `target_races` via ALTER (ex: `race_distance_km`, `race_type`, `target_time_minutes`, `is_active`).

## 8. CONFLITOS IDENTIFICADOS — Resumo

| # | Conflito | Severidade | Resolução proposta |
|---|---|---|---|
| C1 | `athlete_race_goals` duplica `target_races` + `athlete_profiles.target_race` | 🔴 Alta | **NÃO criar.** Estender `target_races` com colunas faltantes (`race_distance_km`, `race_type`, `target_time_minutes`, `is_active`, `notes`). |
| C2 | `nutrition_phase_protocols` sobrepõe `athlete_periodization` | 🟡 Média | Criar tabela nova **focada apenas no contexto race-prep/gut-training** (CHO intra g/h, carbo-loading checklist, override de fase). Documentar isolamento da Jornada de Periodização Metabólica (Memory Core já exige separação). |
| C3 | Aba "Periodização" no perfil colide com módulo `/periodization` existente | 🟡 Média | Renomear aba para **"Treino Intestinal"** ou **"Race Prep"** (decisão sua). |
| C4 | "Form fixo de sistema" não existe — todos os `checkin_forms` são per-admin | 🟢 Baixa | Criar via seed automático (função SQL idempotente que insere o form se não existir para o admin). |
| C5 | Memory Core: "Periodization journey é estritamente isolada; NEVER integrate it with check-in or financial modules" | 🔴 Alta | A Parte 2 do briefing **integra novo checkin com periodização**, contrariando a regra existente. **Necessária sua decisão expressa para abrir exceção** OU manter o novo módulo paralelo (sem reutilizar a Jornada de Periodização atual). |
| C6 | API Claude pedida; vamos usar **OpenAI GPT-5** (sua decisão) | ✅ Resolvido | Edge function `generate-nutriperiodiza-summary` chamando `OPENAI_API_KEY` já existente. |
| C7 | `clients.athlete_status` aceita mais valores que os 2 do briefing | 🟢 Baixa | Sem ação — usar como referência informativa. |

## 9. PLANO DE INTEGRAÇÃO SUGERIDO

### A. Banco de dados (1 migration consolidada)

1. **ALTER `target_races`** — adicionar `race_distance_km numeric`, `race_type text default 'road'`, `target_time_minutes int`, `is_active boolean default true`, `notes text`, `updated_at timestamptz`. (Não criar `athlete_race_goals`.)
2. **CREATE `gut_training_logs`** conforme briefing (com `client_id` em vez de `athlete_id`, alinhando convenção existente).
3. **CREATE `nutrition_phase_protocols`** — sufixo `_np` para clareza: `np_phase_protocols`. UNIQUE por `client_id`.
4. **CREATE `nutrition_protocol_defaults`** — `np_protocol_defaults` (per `user_id` admin).
5. **CREATE `evolution_summaries`** — `np_evolution_summaries`.
6. **Seed function** `seed_nutriperiodiza_form(p_user_id uuid)` — cria checkin form "Checkin de Periodização Nutricional" + perguntas, idempotente.
7. **RLS** completa em todas (`auth.uid() = user_id` para admin, leitura via `client.user_id`).

### B. Frontend

| Área | Arquivos a CRIAR | Arquivos a EDITAR |
|---|---|---|
| Aba no perfil | `src/components/admin/RacePrepTab.tsx` (header prova + fase + protocolo + gut history + carbo checklist + summary panel) | `src/pages/ClientDetail.tsx` (adicionar 1 TabsTrigger + 1 TabsContent) |
| Lógica fase | `src/lib/nutriperiodiza.ts` (função `calculatePhase(weeks)`, `suggestProgression(logs)`) | — |
| Hook | `src/hooks/useNutriPeriodiza.tsx` | — |
| Editor admin | `src/components/settings/ProtocolDefaultsEditor.tsx` | `src/pages/Settings.tsx` (nova seção) |
| Modal de resumo | `src/components/admin/EvolutionSummaryDialog.tsx` | — |
| Cadastro de prova-alvo (estender) | — | `src/components/admin/TargetRaceAlert.tsx` (adicionar campos `race_distance_km`, `race_type`, `target_time_minutes`) |
| Form selector | — | `src/components/admin/AthleteCheckinSchedules.tsx` (já lista forms — funcionará automaticamente após seed) |

### C. Edge Functions (3 novas)

1. `generate-nutriperiodiza-summary` — chama OpenAI GPT-5, persiste em `np_evolution_summaries`.
2. `nutriperiodiza-daily-checks` — cron diário: detecta `weeks_to_race == 3` (carbo-loading), `weeks_to_race == 1` (race week), dispara WhatsApp via `send-whatsapp`.
3. **Reaproveitar** `send-whatsapp` para os eventos disparados a partir de triggers (checkin recebido, GI alto) — adicionar 4 `template_key`s ao `whatsapp_templates`.

### D. WhatsApp templates (seed)

- `nutriperiodiza_checkin_received`
- `nutriperiodiza_gi_high`
- `nutriperiodiza_carbloading_3w`
- `nutriperiodiza_race_week`

### E. Triggers SQL

- `AFTER INSERT ON gut_training_logs` → invoca edge function via `pg_net` para enviar WhatsApp #1 (checkin recebido) e #3 (GI alto, condicional).
- Cálculo de fase é **stateless no front** (sempre derivado de `race_date - hoje`); persistência em `np_phase_protocols` apenas para overrides manuais.

### F. Memória a registrar (após implementação)

- `mem://features/nutriperiodiza/race-prep-tab` — escopo do novo módulo, isolamento da Jornada Metabólica, nova aba no perfil.
- Atualizar core: confirmar exceção controlada à regra de isolamento (C5).

---

## ⚠️ DECISÕES BLOQUEANTES — preciso da sua confirmação

1. **C1** — OK reaproveitar `target_races` (estender via ALTER) em vez de criar `athlete_race_goals`?
2. **C3** — Nome da nova aba no perfil: `"Race Prep"` / `"Treino Intestinal"` / `"NutriPeriodiza"` / outro?
3. **C5** — Confirma exceção à regra Core de isolamento da Periodização? (O novo módulo coexiste com a Jornada existente, sem reutilizar suas tabelas.)
4. **Escopo do MVP** — Mesmo após o relatório, prefere fatiar entrega? Sugestão de fase 1: tabelas + aba no perfil + cálculo de fase + protocolo + gut log manual. Fase 2: editor de defaults + IA + crons WhatsApp.

Após suas respostas, gero a migration consolidada e implemento sequencialmente.
