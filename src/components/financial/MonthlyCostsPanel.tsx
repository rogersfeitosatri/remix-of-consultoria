import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Receipt, Check, X, Pencil, Trash2, Plus } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useExpenses, useUpdateExpense, useDeleteExpense, VirtualExpense, getExpensesForPeriod } from '@/hooks/useExpenses';
import { toast } from 'sonner';

const EXPENSE_CATEGORIES: Record<string, string> = {
  software: 'Software/Assinaturas',
  marketing: 'Marketing',
  equipamentos: 'Equipamentos',
  educacao: 'Cursos/Educação',
  impostos: 'Impostos',
  servicos: 'Serviços',
  geral: 'Geral',
};

interface MonthlyCostsPanelProps {
  filterStartDate: Date;
  filterEndDate: Date;
  onAddNew: () => void;
}

export function MonthlyCostsPanel({ filterStartDate, filterEndDate, onAddNew }: MonthlyCostsPanelProps) {
  const { data: expenses = [] } = useExpenses();
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [tab, setTab] = useState('all');

  const displayExpenses = useMemo(() => 
    getExpensesForPeriod(expenses, filterStartDate, filterEndDate),
    [expenses, filterStartDate, filterEndDate]
  );

  const fixedExpenses = displayExpenses.filter(e => e.expense_type === 'subscription');
  const variableExpenses = displayExpenses.filter(e => e.expense_type === 'single');

  const totalFixed = fixedExpenses.reduce((s, e) => s + e.amount, 0);
  const totalVariable = variableExpenses.reduce((s, e) => s + e.amount, 0);
  const totalAll = totalFixed + totalVariable;

  const paidFixed = fixedExpenses.filter(e => e.status === 'paid').reduce((s, e) => s + e.amount, 0);
  const paidVariable = variableExpenses.filter(e => e.status === 'paid').reduce((s, e) => s + e.amount, 0);

  const today = new Date();

  const handleTogglePaid = async (expense: VirtualExpense) => {
    const originalId = expense.original_id || expense.id;
    try {
      if (expense.status === 'paid') {
        await updateExpense.mutateAsync({ id: originalId, status: 'pending', paid_at: null });
        toast.success('Marcado como pendente');
      } else {
        await updateExpense.mutateAsync({ id: originalId, status: 'paid', paid_at: new Date().toISOString() });
        toast.success('Pago!');
      }
    } catch { toast.error('Erro ao atualizar'); }
  };

  const handleDelete = async (expense: VirtualExpense) => {
    const originalId = expense.original_id || expense.id;
    if (deletingId === originalId) return;
    setDeletingId(originalId);
    try {
      await deleteExpense.mutateAsync(originalId);
      toast.success('Removido');
    } catch { toast.error('Erro'); } finally { setDeletingId(null); }
  };

  const getExpenseList = () => {
    if (tab === 'fixed') return fixedExpenses;
    if (tab === 'variable') return variableExpenses;
    return displayExpenses;
  };

  const renderExpense = (expense: VirtualExpense) => {
    const dueDate = parseISO(expense.due_date);
    const daysUntilDue = differenceInDays(dueDate, today);
    const isOverdue = daysUntilDue < 0 && expense.status !== 'paid';
    const isUrgent = daysUntilDue >= 0 && daysUntilDue <= 7 && expense.status !== 'paid';
    const categoryLabel = EXPENSE_CATEGORIES[expense.category] || expense.category;
    const isSubscription = expense.expense_type === 'subscription';
    const isDeleting = deletingId === (expense.original_id || expense.id);

    return (
      <div
        key={expense.id}
        className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
          expense.status === 'paid'
            ? 'bg-muted/50 border-muted'
            : isOverdue
              ? 'bg-destructive/10 border-destructive/30'
              : isUrgent
                ? 'bg-yellow-500/10 border-yellow-500/30'
                : 'bg-muted/30 border-border'
        }`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-medium text-sm ${expense.status === 'paid' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
              {expense.description}
            </span>
            {isSubscription && (
              <Badge variant="secondary" className="text-[10px] gap-0.5 px-1.5 py-0">
                <RefreshCw className="h-2.5 w-2.5" /> Fixo
              </Badge>
            )}
            {!isSubscription && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-orange-400 border-orange-500/30">
                Variável
              </Badge>
            )}
            {expense.status === 'paid' && (
              <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-[10px] px-1.5 py-0">Pago</Badge>
            )}
            {isOverdue && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Atrasado</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {format(dueDate, "dd 'de' MMM", { locale: ptBR })} • {categoryLabel} • R$ {expense.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            size="icon" variant="ghost"
            className={`h-7 w-7 ${expense.status === 'paid' ? 'text-green-500' : 'text-muted-foreground hover:text-green-500'}`}
            onClick={() => handleTogglePaid(expense)}
          >
            {expense.status === 'paid' ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
          </Button>
          <Button
            size="icon" variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => handleDelete(expense)}
            disabled={isDeleting}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  };

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-foreground text-lg flex items-center gap-2">
            <Receipt className="h-5 w-5" /> Custos do Mês
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Total: {fmt(totalAll)} • Fixos: {fmt(totalFixed)} • Variáveis: {fmt(totalVariable)}
          </p>
        </div>
        <Button size="sm" className="gap-1" onClick={onAddNew}>
          <Plus className="h-4 w-4" /> Nova
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={setTab} className="mb-3">
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1 text-xs">
              Todos ({displayExpenses.length})
            </TabsTrigger>
            <TabsTrigger value="fixed" className="flex-1 text-xs">
              Fixos ({fixedExpenses.length}) • {fmt(totalFixed)}
            </TabsTrigger>
            <TabsTrigger value="variable" className="flex-1 text-xs">
              Variáveis ({variableExpenses.length}) • {fmt(totalVariable)}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Summary badges */}
        <div className="flex gap-2 mb-3 flex-wrap">
          <Badge variant="outline" className="text-xs text-green-400 border-green-500/30">
            Pago: {fmt(paidFixed + paidVariable)}
          </Badge>
          <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-500/30">
            Pendente: {fmt(totalAll - paidFixed - paidVariable)}
          </Badge>
        </div>

        {getExpenseList().length === 0 ? (
          <p className="text-center text-muted-foreground py-6 text-sm">
            Nenhuma despesa {tab === 'fixed' ? 'fixa' : tab === 'variable' ? 'variável' : ''} no período
          </p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {getExpenseList().map(renderExpense)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}