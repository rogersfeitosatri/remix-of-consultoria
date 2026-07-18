// Serviço ÚNICO de cálculo nutricional do Plano Alimentar (reutilizado por
// geração, importação, edição e finalização). Puro e testável — sem rede.
// Evita regras divergentes entre frontend e backend: qualquer camada deve
// importar destas funções (ou de um port fiel) em vez de recalcular ad hoc.

export interface Nutrients {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number;
}

export const ZERO: Nutrients = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };

function n(v: any): number { const x = Number(v); return Number.isFinite(x) ? x : 0; }

export function addNutrients(a: Nutrients, b: Nutrients): Nutrients {
  return {
    calories: n(a.calories) + n(b.calories),
    protein_g: n(a.protein_g) + n(b.protein_g),
    carbs_g: n(a.carbs_g) + n(b.carbs_g),
    fat_g: n(a.fat_g) + n(b.fat_g),
    fiber_g: n(a.fiber_g) + n(b.fiber_g),
  };
}

export function roundNutrients(t: Nutrients, digits = 0): Nutrients {
  const f = Math.pow(10, digits);
  return {
    calories: Math.round(n(t.calories) * f) / f,
    protein_g: Math.round(n(t.protein_g) * f) / f,
    carbs_g: Math.round(n(t.carbs_g) * f) / f,
    fat_g: Math.round(n(t.fat_g) * f) / f,
    fiber_g: Math.round(n(t.fiber_g) * f) / f,
  };
}

// Macros de um alimento a partir de valores por 100 g e da quantidade em gramas.
export function foodFromPer100g(per100g: Nutrients, grams: number): Nutrients {
  const k = n(grams) / 100;
  return {
    calories: n(per100g.calories) * k,
    protein_g: n(per100g.protein_g) * k,
    carbs_g: n(per100g.carbs_g) * k,
    fat_g: n(per100g.fat_g) * k,
    fiber_g: n(per100g.fiber_g) * k,
  };
}

// Deriva calorias a partir dos macros (4/4/9) quando não informadas.
export function caloriesFromMacros(t: Nutrients): number {
  return n(t.carbs_g) * 4 + n(t.protein_g) * 4 + n(t.fat_g) * 9;
}

export function sumFoods(foods: Nutrients[]): Nutrients {
  return (foods || []).reduce((acc, f) => addNutrients(acc, f), { ...ZERO });
}

// ─────────── g/kg e kcal/kg ───────────
export interface PerKg { cho_gkg: number; protein_gkg: number; fat_gkg: number; kcal_kg: number; }
export function perKg(t: Nutrients, weightKg: number | null | undefined): PerKg | null {
  const w = n(weightKg);
  if (w <= 0) return null;
  return {
    cho_gkg: Math.round((n(t.carbs_g) / w) * 100) / 100,
    protein_gkg: Math.round((n(t.protein_g) / w) * 100) / 100,
    fat_gkg: Math.round((n(t.fat_g) / w) * 100) / 100,
    kcal_kg: Math.round((n(t.calories) / w) * 10) / 10,
  };
}

// ─────────── Caminhos executáveis (opções) ───────────
// Uma refeição pode ter N opções; cada CAMINHO diário escolhe uma opção por
// refeição. Não somamos opções como se fossem consumidas juntas.
export interface MealForPaths { name?: string; optionTotals: Nutrients[]; }

// Totais dos caminhos de menor e maior energia do dia (limites executáveis).
export function dayPathBounds(meals: MealForPaths[]): { min: Nutrients; max: Nutrients } {
  let min = { ...ZERO }; let max = { ...ZERO };
  for (const m of meals) {
    const opts = m.optionTotals.length ? m.optionTotals : [ZERO];
    const byCal = [...opts].sort((a, b) => n(a.calories) - n(b.calories));
    min = addNutrients(min, byCal[0]);
    max = addNutrients(max, byCal[byCal.length - 1]);
  }
  return { min: roundNutrients(min, 1), max: roundNutrients(max, 1) };
}

// Percentual de diferença relativo a uma base (|a-b|/base).
export function pctDiff(value: number, base: number): number {
  if (n(base) === 0) return n(value) === 0 ? 0 : 1;
  return Math.abs(n(value) - n(base)) / Math.abs(n(base));
}

// ─────────── Auditoria de equivalência (tolerâncias do prompt) ───────────
export type AuditLevel = 'block' | 'warn' | 'info';
export interface AuditFinding { level: AuditLevel; code: string; message: string; value?: number; }

export const TOLERANCES = {
  weeklyOptionKcalWarn: 0.05,   // preferencialmente até 5%
  weeklyOptionKcalBlock: 0.10,  // opções da mesma refeição até 10%
  weeklyDayKcal: 0.05,          // caminho diário até 5% da meta calórica
  carbloadOptionCho: 0.15,      // opções de carbload até 15% de CHO
  carbloadDayCho: 0.05,         // caminho diário de carbload até 5% da meta de CHO
  carbloadDayKcal: 0.10,        // energia do carbload até 10% da meta
};

