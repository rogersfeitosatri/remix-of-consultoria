import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClipboardCheck, ChevronRight, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow, parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface PendingCheckinResponse {
  id: string;
  client_id: string;
  submitted_at: string;
  form_id: string;
  clients: {
    id: string;
    name: string;
  };
  checkin_forms: {
    title: string;
  };
  hasFeedback: boolean;
  feedbackStatus: string | null;
}

export function PendingReviewsList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch checkin responses that need review (no feedback sent yet)
  const { data: pendingResponses = [], isLoading } = useQuery({
    queryKey: ['pending_checkin_reviews', user?.id],
    queryFn: async () => {
      // Get all checkin responses
      const { data: responses, error } = await supabase
        .from('checkin_responses')
        .select(`
          id,
          client_id,
          submitted_at,
          form_id,
          clients (id, name),
          checkin_forms (title)
        `)
        .order('submitted_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Get feedbacks for these responses
      const responseIds = responses?.map(r => r.id) || [];
      if (responseIds.length === 0) return [];

      const { data: feedbacks, error: feedbackError } = await supabase
        .from('checkin_feedbacks')
        .select('checkin_response_id, status')
        .in('checkin_response_id', responseIds);

      if (feedbackError) throw feedbackError;

      const feedbackMap = new Map(feedbacks?.map(f => [f.checkin_response_id, f.status]) || []);

      // Filter to only show responses without sent feedback
      return responses
        ?.filter(r => {
          const status = feedbackMap.get(r.id);
          return !status || status !== 'sent';
        })
        .map(r => ({
          ...r,
          hasFeedback: feedbackMap.has(r.id),
          feedbackStatus: feedbackMap.get(r.id) || null,
        })) as PendingCheckinResponse[];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const markAsReviewed = useMutation({
    mutationFn: async (responseId: string) => {
      // Check if feedback exists
      const { data: existing } = await supabase
        .from('checkin_feedbacks')
        .select('id')
        .eq('checkin_response_id', responseId)
        .maybeSingle();

      if (existing) {
        // Update to sent
        const { error } = await supabase
          .from('checkin_feedbacks')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        // Get response to get client_id
        const { data: response } = await supabase
          .from('checkin_responses')
          .select('client_id')
          .eq('id', responseId)
          .single();
        
        if (!response) throw new Error('Response not found');

        // Create as sent
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-5 w-5 text-orange-500" />
              Check-ins Pendentes de Revisão
              {pendingResponses.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {pendingResponses.length}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Check-ins enviados aguardando análise/feedback
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {pendingResponses.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            ✓ Todos os check-ins foram revisados
          </p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {pendingResponses.map((response) => (
              <div
                key={response.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div 
                  className="flex items-center gap-3 flex-1 cursor-pointer"
                  onClick={() => navigate(`/checkin-review/${response.id}`)}
                >
                  <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-orange-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{response.clients?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {response.checkin_forms?.title} - {format(parseISO(response.submitted_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
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
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
