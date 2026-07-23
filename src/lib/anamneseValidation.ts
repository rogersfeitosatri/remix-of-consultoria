// Validação de obrigatórios compartilhada pela ANAMNESE (completa e pública).
// Enforce, além do is_required da PERGUNTA, os sub-campos required de field_group
// (que antes passavam batido) e a completude do telefone/WhatsApp (DDI+DDD+número).
import { isSubFieldVisible } from './anamneseConditions';

// Telefone/WhatsApp completo = DDI (+NN) + DDD (2+ díg.) + número (8+ díg.).
// Aceita "+55 (11) 99999-9999" ou variações; conta dígitos com folga.
export function isPhoneComplete(value: any): boolean {
  if (typeof value !== 'string' || !value.trim()) return false;
  const hasDdi = /\+\d{1,4}/.test(value);
  const ddiDigits = (value.match(/\+(\d{1,4})/)?.[1] || '').length;
  const totalDigits = value.replace(/\D/g, '').length;
  // Após o DDI, precisa de DDD (2) + número (8) = 10 dígitos.
  return hasDdi && totalDigits - ddiDigits >= 10;
}

export interface AnyQuestion {
  question_type: string;
  question_text?: string;
  question_key?: string | null;
  is_required?: boolean;
  config?: Record<string, any> | null;
}

export interface AnySubField {
  key: string;
  label?: string;
  type?: string;
  required?: boolean;
  show_if?: any;
}

export function isBlankValue(v: any): boolean {
  if (v === null || v === undefined || v === '') return true;
  if (Array.isArray(v)) return v.length === 0 || v.every(isBlankValue);
  if (typeof v === 'object') return Object.keys(v).length === 0 || Object.values(v).every(isBlankValue);
  return false;
}

// Detecta pergunta/sub-campo de telefone/WhatsApp por tipo ou pelo texto/chave.
export function isPhoneLike(text?: string | null, type?: string | null, key?: string | null): boolean {
  if (type === 'phone' || type === 'whatsapp' || type === 'tel') return true;
  const hay = `${text || ''} ${key || ''}`.toLowerCase();
  return /whats\s*app|whatsapp|telefone|celular|\bddd\b|\btel\b/.test(hay);
}

// Retorna o rótulo do primeiro item faltante (ou null se completo).
// answersByKey é usado para resolver show_if de sub-campos com refs externas.
export function firstMissing(
  question: AnyQuestion,
  answer: any,
  answersByKey: Record<string, any> = {},
): string | null {
  const required = !!question.is_required;
  const phone = isPhoneLike(question.question_text, question.question_type, question.question_key);

  // Telefone/WhatsApp: exige DDI + DDD + número quando obrigatório.
  if (phone && question.question_type !== 'field_group') {
    if (!required) return null;
    return isPhoneComplete(answer) ? null : (question.question_text || 'Telefone/WhatsApp');
  }

  // field_group: valida os sub-campos required, visíveis, quando o grupo é
  // obrigatório OU quando já começou a ser preenchido.
  if (question.question_type === 'field_group') {
    const fields: AnySubField[] = Array.isArray(question.config?.fields) ? question.config!.fields : [];
    const group = answer && typeof answer === 'object' && !Array.isArray(answer) ? answer : {};
    const wholeBlank = isBlankValue(answer);

    if (required && wholeBlank) return question.question_text || 'Campo obrigatório';
    if (!required && wholeBlank) return null; // grupo opcional intacto: não bloqueia

    for (const f of fields) {
      if (!f.required) continue;
      if (!isSubFieldVisible(f, group, answersByKey)) continue;
      const val = group[f.key];
      const subPhone = isPhoneLike(f.label, f.type, f.key);
      const ok = subPhone ? isPhoneComplete(val) : !isBlankValue(val);
      if (!ok) return f.label || f.key;
    }
    return null;
  }

  // training_week: exige ao menos uma sessão com conteúdo mínimo quando obrigatória.
  if (question.question_type === 'training_week') {
    if (!required) return null;
    const week = answer && typeof answer === 'object' && !Array.isArray(answer) ? answer : {};
    const hasAnySession = Object.values(week).some((sessions: any) =>
      Array.isArray(sessions) && sessions.some((s: any) => {
        if (!s || typeof s !== 'object') return false;
        return !!(String(s.start_time || '').trim() ||
                  String(s.modality || '').trim() ||
                  String(s.session_type || '').trim() ||
                  (s.duration_minutes !== '' && s.duration_minutes != null) ||
                  (s.distance_km !== '' && s.distance_km != null));
      }),
    );
    if (!hasAnySession) return question.question_text || 'Semana de treino';
    return null;
  }

  // Demais tipos: obrigatório e vazio → falta.
  if (required && isBlankValue(answer)) return question.question_text || 'Campo obrigatório';
  return null;
}

export function isQuestionComplete(
  question: AnyQuestion,
  answer: any,
  answersByKey: Record<string, any> = {},
): boolean {
  return firstMissing(question, answer, answersByKey) === null;
}
