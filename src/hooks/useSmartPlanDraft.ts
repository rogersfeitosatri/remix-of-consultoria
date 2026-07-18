// Draft do editor no localStorage por atleta. Fase 1 evita gravar no banco
// automaticamente para não sobrescrever planos existentes: o nutri clica em
// "Salvar plano" quando quiser persistir. O rascunho fica salvo entre sessões.

import { useEffect, useRef, useState } from 'react';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function useSmartPlanDraft(athleteId: string | undefined, initial: string) {
  const key = athleteId ? `smart-plan-draft:${athleteId}` : null;
  const [text, setText] = useState<string>(() => {
    if (!key) return initial;
    try { return localStorage.getItem(key) ?? initial; } catch { return initial; }
  });
  const [state, setState] = useState<SaveState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!key) return;
    setState('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try { localStorage.setItem(key, text); setState('saved'); }
      catch { setState('error'); }
    }, 500);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [text, key]);

  return { text, setText, state };
}
