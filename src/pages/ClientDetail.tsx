import { invokeManualBooking } from '@/lib/sendManualBooking';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
  GitBranch,
  Key,
  Lock,
  Copy,
  ClipboardCheck,
  TrendingUp,
  Snowflake,
  Play,
  RefreshCw,
  Trophy,
  MoreHorizontal,
  Settings2,
  Archive,
  CircleSlash,
  RotateCcw,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { AthletePanoramaCard } from '@/components/clients/AthletePanoramaCard';
import { RacePrepTab } from '@/components/admin/RacePrepTab';
import { useClients, useDeleteClient, useUpdateClient } from '@/hooks/useClients';
import { useSchedulingSettings } from '@/hooks/useScheduling';
import { useCheckinForms } from '@/hooks/useCheckinForms';
import { supabase } from '@/integrations/supabase/client';
import { sendManualCheckin } from '@/lib/sendManualCheckin';
import { useAuth } from '@/hooks/useAuth';
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
import { AsaasSubscriptionCard } from '@/components/clients/AsaasSubscriptionCard';
import { AthleteCheckinSchedules } from '@/components/admin/AthleteCheckinSchedules';
import { PipelineTimelineTab } from '@/components/admin/PipelineTimelineTab';
import { PipelineAuditPanel } from '@/components/admin/PipelineAuditPanel';
import { useQuery } from '@tanstack/react-query';
import { useFreezePlan } from '@/hooks/useFreezePlan';
import { useAthleteLifecycle } from '@/hooks/useAthleteLifecycle';
import { getAthleteState } from '@/lib/athleteState';
import { AthleteStateBadges } from '@/components/clients/AthleteStateBadges';
import { differenceInCalendarDays } from 'date-fns';
import { CheckinHistoryList } from '@/components/checkin/CheckinHistoryList';
import { ClientConsultations } from '@/components/clients/ClientConsultations';
import { ErrorBoundary } from '@/components/ErrorBoundary';

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
  const { user } = useAuth();
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fromPeriodization = searchParams.get('from') === 'periodization';
  const fromMealPlanHub = searchParams.get('from') === 'meal-plan-hub';
  const goBack = () => {
    if (fromPeriodization && clientId) navigate(`/periodization?client=${clientId}`);
    else if (fromMealPlanHub && clientId) navigate(`/meal-plans/${clientId}`);
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
  const lifecycle = useAthleteLifecycle();
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
  
  const handleSendCheckin = async (dryRun = false) => {
    if (!client) return;
    setSendingCheckin(true);
    try {
      const result = await sendManualCheckin(client.id, dryRun);
      toast.success(result.message);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSendingCheckin(false);
    }
  };
  
  const handleSendBooking = async (dryRun = false) => {
    if (!client) return;
    setSendingBooking(true);
    try {
      const { data } = await invokeManualBooking({ body: { clientId: client.id, dryRun } });
      toast.success(data.message);
    } catch (error: any) { toast.error(error.message); }
    finally { setSendingBooking(false); }
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
      <ErrorBoundary fallbackTitle="Erro ao exibir os dados do atleta">
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
                  <AthleteStateBadges client={client as any} size="md" />
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
          
          {/* Ações: 3 principais visíveis; o resto no menu para reduzir ruído. */}
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => setShowEditForm(true)} className="min-h-11 gap-1">
              <Edit2 className="h-4 w-4" /> Editar
            </Button>
            {client.phone && (
              <Button variant="outline" size="sm" onClick={() => handleSendCheckin()} disabled={sendingCheckin}
                className="gap-1 text-green-600 border-green-600/30 hover:bg-green-600/10">
                <MessageCircle className="h-4 w-4" /> {sendingCheckin ? '...' : 'Enviar check-in'}
              </Button>
            )}
            <Button asChild variant="outline" size="sm" className="min-h-11"><Link to={`/calendar?booking=new&client=${client.id}`}><CalendarCheck className="mr-1 h-4 w-4" />Agendar consulta</Link></Button>
            <Button asChild variant="outline" size="sm" className="min-h-11"><Link to={`/clients/${client.id}?tab=history`}>Consultar check-ins</Link></Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="min-h-11 gap-1">
                  <MoreHorizontal className="h-4 w-4" /> Mais
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setShowRenewDialog(true)}><RefreshCw className="mr-2 h-4 w-4" />Renovar plano</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSendCheckin(true)} disabled={sendingCheckin}>Verificar envio de check-in</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSendBooking(true)} disabled={sendingBooking}>Verificar convite de consulta</DropdownMenuItem>

                {client.phone && (
                  <DropdownMenuItem onClick={() => handleSendBooking()} disabled={sendingBooking}>
                    <CalendarCheck className="h-4 w-4 mr-2" /> Enviar link de consulta
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => navigate(`/clients/${client.id}/analysis`)}>
                  <Brain className="h-4 w-4 mr-2" /> Análise com IA
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {(client as any).is_frozen ? (
                  <DropdownMenuItem
                    onClick={() => {
                      if (confirm(`Descongelar o plano de ${client.name}? A data de término será estendida.`)) {
                        unfreezeMutation.mutate({
                          clientId: client.id,
                          frozenAt: (client as any).frozen_at,
                          currentEndDate: client.end_date,
                        });
                      }
                    }}
                  >
                    <Play className="h-4 w-4 mr-2" /> Descongelar plano
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => setShowFreezeDialog(true)}>
                    <Snowflake className="h-4 w-4 mr-2" /> Congelar plano
                  </DropdownMenuItem>
                )}
                {client.athlete_user_id && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSendCredentials} disabled={sendingCredentials}>
                      <Key className="h-4 w-4 mr-2" /> Enviar senha de acesso
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowPasswordDialog(true)}>
                      <Lock className="h-4 w-4 mr-2" /> Alterar senha do atleta
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                {/* ETAPA 2A — transições de ciclo de vida pelo serviço central */}
                {getAthleteState(client as any).isArchived ? (
                  <DropdownMenuItem
                    onClick={() => lifecycle.unarchive(client.id)}
                    disabled={lifecycle.isPending}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" /> Desarquivar atleta
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => {
                      if (confirm(`Arquivar ${client.name}? Ele sai das filas operacionais, mas o histórico é preservado.`)) {
                        lifecycle.archive(client.id);
                      }
                    }}
                    disabled={lifecycle.isPending}
                  >
                    <Archive className="h-4 w-4 mr-2" /> Arquivar atleta
                  </DropdownMenuItem>
                )}
                {getAthleteState(client as any).isOperational ? (
                  <DropdownMenuItem
                    onClick={() => {
                      if (confirm(`Encerrar o acompanhamento de ${client.name}? Automações e disparos param imediatamente.`)) {
                        lifecycle.endFollowUp(client.id);
                      }
                    }}
                    disabled={lifecycle.isPending}
                  >
                    <CircleSlash className="h-4 w-4 mr-2" /> Encerrar acompanhamento
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => lifecycle.reactivate(client.id)}
                    disabled={lifecycle.isPending}
                  >
                    <Play className="h-4 w-4 mr-2" /> Reativar atleta
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" /> Excluir atleta
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Alerta de Prova Alvo (só aparece quando há prova) */}
        <TargetRaceAlert clientId={client.id} clientName={client.name} />

        {/* Panorama do acompanhamento — o contrato vigente e as pendências num
            olhar. Os cards de configuração/cobrança que ficavam empilhados aqui
            foram para a aba "Plano & gestão". */}
        <AthletePanoramaCard clientId={client.id} onEditClient={() => setShowEditForm(true)} />

        {/* Tabs */}
        <Tabs
          value={searchParams.get('tab') || 'timeline'}
          onValueChange={(v) => {
            const params = new URLSearchParams(searchParams);
            params.set('tab', v);
            setSearchParams(params);
          }}
          className="space-y-4"
        >
          <TabsList className="grid h-auto grid-cols-2 gap-1 sm:grid-cols-4">
            <TabsTrigger value="timeline" className="min-h-11">Acompanhamento</TabsTrigger>
            <TabsTrigger value="history" className="min-h-11">Check-ins</TabsTrigger>
            <TabsTrigger value="consultas" className="min-h-11">Consultas</TabsTrigger>
            <TabsTrigger value="gestao" className="min-h-11">Plano contratado</TabsTrigger>
          </TabsList>
          <details className="rounded-lg border border-border px-4">
            <summary className="cursor-pointer py-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring">Mais informações do atleta</summary>
            <div className="flex flex-wrap gap-2 pb-4">
              {[
                ['anamnese', 'Anamnese'], ['evolution', 'Evolução'], ['raceprep', 'Preparação de prova'], ['pipeline', 'Diagnóstico do cadastro'],
              ].map(([tab, label]) => <Button key={tab} variant="outline" size="sm" onClick={() => { const params = new URLSearchParams(searchParams); params.set('tab', tab); setSearchParams(params); }}>{label}</Button>)}
            </div>
          </details>
          <TabsContent value="consultas"><ClientConsultations clientId={client.id} /></TabsContent>

          <TabsContent value="timeline">
            <div className="glass-card rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3 text-foreground">Histórico de Interações</h3>
              <AthleteTimeline clientId={client.id} />
            </div>
          </TabsContent>

          {/* Plano & gestão: reúne o que antes ficava empilhado acima das abas. */}
          <TabsContent value="gestao" className="space-y-4">
            <AthleteSummarySection client={client} onEditClient={() => setShowEditForm(true)} />
            <AthleteCheckinSchedules clientId={client.id} />
            <AsaasSubscriptionCard client={client as any} />
            <PlanHistorySection clientId={client.id} />
          </TabsContent>

          <TabsContent value="pipeline" className="space-y-4">
            <PipelineAuditPanel clientId={client.id} />
            <PipelineTimelineTab clientId={client.id} />
          </TabsContent>

          <TabsContent value="raceprep">
            {user?.id && <RacePrepTab clientId={client.id} userId={user.id} />}
          </TabsContent>
          
          <TabsContent value="anamnese">
            <AnamneseResponseSection clientId={client.id} clientName={client.name} />
          </TabsContent>
          
          <TabsContent value="evolution">
            <CheckinEvolutionCharts 
              responses={checkinResponses} 
              questions={checkinQuestions}
              clientName={client?.name}
              clientId={clientId}
            />
          </TabsContent>
          
          <TabsContent value="history"><CheckinHistoryList clientId={client.id} /></TabsContent>
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

      {/* Freeze Plan Dialog */}
      {showFreezeDialog && (
        <FreezePlanDialog
          client={client}
          open={showFreezeDialog}
          onOpenChange={setShowFreezeDialog}
          isPending={freezeMutation.isPending}
          onConfirm={(freezeDate, reason) => {
            freezeMutation.mutate(
              { clientId: client.id, freezeDate, reason },
              { onSuccess: () => setShowFreezeDialog(false) }
            );
          }}
        />
      )}
      </ErrorBoundary>
    </Layout>
  );
}
