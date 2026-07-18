
# Refatoração do Plano Alimentar — Auditoria + Proposta

## 1. Auditoria do que existe hoje

### Páginas e componentes principais
- `src/pages/MealPlans.tsx` (156 linhas): lista/seleção de atleta.
- `src/pages/MealPlanDetail.tsx` (1.081 linhas): tela do plano por atleta, com abas, envio ao Zona Nutri, importação, geração por IA (V2/anamnese), aplicar/desfazer proposta.
- `src/components/admin/EditableMealPlan.tsx` (2.189 linhas): editor atual — cada refeição/alimento/opção é um card com vários botões, dropdowns e modais (o "muitos cliques" que o usuário quer eliminar).
- `PlanInlineEditor.tsx` (267 linhas): tentativa parcial de edição inline, hoje pouco usada.
- `PlanReadOnlyView.tsx` (137 linhas): visualização estruturada, calcula macros a partir de `foods[]`.
- `FoodSearchAutocomplete.tsx` (516 linhas) + `FoodAiDialog.tsx` + `MealAiDialog.tsx`: busca de alimentos e diálogos de IA.
- `MealPlanSkillPanel.tsx`, `PlanFinalizationPanel.tsx`, `PlanPipelinePanel.tsx`, `PlanV2Panel.tsx`: painéis auxiliares de geração/finalização/pipeline.

### Modelo de dados (o que dá para reaproveitar)
- Tabelas: `food_items`, `food_measures`, `substitution_groups`, `client_plan_history`, campos JSON no `clients` (plano atual + proposta) — todos permanecem.
- Estrutura de refeição usada em todo o app (`PlanReadOnlyView`, envio ao Zona Nutri, PDF, importação):
  - `meals[]` → `{ meal_name, horario, timing_note, options: [{ foods: [...] }], food_groups[], meal_macros }`
  - Cada `food` já traz: `name, grams, measure, calories, protein_g, carbs_g, fat_g, substitutions[]`.
- `src/lib/planV2.ts` define o formato v2 (base + camadas semanais/carbload). Continua válido para a geração por IA — muda só o editor.
- Hooks: `useFoodSearch`, `useFoodMeasures`, `useLookupCustomFood` (IA para alimento novo) — reutilizáveis 100%.

### Edge functions envolvidas
- Geração: `generate-base-plan`, `generate-plan-day`, `update-meal-plan`, `adjust-meal-ai`, `finalize-plan`, `audit-meal-plan`, `checkin-plan-patch`.
- Importação: `import-meal-plan` (PDF/Markdown, com fallback Gemini→OpenAI).
- Alimentos: `lookup-custom-food` (IA).
- Zona Nutri: `send-meal-plan-to-zona-nutri`, `notify-meal-plan-ready`.
- **Nada disso muda.** O novo editor só troca a UI que produz/consome o mesmo `meals[]`.

### Problemas concretos do editor atual
1. Cada alimento exige 5–8 cliques (abrir card → escolher grupo → autocomplete → medida → quantidade → substituição → salvar).
2. Fluxo desktop e mobile são o mesmo grid pesado — no celular vira scroll infinito.
3. Substituições vivem em cards separados, sem noção de "grupo/linha".
4. Não há edição contínua nem salvamento incremental por linha; salva o plano inteiro.
5. Importação já retorna o formato correto, mas a UI de revisão é a mesma do editor pesado.

## 2. Proposta — Editor Inteligente de Plano

### Princípios
- Um único `contenteditable` (rich text controlado), estilo Notion/Linear.
- Modelo interno = **AST** (blocos de refeição → linhas de grupo → tokens alimento/quantidade/medida/"ou").
- Ao digitar, o parser reconstrói o AST a partir do texto; ao selecionar sugestão, atualiza o AST e re-renderiza o texto formatado. Sem modais.
- Compilação `AST ⇄ meals[]` (formato canônico do sistema) — Zona Nutri, PDF, IA e leitura continuam funcionando sem mudanças.

### Gramática da linha
```text
HH:MM — Nome da refeição              ← título de refeição (novo bloco)
Alimento - Quantidade Medida [ ou Alimento - Quantidade Medida ]*   ← grupo (1 linha)
Alimento - Quantidade Medida         ← novo grupo (Enter cria linha nova)
```
Reconhece variações: `—`, `-`, `:`, sem separador, "OU"/"/"/"ou então". Título aceita `HH:MM` antes ou depois do nome.

### Sugestões contextuais (popover ancorado no cursor)
- Estado 1 — digitando **nome do alimento**: `useFoodSearch(query)` + recentes/favoritos do nutricionista + item final "🔎 Buscar com IA" (chama `lookup-custom-food`, aprovar e cadastrar).
- Estado 2 — depois de `-` ou espaço numérico: mostra `useFoodMeasures(foodId)` + gramas comuns.
- Navegação: ↑/↓/Enter/Tab/clique/toque. Sem botão "confirmar".

