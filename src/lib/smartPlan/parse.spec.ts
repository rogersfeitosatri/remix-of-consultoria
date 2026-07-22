// Testes do parser do Editor Inteligente (V3).
// Cobrem: marcadores `@`/`#`, substituições com "ou", quantidades e medidas,
// títulos com/sem hora, e observações.
import { describe, it, expect } from 'vitest';
import { parseText, parseToken, parseGroupLine, looksLikeMealTitle } from './parse';

describe('looksLikeMealTitle', () => {
  it('reconhece linha com hora + texto como título', () => {
    expect(looksLikeMealTitle('07:00 Café da manhã')).toBe(true);
    expect(looksLikeMealTitle('12h30 Almoço')).toBe(true);
  });
  it('reconhece nomes conhecidos de refeição sem hora', () => {
    expect(looksLikeMealTitle('Café da manhã')).toBe(true);
    expect(looksLikeMealTitle('Pré-treino')).toBe(true);
    expect(looksLikeMealTitle('Ceia')).toBe(true);
  });
  it('não confunde alimento com título', () => {
    expect(looksLikeMealTitle('Pão integral - 2 fatias')).toBe(false);
    expect(looksLikeMealTitle('Arroz integral 100 g')).toBe(false);
  });
});

describe('parseToken', () => {
  it('extrai nome, quantidade e medida com hífen', () => {
    const t = parseToken('Pão integral - 2 fatias');
    expect(t.name).toBe('Pão integral');
    expect(t.quantity).toBe(2);
    expect(t.measure).toBe('fatias');
  });
  it('aceita ":" como divisor', () => {
    const t = parseToken('Arroz: 100 g');
    expect(t.name).toBe('Arroz');
    expect(t.quantity).toBe(100);
    expect(t.measure).toBe('g');
  });
  it('reconhece formato inverso "1 unidade de banana"', () => {
    const t = parseToken('1 unidade de banana');
    expect(t.name).toBe('banana');
    expect(t.quantity).toBe(1);
    expect(t.measure).toBe('unidade');
  });
  it('detecta quantidade sem divisor explícito', () => {
    const t = parseToken('Aveia 40 g');
    expect(t.name).toBe('Aveia');
    expect(t.quantity).toBe(40);
    expect(t.measure).toMatch(/g/);
  });
  it('mantém somente o nome quando não há quantidade', () => {
    const t = parseToken('Manteiga');
    expect(t.name).toBe('Manteiga');
    expect(t.quantity == null).toBe(true);
  });
  it('NÃO confunde a grama do "(X g)" com a quantidade (medida textual)', () => {
    // Bug: "meia medida (15 g)" virava quantidade=15 + "meia medida ( g)".
    const t = parseToken('Whey DUX — meia medida (15 g)');
    expect(t.name).toBe('Whey DUX');
    expect(t.quantity == null).toBe(true);
    expect(t.measure).toBe('meia medida (15 g)');
  });
  it('quantidade inicial + grama entre parênteses coexistem', () => {
    const t = parseToken('Arroz branco cozido — 7 colheres de sopa (140 g)');
    expect(t.name).toBe('Arroz branco cozido');
    expect(t.quantity).toBe(7);
    expect(t.measure).toBe('colheres de sopa (140 g)');
  });
  it('aceita vírgula decimal', () => {
    const t = parseToken('Azeite - 1,5 colher de sopa');
    expect(t.name).toBe('Azeite');
    expect(t.quantity).toBe(1.5);
    expect(t.measure).toMatch(/colher/i);
  });
});

describe('parseGroupLine — substituições com "ou"', () => {
  it('separa alimento principal das substituições', () => {
    const g = parseGroupLine('Pão integral - 2 fatias ou tapioca - 80 g');
    expect(g.tokens.length).toBe(2);
    expect(g.tokens[0].name).toBe('Pão integral');
    expect(g.tokens[1].name).toBe('tapioca');
    expect(g.tokens[1].quantity).toBe(80);
  });
  it('aceita "ou então" e "/" como separadores', () => {
    const a = parseGroupLine('Frango 100g ou então peixe 120g');
    expect(a.tokens.map(t => t.name)).toEqual(['Frango', 'peixe']);
    const b = parseGroupLine('Arroz 100g / batata 150g');
    expect(b.tokens.map(t => t.name)).toEqual(['Arroz', 'batata']);
  });
});

describe('parseText — estrutura completa', () => {
  it('agrupa linhas embaixo do título de refeição', () => {
    const ast = parseText([
      '07:00 Café da manhã',
      'Pão integral - 2 fatias',
      'Ovos - 2 unidades',
      '',
      '12:30 Almoço',
      'Arroz - 100 g',
    ].join('\n'));
    expect(ast.meals.length).toBe(2);
    expect(ast.meals[0].name).toBe('Café da manhã');
    expect(ast.meals[0].time).toBe('07:00');
    expect(ast.meals[0].groups.length).toBe(2);
    expect(ast.meals[1].name).toBe('Almoço');
    expect(ast.meals[1].time).toBe('12:30');
    expect(ast.meals[1].groups.length).toBe(1);
  });

  it('marcador @ força título mesmo em nomes livres', () => {
    const ast = parseText([
      '@ 09:00 Meu lanche especial',
      'Iogurte - 200 g',
    ].join('\n'));
    expect(ast.meals.length).toBe(1);
    expect(ast.meals[0].name).toBe('Meu lanche especial');
    expect(ast.meals[0].time).toBe('09:00');
    expect(ast.meals[0].groups.length).toBe(1);
  });

  it('marcador # vira observação e não gera token de alimento', () => {
    const ast = parseText([
      '07:00 Café',
      'Pão - 2 fatias',
      '# Beba 500ml de água antes',
    ].join('\n'));
    expect(ast.meals[0].notes).toContain('Beba 500ml de água antes');
    expect(ast.meals[0].groups.length).toBe(1);
  });

  it('linhas soltas sem título anterior criam refeição implícita', () => {
    const ast = parseText('Banana - 1 unidade');
    expect(ast.meals.length).toBe(1);
    expect(ast.meals[0].groups.length).toBe(1);
  });

  it('ignora linhas vazias', () => {
    const ast = parseText('\n\n07:00 Café\n\nPão - 1 fatia\n\n');
    expect(ast.meals.length).toBe(1);
    expect(ast.meals[0].groups.length).toBe(1);
  });
});
