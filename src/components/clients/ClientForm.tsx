import { useState, useEffect, useMemo } from 'react';
import { Client } from '@/hooks/useClients';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { PhoneInput } from '@/components/ui/phone-input';
import { Badge } from '@/components/ui/badge';
import { X, AlertCircle, Calculator, Calendar, RefreshCw } from 'lucide-react';
import { addMonths, addWeeks, parseISO, format, nextMonday, isSameMonth, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAdminSettings } from '@/hooks/useAdminSettings';
import { PlanTypeBadge } from './PlanTypeBadge';
import { validatePlanFeasibility } from '@/lib/planTypology';
import { PipelinePreviewDialog } from './PipelinePreviewDialog';
import { NpRegistrationSection } from './NpRegistrationSection';

interface CalculatedWindow {
  windowStart: Date;
  windowEnd: Date;
  sendLinkAt: Date;
  isCustom?: boolean; // Flag to indicate if this was manually edited
}

interface CustomScheduleDates {
  [consultationIndex: number]: string; // consultationIndex -> custom send_link_date (YYYY-MM-DD)
}

const SERVICE_LABELS = {
  nutrition: 'Nutrição',
  training: 'Treino',
  both: 'Combo',
};

const PLAN_LABELS = {
  consultoria: 'Consultoria (sem consultas)',
  premium: 'Premium (com consultas)',
};

const PLAN_DURATION_LABELS = {
  six_weeks: '6 Semanas',
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
  custom: 'Personalizado',
};

const ATHLETE_STATUS_LABELS = {
  pending_anamnese: 'Aguardando Anamnese',
  active: 'Ativo',
  paused: 'Pausado',
  completed: 'Encerrado',
};

const CHECKIN_LABELS = {
  daily: 'Diário',
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  three_weeks: '3 Semanas',
  monthly: 'Mensal',
  bimonthly: 'Bimestral',
  quarterly: 'Trimestral',
};

const CONSULTATION_FREQUENCY_LABELS = {
  once: '1 consulta apenas',
  monthly: '1 a cada mês',
  six_weeks: '1 a cada 6 semanas',
};

// PAYMENT_TYPE_LABELS removed - financial data is now in Financial module

const ONBOARDING_TYPE_LABELS = {
  new: 'Novo (padrão)',
  continuation: 'Continuação (migração)',
};

interface ClientFormProps {
  client?: Client;
  onSubmit: (data: Omit<Client, 'id' | 'user_id' | 'created_at' | 'updated_at'>, options?: { sendCredentials: boolean; skipAnamnese: boolean; sendBookingLink?: boolean }) => void;
  onClose: () => void;
}

