import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, TrendingUp, AlertTriangle, Lightbulb, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useFinancialTransactions, normalizeArea } from '@/hooks/useFinancialTransactions';
import { useFinancialDebts } from '@/hooks/useFinancialDebts';
import { usePayments } from '@/hooks/useClients';
import { useInitialBalances } from '@/hooks/useInitialBalances';
import { parseISO, isWithinInterval } from 'date-fns';
import { toast } from 'sonner';

interface FinancialInsightsPanelProps {
  filterStartDate: Date;
  filterEndDate: Date;
}

interface Insight {
  type: 'positive' | 'warning' | 'tip' | 'alert';
  title: string;
  description: string;
}

interface AnalysisResult {
  health_score: number;
  summary: string;
  insights: Insight[];
}

const insightIcons = {
  positive: CheckCircle2,
  warning: AlertTriangle,
  tip: Lightbulb,
  alert: AlertTriangle,
};

const insightColors = {
  positive: 'text-green-400 bg-green-500/10',
  warning: 'text-yellow-400 bg-yellow-500/10',
  tip: 'text-blue-400 bg-blue-500/10',
  alert: 'text-red-400 bg-red-500/10',
};

export function FinancialInsightsPanel({ filterStartDate, filterEndDate }: FinancialInsightsPanelProps) {
  const { data: transactions = [] } = useFinancialTransactions();
  const { data: debts = [] } = useFinancialDebts();
  const { data: athletePayments = [] } = usePayments();
  const { data: initialBalances = [] } = useInitialBalances();

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const financialData = useMemo(() => {
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

    const totalIncome = periodTxns.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0) + athleteIncome;
    const totalExpense = periodTxns.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

    const initialAmount = initialBalances.find(b => b.area === 'geral')?.amount || 0;
    const saldoTotal = Number(initialAmount) + totalIncome - totalExpense;

    const activeDebts = debts.filter(d => d.status === 'ativa');
    const totalDebts = activeDebts.reduce((s, d) => s + Number(d.remaining_amount), 0);

    const expensesByCategory: Record<string, number> = {};
    periodTxns.filter(t => t.type === 'expense').forEach(t => {
      expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + Number(t.amount);
    });

    const recentTransactions = periodTxns.slice(0, 10).map(t => ({
      type: t.type,
      amount: t.amount,
      category: t.category,
      description: t.description,
      date: t.date,
    }));

    return { saldoTotal, totalIncome, totalExpense, resultado: totalIncome - totalExpense, totalDebts, expensesByCategory, recentTransactions };
  }, [transactions, debts, athletePayments, initialBalances, filterStartDate, filterEndDate]);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-finances', {
        body: { financialData },
      });
      if (error) throw error;
      setAnalysis(data);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao analisar');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Insights com IA
          </CardTitle>
          <Button size="sm" variant="outline" onClick={handleAnalyze} disabled={isAnalyzing} className="gap-1.5 text-xs">
            {isAnalyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {analysis ? 'Reanalisar' : 'Analisar'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!analysis && !isAnalyzing && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Clique em "Analisar" para receber insights inteligentes sobre suas finanças.
          </p>
        )}

        {isAnalyzing && (
          <div className="flex flex-col items-center gap-2 py-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Analisando seus dados financeiros...</p>
          </div>
        )}

        {analysis && !isAnalyzing && (
          <div className="space-y-3">
            {/* Score + summary */}
            <div className="flex items-center gap-3 pb-2 border-b border-border">
              <div className={`text-2xl font-bold ${analysis.health_score >= 70 ? 'text-green-400' : analysis.health_score >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                {analysis.health_score}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Score de Saúde</p>
                <p className="text-xs text-foreground">{analysis.summary}</p>
              </div>
            </div>

            {/* Insights */}
            {analysis.insights.map((insight, idx) => {
              const Icon = insightIcons[insight.type];
              const colorClass = insightColors[insight.type];
              return (
                <div key={idx} className="flex gap-2.5">
                  <div className={`p-1.5 rounded-lg shrink-0 ${colorClass}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">{insight.title}</p>
                    <p className="text-[11px] text-muted-foreground">{insight.description}</p>
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
