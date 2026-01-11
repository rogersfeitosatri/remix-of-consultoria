import { useState, useEffect, useMemo } from 'react';
import { Client } from '@/hooks/useClients';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { PhoneInput } from '@/components/ui/phone-input';
import { X, AlertCircle, Calculator, Calendar, RefreshCw } from 'lucide-react';
import { addMonths, addWeeks, parseISO, format, nextMonday, isSameMonth, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAdminSettings } from '@/hooks/useAdminSettings';

interface CalculatedWindow {
  windowStart: Date;
  windowEnd: Date;
  sendLinkAt: Date;
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

const PAYMENT_TYPE_LABELS = {
  pix: 'PIX',
  card: 'Cartão',
};

const ONBOARDING_TYPE_LABELS = {
  new: 'Novo (padrão)',
  continuation: 'Continuação (migração)',
};

interface ClientFormProps {
  client?: Client;
  onSubmit: (data: Omit<Client, 'id' | 'user_id' | 'created_at' | 'updated_at'>, options?: { sendCredentials: boolean; skipAnamnese: boolean }) => void;
  onClose: () => void;
}

export function ClientForm({ client, onSubmit, onClose }: ClientFormProps) {
  const { data: adminSettings } = useAdminSettings();
  const [sendCredentials, setSendCredentials] = useState(!client); // Apenas para novos cadastros
  const [skipAnamnese, setSkipAnamnese] = useState(false);
  
  const [formData, setFormData] = useState({
    name: client?.name || '',
    email: client?.email || '',
    phone: client?.phone || '',
    service_type: client?.service_type || 'nutrition' as 'nutrition' | 'training' | 'both',
    plan_type: client?.plan_type || 'consultoria' as 'consultoria' | 'premium',
    plan_duration: client?.plan_duration || 'monthly' as 'six_weeks' | 'monthly' | 'quarterly' | 'semiannual' | 'annual',
    has_checkin: client?.has_checkin ?? true,
    has_agenda_access: client?.has_agenda_access ?? false,
    checkin_frequency: client?.checkin_frequency || 'weekly' as 'daily' | 'weekly' | 'biweekly' | 'three_weeks' | 'monthly' | 'bimonthly' | 'quarterly',
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
  });

  // Manual override toggle for remaining consultations
  const [manualOverride, setManualOverride] = useState(false);

  // Calculate consultation_interval_weeks from consultation_frequency
  const getConsultationIntervalWeeks = () => {
    if (formData.consultation_frequency === 'monthly') return 4;
    if (formData.consultation_frequency === 'six_weeks') return 6;
    return 4; // default
  };

  // Calculate future consultation windows based on last_consultation_at, interval, and plan_end_at
  // Calculate future consultation windows based on last_consultation_at
  // CRITICAL: Link is sent on the Monday AFTER the full interval period ends
  // Example: If last consult was 10/01/2026 and interval is 4 weeks:
  // - 4 weeks end on 07/02/2026 (Saturday)
  // - The Monday AFTER that is 09/02/2026 - this is when we send the link
  const calculatedWindows = useMemo((): CalculatedWindow[] => {
    if (formData.onboarding_type !== 'continuation' || !formData.last_consultation_at || !formData.end_date) {
      return [];
    }

    const lastConsultation = parseISO(formData.last_consultation_at);
    const planEndDate = parseISO(formData.end_date);
    const intervalWeeks = getConsultationIntervalWeeks();
    const today = new Date();

    const windows: CalculatedWindow[] = [];
    let currentBaseDate = lastConsultation;
    let iteration = 1;
    const maxIterations = 20; // Safety limit

    while (iteration <= maxIterations) {
      // Calculate when the interval period ENDS
      const intervalEndDate = addWeeks(currentBaseDate, intervalWeeks);
      
      // The Monday AFTER the interval ends is when we send the link
      const sendLinkMonday = nextMonday(intervalEndDate);
      
      // Stop if send link date is beyond plan end
      if (sendLinkMonday > planEndDate) {
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
  }, [formData.last_consultation_at, formData.end_date, formData.consultation_frequency, formData.onboarding_type]);

  // Auto-update remaining_consultations when calculated windows change (only if not manual override)
  useEffect(() => {
    if (formData.onboarding_type === 'continuation' && !manualOverride && calculatedWindows.length > 0) {
      setFormData(prev => ({ ...prev, remaining_consultations: calculatedWindows.length }));
    }
  }, [calculatedWindows.length, formData.onboarding_type, manualOverride]);

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
    if (calculatedWindows.length > 0) {
      setFormData(prev => ({ ...prev, remaining_consultations: calculatedWindows.length }));
    }
  };

  // Calculate end date based on plan duration - always auto-calculate when start_date or plan_duration changes
  useEffect(() => {
    if (formData.start_date && formData.plan_duration) {
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
      
      // Always auto-calculate the end date when start_date or plan_duration changes
      setFormData(prev => ({
        ...prev,
        end_date: endDate.toISOString().split('T')[0]
      }));
    }
  }, [formData.start_date, formData.plan_duration]);

  // Set has_consultations and has_agenda_access based on plan type
  useEffect(() => {
    if (formData.plan_type === 'premium') {
      setFormData(prev => ({ ...prev, has_consultations: true, has_agenda_access: true }));
    } else {
      setFormData(prev => ({ ...prev, has_consultations: false, has_agenda_access: false }));
    }
  }, [formData.plan_type]);

  // Set checkin frequency to 3 weeks when plan is six_weeks (Emagrecimento para Corredores)
  useEffect(() => {
    if (formData.plan_duration === 'six_weeks' && !client) {
      setFormData(prev => ({ ...prev, checkin_frequency: 'three_weeks' }));
    }
  }, [formData.plan_duration, client]);

  // Reset onboarding_type to 'new' if continuation mode is disabled
  useEffect(() => {
    if (!adminSettings?.enable_continuation_mode && formData.onboarding_type === 'continuation') {
      setFormData(prev => ({ ...prev, onboarding_type: 'new', remaining_consultations: null, last_consultation_at: '' }));
    }
  }, [adminSettings?.enable_continuation_mode, formData.onboarding_type]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Se pular anamnese, definir status como ativo
    const athleteStatus = skipAnamnese ? 'active' : formData.athlete_status;
    
    // Convert empty date strings to null for database compatibility
    const dataToSubmit = {
      ...formData,
      athlete_status: athleteStatus,
      first_consultation_date: formData.first_consultation_date || null,
      notes: formData.notes || null,
      payment_date: formData.payment_date || null,
      last_consultation_at: formData.last_consultation_at || null,
      remaining_consultations: formData.onboarding_type === 'continuation' ? formData.remaining_consultations : null,
    };
    onSubmit(dataToSubmit as any, { sendCredentials, skipAnamnese });
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
            <div className="space-y-2">
              <Label htmlFor="monthlyValue">Valor Pago (R$)</Label>
              <Input
                id="monthlyValue"
                type="number"
                min="0"
                step="0.01"
                value={formData.monthly_value}
                onChange={(e) => setFormData({ ...formData, monthly_value: parseFloat(e.target.value) || 0 })}
                placeholder="0,00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Pagamento</Label>
              <Select
                value={formData.payment_type}
                onValueChange={(v) => setFormData({ ...formData, payment_type: v as 'pix' | 'card' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentDate">Data de Pagamento</Label>
              <Input
                id="paymentDate"
                type="date"
                value={formData.payment_date || ''}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value || '' })}
              />
            </div>
          </div>

          {/* Plan Info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo de Serviço</Label>
              <Select
                value={formData.service_type}
                onValueChange={(v) => setFormData({ ...formData, service_type: v as 'nutrition' | 'training' | 'both' })}
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
                onValueChange={(v) => setFormData({ ...formData, plan_duration: v as 'six_weeks' | 'monthly' | 'quarterly' | 'semiannual' | 'annual' })}
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
          </div>

          {/* Consultation Info (only for Premium) */}
          {formData.has_consultations && (
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
                    </div>
                  </div>
                  
                  {/* Continuation-specific fields */}
                  {formData.onboarding_type === 'continuation' && (
                    <div className="space-y-4 mt-3">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="lastConsultationAt">Última Consulta Realizada *</Label>
                          <Input
                            id="lastConsultationAt"
                            type="date"
                            value={formData.last_consultation_at || ''}
                            onChange={(e) => setFormData({ ...formData, last_consultation_at: e.target.value })}
                            required={formData.onboarding_type === 'continuation'}
                          />
                          <p className="text-xs text-muted-foreground">
                            Data da última consulta realizada (obrigatório)
                          </p>
                        </div>
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
                      </div>

                      {/* Remaining Consultations with manual override */}
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="remainingConsultations">
                              Consultas Restantes {manualOverride ? '(manual)' : '(calculado)'}
                            </Label>
                            <div className="flex items-center gap-2">
                              <Switch
                                id="manualOverride"
                                checked={manualOverride}
                                onCheckedChange={(checked) => {
                                  setManualOverride(checked);
                                  if (!checked && calculatedWindows.length > 0) {
                                    setFormData(prev => ({ ...prev, remaining_consultations: calculatedWindows.length }));
                                  }
                                }}
                              />
                              <Label htmlFor="manualOverride" className="text-xs cursor-pointer">
                                Editar manualmente
                              </Label>
                            </div>
                          </div>
                          <Input
                            id="remainingConsultations"
                            type="number"
                            min="1"
                            value={formData.remaining_consultations || ''}
                            onChange={(e) => {
                              setManualOverride(true);
                              setFormData({ ...formData, remaining_consultations: parseInt(e.target.value) || null });
                            }}
                            placeholder="Ex: 3"
                            disabled={!manualOverride && calculatedWindows.length > 0}
                            required={formData.onboarding_type === 'continuation'}
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleRecalculate}
                            disabled={!formData.last_consultation_at || !formData.end_date}
                            className="gap-2"
                          >
                            <RefreshCw className="h-4 w-4" />
                            Recalcular
                          </Button>
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
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground">Consultas restantes estimadas:</span>
                                <span className="font-bold text-primary">{calculatedWindows.length}</span>
                              </div>

                              <div className="space-y-2">
                                <p className="text-sm text-muted-foreground font-medium">Próximas janelas previstas:</p>
                                <div className="max-h-40 overflow-y-auto space-y-1">
                                  {calculatedWindows.slice(0, manualOverride && formData.remaining_consultations ? formData.remaining_consultations : undefined).map((window, index) => (
                                    <div 
                                      key={index}
                                      className="flex items-center justify-between text-sm p-2 rounded bg-background/50"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Calendar className="h-3 w-3 text-muted-foreground" />
                                        <span className="font-medium">
                                          Semana: {formatWeekRange(window.windowStart, window.windowEnd)}
                                        </span>
                                      </div>
                                      <span className="text-xs text-muted-foreground">
                                        Link: {format(window.sendLinkAt, "dd/MM 'às' 07:00", { locale: ptBR })}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {manualOverride && formData.remaining_consultations && formData.remaining_consultations < calculatedWindows.length && (
                                <p className="text-xs text-amber-500">
                                  ⚠️ Você definiu {formData.remaining_consultations} consultas manualmente (calculado: {calculatedWindows.length})
                                </p>
                              )}
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
                    <Label htmlFor="consultationCount">Quantidade de Consultas</Label>
                    <Input
                      id="consultationCount"
                      type="number"
                      min="1"
                      value={formData.consultation_count}
                      onChange={(e) => setFormData({ ...formData, consultation_count: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Periodicidade das Consultas</Label>
                    <Select
                      value={formData.consultation_frequency || 'monthly'}
                      onValueChange={(v) => setFormData({ ...formData, consultation_frequency: v as 'once' | 'monthly' | 'six_weeks' })}
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
                checked={formData.has_checkin}
                onCheckedChange={(v) => setFormData({ ...formData, has_checkin: v })}
              />
              <Label htmlFor="hasCheckin">Possui Check-in</Label>
            </div>
            
            {formData.has_checkin && (
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
              <Label htmlFor="isActive">Atleta Ativo</Label>
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
                    disabled={!formData.email || !formData.phone}
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
    </div>
  );
}
