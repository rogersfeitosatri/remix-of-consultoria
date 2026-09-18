import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ============ O OURO PRECISA SER LEGÍVEL QUANDO É TINTA ============
 *
 * `--primary` (#D9A520) sobre branco dá 2,25:1. O mínimo da WCAG AA para
 * texto é 4,5:1, e `text-primary` aparece em 476 lugares deste app — o item
 * ativo do menu, os rótulos de destaque, os links de ação. No tema claro,
 * todos reprovavam.
 *
 * A correção mora no token: `text-primary` passa a ler `--primary-text`, um
 * degrau mais escuro no claro e o ouro de sempre no escuro. "Mais escuro" não
 * fecha portão nenhum — este arquivo fecha, porque calcula.
 *
 * ==== POR QUE UM TESTE, E NÃO UMA CONFERÊNCIA NO OLHO ====
 *
 * Contraste é a única regra visual que se PROVA com uma conta. Quem no futuro
 * clarear o ouro para "combinar melhor" descobre aqui, e não num relato de
 * alguém que não conseguiu ler a tela.
 */

const CSS = readFileSync(join(import.meta.dirname, '..', 'index.css'), 'utf8');

/** O bloco `:root` (claro) e o `.dark`, separados — cada um tem os seus tokens. */
function blocoDoTema(tema: 'claro' | 'escuro'): string {
  const inicio = tema === 'claro' ? CSS.indexOf(':root {') : CSS.indexOf('.dark {');
  expect(inicio, `o bloco do tema ${tema} sumiu do index.css`).toBeGreaterThan(-1);
  return CSS.slice(inicio, CSS.indexOf('}', inicio));
}

function token(tema: 'claro' | 'escuro', nome: string): [number, number, number] {
  const bloco = blocoDoTema(tema);
  const achado = bloco.match(new RegExp(`--${nome}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`));
  expect(achado, `--${nome} não existe no tema ${tema}`).not.toBeNull();
  return [Number(achado![1]), Number(achado![2]) / 100, Number(achado![3]) / 100];
}

/** HSL → sRGB, na fórmula da especificação. */
function paraRgb([h, s, l]: [number, number, number]): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/** Luminância relativa da WCAG. */
function luminancia(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: [number, number, number], b: [number, number, number]): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
}

/** Uma cor com alfa por cima de outra — o caso do `bg-primary/10`. */
function sobre(frente: [number, number, number], alfa: number, fundo: [number, number, number]) {
  return frente.map((v, i) => v * alfa + fundo[i] * (1 - alfa)) as [number, number, number];
}

const MINIMO_TEXTO = 4.5;
const MINIMO_COMPONENTE = 3;

