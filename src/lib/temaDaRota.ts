/**
 * Quem veste o tema do painel e quem não veste.
 *
 * O tema escuro do app não é só cor de fundo. `index.css` tem um bloco de
 * contraste que FORÇA `color: hsl(var(--foreground))` em todo `h1`, `p`,
 * `span`, `li`, `td`, `th`, `label`, `input` e `a` que não tenha uma classe
 * com `text-`. Dentro do painel isso salva a legibilidade.
 *
 * Numa página pública de paleta própria — a landing do Metanóia, creme com
 * texto teal — o mesmo bloco pinta o texto de creme sobre creme, e a página
 * fica em branco para quem chega (o tema padrão de quem nunca entrou no
 * painel é o escuro). Essas rotas ficam FORA da casca do tema: a folha delas
 * já traz a paleta inteira, escopada na própria página.
 */
export const ROTAS_DE_TEMA_PROPRIO = ['/metanoia'];

/** A rota tem paleta própria? Vale a rota e o que estiver abaixo dela. */
export function temaProprioDaRota(pathname: string): boolean {
  return ROTAS_DE_TEMA_PROPRIO.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`));
}

/** A classe que a casca veste nesta rota — vazia quando a página tem tema próprio. */
export function classeDoTema(pathname: string, theme: string): string {
  return temaProprioDaRota(pathname) ? '' : theme;
}
