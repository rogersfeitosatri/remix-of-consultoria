// Gera o Markdown final do plano alimentar a partir do plano estruturado.
// Determinístico (não chama IA) — congela a prescrição aprovada. Segue as regras
// de formatação: cabeçalho, títulos em CAIXA ALTA sem '#', um alimento por
// bullet, substituições na mesma linha com "ou", e "Resumo do dia" ao final.
// NÃO gera PDF.
import { sumFoods, type Nutrients } from './nutritionCalc';

function parseMacros(s: string | undefined | null): Nutrients | null {
  if (!s) return null;
  const num = (label: string): number => {
    const before = s.match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*g?\\s*(?:${label})`, 'i'));
    const after = s.match(new RegExp(`(?:${label})\\s*[:=-]?\\s*(\\d+(?:[.,]\\d+)?)`, 'i'));
    const m = before || after;
    return m ? parseFloat(m[1].replace(',', '.')) : 0;
  };
  const kcal = s.match(/(\d+(?:[.,]\d+)?)\s*kcal/i);
  const calories = kcal ? parseFloat(kcal[1].replace(',', '.')) : 0;
  const carbs_g = num('CHO'), protein_g = num('PTN|PROT'), fat_g = num('LIP|GORD|FAT');
  if (!calories && !carbs_g && !protein_g && !fat_g) return null;
  return { calories, protein_g, carbs_g, fat_g };
}

function foodLine(f: any): string {
  const name = f.name || f.food_name || 'Alimento';
  const qty = f.grams ? `${Math.round(Number(f.grams))} g` : (f.measure || (f.quantity != null ? `${f.quantity}${f.unit ? ' ' + f.unit : ''}` : ''));
  const subs: string[] = Array.isArray(f.substitutions) ? f.substitutions.filter(Boolean) : [];
  let line = `- ${name}${qty ? ` — ${qty}` : ''}`;
  if (subs.length) line += ` ou ${subs.join('; ')}`;
  return line;
}

function optionFoodLines(opt: any): string[] {
  const foods: any[] = Array.isArray(opt.foods) ? opt.foods : [];
  if (foods.length) return foods.map(foodLine);
  // legado: food_groups com texto "A ou B"
  const groups: any[] = Array.isArray(opt.food_groups) ? opt.food_groups : [];
  return groups.map((g) => `- ${g.options || g.group || ''}`).filter((l) => l.trim() !== '-');
}

function optionTotals(opt: any, meal: any): Nutrients {
  const foods: any[] = Array.isArray(opt.foods) ? opt.foods : [];
  if (foods.length) return sumFoods(foods.map((f) => ({
    calories: Number(f.calories) || 0, protein_g: Number(f.protein_g) || 0,
    carbs_g: Number(f.carbs_g) || 0, fat_g: Number(f.fat_g) || 0,
  })));
  return parseMacros(opt.meal_macros || meal.meal_macros) || { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
}

export interface PlanMarkdownOpts {
  nutritionist?: string;
  crn?: string;
  date?: string; // DD/MM/AAAA
}

export function buildPlanMarkdown(analysis: any, opts: PlanMarkdownOpts = {}): string {
  const meals: any[] = analysis?.meal_plan?.meals || [];
  const nutr = opts.nutritionist || 'Rogers Feitosa';
  const crn = opts.crn || 'CRN14885';
  const date = opts.date || new Date().toLocaleDateString('pt-BR');

  const lines: string[] = [];
  lines.push('PLANO ALIMENTAR');
  lines.push(`Data da prescrição: ${date}`);
  lines.push(`Nutricionista Responsável: ${nutr} ${crn}`);
  lines.push('');

  // Total do dia (caminho principal — Opção 1 de cada refeição)
  let dayTotal: Nutrients = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

  for (const meal of meals) {
    const name = (meal.meal_name || 'REFEIÇÃO').toUpperCase();
    const title = meal.horario ? `${name} — ${meal.horario}` : name;
    lines.push(title);
    const opts2: any[] = Array.isArray(meal.options) && meal.options.length ? meal.options : [meal];
    opts2.forEach((opt, i) => {
      if (opts2.length > 1) lines.push(`Opção ${i + 1}`);
      for (const l of optionFoodLines(opt)) lines.push(l);
      if (i === 0) {
        const t = optionTotals(opt, meal);
        dayTotal = {
          calories: dayTotal.calories + t.calories, protein_g: dayTotal.protein_g + t.protein_g,
          carbs_g: dayTotal.carbs_g + t.carbs_g, fat_g: dayTotal.fat_g + t.fat_g,
        };
      }
    });
    lines.push('');
  }

  lines.push(`Resumo do dia: ${Math.round(dayTotal.calories)} kcal | Proteínas ${Math.round(dayTotal.protein_g)} g | Carboidratos ${Math.round(dayTotal.carbs_g)} g | Gorduras ${Math.round(dayTotal.fat_g)} g`);

  // Orientações específicas (quando houver)
  const orient = analysis?.strategic_orientations;
  const orientLines: string[] = [];
  if (orient) {
    for (const k of ['meal_routine', 'training_strategy', 'supplementation']) {
      const arr = (orient as any)[k];
      if (Array.isArray(arr)) for (const o of arr) if (o) orientLines.push(`- ${typeof o === 'string' ? o : (o.text || JSON.stringify(o))}`);
    }
  }
  if (orientLines.length) {
    lines.push('');
    lines.push('ORIENTAÇÕES ESPECÍFICAS PARA O ATLETA');
    lines.push(...orientLines);
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
