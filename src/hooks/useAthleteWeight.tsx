import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Peso de referência do atleta para cálculos de g/kg no plano alimentar:
 * 1) Peso do check-in mais recente que tem o campo "peso" respondido
 * 2) Fallback: peso registrado na última anamnese (current_weight)
 * 3) Fallback: peso informado manualmente pelo nutri (clients.manual_weight_kg)
 * Retorna null se nenhum existir.
 */
export type WeightSource = 'checkin' | 'anamnese' | 'manual' | null;

export function useAthleteWeight(clientId?: string | null) {
  return useQuery({
    queryKey: ['athlete-weight', clientId],
    enabled: !!clientId,
    staleTime: 60_000,
    queryFn: async (): Promise<{ weightKg: number | null; source: WeightSource; date?: string }> => {
      if (!clientId) return { weightKg: null, source: null };

      // 1) Latest check-in with peso.
      // As respostas do check-in são indexadas por ID da pergunta (não pela
      // chave "peso"). Então localizamos a(s) pergunta(s) de peso pelo texto
      // e lemos a resposta correspondente em cada check-in recente.
      const parseWeight = (raw: any): number | null => {
        if (raw == null || raw === '') return null;
        const val = typeof raw === 'object' && 'answer' in raw ? raw.answer : raw;
        if (val == null || val === '') return null;
        // Normaliza "67,5" / "67.500" / "67.5 kg" → 67.5
        let s = String(val).toLowerCase().replace(/kg/g, '').trim();
        if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); // formato BR
        const w = parseFloat(s.replace(/[^\d.]/g, ''));
        return !isNaN(w) && w > 20 && w < 300 ? w : null;
      };
      try {
        const { data: rows } = await supabase
          .from('checkin_responses')
          .select('responses, submitted_at, form_id')
          .eq('client_id', clientId)
          .order('submitted_at', { ascending: false })
          .limit(20);

        // Descobre os IDs das perguntas de peso nos formulários usados.
        const formIds = Array.from(new Set((rows || []).map((r: any) => r.form_id).filter(Boolean)));
        const weightQuestionIds = new Set<string>();
        if (formIds.length) {
          const { data: qs } = await (supabase as any)
            .from('checkin_questions')
            .select('id, question_text, form_id')
            .in('form_id', formIds);
          for (const q of qs || []) {
            if (/peso/i.test(q.question_text || '')) weightQuestionIds.add(q.id);
          }
        }

        for (const row of rows || []) {
          const resp = (row as any)?.responses || {};
          // Tenta pelas perguntas de peso identificadas…
          for (const qid of weightQuestionIds) {
            const w = parseWeight(resp[qid]);
            if (w != null) return { weightKg: w, source: 'checkin', date: (row as any).submitted_at };
          }
          // …e mantém compatibilidade com a chave literal "peso".
          const legacy = parseWeight(resp.peso);
          if (legacy != null) return { weightKg: legacy, source: 'checkin', date: (row as any).submitted_at };
        }
      } catch { /* fallthrough */ }

      // 2) Fallback: anamnese
      try {
        const { data } = await (supabase as any)
          .from('anamnese_responses')
          .select('current_weight, submitted_at')
          .eq('client_id', clientId)
          .order('submitted_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        const w = data?.current_weight ? parseFloat(String(data.current_weight).replace(',', '.')) : null;
        if (w && !isNaN(w) && w > 20 && w < 300) {
          return { weightKg: w, source: 'anamnese', date: data?.submitted_at };
        }
      } catch { /* fallthrough */ }

      // 3) Fallback: peso manual informado pelo nutri
      try {
        const { data } = await (supabase as any)
          .from('clients')
          .select('manual_weight_kg')
          .eq('id', clientId)
          .maybeSingle();
        const w = data?.manual_weight_kg ? parseFloat(String(data.manual_weight_kg).replace(',', '.')) : null;
        if (w && !isNaN(w) && w > 20 && w < 300) {
          return { weightKg: w, source: 'manual' };
        }
      } catch { /* fallthrough */ }

      return { weightKg: null, source: null };
    },
  });
}
