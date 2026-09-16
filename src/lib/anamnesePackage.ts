/**
 * O pacote de anamnese: o mesmo arquivo que a ponte automática envia ao
 * zonanutriapp e que o botão "Baixar pacote para o app" entrega à mão.
 *
 * Respostas identificadas pela chave da pergunta (question_key), nunca pelo
 * id da linha: a chave é estável entre versões do formulário e é por ela que
 * o app traduz. Perguntas sem chave entram em `nao_mapeadas`, para o
 * nutricionista ver o que ficou de fora em vez de perder em silêncio.
 */

export const PACOTE_VERSAO = 1;

export interface PerguntaDoPacote {
  id: string;
  question_key?: string | null;
  question_text: string;
  question_type: string;
  section?: string | null;
  order_index?: number | null;
}

export interface RespostaDoPacote {
  id?: string;
  submitted_at?: string | null;
  respondent_name?: string | null;
  respondent_email?: string | null;
  responses: Record<string, unknown> | null | undefined;
}

export interface AtletaDoPacote {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface FormularioDoPacote {
  id: string;
  title: string;
  version?: number | null;
}

export interface ItemDoPacote {
  chave: string;
  pergunta: string;
  tipo: string;
  secao: string | null;
  resposta: unknown;
  comentario: string | null;
}

export interface PacoteDeAnamnese {
  versao: typeof PACOTE_VERSAO;
  origem: 'consultoria';
  gerado_em: string;
  formulario: FormularioDoPacote;
  atleta: { id: string | null; nome: string | null; email: string | null; telefone: string | null };
  resposta: { id: string | null; enviada_em: string | null };
  respostas: ItemDoPacote[];
  comportamental: { notas: Record<string, number>; abertas: Record<string, string> };
  nao_mapeadas: Array<{ id: string; pergunta: string; resposta: unknown }>;
}

/** Separa {answer, comment} do valor cru, sem inventar comentário. */
export function desdobrarResposta(bruta: unknown): { resposta: unknown; comentario: string | null } {
  if (bruta && typeof bruta === 'object' && !Array.isArray(bruta) && 'answer' in (bruta as Record<string, unknown>)) {
    const o = bruta as { answer?: unknown; comment?: unknown };
    const comentario = typeof o.comment === 'string' && o.comment.trim() ? o.comment.trim() : null;
    return { resposta: o.answer ?? null, comentario };
  }
  return { resposta: bruta ?? null, comentario: null };
}

function vazia(v: unknown): boolean {
  return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
}

export function montarPacoteDeAnamnese(entrada: {
  formulario: FormularioDoPacote;
  resposta: RespostaDoPacote;
  perguntas: PerguntaDoPacote[];
  atleta?: AtletaDoPacote | null;
  agora?: Date;
}): PacoteDeAnamnese {
  const respostas = entrada.resposta.responses ?? {};
  const ordenadas = [...entrada.perguntas].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  const itens: ItemDoPacote[] = [];
  const naoMapeadas: PacoteDeAnamnese['nao_mapeadas'] = [];
  const notas: Record<string, number> = {};
  const abertas: Record<string, string> = {};

  for (const q of ordenadas) {
    if (q.question_type === 'info') continue;
    const { resposta, comentario } = desdobrarResposta(respostas[q.id]);
    const chave = q.question_key?.trim();
    if (!chave) {
      if (!vazia(resposta)) naoMapeadas.push({ id: q.id, pergunta: q.question_text, resposta });
      continue;
    }
    itens.push({ chave, pergunta: q.question_text, tipo: q.question_type, secao: q.section ?? null, resposta, comentario });
    if (chave.startsWith('aval_')) {
      if (q.question_type === 'scale') {
        const n = Number(resposta);
        if (!vazia(resposta) && Number.isFinite(n)) notas[chave] = n;
      } else if (typeof resposta === 'string' && resposta.trim()) {
        abertas[chave] = resposta.trim();
      }
    }
  }

  const atleta = entrada.atleta ?? null;
  return {
    versao: PACOTE_VERSAO,
    origem: 'consultoria',
    gerado_em: (entrada.agora ?? new Date()).toISOString(),
    formulario: { id: entrada.formulario.id, title: entrada.formulario.title, version: entrada.formulario.version ?? null },
    atleta: {
      id: atleta?.id ?? null,
      nome: atleta?.name ?? entrada.resposta.respondent_name ?? null,
      email: (atleta?.email ?? entrada.resposta.respondent_email ?? null)?.toLowerCase() ?? null,
      telefone: atleta?.phone ?? null,
    },
    resposta: { id: entrada.resposta.id ?? null, enviada_em: entrada.resposta.submitted_at ?? null },
    respostas: itens,
    comportamental: { notas, abertas },
    nao_mapeadas: naoMapeadas,
  };
}

export function nomeDoArquivoDoPacote(pacote: PacoteDeAnamnese): string {
  const nome = (pacote.atleta.nome ?? 'atleta')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'atleta';
  const dia = (pacote.resposta.enviada_em ?? pacote.gerado_em).slice(0, 10);
  return `anamnese-${nome}-${dia}.json`;
}