### Grupo (linha) e substituições
- Toda a linha é 1 grupo. Primeiro token = principal; itens após `ou` = substituições.
- Toggle "Recalcular substituições automaticamente" (default ligado). Ao editar quantidade do principal, recalcula equivalência por macro dominante (carb/prot/gord/misto) com base em `calories_per_100g` e `carbs_per_100g|protein_per_100g|fat_per_100g` já existentes. Toast discreto com "desfazer".

### Layout
- **Desktop**: editor central + painel lateral fino (peso, meta, totais por refeição/dia em g/kg, versão, botão "Enviar ao Zona Nutri", status de salvamento).
- **Mobile**: editor em tela cheia; barra flutuante acima do teclado com as sugestões; sheet colapsável no rodapé com totais.
- Linhas longas quebram visualmente com indentação nos "ou".

### Salvamento
- Debounce 800ms → grava JSON `meals[]` no campo já existente do `clients` (ou tabela de rascunho). Indicador discreto "Salvando…/Salvo".
- Local backup em `localStorage` por atleta contra queda de conexão.

### Importação
- `import-meal-plan` continua retornando `meals[]`. O resultado passa por um serializer AST → texto e abre direto no novo editor. Alimentos não resolvidos ficam sublinhados; clique abre popover com sugestões / IA / cadastrar.

### Zona Nutri
- Botão único no painel lateral chama `send-meal-plan-to-zona-nutri` com o mesmo payload atual. Nada muda no contrato.

## 3. Arquitetura técnica

Novos arquivos (isolados; nada removido nesta fase):
```text
src/lib/smartPlan/
  ├─ ast.ts              // tipos: MealBlock, GroupLine, FoodToken
  ├─ parse.ts            // texto → AST (linha a linha, tolerante)
  ├─ serialize.ts        // AST → texto formatado + AST → meals[]
  ├─ fromMeals.ts        // meals[] → AST (import + rascunho existente)
  ├─ equivalence.ts      // recálculo de substituições por macro dominante
  └─ measures.ts         // resolução alimento↔medida↔gramas↔macros
src/components/mealplan-v3/
  ├─ SmartPlanEditor.tsx // ContentEditable controlado
  ├─ SuggestionPopover.tsx
  ├─ TotalsSidebar.tsx   // desktop
  ├─ TotalsSheet.tsx     // mobile
  └─ PlanPageV3.tsx      // nova aba/rota
src/hooks/
  ├─ useSmartPlanDraft.ts// autosave + backup local
  └─ useFoodSuggestions.ts // combina useFoodSearch + recentes + IA
```

Rota nova coexiste com a antiga por trás de flag até validação. Migração de dados = zero (formato canônico `meals[]` idêntico).

Reaproveitamento direto: `useFoodSearch`, `useFoodMeasures`, `useLookupCustomFood`, `PlanReadOnlyView` (para "Visualização estruturada"), `nutritionCalc.ts`, `send-meal-plan-to-zona-nutri`, `import-meal-plan`, `lookup-custom-food`.

## 4. Fases de entrega

**Fase 1 — Protótipo do editor (o que quero implementar primeiro):**
1. AST + parser + serializer.
2. `SmartPlanEditor` com título de refeição, alimento com sugestão, quantidade+medida, `ou` gerando substituição, Enter criando grupo novo.
3. Sincronização principal ↔ substituições com toggle e undo.
4. Totais por refeição e por dia em tempo real.
5. Autosave de rascunho.
6. Rota nova `/plano-alimentar/:athleteId/editor` como aba paralela; nada da UI atual é removido.

**Fase 2 (depois de validado):** importação (PDF/MD) abrindo direto no editor, painel lateral desktop, sheet mobile, envio ao Zona Nutri, versão.

**Fase 3:** simplificar a área do atleta para 4 abas (Plano, Check-ins, Avaliações corporais, Exames) — sem migração destrutiva.

**Fase 4:** Avaliações corporais e Exames laboratoriais (módulos novos).

## 5. Riscos e mitigação
- Parser de linha livre com sinônimos pt-BR → cobrir com testes (`smartPlan.spec.ts`) para cada padrão listado no brief.
- Contenteditable no iOS/Android (seleção, autocorreção) → usar `beforeinput` + estado controlado em React; degradar para `<textarea>` inteligente se necessário.
- Recálculo de equivalência pode confundir em alimentos mistos → default conservador + undo sempre visível.
- Não sobrescrever plano enviado ao Zona Nutri → nova versão gravada em `client_plan_history` como já ocorre hoje.

## 6. Confirmações antes de eu codar a Fase 1
1. Rota paralela `/plano-alimentar/:id/editor` (aba "Editor inteligente" ao lado do atual) para eu validar sem quebrar planos existentes. OK?
2. Persistência da Fase 1 = mesmo campo JSON do plano atual do cliente (`clients.meal_plan` / rascunho já existente). OK?
3. Manter o editor antigo intocado até você aprovar o novo. OK?

Se confirmar (ou disser "segue"), começo pela Fase 1 exatamente como descrito.