// Audita as opções de UMA refeição (plano semanal): energia entre opções.
export function auditMealOptionsWeekly(mealName: string, optionTotals: Nutrients[]): AuditFinding[] {
  const out: AuditFinding[] = [];
  if (optionTotals.length < 2) return out;
  const cals = optionTotals.map((o) => n(o.calories));
  const min = Math.min(...cals), max = Math.max(...cals);
  const base = (min + max) / 2 || 1;
  const diff = pctDiff(max, base) + pctDiff(min, base); // amplitude relativa
  const spread = (max - min) / base;
  if (spread > TOLERANCES.weeklyOptionKcalBlock) {
    out.push({ level: 'block', code: 'OPTION_KCAL_SPREAD', message: `Opções de "${mealName}" com diferença calórica de ${(spread * 100).toFixed(0)}% (limite 10%).`, value: spread });
  } else if (spread > TOLERANCES.weeklyOptionKcalWarn) {
    out.push({ level: 'warn', code: 'OPTION_KCAL_SPREAD', message: `Opções de "${mealName}" com diferença calórica de ${(spread * 100).toFixed(0)}% (ideal até 5%).`, value: spread });
  }
  return out;
}

// Audita as opções de carbload por CHO.
export function auditMealOptionsCarbload(mealName: string, optionTotals: Nutrients[]): AuditFinding[] {
  const out: AuditFinding[] = [];
  if (optionTotals.length < 2) return out;
  const cho = optionTotals.map((o) => n(o.carbs_g));
  const min = Math.min(...cho), max = Math.max(...cho);
  const base = (min + max) / 2 || 1;
  const spread = (max - min) / base;
  if (spread > TOLERANCES.carbloadOptionCho) {
    out.push({ level: 'block', code: 'CARBLOAD_OPTION_CHO_SPREAD', message: `Opções de "${mealName}" (carbload) com diferença de CHO de ${(spread * 100).toFixed(0)}% (limite 15%).`, value: spread });
  }
  return out;
}

// Audita o fechamento do dia contra a meta.
export function auditDayAgainstTarget(opts: {
  mode: 'weekly' | 'carbload';
  bounds: { min: Nutrients; max: Nutrients };
  targetKcal?: number | null;
  targetChoG?: number | null;
}): AuditFinding[] {
  const out: AuditFinding[] = [];
  const { mode, bounds } = opts;
  const midKcal = (n(bounds.min.calories) + n(bounds.max.calories)) / 2;
  const midCho = (n(bounds.min.carbs_g) + n(bounds.max.carbs_g)) / 2;
  if (mode === 'weekly' && opts.targetKcal) {
    const d = pctDiff(midKcal, opts.targetKcal);
    if (d > TOLERANCES.weeklyDayKcal) out.push({ level: 'block', code: 'DAY_KCAL_TARGET', message: `Caminho diário a ${(d * 100).toFixed(0)}% da meta calórica (limite 5%).`, value: d });
  }
  if (mode === 'carbload') {
    if (opts.targetChoG) {
      const d = pctDiff(midCho, opts.targetChoG);
      if (d > TOLERANCES.carbloadDayCho) out.push({ level: 'block', code: 'CARBLOAD_DAY_CHO', message: `Carbload a ${(d * 100).toFixed(0)}% da meta de CHO (limite 5%).`, value: d });
    }
    if (opts.targetKcal) {
      const d = pctDiff(midKcal, opts.targetKcal);
      if (d > TOLERANCES.carbloadDayKcal) out.push({ level: 'warn', code: 'CARBLOAD_DAY_KCAL', message: `Energia do carbload a ${(d * 100).toFixed(0)}% da meta (limite 10%).`, value: d });
    }
  }
  return out;
}

// Resumo pronto para exibir: totais + g/kg + auditoria consolidada.
export interface PlanBaseSummary {
  totals: Nutrients;
  perKg: PerKg | null;
  weightKg: number | null;
  bounds: { min: Nutrients; max: Nutrients };
  findings: AuditFinding[];
  hasBlock: boolean;
}

export function summarizePlanBase(opts: {
  meals: { name: string; optionTotals: Nutrients[] }[];
  weightKg?: number | null;
  mode?: 'weekly' | 'carbload';
  targetKcal?: number | null;
  targetChoG?: number | null;
}): PlanBaseSummary {
  const mode = opts.mode ?? 'weekly';
  const bounds = dayPathBounds(opts.meals);
  // total "representativo" = opção 1 de cada refeição (caminho principal)
  const primary = opts.meals.reduce((acc, m) => addNutrients(acc, m.optionTotals[0] || ZERO), { ...ZERO });
  const findings: AuditFinding[] = [];
  for (const m of opts.meals) {
    findings.push(...(mode === 'carbload' ? auditMealOptionsCarbload(m.name, m.optionTotals) : auditMealOptionsWeekly(m.name, m.optionTotals)));
  }
  findings.push(...auditDayAgainstTarget({ mode, bounds, targetKcal: opts.targetKcal, targetChoG: opts.targetChoG }));
  return {
    totals: roundNutrients(primary, 0),
    perKg: perKg(primary, opts.weightKg),
    weightKg: opts.weightKg ?? null,
    bounds,
    findings,
    hasBlock: findings.some((f) => f.level === 'block'),
  };
}
