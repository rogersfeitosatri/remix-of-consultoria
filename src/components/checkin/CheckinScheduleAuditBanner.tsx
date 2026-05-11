import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, ChevronDown, ChevronRight, Loader2, Settings2, Wrench } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface AuditResult {
  client_id: string;
  client_name: string;
  configured_frequency: string;
  expected_interval_days: number;
  last_sent_date: string | null;
  next_scheduled_date: string | null;
  expected_next_date: string | null;
  interval_discrepancy_days: number;
  errors: string[];
  future_dates_wrong: number;
  status: 'ok' | 'warning' | 'error';
}

const FREQ_LABELS: Record<string, string> = {
  daily: 'Diária',
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  three_weeks: 'A cada 3 semanas',
  monthly: 'Mensal',
  bimonthly: 'Bimestral',
  quarterly: 'Trimestral',
};

function fmt(d: string | null) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
}

export function CheckinScheduleAuditBanner() {
  const [results, setResults] = useState<AuditResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState<string | 'all' | null>(null);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const runAudit = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('audit-checkin-schedules', { body: {} });
      if (error) throw error;
      setResults(data?.results ?? []);
      if ((data?.results ?? []).length > 0) setOpen(true);
    } catch (e: any) {
      toast({ title: 'Falha na auditoria', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runFix = async (clientId?: string) => {
    setFixing(clientId ?? 'all');
    try {
      const body = clientId ? { client_ids: [clientId] } : { fix_all: true };
      const { data, error } = await supabase.functions.invoke('fix-checkin-schedules', { body });
      if (error) throw error;
      const logs = data?.logs ?? [];
      const totalDeleted = logs.reduce((a: number, l: any) => a + (l.deleted_future || 0), 0);
      const totalInserted = logs.reduce((a: number, l: any) => a + (l.inserted_future || 0), 0);
      const totalOverdue = logs.reduce((a: number, l: any) => a + (l.marked_overdue || 0), 0);
      toast({
        title: 'Correção concluída',
        description: `${logs.length} atleta(s): ${totalDeleted} datas removidas, ${totalInserted} recriadas, ${totalOverdue} marcadas como atrasadas. Nenhum WhatsApp enviado.`,
      });
      qc.invalidateQueries({ queryKey: ['scheduled_checkins'] });
      await runAudit();
    } catch (e: any) {
      toast({ title: 'Falha na correção', description: e.message, variant: 'destructive' });
    } finally {
      setFixing(null);
    }
  };

  if (loading && results.length === 0) return null;
  if (!loading && results.length === 0) return null;

  const errors = results.filter(r => r.status === 'error');
  const warnings = results.filter(r => r.status === 'warning');

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/5">
        <div className="flex items-center justify-between p-3 gap-2 flex-wrap">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 cursor-pointer flex-1 min-w-0 text-left">
              <Settings2 className="h-5 w-5 text-amber-600 shrink-0" />
              <span className="font-medium text-sm">Inconsistências detectadas no agendamento</span>
              {errors.length > 0 && (
                <Badge variant="destructive" className="text-[10px]">{errors.length} erro{errors.length !== 1 ? 's' : ''}</Badge>
              )}
              {warnings.length > 0 && (
                <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-700">{warnings.length} aviso{warnings.length !== 1 ? 's' : ''}</Badge>
              )}
              {open ? <ChevronDown className="h-4 w-4 ml-auto" /> : <ChevronRight className="h-4 w-4 ml-auto" />}
            </button>
          </CollapsibleTrigger>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={runAudit} disabled={loading}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Auditar agora'}
            </Button>
            <Button size="sm" onClick={() => runFix()} disabled={fixing !== null}>
              {fixing === 'all' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wrench className="h-3 w-3 mr-1" />}
              Corrigir todos
            </Button>
          </div>
        </div>
        <CollapsibleContent>
          <div className="border-t border-amber-500/30 divide-y divide-amber-500/20 max-h-[420px] overflow-y-auto">
            {results.map((r) => (
              <div key={r.client_id} className="p-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {r.status === 'error' ? (
                      <span className="text-destructive text-xs font-bold">🔴 ERRO</span>
                    ) : (
                      <span className="text-amber-700 text-xs font-bold">🟡 AVISO</span>
                    )}
                    <span className="font-medium text-sm">{r.client_name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Configurado: <strong>{FREQ_LABELS[r.configured_frequency] || r.configured_frequency}</strong> ({r.expected_interval_days} dias)
                    {' · '}Último envio: {fmt(r.last_sent_date)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Próximo programado: <strong>{fmt(r.next_scheduled_date)}</strong>
                    {r.expected_next_date && (
                      <> {' '}— deveria ser <strong>{fmt(r.expected_next_date)}</strong></>
                    )}
                    {r.future_dates_wrong > 0 && (
                      <> · {r.future_dates_wrong} datas futuras incorretas</>
                    )}
                  </p>
                  {r.errors.map((err, i) => (
                    <p key={i} className="text-[11px] text-destructive">• {err}</p>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => runFix(r.client_id)}
                  disabled={fixing !== null}
                >
                  {fixing === r.client_id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Corrigir este'}
                </Button>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
