import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Client } from '@/hooks/useClients';
import { addMonths, addWeeks, format } from 'date-fns';
import { classifyPlan, validatePlanFeasibility } from '@/lib/planTypology';
import { PlanTypeBadge } from '@/components/clients/PlanTypeBadge';
import { Switch } from '@/components/ui/switch';

const PLAN_DURATION_OPTIONS = [
  { value: 'monthly', label: 'Mensal' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'semiannual', label: 'Semestral' },
  { value: 'annual', label: 'Anual' },
  { value: 'six_weeks', label: '6 Semanas' },
  { value: 'custom', label: 'Personalizado' },
];

function calcEndDate(startDate: string, duration: string): string {
  const start = new Date(startDate);
  switch (duration) {
    case 'monthly': return format(addMonths(start, 1), 'yyyy-MM-dd');
    case 'quarterly': return format(addMonths(start, 3), 'yyyy-MM-dd');
    case 'semiannual': return format(addMonths(start, 6), 'yyyy-MM-dd');
    case 'annual': return format(addMonths(start, 12), 'yyyy-MM-dd');
    case 'six_weeks': return format(addWeeks(start, 6), 'yyyy-MM-dd');
    default: return format(addMonths(start, 1), 'yyyy-MM-dd');
  }
}

interface Props {
  client: Client;
  trigger?: React.ReactNode;
}

