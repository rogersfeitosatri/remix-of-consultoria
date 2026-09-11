/**
 * Categoria de um link da página /bio.
 *
 * O valor vem da coluna `link_bio_items.category` e decide duas coisas na tela:
 * a etiqueta em maiúsculas acima do título e o ícone do cartão. Um link sem
 * categoria, ou com uma categoria desconhecida, cai no padrão: ícone genérico
 * e nenhuma etiqueta.
 */

export type ChaveDeCategoria =
  | 'assessoria'
  | 'ferramenta'
  | 'parceria'
  | 'produto'
  | 'contato'
  | 'conteudo'
  | 'padrao';

export interface CategoriaDeLink {
  chave: ChaveDeCategoria;
  /** Etiqueta em maiúsculas acima do título. Vazia quando não há o que mostrar. */
  etiqueta: string;
}

const ETIQUETAS: Record<ChaveDeCategoria, string> = {
  assessoria: 'ASSESSORIA',
  ferramenta: 'FERRAMENTA',
  parceria: 'PARCERIA',
  produto: 'PRODUTO',
  contato: 'CONTATO',
  conteudo: 'CONTEÚDO',
  padrao: '',
};

/** As categorias que o gerenciador oferece, na ordem em que aparecem no seletor. */
export const CATEGORIAS_DISPONIVEIS: Exclude<ChaveDeCategoria, 'padrao'>[] = [
  'assessoria',
  'ferramenta',
  'parceria',
  'produto',
  'contato',
  'conteudo',
];

/** Tira acento, espaço em volta e maiúscula, para aceitar o que o nutri digitar. */
function normalizar(bruto: string): string {
  return bruto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function resolverCategoria(bruto: string | null | undefined): CategoriaDeLink {
  if (typeof bruto !== 'string') return { chave: 'padrao', etiqueta: '' };

  const chave = normalizar(bruto);
  const conhecida =
    chave !== 'padrao' && Object.prototype.hasOwnProperty.call(ETIQUETAS, chave);

  if (!conhecida) return { chave: 'padrao', etiqueta: '' };

  return { chave: chave as ChaveDeCategoria, etiqueta: ETIQUETAS[chave as ChaveDeCategoria] };
}

/** Nome da categoria como ele aparece no seletor do gerenciador. */
export function rotuloDeSelecao(chave: Exclude<ChaveDeCategoria, 'padrao'>): string {
  const etiqueta = ETIQUETAS[chave];
  return etiqueta.charAt(0) + etiqueta.slice(1).toLowerCase();
}
