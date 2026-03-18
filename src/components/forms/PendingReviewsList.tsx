import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ClipboardCheck, ChevronRight, CheckCircle, AlertCircle, Target, Clock, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { parseISO, format, differenceInHours, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { CHECKIN_LABELS, type CheckinFrequency } from '@/types/client';

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
  };
  checkin_forms: {
    title: string;
  };
  hasFeedback: boolean;
  feedbackStatus: string | null;
  targetRace: string | null;
}

const FREQUENCY_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'daily', label: 'Diário' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quinzenal' },
  { value: 'monthly', label: 'Mensal' },
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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [frequencyFilter, setFrequencyFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

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
          clients (id, name, checkin_frequency, has_checkin),
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
      return true;
    });
  }, [pendingResponses, frequencyFilter, searchQuery]);

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
        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
      >
        <div 
          className="flex items-center gap-3 flex-1 cursor-pointer min-w-0"
          onClick={() => navigate(`/checkin-review/${response.id}`)}
        >
          <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            waiting.urgent ? 'bg-destructive/10' : 'bg-orange-500/10'
          }`}>
            {waiting.urgent ? (
              <AlertCircle className="h-5 w-5 text-destructive" />
            ) : (
              <Clock className="h-5 w-5 text-orange-500" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm truncate">{response.clients?.name}</p>
              <Badge 
                variant="outline" 
                className={`text-[10px] px-1.5 py-0 h-5 ${
                  waiting.urgent 
                    ? 'bg-destructive/10 text-destructive border-destructive/20' 
                    : 'bg-orange-500/10 text-orange-600 border-orange-500/20'
                }`}
              >
                <Clock className="h-2.5 w-2.5 mr-0.5" />
                {waiting.text}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {response.checkin_forms?.title} · {format(parseISO(response.submitted_at), "dd/MM HH:mm", { locale: ptBR })}
            </p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {freq && CHECKIN_LABELS[freq] && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-primary/5 text-primary border-primary/20">
                  {CHECKIN_LABELS[freq]}
                </Badge>
              )}
              {response.targetRace && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-accent text-accent-foreground border-accent gap-0.5">
                  <Target className="h-3 w-3" />
                  {response.targetRace}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge 
            variant="outline" 
            className={response.feedbackStatus === 'approved' 
              ? "bg-blue-500/10 text-blue-500 border-blue-500/20" 
              : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
            }
          >
            {response.feedbackStatus === 'approved' ? 'Pronto' : 'Pendente'}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              markAsReviewed.mutate(response.id);
            }}
            disabled={markAsReviewed.isPending}
            title="Marcar como revisado"
          >
            <CheckCircle className="h-4 w-4 text-green-500" />
          </Button>
          <ChevronRight 
            className="h-4 w-4 text-muted-foreground cursor-pointer" 
            onClick={() => navigate(`/checkin-review/${response.id}`)}
          />
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-5 w-5 text-orange-500" />
              Check-ins Pendentes de Revisão
              {filteredResponses.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {filteredResponses.length}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Check-ins enviados aguardando análise/feedback
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar atleta..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 w-[150px]"
              />
            </div>
            <Select value={frequencyFilter} onValueChange={setFrequencyFilter}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Frequência" />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCY_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