export function PlanFinancialSetupDialog({ client, trigger }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [planType, setPlanType] = useState<string>(client.plan_type || 'consultoria');
  const [serviceType, setServiceType] = useState<string>(client.service_type || 'nutrition');
  const [planDuration, setPlanDuration] = useState<string>(client.plan_duration || 'monthly');
  const [monthlyValue, setMonthlyValue] = useState(client.monthly_value > 0 ? String(client.monthly_value) : '');
  const [startDate, setStartDate] = useState(client.start_date || format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(client.end_date || '');
  const [paymentType, setPaymentType] = useState<string>(client.payment_type || 'pix');
  const [paymentDate, setPaymentDate] = useState(client.payment_date || format(new Date(), 'yyyy-MM-dd'));

  // Configuração de consultas
  const [hasConsultations, setHasConsultations] = useState<boolean>(client.has_consultations ?? false);
  const [consultationCount, setConsultationCount] = useState<string>(
    client.consultation_count !== null && client.consultation_count !== undefined
      ? String(client.consultation_count)
      : '0'
  );
  const [consultationFrequency, setConsultationFrequency] = useState<string>(
    client.consultation_frequency || 'monthly'
  );

  const countNum = parseInt(consultationCount, 10) || 0;
  const isSingleConsult = hasConsultations && countNum === 1;
  const isUnlimited = hasConsultations && countNum === 0;
  const cadenceRequired = hasConsultations && countNum !== 1;

  const previewClient = {
    has_consultations: hasConsultations,
    consultation_count: countNum,
    consultation_frequency: cadenceRequired ? consultationFrequency : null,
    plan_type: planType,
  };
  const typology = classifyPlan(previewClient);

  const feasibilityWarning = useMemo(
    () =>
      validatePlanFeasibility({
        has_consultations: hasConsultations,
        consultation_count: countNum,
        consultation_frequency: cadenceRequired ? consultationFrequency : null,
        start_date: startDate,
        end_date: endDate,
      }),
    [hasConsultations, countNum, consultationFrequency, cadenceRequired, startDate, endDate]
  );

  const handleDurationChange = (val: string) => {
    setPlanDuration(val);
    if (val !== 'custom' && startDate) {
      setEndDate(calcEndDate(startDate, val));
    }
  };

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (planDuration !== 'custom' && val) {
      setEndDate(calcEndDate(val, planDuration));
    }
  };

  const handleHasConsultationsChange = (checked: boolean) => {
    setHasConsultations(checked);
    if (!checked) {
      // Limpa configuração ao desabilitar consultas
      setConsultationCount('0');
      setConsultationFrequency('monthly');
    } else if (countNum === 0) {
      // Sugere padrão razoável
      setConsultationCount('3');
    }
  };

  const handleSave = async () => {
    if (!user) return;
    const value = parseFloat(monthlyValue);
    if (!value || value <= 0) {
      toast.error('Informe o valor total');
      return;
    }
    if (!endDate) {
      toast.error('Informe a data de término');
      return;
    }
    // Validação de cadência
    if (hasConsultations && countNum !== 1 && !consultationFrequency) {
      toast.error('Selecione a periodicidade das consultas (4 ou 6 semanas)');
      return;
    }
    if (feasibilityWarning) {
      toast.error(feasibilityWarning);
      return;
    }

    setSaving(true);
    try {
      // Update client record
      const { error: clientError } = await supabase
        .from('clients')
        .update({
          plan_type: planType,
          service_type: serviceType,
          plan_duration: planDuration,
          monthly_value: value,
          start_date: startDate,
          end_date: endDate,
          payment_type: paymentType,
          payment_date: paymentDate,
          has_consultations: hasConsultations,
          consultation_count: hasConsultations ? countNum : 0,
          consultation_frequency: hasConsultations && countNum !== 1 ? consultationFrequency : null,
        })
        .eq('id', client.id);

      if (clientError) throw clientError;

      // Create payment record
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          user_id: user.id,
          client_id: client.id,
          amount: value,
          due_date: paymentDate,
          status: 'paid' as const,
          paid_at: new Date(paymentDate).toISOString(),
          payment_method: paymentType,
          plan_start_date: startDate,
          plan_end_date: endDate,
        });

      if (paymentError) throw paymentError;

      toast.success('Plano e financeiro atualizados!');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['pending-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['my-day-today'] });
      setOpen(false);
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err.message || 'Tente novamente'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs h-8">
            <Settings2 className="h-3 w-3" />
            Configurar Plano
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Configurar Plano & Financeiro
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de Plano</Label>
              <Select value={planType} onValueChange={setPlanType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="consultoria">Consultoria</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="zona_nutri_diet">Zona Nutri Diet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de Serviço</Label>
              <Select value={serviceType} onValueChange={setServiceType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nutrition">Nutrição</SelectItem>
                  <SelectItem value="training">Treino</SelectItem>
                  <SelectItem value="both">Nutri + Treino</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Duração</Label>
              <Select value={planDuration} onValueChange={handleDurationChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLAN_DURATION_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor Total (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={monthlyValue}
                onChange={e => setMonthlyValue(e.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Início</Label>
              <Input type="date" value={startDate} onChange={e => handleStartDateChange(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Término</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>

          {/* Configuração de Consultas */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-semibold">Consultas no plano</Label>
                <p className="text-[10px] text-muted-foreground">
                  Define se o atleta recebe links de agendamento
                </p>
              </div>
              <Switch checked={hasConsultations} onCheckedChange={handleHasConsultationsChange} />
            </div>

            {hasConsultations && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nº de Consultas</Label>
                  <Select value={consultationCount} onValueChange={setConsultationCount}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Ilimitado (Premium)</SelectItem>
                      <SelectItem value="1">1 (única)</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="4">4</SelectItem>
                      <SelectItem value="6">6</SelectItem>
                      <SelectItem value="8">8</SelectItem>
                      <SelectItem value="12">12</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Periodicidade {cadenceRequired && <span className="text-destructive">*</span>}
                  </Label>
                  <Select
                    value={consultationFrequency}
                    onValueChange={setConsultationFrequency}
                    disabled={isSingleConsult}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isSingleConsult ? 'N/A (única)' : 'Selecione'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">A cada 4 semanas</SelectItem>
                      <SelectItem value="six_weeks">A cada 6 semanas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Tipo:</span>
              <PlanTypeBadge client={previewClient} variant="full" />
            </div>

            {feasibilityWarning && (
              <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-[11px] text-destructive">{feasibilityWarning}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Forma de Pagamento</Label>
              <Select value={paymentType} onValueChange={setPaymentType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="card">Cartão</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data do Pagamento</Label>
              <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving || !!feasibilityWarning} className="w-full">
            {saving ? 'Salvando...' : 'Salvar Plano & Registrar Pagamento'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
