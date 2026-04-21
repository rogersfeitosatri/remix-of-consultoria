import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useScheduledCheckins, useUpdateScheduledCheckin, ScheduledCheckin } from '@/hooks/useScheduledCheckins';
import { useClients } from '@/hooks/useClients';
import { useCheckinForms } from '@/hooks/useCheckinForms';
import { useWhatsAppTemplates } from '@/hooks/useWhatsAppTemplates';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isAfter, isBefore, addDays, startOfDay, isSameDay, differenceInDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';
import { Loader2, Calendar, ClipboardCheck, User, Check, MessageCircle, Pause, Play, Search, AlertCircle, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

type ViewFilter = 'overdue' | 'today' | 'week' | 'all';

export function ScheduledCheckinsSection() {
  const { user } = useAuth();
  const { data: checkins = [], isLoading: checkinsLoading } = useScheduledCheckins();
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: forms = [] } = useCheckinForms();
  const { data: templates = [] } = useWhatsAppTemplates();
  const updateCheckin = useUpdateScheduledCheckin();
  const { toast } = useToast();
  const [sendingCheckins, setSendingCheckins] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [viewFilter, setViewFilter] = useState<ViewFilter>('overdue');

  const clientsMap = useMemo(() => {
    return clients.reduce((acc, c) => { acc[c.id] = c; return acc; }, {} as Record<string, typeof clients[0]>);
  }, [clients]);

  const getActiveForm = () => forms.find(f => f.is_active);

  const buildCheckinLink = (checkin: ScheduledCheckin, clientId: string): string | null => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://rogersfeitosa.com.br';
    if (checkin.form_id) return `${baseUrl}/form/${checkin.form_id}?client=${clientId}`;
    const activeForm = getActiveForm();
    if (activeForm) return `${baseUrl}/form/${activeForm.id}?client=${clientId}`;
    return null;
  };

  const handleSendCheckin = async (checkinId: string, clientId: string) => {
    const client = clientsMap[clientId];
    const checkin = checkins.find(c => c.id === checkinId);

    if (!client || !checkin) {
      toast({ title: 'Erro', description: 'Dados não encontrados.', variant: 'destructive' });
      return;
    }
    if (!client.phone) {
      toast({ title: 'Erro', description: 'Cliente sem telefone cadastrado.', variant: 'destructive' });
      return;
    }

    const template = templates.find(t => t.template_key === 'checkin_reminder' && t.is_active);
    if (!template) {
      toast({ title: 'Erro', description: 'Template de check-in não encontrado ou inativo.', variant: 'destructive' });
      return;
    }

    const checkinLink = buildCheckinLink(checkin, clientId);
    if (!checkinLink) {
      toast({ title: 'Erro', description: 'Link do check-in não encontrado. Configure um formulário ativo.', variant: 'destructive' });
      return;
    }

    setSendingCheckins(prev => new Set(prev).add(checkinId));
    try {
      const formatPhone = (phone: string): string => {
        let digits = phone.replace(/\D/g, '');
        while (digits.startsWith('0')) digits = digits.substring(1);
        if (!digits.startsWith('55')) digits = `55${digits}`;
        if (digits.length === 13) return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
        if (digits.length === 12) return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
        return `+${digits}`;
      };

      const context: Record<string, string> = {
        nome: client.name?.split(' ')[0] || client.name || '',
        link_checkin: checkinLink,
        checkin_link: checkinLink,
        data: format(new Date(), "dd/MM/yyyy", { locale: ptBR }),
        codigo_acesso: formatPhone(client.phone),
      };

      const { error } = await supabase.functions.invoke('send-whatsapp', {
        body: { clientId, templateKey: 'checkin_reminder', context, scheduledCheckinId: checkinId },
      });
      if (error) throw error;

      await updateCheckin.mutateAsync({ id: checkinId, status: 'sent', sent_at: new Date().toISOString() });
      toast({ title: 'Enviado!', description: `Check-in enviado para ${client.name}.` });
    } catch (error: any) {
      toast({ title: 'Erro ao enviar', description: error.message || 'Falha no envio.', variant: 'destructive' });
    } finally {
      setSendingCheckins(prev => { const s = new Set(prev); s.delete(checkinId); return s; });
    }
  };

  const handleMarkAsSent = async (checkinId: string) => {
    try {
      await updateCheckin.mutateAsync({ id: checkinId, status: 'sent', sent_at: new Date().toISOString() });
      toast({ title: 'Marcado como enviado' });
    } catch {
      toast({ title: 'Erro', variant: 'destructive' });
    }
  };

  const handleTogglePause = async (checkinId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'skipped' ? 'pending' : 'skipped';
    try {
      await updateCheckin.mutateAsync({ id: checkinId, status: newStatus });
      toast({ title: newStatus === 'skipped' ? 'Pausado' : 'Reativado' });
    } catch {
      toast({ title: 'Erro', variant: 'destructive' });
    }
  };

  const handleCancelDispatch = async (checkinId: string, clientName: string) => {
    const stamp = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    const note = `Envio cancelado pelo admin em ${stamp}`;
    try {
      await updateCheckin.mutateAsync({
        id: checkinId,
        status: 'cancelled' as any,
        notes: note,
      } as any);
      toast({
        title: 'Envio cancelado',
        description: `Check-in de ${clientName} marcado como cancelado.`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao cancelar',
        description: error?.message || 'Falha ao cancelar envio.',
        variant: 'destructive',
      });
    }
  };

  const SAO_PAULO_TZ = 'America/Sao_Paulo';
  const nowInSaoPaulo = toZonedTime(new Date(), SAO_PAULO_TZ);
  const todayStart = startOfDay(nowInSaoPaulo);
  const next7Days = addDays(todayStart, 7);

  const pendingCheckins = useMemo(() => {
    return checkins.filter(c => c.status === 'pending' || c.status === 'skipped');
  }, [checkins]);

  const categorized = useMemo(() => {
    const overdue: (ScheduledCheckin & { client_name_resolved: string })[] = [];
    const today: (ScheduledCheckin & { client_name_resolved: string })[] = [];
    const week: (ScheduledCheckin & { client_name_resolved: string })[] = [];
    const future: (ScheduledCheckin & { client_name_resolved: string })[] = [];

    pendingCheckins.forEach(c => {
      const date = parseISO(c.scheduled_send_date);
      const client = clientsMap[c.client_id];
      const name = client?.name || 'Desconhecido';
      if (searchQuery && !name.toLowerCase().includes(searchQuery.toLowerCase())) return;

      const item = { ...c, client_name_resolved: name };

      if (c.status === 'skipped') {
        future.push(item);
        return;
      }

      if (isBefore(date, todayStart)) overdue.push(item);
      else if (isSameDay(date, todayStart)) today.push(item);
      else if (isBefore(date, next7Days)) week.push(item);
      else future.push(item);
    });

    // Sort each by date
    const sortByDate = (a: ScheduledCheckin, b: ScheduledCheckin) =>
      parseISO(a.scheduled_send_date).getTime() - parseISO(b.scheduled_send_date).getTime();
    overdue.sort(sortByDate);
    today.sort(sortByDate);
    week.sort(sortByDate);
    future.sort(sortByDate);

    return { overdue, today, week, future };
  }, [pendingCheckins, clientsMap, searchQuery, todayStart, next7Days]);

  const getFilteredItems = () => {
    switch (viewFilter) {
      case 'overdue': return categorized.overdue;
      case 'today': return categorized.today;
      case 'week': return [...categorized.today, ...categorized.week];
      case 'all': return [...categorized.overdue, ...categorized.today, ...categorized.week, ...categorized.future];
    }
  };

  const displayItems = getFilteredItems();

  const renderCheckinRow = (checkin: ScheduledCheckin & { client_name_resolved: string }) => {
    const checkinDate = parseISO(checkin.scheduled_send_date);
    const isOverdue = checkin.status === 'pending' && isBefore(checkinDate, todayStart);
    const isToday = isSameDay(checkinDate, todayStart);
    const isPaused = checkin.status === 'skipped';
    const isSending = sendingCheckins.has(checkin.id);
    const daysLate = isOverdue ? differenceInDays(todayStart, checkinDate) : 0;

    return (
      <div
        key={checkin.id}
        className={cn(
          "flex items-center justify-between p-3 rounded-lg border text-sm gap-2 transition-colors",
          isPaused ? "border-muted bg-muted/20 opacity-60" :
          isOverdue ? "border-destructive/30 bg-destructive/5" :
          isToday ? "border-primary/30 bg-primary/5" : "bg-muted/30 border-transparent"
        )}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {isOverdue && !isPaused ? (
            <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
          ) : (
            <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{checkin.client_name_resolved}</span>
              {isOverdue && !isPaused && (
                <Badge variant="destructive" className="text-[10px] px-1.5 h-5">
                  {daysLate}d atrasado
                </Badge>
              )}
              {isToday && !isPaused && (
                <Badge className="text-[10px] px-1.5 h-5 bg-primary/20 text-primary border-primary/30">
                  Hoje
                </Badge>
              )}
              {isPaused && (
                <Badge variant="secondary" className="text-[10px] px-1.5 h-5">Pausado</Badge>
              )}
            </div>
            <span className={cn("text-xs text-muted-foreground", isPaused && "line-through")}>
              {format(checkinDate, "EEE, dd/MM", { locale: ptBR })}
              {checkin.scheduled_send_time && ` · ${checkin.scheduled_send_time.substring(0, 5)}`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            size="sm" variant="ghost" className="h-7 px-2 text-xs"
            onClick={() => handleTogglePause(checkin.id, checkin.status)}
            disabled={isSending}
            title={isPaused ? "Reativar" : "Pausar"}
          >
            {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          </Button>
          {!isPaused && (
            <>
              <Button
                size="sm" variant="ghost" className="h-7 px-2 text-xs"
                onClick={() => handleMarkAsSent(checkin.id)}
                disabled={isSending}
                title="Marcar como enviado"
              >
                <Check className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant={isOverdue ? "destructive" : "default"}
                className="h-7 px-2 text-xs gap-1"
                onClick={() => handleSendCheckin(checkin.id, checkin.client_id)}
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
              {isOverdue && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      disabled={isSending}
                      title="Cancelar envio"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancelar envio do check-in?</AlertDialogTitle>
                      <AlertDialogDescription>
                        O check-in agendado para <strong>{checkin.client_name_resolved}</strong> em{' '}
                        <strong>{format(checkinDate, "dd/MM/yyyy", { locale: ptBR })}</strong> será marcado
                        como cancelado e não será mais enviado. O registro ficará visível na aba <strong>Conferência</strong>.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Voltar</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => handleCancelDispatch(checkin.id, checkin.client_name_resolved)}
                      >
                        Sim, cancelar envio
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </>
          )}
        </div>
      </div>
    );
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" />
          Check-ins Agendados
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-3 mt-2">
          <span>Envios programados via WhatsApp</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats pills */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setViewFilter('overdue')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
              viewFilter === 'overdue'
                ? "bg-destructive/10 text-destructive border-destructive/30"
                : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
            )}
          >
            <AlertCircle className="h-3 w-3" />
            Atrasados
            {categorized.overdue.length > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1 h-4 min-w-[16px] justify-center">
                {categorized.overdue.length}
              </Badge>
            )}
          </button>
          <button
            onClick={() => setViewFilter('today')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
              viewFilter === 'today'
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
            )}
          >
            <Calendar className="h-3 w-3" />
            Hoje
            {categorized.today.length > 0 && (
              <Badge className="text-[10px] px-1 h-4 min-w-[16px] justify-center bg-primary/20 text-primary">
                {categorized.today.length}
              </Badge>
            )}
          </button>
          <button
            onClick={() => setViewFilter('week')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
              viewFilter === 'week'
                ? "bg-secondary text-secondary-foreground border-secondary"
                : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
            )}
          >
            Próx. 7 dias
            <Badge variant="secondary" className="text-[10px] px-1 h-4 min-w-[16px] justify-center">
              {categorized.today.length + categorized.week.length}
            </Badge>
          </button>
          <button
            onClick={() => setViewFilter('all')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
              viewFilter === 'all'
                ? "bg-secondary text-secondary-foreground border-secondary"
                : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
            )}
          >
            Todos
            <Badge variant="outline" className="text-[10px] px-1 h-4 min-w-[16px] justify-center">
              {pendingCheckins.length}
            </Badge>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar atleta..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* List */}
        {displayItems.length === 0 ? (
          <div className="text-center py-8">
            <ClipboardCheck className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? 'Nenhum atleta encontrado' : 
               viewFilter === 'overdue' ? '✓ Nenhum check-in atrasado' :
               viewFilter === 'today' ? '✓ Nenhum check-in para hoje' :
               'Nenhum check-in agendado'}
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {displayItems.map(renderCheckinRow)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
