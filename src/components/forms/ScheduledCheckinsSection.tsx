import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useScheduledCheckins, useUpdateScheduledCheckin } from '@/hooks/useScheduledCheckins';
import { useClients } from '@/hooks/useClients';
import { useCheckinForms } from '@/hooks/useCheckinForms';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isAfter, isBefore, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, Calendar, ClipboardCheck, ChevronDown, ChevronRight, User, Send, Check, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ScheduledCheckinsSection() {
  const { data: checkins = [], isLoading: checkinsLoading } = useScheduledCheckins();
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: forms = [] } = useCheckinForms();
  const updateCheckin = useUpdateScheduledCheckin();
  const { toast } = useToast();
  const [openClients, setOpenClients] = useState<Set<string>>(new Set());
  const [sendingCheckins, setSendingCheckins] = useState<Set<string>>(new Set());

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

  const getClient = (clientId: string) => {
    return clients.find(c => c.id === clientId);
  };

  const getActiveForm = () => {
    return forms.find(f => f.is_active);
  };

  const handleSendCheckin = async (checkinId: string, clientId: string) => {
    const client = getClient(clientId);
    const activeForm = getActiveForm();

    if (!client) {
      toast({
        title: 'Erro',
        description: 'Cliente não encontrado.',
        variant: 'destructive',
      });
      return;
    }

    if (!client.phone) {
      toast({
        title: 'Erro',
        description: 'O cliente não possui telefone cadastrado.',
        variant: 'destructive',
      });
      return;
    }

    setSendingCheckins(prev => new Set(prev).add(checkinId));

    try {
      // Generate checkin form link
      const baseUrl = window.location.origin;
      const formLink = activeForm 
        ? `${baseUrl}/form/${activeForm.id}?client=${clientId}`
        : `${baseUrl}/form?client=${clientId}`;

      const message = `📋 *Checkin Semanal*

Olá, ${client.name}! 👋

É hora do seu checkin! Por favor, preencha o formulário para que possamos acompanhar seu progresso.

🔗 *Acesse aqui:* ${formLink}

Após preencher, aguarde o feedback da nossa equipe.

💪 Continue firme na jornada!`;

      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          clientId: clientId,
          message: message,
        },
      });

      if (error) throw error;

      // Update checkin status to sent
      await updateCheckin.mutateAsync({
        id: checkinId,
        status: 'sent',
        sent_at: new Date().toISOString(),
      });

      toast({
        title: 'Checkin enviado!',
        description: `Mensagem enviada para ${client.name} via WhatsApp.`,
      });
    } catch (error: any) {
      console.error('Error sending checkin:', error);
      toast({
        title: 'Erro ao enviar',
        description: error.message || 'Não foi possível enviar o checkin.',
        variant: 'destructive',
      });
    } finally {
      setSendingCheckins(prev => {
        const newSet = new Set(prev);
        newSet.delete(checkinId);
        return newSet;
      });
    }
  };

  const handleMarkAsSent = async (checkinId: string) => {
    try {
      await updateCheckin.mutateAsync({
        id: checkinId,
        status: 'sent',
        sent_at: new Date().toISOString(),
      });

      toast({
        title: 'Marcado como enviado',
        description: 'O checkin foi marcado como enviado.',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o status.',
        variant: 'destructive',
      });
    }
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
        <CardDescription className="flex flex-wrap items-center gap-4 mt-2">
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
                          const isSending = sendingCheckins.has(checkin.id);

                          return (
                            <div
                              key={checkin.id}
                              className={cn(
                                "flex items-center justify-between p-2 rounded-md border text-sm gap-2",
                                isOverdue ? "border-destructive/30 bg-destructive/5" : 
                                isUpcoming ? "border-primary/30 bg-primary/5" : "bg-muted/30"
                              )}
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Calendar className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="truncate">
                                  {format(checkinDate, "EEE, dd/MM", { locale: ptBR })}
                                </span>
                                {checkin.scheduled_send_time && (
                                  <span className="text-muted-foreground text-xs">
                                    {checkin.scheduled_send_time.substring(0, 5)}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMarkAsSent(checkin.id);
                                  }}
                                  disabled={isSending}
                                  title="Marcar como enviado"
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant={isOverdue ? "destructive" : "default"}
                                  className="h-7 px-2 text-xs gap-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSendCheckin(checkin.id, checkin.client_id);
                                  }}
                                  disabled={isSending}
                                  title="Enviar via WhatsApp"
                                >
                                  {isSending ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <>
                                      <MessageCircle className="h-3 w-3" />
                                      Enviar
                                    </>
                                  )}
                                </Button>
                              </div>
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