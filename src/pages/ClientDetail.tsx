import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Phone, 
  Edit2, 
  Trash2, 
  Brain, 
  History,
  MessageCircle,
  CalendarCheck,
  Key,
  Lock,
  Copy,
  ClipboardCheck,
  TrendingUp,
  Snowflake,
  Play,
  RefreshCw
} from 'lucide-react';
import { useClients, useDeleteClient, useUpdateClient } from '@/hooks/useClients';
import { useSchedulingSettings } from '@/hooks/useScheduling';
import { useCheckinForms } from '@/hooks/useCheckinForms';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AthleteSummarySection } from '@/components/admin/AthleteSummarySection';
import { AthleteTimeline } from '@/components/admin/AthleteTimeline';
import { TargetRaceAlert } from '@/components/admin/TargetRaceAlert';
import { PremiumClientDetails } from '@/components/admin/PremiumClientDetails';
import { AnamneseResponseSection } from '@/components/admin/AnamneseResponseSection';
import { CheckinEvolutionCharts } from '@/components/checkin/CheckinEvolutionCharts';
import { ClientForm } from '@/components/clients/ClientForm';
import { ChangeAthletePasswordDialog } from '@/components/clients/ChangeAthletePasswordDialog';
import { RenewPlanDialog } from '@/components/clients/RenewPlanDialog';
import { FreezePlanDialog } from '@/components/clients/FreezePlanDialog';
import { PlanHistorySection } from '@/components/clients/PlanHistorySection';
import { AthleteCheckinSchedules } from '@/components/admin/AthleteCheckinSchedules';
import { useQuery } from '@tanstack/react-query';
import { useFreezePlan } from '@/hooks/useFreezePlan';
import { differenceInCalendarDays } from 'date-fns';

const SERVICE_LABELS: Record<string, string> = {
  nutrition: 'Nutrição',
  training: 'Treino',
  both: 'Ambos',
};

const PLAN_LABELS: Record<string, string> = {
  consultoria: 'Consultoria',
  premium: 'Premium',
};

