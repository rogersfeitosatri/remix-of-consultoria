import { describe, it, expect } from 'vitest';
import { buildPlanMarkdown } from './planMarkdown';

const analysis = {
  meal_plan: {
    meals: [
      {
        meal_name: 'Café da manhã', horario: '07:30',
        foods: [
          { name: 'Pão francês', grams: 50, calories: 140, protein_g: 4, carbs_g: 28, fat_g: 1, substitutions: ['Tapioca — 45 g'] },
          { name: 'Ovos', measure: '2 unidades', calories: 140, protein_g: 12, carbs_g: 1, fat_g: 10 },
        ],
      },
      {
        meal_name: 'Almoço', horario: '12:30',
        options: [
          { label: 'Opção 1', foods: [{ name: 'Arroz', grams: 100, calories: 130, protein_g: 2, carbs_g: 28, fat_g: 0 }] },
          { label: 'Opção 2', foods: [{ name: 'Batata-doce', grams: 150, calories: 130, protein_g: 2, carbs_g: 30, fat_g: 0 }] },
        ],
      },
    ],
  },
  strategic_orientations: { meal_routine: ['Beba água ao longo do dia'] },
};

describe('buildPlanMarkdown', () => {
  const md = buildPlanMarkdown(analysis, { date: '18/07/2026' });

  it('tem o cabeçalho obrigatório', () => {
    expect(md).toMatch(/^PLANO ALIMENTAR/);
    expect(md).toMatch(/Data da prescrição: 18\/07\/2026/);
    expect(md).toMatch(/Nutricionista Responsável: Rogers Feitosa CRN14885/);
  });
  it('não usa headings com #', () => {
    expect(md).not.toMatch(/(^|\n)#/);
  });
  it('títulos de refeição em caixa alta com horário', () => {
    expect(md).toMatch(/CAFÉ DA MANHÃ — 07:30/);
    expect(md).toMatch(/ALMOÇO — 12:30/);
  });
  it('substituição na mesma linha com "ou"', () => {
    expect(md).toMatch(/- Pão francês — 50 g ou Tapioca — 45 g/);
  });
  it('opções numeradas', () => {
    expect(md).toMatch(/Opção 1/);
    expect(md).toMatch(/Opção 2/);
  });
  it('resumo do dia com os macros (só caminho principal)', () => {
    // café (280 kcal, 16 ptn) + almoço opção1 (130 kcal, 2 ptn) = 410 kcal, 18 ptn
    expect(md).toMatch(/Resumo do dia: 410 kcal \| Proteínas 18 g \| Carboidratos 57 g \| Gorduras 11 g/);
  });
  it('inclui orientações específicas quando houver', () => {
    expect(md).toMatch(/ORIENTAÇÕES ESPECÍFICAS PARA O ATLETA/);
    expect(md).toMatch(/- Beba água ao longo do dia/);
  });
});
