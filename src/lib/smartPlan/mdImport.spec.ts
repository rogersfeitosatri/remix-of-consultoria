import { describe, it, expect, vi } from 'vitest';

// Sem banco/IA no teste — só a distribuição por dia e as orientações (parsing).
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn(async () => ({ data: {}, error: null })) }));
vi.mock('@/integrations/supabase/client', () => {
  const q: any = { select: () => q, ilike: () => q, limit: () => Promise.resolve({ data: [] }), then: (r: any) => Promise.resolve({ data: [] }).then(r) };
  return { supabase: { from: () => q, functions: { invoke } } };
});

import { importMealPlanFromMarkdown } from './mdImport';

const MD = `PLANO A

Dias: segunda, quarta, quinta e sexta

CAFÉ DA MANHÃ — 07:00

OPÇÃO 1

- Mamão — 1 porção (200 g).
- Café sem açúcar — 1 xícara (200 ml).

JANTAR — 20:30

OPÇÃO 1

- Arroz branco cozido — 7 colheres de sopa (140 g).

Resumo do dia: 1.980 kcal | Proteínas 132 g | Carboidratos 257 g | Gorduras 46 g

---

PLANO C — CARBLOADING (D-1)

Dias: sábado

ALMOÇO — 12:30

OPÇÃO 1

- Arroz branco cozido — 12 colheres de sopa (235 g).

JANTAR — 19:30

OPÇÃO 1

- Macarrão cozido — 1 prato raso (220 g).

Resumo do dia: 2.225 kcal

TROCAS PERMITIDAS

- Se a lentilha for testada, substitua o feijão por lentilha.

ORIENTAÇÕES ESPECÍFICAS PARA O ATLETA

- Mantenha a creatina todos os dias.`;

describe('importMealPlanFromMarkdown', () => {
  it('distribui os planos por dia da semana', async () => {
    const r = await importMealPlanFromMarkdown(MD);
    expect(Object.keys(r.perDay).sort()).toEqual(['qua', 'qui', 'sab', 'seg', 'sex']);
    expect(r.perDay.seg).toContain('Mamão');
    expect(r.perDay.sab).toContain('Macarrão cozido');
  });

  it('TROCAS PERMITIDAS e ORIENTAÇÕES vão para orientações (não vazam na refeição)', async () => {
    const r = await importMealPlanFromMarkdown(MD);
    expect(r.orientations).toContain('TROCAS PERMITIDAS');
    expect(r.orientations).toContain('Se a lentilha');
    expect(r.orientations).toContain('Mantenha a creatina');
    // O item de troca NÃO pode aparecer no plano do sábado.
    expect(r.perDay.sab).not.toContain('Se a lentilha');
  });

  it('reconhece refeição com texto após o horário (Terça/Domingo com café da manhã)', async () => {
    const md = `PLANO B

Dias: terça e domingo

CAFÉ DA MANHÃ — 07:00 NA TERÇA E APÓS O LONGO NO DOMINGO

OPÇÃO 1

- Mamão — 1 porção (200 g).

LANCHE DA MANHÃ — 10:00

OPÇÃO 1

- Banana-nanica — 1 unidade média (100 g).`;
    const r = await importMealPlanFromMarkdown(md);
    expect(r.perDay.ter).toContain('Café Da Manhã');
    expect(r.perDay.ter).toContain('Mamão');
    expect(r.perDay.dom).toContain('Café Da Manhã');
  });

  it('é determinístico: reimportar dá exatamente o mesmo resultado', async () => {
    const a = await importMealPlanFromMarkdown(MD);
    const b = await importMealPlanFromMarkdown(MD);
    expect(b.perDay).toEqual(a.perDay);
    expect(b.orientations).toEqual(a.orientations);
  });
});
