import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  Brain, 
  MessageSquare, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp,
  TrendingDown,
  Minus,
  Send,
  RefreshCw,
  Clock,
  FileText,
  History
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface CheckinResponse {
  id: string;
  form_id: string;
  client_id: string;
  responses: Record<string, any>;
  submitted_at: string;
  checkin_forms?: {
    title: string;
    description: string | null;
  };
  clients?: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  };
}

interface CheckinQuestion {
  id: string;
  question_text: string;
  question_type: string;
  order_index: number;
  has_comment_field: boolean;
  comment_field_label: string | null;
}

interface AIAnalysis {
  id: string;
  weekly_summary: string;
  evolution_trend: string;
  alerts: string[];
  suggested_feedback: string;
  created_at: string;
  updated_at: string;
  model_used: string;
}

interface Feedback {
  id: string;
  suggested_feedback: string | null;
  final_feedback: string | null;
  status: 'pending' | 'approved' | 'sent';
  approved_at: string | null;
  sent_at: string | null;
}

export default function CheckinReview() {
  const { responseId } = useParams<{ responseId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editedFeedback, setEditedFeedback] = useState('');
  const [feedbackInitialized, setFeedbackInitialized] = useState(false);

  // Fetch check-in response
  const { data: checkinResponse, isLoading: loadingResponse } = useQuery({
    queryKey: ['checkin_response', responseId],
    queryFn: async () => {
      if (!responseId) return null;
      const { data, error } = await supabase
        .from('checkin_responses')
        .select(`
          *,
          checkin_forms (title, description),
          clients (id, name, email, phone)
        `)
        .eq('id', responseId)
        .single();
      if (error) throw error;
      return data as CheckinResponse;
    },
    enabled: !!responseId,
  });

  // Fetch questions
  const { data: questions = [] } = useQuery({
    queryKey: ['checkin_questions', checkinResponse?.form_id],
    queryFn: async () => {
      if (!checkinResponse?.form_id) return [];
      const { data, error } = await supabase
        .from('checkin_questions')
        .select('*')
        .eq('form_id', checkinResponse.form_id)
        .order('order_index', { ascending: true });
      if (error) throw error;
      return data as CheckinQuestion[];
    },
    enabled: !!checkinResponse?.form_id,
  });

  // Fetch AI analysis
  const { data: aiAnalysis, isLoading: loadingAnalysis } = useQuery({
    queryKey: ['checkin_ai_analysis', responseId],
    queryFn: async () => {
      if (!responseId) return null;
      const { data, error } = await supabase
        .from('checkin_ai_analyses')
        .select('*')
        .eq('checkin_response_id', responseId)
        .maybeSingle();
      if (error) throw error;
      return data as AIAnalysis | null;
    },
    enabled: !!responseId,
  });

  // Fetch feedback
  const { data: feedback, isLoading: loadingFeedback } = useQuery({
    queryKey: ['checkin_feedback', responseId],
    queryFn: async () => {
      if (!responseId) return null;
      const { data, error } = await supabase
        .from('checkin_feedbacks')
        .select('*')
        .eq('checkin_response_id', responseId)
        .maybeSingle();
      if (error) throw error;
      return data as Feedback | null;
    },
    enabled: !!responseId,
  });

  // Fetch historical responses
  const { data: historicalResponses = [] } = useQuery({
    queryKey: ['checkin_responses', 'history', checkinResponse?.client_id],
    queryFn: async () => {
      if (!checkinResponse?.client_id) return [];
      const { data, error } = await supabase
        .from('checkin_responses')
        .select(`
          *,
          checkin_forms (title)
        `)
        .eq('client_id', checkinResponse.client_id)
        .neq('id', responseId)
        .order('submitted_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!checkinResponse?.client_id,
  });

  // Initialize feedback text
  if (!feedbackInitialized && (feedback?.final_feedback || feedback?.suggested_feedback || aiAnalysis?.suggested_feedback)) {
    setEditedFeedback(feedback?.final_feedback || feedback?.suggested_feedback || aiAnalysis?.suggested_feedback || '');
    setFeedbackInitialized(true);
  }

  // Mutation to analyze check-in
  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('analyze-checkin', {
        body: { checkinResponseId: responseId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkin_ai_analysis', responseId] });
      queryClient.invalidateQueries({ queryKey: ['checkin_feedback', responseId] });
      toast.success('Análise gerada com sucesso!');
    },
    onError: (error) => {
      console.error('Error analyzing:', error);
      toast.error('Erro ao gerar análise');
    },
  });

  // Mutation to approve feedback
  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!feedback?.id) {
        // Create feedback if doesn't exist
        const { error } = await supabase
          .from('checkin_feedbacks')
          .insert({
            checkin_response_id: responseId,
            client_id: checkinResponse?.client_id,
            ai_analysis_id: aiAnalysis?.id,
            suggested_feedback: aiAnalysis?.suggested_feedback,
            final_feedback: editedFeedback,
            status: 'approved',
            approved_at: new Date().toISOString(),
          });
        if (error) throw error;
      } else {
        // Update existing feedback
        const { error } = await supabase
          .from('checkin_feedbacks')
          .update({
            final_feedback: editedFeedback,
            status: 'approved',
            approved_at: new Date().toISOString(),
          })
          .eq('id', feedback.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkin_feedback', responseId] });
      toast.success('Feedback aprovado! Pronto para envio.');
    },
    onError: (error) => {
      console.error('Error approving:', error);
      toast.error('Erro ao aprovar feedback');
    },
  });

  // Mutation to send feedback via WhatsApp
  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!feedback?.id) throw new Error('Feedback not found');
      if (!checkinResponse?.client_id) throw new Error('Client not found');
      
      // Call WhatsApp send function
      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: { 
          clientId: checkinResponse.client_id,
          message: editedFeedback || feedback.final_feedback,
          feedbackId: feedback.id,
        },
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkin_feedback', responseId] });
      queryClient.invalidateQueries({ queryKey: ['pending_checkins_dashboard'] });
      toast.success('Feedback enviado via WhatsApp!');
    },
    onError: (error: any) => {
      console.error('Error sending:', error);
      toast.error('Erro ao enviar WhatsApp: ' + (error.message || 'Verifique a configuração'));
    },
  });

  const isLoading = loadingResponse || loadingAnalysis || loadingFeedback;

  const getTrendIcon = (trend: string) => {
    const lowerTrend = trend?.toLowerCase() || '';
    if (lowerTrend.includes('positiv') || lowerTrend.includes('melhor')) {
      return <TrendingUp className="h-5 w-5 text-green-500" />;
    } else if (lowerTrend.includes('negativ') || lowerTrend.includes('pior')) {
      return <TrendingDown className="h-5 w-5 text-red-500" />;
    }
    return <Minus className="h-5 w-5 text-yellow-500" />;
  };

  const getStatusBadge = (status: string | undefined) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Enviado</Badge>;
      case 'approved':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Aprovado</Badge>;
      default:
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Pendente</Badge>;
    }
  };

  if (!checkinResponse && !isLoading) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Check-in não encontrado</p>
          <Button variant="link" onClick={() => navigate('/clients')}>
            Voltar para clientes
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate(checkinResponse?.client_id ? `/clients/${checkinResponse.client_id}/history` : '/clients')} 
            className="gap-2 w-fit"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>

          <div className="flex-1">
            <h1 className="text-xl font-bold">Revisão de Check-in</h1>
            {checkinResponse && (
              <p className="text-sm text-muted-foreground">
                {checkinResponse.clients?.name} - {format(parseISO(checkinResponse.submitted_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            )}
          </div>

          {getStatusBadge(feedback?.status)}
        </div>

        {/* Main Content */}
        <Tabs defaultValue="responses" className="space-y-4">
          <TabsList>
            <TabsTrigger value="responses" className="gap-2">
              <FileText className="h-4 w-4" />
              Respostas
            </TabsTrigger>
            <TabsTrigger value="analysis" className="gap-2">
              <Brain className="h-4 w-4" />
              Análise IA
            </TabsTrigger>
            <TabsTrigger value="feedback" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Feedback
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* Responses Tab */}
          <TabsContent value="responses" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {checkinResponse?.checkin_forms?.title || 'Check-in'}
                </CardTitle>
                {checkinResponse?.checkin_forms?.description && (
                  <CardDescription>{checkinResponse.checkin_forms.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {questions.map((question, index) => {
                  const response = checkinResponse?.responses?.[question.id];
                  // Handle nested object structure - extract answer from object if needed
                  let answer = response;
                  let comment = null;
                  
                  if (response && typeof response === 'object' && !Array.isArray(response)) {
                    answer = response.answer ?? response;
                    comment = response.comment;
                    // If answer is still an object (edge case), try to stringify it
                    if (typeof answer === 'object' && answer !== null && !Array.isArray(answer)) {
                      answer = answer.answer ?? JSON.stringify(answer);
                    }
                  }

                  const displayAnswer = Array.isArray(answer) 
                    ? answer.join(', ') 
                    : (typeof answer === 'string' || typeof answer === 'number' ? String(answer) : 'Não respondido');

                  return (
                    <div key={question.id} className="border-b border-border/50 pb-4 last:border-0">
                      <p className="font-medium text-sm text-muted-foreground mb-1">
                        {index + 1}. {question.question_text}
                      </p>
                      <p className="text-foreground">
                        {displayAnswer || 'Não respondido'}
                      </p>
                      {comment && (
                        <p className="text-sm text-muted-foreground mt-1 italic">
                          "{comment}"
                        </p>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analysis Tab */}
          <TabsContent value="analysis" className="space-y-4">
            {!aiAnalysis ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Brain className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Análise não gerada</h3>
                  <p className="text-muted-foreground mb-4">
                    Clique abaixo para gerar a análise com IA
                  </p>
                  <Button 
                    onClick={() => analyzeMutation.mutate()}
                    disabled={analyzeMutation.isPending}
                    className="gap-2"
                  >
                    {analyzeMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Analisando...
                      </>
                    ) : (
                      <>
                        <Brain className="h-4 w-4" />
                        Gerar Análise
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex justify-end">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => analyzeMutation.mutate()}
                    disabled={analyzeMutation.isPending}
                    className="gap-2"
                  >
                    {analyzeMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Re-analisando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" />
                        Re-analisar
                      </>
                    )}
                  </Button>
                </div>

                {/* Weekly Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Resumo da Semana</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground whitespace-pre-wrap">{aiAnalysis.weekly_summary}</p>
                  </CardContent>
                </Card>

                {/* Evolution Trend */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      {getTrendIcon(aiAnalysis.evolution_trend)}
                      Tendência de Evolução
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{aiAnalysis.evolution_trend}</p>
                  </CardContent>
                </Card>

                {/* Alerts */}
                {aiAnalysis.alerts && aiAnalysis.alerts.length > 0 && (
                  <Card className="border-yellow-500/30">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base text-yellow-600">
                        <AlertTriangle className="h-5 w-5" />
                        Alertas
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {aiAnalysis.alerts.map((alert, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-yellow-500">•</span>
                            <span className="text-muted-foreground">{alert}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                <p className="text-xs text-muted-foreground text-right">
                  Análise gerada por {aiAnalysis.model_used} em {format(parseISO(aiAnalysis.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </>
            )}
          </TabsContent>

          {/* Feedback Tab */}
          <TabsContent value="feedback" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquare className="h-5 w-5" />
                  Feedback para o Atleta
                </CardTitle>
                <CardDescription>
                  Edite a sugestão da IA e aprove para enviar via WhatsApp
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {aiAnalysis?.suggested_feedback && (
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Sugestão da IA:</p>
                    <p className="text-sm">{aiAnalysis.suggested_feedback}</p>
                  </div>
                )}

                <Separator />

                <div className="space-y-2">
                  <label className="text-sm font-medium">Feedback Final</label>
                  <Textarea
                    value={editedFeedback}
                    onChange={(e) => setEditedFeedback(e.target.value)}
                    placeholder="Escreva ou edite o feedback para o atleta..."
                    rows={6}
                    disabled={feedback?.status === 'sent'}
                  />
                  <p className="text-xs text-muted-foreground">
                    {editedFeedback.length}/500 caracteres
                  </p>
                </div>

                <div className="flex gap-2 justify-end">
                  {feedback?.status !== 'sent' && (
                    <Button
                      variant="outline"
                      onClick={() => approveMutation.mutate()}
                      disabled={approveMutation.isPending || !editedFeedback.trim()}
                      className="gap-2"
                    >
                      {approveMutation.isPending ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Aprovando...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          {feedback?.status === 'approved' ? 'Atualizar Aprovação' : 'Aprovar Feedback'}
                        </>
                      )}
                    </Button>
                  )}

                  {feedback?.status === 'approved' && (
                    <Button
                      onClick={() => sendMutation.mutate()}
                      disabled={sendMutation.isPending}
                      className="gap-2 bg-green-600 hover:bg-green-700"
                    >
                      {sendMutation.isPending ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Enviando WhatsApp...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Enviar WhatsApp
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {feedback?.sent_at && (
                  <p className="text-sm text-green-600 text-center">
                    ✓ Feedback enviado em {format(parseISO(feedback.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            {historicalResponses.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <History className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Sem histórico</h3>
                  <p className="text-muted-foreground">
                    Este é o primeiro check-in do atleta
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {historicalResponses.map((response: any) => (
                  <Card 
                    key={response.id}
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => navigate(`/checkin-review/${response.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                            <Clock className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{response.checkin_forms?.title || 'Check-in'}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(parseISO(response.submitted_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                        <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
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