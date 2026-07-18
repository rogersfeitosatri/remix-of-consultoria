// AST do Editor Inteligente de Plano Alimentar.
// Regra: cada linha textual é 1 GRUPO (alimento principal + substituições
// separadas por "ou"). Título de refeição é um bloco separado que agrupa
// as linhas subsequentes até o próximo título.

export interface FoodToken {
  /** Nome digitado pelo nutricionista (pode não estar resolvido). */
  name: string;
  /** Quantidade numérica (ex.: 2, 1.5). */
  quantity?: number | null;
  /** Medida caseira ou "g"/"ml" (texto exibido). */
  measure?: string | null;
  /** Peso em gramas equivalente (quando resolvido). */
  grams?: number | null;
  /** ID do alimento no banco (food_items.id). Ausente = não resolvido. */
  foodItemId?: string | null;
  /** ID da medida (food_measures.id) quando a medida veio do banco. */
  measureId?: string | null;
  /** Macros calculados para essa porção. */
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  /** Trecho de texto original — usado para preservar o que o nutri escreveu. */
  raw?: string;
}

export interface GroupLine {
  /** Primeiro token = alimento principal; os demais = substituições. */
  tokens: FoodToken[];
}

export interface MealBlock {
  /** Título livre da refeição (ex.: "Café da manhã"). */
  name: string;
  /** Horário no formato "HH:MM" quando reconhecido. */
  time?: string | null;
  /** Grupos de alimentos (uma linha = um grupo). */
  groups: GroupLine[];
  /** Observações/orientações livres da refeição. */
  notes?: string;
}

export interface PlanAst {
  meals: MealBlock[];
}
