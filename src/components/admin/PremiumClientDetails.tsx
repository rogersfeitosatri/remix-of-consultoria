import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Calendar, CalendarCheck, ExternalLink, History, Video } from 'lucide-react';
import { toast } from 'sonner';

interface PremiumClientDetailsProps {
  clientId: string;
  clientName: string;
}

export function PremiumClientDetails({ clientId, clientName }: PremiumClientDetailsProps) {
  // Get booking link for this client
  const { data: bookingLink } = useQuery({
    queryKey: ['client-booking-link', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_links')
        .select('*')
        .eq('client_id', clientId)
        .eq('active', true)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  // Get consultation history
  const { data: appointments = [] } = useQuery({
    queryKey: ['client-appointments', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('client_id', clientId)
        .order('appointment_date', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data;
    },
  });

  // Get consultation rule
  const { data: consultRule } = useQuery({
    queryKey: ['client-consultation-rule', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consultation_schedule_rules')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  const bookingUrl = bookingLink ? `${window.location.origin}/booking/${bookingLink.token}` : null;
  
  const firstPendingConsult = !appointments.some(
    apt => ['scheduled', 'confirmed', 'completed'].includes(apt.status)
  );

  const lastCompletedAppointment = appointments.find(
    apt => apt.status === 'completed'
  );

  const nextScheduledAppointment = appointments.find(
    apt => ['scheduled', 'confirmed'].includes(apt.status)
  );

  const handleCopyBookingLink = () => {
    if (bookingUrl) {
      navigator.clipboard.writeText(bookingUrl);
      toast.success('Link copiado!');
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-primary" />
              Consultas Premium
            </CardTitle>
            <CardDescription>Gestão de agendamentos de {clientName}</CardDescription>
          </div>
          <Badge variant={firstPendingConsult ? 'destructive' : 'secondary'}>
            {firstPendingConsult ? '1ª consulta pendente' : 'Ativo'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Booking Link Section */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div>
            <p className="text-sm font-medium">Link de Agendamento</p>
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
              {bookingUrl || 'Não gerado'}
            </p>
          </div>
          <div className="flex gap-2">
            {bookingUrl && (
              <>
                <Button variant="outline" size="sm" onClick={handleCopyBookingLink}>
                  <Copy className="h-3 w-3 mr-1" />
                  Copiar
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={bookingUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Status Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">Última consulta</p>
            <p className="text-sm font-medium">
              {lastCompletedAppointment 
                ? format(parseISO(lastCompletedAppointment.appointment_date), "dd/MM/yyyy", { locale: ptBR })
                : 'Nenhuma'}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">Próxima consulta</p>
            <p className="text-sm font-medium">
              {nextScheduledAppointment
                ? format(parseISO(nextScheduledAppointment.appointment_date), "dd/MM/yyyy", { locale: ptBR })
                : 'Não agendada'}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">Próximo envio do link</p>
            <p className="text-sm font-medium">
              {consultRule?.next_invite_date
                ? format(parseISO(consultRule.next_invite_date), "dd/MM/yyyy", { locale: ptBR })
                : 'Automático'}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">Periodicidade</p>
            <p className="text-sm font-medium">
              {consultRule?.cadence_weeks ? `${consultRule.cadence_weeks} semanas` : '4 semanas'}
            </p>
          </div>
        </div>

        {/* Recent Appointments */}
        {appointments.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2 flex items-center gap-1">
              <History className="h-4 w-4" />
              Histórico Recente
            </p>
            <div className="space-y-2">
              {appointments.slice(0, 3).map((apt) => (
                <div key={apt.id} className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span>
                      {format(parseISO(apt.appointment_date), "dd/MM/yyyy", { locale: ptBR })} às {apt.appointment_time.substring(0, 5)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      apt.status === 'completed' ? 'secondary' :
                      apt.status === 'confirmed' ? 'default' :
                      apt.status === 'cancelled' ? 'destructive' : 'outline'
                    } className="text-xs">
                      {apt.status === 'completed' ? 'Realizada' :
                       apt.status === 'confirmed' ? 'Confirmada' :
                       apt.status === 'cancelled' ? 'Cancelada' : 'Pendente'}
                    </Badge>
                    {apt.google_meet_link && (
                      <Button variant="ghost" size="sm" asChild className="h-6 w-6 p-0">
                        <a href={apt.google_meet_link} target="_blank" rel="noopener noreferrer">
                          <Video className="h-3 w-3" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