describe('o ouro como TINTA passa no mínimo da WCAG AA', () => {
  it('no tema claro, sobre o fundo, o muted e o realce do item ativo', () => {
    const tinta = paraRgb(token('claro', 'primary-text'));
    const fundo = paraRgb(token('claro', 'background'));
    const muted = paraRgb(token('claro', 'muted'));
    // O item ativo do menu é `bg-primary/10 text-primary`: a tinta do realce é
    // o ouro CHEIO a 10%, composto sobre o fundo. Medir contra o ouro sólido
    // acusaria uma reprovação que não existe.
    const realce = sobre(paraRgb(token('claro', 'primary')), 0.1, fundo);

    expect(contraste(tinta, fundo)).toBeGreaterThanOrEqual(MINIMO_TEXTO);
    expect(contraste(tinta, muted)).toBeGreaterThanOrEqual(MINIMO_TEXTO);
    expect(contraste(tinta, realce)).toBeGreaterThanOrEqual(MINIMO_TEXTO);
  });

  it('no tema escuro, onde o ouro cheio já se lia', () => {
    const tinta = paraRgb(token('escuro', 'primary-text'));
    const fundo = paraRgb(token('escuro', 'background'));
    expect(contraste(tinta, fundo)).toBeGreaterThanOrEqual(MINIMO_TEXTO);
  });

  it('e o ouro que NÃO é tinta continua sendo a marca', () => {
    // `bg-primary` leva `--primary-foreground` por cima: é o botão, e ele
    // nunca foi o problema. Escurecer o preenchimento junto teria trocado um
    // defeito de leitura por uma marca apagada.
    for (const tema of ['claro', 'escuro'] as const) {
      const fundo = paraRgb(token(tema, 'primary'));
      const tinta = paraRgb(token(tema, 'primary-foreground'));
      expect(contraste(tinta, fundo), `o botão primário no tema ${tema}`).toBeGreaterThanOrEqual(MINIMO_TEXTO);
    }
  });

  it('o ANEL DE FOCO é visto, que é o componente mais funcional de todos', () => {
    // É ele que diz onde o cursor está para quem navega por teclado. No ouro
    // cheio dava 2,24:1 sobre branco, abaixo do mínimo de 3:1 — a pessoa
    // perdia o rastro. Ele só aparece no foco, então escurecê-lo não muda a
    // cara do app em repouso.
    for (const tema of ['claro', 'escuro'] as const) {
      const anel = paraRgb(token(tema, 'ring'));
      const fundo = paraRgb(token(tema, 'background'));
      expect(contraste(anel, fundo), `o anel de foco no tema ${tema}`).toBeGreaterThanOrEqual(MINIMO_COMPONENTE);
    }
  });
});

describe('o que esta rodada MEDIU e não corrigiu', () => {
  /**
   * `border-primary` aparece em 172 lugares e continua no ouro cheio: 2,24:1
   * sobre branco, abaixo dos 3:1 de componente.
   *
   * Não entrou junto de propósito. A WCAG pede 3:1 do contorno que é a ÚNICA
   * coisa marcando um estado; um contorno que acompanha fundo preenchido ou
   * rótulo escrito não precisa. Separar os 172 em "marca sozinho" e
   * "acompanha" é leitura caso a caso, e escurecer todos de uma vez mudaria a
   * cara de 172 elementos numa rodada que era sobre legibilidade.
   *
   * Este teste existe para o número não sumir. Ele PRENDE o estado de hoje: no
   * dia em que alguém escurecer `border-primary`, ele falha e pede que a régua
   * suba junto — que é a conversa certa para ter naquele momento.
   */
  it('a borda primária segue no ouro cheio, e o número está aqui', () => {
    const borda = paraRgb(token('claro', 'primary'));
    const fundo = paraRgb(token('claro', 'background'));
    const medido = contraste(borda, fundo);
    expect(medido).toBeLessThan(MINIMO_COMPONENTE);
    expect(medido).toBeCloseTo(2.24, 1);
  });
});

describe('a correção mora no nome, e não nos 476 lugares', () => {
  it('`text-primary` lê `--primary-text`, com as variantes junto', () => {
    // Reescrever 476 chamadas seria trocar um defeito por uma migração — e a
    // próxima tela escreveria `text-primary` de novo, porque é o nome óbvio.
    const regra = CSS.slice(CSS.indexOf('.text-primary,'), CSS.indexOf('.file\\:text-primary'));
    expect(regra).toMatch(/color:\s*hsl\(var\(--primary-text\)\)/);
    expect(regra).toMatch(/\.hover\\:text-primary:hover/);
    expect(regra).toMatch(/\.focus\\:text-primary:focus/);
  });

  it('e não toca no preenchimento, no contorno nem no anel', () => {
    // O problema nunca foi a cor: foi usá-la como tinta sobre claro.
    const regra = CSS.slice(CSS.indexOf('.text-primary,'), CSS.indexOf('.font-bio-display'));
    for (const utilidade of ['bg-primary', 'border-primary', 'ring-primary', 'from-primary']) {
      expect(regra, `a regra passou a mexer em ${utilidade}`).not.toContain(`.${utilidade}`);
    }
  });
});
