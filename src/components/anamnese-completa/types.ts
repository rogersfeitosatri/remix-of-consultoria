// Contrato compartilhado dos campos da ANAMNESE COMPLETA (Fase 2).
import type { SubField } from '@/lib/anamneseCompletaQuestions';

export interface FieldProps {
  value: any;
  onChange: (v: any) => void;
  config?: Record<string, any> | null;
  options?: string[] | null;
  scaleMin?: number;
  scaleMax?: number;
  // Respostas por question_key — para condições que referenciam outras perguntas.
  answersByKey: Record<string, any>;
  disabled?: boolean;
  // Contexto para upload (bucket exige caminho <clientId>/...).
  clientId?: string | null;
}

export interface SubFieldProps {
  field: SubField;
  value: any;
  onChange: (v: any) => void;
  // valores do próprio grupo/linha (para condições 'self.<key>')
  selfScope: Record<string, any>;
  answersByKey: Record<string, any>;
  disabled?: boolean;
  clientId?: string | null;
}
