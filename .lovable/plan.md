

## Plan: Otimizar Alertas de Plano Alimentar e Ajustes de Dieta

### Ponto 1 — Prazo do Plano Alimentar baseado na data da Anamnese

**Problema atual:** O alerta de plano alimentar pendente mostra "Cadastrado há X dias" (baseado na `created_at` do `meal_plan_status`). Você quer que o prazo de 4 dias úteis comece a contar a partir da data em que o atleta **respondeu o formulário de anamnese** (`submitted_at` da tabela `anamnese_responses`).

**Solução:**
- No hook `usePendingMealPlans`, ao buscar os planos pendentes, fazer um join adicional com `anamnese_responses` para obter o `submitted_at` mais recente de cada atleta
- No componente `PendingMealPlansAlert`, trocar o texto "Cadastrado há X" por uma lógica que calcule os dias úteis restantes (ou atrasados) a partir do `submitted_at` da anamnese
- Exibir badges visuais de urgência: verde (dentro do prazo), amarelo (hoje é o último dia), vermelho (prazo vencido)
- Ordenar a lista por urgência (mais atrasados primeiro)
- Se o atleta não tiver anamnese respondida, manter o fallback com `created_at` do `meal_plan_status`

**Arquivos a editar:**
- `src/hooks/useMealPlanStatus.tsx` — adicionar query de `anamnese_responses.submitted_at` por `client_id`
- `src/components/dashboard/PendingMealPlansAlert.tsx` — atualizar UI com cálculo de dias úteis e badges de prazo

---

### Ponto 2 — Alerta Mensal de Ajuste de Dieta (refinamento)

**Problema atual:** O `DietAdjustmentAlert` já existe mas precisa ser mais inteligente. Deve considerar:
- Apenas atletas **sem consulta** (`consultation_count = 0/null`) ou **com 1 consulta** (`consultation_count = 1`)
- Apenas se o check-in for **mensal** ou **quinzenal** (`checkin_frequency` = `monthly` ou `biweekly`)
- Deve funcionar **mesmo com periodização ativa**
- Ordenar por urgência (quem está mais atrasado primeiro)
- Mostrar link direto para ver check-ins do atleta

**Solução:**
- Refinar a query em `usePendingDietAlerts` para incluir o filtro de `checkin_frequency` (`monthly` ou `biweekly`)
- Adicionar busca do último check-in respondido de cada atleta para exibir contexto
- Ordenar os alertas: primeiro quem nunca teve ajuste, depois por data do último ajuste (mais antigo primeiro)
- No card, adicionar botão "Ver check-ins" que leva direto ao detalhe do atleta na aba de check-ins
- Mostrar há quantos dias o último ajuste foi feito e a data do último check-in respondido

**Arquivos a editar:**
- `src/hooks/useDietAdjustmentAlerts.tsx` — refinar filtros (`checkin_frequency in monthly, biweekly`), buscar último check-in, ordenar por urgência
- `src/components/dashboard/DietAdjustmentAlert.tsx` — melhorar UI com mais contexto (último check-in, dias desde último ajuste, botão "Ver check-ins")

---

### Resumo de mudanças

| Arquivo | Mudança |
|---|---|
| `src/hooks/useMealPlanStatus.tsx` | Buscar `submitted_at` da anamnese por cliente |
| `src/components/dashboard/PendingMealPlansAlert.tsx` | Prazo de 4 dias úteis a partir da anamnese, badges de urgência |
| `src/hooks/useDietAdjustmentAlerts.tsx` | Filtrar por `checkin_frequency`, buscar último check-in, ordenar por urgência |
| `src/components/dashboard/DietAdjustmentAlert.tsx` | UI com contexto do check-in, link direto, ordenação visual |

Nenhuma alteração de schema/migração necessária — todos os dados já existem nas tabelas `anamnese_responses`, `clients` e `checkin_responses`.

