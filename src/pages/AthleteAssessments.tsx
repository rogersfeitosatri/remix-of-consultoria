// Avaliações do atleta (composição corporal) — vindo do Hub do Plano Alimentar.
// Rota: /meal-plans/:clientId/assessments
// Garante que exista uma consulta NP para o cliente (pega a mais recente
// ou cria uma "consulta de composição" leve) e renderiza a aba de
// composição corporal completa (com scanner IA, cálculos automáticos, etc.).
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, TrendingUp, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { NPBodyCompositionTab } from '@/components/periodization/NPBodyCompositionTab';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export default function AthleteAssessments() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);

  const { data: client } = useQuery({
    queryKey: ['athlete-assessments-client', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id,name').eq('id', clientId!).maybeSingle();
      return data;
    },
  });

  // Consulta mais recente do cliente
  const { data: consultation, isLoading } = useQuery({
    queryKey: ['np-latest-consultation', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data } = await supabase
        .from('np_consultations')
        .select('*')
        .eq('client_id', clientId!)
        .order('consultation_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // Cria uma consulta base se não existir (para permitir salvar composição)
  useEffect(() => {
    if (isLoading || consultation || !clientId || !user?.id || creating) return;
    setCreating(true);
    (async () => {
      // Prefill peso/altura a partir do perfil (anamnese)
      const { data: profile } = await supabase
        .from('athlete_profiles')
        .select('current_weight, height')
        .eq('client_id', clientId)
        .maybeSingle();
      const { error } = await supabase.from('np_consultations').insert({
        client_id: clientId,
        user_id: user.id,
        consultation_date: new Date().toISOString().split('T')[0],
        weight: profile?.current_weight ?? null,
        height: profile?.height ?? null,
      });
      if (error) {
        toast({ title: 'Erro ao iniciar avaliação', description: error.message, variant: 'destructive' });
      } else {
        queryClient.invalidateQueries({ queryKey: ['np-latest-consultation', clientId] });
      }
      setCreating(false);
    })();
  }, [isLoading, consultation, clientId, user?.id, creating, queryClient]);

  const handleSaveConsultation = async (data: any) => {
    if (!consultation?.id) return;
    const { error } = await supabase
      .from('np_consultations')
      .update(data)
      .eq('id', consultation.id);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Avaliação salva com sucesso' });
    queryClient.invalidateQueries({ queryKey: ['np-latest-consultation', clientId] });
  };

  if (!clientId) return null;

  return (
    <Layout>
      <div className="max-w-[1100px] mx-auto p-3 md:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/meal-plans/${clientId}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao hub
          </Button>
          <div className="text-right">
            <h1 className="text-lg md:text-xl font-bold flex items-center gap-2 justify-end">
              <TrendingUp className="h-5 w-5 text-primary" />
              Avaliação de composição corporal
            </h1>
            <p className="text-xs text-muted-foreground">{client?.name || '—'}</p>
          </div>
        </div>

        {isLoading || !consultation ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Preparando avaliação…
          </div>
        ) : (
          <NPBodyCompositionTab
            consultationId={consultation.id}
            clientId={clientId}
            consultation={consultation}
            onSaveConsultation={handleSaveConsultation}
          />
        )}
      </div>
    </Layout>
  );
}
