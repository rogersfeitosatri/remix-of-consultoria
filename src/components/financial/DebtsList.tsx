import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Plus, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useFinancialDebts, useUpdateDebt, useDeleteDebt } from '@/hooks/useFinancialDebts';
import { normalizeArea } from '@/hooks/useFinancialTransactions';
import { AddDebtDialog } from './AddDebtDialog';
import { toast } from 'sonner';

const PRIORITY_COLORS: Record<string, string> = {
  alta: 'bg-red-500/20 text-red-400 border-red-500/30',
  media: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  baixa: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const PRIORITY_LABELS: Record<string, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};

export function DebtsList() {
  const { data: debts = [], isLoading } = useFinancialDebts();
  const updateDebt = useUpdateDebt();
  const deleteDebt = useDeleteDebt();
  const [showAdd, setShowAdd] = useState(false);

  const activeDebts = debts.filter(d => d.status === 'ativa');
  const settledDebts = debts.filter(d => d.status === 'quitada');

  const totalRemaining = activeDebts.reduce((s, d) => s + Number(d.remaining_amount), 0);
  const totalPessoal = activeDebts.filter(d => normalizeArea(d.area) === 'pessoal').reduce((s, d) => s + Number(d.remaining_amount), 0);
  const totalEmpresa = activeDebts.filter(d => normalizeArea(d.area) === 'empresa').reduce((s, d) => s + Number(d.remaining_amount), 0);

  const handleSettle = async (id: string) => {
    try {
      await updateDebt.mutateAsync({ id, status: 'quitada', remaining_amount: 0 });
      toast.success('Dívida quitada!');
    } catch { toast.error('Erro'); }
  };

  const handleReactivate = async (id: string) => {
    try {
      await updateDebt.mutateAsync({ id, status: 'ativa' });
      toast.success('Dívida reativada');
    } catch { toast.error('Erro'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDebt.mutateAsync(id);
      toast.success('Dívida removida');
    } catch { toast.error('Erro'); }
  };

  if (isLoading) {
    return <Card><CardContent className="p-6"><div className="animate-pulse space-y-2"><div className="h-10 bg-muted rounded" /><div className="h-10 bg-muted rounded" /></div></CardContent></Card>;
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-foreground text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" /> Dívidas
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Total restante: R$ {totalRemaining.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              {' • '}PF: R$ {totalPessoal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              {' • '}Empresa: R$ {totalEmpresa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <Button size="sm" className="gap-1" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" /> Nova
          </Button>
        </CardHeader>
        <CardContent>
          {activeDebts.length === 0 && settledDebts.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhuma dívida registrada</p>
          ) : (
            <div className="space-y-3">
              {activeDebts.map((d) => {
                const paidPercent = ((Number(d.total_amount) - Number(d.remaining_amount)) / Number(d.total_amount)) * 100;
                return (
                  <div key={d.id} className="p-3 rounded-lg bg-muted/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-foreground truncate">{d.name}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {normalizeArea(d.area) === 'empresa' ? 'Empresa' : 'PF'}
                        </Badge>
                        <Badge className={`text-[10px] px-1.5 py-0 ${PRIORITY_COLORS[d.priority]}`}>
                          {PRIORITY_LABELS[d.priority]}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-green-500 hover:text-green-400" onClick={() => handleSettle(d.id)} title="Quitar">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(d.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Restante: R$ {Number(d.remaining_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / R$ {Number(d.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      {d.has_due_date && d.due_date && <span>Venc: {format(parseISO(d.due_date), 'dd/MM/yyyy')}</span>}
                    </div>
                    <Progress value={paidPercent} className="h-1.5" />
                  </div>
                );
              })}

              {settledDebts.length > 0 && (
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2">Quitadas ({settledDebts.length})</p>
                  {settledDebts.slice(0, 3).map((d) => (
                    <div key={d.id} className="flex items-center justify-between p-2 rounded opacity-60">
                      <span className="text-sm text-foreground line-through">{d.name}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">R$ {Number(d.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => handleReactivate(d.id)} title="Reativar">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AddDebtDialog open={showAdd} onOpenChange={setShowAdd} />
    </>
  );
}
