import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useClients } from '@/hooks/useClients';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, addMonths, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Loader2, Search, CheckCircle, Clock, AlertCircle,
  ChevronLeft, ChevronRight, Filter, CalendarDays, X, ExternalLink, MessageSquare, Send, TrendingUp, Phone, ChevronDown
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useNavigate } from 'react-router-dom';
import { EvolutionAnalysisTab } from '@/components/checkin/EvolutionAnalysisTab';
import { Separator } from '@/components/ui/separator';

type AuditItem = {
  id: string;
  client_id: string;
  date: string;
  form_title: string;
  type: 'response' | 'unanswered' | 'cancelled';
  feedback_status: 'pending' | 'sent' | 'reviewed' | 'no_feedback' | 'unanswered' | 'cancelled';
  response_id?: string;
  cancel_note?: string;
};

const PAGE_SIZE = 30;

export function CheckinAuditTab() {
  const { user } = useAuth();
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [frequencyFilter, setFrequencyFilter] = useState<string>('all');
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [specificDate, setSpecificDate] = useState<Date | undefined>(undefined);
  const [page, setPage] = useState(0);
  const [evolutionClientId, setEvolutionClientId] = useState<string | null>(null);
  const [evolutionClientName, setEvolutionClientName] = useState('');

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const { data: responses = [], isLoading: responsesLoading } = useQuery({
    queryKey: ['checkin-audit-responses', monthStart.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checkin_responses')
        .select('id, client_id, form_id, submitted_at, checkin_forms(title)')
        .gte('submitted_at', monthStart.toISOString())
        .lte('submitted_at', monthEnd.toISOString())
        .order('submitted_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const responseIds = responses.map(r => r.id);
  const { data: feedbacks = [], isLoading: feedbacksLoading } = useQuery({
    queryKey: ['checkin-audit-feedbacks', responseIds.join(',')],
    queryFn: async () => {
      if (responseIds.length === 0) return [];
      const { data, error } = await supabase
        .from('checkin_feedbacks')
        .select('checkin_response_id, status, sent_at')
        .in('checkin_response_id', responseIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && responseIds.length > 0,
    staleTime: 60_000,
  });

  const { data: checkinSends = [], isLoading: sendsLoading } = useQuery({
    queryKey: ['checkin-audit-sends', user?.id, monthStart.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_message_logs')
        .select('id, client_id, created_at, status')
        .eq('user_id', user!.id)
        .eq('template_key', 'checkin_reminder')
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString())
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const { data: evoResponses = [] } = useQuery({
    queryKey: ['checkin-audit-evo-responses', evolutionClientId],
    queryFn: async () => {
      if (!evolutionClientId) return [];
      const { data, error } = await supabase
        .from('checkin_responses')
        .select('*, checkin_forms (title)')
        .eq('client_id', evolutionClientId)
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!evolutionClientId,
  });

  const evoFormId = evoResponses[0]?.form_id;
  const { data: evoQuestions = [] } = useQuery({
    queryKey: ['checkin-audit-evo-questions', evoFormId],
    queryFn: async () => {
      if (!evoFormId) return [];
      const { data, error } = await supabase
        .from('checkin_questions')
        .select('*')
        .eq('form_id', evoFormId)
        .order('order_index', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!evoFormId,
  });

  const isLoading = responsesLoading || clientsLoading || feedbacksLoading || sendsLoading;

  const clientsMap = useMemo(() => {
    return clients.reduce((acc, c) => { acc[c.id] = c; return acc; }, {} as Record<string, typeof clients[0]>);
  }, [clients]);

  const feedbackMap = useMemo(() => {
    const map = new Map<string, { status: string; sent_at: string | null }>();
    feedbacks.forEach(f => map.set(f.checkin_response_id, { status: f.status, sent_at: f.sent_at }));
    return map;
  }, [feedbacks]);

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

  const auditItems = useMemo((): AuditItem[] => {
    const items: AuditItem[] = [];
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

  const filteredItems = useMemo(() => {
    return auditItems
      .filter(item => {
        if (specificDate) return isSameDay(parseISO(item.date), specificDate);
        return true;
      })
      .filter(item => {
        if (statusFilter === 'all') return true;
        if (statusFilter === 'responded') return item.type === 'response';
        if (statusFilter === 'pending_review') return item.feedback_status === 'pending' || item.feedback_status === 'no_feedback';
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
  }, [auditItems, specificDate, statusFilter, frequencyFilter, searchQuery, clientsMap]);

  const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE);
  const paginatedItems = filteredItems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => { setPage(0); }, [statusFilter, frequencyFilter, searchQuery, specificDate, currentMonth]);

  const baseItemsForStats = useMemo(() => {
    return auditItems
      .filter(item => {
        if (specificDate) return isSameDay(parseISO(item.date), specificDate);
        return true;
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
      });
  }, [auditItems, specificDate, frequencyFilter, searchQuery, clientsMap]);

  const stats = useMemo(() => {
    const total = baseItemsForStats.filter(i => i.type === 'response').length;
    const pendingReview = baseItemsForStats.filter(i => i.feedback_status === 'pending' || i.feedback_status === 'no_feedback').length;
    const feedbackSent = baseItemsForStats.filter(i => i.feedback_status === 'sent').length;
    const unanswered = baseItemsForStats.filter(i => i.feedback_status === 'unanswered').length;
    return { total, pendingReview, feedbackSent, unanswered };
  }, [baseItemsForStats]);

  const getStatusBadge = (status: AuditItem['feedback_status']) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-500/20 text-green-700 border-green-500/30"><CheckCircle className="h-3 w-3 mr-1" />Enviado</Badge>;
      case 'reviewed':
        return <Badge className="bg-blue-500/20 text-blue-700 border-blue-500/30"><CheckCircle className="h-3 w-3 mr-1" />Conferido</Badge>;
      case 'pending':
        return <Badge variant="outline" className="text-amber-600 border-amber-500/30"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case 'no_feedback':
        return <Badge variant="outline" className="text-muted-foreground"><MessageSquare className="h-3 w-3 mr-1" />Sem Feedback</Badge>;
      case 'unanswered':
        return <Badge className="bg-red-500/20 text-red-700 border-red-500/30"><Send className="h-3 w-3 mr-1" />Sem Resposta</Badge>;
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
            Histórico mensal de check-ins enviados, respondidos e feedback
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {([
              { key: 'responded', label: 'Respondidos', value: stats.total, filterValue: 'responded', bg: 'bg-muted/50', text: '', ring: 'ring-foreground/20' },
              { key: 'pending', label: 'Pendente Revisão', value: stats.pendingReview, filterValue: 'pending_review', bg: 'bg-amber-500/10', text: 'text-amber-600', ring: 'ring-amber-500' },
              { key: 'sent', label: 'Feedback Enviado', value: stats.feedbackSent, filterValue: 'sent', bg: 'bg-green-500/10', text: 'text-green-600', ring: 'ring-green-500' },
              { key: 'unanswered', label: 'Sem Resposta', value: stats.unanswered, filterValue: 'unanswered', bg: 'bg-red-500/10', text: 'text-red-600', ring: 'ring-red-500' },
            ] as const).map(stat => {
              const isActive = statusFilter === stat.filterValue;
              return (
                <button
                  key={stat.key}
                  onClick={() => setStatusFilter(isActive ? 'all' : stat.filterValue)}
                  className={`${stat.bg} rounded-lg p-3 text-center cursor-pointer transition-all hover:scale-[1.03] ${isActive ? `ring-2 ${stat.ring} shadow-md` : ''}`}
                >
                  <div className={`text-2xl font-bold ${stat.text}`}>{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </button>
              );
            })}
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
                    {specificDate ? format(specificDate, 'dd/MM', { locale: ptBR }) : 'Data'}
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
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="unanswered">Sem Resposta</SelectItem>
                <SelectItem value="no_feedback">Sem Feedback</SelectItem>
                <SelectItem value="pending">Pendente Revisão</SelectItem>
                <SelectItem value="sent">Feedback Enviado</SelectItem>
                <SelectItem value="reviewed">Conferidos</SelectItem>
              </SelectContent>
            </Select>

            <Select value={frequencyFilter} onValueChange={setFrequencyFilter}>
              <SelectTrigger className="w-[140px]">
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
              <Input placeholder="Buscar atleta..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9" />
            </div>
          </div>

          {/* Table */}
          <ScrollArea className="h-[450px] rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Atleta</TableHead>
                  <TableHead>Freq.</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhum check-in encontrado para este período.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedItems.map((item) => {
                    const client = clientsMap[item.client_id];
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-sm">
                          <button
                            className="text-left hover:text-primary hover:underline transition-colors flex items-center gap-1"
                            onClick={() => {
                              if (client) {
                                setEvolutionClientId(client.id);
                                setEvolutionClientName(client.name);
                              }
                            }}
                          >
                            {client?.name || '—'}
                            <TrendingUp className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {client?.checkin_frequency === 'weekly' ? 'Sem' : client?.checkin_frequency === 'biweekly' ? 'Quin' : client?.checkin_frequency === 'monthly' ? 'Men' : '-'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(parseISO(item.date), 'dd/MM HH:mm', { locale: ptBR })}
                        </TableCell>
                        <TableCell>{getStatusBadge(item.feedback_status)}</TableCell>
                        <TableCell className="text-right">
                          {item.response_id ? (
                            <Button size="sm" variant="ghost" onClick={() => navigate(`/checkin-review/${item.response_id}`)} className="h-7 w-7 p-0" title="Revisar">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                {filteredItems.length} registros · Página {page + 1}/{totalPages}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Athlete Detail Sheet - Mobile Friendly */}
      <Sheet open={!!evolutionClientId} onOpenChange={(open) => { if (!open) { setEvolutionClientId(null); setEvolutionClientName(''); } }}>
        <SheetContent side="bottom" className="h-[95vh] p-0 rounded-t-2xl flex flex-col sm:max-w-full">
          <SheetHeader className="px-4 pt-4 pb-2 shrink-0 border-b border-border">
            <div className="flex items-center gap-2 pr-10">
              <TrendingUp className="h-4 w-4 text-primary shrink-0" />
              <SheetTitle className="text-base font-bold truncate flex-1">
                {evolutionClientName}
              </SheetTitle>
              {(() => {
                const client = evolutionClientId ? clientsMap[evolutionClientId] : null;
                const phone = client?.phone;
                if (!phone) return null;
                const cleanPhone = phone.replace(/\D/g, '');
                return (
                  <Button
                    size="sm"
                    variant="default"
                    className="gap-1.5 shrink-0 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => window.open(`https://wa.me/${cleanPhone}`, '_blank')}
                  >
                    <Phone className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </Button>
                );
              })()}
            </div>
          </SheetHeader>

          <Tabs defaultValue="respostas" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid grid-cols-2 mx-4 mt-3 shrink-0">
              <TabsTrigger value="respostas" className="gap-1.5 text-xs sm:text-sm">
                <MessageSquare className="h-3.5 w-3.5" />
                Respostas
              </TabsTrigger>
              <TabsTrigger value="evolucao" className="gap-1.5 text-xs sm:text-sm">
                <TrendingUp className="h-3.5 w-3.5" />
                Evolução
              </TabsTrigger>
            </TabsList>

            <TabsContent value="respostas" className="flex-1 overflow-y-auto px-4 pb-4 mt-3">
              <CheckinResponsesList responses={evoResponses} questions={evoQuestions} clientName={evolutionClientName} />
            </TabsContent>

            <TabsContent value="evolucao" className="flex-1 overflow-y-auto px-4 pb-4 mt-3">
              {evolutionClientId && (
                <EvolutionAnalysisTab
                  clientId={evolutionClientId}
                  clientName={evolutionClientName}
                  responses={evoResponses}
                  questions={evoQuestions}
                />
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ---------- Collapsible check-in responses list ---------- */
function CheckinResponsesList({
  responses,
  questions,
}: {
  responses: any[];
  questions: any[];
  clientName: string;
}) {
  const [openId, setOpenId] = useState<string | null>(responses[0]?.id ?? null);

  const questionMap = useMemo(() => {
    const m = new Map<string, string>();
    questions.forEach((q: any) => m.set(q.id, q.question_text));
    return m;
  }, [questions]);

  if (responses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <MessageSquare className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">Nenhuma resposta de check-in encontrada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {responses.map((resp: any) => {
        const answers = resp.responses as Record<string, any>;
        const isOpen = openId === resp.id;
        return (
          <Collapsible key={resp.id} open={isOpen} onOpenChange={(o) => setOpenId(o ? resp.id : null)}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between gap-2 p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors text-left">
                <div className="flex items-center gap-2 min-w-0">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate">
                    {format(parseISO(resp.submitted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-[10px]">
                    {(resp as any).checkin_forms?.title || 'Check-in'}
                  </Badge>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-3 py-3 space-y-3 border border-t-0 border-border rounded-b-lg bg-card">
                {Object.entries(answers).map(([questionId, value]: [string, any]) => {
                  const questionText = questionMap.get(questionId) || questionId;
                  const answer = typeof value === 'object' && value !== null
                    ? (value.answer ?? value.comment ?? JSON.stringify(value))
                    : String(value ?? '');
                  const comment = typeof value === 'object' && value?.comment ? value.comment : null;

                  return (
                    <div key={questionId} className="space-y-0.5">
                      <p className="text-xs font-medium text-muted-foreground leading-snug">{questionText}</p>
                      <p className="text-sm text-foreground leading-relaxed">{answer}</p>
                      {comment && answer !== comment && (
                        <p className="text-xs text-muted-foreground italic pl-2 border-l-2 border-border">{comment}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
