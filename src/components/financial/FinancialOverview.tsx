import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, TrendingDown, Building2, User, Wallet, AlertTriangle } from 'lucide-react';
import { useFinancialTransactions, normalizeArea } from '@/hooks/useFinancialTransactions';
import { useFinancialDebts } from '@/hooks/useFinancialDebts';
import { usePayments } from '@/hooks/useClients';
import { parseISO, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';

interface FinancialOverviewProps {
  filterStartDate: Date;
  filterEndDate: Date;
}

export function FinancialOverview({ filterStartDate, filterEndDate }: FinancialOverviewProps) {
  const { data: transactions = [] } = useFinancialTransactions();
  const { data: debts = [] } = useFinancialDebts();
  const { data: athletePayments = [] } = usePayments();

  const stats = useMemo(() => {
    const periodTxns = transactions.filter(t => {
      const d = parseISO(t.date);
      return isWithinInterval(d, { start: filterStartDate, end: filterEndDate });
    });

    // Athlete payments (paid) count as Empresa income
    const athleteIncome = athletePayments
      .filter(p => {
        if (p.status !== 'paid' || !p.paid_at) return false;
        const paidDate = parseISO(p.paid_at);
        return isWithinInterval(paidDate, { start: filterStartDate, end: filterEndDate });
      })
      .reduce((s, p) => s + Number(p.amount), 0);

    const incomePF = periodTxns.filter(t => t.type === 'income' && normalizeArea(t.area) === 'pessoal').reduce((s, t) => s + Number(t.amount), 0);
    const incomeEmpresa = periodTxns.filter(t => t.type === 'income' && normalizeArea(t.area) === 'empresa').reduce((s, t) => s + Number(t.amount), 0) + athleteIncome;
    const expensePF = periodTxns.filter(t => t.type === 'expense' && normalizeArea(t.area) === 'pessoal').reduce((s, t) => s + Number(t.amount), 0);
    const expenseEmpresa = periodTxns.filter(t => t.type === 'expense' && normalizeArea(t.area) === 'empresa').reduce((s, t) => s + Number(t.amount), 0);

    const saldoPF = incomePF - expensePF;
    const saldoEmpresa = incomeEmpresa - expenseEmpresa;
    const saldoTotal = saldoPF + saldoEmpresa;

    const totalIncome = incomePF + incomeEmpresa;
    const totalExpense = expensePF + expenseEmpresa;

    const activeDebts = debts.filter(d => d.status === 'ativa');
    const debtPF = activeDebts.filter(d => normalizeArea(d.area) === 'pessoal').reduce((s, d) => s + Number(d.remaining_amount), 0);
    const debtEmpresa = activeDebts.filter(d => normalizeArea(d.area) === 'empresa').reduce((s, d) => s + Number(d.remaining_amount), 0);

    // Health indicator
    let health: 'positive' | 'neutral' | 'negative' = 'neutral';
    if (saldoTotal > 0 && totalExpense < totalIncome * 0.8) health = 'positive';
    else if (saldoTotal < 0 || totalExpense > totalIncome) health = 'negative';

    return { saldoPF, saldoEmpresa, saldoTotal, totalIncome, totalExpense, debtPF, debtEmpresa, health };
  }, [transactions, debts, athletePayments, filterStartDate, filterEndDate]);

  const healthConfig = {
    positive: { label: 'Saudável', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: TrendingUp },
    neutral: { label: 'Atenção', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: AlertTriangle },
    negative: { label: 'Crítico', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: TrendingDown },
  };

  const hc = healthConfig[stats.health];

  const formatCurrency = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-4">
      {/* Health indicator */}
      <div className="flex items-center gap-2">
        <Badge className={`${hc.color} gap-1 px-3 py-1`}>
          <hc.icon className="h-3.5 w-3.5" />
          Saúde Financeira: {hc.label}
        </Badge>
      </div>

      {/* Main stats */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20"><User className="h-4 w-4 text-blue-400" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Saldo Pessoa Física</p>
                <p className={`text-lg font-bold ${stats.saldoPF >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(stats.saldoPF)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20"><Building2 className="h-4 w-4 text-purple-400" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Saldo Empresa</p>
                <p className={`text-lg font-bold ${stats.saldoEmpresa >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(stats.saldoEmpresa)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20"><Wallet className="h-4 w-4 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Saldo Consolidado</p>
                <p className={`text-lg font-bold ${stats.saldoTotal >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(stats.saldoTotal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary stats */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <p className="text-[11px] text-muted-foreground">Entradas</p>
            <p className="text-sm font-semibold text-green-400">{formatCurrency(stats.totalIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[11px] text-muted-foreground">Saídas</p>
            <p className="text-sm font-semibold text-red-400">{formatCurrency(stats.totalExpense)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[11px] text-muted-foreground">Dívidas PF</p>
            <p className="text-sm font-semibold text-foreground">{formatCurrency(stats.debtPF)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[11px] text-muted-foreground">Dívidas Empresa</p>
            <p className="text-sm font-semibold text-foreground">{formatCurrency(stats.debtEmpresa)}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
