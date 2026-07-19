// Exames do atleta — vindo do Hub do Plano Alimentar.
// Rota: /meal-plans/:clientId/lab-exams
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FlaskConical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { NPLabExamsTab } from '@/components/periodization/NPLabExamsTab';

export default function AthleteLabExams() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();

  const { data: client } = useQuery({
    queryKey: ['athlete-lab-exams-client', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id,name').eq('id', clientId!).maybeSingle();
      return data;
    },
  });

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
              <FlaskConical className="h-5 w-5 text-primary" />
              Exames laboratoriais
            </h1>
            <p className="text-xs text-muted-foreground">{client?.name || '—'}</p>
          </div>
        </div>
        <NPLabExamsTab clientId={clientId} />
      </div>
    </Layout>
  );
}
