// Avaliação de lógica condicional da ANAMNESE COMPLETA.
// Uma condição pode referenciar outra pergunta (por question_key) ou, dentro de
// um field_group, outro sub-campo do mesmo grupo via prefixo 'self.'.

import type { Condition } from './anamneseCompletaQuestions';

function valueAt(scope: Record<string, any>, key: string): any {
  return scope ? scope[key] : undefined;
}

function isEmpty(v: any): boolean {
  if (v === null || v === undefined || v === '') return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v).length === 0;
  return false;
}

function testLeaf(cond: Condition, scope: Record<string, any>, selfScope?: Record<string, any>): boolean {
  const rawKey = cond.key || '';
  const useSelf = rawKey.startsWith('self.');
  const key = useSelf ? rawKey.slice(5) : rawKey;
  const src = useSelf ? (selfScope || {}) : scope;
  const actual = valueAt(src, key);
  const op = cond.op || 'truthy';
  const target = cond.value;

  switch (op) {
    case 'equals': return actual === target;
    case 'not_equals': return actual !== target;
    case 'in': return Array.isArray(target) && target.includes(actual);
    case 'not_in': return Array.isArray(target) && !target.includes(actual);
    case 'includes': return Array.isArray(actual) && actual.includes(target);
    case 'includes_any':
      return Array.isArray(actual) && Array.isArray(target) && target.some((t) => actual.includes(t));
    case 'not_empty': return !isEmpty(actual);
    case 'truthy': return !!actual;
    default: return true;
  }
}

// Avalia uma condição (com any/all aninhados). Sem condição → visível.
export function evalCondition(
  cond: Condition | undefined | null,
  scope: Record<string, any>,
  selfScope?: Record<string, any>,
): boolean {
  if (!cond) return true;
  if (Array.isArray(cond.all)) return cond.all.every((c) => evalCondition(c, scope, selfScope));
  if (Array.isArray(cond.any)) return cond.any.some((c) => evalCondition(c, scope, selfScope));
  return testLeaf(cond, scope, selfScope);
}

// Pergunta é visível? (conditional_logic.show_if avaliado contra o mapa de
// respostas por question_key). `answersByKey` = { [question_key]: answer }.
export function isQuestionVisible(
  question: { conditional_logic?: { show_if?: Condition } | null },
  answersByKey: Record<string, any>,
): boolean {
  return evalCondition(question.conditional_logic?.show_if ?? null, answersByKey);
}

// Sub-campo (de field_group/structured_list) visível? `selfScope` = valores do
// próprio grupo/linha; `scope` = respostas por question_key (para refs externas).
export function isSubFieldVisible(
  sub: { show_if?: Condition },
  selfScope: Record<string, any>,
  scope: Record<string, any>,
): boolean {
  return evalCondition(sub.show_if ?? null, scope, selfScope);
}
