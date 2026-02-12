import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { useAddTransaction } from '@/hooks/useFinancialTransactions';
import { toast } from 'sonner';
import { format } from 'date-fns';

const EXPENSE_CATEGORIES = [
  'Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Educação', 'Lazer',
  'Vestuário', 'Software/Assinaturas', 'Marketing', 'Equipamentos',
  'Impostos', 'Serviços', 'Salários', 'Outros',
];

const INCOME_CATEGORIES = [
  'Consultoria', 'Assessoria', 'Plano Mensal', 'Plano Trimestral',
  'Plano Semestral', 'Plano Anual', 'Avulso', 'Outros',
];

const PAYMENT_METHODS = [
  { value: 'pix', label: 'PIX' },
  { value: 'debito', label: 'Débito' },
  { value: 'credito', label: 'Crédito' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'boleto', label: 'Boleto' },
];

interface AddTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: 'expense' | 'income';
}

export function AddTransactionDialog({ open, onOpenChange, defaultType = 'expense' }: AddTransactionDialogProps) {
  const addTransaction = useAddTransaction();

  const [type, setType] = useState<'expense' | 'income'>(defaultType);
  const [area, setArea] = useState<'pessoal' | 'empresa'>('pessoal');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [cardName, setCardName] = useState('');
  const [installments, setInstallments] = useState('1');
  const [origin, setOrigin] = useState('');
  const [receiptMethod, setReceiptMethod] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [notes, setNotes] = useState('');

  const resetForm = () => {
    setType(defaultType);
    setArea('pessoal');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setAmount('');
    setCategory('');
    setDescription('');
    setPaymentMethod('');
    setCardName('');
    setInstallments('1');
    setOrigin('');
    setReceiptMethod('');
    setIsRecurring(false);
    setNotes('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !category) return;

    try {
      await addTransaction.mutateAsync({
        type,
        area,
        date,
        amount: parseFloat(amount),
        category,
        description: description || null,
        payment_method: paymentMethod || null,
        card_name: paymentMethod === 'credito' ? cardName || null : null,
        installments: parseInt(installments) || 1,
        current_installment: 1,
        origin: type === 'income' ? origin || null : null,
        receipt_method: type === 'income' ? receiptMethod || null : null,
        is_recurring: isRecurring,
        notes: notes || null,
      });

      toast.success(type === 'expense' ? 'Gasto registrado!' : 'Entrada registrada!');
      resetForm();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao registrar');
    }
  };

  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {type === 'expense' ? 'Registrar Gasto' : 'Registrar Entrada'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type toggle */}
          <div className="flex gap-2">
            <Button type="button" variant={type === 'expense' ? 'default' : 'outline'} className="flex-1" onClick={() => setType('expense')}>
              Gasto
            </Button>
            <Button type="button" variant={type === 'income' ? 'default' : 'outline'} className="flex-1" onClick={() => setType('income')}>
              Entrada
            </Button>
          </div>

          {/* Area */}
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-foreground">Data *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div>
              <Label className="text-foreground">Valor (R$) *</Label>
              <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" required />
            </div>
          </div>

          <div>
            <Label className="text-foreground">Categoria *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-foreground">Descrição</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição do lançamento..." />
          </div>

          {type === 'expense' && (
            <>
              <div>
                <Label className="text-foreground">Forma de Pagamento</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {paymentMethod === 'credito' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-foreground">Cartão</Label>
                    <Input value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="Nome do cartão" />
                  </div>
                  <div>
                    <Label className="text-foreground">Parcelas</Label>
                    <Input type="number" min="1" value={installments} onChange={(e) => setInstallments(e.target.value)} />
                  </div>
                </div>
              )}
            </>
          )}

          {type === 'income' && (
            <>
              <div>
                <Label className="text-foreground">Origem</Label>
                <Input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Ex: Cliente X, Empresa Y..." />
              </div>
              <div>
                <Label className="text-foreground">Forma de Recebimento</Label>
                <Select value={receiptMethod} onValueChange={setReceiptMethod}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
                <Label className="text-foreground">Recorrente</Label>
              </div>
            </>
          )}

          <div>
            <Label className="text-foreground">Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações..." rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={addTransaction.isPending}>
              {addTransaction.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
