import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Plus, Receipt, Check, Trash2, X, RefreshCw } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useExpenses, useAddExpense, useUpdateExpense, useDeleteExpense, Expense, getExpensesForPeriod } from '@/hooks/useExpenses';
import { toast } from 'sonner';
import { startOfMonth, endOfMonth } from 'date-fns';

const EXPENSE_CATEGORIES = [
  { value: 'software', label: 'Software/Assinaturas' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'equipamentos', label: 'Equipamentos' },
  { value: 'educacao', label: 'Cursos/Educação' },
  { value: 'impostos', label: 'Impostos' },
  { value: 'servicos', label: 'Serviços' },
  { value: 'geral', label: 'Geral' },
];

const DUE_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

interface ExpensesSectionProps {
  filterStartDate?: Date;
  filterEndDate?: Date;
}

export function ExpensesSection({ filterStartDate, filterEndDate }: ExpensesSectionProps) {
  const { data: expenses = [], isLoading } = useExpenses();
  const addExpense = useAddExpense();
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();
  
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    due_date: '',
    due_day: '',
    category: 'geral',
    notes: '',
    expense_type: 'single' as 'single' | 'subscription',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (formData.expense_type === 'single' && !formData.due_date) {
        toast.error('Informe a data de vencimento');
        return;
      }
      if (formData.expense_type === 'subscription' && !formData.due_day) {
        toast.error('Informe o dia do mês para vencimento');
        return;
      }

      await addExpense.mutateAsync({
        description: formData.description,
        amount: parseFloat(formData.amount),
        category: formData.category,
        notes: formData.notes || null,
        status: 'pending',
        expense_type: formData.expense_type,
        due_date: formData.expense_type === 'single' ? formData.due_date : undefined,
        due_day: formData.expense_type === 'subscription' ? parseInt(formData.due_day) : null,
      });
      
      toast.success(formData.expense_type === 'subscription' ? 'Assinatura registrada!' : 'Despesa registrada!');
      setIsOpen(false);
      setFormData({ description: '', amount: '', due_date: '', due_day: '', category: 'geral', notes: '', expense_type: 'single' });
    } catch (error) {
      toast.error('Erro ao registrar despesa');
    }
  };

  const handleTogglePaid = async (expense: Expense) => {
    try {
      if (expense.status === 'paid') {
        await updateExpense.mutateAsync({
          id: expense.id,
          status: 'pending',
          paid_at: null,
        });
        toast.success('Despesa marcada como pendente');
      } else {
        await updateExpense.mutateAsync({
          id: expense.id,
          status: 'paid',
          paid_at: new Date().toISOString(),
        });
        toast.success('Despesa paga!');
      }
    } catch (error) {
      toast.error('Erro ao atualizar despesa');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteExpense.mutateAsync(id);
      toast.success('Despesa removida');
    } catch (error) {
      toast.error('Erro ao remover despesa');
    }
  };

  const today = new Date();
  
  // Use filtered period if provided, otherwise show current month
  const displayStartDate = filterStartDate || startOfMonth(today);
  const displayEndDate = filterEndDate || endOfMonth(today);
  
  // Get expenses for the display period (including virtual subscription entries)
  const displayExpenses = getExpensesForPeriod(expenses, displayStartDate, displayEndDate);
  
  const pendingExpenses = displayExpenses.filter(e => e.status !== 'paid');
  const totalPending = pendingExpenses.reduce((sum, e) => sum + e.amount, 0);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Receipt className="h-5 w-5" />
            Contas a Pagar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-10 bg-muted rounded" />
            <div className="h-10 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Receipt className="h-5 w-5" />
            Contas a Pagar
          </CardTitle>
          {pendingExpenses.length > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {pendingExpenses.length} pendente{pendingExpenses.length > 1 ? 's' : ''} • Total: R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          )}
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
              Nova
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-foreground">Nova Despesa</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Tipo de conta */}
              <div>
                <Label className="text-foreground mb-3 block">Tipo de conta</Label>
                <RadioGroup 
                  value={formData.expense_type} 
                  onValueChange={(value: 'single' | 'subscription') => setFormData({ ...formData, expense_type: value })}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="single" id="single" />
                    <Label htmlFor="single" className="text-foreground cursor-pointer">Conta única do mês</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="subscription" id="subscription" />
                    <Label htmlFor="subscription" className="text-foreground cursor-pointer">Assinatura (recorrente)</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="description" className="text-foreground">Descrição</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={formData.expense_type === 'subscription' ? 'Ex: Netflix, Aluguel, Internet' : 'Ex: Compra de equipamento'}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="amount" className="text-foreground">Valor (R$)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0,00"
                    required
                  />
                </div>
                {formData.expense_type === 'single' ? (
                  <div>
                    <Label htmlFor="due_date" className="text-foreground">Vencimento</Label>
                    <Input
                      id="due_date"
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      required
                    />
                  </div>
                ) : (
                  <div>
                    <Label htmlFor="due_day" className="text-foreground">Dia do mês</Label>
                    <Select 
                      value={formData.due_day} 
                      onValueChange={(value) => setFormData({ ...formData, due_day: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Dia..." />
                      </SelectTrigger>
                      <SelectContent>
                        {DUE_DAYS.map((day) => (
                          <SelectItem key={day} value={day.toString()}>
                            Dia {day}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="category" className="text-foreground">Categoria</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="notes" className="text-foreground">Observações</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Informações adicionais..."
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={addExpense.isPending}>
                  {addExpense.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {displayExpenses.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Nenhuma despesa no período
          </p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {displayExpenses.map((expense) => {
              const dueDate = parseISO(expense.due_date);
              const daysUntilDue = differenceInDays(dueDate, today);
              const isOverdue = daysUntilDue < 0 && expense.status !== 'paid';
              const isUrgent = daysUntilDue >= 0 && daysUntilDue <= 7 && expense.status !== 'paid';
              const categoryLabel = EXPENSE_CATEGORIES.find(c => c.value === expense.category)?.label || expense.category;
              const isSubscription = expense.expense_type === 'subscription';
              // For virtual subscription entries, get the original ID for actions
              const actionId = expense.original_id || expense.id;

              return (
                <div
                  key={expense.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    expense.status === 'paid'
                      ? 'bg-muted/50 border-muted'
                      : isOverdue
                        ? 'bg-destructive/10 border-destructive/30'
                        : isUrgent
                          ? 'bg-yellow-500/10 border-yellow-500/30'
                          : 'bg-muted/30 border-border'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-medium ${expense.status === 'paid' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {expense.description}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {categoryLabel}
                      </Badge>
                      {isSubscription && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <RefreshCw className="h-3 w-3" />
                          Recorrente
                        </Badge>
                      )}
                      {expense.status === 'paid' && (
                        <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                          Pago
                        </Badge>
                      )}
                      {isOverdue && (
                        <Badge variant="destructive">
                          Atrasado
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(dueDate, "dd 'de' MMM", { locale: ptBR })} • R$ {expense.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className={expense.status === 'paid' ? 'text-green-500' : 'text-muted-foreground hover:text-green-500'}
                      onClick={() => handleTogglePaid({ ...expense, id: actionId })}
                    >
                      {expense.status === 'paid' ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                    </Button>
                    {/* Only show delete for original expenses, not virtual entries */}
                    {!expense.is_virtual && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(expense.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
