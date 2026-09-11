import { describe, it, expect } from 'vitest';
import {
  resolverCategoria,
  rotuloDeSelecao,
  CATEGORIAS_DISPONIVEIS,
  type ChaveDeCategoria,
} from './linkBioCategories';

describe('resolverCategoria', () => {
  it('resolve cada categoria disponível com a etiqueta em maiúsculas', () => {
    expect(resolverCategoria('assessoria')).toEqual({ chave: 'assessoria', etiqueta: 'ASSESSORIA' });
    expect(resolverCategoria('ferramenta')).toEqual({ chave: 'ferramenta', etiqueta: 'FERRAMENTA' });
    expect(resolverCategoria('parceria')).toEqual({ chave: 'parceria', etiqueta: 'PARCERIA' });
    expect(resolverCategoria('produto')).toEqual({ chave: 'produto', etiqueta: 'PRODUTO' });
    expect(resolverCategoria('contato')).toEqual({ chave: 'contato', etiqueta: 'CONTATO' });
    expect(resolverCategoria('conteudo')).toEqual({ chave: 'conteudo', etiqueta: 'CONTEÚDO' });
  });

  it('aceita acento, espaço em volta e maiúscula', () => {
    expect(resolverCategoria('CONTEÚDO').chave).toBe('conteudo');
    expect(resolverCategoria('  Assessoria  ').chave).toBe('assessoria');
    expect(resolverCategoria('Parceria').etiqueta).toBe('PARCERIA');
  });

  it('cai no padrão quando não há categoria', () => {
    for (const vazio of [null, undefined, '', '   ']) {
      expect(resolverCategoria(vazio)).toEqual({ chave: 'padrao', etiqueta: '' });
    }
  });

  it('cai no padrão em categoria desconhecida, sem quebrar', () => {
    expect(resolverCategoria('marketing')).toEqual({ chave: 'padrao', etiqueta: '' });
    expect(resolverCategoria('123')).toEqual({ chave: 'padrao', etiqueta: '' });
  });

  it('não confunde chave de protótipo com categoria', () => {
    for (const armadilha of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(resolverCategoria(armadilha)).toEqual({ chave: 'padrao', etiqueta: '' });
    }
  });

  it('não aceita o próprio "padrao" como categoria escolhível', () => {
    expect(resolverCategoria('padrao').etiqueta).toBe('');
    expect(CATEGORIAS_DISPONIVEIS).not.toContain('padrao' as ChaveDeCategoria);
  });
});

describe('CATEGORIAS_DISPONIVEIS', () => {
  it('todas resolvem para si mesmas e têm etiqueta', () => {
    for (const chave of CATEGORIAS_DISPONIVEIS) {
      const resolvida = resolverCategoria(chave);
      expect(resolvida.chave).toBe(chave);
      expect(resolvida.etiqueta.length).toBeGreaterThan(0);
    }
  });

  it('não tem repetição', () => {
    expect(new Set(CATEGORIAS_DISPONIVEIS).size).toBe(CATEGORIAS_DISPONIVEIS.length);
  });
});

describe('rotuloDeSelecao', () => {
  it('escreve o nome com inicial maiúscula', () => {
    expect(rotuloDeSelecao('assessoria')).toBe('Assessoria');
    expect(rotuloDeSelecao('conteudo')).toBe('Conteúdo');
  });
});
