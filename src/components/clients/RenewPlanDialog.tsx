import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, Archive, Loader2 } from 'lucide-react';
import { Client } from '@/hooks/useClients';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { DateInputBR, toBR } from '@/components/ui/date-input-br';


interface RenewPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client;
}

const PLAN_DURATION_OPTIONS = [
  { value: 'monthly', label: '1 Mês' },
  { value: 'quarterly', label: '3 Meses' },
  { value: 'semiannual', label: '6 Meses' },
  { value: 'annual', label: '12 Meses' },
  { value: 'six_weeks', label: '6 Semanas' },
  { value: 'custom', label: 'Personalizado' },
];

const SERVICE_OPTIONS = [
  { value: 'nutrition', label: 'Nutrição' },
  { value: 'training', label: 'Treino' },
  { value: 'both', label: 'Ambos' },
];

const PLAN_TYPE_OPTIONS = [
  { value: 'consultoria', label: 'Consultoria' },
  { value: 'premium', label: 'Premium' },
];

const CHECKIN_FREQ_OPTIONS = [
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quinzenal' },
  { value: 'three_weeks', label: 'A cada 3 semanas' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'bimonthly', label: 'Bimestral' },
  { value: 'quarterly', label: 'Trimestral' },
];

const CONSULT_FREQ_OPTIONS = [
  { value: 'once', label: 'Única' },
  { value: 'monthly', label: 'Mensal (4 sem)' },
  { value: 'six_weeks', label: 'A cada 6 semanas' },
];

