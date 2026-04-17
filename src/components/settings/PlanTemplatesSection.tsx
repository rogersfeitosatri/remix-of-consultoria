import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Layers } from 'lucide-react';
import { usePlanTemplates, PlanTemplate, PlanTemplateInput } from '@/hooks/usePlanTemplates';
import { PlanTypeBadge } from '@/components/clients/PlanTypeBadge';
import { Textarea } from '@/components/ui/textarea';

const empty: PlanTemplateInput = {
  name: '',
  description: '',
  plan_type: 'consultoria',
  service_type: 'nutrition',
  plan_duration: 'monthly',
  has_consultations: false,
  consultation_count: 0,
  consultation_frequency: null,
  has_checkin: true,
  checkin_frequency: 'weekly',
  suggested_value: 0,
  order_index: 0,
  is_active: true,
};

export function PlanTemplatesSection() {
  const { templates, isLoading, upsert, remove } = usePlanTemplates();
  const [editing, setEditing] = useState<PlanTemplate | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PlanTemplateInput>(empty);

  const startNew = () => {
    setEditing(null);
    setForm({ ...empty, order_index: templates.length + 1 });
    setOpen(true);
  };

  const startEdit = (t: PlanTemplate) => {
    setEditing(t);
    setForm({
      name: t.name,
      description: t.description || '',
      plan_type: t.plan_type,
      service_type: t.service_type,
      plan_duration: t.plan_duration,
      has_consultations: t.has_consultations,
      consultation_count: t.consultation_count,
      consultation_frequency: t.consultation_frequency,
      has_checkin: t.has_checkin,
      checkin_frequency: t.checkin_frequency,
      suggested_value: t.suggested_value,
      order_index: t.order_index,
      is_active: t.is_active,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    await upsert.mutateAsync(editing ? { ...form, id: editing.id } : form);
    setOpen(false);
  };

  const cadenceRequired = form.has_consultations && form.consultation_count !== 1;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Templates de Plano
            </CardTitle>
            <CardDescription>
              Modelos pré-configurados para acelerar o cadastro de atletas
            </CardDescription>
          </div>
          <Button onClick={startNew} size="sm" className="gap-1">
            <Plus className="h-4 w-4" /> Novo
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum template ainda. Os padrões serão criados automaticamente.</p>
        ) : (
          <div className="space-y-2">
            {templates.map(t => (
              <div key={t.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{t.name}</span>
                    <PlanTypeBadge client={t} />
                    {!t.is_active && <span className="text-[10px] text-muted-foreground">(inativo)</span>}
                  </div>
                  {t.description && (
                    <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                  )}
                  {t.suggested_value > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Valor sugerido: R$ {Number(t.suggested_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(t)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => {
                    if (confirm(`Remover template "${t.name}"?`)) remove.mutate(t.id);
                  }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Template' : 'Novo Template'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição</Label>
              <Textarea
                value={form.description || ''}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de Plano</Label>
                <Select value={form.plan_type} onValueChange={v => setForm({ ...form, plan_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consultoria">Consultoria</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Serviço</Label>
                <Select value={form.service_type} onValueChange={v => setForm({ ...form, service_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nutrition">Nutrição</SelectItem>
                    <SelectItem value="training">Treino</SelectItem>
                    <SelectItem value="both">Ambos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Duração</Label>
                <Select value={form.plan_duration} onValueChange={v => setForm({ ...form, plan_duration: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="six_weeks">6 Semanas</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="quarterly">Trimestral</SelectItem>
                    <SelectItem value="semiannual">Semestral</SelectItem>
                    <SelectItem value="annual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Valor sugerido (R$)</Label>
                <Input
                  type="number" min="0" step="0.01"
                  value={form.suggested_value || ''}
                  onChange={e => setForm({ ...form, suggested_value: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Tem consultas?</Label>
                <Switch
                  checked={form.has_consultations}
                  onCheckedChange={v => setForm({
                    ...form,
                    has_consultations: v,
                    consultation_count: v ? (form.consultation_count || 3) : 0,
                    consultation_frequency: v ? form.consultation_frequency : null,
                  })}
                />
              </div>
              {form.has_consultations && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nº Consultas (0 = ilimitado)</Label>
                    <Input
                      type="number" min="0"
                      value={form.consultation_count}
                      onChange={e => setForm({ ...form, consultation_count: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Periodicidade {cadenceRequired && '*'}</Label>
                    <Select
                      value={form.consultation_frequency || ''}
                      onValueChange={v => setForm({ ...form, consultation_frequency: v })}
                      disabled={form.consultation_count === 1}
                    >
                      <SelectTrigger><SelectValue placeholder={form.consultation_count === 1 ? 'N/A' : 'Selecione'} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">A cada 4 semanas</SelectItem>
                        <SelectItem value="six_weeks">A cada 6 semanas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Tem check-in?</Label>
                <Switch
                  checked={form.has_checkin}
                  onCheckedChange={v => setForm({ ...form, has_checkin: v })}
                />
              </div>
              {form.has_checkin && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Frequência</Label>
                  <Select
                    value={form.checkin_frequency || 'weekly'}
                    onValueChange={v => setForm({ ...form, checkin_frequency: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Diário</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="biweekly">Quinzenal</SelectItem>
                      <SelectItem value="three_weeks">3 semanas</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Resumo:</span>
              <PlanTypeBadge client={form} variant="full" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!form.name.trim() || (cadenceRequired && !form.consultation_frequency)}>
              {editing ? 'Salvar alterações' : 'Criar template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
