// Metanóia — constantes do programa para as funções de borda.
// Espelho de src/lib/metanoia.ts (o teste do app confere a igualdade).
export const METANOIA_FORM_ID = '5c4f1b2e-9d3a-4e8b-8f6a-2a7c1d9e0b11';
export const METANOIA_PLAN_SLUG = 'metanoia';
export const METANOIA_SEMANAS = 12;
export const METANOIA_CONSULTAS = 3;
export const METANOIA_INTERVALO_CONSULTAS_SEMANAS = 4;
/** Valor usado quando o plano "metanoia" ainda não existe em onboarding_plans. */
export const METANOIA_VALOR_PADRAO = 1297;
export const METANOIA_PARCELAS = 3;

export function ehFormularioMetanoia(formId: unknown): boolean {
  return typeof formId === 'string' && formId.toLowerCase() === METANOIA_FORM_ID;
}

/**
 * O desenho do plano na consultoria: 12 semanas, três consultas a cada quatro
 * semanas (semanas 1, 5 e 9) e check-in semanal. O atleta nasce inativo e só
 * é ativado quando o pagamento confirma (asaas-webhook).
 */
export function camposDoPlanoMetanoia() {
  return {
    service_type: 'nutrition',
    plan_type: 'consultoria',
    plan_duration: 'quarterly',
    has_consultations: true,
    consultation_frequency: '4_weeks',
    consultation_count: METANOIA_CONSULTAS,
    has_checkin: true,
    checkin_frequency: 'weekly',
    registration_source: 'metanoia',
    onboarding_status: 'awaiting_payment',
  };
}

/** Vigência de 12 semanas a partir de uma data civil (YYYY-MM-DD). */
export function vigenciaMetanoia(inicio: string): { start_date: string; end_date: string } {
  const base = Date.parse(inicio + 'T12:00:00Z');
  const fim = new Date(base + (METANOIA_SEMANAS * 7 - 1) * 86_400_000);
  return { start_date: inicio, end_date: fim.toISOString().slice(0, 10) };
}
