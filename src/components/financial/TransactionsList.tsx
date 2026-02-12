import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, ArrowDownCircle, ArrowUpCircle, Trash2, Filter } from 'lucide-react';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useFinancialTransactions, useDeleteTransaction, normalizeArea } from '@/hooks/useFinancialTransactions';
import { usePayments } from '@/hooks/useClients';
import { AddTransactionDialog } from './AddTransactionDialog';
import { toast } from 'sonner';

interface TransactionsListProps {
  filterStartDate: Date;
  filterEndDate: Date;
}

export function TransactionsList({ filterStartDate, filterEndDate }: TransactionsListProps) {
  const { data: transactions = [], isLoading } = useFinancialTransactions();
  const { data: athletePayments = [] } = usePayments();
  const deleteTransaction = useDeleteTransaction();
  const [showAdd, setShowAdd] = useState(false);
  const [defaultType, setDefaultType] = useState<'expense' | 'income'>('expense');
  const [areaFilter, setAreaFilter] = useState<'all' | 'pessoal' | 'empresa'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all');

  // Merge athlete payments as virtual "empresa/income" entries
  const allItems = useMemo(() => {
    const txnItems = transactions.map(t => ({
      id: t.id,
      type: t.type as 'expense' | 'income',
      area: normalizeArea(t.area),
      date: t.date,
      amount: Number(t.amount),
      label: t.description || t.category,
      category: t.category,
      isAthlete: false,
    }));

    const athleteItems = athletePayments
      .filter(p => p.status === 'paid' && p.paid_at)
      .map(p => ({
        id: `athlete-${p.id}`,
        type: 'income' as const,
        area: 'empresa' as const,
        date: p.paid_at!.split('T')[0],
        amount: Number(p.amount),
        label: `Atleta: ${p.client_name || 'Pagamento'}`,
        category: 'Atleta',
        isAthlete: true,
      }));

    return [...txnItems, ...athleteItems].sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, athletePayments]);

  const filtered = allItems.filter((t) => {
    const tDate = parseISO(t.date);
    if (!isWithinInterval(tDate, { start: filterStartDate, end: filterEndDate })) return false;
    if (areaFilter !== 'all' && t.area !== areaFilter) return false;
    if (typeFilter !== 'all' && t.type !== typeFilter) return false;
    return true;
  });

  const totalIncome = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const handleDelete = async (id: string, isAthlete: boolean) => {
    if (isAthlete) {
      toast.error('Pagamentos de atletas são gerenciados na aba Atletas');
      return;
    }
    try {
      await deleteTransaction.mutateAsync(id);
      toast.success('Lançamento removido');
    } catch {
      toast.error('Erro ao remover');
    }
  };

  const openAdd = (type: 'expense' | 'income') => {
    setDefaultType(type);
    setShowAdd(true);
  };

  if (isLoading) {
    return <Card><CardContent className="p-6"><div className="animate-pulse space-y-2"><div className="h-10 bg-muted rounded" /><div className="h-10 bg-muted rounded" /></div></CardContent></Card>;
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-foreground text-lg">Lançamentos</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="text-green-500">+R$ {totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              {' / '}
              <span className="text-red-500">-R$ {totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" className="gap-1 text-green-600 border-green-600/30 hover:bg-green-600/10" onClick={() => openAdd('income')}>
              <ArrowDownCircle className="h-4 w-4" /> Entrada
            </Button>
            <Button size="sm" variant="outline" className="gap-1 text-red-600 border-red-600/30 hover:bg-red-600/10" onClick={() => openAdd('expense')}>
              <ArrowUpCircle className="h-4 w-4" /> Gasto
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <Select value={areaFilter} onValueChange={(v: any) => setAreaFilter(v)}>
              <SelectTrigger className="w-[140px]"><Filter className="h-3 w-3 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas áreas</SelectItem>
                <SelectItem value="pessoal">Pessoa Física</SelectItem>
                <SelectItem value="empresa">Empresa</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos tipos</SelectItem>
                <SelectItem value="income">Entradas</SelectItem>
                <SelectItem value="expense">Gastos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum lançamento no período</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {filtered.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-1.5 rounded-full ${t.type === 'income' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                      {t.type === 'income' ? <ArrowDownCircle className="h-4 w-4" /> : <ArrowUpCircle className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{t.label}</p>
                      <div className="flex gap-2 items-center flex-wrap">
                        <span className="text-xs text-muted-foreground">{format(parseISO(t.date), 'dd/MM/yyyy')}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {t.area === 'empresa' ? 'Empresa' : 'PF'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{t.category}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold whitespace-nowrap ${t.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>
                      {t.type === 'income' ? '+' : '-'}R$ {Number(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    {!t.isAthlete && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(t.id, t.isAthlete)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AddTransactionDialog open={showAdd} onOpenChange={setShowAdd} defaultType={defaultType} />
    </>
  );
}
