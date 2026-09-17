import { describe, expect, it } from 'vitest';
import { desdobrarResposta, montarPacoteDeAnamnese, nomeDoArquivoDoPacote, vigenciaDoAtleta } from './anamnesePackage';

const perguntas = [
  { id: 'q-info', question_key: 'aval_abertura', question_text: 'Agora, sobre a comida', question_type: 'info', section: '7', order_index: 5 },
  { id: 'q-peso', question_key: 'peso_altura', question_text: 'Peso e altura', question_type: 'field_group', section: '1', order_index: 1 },
  { id: 'q-nome', question_key: 'nome_completo', question_text: 'Nome completo', question_type: 'text', section: '1', order_index: 0 },
  { id: 'q-sem-chave', question_key: null, question_text: 'Idade', question_type: 'text', section: '1', order_index: 2 },
  { id: 'q-vazia', question_key: null, question_text: 'Nada aqui', question_type: 'text', section: '1', order_index: 3 },
  { id: 'q-nota', question_key: 'aval_culpa', question_text: 'Quanto de culpa', question_type: 'scale', section: '7', order_index: 6 },
  { id: 'q-nota-vazia', question_key: 'aval_autonomia', question_text: 'Quanto confia', question_type: 'scale', section: '7', order_index: 7 },
  { id: 'q-aberta', question_key: 'aval_o_que_mudou', question_text: 'O que te trouxe', question_type: 'textarea', section: '7', order_index: 8 },
];
const responses = {
  'q-nome': { answer: 'Ana Souza', comment: null },
  'q-peso': { answer: { peso_kg: 62.5, altura_cm: 168 }, comment: '  ' },
  'q-sem-chave': { answer: '31', comment: 'sem chave' },
  'q-vazia': { answer: '', comment: null },
  'q-nota': { answer: 7, comment: 'às vezes' },
  'q-nota-vazia': { answer: '', comment: null },
  'q-aberta': '  Quero parar de compensar.  ',
};

describe('pacote de anamnese', () => {
  const pacote = montarPacoteDeAnamnese({
    formulario: { id: 'form-1', title: 'Anamnese Completa · Metanóia', version: 1 },
    resposta: { id: 'r-1', submitted_at: '2026-09-20T13:00:00.000Z', respondent_name: 'Ana', respondent_email: 'ANA@EXEMPLO.COM', responses },
    perguntas,
    atleta: { id: 'c-1', name: 'Ana Souza', email: 'ana@exemplo.com', phone: '5599999999999', start_date: '2026-09-21', end_date: '2026-12-13' },
    agora: new Date('2026-09-21T10:00:00.000Z'),
  });

  it('identifica as respostas pela chave, na ordem do formulário, sem os blocos informativos', () => {
    expect(pacote.respostas.map((r) => r.chave)).toEqual(['nome_completo', 'peso_altura', 'aval_culpa', 'aval_autonomia', 'aval_o_que_mudou']);
    expect(pacote.respostas[1].resposta).toEqual({ peso_kg: 62.5, altura_cm: 168 });
    expect(pacote.respostas[1].comentario).toBeNull();
    expect(pacote.respostas[2].comentario).toBe('às vezes');
  });

  it('separa as notas e as abertas da seção comportamental, ignorando o que ficou em branco', () => {
    expect(pacote.comportamental.notas).toEqual({ aval_culpa: 7 });
    expect(pacote.comportamental.abertas).toEqual({ aval_o_que_mudou: 'Quero parar de compensar.' });
  });

  it('lista o que não tem chave em vez de perder em silêncio, e pula o vazio', () => {
    expect(pacote.nao_mapeadas).toEqual([{ id: 'q-sem-chave', pergunta: 'Idade', resposta: '31' }]);
  });

  it('carrega atleta, formulário e origem, com e-mail normalizado', () => {
    expect(pacote.versao).toBe(1);
    expect(pacote.origem).toBe('consultoria');
    expect(pacote.atleta).toEqual({ id: 'c-1', nome: 'Ana Souza', email: 'ana@exemplo.com', telefone: '5599999999999' });
    expect(pacote.formulario).toEqual({ id: 'form-1', title: 'Anamnese Completa · Metanóia', version: 1 });
    expect(pacote.gerado_em).toBe('2026-09-21T10:00:00.000Z');
    expect(JSON.parse(JSON.stringify(pacote))).toEqual(pacote);
  });

  it('cai no respondente quando não há atleta vinculado', () => {
    const solto = montarPacoteDeAnamnese({
      formulario: { id: 'f', title: 't' },
      resposta: { respondent_name: 'Bia', respondent_email: 'Bia@x.com', responses: {} },
      perguntas: [],
    });
    expect(solto.atleta).toEqual({ id: null, nome: 'Bia', email: 'bia@x.com', telefone: null });
    expect(solto.respostas).toEqual([]);
    expect(solto.vigencia).toBeNull();
  });

  it('leva as datas do plano do atleta vinculado, para o app preencher o acesso', () => {
    expect(pacote.vigencia).toEqual({ inicio: '2026-09-21', fim: '2026-12-13' });
    // Um timestamp vira o dia; datas de trás para a frente ou incompletas não viram vigência.
    expect(vigenciaDoAtleta({ start_date: '2026-05-11T00:00:00+00:00', end_date: '2026-11-11' })).toEqual({ inicio: '2026-05-11', fim: '2026-11-11' });
    expect(vigenciaDoAtleta({ start_date: '2026-12-13', end_date: '2026-09-21' })).toBeNull();
    expect(vigenciaDoAtleta({ start_date: '2026-09-21', end_date: null })).toBeNull();
    expect(vigenciaDoAtleta({ start_date: '21/09/2026', end_date: '13/12/2026' })).toBeNull();
    expect(vigenciaDoAtleta(null)).toBeNull();
  });

  it('nomeia o arquivo pelo atleta e pela data do envio', () => {
    expect(nomeDoArquivoDoPacote(pacote)).toBe('anamnese-ana-souza-2026-09-20.json');
  });

  it('desdobra {answer, comment} e deixa o valor cru como está', () => {
    expect(desdobrarResposta({ answer: 3, comment: ' ok ' })).toEqual({ resposta: 3, comentario: 'ok' });
    expect(desdobrarResposta(['a', 'b'])).toEqual({ resposta: ['a', 'b'], comentario: null });
    expect(desdobrarResposta(undefined)).toEqual({ resposta: null, comentario: null });
  });
});
