import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Send, CheckCircle2, XCircle, Clock, AlertCircle, MessageSquare } from 'lucide-react';
import { format, parseISO, differenceInHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  clientId: string;
}

interface DispatchRow {
  id: string;
  sent_at: string;
  due_at: string | null;
  status: string;
  error_message: string | null;
  link_checkin: string | null;
  checkin_form_id: string;
  checkin_forms?: { title: string } | null;
}

interface ResponseRow {
  id: string;
  submitted_at: string;
  form_id: string;
}

type Enriched = DispatchRow & {
  responded_at: string | null;
  response_id: string | null;
  hours_to_respond: number | null;
};

export function CheckinDispatchHistory({ clientId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['checkin-dispatch-history', clientId],
    queryFn: async (): Promise<Enriched[]> => {
      const [dispatchesRes, responsesRes] = await Promise.all([
        supabase
          .from('checkin_dispatches')
          .select('id, sent_at, due_at, status, error_message, link_checkin, checkin_form_id, checkin_forms(title)')
          .eq('client_id', clientId)
          .order('sent_at', { ascending: false }),
        supabase
          .from('checkin_responses')
          .select('id, submitted_at, form_id')
          .eq('client_id', clientId)
          .order('submitted_at', { ascending: false }),
      ]);

      if (dispatchesRes.error) throw dispatchesRes.error;
      if (responsesRes.error) throw responsesRes.error;

      const dispatches = (dispatchesRes.data || []) as unknown as DispatchRow[];
      const responses = (responsesRes.data || []) as ResponseRow[];

      // Match each dispatch to the first response submitted AFTER sent_at within 14 days, same form
      const usedResponseIds = new Set<string>();
      const enriched: Enriched[] = dispatches.map((d) => {
        const sentAt = parseISO(d.sent_at);
        const match = responses
          .filter((r) => !usedResponseIds.has(r.id) && r.form_id === d.checkin_form_id)
          .map((r) => ({ r, t: parseISO(r.submitted_at) }))
          .filter(({ t }) => t >= sentAt && differenceInHours(t, sentAt) <= 14 * 24)
          .sort((a, b) => a.t.getTime() - b.t.getTime())[0];

        if (match) {
          usedResponseIds.add(match.r.id);
          return {
            ...d,
            responded_at: match.r.submitted_at,
            response_id: match.r.id,
            hours_to_respond: differenceInHours(match.t, sentAt),
          };
        }
        return { ...d, responded_at: null, response_id: null, hours_to_respond: null };
      });

      return enriched;
    },
    enabled: !!clientId,
  });

  const renderStatusBadge = (row: Enriched) => {
    if (row.responded_at) {
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20 gap-1"><CheckCircle2 className="h-3 w-3" />Respondido</Badge>;
    }
    switch (row.status) {
      case 'sent':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 gap-1"><Send className="h-3 w-3" />Enviado · Aguardando</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 gap-1"><Clock className="h-3 w-3" />Pendente envio</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20 gap-1"><XCircle className="h-3 w-3" />Falha no envio</Badge>;
      case 'expired':
        return <Badge className="bg-gray-500/10 text-gray-600 border-gray-500/20 gap-1"><AlertCircle className="h-3 w-3" />Expirado</Badge>;
      default:
        return <Badge variant="outline">{row.status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          Histórico de Envios de Check-in
        </CardTitle>
        <CardDescription className="text-xs">
          Registro de todos os links enviados via WhatsApp e o status de resposta do atleta
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : !data || data.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Nenhum envio de check-in registrado para este atleta.
          </div>
        ) : (
          <div className="space-y-2">
            {data.map((row) => (
              <div
                key={row.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      {row.checkin_forms?.title || 'Check-in'}
                    </span>
                    {renderStatusBadge(row)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    <div>
                      <span className="font-medium">Enviado:</span>{' '}
                      {format(parseISO(row.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </div>
                    {row.responded_at && (
                      <div>
                        <span className="font-medium text-green-600">Respondido:</span>{' '}
                        {format(parseISO(row.responded_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        {row.hours_to_respond !== null && (
                          <span className="ml-1 text-muted-foreground">
                            ({row.hours_to_respond < 1 ? '< 1h' : `${row.hours_to_respond}h`} depois)
                          </span>
                        )}
                      </div>
                    )}
                    {row.error_message && (
                      <div className="text-red-600">
                        <span className="font-medium">Erro:</span> {row.error_message}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
