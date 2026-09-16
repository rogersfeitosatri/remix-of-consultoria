import { describe, expect, it } from 'vitest';
import {
  METANOIA_CONSULTAS_NAS_SEMANAS,
  METANOIA_FORM_ID,
  METANOIA_FORM_TITLE,
  METANOIA_INTERVALO_CONSULTAS_SEMANAS,
  METANOIA_PLAN_SLUG,
  METANOIA_SEMANAS,
  linkDaAnamneseMetanoia,
  linkDoWhatsAppMetanoia,
} from './metanoia';
import * as borda from '../../supabase/functions/_shared/metanoia';
import { isAnamneseCompletaForm } from './anamneseCompletaQuestions';
import { CHAVES_COMPORTAMENTAIS_DE_NOTA, montarPerguntasMetanoia, PERGUNTAS_COMPORTAMENTAIS } from './metanoiaAnamnese';

describe('constantes do Metanóia', () => {
  it('o app e as funções de borda apontam para o mesmo formulário e o mesmo plano', () => {
    expect(borda.METANOIA_FORM_ID).toBe(METANOIA_FORM_ID);
    expect(borda.METANOIA_PLAN_SLUG).toBe(METANOIA_PLAN_SLUG);
    expect(borda.METANOIA_SEMANAS).toBe(METANOIA_SEMANAS);
    expect(borda.METANOIA_INTERVALO_CONSULTAS_SEMANAS).toBe(METANOIA_INTERVALO_CONSULTAS_SEMANAS);
    expect(borda.METANOIA_CONSULTAS).toBe(METANOIA_CONSULTAS_NAS_SEMANAS.length);
  });

  it('as consultas caem nas semanas 1, 5 e 9, a cada quatro semanas', () => {
    expect([...METANOIA_CONSULTAS_NAS_SEMANAS]).toEqual([1, 5, 9]);
    for (let i = 1; i < METANOIA_CONSULTAS_NAS_SEMANAS.length; i++) {
      expect(METANOIA_CONSULTAS_NAS_SEMANAS[i] - METANOIA_CONSULTAS_NAS_SEMANAS[i - 1]).toBe(METANOIA_INTERVALO_CONSULTAS_SEMANAS);
    }
  });

  it('o plano da consultoria nasce inativo, com três consultas a cada quatro semanas e check-in semanal', () => {
    const campos = borda.camposDoPlanoMetanoia();
    expect(campos.consultation_frequency).toBe('4_weeks');
    expect(campos.consultation_count).toBe(3);
    expect(campos.has_checkin).toBe(true);
    expect(campos.checkin_frequency).toBe('weekly');
    expect(campos.onboarding_status).toBe('awaiting_payment');
    expect(campos.registration_source).toBe('metanoia');
  });

  it('a vigência cobre 12 semanas a partir do início', () => {
    expect(borda.vigenciaMetanoia('2026-09-21')).toEqual({ start_date: '2026-09-21', end_date: '2026-12-13' });
  });

  it('o botão abre o WhatsApp do nutricionista com a mensagem pronta', () => {
    const link = linkDoWhatsAppMetanoia();
    expect(link.startsWith('https://wa.me/5599984817697?text=')).toBe(true);
    expect(decodeURIComponent(link.split('text=')[1])).toBe('Olá! Quero começar o Metanóia.');
    expect(linkDoWhatsAppMetanoia('+55 (99) 98481-7697', 'oi')).toBe('https://wa.me/5599984817697?text=oi');
  });

  it('o link da anamnese aponta para o formulário fixo no domínio da consultoria', () => {
    expect(linkDaAnamneseMetanoia()).toBe(`https://rogersfeitosa.com.br/anamnese-form/${METANOIA_FORM_ID}`);
    expect(linkDaAnamneseMetanoia('http://localhost:8080/')).toBe(`http://localhost:8080/anamnese-form/${METANOIA_FORM_ID}`);
  });

  it('o título faz o formulário público usar o renderizador da Anamnese Completa', () => {
    expect(isAnamneseCompletaForm({ title: METANOIA_FORM_TITLE })).toBe(true);
  });
});

describe('formulário único do Metanóia', () => {
  const perguntas = montarPerguntasMetanoia();
  const chaves = perguntas.map((q) => q.question_key);

  it('não repete chaves e termina nas observações', () => {
    expect(new Set(chaves).size).toBe(chaves.length);
    expect(chaves.at(-1)).toBe('observacoes_adicionais');
  });

  it('acrescenta os blocos que o app precisa, no lugar certo', () => {
    expect(chaves.indexOf('whatsapp')).toBe(chaves.indexOf('data_nascimento') + 1);
    expect(chaves.indexOf('nivel_atividade_diaria')).toBe(chaves.indexOf('peso_altura') + 1);
    expect(chaves.indexOf('meta_peso_composicao')).toBe(chaves.indexOf('objetivos') + 1);
    for (const chave of ['sono', 'saude_recuperacao', 'medicamentos', 'diagnosticos_exames', 'ciclo_menstrual', 'diferencas_entre_dias']) {
      expect(chaves).toContain(chave);
    }
  });

  it('a seção comportamental vem antes das observações, com as chaves da avaliação curta', () => {
    const inicio = chaves.indexOf('aval_abertura');
    expect(inicio).toBeGreaterThan(0);
    expect(chaves.slice(inicio, inicio + PERGUNTAS_COMPORTAMENTAIS.length)).toEqual(PERGUNTAS_COMPORTAMENTAIS.map((q) => q.question_key));
    expect(CHAVES_COMPORTAMENTAIS_DE_NOTA).toEqual([
      'aval_entende_por_que_come', 'aval_controle_escolhas', 'aval_comida_na_cabeca', 'aval_culpa',
      'aval_autonomia', 'aval_comer_e_treino', 'aval_corpo_e_peso',
    ]);
    for (const q of PERGUNTAS_COMPORTAMENTAIS.filter((p) => p.question_type === 'scale')) {
      expect(q.scale_min).toBe(0);
      expect(q.scale_max).toBe(10);
      expect(q.is_required).toBe(true);
    }
  });

  it('o telefone é obrigatório e a pergunta é reconhecida pela função que extrai o WhatsApp', () => {
    const whatsapp = perguntas.find((q) => q.question_key === 'whatsapp');
    expect(whatsapp?.is_required).toBe(true);
    expect(/telefone|whatsapp|celular|phone/i.test(whatsapp!.question_text)).toBe(true);
  });

  it('falha alto se o template perder uma âncora', () => {
    const semPeso = montarPerguntasMetanoia;
    expect(() => semPeso(montarPerguntasMetanoia().filter((q) => q.question_key !== 'peso_altura' && !q.question_key.startsWith('aval_') && !['whatsapp', 'nivel_atividade_diaria', 'meta_peso_composicao'].includes(q.question_key)))).toThrow(/peso_altura/);
  });
});