// TZ-safe: add months keeping the local calendar day
function addMonthsStr(yyyyMmDd: string, months: number): string {
  if (!yyyyMmDd) return '';
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  if (!y || !m || !d) return '';
  const targetMonth0 = m - 1 + months;
  const targetYear = y + Math.floor(targetMonth0 / 12);
  const normalizedMonth0 = ((targetMonth0 % 12) + 12) % 12;
  const lastDay = new Date(targetYear, normalizedMonth0 + 1, 0).getDate();
  const day = Math.min(d, lastDay);
  return `${targetYear}-${String(normalizedMonth0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function addDaysStr(yyyyMmDd: string, days: number): string {
  if (!yyyyMmDd) return '';
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  if (!y || !m || !d) return '';
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtBR(yyyyMmDd: string): string {
  if (!yyyyMmDd) return '—';
  const [y, m, d] = yyyyMmDd.split('-');
  if (!y || !m || !d) return '—';
  return `${d}/${m}/${y}`;
}

function diffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const da = new Date(ay, am - 1, ad).getTime();
  const db = new Date(by, bm - 1, bd).getTime();
  return Math.round((db - da) / (1000 * 60 * 60 * 24));
}

function calculateEndDate(startDate: string, duration: string): string {
  if (!startDate) return '';
  switch (duration) {
    case 'monthly': return addMonthsStr(startDate, 1);
    case 'quarterly': return addMonthsStr(startDate, 3);
    case 'semiannual': return addMonthsStr(startDate, 6);
    case 'annual': return addMonthsStr(startDate, 12);
    case 'six_weeks': return addDaysStr(startDate, 42);
    default: return '';
  }
}

// Pick the best matching plan_duration based on a custom day-span
function inferDurationFromDays(days: number): Client['plan_duration'] {
  if (days <= 32) return 'monthly';
  if (days <= 50) return 'six_weeks';
  if (days <= 100) return 'quarterly';
  if (days <= 200) return 'semiannual';
  return 'annual';
}

export function RenewPlanDialog({ open, onOpenChange, client }: RenewPlanDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'confirm' | 'form'>('confirm');

  // New plan fields initialized from current
  const [planType, setPlanType] = useState(client.plan_type);
  const [serviceType, setServiceType] = useState(client.service_type);
  const [planDuration, setPlanDuration] = useState<string>(client.plan_duration || 'monthly');
  const [startDate, setStartDate] = useState(todayStr());
  const [customEndDate, setCustomEndDate] = useState<string>(client.end_date || '');
  const [monthlyValue, setMonthlyValue] = useState(client.monthly_value);
  const [hasCheckin, setHasCheckin] = useState(client.has_checkin);
  const [checkinFrequency, setCheckinFrequency] = useState<string>(client.checkin_frequency || 'weekly');
  const [hasConsultations, setHasConsultations] = useState(client.has_consultations);
  const [consultationFrequency, setConsultationFrequency] = useState<string>(client.consultation_frequency || 'monthly');
  const [checkinStartDate, setCheckinStartDate] = useState<string>('');
  const [firstConsultationDate, setFirstConsultationDate] = useState<string>('');

  const newEndDate = useMemo(() => {
    if (planDuration === 'custom') return customEndDate;
    return calculateEndDate(startDate, planDuration);
  }, [planDuration, startDate, customEndDate]);

  // Calculate consultation_count from period + frequency
  const computedConsultationCount = useMemo(() => {
    if (!hasConsultations) return 0;
    if (consultationFrequency === 'once') return 1;
    if (!startDate || !newEndDate) return client.consultation_count || 1;
    const days = diffDays(startDate, newEndDate);
    if (days <= 0) return 1;
    const weeksPerConsult = consultationFrequency === 'six_weeks' ? 6 : 4;
    return Math.max(1, Math.floor(days / (weeksPerConsult * 7)));
  }, [hasConsultations, consultationFrequency, startDate, newEndDate, client.consultation_count]);

  const handleSaveAndRenew = async () => {
    if (!user) return;
    if (!startDate) {
      toast.error('Informe uma data de início válida.');
      return;
    }
    if (!newEndDate) {
      toast.error(planDuration === 'custom'
        ? 'Informe a data de término para a duração personalizada.'
        : 'Não foi possível calcular a data de término.');
      return;
    }
    if (diffDays(startDate, newEndDate) <= 0) {
      toast.error('A data de término deve ser posterior à data de início.');
      return;
    }
    if (!Number.isFinite(monthlyValue) || monthlyValue < 0) {
      toast.error('Informe um valor total válido.');
      return;
    }
    setSaving(true);
    try {
      // 1. Save current plan to history
      const { error: historyError } = await supabase
        .from('client_plan_history')
        .insert({
          client_id: client.id,
          user_id: user.id,
          plan_type: client.plan_type,
          service_type: client.service_type,
          plan_duration: client.plan_duration,
          start_date: client.start_date,
          end_date: client.end_date,
          monthly_value: client.monthly_value,
          checkin_frequency: client.checkin_frequency,
          has_checkin: client.has_checkin,
          has_consultations: client.has_consultations,
          consultation_count: client.consultation_count,
          consultation_frequency: client.consultation_frequency,
          has_agenda_access: client.has_agenda_access,
          payment_type: client.payment_type,
          notes: client.notes,
        });

      if (historyError) throw historyError;

      // 2. Resolve persisted plan_duration (custom → infer label or keep 'custom')
      const persistedDuration: Client['plan_duration'] =
        planDuration === 'custom'
          ? (inferDurationFromDays(diffDays(startDate, newEndDate)))
          : (planDuration as Client['plan_duration']);

      // 3. Update client with new plan data (all cadence cascades from renewal)
      const { error: updateError } = await supabase
        .from('clients')
        .update({
          plan_type: planType,
          service_type: serviceType,
          plan_duration: persistedDuration,
          start_date: startDate,
          end_date: newEndDate,
          monthly_value: monthlyValue,
          has_checkin: hasCheckin,
          checkin_frequency: hasCheckin ? checkinFrequency : null,
          checkin_start_date: hasCheckin ? (checkinStartDate || null) : null,
          has_consultations: hasConsultations,
          consultation_frequency: hasConsultations ? consultationFrequency : null,
          consultation_count: hasConsultations ? computedConsultationCount : 0,
          first_consultation_date: hasConsultations ? (firstConsultationDate || null) : null,
          is_active: true,
          is_frozen: false,
          frozen_at: null,
          total_frozen_days: 0,
        } as any)
        .eq('id', client.id);

      if (updateError) throw updateError;

      // 4. Reset consultation pipeline — clear future (non-completed) schedules
      //    so the next consultations are only generated after the athlete books
      //    (via link) or the admin schedules manually.
      const { error: clearSchedulesError } = await supabase
        .from('consultation_schedules')
        .delete()
        .eq('client_id', client.id)
        .not('status', 'in', '(completed)');
      if (clearSchedulesError) {
        console.warn('[RenewPlan] failed to clear future schedules:', clearSchedulesError);
      }

      // 5. Reset the schedule rule trigger so the cron does not pre-fire a link
      //    before the athlete actually books the first consultation of the new plan.
      const { error: clearRuleError } = await supabase
        .from('consultation_schedule_rules')
        .update({
          next_link_send_date: null,
          last_link_sent_at: null,
          consultations_completed: 0,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('client_id', client.id);
      if (clearRuleError) {
        console.warn('[RenewPlan] failed to reset schedule rule:', clearRuleError);
      }

      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      await queryClient.invalidateQueries({ queryKey: ['client-plan-history', client.id] });
      await queryClient.invalidateQueries({ queryKey: ['athlete-summary', client.id] });
      await queryClient.invalidateQueries({ queryKey: ['consultation-schedules', client.id] });
      await queryClient.invalidateQueries({ queryKey: ['consultations'] });
      toast.success('Plano renovado! Pipeline zerada — aguardando agendamento da próxima consulta.');
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Erro ao renovar plano: ' + (err.message || 'Tente novamente'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Renovar Plano — {client.name}
          </DialogTitle>
          <DialogDescription>
            O plano atual será salvo no histórico antes da renovação.
          </DialogDescription>
        </DialogHeader>

        {step === 'confirm' ? (
          <div className="space-y-4">
            <Card className="border-muted">
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <Archive className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Plano Atual (será arquivado)</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Tipo:</span> <Badge variant="outline">{client.plan_type === 'premium' ? 'Premium' : 'Consultoria'}</Badge></div>
                  <div><span className="text-muted-foreground">Serviço:</span> {client.service_type === 'both' ? 'Ambos' : client.service_type === 'nutrition' ? 'Nutrição' : 'Treino'}</div>
                  <div><span className="text-muted-foreground">Início:</span> {fmtBR(client.start_date)}</div>
                  <div><span className="text-muted-foreground">Término:</span> {fmtBR(client.end_date)}</div>
                  <div><span className="text-muted-foreground">Valor:</span> R$ {client.monthly_value.toFixed(2)}</div>
                </div>
              </CardContent>
            </Card>
            <p className="text-sm text-muted-foreground">
              Deseja salvar o plano atual e prosseguir com a renovação?
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={() => setStep('form')} className="gap-2">
                <Archive className="h-4 w-4" />
                Sim, salvar e renovar
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <Separator />
            <h3 className="font-medium text-sm">Dados do Novo Plano</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Plano</Label>
                <Select value={planType} onValueChange={(v: any) => setPlanType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLAN_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Serviço</Label>
                <Select value={serviceType} onValueChange={(v: any) => setServiceType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SERVICE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Duração</Label>
                <Select value={planDuration} onValueChange={setPlanDuration}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLAN_DURATION_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor Total (R$)</Label>
                <Input
                  type="number"
                  value={monthlyValue}
                  onChange={e => setMonthlyValue(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Data de Início</Label>
                <DateInputBR value={startDate} onChange={setStartDate} />
              </div>
              <div className="space-y-2">
                <Label>Data de Término {planDuration === 'custom' && <span className="text-xs text-muted-foreground">(editável)</span>}</Label>
                {planDuration === 'custom' ? (
                  <DateInputBR value={customEndDate} onChange={setCustomEndDate} />
                ) : (
                  <Input type="text" value={toBR(newEndDate)} disabled className="bg-muted" />
                )}
              </div>
            </div>

            <div className="space-y-3 rounded-md border p-3 bg-muted/30">
              <p className="text-xs text-muted-foreground">
                Periodicidade do novo plano — toda a agenda (check-ins e consultas) será regenerada a partir destas regras.
              </p>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Switch checked={hasCheckin} onCheckedChange={setHasCheckin} />
                  <Label>Check-in</Label>
                </div>
                {hasCheckin && (
                  <Select value={checkinFrequency} onValueChange={setCheckinFrequency}>
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CHECKIN_FREQ_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Switch checked={hasConsultations} onCheckedChange={setHasConsultations} />
                  <Label>Consultas</Label>
                </div>
                {hasConsultations && (
                  <Select value={consultationFrequency} onValueChange={setConsultationFrequency}>
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONSULT_FREQ_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {hasConsultations && (
                <p className="text-xs text-muted-foreground">
                  Consultas previstas no período: <strong>{computedConsultationCount}</strong>
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {hasCheckin && (
                <div className="space-y-2">
                  <Label>Data de início do check-in</Label>
                  <DateInputBR value={checkinStartDate} onChange={setCheckinStartDate} />
                  <p className="text-[11px] text-muted-foreground">
                    Opcional. Se vazio, usa a data de início do plano.
                  </p>
                </div>
              )}
              {hasConsultations && (
                <div className="space-y-2">
                  <Label>Data da 1ª consulta / 1º envio do link</Label>
                  <DateInputBR value={firstConsultationDate} onChange={setFirstConsultationDate} />
                  <p className="text-[11px] text-muted-foreground">
                    Âncora para a geração das próximas consultas.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep('confirm')}>Voltar</Button>
              <Button onClick={handleSaveAndRenew} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {saving ? 'Renovando...' : 'Confirmar Renovação'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