export function ClientForm({ client, onSubmit, onClose }: ClientFormProps) {
  const { data: adminSettings } = useAdminSettings();
  const [sendCredentials, setSendCredentials] = useState(!client); // Apenas para novos cadastros
  const [skipAnamnese, setSkipAnamnese] = useState(false);
  const [sendBookingLink, setSendBookingLink] = useState(false);
  
  const [formData, setFormData] = useState({
    name: client?.name || '',
    email: client?.email || '',
    phone: client?.phone || '',
    service_type: client?.service_type || 'nutrition' as 'nutrition' | 'training' | 'both',
    plan_type: client?.plan_type || 'consultoria' as 'consultoria' | 'premium',
    plan_duration: client?.plan_duration || 'monthly' as 'six_weeks' | 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'custom',
    has_checkin: client?.has_checkin ?? true,
    has_agenda_access: client?.has_agenda_access ?? false,
    checkin_frequency: client?.checkin_frequency || 'weekly' as 'daily' | 'weekly' | 'biweekly' | 'three_weeks' | 'monthly' | 'bimonthly' | 'quarterly',
    checkin_response_window_hours: (client as any)?.checkin_response_window_hours ?? null as number | null,
    start_date: client?.start_date || new Date().toISOString().split('T')[0],
    end_date: client?.end_date || '',
    monthly_value: client?.monthly_value || 0,
    notes: client?.notes || '',
    is_active: client?.is_active ?? true,
    has_consultations: client?.has_consultations ?? false,
    consultation_count: client?.consultation_count || 1,
    consultation_frequency: client?.consultation_frequency || 'monthly' as 'once' | 'monthly' | 'six_weeks',
    first_consultation_date: client?.first_consultation_date || '',
    payment_type: client?.payment_type || 'pix' as 'pix' | 'card',
    payment_date: client?.payment_date || '',
    athlete_status: client?.athlete_status || 'pending_anamnese' as 'pending_anamnese' | 'active' | 'paused' | 'completed',
    registration_source: client?.registration_source || 'manual' as 'manual' | 'kiwify',
    // Migration fields
    onboarding_type: client?.onboarding_type || 'new' as 'new' | 'continuation',
    remaining_consultations: client?.remaining_consultations || null as number | null,
    last_consultation_at: client?.last_consultation_at || '' as string,
    last_consultation_index: (client?.last_consultation_index as number) || 1 as number,
  });

  // Manual override toggle for remaining consultations
  const [manualOverride, setManualOverride] = useState(false);
  
  // Custom schedule dates for continuation mode
  const [customScheduleDates, setCustomScheduleDates] = useState<CustomScheduleDates>({});

  // Calculate consultation_interval_weeks from consultation_frequency
  const getConsultationIntervalWeeks = () => {
    if (formData.consultation_frequency === 'monthly') return 4;
    if (formData.consultation_frequency === 'six_weeks') return 6;
    return 4; // default
  };

  // Calculate total consultation count based on plan duration (DYNAMIC)
  // Used for continuation mode to show proper options (Consulta 1 to N)
  const getTotalConsultationsForPlan = useMemo(() => {
    // If has manual consultation_count and it's not the default, use it
    if (client && client.consultation_count && client.consultation_count > 1) {
      return client.consultation_count;
    }

    // Calculate based on plan duration and consultation frequency
    const durationToMonths: Record<string, number> = {
      six_weeks: 1.5,
      monthly: 1,
      quarterly: 3,
      semiannual: 6,
      annual: 12,
    };

    // For custom duration, calculate months from start_date and end_date
    let months: number;
    if (formData.plan_duration === 'custom' && formData.start_date && formData.end_date) {
      const start = parseISO(formData.start_date);
      const end = parseISO(formData.end_date);
      const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      months = diffDays / 30;
    } else {
      months = durationToMonths[formData.plan_duration] || 12;
    }
    
    if (formData.consultation_frequency === 'monthly') {
      // Monthly = 1 consultation per month
      return Math.max(1, Math.ceil(months));
    } else if (formData.consultation_frequency === 'six_weeks') {
      // 6 weeks = ~1.5 months per consultation
      return Math.max(1, Math.floor(months / 1.5));
    }
    
    // Fallback: use months as count (reasonable default)
    return Math.max(1, Math.ceil(months));
  }, [formData.plan_duration, formData.consultation_frequency, client]);

  // Update consultation_count when plan changes (for both new and continuation mode)
  useEffect(() => {
    if (!client && formData.has_consultations && formData.consultation_frequency !== 'once') {
      setFormData(prev => ({ ...prev, consultation_count: getTotalConsultationsForPlan }));
    }
  }, [getTotalConsultationsForPlan, formData.onboarding_type, formData.has_consultations, formData.consultation_frequency, client]);

  // Auto-suggest consultation index based on dates
  // When admin fills last_consultation_at, calculate suggested index
  useEffect(() => {
    if (
      formData.onboarding_type === 'continuation' &&
      formData.last_consultation_at &&
      formData.start_date &&
      !client // Only for new clients
    ) {
      const lastConsultDate = parseISO(formData.last_consultation_at);
      const planStartDate = parseISO(formData.start_date);
      
      // Calculate months difference between start and last consultation
      const msPerMonth = 30 * 24 * 60 * 60 * 1000;
      const monthsDiff = Math.floor((lastConsultDate.getTime() - planStartDate.getTime()) / msPerMonth);
      
      let suggestedIndex: number;
      if (formData.consultation_frequency === 'six_weeks') {
        // 6 weeks = 1.5 months per consultation
        suggestedIndex = Math.floor(monthsDiff / 1.5) + 1;
      } else {
        // Monthly = 1 month per consultation
        suggestedIndex = monthsDiff + 1;
      }
      
      // Clamp between 1 and total
      suggestedIndex = Math.max(1, Math.min(suggestedIndex, getTotalConsultationsForPlan));
      
      // Only update if different (to avoid loops)
      if (suggestedIndex !== formData.last_consultation_index) {
        const remaining = getTotalConsultationsForPlan - suggestedIndex;
        setFormData(prev => ({
          ...prev,
          last_consultation_index: suggestedIndex,
          remaining_consultations: remaining > 0 ? remaining : 0,
          consultation_count: getTotalConsultationsForPlan,
        }));
      }
    }
  }, [formData.last_consultation_at, formData.start_date, formData.consultation_frequency, formData.onboarding_type, client, getTotalConsultationsForPlan]);

  // Calculate future consultation windows based on last_consultation_at
  // CRITICAL: Link is sent on the Monday AFTER the full interval period ends
  // Example: If last consult was 10/01/2026 and interval is monthly:
  // - interval ends on 10/02/2026
  // - The Monday AFTER that is when we send the link
  // RULES:
  // 1. Number of windows must match remaining_consultations exactly
  // 2. Last consultation must be at least 3 weeks before plan end
  const calculatedWindows = useMemo((): CalculatedWindow[] => {
    if (formData.onboarding_type !== 'continuation' || !formData.last_consultation_at || !formData.end_date) {
      return [];
    }

    const lastConsultation = parseISO(formData.last_consultation_at);
    const planEndDate = parseISO(formData.end_date);
    const today = new Date();
    
    // Calculate the cutoff date: last consultation must be at least 3 weeks before plan end
    const cutoffDate = addWeeks(planEndDate, -3);

    // Max consultations to generate = remaining_consultations
    const maxConsultations = formData.remaining_consultations || (getTotalConsultationsForPlan - (formData.last_consultation_index || 1));

    const windows: CalculatedWindow[] = [];
    let currentBaseDate = lastConsultation;
    let iteration = 1;
    const maxIterations = Math.max(maxConsultations, 24); // Safety limit based on remaining

    while (iteration <= maxIterations && windows.length < maxConsultations) {
      // Calculate when the interval period ENDS
      const intervalEndDate = formData.consultation_frequency === 'six_weeks'
        ? addWeeks(currentBaseDate, 6)
        : addMonths(currentBaseDate, 1);

      // The Monday AFTER the interval ends is when we send the link
      const sendLinkMonday = nextMonday(intervalEndDate);

      // Stop if send link date is beyond cutoff (3 weeks before plan end)
      if (sendLinkMonday > cutoffDate) {
        break;
      }

      // Only include future dates
      if (sendLinkMonday >= today) {
        const windowStart = sendLinkMonday;
        const windowEnd = endOfWeek(sendLinkMonday, { weekStartsOn: 1 });

        windows.push({
          windowStart,
          windowEnd,
          sendLinkAt: sendLinkMonday,
        });
      }

      // Next cycle starts from the interval end date
      currentBaseDate = intervalEndDate;
      iteration++;
    }

    return windows;
  }, [formData.last_consultation_at, formData.end_date, formData.consultation_frequency, formData.onboarding_type, formData.remaining_consultations, getTotalConsultationsForPlan, formData.last_consultation_index]);

  // Auto-update remaining_consultations based on last_consultation_index (only if not manual override)
  useEffect(() => {
    if (formData.onboarding_type === 'continuation' && !manualOverride) {
      const remaining = getTotalConsultationsForPlan - formData.last_consultation_index;
      setFormData(prev => ({ ...prev, remaining_consultations: remaining > 0 ? remaining : 0 }));
    }
  }, [getTotalConsultationsForPlan, formData.last_consultation_index, formData.onboarding_type, manualOverride]);

  // Format week range for display
  const formatWeekRange = (windowStart: Date, windowEnd: Date) => {
    if (isSameMonth(windowStart, windowEnd)) {
      return `${format(windowStart, 'd', { locale: ptBR })} a ${format(windowEnd, 'd \'de\' MMMM', { locale: ptBR })}`;
    }
    return `${format(windowStart, 'd \'de\' MMM', { locale: ptBR })} a ${format(windowEnd, 'd \'de\' MMM', { locale: ptBR })}`;
  };

  // Recalculate button handler
  const handleRecalculate = () => {
    setManualOverride(false);
    const remaining = getTotalConsultationsForPlan - formData.last_consultation_index;
    setFormData(prev => ({ ...prev, remaining_consultations: remaining > 0 ? remaining : 0 }));
  };

  // Track if start_date or plan_duration changed from initial values (to avoid overwriting saved end_date on open)
  const [initialStartDate] = useState(client?.start_date || new Date().toISOString().split('T')[0]);
  const [initialPlanDuration] = useState(client?.plan_duration || 'monthly');

  // Auto-calculate end date ONLY when start_date or plan_duration actually changes from their initial values
  useEffect(() => {
    const startDateChanged = formData.start_date !== initialStartDate;
    const planDurationChanged = formData.plan_duration !== initialPlanDuration;

    // For custom duration, don't auto-calculate end_date
    if (formData.plan_duration === 'custom') return;

    // For new clients OR when admin actively changes start_date/plan_duration on existing clients
    if (formData.start_date && formData.plan_duration && (!client || startDateChanged || planDurationChanged)) {
      const startDate = new Date(formData.start_date);
      let endDate: Date;
      
      switch (formData.plan_duration) {
        case 'six_weeks':
          endDate = addWeeks(startDate, 6);
          break;
        case 'monthly':
          endDate = addMonths(startDate, 1);
          break;
        case 'quarterly':
          endDate = addMonths(startDate, 3);
          break;
        case 'semiannual':
          endDate = addMonths(startDate, 6);
          break;
        case 'annual':
          endDate = addMonths(startDate, 12);
          break;
        default:
          endDate = addMonths(startDate, 1);
      }
      
      setFormData(prev => ({
        ...prev,
        end_date: endDate.toISOString().split('T')[0]
      }));
    }
  }, [formData.start_date, formData.plan_duration]);

  const [initialPlanType] = useState(client?.plan_type || 'consultoria');

  // Set has_consultations and has_agenda_access based on plan type ONLY when plan_type actively changes
  useEffect(() => {
    if (formData.plan_type === initialPlanType) return; // Don't overwrite saved values on open
    if (formData.plan_type === 'premium') {
      setFormData(prev => ({ ...prev, has_consultations: true, has_agenda_access: true }));
    } else {
      // For consultoria, keep has_agenda_access false but let user choose consultation config
      setFormData(prev => ({ ...prev, has_agenda_access: false }));
    }
  }, [formData.plan_type]);

  // Set checkin frequency to 3 weeks when plan is six_weeks (Emagrecimento para Corredores)
  useEffect(() => {
    if (formData.plan_duration === 'six_weeks' && !client) {
      setFormData(prev => ({ ...prev, checkin_frequency: 'three_weeks' }));
    }
  }, [formData.plan_duration, client]);

  // Reset onboarding_type to 'new' if continuation mode is disabled
  // BUT only for new clients - existing clients should keep their saved value
  useEffect(() => {
    if (!client && !adminSettings?.enable_continuation_mode && formData.onboarding_type === 'continuation') {
      setFormData(prev => ({ ...prev, onboarding_type: 'new', remaining_consultations: null, last_consultation_at: '' }));
    }
  }, [adminSettings?.enable_continuation_mode, formData.onboarding_type, client]);

  const [showPipelinePreview, setShowPipelinePreview] = useState(false);

  const buildSubmitPayload = () => {
    const athleteStatus = skipAnamnese ? 'active' : formData.athlete_status;

    const customSchedules = formData.onboarding_type === 'continuation' && Object.keys(customScheduleDates).length > 0
      ? calculatedWindows.map((window, index) => {
          const consultationNumber = (formData.last_consultation_index || 1) + index + 1;
          const customDate = customScheduleDates[consultationNumber];
          return {
            consultationNumber,
            sendLinkDate: customDate || format(window.sendLinkAt, 'yyyy-MM-dd'),
            isCustom: !!customDate,
          };
        })
      : null;

    return {
      ...formData,
      athlete_status: athleteStatus,
      first_consultation_date: formData.first_consultation_date || null,
      notes: formData.notes || null,
      payment_date: formData.payment_date || null,
      last_consultation_at: formData.last_consultation_at || null,
      remaining_consultations: formData.onboarding_type === 'continuation' ? formData.remaining_consultations : null,
      last_consultation_index: formData.onboarding_type === 'continuation' ? formData.last_consultation_index : null,
      custom_schedule_dates: customSchedules,
    };
  };

  const performSubmit = (extra?: { firstConsultAlreadyDone?: boolean }) => {
    const dataToSubmit = buildSubmitPayload();
    onSubmit(dataToSubmit as any, {
      sendCredentials,
      skipAnamnese,
      sendBookingLink,
      firstConsultAlreadyDone: extra?.firstConsultAlreadyDone,
    } as any);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Mostra prévia da pipeline apenas para novos atletas com consultas
    // Em edição, mantém comportamento direto para não interromper fluxo de ajustes
    if (!client && formData.has_consultations && formData.start_date) {
      setShowPipelinePreview(true);
      return;
    }
    performSubmit();
  };

  const showContinuationOption = adminSettings?.enable_continuation_mode && formData.has_consultations;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">
            {client ? 'Editar Atleta' : 'Novo Atleta'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome do atleta"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <PhoneInput
                id="phone"
                value={formData.phone}
                onChange={(value) => setFormData({ ...formData, phone: value })}
              />
            </div>
          </div>

          {/* Info box about financial data */}
          <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            <p>💰 Os dados financeiros (valor, forma de pagamento, data) são registrados separadamente na aba Financeiro.</p>
          </div>

          {/* Plan Info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo de Serviço</Label>
              <Select
                value={formData.service_type}
                onValueChange={(v) => {
                  const newService = v as 'nutrition' | 'training' | 'both';
                  setFormData({
                    ...formData,
                    service_type: newService,
                    // Treino puro não comporta check-in
                    has_checkin: newService === 'training' ? false : formData.has_checkin,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SERVICE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de Plano</Label>
              <Select
                value={formData.plan_type}
                onValueChange={(v) => setFormData({ ...formData, plan_type: v as 'consultoria' | 'premium' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PLAN_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Plan Duration */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Duração do Plano</Label>
              <Select
                value={formData.plan_duration}
                onValueChange={(v) => setFormData({ ...formData, plan_duration: v as 'six_weeks' | 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'custom' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PLAN_DURATION_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {formData.plan_duration === 'custom' && (
              <div className="space-y-2">
                <Label htmlFor="custom_end_date">Data Final do Plano</Label>
                <Input
                  id="custom_end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  min={formData.start_date}
                  required
                />
                {formData.start_date && formData.end_date && (
                  <p className="text-xs text-muted-foreground">
                    {(() => {
                      const days = Math.round((new Date(formData.end_date).getTime() - new Date(formData.start_date).getTime()) / (1000 * 60 * 60 * 24));
                      const weeks = Math.floor(days / 7);
                      const months = Math.floor(days / 30);
                      if (months > 0) return `≈ ${months} ${months === 1 ? 'mês' : 'meses'} (${days} dias)`;
                      if (weeks > 0) return `${weeks} ${weeks === 1 ? 'semana' : 'semanas'} (${days} dias)`;
                      return `${days} dias`;
                    })()}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Plan typology preview + feasibility warning */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Tipo do plano:</span>
            <PlanTypeBadge
              client={{
                has_consultations: formData.has_consultations,
                consultation_count: formData.consultation_count,
                consultation_frequency: formData.consultation_frequency === 'once' ? null : formData.consultation_frequency,
                plan_type: formData.plan_type,
              }}
              variant="full"
            />
            {(() => {
              const warn = validatePlanFeasibility({
                has_consultations: formData.has_consultations,
                consultation_count: formData.consultation_count,
                consultation_frequency: formData.consultation_frequency === 'once' ? null : formData.consultation_frequency,
                start_date: formData.start_date,
                end_date: formData.end_date,
              });
              if (!warn) return null;
              return (
                <div className="flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1 text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  <span>{warn}</span>
                </div>
              );
            })()}
          </div>

          {formData.plan_type === 'consultoria' && (
            <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/30">
              <h3 className="font-semibold text-foreground">Consulta (opcional)</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Switch
                    id="consultoriaHasConsult"
                    checked={formData.has_consultations}
                    onCheckedChange={(v) => setFormData({ 
                      ...formData, 
                      has_consultations: v, 
                      consultation_count: v ? 1 : 0,
                      consultation_frequency: 'once',
                    })}
                  />
                  <Label htmlFor="consultoriaHasConsult">Incluir 1 consulta única</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formData.has_consultations 
                    ? '✅ O atleta terá 1 consulta incluída no plano. A data será agendada pelo atleta via link.'
                    : 'Sem consultas — apenas acompanhamento remoto.'}
                </p>
                {formData.has_consultations && (
                  <div className="flex items-center gap-3 pt-2">
                    <Checkbox
                      id="sendBookingLinkConsultoria"
                      checked={sendBookingLink}
                      onCheckedChange={(v) => setSendBookingLink(!!v)}
                    />
                    <Label htmlFor="sendBookingLinkConsultoria" className="text-sm">
                      Enviar link de agendamento via WhatsApp ao cadastrar
                    </Label>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Consultation Info (only for Premium) */}
          {formData.plan_type === 'premium' && formData.has_consultations && (
            <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/30">
              <h3 className="font-semibold text-foreground">Configuração de Consultas</h3>
              
              {/* Onboarding Type - Migration Mode */}
              {showContinuationOption && (
                <div className="space-y-4 p-3 border border-amber-500/30 rounded-lg bg-amber-500/5">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium text-amber-500">Tipo de entrada no sistema</span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Tipo de Entrada</Label>
                      <Select
                        value={formData.onboarding_type}
                        onValueChange={(v) => setFormData({ ...formData, onboarding_type: v as 'new' | 'continuation' })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ONBOARDING_TYPE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Alterar o tipo de entrada recalculará o cronograma de consultas.</p>
                    </div>
                  </div>
                  
                  {/* Continuation-specific fields */}
                  {formData.onboarding_type === 'continuation' && (
                    <div className="space-y-4 mt-3">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="lastConsultationAt">Data da Última Consulta *</Label>
                          <Input
                            id="lastConsultationAt"
                            type="date"
                            value={formData.last_consultation_at || ''}
                            onChange={(e) => setFormData({ ...formData, last_consultation_at: e.target.value })}
                            required={formData.onboarding_type === 'continuation'}
                          />
                          <p className="text-xs text-muted-foreground">
                            Data em que a última consulta foi realizada
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label>Essa foi qual consulta do plano? *</Label>
                          <Select
                            value={formData.last_consultation_index?.toString() || '1'}
                            onValueChange={(v) => {
                              const index = parseInt(v);
                              const remaining = getTotalConsultationsForPlan - index;
                              setFormData({ 
                                ...formData, 
                                last_consultation_index: index,
                                remaining_consultations: remaining > 0 ? remaining : 0,
                                consultation_count: getTotalConsultationsForPlan,
                              });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: getTotalConsultationsForPlan }, (_, i) => i + 1).map((num) => (
                                <SelectItem key={num} value={num.toString()}>
                                  Consulta {num}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Total do plano: {getTotalConsultationsForPlan} consultas. Ex: Se foi a 1ª, restam {getTotalConsultationsForPlan - 1}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Intervalo entre Consultas *</Label>
                          <Select
                            value={formData.consultation_frequency || 'monthly'}
                            onValueChange={(v) => setFormData({ ...formData, consultation_frequency: v as 'once' | 'monthly' | 'six_weeks' })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="monthly">4 semanas</SelectItem>
                              <SelectItem value="six_weeks">6 semanas</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Intervalo: {getConsultationIntervalWeeks()} semanas
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label>Consultas Restantes</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id="remainingConsultations"
                              type="number"
                              min="0"
                              value={formData.remaining_consultations ?? ''}
                              onChange={(e) => {
                                setManualOverride(true);
                                setFormData({ ...formData, remaining_consultations: parseInt(e.target.value) || 0 });
                              }}
                              className="flex-1"
                              disabled={!manualOverride}
                            />
                            <div className="flex items-center gap-1">
                              <Switch
                                id="manualOverride"
                                checked={manualOverride}
                                onCheckedChange={(checked) => {
                                  setManualOverride(checked);
                                  if (!checked) {
                                    const remaining = getTotalConsultationsForPlan - (formData.last_consultation_index || 1);
                                    setFormData(prev => ({ ...prev, remaining_consultations: remaining > 0 ? remaining : 0 }));
                                  }
                                }}
                              />
                              <Label htmlFor="manualOverride" className="text-xs cursor-pointer whitespace-nowrap">
                                Editar
                              </Label>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formData.remaining_consultations === 0 
                              ? '⚠️ Nenhuma consulta futura será gerada'
                              : `Calculado: ${getTotalConsultationsForPlan} total - ${formData.last_consultation_index || 1} realizadas = ${formData.remaining_consultations || 0}`
                            }
                          </p>
                        </div>
                      </div>

                      {/* Preview Section - only show when we have calculated windows */}
                      {formData.last_consultation_at && formData.end_date && (
                        <div className="mt-4 p-4 border border-primary/30 rounded-lg bg-primary/5">
                          <div className="flex items-center gap-2 mb-3">
                            <Calculator className="h-4 w-4 text-primary" />
                            <span className="font-medium text-foreground">Prévia do Plano</span>
                          </div>
                          
                          {calculatedWindows.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              Nenhuma janela de consulta encontrada para os parâmetros informados. Verifique se o término do plano é posterior à última consulta.
                            </p>
                          ) : (
                            <div className="space-y-3">
                              {/* Plan summary */}
                              <div className="grid grid-cols-3 gap-2 text-sm">
                                <div className="p-2 bg-background/50 rounded text-center">
                                  <span className="text-muted-foreground block text-xs">Total do plano</span>
                                  <span className="font-bold text-foreground">{getTotalConsultationsForPlan}</span>
                                </div>
                                <div className="p-2 bg-background/50 rounded text-center">
                                  <span className="text-muted-foreground block text-xs">Última realizada</span>
                                  <span className="font-bold text-foreground">Consulta {formData.last_consultation_index || 1}</span>
                                </div>
                                <div className="p-2 bg-primary/10 rounded text-center">
                                  <span className="text-muted-foreground block text-xs">Restantes</span>
                                  <span className="font-bold text-primary">{formData.remaining_consultations || 0}</span>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <p className="text-sm text-muted-foreground font-medium">
                                  Próximas janelas previstas ({calculatedWindows.length} de {formData.remaining_consultations || 0}):
                                </p>
                                {calculatedWindows.length < (formData.remaining_consultations || 0) && (
                                  <p className="text-xs text-amber-500 flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" />
                                    Atenção: apenas {calculatedWindows.length} consulta(s) cabem no período restante (limite de 3 semanas antes do fim do plano)
                                  </p>
                                )}
                                <div className="max-h-48 overflow-y-auto space-y-2">
                                  {calculatedWindows.map((window, index) => {
                                    const consultationNumber = (formData.last_consultation_index || 1) + index + 1;
                                    const customDate = customScheduleDates[consultationNumber];
                                    const displayDate = customDate ? parseISO(customDate) : window.sendLinkAt;
                                    const isEdited = !!customDate;
                                    
                                    return (
                                      <div 
                                        key={index}
                                        className={`flex flex-col sm:flex-row sm:items-center justify-between text-sm p-2 rounded gap-2 ${isEdited ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-background/50'}`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <Calendar className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                          <span className="font-medium">
                                            Consulta {consultationNumber}
                                          </span>
                                          {isEdited && (
                                            <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">
                                              Editado
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2 ml-5 sm:ml-0">
                                          <Label className="text-xs text-muted-foreground whitespace-nowrap">Envio:</Label>
                                          <Input
                                            type="date"
                                            className="h-7 text-xs w-32"
                                            value={customDate || format(window.sendLinkAt, 'yyyy-MM-dd')}
                                            onChange={(e) => {
                                              const newDates = { ...customScheduleDates };
                                              if (e.target.value && e.target.value !== format(window.sendLinkAt, 'yyyy-MM-dd')) {
                                                newDates[consultationNumber] = e.target.value;
                                              } else {
                                                delete newDates[consultationNumber];
                                              }
                                              setCustomScheduleDates(newDates);
                                            }}
                                          />
                                          {isEdited && (
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              className="h-7 w-7 p-0"
                                              onClick={() => {
                                                const newDates = { ...customScheduleDates };
                                                delete newDates[consultationNumber];
                                                setCustomScheduleDates(newDates);
                                              }}
                                            >
                                              <RefreshCw className="h-3 w-3" />
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                {Object.keys(customScheduleDates).length > 0 && (
                                  <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" />
                                    {Object.keys(customScheduleDates).length} data(s) editada(s) manualmente
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Standard consultation fields */}
              {formData.onboarding_type === 'new' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Periodicidade das Consultas</Label>
                    <Select
                      value={formData.consultation_frequency || 'monthly'}
                      onValueChange={(v) => {
                        const newFreq = v as 'once' | 'monthly' | 'six_weeks';
                        setFormData({ ...formData, consultation_frequency: newFreq });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CONSULTATION_FREQUENCY_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="consultationCount">Quantidade de Consultas</Label>
                    <Input
                      id="consultationCount"
                      type="number"
                      min="1"
                      value={formData.consultation_count}
                      onChange={(e) => setFormData({ ...formData, consultation_count: parseInt(e.target.value) || 1 })}
                    />
                    {formData.consultation_frequency !== 'once' && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calculator className="h-3 w-3" />
                        Calculado: {getTotalConsultationsForPlan} consultas para este plano
                      </p>
                    )}
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="firstConsultation">Data da 1ª Consulta</Label>
                    <Input
                      id="firstConsultation"
                      type="date"
                      value={formData.first_consultation_date}
                      onChange={(e) => setFormData({ ...formData, first_consultation_date: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Check-in */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Switch
                id="hasCheckin"
                checked={formData.service_type === 'training' ? false : formData.has_checkin}
                disabled={formData.service_type === 'training'}
                onCheckedChange={(v) => setFormData({ ...formData, has_checkin: v })}
              />
              <Label htmlFor="hasCheckin" className={formData.service_type === 'training' ? 'text-muted-foreground' : ''}>
                Possui Check-in
                {formData.service_type === 'training' && (
                  <span className="ml-2 text-xs text-muted-foreground">(indisponível para serviço apenas de Treino)</span>
                )}
              </Label>
            </div>
            
            {formData.has_checkin && formData.service_type !== 'training' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Frequência do Check-in</Label>
                  <Select
                    value={formData.checkin_frequency || 'weekly'}
                    onValueChange={(v) => setFormData({ ...formData, checkin_frequency: v as typeof formData.checkin_frequency })}
                  >
                    <SelectTrigger className="w-full sm:w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CHECKIN_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="checkinWindow">Prazo para responder o check-in (horas)</Label>
                  <Input
                    id="checkinWindow"
                    type="number"
                    min={1}
                    max={720}
                    placeholder="36 (padrão)"
                    className="w-full sm:w-64"
                    value={formData.checkin_response_window_hours ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFormData({
                        ...formData,
                        checkin_response_window_hours: v === '' ? null : Math.max(1, parseInt(v, 10) || 36),
                      });
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Tempo, em horas, que o atleta tem para preencher o check-in após o envio. Deixe em branco para usar o padrão de 36h.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">Data de Início</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Data de Término (editável)</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Anotações sobre o atleta..."
              rows={3}
            />
          </div>

          {/* Periodização Nutricional + Prova Alvo */}
          <NpRegistrationSection clientId={client?.id} />

          {/* Status do Atleta */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Status do Atleta</Label>
              <Select
                value={formData.athlete_status || 'pending_anamnese'}
                onValueChange={(v) => setFormData({ ...formData, athlete_status: v as 'pending_anamnese' | 'active' | 'paused' | 'completed' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ATHLETE_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-4 pt-6">
              <Switch
                id="isActive"
                checked={formData.is_active}
                onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
              />
              <div className="flex flex-col">
                <Label htmlFor="isActive" className={formData.is_active ? '' : 'text-destructive'}>
                  {formData.is_active ? 'Atleta Ativo' : '⚠️ Atleta INATIVO'}
                </Label>
                {!formData.is_active && (
                  <span className="text-xs text-destructive">
                    O atleta não aparecerá na aba "Ativos"
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Opções de cadastro (apenas para novos atletas) */}
          {!client && (
            <div className="space-y-4 p-4 border border-primary/30 rounded-lg bg-primary/5">
              <h3 className="font-semibold text-foreground">Opções de Cadastro</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <Switch
                    id="sendCredentials"
                    checked={sendCredentials}
                    onCheckedChange={setSendCredentials}
                  />
                  <div>
                    <Label htmlFor="sendCredentials" className="cursor-pointer">
                      Enviar credenciais via WhatsApp
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Envia email e senha padrão (123456) para o atleta
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <Switch
                    id="skipAnamnese"
                    checked={skipAnamnese}
                    onCheckedChange={setSkipAnamnese}
                  />
                  <div>
                    <Label htmlFor="skipAnamnese" className="cursor-pointer">
                      Pular obrigatoriedade da anamnese
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Atleta pode acessar o sistema sem preencher anamnese
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Origem do Cadastro (somente visualização) */}
          {client && (
            <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
              <span className="font-medium">Origem do cadastro: </span>
              {formData.registration_source === 'kiwify' ? (
                <span className="text-primary">Kiwify (automático)</span>
              ) : (
                <span>Manual (admin)</span>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">
              {client ? 'Salvar Alterações' : 'Cadastrar Atleta'}
            </Button>
          </div>
        </form>
      </div>

      <PipelinePreviewDialog
        open={showPipelinePreview}
        onOpenChange={setShowPipelinePreview}
        onConfirm={({ firstConsultAlreadyDone }) => {
          setShowPipelinePreview(false);
          performSubmit({ firstConsultAlreadyDone });
        }}
        startDate={formData.start_date}
        endDate={formData.end_date}
        consultationCount={formData.consultation_count}
        consultationFrequency={formData.consultation_frequency}
        hasConsultations={formData.has_consultations}
        athleteName={formData.name}
      />
    </div>
  );
}
