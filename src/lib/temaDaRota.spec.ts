import { describe, expect, it } from 'vitest';
import { classeDoTema, temaProprioDaRota } from './temaDaRota';

describe('a casca do tema', () => {
  it('a landing do Metanóia fica fora do tema do painel: a paleta dela é própria', () => {
    expect(temaProprioDaRota('/metanoia')).toBe(true);
    expect(classeDoTema('/metanoia', 'dark')).toBe('');
    // Barra no fim e rota abaixo continuam sendo a landing.
    expect(classeDoTema('/metanoia/', 'dark')).toBe('');
    expect(classeDoTema('/metanoia/duvidas', 'dark')).toBe('');
  });

  it('o resto do app veste o tema escolhido', () => {
    expect(temaProprioDaRota('/admin')).toBe(false);
    expect(classeDoTema('/admin', 'dark')).toBe('dark');
    expect(classeDoTema('/clients', 'light')).toBe('light');
    expect(classeDoTema('/', 'dark')).toBe('dark');
    // Nome parecido não é a landing.
    expect(classeDoTema('/metanoiaX', 'dark')).toBe('dark');
    expect(classeDoTema('/plans', 'dark')).toBe('dark');
  });
});
