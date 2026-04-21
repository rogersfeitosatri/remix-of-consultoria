import { Client } from '@/hooks/useClients';
import { calculateHealthScore } from '@/hooks/useAthleteHealthScore';
import { HealthScoreBadge } from './HealthScoreBadge';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Phone, Mail, Calendar, DollarSign, Zap, MessageCircle, CalendarCheck, Key, Lock, Flag, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { createCheckinDispatchForSend, markDispatchSent, markDispatchFailed } from '@/lib/checkinDispatch';
import { useAuth } from '@/hooks/useAuth';
import { useCheckinForms } from '@/hooks/useCheckinForms';
import { useSchedulingSettings } from '@/hooks/useScheduling';
import { useAthletesWithTargetRaceAlerts, AthleteWithTargetRaceAlert } from '@/hooks/useTargetRaceAlert';
import { usePayments } from '@/hooks/useClients';
import { toast } from 'sonner';
import { useState, useMemo } from 'react';
import { ChangeAthletePasswordDialog } from './ChangeAthletePasswordDialog';
import { PlanTypeBadge } from './PlanTypeBadge';

const SERVICE_LABELS = {
  nutrition: 'Nutrição',
  training: 'Treino',
  both: 'Ambos',
};

const PLAN_LABELS = {
  consultoria: 'Consultoria',
  premium: 'Premium',
};

const CHECKIN_LABELS = {
  daily: 'Diário',
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  monthly: 'Mensal',
  bimonthly: 'Bimestral',
  quarterly: 'Trimestral',
};

interface ClientsListProps {
  clients: Client[];
  onEdit: (client: Client) => void;
  onDelete: (id: string) => void;
}

