import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export interface MethodPhase {
  id?: string;
  method_id?: string;
  phase_name: string;
  phase_order: number;
  phase_goal: string;
  macro_targets: string[];
  supplementation_daily: string[];
  pre_intra_long_run: Record<string, string>;
  functional_support: string[];
  do_checklist: string[];
  avoid_checklist: string[];
  is_active: boolean;
}

export function usePeriodizationMethod() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get or create active method
  const { data: method, isLoading: loadingMethod } = useQuery({
    queryKey: ['periodization-method', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('periodization_method')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch phases for active method
  const { data: phases = [], isLoading: loadingPhases } = useQuery({
    queryKey: ['periodization-method-phases', method?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('periodization_method_phases')
        .select('*')
        .eq('method_id', method!.id)
        .order('phase_order');
      if (error) throw error;
      return data;
    },
    enabled: !!method?.id,
  });

  const activePhases = phases.filter((p: any) => p.is_active);

  // Create method if none exists (auto-seed)
  const createMethod = useMutation({
    mutationFn: async () => {
      const { data: methodData, error: mErr } = await supabase
        .from('periodization_method')
        .insert({ user_id: user!.id, method_name: 'Método Periodiza' })
        .select()
        .single();
      if (mErr) throw mErr;

      // Seed phases from PDF manual
      const seedPhases: Omit<MethodPhase, 'id' | 'method_id'>[] = [
        {
          phase_name: 'Base (Preparatória)',
          phase_order: 0,
          phase_goal: 'Aumentar volume de treino, capacidade aeróbica, eficiência metabólica e força geral.',
          macro_targets: [
            'CHO: 5–6 g/kg/dia (3–4 g/kg em dias train-low)',
            'Proteína: 1,6–1,8 g/kg/dia',
            'Gorduras: 1–1,2 g/kg/dia (ênfase ômega-3)',
          ],
          supplementation_daily: [
            'Creatina: 3–5 g/dia (sem fase de carga)',
            'Beta-alanina: 4–6 g/dia fracionados (carga por 8–12 semanas)',
            'Ômega-3: 1,5–3 g/dia EPA+DHA',
            'Broncho-Vaxom: 7 mg/dia por 10 dias/mês (3 meses)',
          ],
          pre_intra_long_run: {
            pre: 'Refeição rica em CHO complexos (2–3 g/kg) 3–4h antes. Em treinos train-low: café leve com baixo CHO.',
            intra: '30–60 g/h de CHO + 400–600 mL/h de líquidos com eletrólitos. Testar texturas (géis, bebidas, barras).',
            post: '0,8–1 g/kg CHO + 0,3 g/kg proteína dentro de 30 min. Frutas, smoothies, arroz com frango.',
          },
          functional_support: [
            'Polifenóis (cereja ácida, cúrcuma)',
            'Probióticos e prebióticos',
            'Vitamina D: 1.000–2.000 UI/dia',
            'Magnésio: 300–400 mg/dia',
          ],
          do_checklist: [
            'Sessões train-low em treinos de base/baixa intensidade',
            'Treinar intestino com 30–60 g/h CHO nos longões',
            'Hidratação: 400–600 mL/h + 300–500 mg sódio/h',
            'Iniciar beta-alanina para carga progressiva',
          ],
          avoid_checklist: [
            'Jejum estratégico em alta intensidade',
            'Treinos train-low em atletas iniciantes',
            'Ignorar hidratação/eletrólitos nos longões',
          ],
          is_active: true,
        },
        {
          phase_name: 'Construção (Intensificação)',
          phase_order: 1,
          phase_goal: 'Aumentar intensidade com intervalos e tempo run; desenvolver velocidade e potência aeróbica.',
          macro_targets: [
            'CHO: 6–7 g/kg/dia (maior disponibilidade nos dias intensos)',
            'Proteína: 1,6–1,8 g/kg/dia',
            'Gorduras: 1 g/kg/dia',
          ],
          supplementation_daily: [
            'Creatina: 3–5 g/dia contínua',
            'Beta-alanina: 4–6 g/dia (tamponamento H+)',
            'Cafeína: 3–4 mg/kg 45 min antes de treinos de qualidade',
            'Nitrato: 300–600 mg (suco beterraba) 2–3h antes',
            'Ômega-3: manter 1,5–3 g/dia',
          ],
          pre_intra_long_run: {
            pre: '2–3 g/kg CHO (arroz, batata doce) 3–4h antes. 30g CHO 30–45 min antes.',
            intra: '60–90 g/h CHO (glicose/frutose 2:1) + 400–600 mL/h líquidos.',
            post: 'Igual base: reposição glicogênio + recuperação muscular.',
          },
          functional_support: [
            'Manter ômega-3 e Broncho-Vaxom',
            'Probióticos para saúde intestinal',
          ],
          do_checklist: [
            'Aumento de CHO intra para 60–90 g/h',
            'Cafeína pré-treinos de qualidade',
            'Nitrato em sessões de tempo/intervalos',
            'Reduzir frequência de train-low',
          ],
          avoid_checklist: [
            'Train-low em treinos de qualidade/intervalos',
            'Excesso de restrição calórica',
            'Cafeína em doses >6 mg/kg',
          ],
          is_active: true,
        },
        {
          phase_name: 'Pico / Competição',
          phase_order: 2,
          phase_goal: 'Otimizar rendimento, taper, maximizar reservas de glicogênio. Foco em recuperação.',
          macro_targets: [
            'CHO: 7–10 g/kg/dia (até 12 g/kg para carbo loading 2–3 dias)',
            'Proteína: 1,5–1,6 g/kg/dia',
            'Gorduras: 0,8–1 g/kg/dia',
          ],
          supplementation_daily: [
            'Cafeína: 3–6 mg/kg 45–60 min antes da prova; doses menores durante provas longas',
            'Nitrato: 300–600 mg 2–3h antes + 3 dias antes (acumulativo)',
            'Creatina: manutenção 3–5 g/dia (suspender se retenção)',
            'Beta-alanina: contínua até a prova',
            'Ômega-3: manter 1,5–3 g/dia',
          ],
          pre_intra_long_run: {
            pre: '2–3 g/kg CHO fácil digestão 3–4h antes (pão branco, arroz, banana). 15–30g CHO 15–30 min antes.',
            intra: '60–90 g/h CHO (até 120 g/h se treino intestinal). 300–600 mg sódio/h. Cafeína no 2º terço.',
            post: '1–1,2 g/kg CHO na primeira hora + 0,3 g/kg proteína. 150% fluidos perdidos.',
          },
          functional_support: [
            'Manter ômega-3',
            'Broncho-Vaxom: continuar se dentro do ciclo',
          ],
          do_checklist: [
            'Carbo loading 36–48h antes da prova',
            'Aumentar hidratação e alimentos salgados na véspera',
            'Planejar nutrição da prova: géis, isotônicos, cafeína',
            'Treinar estratégia de prova nos últimos longões',
          ],
          avoid_checklist: [
            'Cafeína na véspera (sono)',
            'Excesso de fibras e gordura pré-prova',
            'Alimentos novos/não testados no dia da prova',
          ],
          is_active: true,
        },
        {
          phase_name: 'Transição (Off-Season)',
          phase_order: 3,
          phase_goal: 'Recuperação física e mental, correção de desequilíbrios musculares, manutenção geral.',
          macro_targets: [
            'CHO: 4–5 g/kg/dia',
            'Proteína: 1,6–1,8 g/kg/dia',
            'Gorduras: 1 g/kg/dia (gorduras saudáveis)',
          ],
          supplementation_daily: [
            'Creatina: pausar ou manter 3–5 g/dia se houver força',
            'Beta-alanina: suspender (retomar no próximo ciclo)',
            'Cafeína: ≤3 mg/kg/dia (evitar tolerância)',
            'Ômega-3: manter 1,5 g/dia',
            'Broncho-Vaxom: completar ciclo se necessário',
          ],
          pre_intra_long_run: {
            pre: 'Refeições normais, sem protocolo especial.',
            intra: 'Pouca ingestão intra-treino conforme necessidade.',
            post: 'Alimentação regular com foco em alimentos integrais.',
          },
          functional_support: [
            'Probióticos naturais (iogurte, kefir, chucrute)',
            'Fibras para recuperar microbiota',
            'Priorizar sono e manejo de estresse',
          ],
          do_checklist: [
            'Alimentos integrais, coloridos, minimamente processados',
            'Introduzir probióticos e prebióticos',
            'Foco em recuperação e saúde geral',
            'Avaliar exames laboratoriais',
          ],
          avoid_checklist: [
            'Ultraprocessados em excesso',
            'Treinos de alta intensidade sem recuperação',
            'Suplementação desnecessária',
          ],
          is_active: true,
        },
      ];

      const phasesToInsert = seedPhases.map(p => ({
        ...p,
        method_id: methodData.id,
      }));

      const { error: pErr } = await supabase
        .from('periodization_method_phases')
        .insert(phasesToInsert as any);
      if (pErr) throw pErr;

      return methodData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['periodization-method'] });
      queryClient.invalidateQueries({ queryKey: ['periodization-method-phases'] });
      toast({ title: 'Método criado com sucesso' });
    },
  });

  // Update phase
  const updatePhase = useMutation({
    mutationFn: async (phase: any) => {
      const { error } = await supabase
        .from('periodization_method_phases')
        .update({ ...phase, updated_at: new Date().toISOString() })
        .eq('id', phase.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['periodization-method-phases'] });
      toast({ title: 'Fase atualizada' });
    },
  });

  // Add phase
  const addPhase = useMutation({
    mutationFn: async (phase: any) => {
      const { error } = await supabase
        .from('periodization_method_phases')
        .insert({ ...phase, method_id: method!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['periodization-method-phases'] });
      toast({ title: 'Fase adicionada' });
    },
  });

  // Delete phase
  const deletePhase = useMutation({
    mutationFn: async (phaseId: string) => {
      const { error } = await supabase
        .from('periodization_method_phases')
        .delete()
        .eq('id', phaseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['periodization-method-phases'] });
      toast({ title: 'Fase excluída' });
    },
  });

  // Toggle phase active
  const togglePhase = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('periodization_method_phases')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['periodization-method-phases'] });
    },
  });

  return {
    method,
    phases,
    activePhases,
    loadingMethod,
    loadingPhases,
    createMethod,
    updatePhase,
    addPhase,
    deletePhase,
    togglePhase,
  };
}
