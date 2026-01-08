import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useScheduledCheckins } from '@/hooks/useScheduledCheckins';
import { useClients } from '@/hooks/useClients';
import { format, parseISO, isAfter, isBefore, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, Calendar, ClipboardCheck } from 'lucide-react';

export function ScheduledCheckinsOverview() {
  const { data: checkins = [], isLoading: checkinsLoading } = useScheduledCheckins();
  const { data: clients = [], isLoading: clientsLoading } = useClients();

  if (checkinsLoading || clientsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Check-ins Agendados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const today = new Date();
  const next7Days = addDays(today, 7);

  // Group checkins by client
  const checkinsByClient = checkins.reduce((acc, checkin) => {
    if (!acc[checkin.client_id]) {
      acc[checkin.client_id] = [];
    }
    acc[checkin.client_id].push(checkin);
    return acc;
  }, {} as Record<string, typeof checkins>);

  // Get client name helper
  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'Cliente não encontrado';
  };

  // Filter pending checkins
  const pendingCheckins = checkins.filter(c => c.status === 'pending');
  
  // Upcoming checkins (next 7 days)
  const upcomingCheckins = pendingCheckins.filter(c => {
    const date = parseISO(c.scheduled_send_date);
    return isAfter(date, today) && isBefore(date, next7Days);
  }).sort((a, b) => 
    parseISO(a.scheduled_send_date).getTime() - parseISO(b.scheduled_send_date).getTime()
  );

  // Overdue checkins
  const overdueCheckins = pendingCheckins.filter(c => {
    const date = parseISO(c.scheduled_send_date);
    return isBefore(date, today);
  }).sort((a, b) => 
    parseISO(a.scheduled_send_date).getTime() - parseISO(b.scheduled_send_date).getTime()
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" />
          Check-ins Agendados
        </CardTitle>
        <CardDescription>
          Visualize todos os check-ins programados para seus atletas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overdue Checkins */}
        {overdueCheckins.length > 0 && (
          <div>
            <h4 className="font-medium text-destructive mb-3 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-destructive" />
              Atrasados ({overdueCheckins.length})
            </h4>
            <div className="space-y-2">
              {overdueCheckins.slice(0, 5).map((checkin) => (
                <div
                  key={checkin.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-destructive/30 bg-destructive/5"
                >
                  <div>
                    <p className="font-medium text-sm">{getClientName(checkin.client_id)}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(checkin.scheduled_send_date), "dd/MM/yyyy", { locale: ptBR })}
                      {checkin.scheduled_send_time && ` às ${checkin.scheduled_send_time.substring(0, 5)}`}
                    </p>
                  </div>
                  <Badge variant="destructive">Atrasado</Badge>
                </div>
              ))}
              {overdueCheckins.length > 5 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{overdueCheckins.length - 5} outros atrasados
                </p>
              )}
            </div>
          </div>
        )}

        {/* Upcoming Checkins */}
        {upcomingCheckins.length > 0 && (
          <div>
            <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Próximos 7 dias ({upcomingCheckins.length})
            </h4>
            <div className="space-y-2">
              {upcomingCheckins.slice(0, 10).map((checkin) => (
                <div
                  key={checkin.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                >
                  <div>
                    <p className="font-medium text-sm">{getClientName(checkin.client_id)}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(checkin.scheduled_send_date), "EEEE, dd/MM", { locale: ptBR })}
                      {checkin.scheduled_send_time && ` às ${checkin.scheduled_send_time.substring(0, 5)}`}
                    </p>
                  </div>
                  <Badge variant="secondary">Pendente</Badge>
                </div>
              ))}
              {upcomingCheckins.length > 10 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{upcomingCheckins.length - 10} outros agendados
                </p>
              )}
            </div>
          </div>
        )}

        {/* Summary by client */}
        <div>
          <h4 className="font-medium text-foreground mb-3">Resumo por Atleta</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {Object.entries(checkinsByClient)
              .filter(([_, clientCheckins]) => clientCheckins.some(c => c.status === 'pending'))
              .sort((a, b) => getClientName(a[0]).localeCompare(getClientName(b[0])))
              .map(([clientId, clientCheckins]) => {
                const pending = clientCheckins.filter(c => c.status === 'pending');
                const nextCheckin = pending
                  .sort((a, b) => parseISO(a.scheduled_send_date).getTime() - parseISO(b.scheduled_send_date).getTime())[0];
                
                return (
                  <div
                    key={clientId}
                    className="flex items-center justify-between p-3 rounded-lg border bg-background"
                  >
                    <div>
                      <p className="font-medium text-sm">{getClientName(clientId)}</p>
                      {nextCheckin && (
                        <p className="text-xs text-muted-foreground">
                          Próximo: {format(parseISO(nextCheckin.scheduled_send_date), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline">{pending.length} pendente{pending.length > 1 ? 's' : ''}</Badge>
                  </div>
                );
              })}
          </div>
        </div>

        {checkins.length === 0 && (
          <div className="text-center py-8">
            <ClipboardCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhum check-in agendado</p>
            <p className="text-xs text-muted-foreground mt-1">
              Os check-ins são criados automaticamente ao cadastrar atletas com check-in habilitado
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
