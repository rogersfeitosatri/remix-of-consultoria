import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, ArrowDownCircle, ArrowUpCircle, Trash2, Filter, ChevronDown, ChevronUp, Eye } from 'lucide-react';
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

interface TransactionItem {
  id: string;
  type: 'expense' | 'income';
  area: 'pessoal' | 'empresa';
  date: string;
  amount: number;
  label: string;
  category: string;
  isAthlete: boolean;
}

interface GroupedTransaction {
  key: string;
  storeName: string;
  date: string;
  totalAmount: number;
  type: 'expense' | 'income';
  area: 'pessoal' | 'empresa';
  category: string;
  items: TransactionItem[];
  isGroup: boolean;
  isAthlete: boolean;
}

// Parse "StoreName - ItemDescription" pattern used by receipt scanner
function parseStoreFromLabel(label: string): { store: string; item: string } | null {
  const match = label.match(/^(.+?)\s*-\s*(.+)$/);
  if (match) return { store: match[1].trim(), item: match[2].trim() };
  return null;
}

export function TransactionsList({ filterStartDate, filterEndDate }: TransactionsListProps) {
  const { data: transactions = [], isLoading } = useFinancialTransactions();
  const { data: athletePayments = [] } = usePayments();
  const deleteTransaction = useDeleteTransaction();
  const [showAdd, setShowAdd] = useState(false);
  const [defaultType, setDefaultType] = useState<'expense' | 'income'>('expense');
  const [areaFilter, setAreaFilter] = useState<'all' | 'pessoal' | 'empresa'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Merge athlete payments as virtual "empresa/income" entries
  const allItems = useMemo(() => {
    const txnItems: TransactionItem[] = transactions.map(t => ({
      id: t.id,
      type: t.type as 'expense' | 'income',
      area: normalizeArea(t.area),
      date: t.date,
      amount: Number(t.amount),
      label: t.description || t.category,
      category: t.category,
      isAthlete: false,
    }));

    const athleteItems: TransactionItem[] = athletePayments
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

  // Group transactions from the same establishment + date
  const groupedTransactions = useMemo(() => {
    const groups = new Map<string, TransactionItem[]>();
    const standalone: TransactionItem[] = [];

    for (const item of filtered) {
      const parsed = parseStoreFromLabel(item.label);
      if (parsed && !item.isAthlete) {
        const groupKey = `${parsed.store}|${item.date}|${item.type}`;
        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
        groups.get(groupKey)!.push(item);
      } else {
        standalone.push(item);
      }
    }

    const result: GroupedTransaction[] = [];

    // Add grouped entries
    for (const [key, items] of groups) {
      if (items.length === 1) {
        // Single item, no need to group
        const item = items[0];
        result.push({
          key: item.id,
          storeName: item.label,
          date: item.date,
          totalAmount: item.amount,
          type: item.type,
          area: item.area,
          category: item.category,
          items: [item],
          isGroup: false,
          isAthlete: false,
        });
      } else {
        const storeName = parseStoreFromLabel(items[0].label)!.store;
        const totalAmount = items.reduce((sum, i) => sum + i.amount, 0);
        // Collect unique categories
        const categories = [...new Set(items.map(i => i.category))];
        result.push({
          key,
          storeName,
          date: items[0].date,
          totalAmount,
          type: items[0].type,
          area: items[0].area,
          category: categories.join(', '),
          items,
          isGroup: true,
          isAthlete: false,
        });
      }
    }

    // Add standalone entries
    for (const item of standalone) {
      result.push({
        key: item.id,
        storeName: item.label,
        date: item.date,
        totalAmount: item.amount,
        type: item.type,
        area: item.area,
        category: item.category,
        items: [item],
        isGroup: false,
        isAthlete: item.isAthlete,
      });
    }

    return result.sort((a, b) => b.date.localeCompare(a.date));
  }, [filtered]);

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

  const handleDeleteGroup = async (items: TransactionItem[]) => {
    try {
      for (const item of items) {
        await deleteTransaction.mutateAsync(item.id);
      }
      toast.success(`${items.length} lançamentos removidos`);
    } catch {
      toast.error('Erro ao remover');
    }
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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

          {groupedTransactions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum lançamento no período</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {groupedTransactions.map((group) => (
                <div key={group.key}>
                  {/* Main row */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-1.5 rounded-full ${group.type === 'income' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                        {group.type === 'income' ? <ArrowDownCircle className="h-4 w-4" /> : <ArrowUpCircle className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{group.storeName}</p>
                        <div className="flex gap-2 items-center flex-wrap">
                          <span className="text-xs text-muted-foreground">{format(parseISO(group.date), 'dd/MM/yyyy')}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {group.area === 'empresa' ? 'Empresa' : 'PF'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{group.category}</span>
                          {group.isGroup && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {group.items.length} itens
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold whitespace-nowrap ${group.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>
                        {group.type === 'income' ? '+' : '-'}R$ {group.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      {group.isGroup && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => toggleGroup(group.key)}
                          title="Ver detalhes"
                        >
                          {expandedGroups.has(group.key) ? <ChevronUp className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                      )}
                      {!group.isAthlete && !group.isGroup && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(group.items[0].id, false)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {!group.isAthlete && group.isGroup && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteGroup(group.items)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Expanded details */}
                  {group.isGroup && expandedGroups.has(group.key) && (
                    <div className="ml-10 mt-1 mb-2 space-y-1 border-l-2 border-border pl-3">
                      {group.items.map((item) => {
                        const parsed = parseStoreFromLabel(item.label);
                        const itemName = parsed ? parsed.item : item.label;
                        return (
                          <div key={item.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/20 text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-foreground truncate">{itemName}</span>
                              <Badge variant="outline" className="text-[9px] px-1 py-0">{item.category}</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`font-medium whitespace-nowrap ${item.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>
                                R$ {item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(item.id, false)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
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
