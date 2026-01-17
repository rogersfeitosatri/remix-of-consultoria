import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useScheduledCheckins, useUpdateScheduledCheckin, ScheduledCheckin } from '@/hooks/useScheduledCheckins';
import { useClients } from '@/hooks/useClients';
import { useCheckinForms } from '@/hooks/useCheckinForms';
import { useWhatsAppTemplates } from '@/hooks/useWhatsAppTemplates';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isAfter, isBefore, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, Calendar, ClipboardCheck, ChevronDown, ChevronRight, User, Check, MessageCircle, Pause, Play, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

export function ScheduledCheckinsSection() {
  const { user } = useAuth();
  const { data: checkins = [], isLoading: checkinsLoading } = useScheduledCheckins();
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: forms = [] } = useCheckinForms();
  const { data: templates = [] } = useWhatsAppTemplates();
  const updateCheckin = useUpdateScheduledCheckin();
  const { toast } = useToast();
  const [openClients, setOpenClients] = useState<Set<string>>(new Set());
  const [sendingCheckins, setSendingCheckins] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

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

  // Build checkin link from scheduled checkin or active form
  const buildCheckinLink = (checkin: ScheduledCheckin, clientId: string): string | null => {
    const baseUrl = 'https://rogersfeitosa.lovable.app';
    
    // Priority 1: Use form_id from the scheduled checkin itself
    if (checkin.form_id) {
      return `${baseUrl}/form/${checkin.form_id}?client=${clientId}`;
    }
    
    // Priority 2: Use active form as fallback
    const activeForm = getActiveForm();
    if (activeForm) {
      return `${baseUrl}/form/${activeForm.id}?client=${clientId}`;
    }
    
    // No valid form found
    return null;
  };

  const handleSendCheckin = async (checkinId: string, clientId: string) => {
    const client = getClient(clientId);
    const checkin = checkins.find(c => c.id === checkinId);

    if (!client) {
      toast({
        title: 'Erro',
        description: 'Cliente não encontrado.',
        variant: 'destructive',
      });
      return;
    }

    if (!checkin) {
      toast({
        title: 'Erro',
        description: 'Agendamento não encontrado.',
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

    // Verify template exists and is active
    const template = templates.find(t => t.template_key === 'checkin_reminder' && t.is_active);
    
    if (!template) {
      toast({
        title: 'Erro',
        description: 'Template de lembrete de check-in não encontrado ou inativo na Central WhatsApp.',
        variant: 'destructive',
      });
      return;
    }

    // Build the checkin link
    const checkinLink = buildCheckinLink(checkin, clientId);
    
    if (!checkinLink) {
      toast({
        title: 'Erro',
        description: 'Link do check-in não encontrado para este agendamento. Configure um formulário de check-in ativo.',
        variant: 'destructive',
      });
      console.error('[ScheduledCheckinsSection] No checkin link available:', {
        scheduled_checkin_id: checkinId,
        form_id: checkin.form_id,
        has_active_form: !!getActiveForm(),
      });
      return;
    }

    setSendingCheckins(prev => new Set(prev).add(checkinId));

    try {
      // Build context for template rendering (done on backend now)
      const context: Record<string, string> = {
        nome: client.name?.split(' ')[0] || client.name || '',
        link_checkin: checkinLink,
        checkin_link: checkinLink, // Both for compatibility
        data: format(new Date(), "dd/MM/yyyy", { locale: ptBR }),
      };

      console.log('[ScheduledCheckinsSection] Sending checkin via template mode:', {
        scheduled_checkin_id: checkinId,
        template_key: 'checkin_reminder',
        checkin_link: checkinLink,
        context_keys: Object.keys(context),
      });

      // Call send-whatsapp in TEMPLATE MODE (templateKey + context)
      // The backend will fetch the active template and render it
      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          clientId: clientId,
          templateKey: 'checkin_reminder',
          context: context,
          scheduledCheckinId: checkinId,
        },
      });

      if (error) throw error;

      console.log('[ScheduledCheckinsSection] Send result:', {
        success: data?.success,
        template_used: data?.templateUsed,
      });

      // Update checkin status to sent
      await updateCheckin.mutateAsync({
        id: checkinId,
        status: 'sent',
        sent_at: new Date().toISOString(),
      });

      toast({
        title: 'Checkin enviado!',
        description: `Mensagem enviada para ${client.name} via WhatsApp usando template ativo.`,
      });
    } catch (error: any) {
      console.error('[ScheduledCheckinsSection] Error sending checkin:', error);
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

  const handleTogglePause = async (checkinId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'skipped' ? 'pending' : 'skipped';
    try {
      await updateCheckin.mutateAsync({
        id: checkinId,
        status: newStatus,
      });

      toast({
        title: newStatus === 'skipped' ? 'Checkin pausado' : 'Checkin reativado',
        description: newStatus === 'skipped' 
          ? 'O envio deste checkin foi pausado.' 
          : 'O checkin foi reativado para envio.',
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

  // Filter clients with pending or skipped checkins
  const clientsWithCheckins = Object.entries(checkinsByClient)
    .filter(([clientId, clientCheckins]) => {
      const client = getClient(clientId);
      const hasRelevantCheckins = clientCheckins.some(c => c.status === 'pending' || c.status === 'skipped');
      const matchesSearch = !searchQuery || 
        (client?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      return hasRelevantCheckins && matchesSearch;
    })
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
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome do atleta..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        {clientsWithCheckins.length === 0 ? (
          <div className="text-center py-8">
            <ClipboardCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              {searchQuery ? 'Nenhum atleta encontrado' : 'Nenhum check-in agendado'}
            </p>
            {!searchQuery && (
              <p className="text-xs text-muted-foreground mt-1">
                Os check-ins são criados automaticamente ao cadastrar atletas com check-in habilitado
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {clientsWithCheckins.map(([clientId, clientCheckins]) => {
              const client = getClient(clientId);
              const pending = clientCheckins.filter(c => c.status === 'pending');
              const skipped = clientCheckins.filter(c => c.status === 'skipped');
              const allRelevant = [...pending, ...skipped].sort(
                (a, b) => parseISO(a.scheduled_send_date).getTime() - parseISO(b.scheduled_send_date).getTime()
              );
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
                            {pending.length} pendente{pending.length !== 1 ? 's' : ''}
                            {skipped.length > 0 && (
                              <span className="text-warning ml-2">
                                ({skipped.length} pausado{skipped.length !== 1 ? 's' : ''})
                              </span>
                            )}
                            {overdue.length > 0 && (
                              <span className="text-destructive ml-2">
                                ({overdue.length} atrasado{overdue.length !== 1 ? 's' : ''})
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {overdue.length > 0 && (
                          <Badge variant="destructive" className="text-xs">Atrasado</Badge>
                        )}
                        {skipped.length > 0 && (
                          <Badge variant="secondary" className="text-xs">Pausado</Badge>
                        )}
                        <Badge variant="outline">{allRelevant.length}</Badge>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-8 mt-2 space-y-2 pb-2">
                      {allRelevant.map((checkin) => {
                        const checkinDate = parseISO(checkin.scheduled_send_date);
                        const isOverdue = checkin.status === 'pending' && isBefore(checkinDate, today);
                        const isUpcoming = checkin.status === 'pending' && isAfter(checkinDate, today) && isBefore(checkinDate, next7Days);
                        const isPaused = checkin.status === 'skipped';
                        const isSending = sendingCheckins.has(checkin.id);

                        return (
                          <div
                            key={checkin.id}
                            className={cn(
                              "flex items-center justify-between p-2 rounded-md border text-sm gap-2",
                              isPaused ? "border-muted bg-muted/20 opacity-60" :
                              isOverdue ? "border-destructive/30 bg-destructive/5" : 
                              isUpcoming ? "border-primary/30 bg-primary/5" : "bg-muted/30"
                            )}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Calendar className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <span className={cn("truncate", isPaused && "line-through")}>
                                {format(checkinDate, "EEE, dd/MM", { locale: ptBR })}
                              </span>
                              {checkin.scheduled_send_time && (
                                <span className="text-muted-foreground text-xs">
                                  {checkin.scheduled_send_time.substring(0, 5)}
                                </span>
                              )}
                              {isPaused && (
                                <Badge variant="secondary" className="text-xs ml-1">Pausado</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTogglePause(checkin.id, checkin.status);
                                }}
                                disabled={isSending}
                                title={isPaused ? "Reativar envio" : "Pausar envio"}
                              >
                                {isPaused ? (
                                  <Play className="h-3 w-3" />
                                ) : (
                                  <Pause className="h-3 w-3" />
                                )}
                              </Button>
                              {!isPaused && (
                                <>
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
                                </>
                              )}
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