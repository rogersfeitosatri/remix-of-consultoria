

# Ajuste: Periodicidade de Consultas (4 ou 6 semanas) Integrada ao Fluxo

## Confirmação da Lógica Atual
O sistema **já suporta** as duas cadências (`consultation_frequency`: `monthly`/`4_weeks` = 4 semanas | `six_weeks`/`6_weeks` = 6 semanas) nas funções `sync_pipeline_on_plan_change`, `update_consultation_journey` e `calculate_next_booking_send_date`. O ajuste aqui é tornar isso **explícito, validado e visível** em toda a operação.

---

## 1. Matriz de Tipos de Plano (Atualizada)

| Tipo | Consultas | Cadência | Check-in | Exemplo |
|------|-----------|----------|----------|---------|
| **A — Só Check-in** | ❌ | — | ✅ | Consultoria mensal sem consultas |
| **B — 1 Consulta Única** | 1 fixa | — (sem recorrência) | opcional | Plano avulso |
| **C1 — Recorrente 4 semanas** | N | **4w** | ✅ | Trimestral 3 consultas (4w) |
| **C2 — Recorrente 6 semanas** | N | **6w** | ✅ | Semestral 4 consultas (6w) |
| **D1 — Premium 4w** | ∞ | 4w | ✅ | Premium intenso |
| **D2 — Premium 6w** | ∞ | 6w | ✅ | Premium estendido |

---

## 2. O Que a Cadência (4w vs 6w) Controla no Sistema

Quando admin escolhe `consultation_frequency`, **automaticamente afeta**:

| Componente | Comportamento |
|------------|---------------|
| `sync_pipeline_on_plan_change` | Projeta próximas consultas em intervalos de 4 ou 6 semanas |
| `update_consultation_journey` | Define `cadence_weeks` e calcula `next_link_send_date` |
| `calculate_next_booking_send_date` | Retorna a segunda-feira da semana anterior à próxima consulta (4w ou 6w após a última) |
| `send-booking-link` (cron) | Envia WhatsApp com link na semana correta conforme cadência |
| Pipeline Semanal (UI) | Mostra próxima consulta projetada respeitando cadência |
| Tarefas automáticas | Tarefa "Preparar consulta" gerada com prazo baseado na cadência |

---

## 3. Ajustes Propostos para Garantir Consistência

### 🔴 Sprint Crítico — Garantir Integridade
1. **Validação no `PlanFinancialSetupDialog`**:
   - Se `has_consultations = true` → `consultation_frequency` é **obrigatório** (4 ou 6 semanas)
   - Se `consultation_count > 1` → cadência obrigatória
   - Se `consultation_count = 1` → cadência irrelevante (esconder campo)
   - Se `has_consultations = false` → bloquear seleção de cadência

2. **Auditoria de dados existentes**:
   - Identificar atletas com `has_consultations = true` mas `consultation_frequency` nulo
   - Identificar atletas com `consultation_count = 1` que estão recebendo links recorrentes (bug)
   - Identificar inconsistências entre `consultation_count` × cadência × `end_date` (ex: 6 consultas a cada 6w em plano de 3 meses = impossível)

3. **Badge visual de cadência no card do atleta**:
   - 🔄 4 semanas / 🔄 6 semanas / 1️⃣ Única / 📋 Só Check-in / ⭐ Premium

### 🟡 Sprint UX
4. **Catálogo de templates de plano** (Configurações → Templates):
   | Template | has_cons | count | freq | check-in |
   |----------|----------|-------|------|----------|
   | Consultoria Mensal (só check-in) | false | 0 | — | mensal |
   | Avulsa 1 Consulta | true | 1 | — | não |
   | **Trimestral 3 Consultas (4w)** | true | 3 | 4w | quinzenal |
   | **Trimestral 2 Consultas (6w)** | true | 2 | 6w | quinzenal |
   | **Semestral 6 Consultas (4w)** | true | 6 | 4w | semanal |
   | **Semestral 4 Consultas (6w)** | true | 4 | 6w | semanal |
   | Premium Anual (4w) | true | 0 | 4w | semanal |
   | Premium Anual (6w) | true | 0 | 6w | semanal |

5. **Indicador na pipeline semanal**: mostrar a cadência ao lado do nome do atleta na lista (ex: "João Silva — próxima em 4w")

### 🟢 Sprint Inteligência
6. **Validação de viabilidade no setup**: alertar se `consultation_count × cadence_weeks > duração do plano em semanas` (ex: 6 consultas × 6w = 36 semanas, mas plano tem 12 semanas → inviável)

7. **Histórico de mudança de cadência**: registrar em `client_plan_history` quando admin muda cadência no meio do plano (impacta projeções futuras)

---

## 4. Fluxo Operacional Atualizado por Cadência

```
SETUP (após anamnese)
├─ Admin escolhe template OU configura manual
├─ Define cadência: [ 4 semanas | 6 semanas | sem consulta | única ]
└─ Sistema valida coerência (count × cadência × duração)

PROJEÇÃO AUTOMÁTICA
├─ Trigger sync_pipeline_on_plan_change
├─ Cria N entradas em consultation_schedules
│   ├─ Cadência 4w: a cada 28 dias
│   └─ Cadência 6w: a cada 42 dias
└─ send_link_date = segunda-feira da semana anterior

ENVIO DE LINK (cron diário)
├─ Lê consultation_schedule_rules
├─ Compara CURRENT_DATE com next_link_send_date
└─ Dispara WhatsApp via send-booking-link

PÓS-CONSULTA REALIZADA
├─ Trigger update_consultation_journey
├─ Recalcula next_link_send_date = última + cadence_weeks
└─ Se atingiu consultation_count → is_enabled = false
```

---

## 5. Arquivos a Editar (Quando Aprovado)

**Validação & UI:**
- `src/components/admin/PlanFinancialSetupDialog.tsx` — validações + UI condicional para cadência
- `src/components/clients/ClientForm.tsx` — mesma lógica no cadastro principal
- `src/components/clients/ClientsList.tsx` — badge de cadência
- `src/components/scheduling/WeeklyPipelineView.tsx` — indicador "4w/6w" na lista

**Templates:**
- Nova tabela `plan_templates` (migration) + UI em Configurações
- `src/pages/Settings.tsx` — nova aba "Templates de Plano"

**Auditoria (script único):**
- Query SQL de diagnóstico (executada e exibida ao admin)

---

## 6. Ordem de Implementação Sugerida

1. **Auditoria primeiro** (entender o estado atual antes de mudar nada)
2. **Validações no PlanFinancialSetupDialog** (parar o sangramento)
3. **Badge visual de cadência** (visibilidade imediata)
4. **Catálogo de templates** (padronização)
5. **Indicador na pipeline + validação de viabilidade** (refinamento)

---

## Pergunta Antes de Prosseguir

Quer começar pela **auditoria** (descobrir quantos atletas estão com configuração inconsistente hoje) ou já partir direto para as **validações no dialog** (impedir novos erros)?

