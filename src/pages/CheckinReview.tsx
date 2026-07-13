import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  History,
  Target,
  Calendar,
  Phone

} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { EvolutionAnalysisTab } from '@/components/checkin/EvolutionAnalysisTab';
import { CheckinReviewPdfButton } from '@/components/checkin/CheckinReviewPdfButton';

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
  has_comment_field?: boolean;
  comment_field_label: string | null;
  is_adjustment_trigger?: boolean;
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
  admin_decision?: string | null;
}

export default function CheckinReview() {
  const { responseId } = useParams<{ responseId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editedFeedback, setEditedFeedback] = useState('');
  const [feedbackInitialized, setFeedbackInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState('responses');
  const [showTargetRaceForm, setShowTargetRaceForm] = useState(false);
  const [newTargetRace, setNewTargetRace] = useState('');
  const [newTargetDeadline, setNewTargetDeadline] = useState('');
  const [editingWeightQuestionId, setEditingWeightQuestionId] = useState<string | null>(null);
  const [editedWeightValue, setEditedWeightValue] = useState('');
  const [patternAlertsDismissed, setPatternAlertsDismissed] = useState(false);
  const [adminDecision, setAdminDecision] = useState('');
  const [adminDecisionDetails, setAdminDecisionDetails] = useState('');
  const [adminDecisionInitialized, setAdminDecisionInitialized] = useState(false);

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
        .select(`*, checkin_forms (title)`)
        .eq('client_id', checkinResponse.client_id)
        .neq('id', responseId)
        .order('submitted_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!checkinResponse?.client_id,
  });

  // Fetch ALL responses for evolution charts
  const { data: allResponses = [] } = useQuery({
    queryKey: ['checkin_responses', 'all', checkinResponse?.client_id],
    queryFn: async () => {
      if (!checkinResponse?.client_id) return [];
      const { data, error } = await supabase
        .from('checkin_responses')
        .select(`*, checkin_forms (title)`)
        .eq('client_id', checkinResponse.client_id)
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!checkinResponse?.client_id,
  });

  // Fetch questions for evolution charts
  const evolutionFormId = allResponses[0]?.form_id;
  const { data: evolutionQuestions = [] } = useQuery({
    queryKey: ['checkin_questions_evolution', evolutionFormId],
    queryFn: async () => {
      if (!evolutionFormId) return [];
      const { data, error } = await supabase
        .from('checkin_questions')
        .select('*')
        .eq('form_id', evolutionFormId)
        .order('order_index', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!evolutionFormId,
  });

  // Fetch athlete profile (target race)
  const { data: athleteProfile } = useQuery({
    queryKey: ['athlete-profile-target-race', checkinResponse?.client_id],
    queryFn: async () => {
      if (!checkinResponse?.client_id) return null;
      const { data, error } = await supabase
        .from('athlete_profiles')
        .select('id, target_race, target_deadline')
        .eq('client_id', checkinResponse.client_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!checkinResponse?.client_id,
  });

  const targetRaceDays = athleteProfile?.target_deadline
    ? differenceInDays(parseISO(athleteProfile.target_deadline), new Date())
    : null;

  // Save target race mutation
  const saveTargetRaceMutation = useMutation({
    mutationFn: async () => {
      if (!checkinResponse?.client_id || !newTargetRace) return;
      const { data: existing } = await supabase
        .from('athlete_profiles')
        .select('id')
        .eq('client_id', checkinResponse.client_id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('athlete_profiles')
          .update({ target_race: newTargetRace, target_deadline: newTargetDeadline || null })
          .eq('client_id', checkinResponse.client_id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('athlete_profiles')
          .insert({ client_id: checkinResponse.client_id, target_race: newTargetRace, target_deadline: newTargetDeadline || null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athlete-profile-target-race', checkinResponse?.client_id] });
      queryClient.invalidateQueries({ queryKey: ['target-race-alert', checkinResponse?.client_id] });
      setShowTargetRaceForm(false);
      setNewTargetRace('');
      setNewTargetDeadline('');
      toast.success('Prova alvo salva com sucesso!');
    },
    onError: () => toast.error('Erro ao salvar prova alvo'),
  });

  // Mutation to update weight response
  const updateWeightMutation = useMutation({
    mutationFn: async ({ questionId, newValue }: { questionId: string; newValue: string }) => {
      if (!checkinResponse || !responseId) return;
      const updatedResponses = { ...checkinResponse.responses };
      const existing = updatedResponses[questionId];
      if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
        updatedResponses[questionId] = { ...existing, answer: newValue };
      } else {
        updatedResponses[questionId] = newValue;
      }
      const { error } = await supabase
        .from('checkin_responses')
        .update({ responses: updatedResponses })
        .eq('id', responseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkin_response', responseId] });
      queryClient.invalidateQueries({ queryKey: ['checkin_responses', 'all', checkinResponse?.client_id] });
      setEditingWeightQuestionId(null);
      setEditedWeightValue('');
      toast.success('Peso atualizado com sucesso!');
    },
    onError: () => toast.error('Erro ao atualizar peso'),
  });

  const isWeightQuestion = (text: string) => {
    const lower = text.toLowerCase();
    return lower.includes('peso') || lower.includes('weight') || lower.includes('kg');
  };

  const openWhatsApp = () => {
    const phone = checkinResponse?.clients?.phone;
    if (!phone) {
      toast.error('Telefone do atleta não cadastrado');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    window.open(`https://wa.me/${formattedPhone}`, '_blank');
  };


  if (!feedbackInitialized && (feedback?.final_feedback || feedback?.suggested_feedback || aiAnalysis?.suggested_feedback)) {
    setEditedFeedback(feedback?.final_feedback || feedback?.suggested_feedback || aiAnalysis?.suggested_feedback || '');
    setFeedbackInitialized(true);
  }

  if (!adminDecisionInitialized && feedback?.admin_decision !== undefined) {
    if (feedback.admin_decision) {
      if (feedback.admin_decision.startsWith('Ajuste realizado: ')) {
        setAdminDecision('Ajuste realizado');
        setAdminDecisionDetails(feedback.admin_decision.replace('Ajuste realizado: ', ''));
      } else {
        setAdminDecision(feedback.admin_decision);
      }
    }
    setAdminDecisionInitialized(true);
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

  // Auto-complete the checkin_response task for this athlete
  const autoCompleteCheckinTask = async (clientId: string) => {
    try {
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id')
        .eq('client_id', clientId)
        .eq('task_type', 'checkin_response')
        .in('status', ['pending', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (tasks && tasks.length > 0) {
        await supabase
          .from('tasks')
          .update({ status: 'done', completed_at: new Date().toISOString(), is_archived: true })
          .eq('id', tasks[0].id);
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        queryClient.invalidateQueries({ queryKey: ['my-day-today'] });
      }
    } catch (err) {
      console.error('Error auto-completing task:', err);
    }
  };

  // Mutation to approve feedback (with optional WhatsApp send)
  const approveMutation = useMutation({
    mutationFn: async ({ sendWhatsApp = false }: { sendWhatsApp?: boolean } = {}) => {
      if (!feedback?.id) {
        const { error } = await supabase
          .from('checkin_feedbacks')
          .insert({
            checkin_response_id: responseId,
            client_id: checkinResponse?.client_id,
            ai_analysis_id: aiAnalysis?.id,
            suggested_feedback: aiAnalysis?.suggested_feedback,
            final_feedback: editedFeedback || null,
            status: 'approved',
            approved_at: new Date().toISOString(),
          });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('checkin_feedbacks')
          .update({
            final_feedback: editedFeedback || feedback.final_feedback || null,
            status: 'approved',
            approved_at: new Date().toISOString(),
          })
          .eq('id', feedback.id);
        if (error) throw error;
      }
      return { sendWhatsApp };
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['checkin_feedback', responseId] });
      queryClient.invalidateQueries({ queryKey: ['pending_checkin_reviews'] });
      queryClient.invalidateQueries({ queryKey: ['pending_checkins_dashboard'] });
      if (checkinResponse?.client_id) {
        await autoCompleteCheckinTask(checkinResponse.client_id);
      }
      if (data?.sendWhatsApp) {
        toast.success('Feedback aprovado! Pronto para envio.');
      } else {
        toast.success('Check-in conferido com sucesso!');
      }
      setActiveTab('evolution');
    },
    onError: (error) => {
      console.error('Error approving:', error);
      toast.error('Erro ao aprovar feedback');
    },
  });

  // Mutation to mark as reviewed without sending (just finalize)
  const markAsReviewedMutation = useMutation({
    mutationFn: async () => {
      if (!feedback?.id) {
        // Create feedback with 'sent' status to mark as finalized without actually sending
        const { error } = await supabase
          .from('checkin_feedbacks')
          .insert({
            checkin_response_id: responseId,
            client_id: checkinResponse?.client_id,
            ai_analysis_id: aiAnalysis?.id,
            suggested_feedback: aiAnalysis?.suggested_feedback || null,
            final_feedback: editedFeedback || null,
            status: 'sent',
            approved_at: new Date().toISOString(),
            sent_at: new Date().toISOString(),
            sent_via: 'manual_review',
          });
        if (error) throw error;
      } else {
        // Update existing feedback to 'sent' status
        const { error } = await supabase
          .from('checkin_feedbacks')
          .update({
            final_feedback: editedFeedback || feedback.final_feedback || null,
            status: 'sent',
            approved_at: feedback.approved_at || new Date().toISOString(),
            sent_at: new Date().toISOString(),
            sent_via: 'manual_review',
          })
          .eq('id', feedback.id);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['checkin_feedback', responseId] });
      queryClient.invalidateQueries({ queryKey: ['pending_checkin_reviews'] });
      queryClient.invalidateQueries({ queryKey: ['pending_checkins_dashboard'] });
      if (checkinResponse?.client_id) {
        await autoCompleteCheckinTask(checkinResponse.client_id);
      }
      toast.success('Check-in finalizado sem envio de WhatsApp');
      setActiveTab('evolution');
    },
    onError: (error) => {
      console.error('Error marking as reviewed:', error);
      toast.error('Erro ao finalizar check-in');
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
      setActiveTab('evolution');
    },
    onError: (error: any) => {
      console.error('Error sending:', error);
      toast.error('Erro ao enviar WhatsApp: ' + (error.message || 'Verifique a configuração'));
    },
  });

  const saveAdminDecisionMutation = useMutation({
    mutationFn: async () => {
      if (!responseId) return;
      const decisionValue = adminDecision === 'Ajuste realizado' && adminDecisionDetails
        ? `Ajuste realizado: ${adminDecisionDetails}`
        : adminDecision;
      if (!decisionValue) return;
      if (feedback?.id) {
        const { error } = await supabase
          .from('checkin_feedbacks')
          .update({ admin_decision: decisionValue })
          .eq('id', feedback.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('checkin_feedbacks')
          .insert({
            checkin_response_id: responseId,
            client_id: checkinResponse?.client_id,
            admin_decision: decisionValue,
            status: 'pending',
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkin_feedback', responseId] });
      toast.success('Decisão nutricional salva!');
    },
    onError: () => toast.error('Erro ao salvar decisão'),
  });

  const isLoading = loadingResponse || loadingAnalysis || loadingFeedback;

  const patternAlerts = (() => {
    if (!checkinResponse || !questions.length) return [];
    const alerts: { message: string; severity: 'orange' | 'red' }[] = [];

    const answers = checkinResponse.responses || {};

    // Pattern 4: questions 13 and 15 answered with "Sim"
    const sortedQs = [...questions].sort((a, b) => a.order_index - b.order_index);
    [12, 14].forEach(idx => {
      const q = sortedQs[idx];
      if (q) {
        const resp = answers[q.id];
        const ans = resp && typeof resp === 'object' ? resp.answer : resp;
        if (ans === 'Sim' || ans === 'sim') {
          alerts.push({ message: `Pergunta ${idx + 1} com solicitação de ajuste: "${q.question_text}"`, severity: 'red' });
        }
      }
    });

    // Pattern 5: late response (>48h)
    if (checkinResponse.submitted_at) {
      const prevResponse = historicalResponses[0];
      if (prevResponse?.submitted_at) {
        const hoursDiff = (new Date(checkinResponse.submitted_at).getTime() - new Date(prevResponse.submitted_at).getTime()) / (1000 * 60 * 60);
        if (hoursDiff > 24 * 14) {
          alerts.push({ message: 'Resposta após longo intervalo (>14 dias desde o último check-in)', severity: 'orange' });
        }
      }
    }

    if (allResponses.length >= 2) {
      const sorted = [...allResponses].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
      const current = sorted[0];
      const previous = sorted[1];

      // Pattern 1: weight drop >1kg
      questions.forEach(q => {
        if (isWeightQuestion(q.question_text)) {
          const currResp = current?.responses?.[q.id];
          const prevResp = previous?.responses?.[q.id];
          const currVal = parseFloat(String(currResp?.answer ?? currResp ?? ''));
          const prevVal = parseFloat(String(prevResp?.answer ?? prevResp ?? ''));
          if (!isNaN(currVal) && !isNaN(prevVal) && prevVal - currVal > 1) {
            alerts.push({ message: `Queda de peso >1kg detectada (${prevVal}kg → ${currVal}kg)`, severity: 'orange' });
          }
        }
      });

      // Pattern 2: energy <4 for 2+ consecutive
      questions.forEach(q => {
        if (q.question_type === 'scale' && q.question_text.toLowerCase().includes('energia')) {
          const energyScores = sorted.slice(0, 3).map(r => {
            const resp = r?.responses?.[q.id];
            return parseFloat(String(resp?.answer ?? resp ?? ''));
          }).filter(v => !isNaN(v));
          if (energyScores.length >= 2 && energyScores.slice(0, 2).every(s => s < 4)) {
            alerts.push({ message: 'Energia baixa (<4) em 2+ check-ins consecutivos', severity: 'red' });
          }
        }
      });

      // Pattern 3: sleep <6h for 3+ consecutive
      questions.forEach(q => {
        if (q.question_text.toLowerCase().includes('sono')) {
          const sleepVals = sorted.slice(0, 4).map(r => {
            const resp = r?.responses?.[q.id];
            return parseFloat(String(resp?.answer ?? resp ?? ''));
          }).filter(v => !isNaN(v));
          if (sleepVals.length >= 3 && sleepVals.slice(0, 3).every(v => v < 6)) {
            alerts.push({ message: 'Sono <6h em 3+ check-ins consecutivos', severity: 'red' });
          }
        }
      });
    }

    return alerts;
  })();

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
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/forms?tab=reviews')} 
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

          <div className="flex items-center gap-2">
            {checkinResponse?.client_id && (
              <Button
                size="sm"
                onClick={() => navigate(`/meal-plans/${checkinResponse.client_id}?fromCheckin=1`)}
                className="gap-2"
              >
                <Brain className="h-4 w-4" />
                <span className="hidden sm:inline">Ajustar plano com IA</span>
              </Button>
            )}
            <CheckinReviewPdfButton
              checkinResponse={checkinResponse as any}
              questions={questions as any}
              athleteProfile={athleteProfile as any}
              targetRaceDays={targetRaceDays}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={openWhatsApp}
              className="gap-2 text-green-600 border-green-600/30 hover:bg-green-600/10"
            >
              <Phone className="h-4 w-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </Button>
            {getStatusBadge(feedback?.status)}
          </div>
        </div>

        {/* Target Race Card */}
        {athleteProfile?.target_race ? (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-3 px-4">
              <div className="flex flex-wrap items-center gap-3">
                <Target className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{athleteProfile.target_race}</p>
                  {athleteProfile.target_deadline && (
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(athleteProfile.target_deadline), "dd/MM/yyyy")}
                    </p>
                  )}
                </div>
                {targetRaceDays !== null && (
                  <Badge variant={targetRaceDays <= 30 ? 'destructive' : targetRaceDays <= 60 ? 'default' : 'secondary'} className="text-sm font-bold">
                    {targetRaceDays > 0 ? `${targetRaceDays} dias` : targetRaceDays === 0 ? 'Hoje!' : 'Encerrada'}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed border-muted-foreground/30">
            <CardContent className="py-3 px-4">
              {!showTargetRaceForm ? (
                <div className="flex items-center gap-3">
                  <Target className="h-5 w-5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground flex-1">Sem prova alvo cadastrada</p>
                  <Button variant="outline" size="sm" onClick={() => setShowTargetRaceForm(true)} className="gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Cadastrar
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    <p className="text-sm font-medium">Cadastrar Prova Alvo</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Nome da prova</Label>
                      <Input
                        placeholder="Ex: Maratona de São Paulo"
                        value={newTargetRace}
                        onChange={e => setNewTargetRace(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Data da prova</Label>
                      <Input
                        type="date"
                        value={newTargetDeadline}
                        onChange={e => setNewTargetDeadline(e.target.value)}
                        className="h-9"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setShowTargetRaceForm(false)}>Cancelar</Button>
                    <Button
                      size="sm"
                      onClick={() => saveTargetRaceMutation.mutate()}
                      disabled={!newTargetRace || saveTargetRaceMutation.isPending}
                    >
                      Salvar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pattern Alerts Banner */}
        {patternAlerts.length > 0 && !patternAlertsDismissed && (
          <Card className="border-orange-500/30 bg-orange-50/30 dark:bg-orange-950/10">
            <CardContent className="py-3 px-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1.5">
                  <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">Alertas de padrão detectados</p>
                  <div className="flex flex-wrap gap-2">
                    {patternAlerts.map((alert, i) => (
                      <Badge
                        key={i}
                        className={alert.severity === 'red'
                          ? 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30'
                          : 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30'
                        }
                      >
                        {alert.message}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground shrink-0"
                  onClick={() => setPatternAlertsDismissed(true)}
                >
                  ✕
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} key={responseId} className="space-y-4">
          <TabsList className="flex-wrap h-auto">
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
            <TabsTrigger value="evolution" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Evolução
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* Responses Tab */}
          <TabsContent value="responses" className="space-y-4">
            {/* Questions 13 and 15 highlight */}
            {(() => {
              const sortedForHighlight = [...questions].sort((a, b) => a.order_index - b.order_index);
              const triggerQs = [sortedForHighlight[12], sortedForHighlight[14]].filter(Boolean);
              if (!triggerQs.length) return null;
              return (
              <Card className="border-l-4 border-l-orange-500 border-orange-500/20">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base text-orange-700 dark:text-orange-400">
                    <span>⚠️</span>
                    Perguntas de Ajuste (13 e 15)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {triggerQs
                    .map((question) => {
                      const response = checkinResponse?.responses?.[question.id];
                      let answer = response;
                      if (response && typeof response === 'object' && !Array.isArray(response)) {
                        answer = response.answer ?? response;
                        if (typeof answer === 'object' && answer !== null && !Array.isArray(answer)) {
                          answer = answer.answer ?? JSON.stringify(answer);
                        }
                      }
                      const displayAnswer = Array.isArray(answer)
                        ? answer.join(', ')
                        : (typeof answer === 'string' || typeof answer === 'number' ? String(answer) : 'Não respondido');
                      return (
                        <div key={question.id} className="border-l-4 border-l-orange-500 pl-3 py-1">
                          <p className="font-medium text-sm text-muted-foreground">{question.question_text}</p>
                          <p className="text-foreground font-semibold">{displayAnswer || 'Não respondido'}</p>
                        </div>
                      );
                    })
                  }
                </CardContent>
              </Card>
              );
            })()}

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
                {(() => {
                  const highlightedQuestions: typeof questions = [];
                  const regularQuestions: typeof questions = [];

                  const sortedAll = [...questions].sort((a, b) => a.order_index - b.order_index);
                  const triggerIds = new Set([sortedAll[12]?.id, sortedAll[14]?.id].filter(Boolean));

                  questions.forEach(q => {
                    const isHighlighted = q.order_index === 12 || q.order_index === 14;
                    if (isHighlighted) {
                      highlightedQuestions.push(q);
                    } else {
                      regularQuestions.push(q);
                    }
                  });

                  const renderQuestion = (question: typeof questions[0], index: number, isHighlight: boolean) => {
                    const response = checkinResponse?.responses?.[question.id];
                    let answer = response;
                    let comment = null;
                    if (response && typeof response === 'object' && !Array.isArray(response)) {
                      answer = response.answer ?? response;
                      comment = response.comment;
                      if (typeof answer === 'object' && answer !== null && !Array.isArray(answer)) {
                        answer = answer.answer ?? JSON.stringify(answer);
                      }
                    }
                    const displayAnswer = Array.isArray(answer)
                      ? answer.join(', ')
                      : (typeof answer === 'string' || typeof answer === 'number' ? String(answer) : 'Não respondido');
                    const isWeight = isWeightQuestion(question.question_text);
                    const isEditing = editingWeightQuestionId === question.id;
                    const isAdjTrigger = triggerIds.has(question.id);

                    return (
                      <div
                        key={question.id}
                        className={`border-b border-border/50 pb-4 last:border-0 ${isHighlight ? 'pl-3 border-l-4 ' + (isAdjTrigger ? 'border-l-red-500 bg-red-50/30 dark:bg-red-950/10' : 'border-l-orange-400 bg-orange-50/30 dark:bg-orange-950/10') : ''}`}
                      >
                        <p className="font-medium text-sm text-muted-foreground mb-1 flex items-center gap-1">
                          {isHighlight && isAdjTrigger && <span>⚠️</span>}
                          {isHighlight && !isAdjTrigger && <span>💬</span>}
                          {index + 1}. {question.question_text}
                        </p>
                        {isEditing ? (
                          <div className="flex items-center gap-2 mt-1">
                            <Input
                              type="number"
                              step="0.1"
                              value={editedWeightValue}
                              onChange={(e) => setEditedWeightValue(e.target.value)}
                              className="h-8 w-32"
                              placeholder="Ex: 72.5"
                            />
                            <span className="text-sm text-muted-foreground">kg</span>
                            <Button
                              size="sm"
                              variant="default"
                              className="h-8 px-3"
                              onClick={() => updateWeightMutation.mutate({ questionId: question.id, newValue: editedWeightValue })}
                              disabled={updateWeightMutation.isPending || !editedWeightValue}
                            >
                              Salvar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-3"
                              onClick={() => { setEditingWeightQuestionId(null); setEditedWeightValue(''); }}
                            >
                              Cancelar
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <p className="text-foreground">
                              {displayAnswer || 'Não respondido'}
                            </p>
                            {isWeight && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                  setEditingWeightQuestionId(question.id);
                                  setEditedWeightValue(String(displayAnswer).replace(/[^\d.,]/g, '').replace(',', '.'));
                                }}
                              >
                                ✏️ Editar
                              </Button>
                            )}
                          </div>
                        )}
                        {comment && (
                          <p className="text-sm text-muted-foreground mt-1 italic">
                            "{comment}"
                          </p>
                        )}
                      </div>
                    );
                  };

                  return (
                    <>
                      {highlightedQuestions.length > 0 && (
                        <div className="space-y-3 mb-4">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Destaques</p>
                          {highlightedQuestions.map((q) => renderQuestion(q, questions.indexOf(q), true))}
                        </div>
                      )}
                      {highlightedQuestions.length > 0 && regularQuestions.length > 0 && (
                        <Separator />
                      )}
                      <div className="space-y-0">
                        {regularQuestions.map((q) => renderQuestion(q, questions.indexOf(q), false))}
                      </div>
                    </>
                  );
                })()}
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

                <div className="flex flex-wrap gap-2 justify-end">
                  {feedback?.status !== 'sent' && (
                    <>
                      {/* Finalizar sem enviar WhatsApp */}
                      <Button
                        variant="ghost"
                        onClick={() => markAsReviewedMutation.mutate()}
                        disabled={markAsReviewedMutation.isPending || approveMutation.isPending}
                        className="gap-2 text-muted-foreground hover:text-foreground"
                      >
                        {markAsReviewedMutation.isPending ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Finalizando...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            Conferir sem enviar
                          </>
                        )}
                      </Button>

                      {/* Aprovar para depois enviar */}
                      <Button
                        variant="outline"
                        onClick={() => approveMutation.mutate({ sendWhatsApp: true })}
                        disabled={approveMutation.isPending || !editedFeedback.trim() || markAsReviewedMutation.isPending}
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
                    </>
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

                <Separator />
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Decisão Nutricional</p>
                  <div className="flex flex-wrap gap-2">
                    {['Mantive plano', 'Ajuste realizado', 'Aguardando mais dados', 'Atleta contactado diretamente'].map(option => (
                      <Button
                        key={option}
                        variant={adminDecision === option ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setAdminDecision(prev => prev === option ? '' : option)}
                        className="text-xs"
                      >
                        {option}
                      </Button>
                    ))}
                  </div>
                  {adminDecision === 'Ajuste realizado' && (
                    <div className="space-y-1">
                      <Label className="text-xs">Descreva o ajuste realizado</Label>
                      <Input
                        placeholder="Ex: Aumentei carboidratos no pré-treino..."
                        value={adminDecisionDetails}
                        onChange={e => setAdminDecisionDetails(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  )}
                  {adminDecision && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => saveAdminDecisionMutation.mutate()}
                      disabled={saveAdminDecisionMutation.isPending || (adminDecision === 'Ajuste realizado' && !adminDecisionDetails.trim())}
                      className="gap-2"
                    >
                      {saveAdminDecisionMutation.isPending ? (
                        <><RefreshCw className="h-3 w-3 animate-spin" />Salvando...</>
                      ) : (
                        'Salvar Decisão'
                      )}
                    </Button>
                  )}
                  {feedback?.admin_decision && (
                    <p className="text-xs text-muted-foreground">
                      Decisão registrada: <span className="font-medium text-foreground">{feedback.admin_decision}</span>
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Decisão Nutricional */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="h-5 w-5" />
                  Decisão Nutricional
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {[
                    'Mantive plano',
                    'Ajuste realizado',
                    'Aguardando mais dados',
                    'Atleta contactado diretamente',
                  ].map((option) => (
                    <label key={option} className="flex items-center gap-3 cursor-pointer p-2 rounded-md hover:bg-muted/50">
                      <input
                        type="radio"
                        name="admin_decision"
                        value={option}
                        checked={adminDecision === option}
                        onChange={() => setAdminDecision(option)}
                        className="h-4 w-4 accent-primary"
                      />
                      <span className="text-sm">{option}</span>
                    </label>
                  ))}
                </div>

                {adminDecision === 'Ajuste realizado' && (
                  <div className="space-y-2 pl-7">
                    <Label className="text-sm">Descreva o ajuste realizado</Label>
                    <Input
                      value={adminDecisionDetails}
                      onChange={(e) => setAdminDecisionDetails(e.target.value)}
                      placeholder="Ex: Reduzi calorias em 200kcal, ajustei CHO pré-treino..."
                    />
                  </div>
                )}

                {feedback?.admin_decision && (
                  <p className="text-xs text-muted-foreground">
                    Decisão salva: <span className="font-medium text-foreground">{feedback.admin_decision}</span>
                  </p>
                )}

                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => saveAdminDecisionMutation.mutate()}
                    disabled={!adminDecision || saveAdminDecisionMutation.isPending}
                  >
                    {saveAdminDecisionMutation.isPending ? 'Salvando...' : 'Salvar Decisão'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Evolution Tab */}
          <TabsContent value="evolution" className="space-y-4">
            {checkinResponse?.client_id && (
              <EvolutionAnalysisTab
                clientId={checkinResponse.client_id}
                clientName={checkinResponse.clients?.name || 'Atleta'}
                responses={allResponses}
                questions={evolutionQuestions}
              />
            )}
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
                    onClick={() => {
                      navigate(`/checkin-review/${response.id}`);
                      // Force state reset for new review
                      setFeedbackInitialized(false);
                      setEditedFeedback('');
                    }}
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