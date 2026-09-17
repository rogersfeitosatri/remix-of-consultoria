/**
 * A frase que vai para o toast quando algo falha.
 *
 * O erro cru do Supabase é escrito para quem programa: "Bucket not found",
 * "new row violates row-level security policy". Quem está na tela é o
 * nutricionista, e a mensagem genérica ("Erro ao salvar") esconde a causa —
 * foi o que deixou o upload do Link da Bio mudo quando faltava o bucket.
 *
 * Aqui os casos que a pessoa consegue reconhecer viram português; o resto
 * mostra a mensagem original, que ao menos diz o que houve. Sem mensagem
 * nenhuma, fica o texto padrão de quem chamou.
 */
const TRADUCOES: Array<{ marca: RegExp; frase: string }> = [
  {
    marca: /bucket not found/i,
    frase: 'O armazenamento de imagens não está configurado neste projeto. Avise o suporte: falta o bucket do Supabase.',
  },
  {
    marca: /row-level security|violates row-level/i,
    frase: 'Sem permissão para esta ação. Saia e entre de novo; se continuar, avise o suporte.',
  },
  {
    marca: /payload too large|exceeded the maximum allowed size/i,
    frase: 'A imagem é grande demais para o limite do armazenamento. Tente uma menor.',
  },
  {
    marca: /failed to fetch|networkerror|network request failed/i,
    frase: 'Não deu para falar com o servidor. Confira a conexão e tente de novo.',
  },
];

/** A mensagem crua do erro, seja ele Error, objeto do Supabase ou texto. */
export function mensagemCrua(erro: unknown): string {
  if (typeof erro === 'string') return erro.trim();
  if (erro && typeof erro === 'object') {
    const m = (erro as { message?: unknown }).message;
    if (typeof m === 'string' && m.trim()) return m.trim();
  }
  return '';
}

/** A frase para a tela: a tradução, senão a mensagem crua, senão o padrão. */
export function erroLegivel(erro: unknown, padrao: string): string {
  const crua = mensagemCrua(erro);
  if (!crua) return padrao;
  const traduzido = TRADUCOES.find(({ marca }) => marca.test(crua));
  return traduzido ? traduzido.frase : `${padrao}: ${crua}`;
}
