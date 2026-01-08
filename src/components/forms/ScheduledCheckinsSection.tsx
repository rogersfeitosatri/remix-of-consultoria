import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useScheduledCheckins } from '@/hooks/useScheduledCheckins';
import { useClients } from '@/hooks/useClients';
import { format, parseISO, isAfter, isBefore, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, Calendar, ClipboardCheck, ChevronDown, ChevronRight, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ScheduledCheckinsSection() {
  const { data: checkins = [], isLoading: checkinsLoading } = useScheduledCheckins();
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const [openClients, setOpenClients] = useState<Set<string>>(new Set());

  const toggleClient = (clientId: string) => {
    setOpenClients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clientId)) {
        newSet.delete(clientId);
      } else {
        newSet.add(clientId);
      }
      return newSet;
    });
  };

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

  // Get client helper
  const getClient = (clientId: string) => {
    return clients.find(c => c.id === clientId);
  };

  // Filter clients with pending checkins
  const clientsWithPendingCheckins = Object.entries(checkinsByClient)
    .filter(([_, clientCheckins]) => clientCheckins.some(c => c.status === 'pending'))
    .sort((a, b) => {
      const clientA = getClient(a[0]);
      const clientB = getClient(b[0]);
      return (clientA?.name || '').localeCompare(clientB?.name || '');
    });

  // Count stats
  const pendingCheckins = checkins.filter(c => c.status === 'pending');
  const overdueCount = pendingCheckins.filter(c => isBefore(parseISO(c.scheduled_send_date), today)).length;
  const upcomingCount = pendingCheckins.filter(c => {
    const date = parseISO(c.scheduled_send_date);
    return isAfter(date, today) && isBefore(date, next7Days);
  }).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" />
          Check-ins Agendados
        </CardTitle>
        <CardDescription className="flex items-center gap-4 mt-2">
          <span>Visualize os check-ins programados para envio via WhatsApp</span>
          {overdueCount > 0 && (
            <Badge variant="destructive">{overdueCount} atrasado{overdueCount > 1 ? 's' : ''}</Badge>
          )}
          {upcomingCount > 0 && (
            <Badge variant="secondary">{upcomingCount} nos próximos 7 dias</Badge>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {clientsWithPendingCheckins.length === 0 ? (
          <div className="text-center py-8">
            <ClipboardCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhum check-in agendado</p>
            <p className="text-xs text-muted-foreground mt-1">
              Os check-ins são criados automaticamente ao cadastrar atletas com check-in habilitado
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {clientsWithPendingCheckins.map(([clientId, clientCheckins]) => {
              const client = getClient(clientId);
              const pending = clientCheckins.filter(c => c.status === 'pending');
              const overdue = pending.filter(c => isBefore(parseISO(c.scheduled_send_date), today));
              const isOpen = openClients.has(clientId);

              return (
                <Collapsible
                  key={clientId}
                  open={isOpen}
                  onOpenChange={() => toggleClient(clientId)}
                >
                  <CollapsibleTrigger asChild>
                    <div 
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors",
                        overdue.length > 0 ? "border-destructive/30 bg-destructive/5" : "bg-background"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{client?.name || 'Cliente não encontrado'}</p>
                          <p className="text-xs text-muted-foreground">
                            {pending.length} check-in{pending.length > 1 ? 's' : ''} pendente{pending.length > 1 ? 's' : ''}
                            {overdue.length > 0 && (
                              <span className="text-destructive ml-2">
                                ({overdue.length} atrasado{overdue.length > 1 ? 's' : ''})
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {overdue.length > 0 && (
                          <Badge variant="destructive" className="text-xs">Atrasado</Badge>
                        )}
                        <Badge variant="outline">{pending.length}</Badge>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-8 mt-2 space-y-2 pb-2">
                      {pending
                        .sort((a, b) => parseISO(a.scheduled_send_date).getTime() - parseISO(b.scheduled_send_date).getTime())
                        .map((checkin) => {
                          const checkinDate = parseISO(checkin.scheduled_send_date);
                          const isOverdue = isBefore(checkinDate, today);
                          const isUpcoming = isAfter(checkinDate, today) && isBefore(checkinDate, next7Days);

                          return (
                            <div
                              key={checkin.id}
                              className={cn(
                                "flex items-center justify-between p-2 rounded-md border text-sm",
                                isOverdue ? "border-destructive/30 bg-destructive/5" : 
                                isUpcoming ? "border-primary/30 bg-primary/5" : "bg-muted/30"
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                <span>
                                  {format(checkinDate, "EEEE, dd/MM/yyyy", { locale: ptBR })}
                                </span>
                                {checkin.scheduled_send_time && (
                                  <span className="text-muted-foreground">
                                    às {checkin.scheduled_send_time.substring(0, 5)}
                                  </span>
                                )}
                              </div>
                              <Badge 
                                variant={isOverdue ? "destructive" : isUpcoming ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {isOverdue ? "Atrasado" : isUpcoming ? "Em breve" : "Pendente"}
                              </Badge>
                            </div>
                          );
                        })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}