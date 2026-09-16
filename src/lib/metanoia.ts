/**
 * Metanóia — o programa de comportamento alimentar para corredores.
 *
 * Constantes compartilhadas entre a landing (/metanoia), o formulário público
 * e as funções de borda. As funções rodam em Deno e não importam daqui; a
 * cópia delas vive em supabase/functions/_shared/metanoia.ts, e o teste
 * metanoia.spec.ts garante que as duas não divergem.
 */

/** Id fixo do formulário único do programa. Fixo para a função de borda e o link poderem apontar para ele sem consulta. */
export const METANOIA_FORM_ID = '5c4f1b2e-9d3a-4e8b-8f6a-2a7c1d9e0b11';

/** O título precisa conter "Anamnese Completa": é assim que o formulário público escolhe o renderizador estruturado. */
export const METANOIA_FORM_TITLE = 'Anamnese Completa · Metanóia';

export const METANOIA_PLAN_SLUG = 'metanoia';

/** Contato do nutricionista para o botão "Quero começar". Só dígitos, com DDI. */
export const METANOIA_WHATSAPP = '5599984817697';
export const METANOIA_WHATSAPP_MENSAGEM = 'Olá! Quero começar o Metanóia.';

export const METANOIA_SEMANAS = 12;
export const METANOIA_CONSULTAS_NAS_SEMANAS = [1, 5, 9] as const;
export const METANOIA_INTERVALO_CONSULTAS_SEMANAS = 4;

export function linkDoWhatsAppMetanoia(
  numero: string = METANOIA_WHATSAPP,
  mensagem: string = METANOIA_WHATSAPP_MENSAGEM,
): string {
  return `https://wa.me/${numero.replace(/\D/g, '')}?text=${encodeURIComponent(mensagem)}`;
}

export function linkDaAnamneseMetanoia(origem = 'https://rogersfeitosa.com.br'): string {
  return `${origem.replace(/\/$/, '')}/anamnese-form/${METANOIA_FORM_ID}`;
}
