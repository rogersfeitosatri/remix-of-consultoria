import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ClipboardCheck, ChevronRight, CheckCircle, AlertCircle, Target, Clock, Search, CalendarIcon } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { parseISO, format, differenceInHours, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { CHECKIN_LABELS, type CheckinFrequency } from '@/types/client';
import { classifyPlan, type PlanTypology } from '@/lib/planTypology';
import { cn } from '@/lib/utils';

interface PendingCheckinResponse {
  id: string;
  client_id: string;
  submitted_at: string;
  form_id: string;
  clients: {
    id: string;
    name: string;
    checkin_frequency: string | null;
    has_checkin: boolean;
    has_consultations: boolean | null;
    consultation_count: number | null;
    consultation_frequency: string | null;
    plan_type: string | null;
    service_type: string | null;
  };
  checkin_forms: {
    title: string;
  };
  hasFeedback: boolean;
  feedbackStatus: string | null;
  targetRace: string | null;
  planTypology: PlanTypology;
}

const FREQUENCY_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quinzenal' },
  { value: 'three_weeks', label: 'A cada 3 semanas' },
  { value: 'monthly', label: 'Mensal (4 semanas)' },
  { value: 'bimonthly', label: 'Bimestral' },
  { value: 'quarterly', label: 'Trimestral' },
];

function getWaitingLabel(submittedAt: string): { text: string; urgent: boolean } {
  const now = new Date();
  const submitted = parseISO(submittedAt);
  const hours = differenceInHours(now, submitted);
  const days = differenceInDays(now, submitted);

  if (hours < 24) return { text: `${hours}h`, urgent: false };
  if (days <= 2) return { text: `${days}d`, urgent: false };
  if (days <= 5) return { text: `${days}d`, urgent: true };
  return { text: `${days}d`, urgent: true };
}

