import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';

const STATUS: Record<string, string> = { completed: 'Realizada', confirmed: 'Confirmada', scheduled: 'Agendada', pending: 'A confirmar', cancelled: 'Cancelada', canceled: 'Cancelada', no_show: 'Não compareceu', frozen: 'Congelada' };

export function ClientConsultations({ clientId }: { clientId: string }) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['client-consultation-history', user?.id, clientId],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('appointments')
        .select('id, appointment_date, appointment_time, status')
        .eq('user_id', user!.id).eq('client_id', clientId)
        .order('appointment_date', { ascending: false }).order('appointment_time', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
  return <section className="space-y-4" aria-label="Consultas do atleta">
    <div className="flex flex-wrap gap-2"><Button asChild><Link to={`/calendar?booking=new&client=${clientId}`}>Agendar consulta</Link></Button><Button asChild variant="outline"><Link to="/calendar?tab=periodicity">Conferir próximas consultas</Link></Button></div>
    {query.isPending ? <p role="status">Carregando consultas…</p> : query.isError ? <div role="alert"><p>Não foi possível carregar as consultas.</p><Button variant="outline" onClick={() => query.refetch()}>Tentar novamente</Button></div> : <>
      {!query.data?.length && <p className="text-sm text-muted-foreground">Nenhuma consulta registrada.</p>}
      <div className="divide-y divide-border">{query.data?.map(appointment => <Link key={appointment.id} to={`/appointments/${appointment.id}`} className="flex min-h-14 items-center justify-between gap-3 rounded py-3 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring">
        <span>{format(parseISO(appointment.appointment_date), 'dd/MM/yyyy')} · {appointment.appointment_time?.slice(0, 5)}</span><Badge variant="outline">{STATUS[appointment.status] || appointment.status}</Badge>
      </Link>)}</div>
    </>}
  </section>;
}
