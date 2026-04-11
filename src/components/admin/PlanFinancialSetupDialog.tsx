import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Client } from '@/hooks/useClients';
import { addMonths, addWeeks, format } from 'date-fns';

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

  const handleSave = async () => {
    if (!user) return;
    const value = parseFloat(monthlyValue);
    if (!value || value <= 0) {
      toast.error('Informe o valor mensal');
      return;
    }
    if (!endDate) {
      toast.error('Informe a data de término');
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
      <DialogContent className="max-w-md">
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
              <Label className="text-xs">Valor Mensal (R$)</Label>
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

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? 'Salvando...' : 'Salvar Plano & Registrar Pagamento'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
