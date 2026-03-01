import { useState } from 'react';
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
import { format, parseISO, addMonths, addWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

function calculateEndDate(startDate: string, duration: string): string {
  const start = parseISO(startDate);
  let end: Date;
  switch (duration) {
    case 'monthly': end = addMonths(start, 1); break;
    case 'quarterly': end = addMonths(start, 3); break;
    case 'semiannual': end = addMonths(start, 6); break;
    case 'annual': end = addMonths(start, 12); break;
    case 'six_weeks': end = addWeeks(start, 6); break;
    default: end = addMonths(start, 1);
  }
  return format(end, 'yyyy-MM-dd');
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
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [monthlyValue, setMonthlyValue] = useState(client.monthly_value);
  const [hasCheckin, setHasCheckin] = useState(client.has_checkin);
  const [hasConsultations, setHasConsultations] = useState(client.has_consultations);

  const newEndDate = calculateEndDate(startDate, planDuration);

  const handleSaveAndRenew = async () => {
    if (!user) return;
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

      // 2. Update client with new plan data
      const { error: updateError } = await supabase
        .from('clients')
        .update({
          plan_type: planType,
          service_type: serviceType,
          plan_duration: planDuration,
          start_date: startDate,
          end_date: newEndDate,
          monthly_value: monthlyValue,
          has_checkin: hasCheckin,
          has_consultations: hasConsultations,
          is_active: true,
          is_frozen: false,
          frozen_at: null,
          total_frozen_days: 0,
        })
        .eq('id', client.id);

      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Plano renovado com sucesso! O plano anterior foi salvo no histórico.');
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
                  <div><span className="text-muted-foreground">Início:</span> {format(parseISO(client.start_date), 'dd/MM/yyyy')}</div>
                  <div><span className="text-muted-foreground">Término:</span> {format(parseISO(client.end_date), 'dd/MM/yyyy')}</div>
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
                <Label>Valor Mensal (R$)</Label>
                <Input
                  type="number"
                  value={monthlyValue}
                  onChange={e => setMonthlyValue(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Data de Início</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Data de Término</Label>
                <Input type="date" value={newEndDate} disabled className="bg-muted" />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={hasCheckin} onCheckedChange={setHasCheckin} />
                <Label>Check-in</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={hasConsultations} onCheckedChange={setHasConsultations} />
                <Label>Consultas</Label>
              </div>
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
