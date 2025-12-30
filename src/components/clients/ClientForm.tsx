import { useState, useEffect } from 'react';
import { Client } from '@/hooks/useClients';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { X } from 'lucide-react';
import { addMonths } from 'date-fns';

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
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
};

const CHECKIN_LABELS = {
  daily: 'Diário',
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
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

interface ClientFormProps {
  client?: Client;
  onSubmit: (data: Omit<Client, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => void;
  onClose: () => void;
}

export function ClientForm({ client, onSubmit, onClose }: ClientFormProps) {
  const [formData, setFormData] = useState({
    name: client?.name || '',
    email: client?.email || '',
    phone: client?.phone || '',
    service_type: client?.service_type || 'nutrition' as 'nutrition' | 'training' | 'both',
    plan_type: client?.plan_type || 'consultoria' as 'consultoria' | 'premium',
    plan_duration: client?.plan_duration || 'monthly' as 'monthly' | 'quarterly' | 'semiannual' | 'annual',
    has_checkin: client?.has_checkin ?? true,
    checkin_frequency: client?.checkin_frequency || 'weekly' as 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'quarterly',
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
  });

  // Calculate end date based on plan duration
  useEffect(() => {
    if (formData.start_date && formData.plan_duration) {
      const startDate = new Date(formData.start_date);
      let endDate: Date;
      
      switch (formData.plan_duration) {
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
      
      // Only auto-set if not editing or if the client is new
      if (!client || formData.end_date === '') {
        setFormData(prev => ({
          ...prev,
          end_date: endDate.toISOString().split('T')[0]
        }));
      }
    }
  }, [formData.start_date, formData.plan_duration]);

  // Set has_consultations based on plan type
  useEffect(() => {
    if (formData.plan_type === 'premium') {
      setFormData(prev => ({ ...prev, has_consultations: true }));
    } else {
      setFormData(prev => ({ ...prev, has_consultations: false }));
    }
  }, [formData.plan_type]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

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
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(00) 00000-0000"
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
                onValueChange={(v) => setFormData({ ...formData, plan_duration: v as 'monthly' | 'quarterly' | 'semiannual' | 'annual' })}
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

          {/* Status */}
          <div className="flex items-center gap-4">
            <Switch
              id="isActive"
              checked={formData.is_active}
              onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
            />
            <Label htmlFor="isActive">Atleta Ativo</Label>
          </div>

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