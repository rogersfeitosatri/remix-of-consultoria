import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Calendar, CheckCircle2, Clock, AlertCircle, FileText, User, TrendingUp, CalendarCheck, ClipboardCheck, Send } from 'lucide-react';
import { useClients } from '@/hooks/useClients';
import { useScheduledCheckinsForClient, ScheduledCheckin } from '@/hooks/useScheduledCheckins';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, isBefore, isAfter, startOfDay, addWeeks, getDay, nextMonday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckinEvolutionCharts } from '@/components/checkin/CheckinEvolutionCharts';
import { PremiumClientDetails } from '@/components/admin/PremiumClientDetails';
import { AnamneseResponseSection } from '@/components/admin/AnamneseResponseSection';

interface CheckinResponse {
  id: string;
  form_id: string;
  client_id: string;
  responses: Record<string, any>;
  submitted_at: string;
  checkin_forms?: {
    title: string;
  };
}

export default function AthleteHistory() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  
  const { data: clients = [] } = useClients();
  const client = clients.find(c => c.id === clientId);
  
  const { data: scheduledCheckins = [], isLoading: loadingScheduled } = useScheduledCheckinsForClient(clientId);
  
  // Fetch actual checkin responses for this client
  const { data: checkinResponses = [], isLoading: loadingResponses } = useQuery({
    queryKey: ['checkin_responses', 'client', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      
      const { data, error } = await supabase
        .from('checkin_responses')
        .select(`
          *,
          checkin_forms (title)
        `)
        .eq('client_id', clientId)
        .order('submitted_at', { ascending: false });
      
      if (error) throw error;
      return data as CheckinResponse[];
    },
    enabled: !!clientId,
  });

  // Fetch questions from the first form to use in evolution charts
  const firstFormId = checkinResponses[0]?.form_id;
  const { data: checkinQuestions = [] } = useQuery({
    queryKey: ['checkin_questions', firstFormId],
    queryFn: async () => {
      if (!firstFormId) return [];
      
      const { data, error } = await supabase
        .from('checkin_questions')
        .select('*')
        .eq('form_id', firstFormId)
        .order('order_index', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!firstFormId,
  });

  const isLoading = loadingScheduled || loadingResponses;
  const today = startOfDay(new Date());

  // Categorize scheduled checkins
  const pastScheduled = scheduledCheckins.filter(s => 
    isBefore(parseISO(s.scheduled_send_date), today) && s.status !== 'completed'
  );
  
  const upcomingScheduled = scheduledCheckins.filter(s => 
    !isBefore(parseISO(s.scheduled_send_date), today) && s.status === 'pending'
  );
  
  const completedScheduled = scheduledCheckins.filter(s => 
    s.status === 'completed' || s.status === 'sent'
  );

  if (!client) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Atleta não encontrado</p>
          <Button variant="link" onClick={() => navigate('/clients')}>
            Voltar para lista
          </Button>
        </div>
      </Layout>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Respondido</Badge>;
      case 'sent':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Enviado</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Pendente</Badge>;
      case 'skipped':
        return <Badge className="bg-gray-500/10 text-gray-500 border-gray-500/20">Pulado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/clients')} className="gap-2 w-fit">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>

          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">{client.name}</h1>
                <p className="text-sm text-muted-foreground">{client.email}</p>
              </div>
            </div>
          </div>

          <Badge variant={client.is_active ? 'default' : 'secondary'}>
            {client.is_active ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>

        {/* Premium Client Details - Only shown for clients with agenda access */}
        {(client.has_agenda_access || client.plan_type === 'premium') && (
          <PremiumClientDetails clientId={client.id} clientName={client.name} />
        )}

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Check-ins Respondidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{checkinResponses.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Próximos Agendados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">{upcomingScheduled.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pendentes (Atrasados)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">{pastScheduled.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Anamnese Section */}
        <AnamneseResponseSection clientId={client.id} clientName={client.name} />

        {/* Scheduled Consultation Link Sends */}
        {client.has_consultations && client.consultation_count && client.first_consultation_date && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Send className="h-4 w-4 text-amber-500" />
                Segundas-feiras de Envio de Link (Consultas)
              </CardTitle>
              <CardDescription className="text-xs">
                Datas para envio de link de agendamento - {client.consultation_count} consultas no plano ({client.consultation_frequency === 'six_weeks' ? 'a cada 6 semanas' : client.consultation_frequency === 'monthly' ? 'mensal' : client.consultation_frequency})
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const links: { date: Date; consultNumber: number }[] = [];
                  const firstConsultDate = parseISO(client.first_consultation_date!);
                  const weeksInterval = client.consultation_frequency === 'six_weeks' ? 6 : 4;
                  
                  for (let i = 1; i < (client.consultation_count || 0); i++) {
                    const sendDate = addWeeks(firstConsultDate, weeksInterval * i);
                    // Adjust to next Monday if not already Monday
                    const mondayDate = getDay(sendDate) === 1 ? sendDate : nextMonday(sendDate);
                    links.push({ date: mondayDate, consultNumber: i + 1 });
                  }
                  
                  return links.map((link, idx) => (
                    <Badge 
                      key={idx}
                      variant="outline" 
                      className="bg-amber-500/10 text-amber-600 border-amber-500/30"
                    >
                      {format(link.date, "dd/MM/yyyy")} - Consulta {link.consultNumber}/{client.consultation_count}
                    </Badge>
                  ));
                })()}
              </div>
              {client.consultation_count === 1 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Este atleta possui apenas 1 consulta no plano (primeira consulta).
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="evolution" className="space-y-4">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="evolution" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Evolução
            </TabsTrigger>
            <TabsTrigger value="responses" className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Respondidos ({checkinResponses.length})
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="gap-2">
              <Clock className="h-4 w-4" />
              Próximos ({upcomingScheduled.length})
            </TabsTrigger>
            <TabsTrigger value="past" className="gap-2">
              <AlertCircle className="h-4 w-4" />
              Pendentes ({pastScheduled.length})
            </TabsTrigger>
          </TabsList>

          {/* Evolution Charts Tab */}
          <TabsContent value="evolution" className="space-y-4">
            <CheckinEvolutionCharts 
              responses={checkinResponses} 
              questions={checkinQuestions} 
            />
          </TabsContent>

          {/* Responses Tab */}
          <TabsContent value="responses" className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : checkinResponses.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum check-in respondido</h3>
                  <p className="text-muted-foreground">
                    O atleta ainda não enviou nenhum check-in
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {checkinResponses.map((response) => (
                  <Card 
                    key={response.id}
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => navigate(`/checkin-review/${response.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          </div>
                          <div>
                            <p className="font-medium">{response.checkin_forms?.title || 'Check-in'}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(parseISO(response.submitted_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                            Respondido
                          </Badge>
                          <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Upcoming Tab */}
          <TabsContent value="upcoming" className="space-y-4">
            {upcomingScheduled.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum check-in agendado</h3>
                  <p className="text-muted-foreground">
                    Não há check-ins futuros programados para este atleta
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {upcomingScheduled.map((scheduled) => (
                  <Card key={scheduled.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                            <Clock className="h-5 w-5 text-blue-500" />
                          </div>
                          <div>
                            <p className="font-medium">Check-in Semanal</p>
                            <p className="text-sm text-muted-foreground">
                              {format(parseISO(scheduled.scheduled_send_date), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                              {' às '}
                              {scheduled.scheduled_send_time?.substring(0, 5) || '07:00'}
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(scheduled.status)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Past/Pending Tab */}
          <TabsContent value="past" className="space-y-4">
            {pastScheduled.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Tudo em dia!</h3>
                  <p className="text-muted-foreground">
                    Não há check-ins pendentes ou atrasados
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {pastScheduled.map((scheduled) => (
                  <Card key={scheduled.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                            <AlertCircle className="h-5 w-5 text-yellow-500" />
                          </div>
                          <div>
                            <p className="font-medium">Check-in Pendente</p>
                            <p className="text-sm text-muted-foreground">
                              Era esperado em {format(parseISO(scheduled.scheduled_send_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                        <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                          Não respondido
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
