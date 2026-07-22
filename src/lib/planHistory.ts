// Histórico de planos salvos do atleta, guardado dentro de
// ai_analyses.raw_response.saved_plans[] (coluna TEXT → JSON string). Sem
// migration. Cada "Salvar plano" atualiza a entrada ATIVA; "Duplicar" cria uma
// nova entrada editável. O plano enviado ao Zona Nutri recebe destaque
// (sent_to_zona_nutri) e apenas UM por vez fica destacado.

export interface SavedPlanMealPlan {
  meals: any[];
  day_variations?: Record<string, any>;
  daily_totals?: any;
}

export interface SavedPlan {
  id: string;
  label: string;
  savedAt: string; // ISO
  meal_plan: SavedPlanMealPlan;
  sent_to_zona_nutri?: boolean;
  sent_at?: string | null;
}

export function parseRaw(raw: any): any {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw;
}

export function genPlanId(): string {
  try {
    if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) return (crypto as any).randomUUID();
  } catch { /* noop */ }
  return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function readSavedPlans(rawObj: any): SavedPlan[] {
  const list = Array.isArray(rawObj?.saved_plans) ? rawObj.saved_plans : [];
  return [...list].sort((a, b) => String(b?.savedAt || '').localeCompare(String(a?.savedAt || '')));
}

// Conta refeições considerando a base E as variações por dia (um plano pode
// existir só em variações — base vazia).
export function countMeals(mp?: SavedPlanMealPlan): number {
  if (!mp) return 0;
  const base = Array.isArray(mp.meals) ? mp.meals.length : 0;
  if (base > 0) return base;
  const vars = mp.day_variations || {};
  let max = 0;
  for (const k of Object.keys(vars)) {
    const v = vars[k];
    const arr = Array.isArray(v) ? v : v?.meals;
    if (Array.isArray(arr)) max = Math.max(max, arr.length);
  }
  return max;
}

export function variationCount(mp?: SavedPlanMealPlan): number {
  return mp?.day_variations ? Object.keys(mp.day_variations).length : 0;
}

// Soma kcal/macros da opção principal de cada refeição (base; senão 1ª variação).
export function planTotals(mp?: SavedPlanMealPlan): { kcal: number; cho: number; ptn: number; lip: number } {
  const acc = { kcal: 0, cho: 0, ptn: 0, lip: 0 };
  if (!mp) return acc;
  let meals = Array.isArray(mp.meals) && mp.meals.length ? mp.meals : null;
  if (!meals) {
    const vars = mp.day_variations || {};
    const firstKey = Object.keys(vars)[0];
    if (firstKey) { const v = vars[firstKey]; meals = Array.isArray(v) ? v : v?.meals; }
  }
  for (const m of meals || []) {
    const foods = (m?.options?.find((o: any) => o.primary) || m?.options?.[0])?.foods || m?.foods || [];
    for (const f of foods) {
      acc.kcal += Number(f?.calories) || 0;
      acc.cho += Number(f?.carbs_g) || 0;
      acc.ptn += Number(f?.protein_g) || 0;
      acc.lip += Number(f?.fat_g) || 0;
    }
  }
  return { kcal: Math.round(acc.kcal), cho: Math.round(acc.cho), ptn: Math.round(acc.ptn), lip: Math.round(acc.lip) };
}

// Insere/atualiza a entrada ATIVA com o meal_plan atual. Retorna o rawObj novo.
export function upsertActivePlan(
  rawObj: any,
  mealPlan: SavedPlanMealPlan,
  opts?: { label?: string },
): { raw: any; activeId: string } {
  const obj = { ...(rawObj || {}) };
  const plans: SavedPlan[] = Array.isArray(obj.saved_plans) ? [...obj.saved_plans] : [];
  let activeId: string = obj.active_plan_id;
  const now = new Date().toISOString();

  const idx = activeId ? plans.findIndex((p) => p.id === activeId) : -1;
  if (idx >= 0) {
    plans[idx] = { ...plans[idx], meal_plan: mealPlan, savedAt: now, label: opts?.label ?? plans[idx].label };
  } else {
    activeId = genPlanId();
    plans.push({
      id: activeId,
      label: opts?.label || `Plano ${plans.length + 1}`,
      savedAt: now,
      meal_plan: mealPlan,
      sent_to_zona_nutri: false,
      sent_at: null,
    });
  }
  obj.saved_plans = plans;
  obj.active_plan_id = activeId;
  obj.meal_plan = mealPlan; // canônico = plano ativo (compat com editor/envio)
  return { raw: obj, activeId };
}

