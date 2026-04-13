import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Wallet, AlertTriangle, Settings2, Loader2, Target } from 'lucide-react';
import { useFinancialTransactions, normalizeArea } from '@/hooks/useFinancialTransactions';
import { useFinancialDebts } from '@/hooks/useFinancialDebts';
import { usePayments } from '@/hooks/useClients';
import { useExpenses, getExpensesForPeriod } from '@/hooks/useExpenses';
import { useInitialBalances, useUpsertInitialBalance } from '@/hooks/useInitialBalances';
import { parseISO, isWithinInterval } from 'date-fns';
import { toast } from 'sonner';

interface FinancialOverviewProps {
  filterStartDate: Date;
  filterEndDate: Date;
}

export function FinancialOverview({ filterStartDate, filterEndDate }: FinancialOverviewProps) {
  const { data: transactions = [] } = useFinancialTransactions();
  const { data: debts = [] } = useFinancialDebts();
  const { data: athletePayments = [] } = usePayments();
  const { data: expenses = [] } = useExpenses();
  const { data: initialBalances = [] } = useInitialBalances();
  const upsertBalance = useUpsertInitialBalance();

  const [showBalanceDialog, setShowBalanceDialog] = useState(false);
  const [balanceInput, setBalanceInput] = useState('');
  const [goalInput, setGoalInput] = useState('');

  const initialAmount = useMemo(() => {
    const geral = initialBalances.find(b => b.area === 'geral');
    return geral ? Number(geral.amount) : 0;
  }, [initialBalances]);

  const monthlyGoal = useMemo(() => {
    const geral = initialBalances.find(b => b.area === 'geral');
    return geral ? Number((geral as any).monthly_cost_goal || 0) : 0;
  }, [initialBalances]);

  const stats = useMemo(() => {
    const periodTxns = transactions.filter(t => {
      const d = parseISO(t.date);
      return isWithinInterval(d, { start: filterStartDate, end: filterEndDate });
    });

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

    const saldoPeriodo = (incomePF + incomeEmpresa) - (expensePF + expenseEmpresa);
    const saldoTotal = initialAmount + saldoPeriodo;

    const totalIncome = incomePF + incomeEmpresa;
    const totalExpense = expensePF + expenseEmpresa;
    const resultado = totalIncome - totalExpense;

    // Calculate fixed and variable costs from expenses
    const periodExpenses = getExpensesForPeriod(expenses, filterStartDate, filterEndDate);
    const fixedCosts = periodExpenses.filter(e => e.expense_type === 'subscription').reduce((s, e) => s + e.amount, 0);
    const variableCosts = periodExpenses.filter(e => e.expense_type === 'single').reduce((s, e) => s + e.amount, 0);
    const totalCosts = fixedCosts + variableCosts;

    const activeDebts = debts.filter(d => d.status === 'ativa');
    const totalDebts = activeDebts.reduce((s, d) => s + Number(d.remaining_amount), 0);

    let health: 'positive' | 'neutral' | 'negative' = 'neutral';
    if (saldoTotal > 0 && totalExpense <= totalIncome * 0.8) health = 'positive';
    else if (saldoTotal < 0 || totalExpense > totalIncome) health = 'negative';

    return { saldoTotal, totalIncome, totalExpense, resultado, totalDebts, health, fixedCosts, variableCosts, totalCosts };
  }, [transactions, debts, athletePayments, expenses, initialAmount, filterStartDate, filterEndDate]);

  const healthConfig = {
    positive: { label: 'Saudável', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: TrendingUp },
    neutral: { label: 'Atenção', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: AlertTriangle },
    negative: { label: 'Crítico', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: TrendingDown },
  };

  const hc = healthConfig[stats.health];
  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  // Goal progress: how much of the monthly income covers the goal
  const goalProgress = monthlyGoal > 0 ? Math.min((stats.totalIncome / monthlyGoal) * 100, 100) : 0;
  const goalRemaining = monthlyGoal > 0 ? Math.max(monthlyGoal - stats.totalIncome, 0) : 0;
  const goalReached = monthlyGoal > 0 && stats.totalIncome >= monthlyGoal;

  const handleSaveBalance = async () => {
    try {
      await upsertBalance.mutateAsync({ 
        area: 'geral', 
        amount: parseFloat(balanceInput) || 0, 
        notes: 'Saldo inicial',
        monthly_cost_goal: parseFloat(goalInput) || 0,
      });
      toast.success('Configurações atualizadas!');
      setShowBalanceDialog(false);
    } catch { toast.error('Erro ao atualizar'); }
  };

  return (
    <div className="space-y-4">
      {/* Health + balance edit */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Badge className={`${hc.color} gap-1 px-3 py-1`}>
          <hc.icon className="h-3.5 w-3.5" />
          Saúde Financeira: {hc.label}
        </Badge>
        <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" onClick={() => { setBalanceInput(initialAmount.toString()); setGoalInput(monthlyGoal.toString()); setShowBalanceDialog(true); }}>
          <Settings2 className="h-3.5 w-3.5" /> Configurações
        </Button>
      </div>

      {/* Main stat: Saldo atual */}
      <Card className="border-primary/30">
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/20"><Wallet className="h-6 w-6 text-primary" /></div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Saldo Atual em Caixa</p>
              <p className={`text-2xl font-bold ${stats.saldoTotal >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(stats.saldoTotal)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Base: {fmt(initialAmount)} + resultado do período</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Goal Progress */}
      {monthlyGoal > 0 && (
        <Card className={`border ${goalReached ? 'border-green-500/30' : 'border-yellow-500/30'}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-lg ${goalReached ? 'bg-green-500/20' : 'bg-yellow-500/20'}`}>
                <Target className={`h-5 w-5 ${goalReached ? 'text-green-400' : 'text-yellow-400'}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">Meta Mensal de Custos</p>
                  <Badge variant="outline" className={`text-xs ${goalReached ? 'text-green-400 border-green-500/30' : 'text-yellow-400 border-yellow-500/30'}`}>
                    {goalReached ? '✓ Meta atingida!' : `Falta ${fmt(goalRemaining)}`}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Entradas: {fmt(stats.totalIncome)} / Meta: {fmt(monthlyGoal)}
                </p>
              </div>
            </div>
            <Progress 
              value={goalProgress} 
              className="h-2.5" 
            />
            <div className="flex justify-between mt-2 text-[11px] text-muted-foreground">
              <span>{goalProgress.toFixed(0)}% coberto pelas entradas</span>
              {stats.totalIncome > monthlyGoal && (
                <span className="text-green-400">Excedente: {fmt(stats.totalIncome - monthlyGoal)}</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Period stats */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <p className="text-[11px] text-muted-foreground">Entradas Mês</p>
            <p className="text-sm font-semibold text-green-400">{fmt(stats.totalIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[11px] text-muted-foreground">Saídas Mês</p>
            <p className="text-sm font-semibold text-red-400">{fmt(stats.totalExpense)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[11px] text-muted-foreground">Resultado</p>
            <p className={`text-sm font-semibold ${stats.resultado >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(stats.resultado)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[11px] text-muted-foreground">Dívidas Ativas</p>
            <p className="text-sm font-semibold text-foreground">{fmt(stats.totalDebts)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Custos Fixos vs Variáveis */}
      <div className="grid gap-3 grid-cols-2">
        <Card className="border-blue-500/20">
          <CardContent className="p-3">
            <p className="text-[11px] text-blue-400 font-medium">Custos Fixos</p>
            <p className="text-sm font-semibold text-foreground">{fmt(stats.fixedCosts)}</p>
            <p className="text-[10px] text-muted-foreground">Assinaturas/recorrentes</p>
          </CardContent>
        </Card>
        <Card className="border-orange-500/20">
          <CardContent className="p-3">
            <p className="text-[11px] text-orange-400 font-medium">Custos Variáveis</p>
            <p className="text-sm font-semibold text-foreground">{fmt(stats.variableCosts)}</p>
            <p className="text-[10px] text-muted-foreground">Despesas únicas</p>
          </CardContent>
        </Card>
      </div>

      {/* Balance + Goal edit dialog */}
      <Dialog open={showBalanceDialog} onOpenChange={setShowBalanceDialog}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader><DialogTitle className="text-foreground">Configurações Financeiras</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-foreground">Saldo inicial em caixa (R$)</Label>
              <Input type="number" step="0.01" value={balanceInput} onChange={(e) => setBalanceInput(e.target.value)} />
              <p className="text-[11px] text-muted-foreground mt-1">Saldo base antes das movimentações</p>
            </div>
            <div>
              <Label className="text-foreground">Meta mensal de custos (R$)</Label>
              <Input type="number" step="0.01" value={goalInput} onChange={(e) => setGoalInput(e.target.value)} placeholder="Ex: 5000" />
              <p className="text-[11px] text-muted-foreground mt-1">Quanto você precisa faturar para cobrir os custos do mês</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowBalanceDialog(false)}>Cancelar</Button>
              <Button onClick={handleSaveBalance} disabled={upsertBalance.isPending}>
                {upsertBalance.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}