export default function ClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromPeriodization = searchParams.get('from') === 'periodization';
  const goBack = () => {
    if (fromPeriodization && clientId) navigate(`/nutritional-periodization?client=${clientId}`);
    else navigate('/clients');
  };
  
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const deleteClientMutation = useDeleteClient();
  const updateClientMutation = useUpdateClient();
  const { data: schedulingSettings } = useSchedulingSettings();
  const { data: checkinForms = [] } = useCheckinForms();
  
  const [showEditForm, setShowEditForm] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showRenewDialog, setShowRenewDialog] = useState(false);
  const [showFreezeDialog, setShowFreezeDialog] = useState(false);
  const [sendingCheckin, setSendingCheckin] = useState(false);
  const [sendingBooking, setSendingBooking] = useState(false);
  const [sendingCredentials, setSendingCredentials] = useState(false);
  const { freezeMutation, unfreezeMutation } = useFreezePlan();
  const client = clients.find(c => c.id === clientId);
  
  // Fetch checkin responses for evolution charts
  const { data: checkinResponses = [] } = useQuery({
    queryKey: ['checkin_responses', 'client', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('checkin_responses')
        .select(`*, checkin_forms (title)`)
        .eq('client_id', clientId)
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });
  
  // Fetch questions for charts
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
  
  // Helper to format phone
  const formatPhoneAsAccessCode = (phone: string | null): string => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    const withDDI = digits.startsWith('55') ? digits : `55${digits}`;
    if (withDDI.length === 13) {
      return `+${withDDI.slice(0, 2)} (${withDDI.slice(2, 4)}) ${withDDI.slice(4, 9)}-${withDDI.slice(9)}`;
    } else if (withDDI.length === 12) {
      return `+${withDDI.slice(0, 2)} (${withDDI.slice(2, 4)}) ${withDDI.slice(4, 8)}-${withDDI.slice(8)}`;
    }
    return `+55 ${phone}`;
  };
  
  const handleSendCheckin = async () => {
    if (!client?.phone) {
      toast.error('Cliente não possui telefone cadastrado');
      return;
    }
    const activeForm = checkinForms.find(f => f.is_active);
    if (!activeForm) {
      toast.error('Nenhum formulário de check-in ativo');
      return;
    }
    setSendingCheckin(true);
    try {
      const checkinLink = `https://rogersfeitosa.com.br/form/${activeForm.id}?client=${client.id}`;
      const codigoAcesso = formatPhoneAsAccessCode(client.phone);
      const context = {
        nome: client.name.split(' ')[0],
        link_checkin: checkinLink,
        checkin_link: checkinLink,
        data: format(new Date(), "dd/MM/yyyy", { locale: ptBR }),
        codigo_acesso: codigoAcesso,
      };
      const { error } = await supabase.functions.invoke('send-whatsapp', {
        body: { clientId: client.id, templateKey: 'checkin_reminder', context },
      });
      if (error) throw error;
      toast.success('Check-in enviado via WhatsApp!');
    } catch (error: any) {
      toast.error('Erro ao enviar check-in: ' + (error.message || 'Verifique as configurações'));
    } finally {
      setSendingCheckin(false);
    }
  };
  
  const handleSendBooking = async () => {
    if (!client?.phone) {
      toast.error('Cliente não possui telefone cadastrado');
      return;
    }
    if (!schedulingSettings?.booking_link_slug) {
      toast.error('Configure o link de agendamento nas configurações');
      return;
    }
    setSendingBooking(true);
    try {
      const { data: schedule, error: scheduleError } = await supabase
        .from('consultation_schedules')
        .insert({
          client_id: client.id,
          user_id: schedulingSettings.user_id,
          scheduled_date: format(new Date(), 'yyyy-MM-dd'),
          send_link_date: format(new Date(), 'yyyy-MM-dd'),
          status: 'pending',
        })
        .select()
        .single();
      if (scheduleError) throw scheduleError;
      const { error } = await supabase.functions.invoke('send-booking-link', {
        body: { consultationScheduleId: schedule.id },
      });
      if (error) throw error;
      toast.success('Link de agendamento enviado via WhatsApp!');
    } catch (error: any) {
      toast.error('Erro ao enviar link: ' + (error.message || 'Verifique as configurações'));
    } finally {
      setSendingBooking(false);
    }
  };
  
  const handleSendCredentials = async () => {
    if (!client?.phone || !client?.email || !client?.athlete_user_id) {
      toast.error('Cliente precisa ter telefone, email e conta de acesso criada');
      return;
    }
    setSendingCredentials(true);
    try {
      const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
      const { error: updateError } = await supabase.functions.invoke('create-athlete-auth', {
        body: { email: client.email, password: tempPassword, clientId: client.id, updatePasswordOnly: true },
      });
      if (updateError) throw updateError;
      const message = `Olá ${client.name.split(' ')[0]}! 🏃‍♂️\n\nSuas credenciais de acesso:\n📧 E-mail: ${client.email}\n🔑 Senha: ${tempPassword}\n🔗 Acesse: ${window.location.origin}/auth\n\n⚠️ Altere sua senha no primeiro acesso.`;
      const { error } = await supabase.functions.invoke('send-whatsapp', {
        body: { clientId: client.id, message },
      });
      if (error) throw error;
      toast.success('Credenciais enviadas via WhatsApp!');
    } catch (error: any) {
      toast.error('Erro ao enviar credenciais: ' + (error.message || 'Verifique as configurações'));
    } finally {
      setSendingCredentials(false);
    }
  };
  
  const handleDelete = async () => {
    if (!client) return;
    if (confirm(`Tem certeza que deseja remover ${client.name}?`)) {
      try {
        await deleteClientMutation.mutateAsync(client.id);
        toast.success('Atleta removido com sucesso');
        navigate('/clients');
      } catch (error) {
        toast.error('Erro ao remover atleta');
      }
    }
  };
  
  const handleEditSubmit = async (data: any) => {
    if (!client) return;
    setShowEditForm(false);
    try {
      await updateClientMutation.mutateAsync({ id: client.id, ...data });
      toast.success('Atleta atualizado com sucesso');
    } catch (error: any) {
      toast.error('Erro ao atualizar atleta: ' + (error.message || 'Tente novamente'));
    }
  };
  
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };
  
  if (clientsLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Layout>
    );
  }
  
  if (!client) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Atleta não encontrado</p>
          <Button variant="link" onClick={goBack}>
            Voltar para lista
          </Button>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="sm" onClick={goBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-7 w-7 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-foreground">{client.name}</h1>
                  <Badge variant={client.is_active ? 'default' : 'secondary'}>
                    {client.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                  {(client as any).is_frozen && (
                    <Badge variant="outline" className="gap-1 border-blue-400 text-blue-600 bg-blue-50">
                      <Snowflake className="h-3 w-3" />
                      Congelado
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                  {client.email && (
                    <button 
                      onClick={() => copyToClipboard(client.email!, 'Email')}
                      className="flex items-center gap-1 hover:text-primary transition-colors"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      {client.email}
                      <Copy className="h-3 w-3 opacity-50" />
                    </button>
                  )}
                  {client.phone && (
                    <button 
                      onClick={() => copyToClipboard(client.phone!, 'Telefone')}
                      className="flex items-center gap-1 hover:text-primary transition-colors"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {client.phone}
                      <Copy className="h-3 w-3 opacity-50" />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline">{SERVICE_LABELS[client.service_type]}</Badge>
                  <Badge variant="outline">{PLAN_LABELS[client.plan_type]}</Badge>
                </div>
              </div>
            </div>
          </div>
          
          {/* Ações Principais */}
          <div className="flex flex-wrap gap-2">
            {client.phone && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSendCheckin}
                  disabled={sendingCheckin}
                  className="gap-1 text-foreground"
                >
                  <MessageCircle className="h-4 w-4" />
                  {sendingCheckin ? '...' : 'Enviar Check-in'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSendBooking}
                  disabled={sendingBooking}
                  className="gap-1 text-foreground"
                >
                  <CalendarCheck className="h-4 w-4" />
                  {sendingBooking ? '...' : 'Enviar Consulta'}
                </Button>
                {client.athlete_user_id && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSendCredentials}
                      disabled={sendingCredentials}
                      className="gap-1 text-foreground"
                    >
                      <Key className="h-4 w-4" />
                      {sendingCredentials ? '...' : 'Enviar Senha'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPasswordDialog(true)}
                      className="gap-1 text-foreground"
                    >
                      <Lock className="h-4 w-4" />
                      Alterar Senha
                    </Button>
                  </>
                )}
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/clients/${client.id}/analysis`)}
              className="gap-1 text-foreground"
            >
              <Brain className="h-4 w-4" />
              Análise IA
            </Button>
            {/* Freeze/Unfreeze Plan */}
            {(client as any).is_frozen ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (confirm(`Deseja descongelar o plano de ${client.name}? A data de término será estendida.`)) {
                    unfreezeMutation.mutate({
                      clientId: client.id,
                      frozenAt: (client as any).frozen_at,
                      currentEndDate: client.end_date,
                    });
                  }
                }}
                disabled={unfreezeMutation.isPending}
                className="gap-1 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
              >
                <Play className="h-4 w-4" />
                {unfreezeMutation.isPending ? '...' : `Descongelar (${differenceInCalendarDays(new Date(), new Date((client as any).frozen_at))}d)`}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFreezeDialog(true)}
                disabled={freezeMutation.isPending}
                className="gap-1 text-blue-600 border-blue-300 hover:bg-blue-50"
              >
                <Snowflake className="h-4 w-4" />
                {freezeMutation.isPending ? '...' : 'Congelar Plano'}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRenewDialog(true)}
              className="gap-1 text-primary border-primary/30 hover:bg-primary/10"
            >
              <RefreshCw className="h-4 w-4" />
              Renovar Plano
            </Button>
            <Button
              size="sm"
              onClick={() => setShowEditForm(true)}
              className="gap-1 text-foreground"
            >
              <Edit2 className="h-4 w-4" />
              Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              className="gap-1 text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 className="h-4 w-4" />
              Excluir
            </Button>
          </div>
        </div>
        
        {/* Alerta de Prova Alvo */}
        <TargetRaceAlert clientId={client.id} clientName={client.name} />
        
        {/* Resumo do Atleta */}
        <AthleteSummarySection 
          client={client}
          onEditClient={() => setShowEditForm(true)}
        />
        
        {/* Premium Client Details (se aplicável) */}
        {(client.has_agenda_access || client.plan_type === 'premium') && (
          <PremiumClientDetails clientId={client.id} clientName={client.name} />
        )}
        
        {/* Automação de Check-ins */}
        <AthleteCheckinSchedules clientId={client.id} />
        
        {/* Histórico de Planos */}
        <PlanHistorySection clientId={client.id} />
        
        {/* Tabs */}
        <Tabs defaultValue="timeline" className="space-y-4">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="timeline" className="gap-2">
              <History className="h-4 w-4" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="anamnese" className="gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Anamnese
            </TabsTrigger>
            <TabsTrigger value="evolution" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Evolução
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <MessageCircle className="h-4 w-4" />
              Check-ins
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="timeline">
            <div className="glass-card rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3 text-foreground">Histórico de Interações</h3>
              <AthleteTimeline clientId={client.id} />
            </div>
          </TabsContent>
          
          <TabsContent value="anamnese">
            <AnamneseResponseSection clientId={client.id} clientName={client.name} />
          </TabsContent>
          
          <TabsContent value="evolution">
            <CheckinEvolutionCharts 
              responses={checkinResponses} 
              questions={checkinQuestions} 
            />
          </TabsContent>
          
          <TabsContent value="history">
            <div className="space-y-3">
              {checkinResponses.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum check-in respondido</p>
                </div>
              ) : (
                checkinResponses.map((response: any) => (
                  <div 
                    key={response.id}
                    onClick={() => navigate(`/clients/${client.id}/history`)}
                    className="p-4 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium">{response.checkin_forms?.title || 'Check-in'}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(parseISO(response.submitted_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                      Respondido
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Edit Form Dialog */}
      {showEditForm && (
        <ClientForm
          client={client}
          onSubmit={handleEditSubmit}
          onClose={() => setShowEditForm(false)}
        />
      )}
      
      {/* Password Dialog */}
      {showPasswordDialog && client.email && (
        <ChangeAthletePasswordDialog
          open={showPasswordDialog}
          onOpenChange={setShowPasswordDialog}
          clientId={client.id}
          clientEmail={client.email}
          clientName={client.name}
        />
      )}
      
      {/* Renew Plan Dialog */}
      {showRenewDialog && (
        <RenewPlanDialog
          open={showRenewDialog}
          onOpenChange={setShowRenewDialog}
          client={client}
        />
      )}
    </Layout>
  );
}
