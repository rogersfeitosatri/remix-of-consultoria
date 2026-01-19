import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useScheduledCheckins, useUpdateScheduledCheckin, useDeleteScheduledCheckin } from '@/hooks/useScheduledCheckins';
import { useClients } from '@/hooks/useClients';
import { useWhatsAppTemplates } from '@/hooks/useWhatsAppTemplates';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';
import { 
  Loader2, 
  Search, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Send, 
  Trash2, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Pause,
  Filter
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const SAO_PAULO_TZ = 'America/Sao_Paulo';

export function CheckinAuditTab() {
  const { toast } = useToast();
  const { data: checkins = [], isLoading: checkinsLoading, refetch } = useScheduledCheckins();
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: templates = [] } = useWhatsAppTemplates();
  const updateCheckin = useUpdateScheduledCheckin();
  const deleteCheckin = useDeleteScheduledCheckin();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [frequencyFilter, setFrequencyFilter] = useState<string>('all');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = toZonedTime(new Date(), SAO_PAULO_TZ);
    return startOfMonth(now);
  });
  const [sendingCheckins, setSendingCheckins] = useState<Set<string>>(new Set());
  const [deletingCheckins, setDeletingCheckins] = useState<Set<string>>(new Set());

  const isLoading = checkinsLoading || clientsLoading;

  // Create clients map
  const clientsMap = useMemo(() => {
    return clients.reduce((acc, client) => {
      acc[client.id] = client;
      return acc;
    }, {} as Record<string, typeof clients[0]>);
  }, [clients]);

  // Filter checkins by month and search
  const filteredCheckins = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    return checkins
      .filter(checkin => {
        const checkinDate = parseISO(checkin.scheduled_send_date);
        return checkinDate >= monthStart && checkinDate <= monthEnd;
      })
      .filter(checkin => {
        if (statusFilter !== 'all' && checkin.status !== statusFilter) {
          return false;
        }
        return true;
      })
      .filter(checkin => {
        if (frequencyFilter !== 'all') {
          const client = clientsMap[checkin.client_id];
          if (client?.checkin_frequency !== frequencyFilter) {
            return false;
          }
        }
        return true;
      })
      .filter(checkin => {
        if (!searchQuery) return true;
        const client = clientsMap[checkin.client_id];
        const clientName = client?.name?.toLowerCase() || '';
        return clientName.includes(searchQuery.toLowerCase());
      })
      .sort((a, b) => {
        // Sort by date, then by client name
        const dateCompare = parseISO(a.scheduled_send_date).getTime() - parseISO(b.scheduled_send_date).getTime();
        if (dateCompare !== 0) return dateCompare;
        const clientA = clientsMap[a.client_id]?.name || '';
        const clientB = clientsMap[b.client_id]?.name || '';
        return clientA.localeCompare(clientB);
      });
  }, [checkins, currentMonth, searchQuery, statusFilter, frequencyFilter, clientsMap]);

  // Stats for the month
  const stats = useMemo(() => {
    const total = filteredCheckins.length;
    const sent = filteredCheckins.filter(c => c.status === 'sent').length;
    const pending = filteredCheckins.filter(c => c.status === 'pending').length;
    const skipped = filteredCheckins.filter(c => c.status === 'skipped').length;
    const completed = filteredCheckins.filter(c => c.status === 'completed').length;
    return { total, sent, pending, skipped, completed };
  }, [filteredCheckins]);

  const handleSendCheckin = async (checkinId: string, clientId: string) => {
    const client = clientsMap[clientId];
    if (!client?.phone) {
      toast({
        title: 'Erro',
        description: 'Cliente não possui telefone cadastrado.',
        variant: 'destructive',
      });
      return;
    }

    setSendingCheckins(prev => new Set(prev).add(checkinId));

    try {
      // Find the checkin_reminder template
      const template = templates.find(t => t.template_key === 'checkin_reminder');
      if (!template) {
        throw new Error('Template de checkin não encontrado');
      }

      // Build the checkin link
      const checkin = checkins.find(c => c.id === checkinId);
      let checkinLink = '';
      
      if (checkin?.form_id) {
        checkinLink = `${window.location.origin}/form/${checkin.form_id}?client=${clientId}`;
      } else {
        // Find active form as fallback
        const { data: activeForms } = await supabase
          .from('checkin_forms')
          .select('id')
          .eq('is_active', true)
          .limit(1);
        
        if (activeForms && activeForms.length > 0) {
          checkinLink = `${window.location.origin}/form/${activeForms[0].id}?client=${clientId}`;
        } else {
          throw new Error('Nenhum formulário de checkin ativo encontrado');
        }
      }

      // Build context for template
      const contextData = {
        client_name: client.name?.split(' ')[0] || 'Atleta',
        checkin_link: checkinLink,
      };

      // Send via edge function
      const { error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          template_key: 'checkin_reminder',
          to_phone: client.phone,
          context_data: contextData,
          client_id: clientId,
        },
      });

      if (error) throw error;

      // Update checkin status
      await updateCheckin.mutateAsync({
        id: checkinId,
        status: 'sent',
        sent_at: new Date().toISOString(),
      });

      toast({
        title: 'Sucesso',
        description: `Check-in enviado para ${client.name}`,
      });

      refetch();
    } catch (error: any) {
      console.error('Error sending checkin:', error);
      toast({
        title: 'Erro ao enviar',
        description: error.message || 'Não foi possível enviar o check-in.',
        variant: 'destructive',
      });
    } finally {
      setSendingCheckins(prev => {
        const next = new Set(prev);
        next.delete(checkinId);
        return next;
      });
    }
  };

  const handleDeleteCheckin = async (checkinId: string) => {
    setDeletingCheckins(prev => new Set(prev).add(checkinId));

    try {
      await deleteCheckin.mutateAsync(checkinId);
      toast({
        title: 'Sucesso',
        description: 'Agendamento removido.',
      });
      refetch();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível remover.',
        variant: 'destructive',
      });
    } finally {
      setDeletingCheckins(prev => {
        const next = new Set(prev);
        next.delete(checkinId);
        return next;
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
      toast({ title: 'Marcado como enviado' });
      refetch();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar.',
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
        title: newStatus === 'skipped' ? 'Pausado' : 'Reativado' 
      });
      refetch();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar.',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return (
          <Badge className="bg-green-500/20 text-green-700 border-green-500/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            Enviado
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="outline" className="text-amber-600 border-amber-500/30">
            <Clock className="h-3 w-3 mr-1" />
            Pendente
          </Badge>
        );
      case 'skipped':
        return (
          <Badge variant="secondary" className="text-muted-foreground">
            <Pause className="h-3 w-3 mr-1" />
            Pausado
          </Badge>
        );
      case 'completed':
        return (
          <Badge className="bg-blue-500/20 text-blue-700 border-blue-500/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            Respondido
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Conferência de Check-ins
          </CardTitle>
          <CardDescription>
            Visualize e gerencie todos os check-ins agendados e enviados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="bg-green-500/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.sent}</div>
              <div className="text-xs text-muted-foreground">Enviados</div>
            </div>
            <div className="bg-amber-500/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
              <div className="text-xs text-muted-foreground">Pendentes</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-muted-foreground">{stats.skipped}</div>
              <div className="text-xs text-muted-foreground">Pausados</div>
            </div>
            <div className="bg-blue-500/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.completed}</div>
              <div className="text-xs text-muted-foreground">Respondidos</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3">
            {/* Month Navigation */}
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium min-w-[120px] text-center">
                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </div>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="sent">Enviados</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="skipped">Pausados</SelectItem>
                <SelectItem value="completed">Respondidos</SelectItem>
              </SelectContent>
            </Select>

            {/* Frequency Filter */}
            <Select value={frequencyFilter} onValueChange={setFrequencyFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Periodicidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="biweekly">Quinzenal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
              </SelectContent>
            </Select>

            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar atleta..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Table */}
          <TooltipProvider>
            <ScrollArea className="h-[500px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Atleta</TableHead>
                    <TableHead>Periodicidade</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Data Agendada</TableHead>
                    <TableHead>Horário</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Enviado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCheckins.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Nenhum check-in encontrado para este período.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCheckins.map((checkin) => {
                      const client = clientsMap[checkin.client_id];
                      const isSending = sendingCheckins.has(checkin.id);
                      const isDeleting = deletingCheckins.has(checkin.id);

                      return (
                        <TableRow key={checkin.id}>
                          <TableCell className="font-medium">
                            {client?.name || 'Cliente não encontrado'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {client?.checkin_frequency === 'weekly' && 'Semanal'}
                              {client?.checkin_frequency === 'biweekly' && 'Quinzenal'}
                              {client?.checkin_frequency === 'monthly' && 'Mensal'}
                              {!client?.checkin_frequency && '-'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground font-mono">
                            {client?.phone || '-'}
                          </TableCell>
                          <TableCell>
                            {format(parseISO(checkin.scheduled_send_date), 'dd/MM/yyyy', { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            {checkin.scheduled_send_time?.slice(0, 5) || '07:00'}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(checkin.status)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {checkin.sent_at
                              ? format(parseISO(checkin.sent_at), 'dd/MM HH:mm', { locale: ptBR })
                              : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              {/* Send Button - only for pending */}
                              {checkin.status === 'pending' && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleSendCheckin(checkin.id, checkin.client_id)}
                                      disabled={isSending || !client?.phone}
                                      className="h-8 w-8 p-0"
                                    >
                                      {isSending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Send className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Enviar agora</TooltipContent>
                                </Tooltip>
                              )}

                              {/* Mark as Sent - for pending */}
                              {checkin.status === 'pending' && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleMarkAsSent(checkin.id)}
                                      className="h-8 w-8 p-0"
                                    >
                                      <CheckCircle className="h-4 w-4 text-green-500" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Marcar como enviado</TooltipContent>
                                </Tooltip>
                              )}

                              {/* Pause/Resume - for pending or skipped */}
                              {(checkin.status === 'pending' || checkin.status === 'skipped') && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleTogglePause(checkin.id, checkin.status)}
                                      className="h-8 w-8 p-0"
                                    >
                                      {checkin.status === 'skipped' ? (
                                        <Clock className="h-4 w-4 text-amber-500" />
                                      ) : (
                                        <Pause className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {checkin.status === 'skipped' ? 'Reativar' : 'Pausar'}
                                  </TooltipContent>
                                </Tooltip>
                              )}

                              {/* Delete */}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isDeleting}
                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                  >
                                    {isDeleting ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remover agendamento?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta ação irá remover o agendamento de check-in de {client?.name}.
                                      O check-in não será mais enviado automaticamente.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => handleDeleteCheckin(checkin.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Remover
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </TooltipProvider>
        </CardContent>
      </Card>
    </div>
  );
}
