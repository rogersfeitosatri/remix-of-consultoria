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
  Loader2, 
  Search, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Pause,
  Filter,
  CalendarDays,
  X,
  ExternalLink
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useNavigate } from 'react-router-dom';

interface DispatchRecord {
  id: string;
  client_id: string;
  checkin_form_id: string;
  sent_at: string;
  status: string;
  due_at: string | null;
  error_message: string | null;
  schedule_id: string | null;
}

export function CheckinAuditTab() {
  const { user } = useAuth();
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [frequencyFilter, setFrequencyFilter] = useState<string>('all');
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [specificDate, setSpecificDate] = useState<Date | undefined>(undefined);

  // Fetch dispatches
  const { data: dispatches = [], isLoading: dispatchesLoading } = useQuery({
    queryKey: ['checkin-audit-dispatches', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checkin_dispatches')
        .select('id, client_id, checkin_form_id, sent_at, status, due_at, error_message, schedule_id')
        .eq('user_id', user!.id)
        .order('sent_at', { ascending: false });
      if (error) throw error;
      return (data || []) as DispatchRecord[];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  // Fetch responses to know which dispatches were answered
  const { data: responses = [], isLoading: responsesLoading } = useQuery({
    queryKey: ['checkin-audit-responses', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checkin_responses')
        .select('id, client_id, submitted_at, form_id');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  // Fetch feedbacks to know review status
  const { data: feedbacks = [] } = useQuery({
    queryKey: ['checkin-audit-feedbacks', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checkin_feedbacks')
        .select('checkin_response_id, status');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  // Fetch scheduled checkin schedules (athlete_checkin_schedules) for paused info
  const { data: schedules = [] } = useQuery({
    queryKey: ['checkin-audit-schedules', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('athlete_checkin_schedules')
        .select('id, client_id, is_active, frequency_type')
        .eq('user_id', user!.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const isLoading = dispatchesLoading || clientsLoading || responsesLoading;

  // Clients map
  const clientsMap = useMemo(() => {
    return clients.reduce((acc, c) => { acc[c.id] = c; return acc; }, {} as Record<string, typeof clients[0]>);
  }, [clients]);

  // Response lookup: client_id+form_id -> response dates
  const responsesByClient = useMemo(() => {
    const map = new Map<string, Set<string>>();
    responses.forEach(r => {
      const key = r.client_id;
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(r.submitted_at);
    });
    return map;
  }, [responses]);

  // Feedback lookup
  const feedbackMap = useMemo(() => {
    const map = new Map<string, string>();
    feedbacks.forEach(f => map.set(f.checkin_response_id, f.status));
    return map;
  }, [feedbacks]);

  // Schedule paused map
  const pausedClients = useMemo(() => {
    const set = new Set<string>();
    schedules.forEach(s => { if (!s.is_active) set.add(s.client_id); });
    return set;
  }, [schedules]);

  // Build unified audit list
  type AuditItem = {
    id: string;
    client_id: string;
    date: string;
    status: 'sent' | 'responded' | 'pending_response' | 'paused' | 'error';
    sent_at: string;
    error_message: string | null;
    has_response: boolean;
  };

  const auditItems = useMemo((): AuditItem[] => {
    return dispatches.map(d => {
      // Check if there's a response from this client after dispatch
      const clientResponses = responsesByClient.get(d.client_id);
      const hasResponse = clientResponses ? Array.from(clientResponses).some(rDate => {
        return new Date(rDate) >= new Date(d.sent_at);
      }) : false;

      let status: AuditItem['status'] = 'sent';
      if (d.status === 'error' || d.error_message) {
        status = 'error';
      } else if (hasResponse) {
        status = 'responded';
      } else if (pausedClients.has(d.client_id)) {
        status = 'paused';
      } else {
        status = 'pending_response';
      }

      return {
        id: d.id,
        client_id: d.client_id,
        date: d.sent_at,
        status,
        sent_at: d.sent_at,
        error_message: d.error_message,
        has_response: hasResponse,
      };
    });
  }, [dispatches, responsesByClient, pausedClients]);

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
        return item.status === statusFilter;
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
    const total = filteredItems.length;
    const sent = filteredItems.filter(i => i.status === 'pending_response').length;
    const responded = filteredItems.filter(i => i.status === 'responded').length;
    const paused = filteredItems.filter(i => i.status === 'paused').length;
    const errors = filteredItems.filter(i => i.status === 'error').length;
    return { total, sent, responded, paused, errors };
  }, [filteredItems]);

  const getStatusBadge = (status: AuditItem['status']) => {
    switch (status) {
      case 'responded':
        return (
          <Badge className="bg-green-500/20 text-green-700 border-green-500/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            Respondido
          </Badge>
        );
      case 'pending_response':
        return (
          <Badge variant="outline" className="text-amber-600 border-amber-500/30">
            <Clock className="h-3 w-3 mr-1" />
            Aguardando
          </Badge>
        );
      case 'sent':
        return (
          <Badge className="bg-blue-500/20 text-blue-700 border-blue-500/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            Enviado
          </Badge>
        );
      case 'paused':
        return (
          <Badge variant="secondary" className="text-muted-foreground">
            <Pause className="h-3 w-3 mr-1" />
            Pausado
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Erro
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
            Histórico de check-ins enviados e seus status de resposta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="bg-amber-500/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-amber-600">{stats.sent}</div>
              <div className="text-xs text-muted-foreground">Aguardando Resposta</div>
            </div>
            <div className="bg-green-500/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.responded}</div>
              <div className="text-xs text-muted-foreground">Respondidos</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-muted-foreground">{stats.paused}</div>
              <div className="text-xs text-muted-foreground">Pausados</div>
            </div>
            <div className="bg-red-500/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-600">{stats.errors}</div>
              <div className="text-xs text-muted-foreground">Erros</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3 flex-wrap">
            {/* Month Navigation */}
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => { setSpecificDate(undefined); setCurrentMonth(prev => subMonths(prev, 1)); }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium min-w-[120px] text-center">
                {specificDate 
                  ? format(specificDate, 'dd/MM/yyyy', { locale: ptBR })
                  : format(currentMonth, 'MMMM yyyy', { locale: ptBR })
                }
              </div>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => { setSpecificDate(undefined); setCurrentMonth(prev => addMonths(prev, 1)); }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Specific Date Picker */}
            <div className="flex items-center gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={specificDate ? "default" : "outline"} size="sm" className="gap-2">
                    <CalendarDays className="h-4 w-4" />
                    {specificDate ? format(specificDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Data específica'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={specificDate}
                    onSelect={(date) => {
                      setSpecificDate(date);
                      if (date) setCurrentMonth(startOfMonth(date));
                    }}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {specificDate && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSpecificDate(undefined)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending_response">Aguardando Resposta</SelectItem>
                <SelectItem value="responded">Respondidos</SelectItem>
                <SelectItem value="paused">Pausados</SelectItem>
                <SelectItem value="error">Erros</SelectItem>
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
          <ScrollArea className="h-[500px] rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Atleta</TableHead>
                  <TableHead>Periodicidade</TableHead>
                  <TableHead>Enviado em</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Erro</TableHead>
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
                        <TableCell className="text-sm text-muted-foreground">
                          {format(parseISO(item.sent_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(item.status)}
                        </TableCell>
                        <TableCell className="text-sm text-destructive max-w-[200px] truncate">
                          {item.error_message || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {client && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigate(`/clients/${client.id}`)}
                              className="h-8 w-8 p-0"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
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