export function PendingReviewsList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [frequencyFilter, setFrequencyFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState(searchParams.get('checkinFrom') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('checkinTo') || '');

  const { data: pendingResponses = [], isLoading } = useQuery({
    queryKey: ['pending_checkin_reviews', user?.id],
    queryFn: async () => {
      const { data: responses, error } = await supabase
        .from('checkin_responses')
        .select(`
          id,
          client_id,
          submitted_at,
          form_id,
          clients (id, name, checkin_frequency, has_checkin, has_consultations, consultation_count, consultation_frequency, plan_type, service_type),
          checkin_forms (title)
        `)
        .order('submitted_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const responseIds = responses?.map(r => r.id) || [];
      if (responseIds.length === 0) return [];

      // Batch fetch feedbacks + target races
      const [feedbacksResult, profilesResult] = await Promise.all([
        supabase.from('checkin_feedbacks').select('checkin_response_id, status').in('checkin_response_id', responseIds),
        supabase.from('athlete_profiles').select('client_id, target_race')
          .in('client_id', [...new Set(responses?.map(r => r.client_id) || [])])
          .not('target_race', 'is', null),
      ]);

      const feedbackMap = new Map(feedbacksResult.data?.map(f => [f.checkin_response_id, f.status]) || []);
      const targetRaceMap = new Map(profilesResult.data?.map(p => [p.client_id, p.target_race]) || []);

      return responses
        ?.filter(r => {
          const status = feedbackMap.get(r.id);
          return !status || status !== 'sent';
        })
        .map(r => ({
          ...r,
          hasFeedback: feedbackMap.has(r.id),
          feedbackStatus: feedbackMap.get(r.id) || null,
          targetRace: targetRaceMap.get(r.client_id) || null,
          planTypology: classifyPlan(r.clients || {}),
        })) as PendingCheckinResponse[];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const markAsReviewed = useMutation({
    mutationFn: async (responseId: string) => {
      const { data: existing } = await supabase
        .from('checkin_feedbacks')
        .select('id')
        .eq('checkin_response_id', responseId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('checkin_feedbacks')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { data: response } = await supabase
          .from('checkin_responses')
          .select('client_id')
          .eq('id', responseId)
          .single();
        
        if (!response) throw new Error('Response not found');

        const { error } = await supabase
          .from('checkin_feedbacks')
          .insert({
            checkin_response_id: responseId,
            client_id: response.client_id,
            status: 'sent',
            sent_at: new Date().toISOString(),
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending_checkin_reviews'] });
      queryClient.invalidateQueries({ queryKey: ['pending_checkins_dashboard'] });
      toast.success('Marcado como revisado!');
    },
    onError: () => {
      toast.error('Erro ao marcar como revisado');
    },
  });

  const filteredResponses = useMemo(() => {
    return pendingResponses.filter(r => {
      if (frequencyFilter !== 'all' && r.clients?.checkin_frequency !== frequencyFilter) return false;
      if (searchQuery && !(r.clients?.name || '').toLowerCase().includes(searchQuery.toLowerCase())) return false;
      const submittedDate = format(parseISO(r.submitted_at), 'yyyy-MM-dd');
      if (dateFrom && submittedDate < dateFrom) return false;
      if (dateTo && submittedDate > dateTo) return false;
      return true;
    });
  }, [pendingResponses, frequencyFilter, searchQuery, dateFrom, dateTo]);

  // Split into urgency groups
  const { urgent, recent } = useMemo(() => {
    const urgentItems: PendingCheckinResponse[] = [];
    const recentItems: PendingCheckinResponse[] = [];

    filteredResponses.forEach(r => {
      const days = differenceInDays(new Date(), parseISO(r.submitted_at));
      if (days >= 3) urgentItems.push(r);
      else recentItems.push(r);
    });

    return { urgent: urgentItems, recent: recentItems };
  }, [filteredResponses]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-5 w-5" />
            Check-ins Pendentes de Revisão
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-12 bg-muted rounded" />
            <div className="h-12 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderResponseItem = (response: PendingCheckinResponse) => {
    const freq = response.clients?.checkin_frequency as CheckinFrequency | undefined;
    const waiting = getWaitingLabel(response.submitted_at);

    return (
      <div
        key={response.id}
        className="flex items-center gap-2 p-2.5 sm:p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer active:scale-[0.99]"
        onClick={() => navigate(`/checkin-review/${response.id}`)}
      >
        {/* Icon */}
        <div className={`h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
          waiting.urgent ? 'bg-destructive/10' : 'bg-orange-500/10'
        }`}>
          {waiting.urgent ? (
            <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" />
          ) : (
            <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-medium text-xs sm:text-sm truncate max-w-[140px] sm:max-w-none">{response.clients?.name}</p>
            <Badge 
              variant="outline" 
              className={`text-[9px] sm:text-[10px] px-1 py-0 h-4 sm:h-5 ${
                waiting.urgent 
                  ? 'bg-destructive/10 text-destructive border-destructive/20' 
                  : 'bg-orange-500/10 text-orange-600 border-orange-500/20'
              }`}
            >
              <Clock className="h-2 w-2 mr-0.5" />
              {waiting.text}
            </Badge>
            <Badge 
              variant="outline" 
              className={`text-[9px] sm:text-[10px] px-1 py-0 h-4 sm:h-5 ${
                response.feedbackStatus === 'approved' 
                  ? "bg-blue-500/10 text-blue-500 border-blue-500/20" 
                  : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
              }`}
            >
              {response.feedbackStatus === 'approved' ? 'Pronto' : 'Pendente'}
            </Badge>
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
            {response.checkin_forms?.title} · {format(parseISO(response.submitted_at), "dd/MM HH:mm", { locale: ptBR })}
          </p>
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            {freq && CHECKIN_LABELS[freq] && (
              <Badge variant="outline" className="text-[9px] sm:text-[10px] px-1 py-0 h-4 sm:h-5 bg-primary/5 text-primary border-primary/20">
                {CHECKIN_LABELS[freq]}
              </Badge>
            )}
            {response.planTypology && (
              <Badge
                variant="outline"
                className="text-[9px] sm:text-[10px] px-1 py-0 h-4 sm:h-5 bg-secondary/40 text-secondary-foreground border-secondary"
                title={response.planTypology.description}
              >
                {response.planTypology.emoji} {response.planTypology.shortLabel}
              </Badge>
            )}
            {response.targetRace && (
              <Badge variant="outline" className="text-[9px] sm:text-[10px] px-1 py-0 h-4 sm:h-5 bg-accent text-accent-foreground border-accent gap-0.5">
                <Target className="h-2.5 w-2.5" />
                {response.targetRace}
              </Badge>
            )}
          </div>
          {response.planTypology?.description && (
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 italic line-clamp-1">
              {response.planTypology.description}
            </p>
          )}
        </div>

        {/* Actions - compact on mobile */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 sm:h-8 sm:w-8"
            onClick={(e) => {
              e.stopPropagation();
              markAsReviewed.mutate(response.id);
            }}
            disabled={markAsReviewed.isPending}
            title="Marcar como revisado"
          >
            <CheckCircle className="h-4 w-4 text-green-500" />
          </Button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <ClipboardCheck className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
              Check-ins Pendentes
              {filteredResponses.length > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 h-5">
                  {filteredResponses.length}
                </Badge>
              )}
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Check-ins enviados aguardando análise/feedback
          </CardDescription>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar atleta..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <div className="flex gap-2">
              {/* Date From */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-9 w-[130px] justify-start text-left font-normal text-xs",
                      !dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-1 h-3.5 w-3.5" />
                    {dateFrom ? format(parseISO(dateFrom), "dd/MM/yy") : <span>De</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom ? parseISO(dateFrom) : undefined}
                    onSelect={(date) => {
                      const val = date ? format(date, 'yyyy-MM-dd') : '';
                      setDateFrom(val);
                      const params = new URLSearchParams(searchParams);
                      if (val) params.set('checkinFrom', val);
                      else params.delete('checkinFrom');
                      setSearchParams(params, { replace: true });
                    }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

              {/* Date To */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-9 w-[130px] justify-start text-left font-normal text-xs",
                      !dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-1 h-3.5 w-3.5" />
                    {dateTo ? format(parseISO(dateTo), "dd/MM/yy") : <span>Até</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo ? parseISO(dateTo) : undefined}
                    onSelect={(date) => {
                      const val = date ? format(date, 'yyyy-MM-dd') : '';
                      setDateTo(val);
                      const params = new URLSearchParams(searchParams);
                      if (val) params.set('checkinTo', val);
                      else params.delete('checkinTo');
                      setSearchParams(params, { replace: true });
                    }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <Select value={frequencyFilter} onValueChange={setFrequencyFilter}>
                <SelectTrigger className="w-[110px] h-9 text-xs">
                  <SelectValue placeholder="Freq." />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredResponses.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {frequencyFilter !== 'all' || searchQuery ? 'Nenhum check-in pendente com esses filtros' : '✓ Todos os check-ins foram revisados'}
          </p>
        ) : (
          <div className="space-y-4 max-h-[500px] overflow-y-auto">
            {/* Urgent block: waiting 3+ days */}
            {urgent.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                  <span className="text-xs font-semibold text-destructive uppercase tracking-wide">
                    Urgente · {urgent.length} aguardando há 3+ dias
                  </span>
                </div>
                {urgent.map(renderResponseItem)}
              </div>
            )}

            {/* Recent block */}
            {recent.length > 0 && (
              <div className="space-y-2">
                {urgent.length > 0 && (
                  <div className="flex items-center gap-2 pt-2">
                    <div className="h-2 w-2 rounded-full bg-orange-500" />
                    <span className="text-xs font-semibold text-orange-600 uppercase tracking-wide">
                      Recentes · {recent.length}
                    </span>
                  </div>
                )}
                {recent.map(renderResponseItem)}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
