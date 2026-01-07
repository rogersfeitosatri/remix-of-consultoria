import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClipboardCheck, ChevronRight, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PendingCheckin {
  id: string;
  checkin_response_id: string;
  status: string;
  created_at: string;
  clients: {
    id: string;
    name: string;
  };
  checkin_responses: {
    submitted_at: string;
    checkin_forms: {
      title: string;
    };
  };
}

export function PendingCheckinsAlert() {
  const navigate = useNavigate();

  const { data: pendingCheckins = [], isLoading } = useQuery({
    queryKey: ['pending_checkins_dashboard'],
    queryFn: async () => {
      // First get pending feedbacks
      const { data: feedbacks, error } = await supabase
        .from('checkin_feedbacks')
        .select(`
          id,
          checkin_response_id,
          status,
          created_at,
          clients (id, name),
          checkin_responses (
            submitted_at,
            checkin_forms (title)
          )
        `)
        .in('status', ['pending', 'approved'])
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return (feedbacks || []) as unknown as PendingCheckin[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Count of checkin responses without any feedback
  const { data: responsesWithoutFeedback = 0 } = useQuery({
    queryKey: ['checkin_responses_without_feedback'],
    queryFn: async () => {
      const { data: responses, error } = await supabase
        .from('checkin_responses')
        .select('id')
        .order('submitted_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Get feedbacks for these responses
      const responseIds = responses?.map(r => r.id) || [];
      if (responseIds.length === 0) return 0;

      const { data: feedbacks, error: feedbackError } = await supabase
        .from('checkin_feedbacks')
        .select('checkin_response_id')
        .in('checkin_response_id', responseIds);

      if (feedbackError) throw feedbackError;

      const feedbackResponseIds = new Set(feedbacks?.map(f => f.checkin_response_id) || []);
      return responseIds.filter(id => !feedbackResponseIds.has(id)).length;
    },
    refetchInterval: 30000,
  });

  const totalPending = pendingCheckins.length + responsesWithoutFeedback;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-5 w-5" />
            Check-ins Pendentes
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
    <Card className={totalPending > 0 ? "border-orange-500/30" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-5 w-5 text-orange-500" />
            Check-ins Pendentes
            {totalPending > 0 && (
              <Badge variant="destructive" className="ml-2">
                {totalPending}
              </Badge>
            )}
          </CardTitle>
        </div>
        <CardDescription>
          Check-ins aguardando análise ou envio de feedback
        </CardDescription>
      </CardHeader>
      <CardContent>
        {totalPending === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            ✓ Todos os check-ins foram processados
          </p>
        ) : (
          <div className="space-y-3">
            {responsesWithoutFeedback > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <MessageSquare className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {responsesWithoutFeedback} check-in(s) sem análise
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Aguardando análise de IA
                    </p>
                  </div>
                </div>
              </div>
            )}

            {pendingCheckins.map((checkin) => (
              <div
                key={checkin.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                onClick={() => navigate(`/checkin-review/${checkin.checkin_response_id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <ClipboardCheck className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{checkin.clients?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {checkin.checkin_responses?.checkin_forms?.title} -{' '}
                      {formatDistanceToNow(parseISO(checkin.created_at), { 
                        addSuffix: true, 
                        locale: ptBR 
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="outline" 
                    className={checkin.status === 'approved' 
                      ? "bg-blue-500/10 text-blue-500 border-blue-500/20" 
                      : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                    }
                  >
                    {checkin.status === 'approved' ? 'Pronto p/ envio' : 'Pendente'}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ))}

            {totalPending > 5 && (
              <Button 
                variant="outline" 
                className="w-full" 
                size="sm"
                onClick={() => navigate('/clients')}
              >
                Ver todos os check-ins
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
