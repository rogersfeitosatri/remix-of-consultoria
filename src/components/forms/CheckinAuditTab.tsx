import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useClients } from '@/hooks/useClients';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, addMonths, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Loader2, Search, CheckCircle, Clock, AlertCircle,
  ChevronLeft, ChevronRight, Filter, CalendarDays, X, ExternalLink, MessageSquare, Send
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useNavigate } from 'react-router-dom';

type AuditItem = {
  id: string;
  client_id: string;
  date: string; // submitted_at or sent created_at
  form_title: string;
  type: 'response' | 'unanswered';
  feedback_status: 'pending' | 'sent' | 'reviewed' | 'no_feedback' | 'unanswered';
  response_id?: string;
};

export function CheckinAuditTab() {
  const { user } = useAuth();
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [frequencyFilter, setFrequencyFilter] = useState<string>('all');
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [specificDate, setSpecificDate] = useState<Date | undefined>(undefined);

  // Fetch checkin responses (the actual submitted check-ins)
  const { data: responses = [], isLoading: responsesLoading } = useQuery({
    queryKey: ['checkin-audit-responses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checkin_responses')
        .select('id, client_id, form_id, submitted_at, checkin_forms(title)')
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  // Fetch feedbacks to determine review status
  const { data: feedbacks = [], isLoading: feedbacksLoading } = useQuery({
    queryKey: ['checkin-audit-feedbacks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checkin_feedbacks')
        .select('checkin_response_id, status, sent_at, final_feedback');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  // Fetch whatsapp_message_logs for checkin_reminder sends
  const { data: checkinSends = [], isLoading: sendsLoading } = useQuery({
    queryKey: ['checkin-audit-sends', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_message_logs')
        .select('id, client_id, created_at, status')
        .eq('user_id', user!.id)
        .eq('template_key', 'checkin_reminder')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const isLoading = responsesLoading || clientsLoading || feedbacksLoading || sendsLoading;

  // Clients map
  const clientsMap = useMemo(() => {
    return clients.reduce((acc, c) => { acc[c.id] = c; return acc; }, {} as Record<string, typeof clients[0]>);
  }, [clients]);

  // Feedback map: response_id -> feedback
  const feedbackMap = useMemo(() => {
    const map = new Map<string, { status: string; sent_at: string | null }>();
    feedbacks.forEach(f => map.set(f.checkin_response_id, { status: f.status, sent_at: f.sent_at }));
    return map;
  }, [feedbacks]);

  // Build a set of (client_id + date_key) for responses to detect unanswered sends
  const responseKeys = useMemo(() => {
    const keys = new Set<string>();
    responses.forEach(r => {
      // Use date only (YYYY-MM-DD) to match send date window (response within 7 days of send)
      keys.add(r.client_id);
    });
    return keys;
  }, [responses]);

  // For each send, check if the client responded within 7 days after the send
  const respondedSendIds = useMemo(() => {
    const set = new Set<string>();
    checkinSends.forEach(send => {
      const sendDate = new Date(send.created_at);
      const found = responses.some(r => {
        if (r.client_id !== send.client_id) return false;
        const respDate = new Date(r.submitted_at);
        const diffMs = respDate.getTime() - sendDate.getTime();
        return diffMs >= 0 && diffMs <= 7 * 24 * 60 * 60 * 1000;
      });
      if (found) set.add(send.id);
    });
    return set;
  }, [checkinSends, responses]);

  // Build audit items: responses + unanswered sends
  const auditItems = useMemo((): AuditItem[] => {
    const items: AuditItem[] = [];

    // Add responses
    responses.forEach(r => {
      const fb = feedbackMap.get(r.id);
      let feedback_status: AuditItem['feedback_status'] = 'no_feedback';
      if (fb) {
        if (fb.status === 'sent' && fb.sent_at) feedback_status = 'sent';
        else if (fb.status === 'sent') feedback_status = 'reviewed';
        else feedback_status = 'pending';
      }
      items.push({
        id: r.id,
        client_id: r.client_id,
        date: r.submitted_at,
        form_title: (r as any).checkin_forms?.title || 'Check-in',
        type: 'response',
        feedback_status,
        response_id: r.id,
      });
    });

    // Add unanswered sends
    checkinSends.forEach(send => {
      if (!respondedSendIds.has(send.id)) {
        items.push({
          id: `send-${send.id}`,
          client_id: send.client_id,
          date: send.created_at,
          form_title: 'Check-in',
          type: 'unanswered',
          feedback_status: 'unanswered',
        });
      }
    });

    return items;
  }, [responses, feedbackMap, checkinSends, respondedSendIds]);

  // Filter
  const filteredItems = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    return auditItems
      .filter(item => {
        const itemDate = parseISO(item.date);
        if (specificDate) return isSameDay(itemDate, specificDate);
        return itemDate >= monthStart && itemDate <= monthEnd;
      })
      .filter(item => {
        if (statusFilter === 'all') return true;
        if (statusFilter === 'unanswered') return item.feedback_status === 'unanswered';
        return item.feedback_status === statusFilter;
      })
      .filter(item => {
        if (frequencyFilter === 'all') return true;
        const client = clientsMap[item.client_id];
        return client?.checkin_frequency === frequencyFilter;
      })
      .filter(item => {
        if (!searchQuery) return true;
        const client = clientsMap[item.client_id];
        return client?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [auditItems, currentMonth, specificDate, statusFilter, frequencyFilter, searchQuery, clientsMap]);

  // Stats
  const stats = useMemo(() => {
    const total = filteredItems.filter(i => i.type === 'response').length;
    const pendingReview = filteredItems.filter(i => i.feedback_status === 'pending' || i.feedback_status === 'no_feedback').length;
    const feedbackSent = filteredItems.filter(i => i.feedback_status === 'sent').length;
    const unanswered = filteredItems.filter(i => i.feedback_status === 'unanswered').length;
    return { total, pendingReview, feedbackSent, unanswered };
  }, [filteredItems]);

  const getStatusBadge = (status: AuditItem['feedback_status']) => {
    switch (status) {
      case 'sent':
        return (
          <Badge className="bg-green-500/20 text-green-700 border-green-500/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            Feedback Enviado
          </Badge>
        );
      case 'reviewed':
        return (
          <Badge className="bg-blue-500/20 text-blue-700 border-blue-500/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            Conferido
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="outline" className="text-amber-600 border-amber-500/30">
            <Clock className="h-3 w-3 mr-1" />
            Pendente Revisão
          </Badge>
        );
      case 'no_feedback':
        return (
          <Badge variant="outline" className="text-muted-foreground">
            <MessageSquare className="h-3 w-3 mr-1" />
            Sem Feedback
          </Badge>
        );
      case 'unanswered':
        return (
          <Badge className="bg-red-500/20 text-red-700 border-red-500/30">
            <Send className="h-3 w-3 mr-1" />
            Enviado sem Resposta
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
            Histórico de check-ins enviados, respondidos e status de feedback
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Respondidos</div>
            </div>
            <div className="bg-amber-500/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-amber-600">{stats.pendingReview}</div>
              <div className="text-xs text-muted-foreground">Pendente Revisão</div>
            </div>
            <div className="bg-green-500/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.feedbackSent}</div>
              <div className="text-xs text-muted-foreground">Feedback Enviado</div>
            </div>
            <div className="bg-red-500/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-600">{stats.unanswered}</div>
              <div className="text-xs text-muted-foreground">Sem Resposta</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => { setSpecificDate(undefined); setCurrentMonth(prev => subMonths(prev, 1)); }}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium min-w-[120px] text-center">
                {specificDate ? format(specificDate, 'dd/MM/yyyy', { locale: ptBR }) : format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </div>
              <Button variant="outline" size="icon" onClick={() => { setSpecificDate(undefined); setCurrentMonth(prev => addMonths(prev, 1)); }}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={specificDate ? "default" : "outline"} size="sm" className="gap-2">
                    <CalendarDays className="h-4 w-4" />
                    {specificDate ? format(specificDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Data específica'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={specificDate} onSelect={(date) => { setSpecificDate(date); if (date) setCurrentMonth(startOfMonth(date)); }} locale={ptBR} initialFocus />
                </PopoverContent>
              </Popover>
              {specificDate && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSpecificDate(undefined)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="unanswered">Enviado sem Resposta</SelectItem>
                <SelectItem value="no_feedback">Sem Feedback</SelectItem>
                <SelectItem value="pending">Pendente Revisão</SelectItem>
                <SelectItem value="sent">Feedback Enviado</SelectItem>
                <SelectItem value="reviewed">Conferidos</SelectItem>
              </SelectContent>
            </Select>

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

            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar atleta..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
          </div>

          {/* Table */}
          <ScrollArea className="h-[500px] rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Atleta</TableHead>
                  <TableHead>Periodicidade</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Formulário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum check-in encontrado para este período.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => {
                    const client = clientsMap[item.client_id];
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{client?.name || 'Não encontrado'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {client?.checkin_frequency === 'weekly' ? 'Semanal' : client?.checkin_frequency === 'biweekly' ? 'Quinzenal' : client?.checkin_frequency === 'monthly' ? 'Mensal' : '-'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(parseISO(item.date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-sm">{item.form_title}</TableCell>
                        <TableCell>{getStatusBadge(item.feedback_status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {item.response_id ? (
                              <Button size="sm" variant="ghost" onClick={() => navigate(`/checkin-review/${item.response_id}`)} className="h-8 w-8 p-0" title="Revisar">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