export function ClientsList({ clients, onEdit, onDelete }: ClientsListProps) {
  const navigate = useNavigate();
  const { data: checkinForms = [] } = useCheckinForms();
  const { data: schedulingSettings } = useSchedulingSettings();
  const { data: targetRaceAlerts = [] } = useAthletesWithTargetRaceAlerts();
  const [sendingCheckin, setSendingCheckin] = useState<string | null>(null);
  const [sendingBooking, setSendingBooking] = useState<string | null>(null);
  const [sendingCredentials, setSendingCredentials] = useState<string | null>(null);
  const [passwordDialogClient, setPasswordDialogClient] = useState<Client | null>(null);
  const { data: payments = [] } = usePayments();

  // Build a map of clientId -> last payment amount
  const lastPaymentMap = useMemo(() => {
    const map: Record<string, number> = {};
    // payments are ordered by due_date asc, so later entries overwrite earlier ones
    for (const p of payments) {
      map[p.client_id] = p.amount;
    }
    return map;
  }, [payments]);

  // Helper to get days label
  const getDaysLabel = (days: number | null) => {
    if (days === null) return null;
    if (days < 0) return 'Realizada';
    if (days === 0) return 'Hoje!';
    if (days === 1) return '1 dia';
    if (days < 7) return `${days} dias`;
    if (days < 30) {
      const weeks = Math.floor(days / 7);
      return `${weeks} sem`;
    }
    const months = Math.floor(days / 30);
    return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  };

  // Helper to format phone as access code with DDI
  const formatPhoneAsAccessCode = (phone: string | null): string => {
    if (!phone) return '';
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    // Ensure it has the 55 DDI
    const withDDI = digits.startsWith('55') ? digits : `55${digits}`;
    // Format as +55 (XX) XXXXX-XXXX
    if (withDDI.length === 13) {
      return `+${withDDI.slice(0, 2)} (${withDDI.slice(2, 4)}) ${withDDI.slice(4, 9)}-${withDDI.slice(9)}`;
    } else if (withDDI.length === 12) {
      return `+${withDDI.slice(0, 2)} (${withDDI.slice(2, 4)}) ${withDDI.slice(4, 8)}-${withDDI.slice(8)}`;
    }
    return `+55 ${phone}`;
  };

  const handleSendCheckinManually = async (client: Client) => {
    if (!client.phone) {
      toast.error('Cliente não possui telefone cadastrado');
      return;
    }

    const activeForm = checkinForms.find(f => f.is_active);
    if (!activeForm) {
      toast.error('Nenhum formulário de check-in ativo');
      return;
    }

    setSendingCheckin(client.id);
    let dispatchId: string | null = null;
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

      // REGRA OBRIGATÓRIA: criar dispatch ANTES do envio
      dispatchId = await createCheckinDispatchForSend({
        clientId: client.id,
        userId: user!.id,
        linkCheckin: checkinLink,
        source: 'manual_clients_list',
      });

      const { data: sendResult, error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          clientId: client.id,
          templateKey: 'checkin_reminder',
          context,
        },
      });

      if (error) throw error;
      await markDispatchSent(dispatchId, sendResult);
      toast.success('Check-in enviado via WhatsApp!');
    } catch (error: any) {
      if (dispatchId) await markDispatchFailed(dispatchId, error.message || 'erro');
      console.error('Error sending checkin:', error);
      toast.error('Erro ao enviar check-in: ' + (error.message || 'Verifique as configurações'));
    } finally {
      setSendingCheckin(null);
    }
  };

  const handleSendBookingManually = async (client: Client) => {
    if (!client.phone) {
      toast.error('Cliente não possui telefone cadastrado');
      return;
    }

    if (!schedulingSettings?.booking_link_slug) {
      toast.error('Configure o link de agendamento nas configurações');
      return;
    }

    setSendingBooking(client.id);
    try {
      // Create a consultation schedule with booking token
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

      // Call edge function to send booking link
      const { error } = await supabase.functions.invoke('send-booking-link', {
        body: { consultationScheduleId: schedule.id },
      });

      if (error) throw error;
      toast.success('Link de agendamento enviado via WhatsApp!');
    } catch (error: any) {
      console.error('Error sending booking:', error);
      toast.error('Erro ao enviar link: ' + (error.message || 'Verifique as configurações'));
    } finally {
      setSendingBooking(null);
    }
  };

  const handleSendCredentialsManually = async (client: Client) => {
    if (!client.phone) {
      toast.error('Cliente não possui telefone cadastrado');
      return;
    }

    if (!client.email) {
      toast.error('Cliente não possui email cadastrado');
      return;
    }

    if (!client.athlete_user_id) {
      toast.error('Cliente não possui conta de acesso criada. Edite o cadastro e crie uma conta.');
      return;
    }

    setSendingCredentials(client.id);
    try {
      // Generate a random temporary password
      const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
      
      // Update the user's password using edge function
      const { error: updateError } = await supabase.functions.invoke('create-athlete-auth', {
        body: { 
          email: client.email, 
          password: tempPassword, 
          clientId: client.id,
          updatePasswordOnly: true 
        },
      });

      if (updateError) throw updateError;

      // Send credentials via WhatsApp
      const message = `Olá ${client.name.split(' ')[0]}! 🏃‍♂️

Aqui estão suas credenciais de acesso à área de membros:

📧 E-mail: ${client.email}
🔑 Senha: ${tempPassword}

🔗 Acesse em: ${window.location.origin}/auth

⚠️ Recomendo que altere sua senha no primeiro acesso.

Qualquer dúvida, estou à disposição! 💪`;

      const { error } = await supabase.functions.invoke('send-whatsapp', {
        body: { clientId: client.id, message },
      });

      if (error) throw error;
      toast.success('Credenciais enviadas via WhatsApp!');
    } catch (error: any) {
      console.error('Error sending credentials:', error);
      toast.error('Erro ao enviar credenciais: ' + (error.message || 'Verifique as configurações'));
    } finally {
      setSendingCredentials(null);
    }
  };

  if (clients.length === 0) {
    return (
      <div className="glass-card rounded-xl p-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <span className="text-3xl">🏋️</span>
        </div>
        <h3 className="text-lg font-semibold text-card-foreground">Nenhum atleta cadastrado</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Comece adicionando seu primeiro atleta
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {clients.map((client) => {
        const daysUntilExpiry = differenceInDays(parseISO(client.end_date), new Date());
        const isExpiring = daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
        const isExpired = daysUntilExpiry < 0;
        const targetRaceAlert = targetRaceAlerts.find(a => a.clientId === client.id);
        const isRaceUrgent = targetRaceAlert?.daysToRace !== null && targetRaceAlert?.daysToRace !== undefined && targetRaceAlert.daysToRace <= 30 && targetRaceAlert.daysToRace >= 0;

        return (
          <div
            key={client.id}
            className={cn(
              'glass-card rounded-xl p-5 transition-all hover:shadow-lg cursor-pointer hover:border-primary/50',
              !client.is_active && 'opacity-60'
            )}
            onClick={() => navigate(`/clients/${client.id}`)}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              {/* Client Info */}
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-card-foreground">{client.name}</h3>
                  {client.is_active && (() => {
                    const score = calculateHealthScore(client);
                    return <HealthScoreBadge status={score.status} label={score.label} reasons={score.reasons} />;
                  })()}
                  {!client.is_active && (
                    <span className="alert-badge bg-muted text-muted-foreground">Inativo</span>
                  )}
                  {isExpired && client.is_active && (
                    <span className="alert-badge bg-destructive/10 text-destructive">Vencido</span>
                  )}
                  {isExpiring && client.is_active && (
                    <span className="alert-badge bg-warning/10 text-warning">
                      {daysUntilExpiry} dias restantes
                    </span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  {client.email && (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      {client.email}
                    </span>
                  )}
                  {client.phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" />
                      {client.phone}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    {SERVICE_LABELS[client.service_type]}
                  </span>
                  <span className="inline-flex items-center rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                    {PLAN_LABELS[client.plan_type]}
                  </span>
                  <PlanTypeBadge client={client} />
                  {client.has_checkin && client.checkin_frequency && (
                    <span className="inline-flex items-center rounded-md bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                      Check-in {CHECKIN_LABELS[client.checkin_frequency]}
                    </span>
                  )}
                  {/* Registration source badge */}
                  {client.registration_source === 'kiwify' && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-accent/50 px-2.5 py-1 text-xs font-medium text-accent-foreground">
                      <Zap className="h-3 w-3" />
                      Kiwify
                    </span>
                  )}
                  {/* Target Race Badge */}
                  {targetRaceAlert && (
                    <Badge 
                      variant={isRaceUrgent ? "destructive" : "outline"}
                      className={cn(
                        "gap-1 text-xs",
                        !isRaceUrgent && "border-blue-500/50 text-blue-600 dark:text-blue-400"
                      )}
                    >
                      <Flag className="h-3 w-3" />
                      {targetRaceAlert.targetRace}
                      {targetRaceAlert.daysToRace !== null && targetRaceAlert.daysToRace >= 0 && (
                        <span className="ml-1 flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {getDaysLabel(targetRaceAlert.daysToRace)}
                        </span>
                      )}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Plan Details */}
              <div className="flex flex-wrap items-center gap-6 text-sm lg:justify-end">
                <div className="text-center">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Período</span>
                  </div>
                  <p className="mt-1 font-medium text-card-foreground">
                    {format(parseISO(client.start_date), 'dd/MM/yy', { locale: ptBR })} -{' '}
                    {format(parseISO(client.end_date), 'dd/MM/yy', { locale: ptBR })}
                  </p>
                </div>

                <div className="text-center">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <DollarSign className="h-4 w-4" />
                    <span>Valor Pago</span>
                  </div>
                  <p className="mt-1 font-semibold text-card-foreground">
                    R$ {(lastPaymentMap[client.id] ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>

                {/* Actions - Apenas ações rápidas, o resto está na página de detalhe */}
                <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                  {client.phone && (
                    <>
                      {/* WhatsApp direto */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          const digits = client.phone!.replace(/\D/g, '');
                          const withDDI = digits.startsWith('55') ? digits : `55${digits}`;
                          const firstName = client.name.split(' ')[0];
                          const msg = encodeURIComponent(`Olá ${firstName}! Tudo bem? 💪`);
                          window.open(`https://wa.me/${withDDI}?text=${msg}`, '_blank');
                        }}
                        className="gap-1 text-xs text-success hover:text-success"
                        title="Abrir WhatsApp"
                      >
                        <Zap className="h-3 w-3" />
                        Msg
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSendCheckinManually(client);
                        }}
                        disabled={sendingCheckin === client.id}
                        className="gap-1 text-xs text-primary hover:text-primary"
                        title="Enviar Check-in via WhatsApp"
                      >
                        <MessageCircle className="h-3 w-3" />
                        {sendingCheckin === client.id ? '...' : 'Checkin'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSendBookingManually(client);
                        }}
                        disabled={sendingBooking === client.id}
                        className="gap-1 text-xs text-primary hover:text-primary"
                        title="Enviar Link de Consulta via WhatsApp"
                      >
                        <CalendarCheck className="h-3 w-3" />
                        {sendingBooking === client.id ? '...' : 'Consulta'}
                      </Button>
                      {client.athlete_user_id && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSendCredentialsManually(client);
                            }}
                            disabled={sendingCredentials === client.id}
                            className="gap-1 text-xs text-primary hover:text-primary"
                            title="Enviar Credenciais de Acesso via WhatsApp"
                          >
                            <Key className="h-3 w-3" />
                            {sendingCredentials === client.id ? '...' : 'Senha'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPasswordDialogClient(client);
                            }}
                            className="gap-1 text-xs text-destructive hover:text-destructive"
                            title="Alterar Senha do Atleta"
                          >
                            <Lock className="h-3 w-3" />
                            Alterar
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Dialog para alterar senha do atleta */}
      {passwordDialogClient && (
        <ChangeAthletePasswordDialog
          open={!!passwordDialogClient}
          onOpenChange={(open) => !open && setPasswordDialogClient(null)}
          clientId={passwordDialogClient.id}
          clientEmail={passwordDialogClient.email || ''}
          clientName={passwordDialogClient.name}
        />
      )}
    </div>
  );
}