// Duplica uma entrada salva → nova entrada editável (não enviada) e ativa.
export function duplicatePlan(rawObj: any, sourceId: string): { raw: any; newId: string } | null {
  const obj = { ...(rawObj || {}) };
  const plans: SavedPlan[] = Array.isArray(obj.saved_plans) ? [...obj.saved_plans] : [];
  const src = plans.find((p) => p.id === sourceId);
  if (!src) return null;
  const newId = genPlanId();
  const copy: SavedPlan = {
    id: newId,
    label: `Cópia de ${src.label}`,
    savedAt: new Date().toISOString(),
    meal_plan: JSON.parse(JSON.stringify(src.meal_plan || { meals: [] })),
    sent_to_zona_nutri: false,
    sent_at: null,
  };
  plans.push(copy);
  obj.saved_plans = plans;
  obj.active_plan_id = newId;
  obj.meal_plan = copy.meal_plan; // editor carrega a cópia
  return { raw: obj, newId };
}

// Marca a entrada ativa (ou informada) como enviada ao ZN; limpa o destaque das
// demais. Usado após o envio bem-sucedido.
export function markSentToZonaNutri(rawObj: any, planId?: string): any {
  const obj = { ...(rawObj || {}) };
  const plans: SavedPlan[] = Array.isArray(obj.saved_plans) ? [...obj.saved_plans] : [];
  const targetId = planId || obj.active_plan_id || (plans[plans.length - 1]?.id);
  if (!targetId || !plans.length) return obj;
  const now = new Date().toISOString();
  obj.saved_plans = plans.map((p) => p.id === targetId
    ? { ...p, sent_to_zona_nutri: true, sent_at: now }
    : { ...p, sent_to_zona_nutri: false });
  obj.zona_nutri_sent_at = now;
  obj.zona_nutri_sent_plan_id = targetId;
  return obj;
}

// Remove uma entrada do histórico do editor. Se era a ativa, reaponta o ativo
// para a entrada mais recente restante (e atualiza o meal_plan canônico).
export function removeSavedPlan(rawObj: any, planId: string): any {
  const obj = { ...(rawObj || {}) };
  const plans: SavedPlan[] = Array.isArray(obj.saved_plans) ? obj.saved_plans : [];
  const next = plans.filter((p) => p.id !== planId);
  obj.saved_plans = next;
  if (obj.active_plan_id === planId) {
    const newest = [...next].sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')))[0];
    obj.active_plan_id = newest?.id ?? null;
    obj.meal_plan = newest?.meal_plan ?? undefined;
  }
  return obj;
}

// Remove um plano anexado (texto livre) do histórico.
export function removeAttachedPlan(rawObj: any, planId: string): any {
  const obj = { ...(rawObj || {}) };
  const list = Array.isArray(obj.attached_plans) ? obj.attached_plans : [];
  obj.attached_plans = list.filter((p: any) => p.id !== planId);
  return obj;
}

// Define qual entrada o editor deve editar (carrega no canônico meal_plan).
export function setActivePlan(rawObj: any, planId: string): any | null {
  const obj = { ...(rawObj || {}) };
  const plans: SavedPlan[] = Array.isArray(obj.saved_plans) ? obj.saved_plans : [];
  const p = plans.find((x) => x.id === planId);
  if (!p) return null;
  obj.active_plan_id = planId;
  obj.meal_plan = p.meal_plan;
  return obj;
}
