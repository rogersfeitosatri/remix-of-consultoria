import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { useAddDebt } from '@/hooks/useFinancialDebts';
import { toast } from 'sonner';

interface AddDebtDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddDebtDialog({ open, onOpenChange }: AddDebtDialogProps) {
  const addDebt = useAddDebt();

  const [name, setName] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [remainingAmount, setRemainingAmount] = useState('');
  const [area, setArea] = useState<'pessoal' | 'empresa'>('pessoal');
  const [hasDueDate, setHasDueDate] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'baixa' | 'media' | 'alta'>('media');
  const [notes, setNotes] = useState('');

  const resetForm = () => {
    setName(''); setTotalAmount(''); setRemainingAmount('');
    setArea('pessoal'); setHasDueDate(false); setDueDate('');
    setPriority('media'); setNotes('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !totalAmount) return;

    try {
      await addDebt.mutateAsync({
        name,
        total_amount: parseFloat(totalAmount),
        remaining_amount: parseFloat(remainingAmount || totalAmount),
        area,
        has_due_date: hasDueDate,
        due_date: hasDueDate && dueDate ? dueDate : null,
        priority,
        status: 'ativa',
        notes: notes || null,
      });

      toast.success('Dívida registrada!');
      resetForm();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao registrar dívida');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="text-foreground">Nova Dívida</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-foreground">Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Financiamento carro" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-foreground">Valor Total (R$) *</Label>
              <Input type="number" step="0.01" min="0" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} required />
            </div>
            <div>
              <Label className="text-foreground">Valor Restante (R$)</Label>
              <Input type="number" step="0.01" min="0" value={remainingAmount} onChange={(e) => setRemainingAmount(e.target.value)} placeholder={totalAmount || '0,00'} />
            </div>
          </div>

          <div>
            <Label className="text-foreground">Área *</Label>
            <Select value={area} onValueChange={(v: 'pessoal' | 'empresa') => setArea(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pessoal">Pessoa Física</SelectItem>
                <SelectItem value="empresa">Empresa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-foreground">Prioridade</Label>
            <Select value={priority} onValueChange={(v: 'baixa' | 'media' | 'alta') => setPriority(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={hasDueDate} onCheckedChange={setHasDueDate} />
            <Label className="text-foreground">Possui vencimento</Label>
          </div>

          {hasDueDate && (
            <div>
              <Label className="text-foreground">Data de Vencimento</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          )}

          <div>
            <Label className="text-foreground">Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações..." rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={addDebt.isPending}>
              {addDebt.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
