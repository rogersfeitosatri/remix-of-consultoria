import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Layers, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { usePlanPipeline, PIPELINE_WEEKDAYS, WEEKDAY_LABEL } from '@/hooks/usePlanPipeline';

const STAGE_LABEL: Record<string, string> = {
  queued: 'Na fila',
  generating_blueprint: 'Criando estratégia semanal…',
  generating_days: 'Gerando cada dia…',
  validating: 'Validando…',
  completed: 'Concluído',
  partially_failed: 'Concluído com pendências',
  failed: 'Falhou',
};

const dayColor = (s: string) =>
  s === 'completed' ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
    : s === 'correction_required' ? 'bg-amber-500/15 text-amber-600 border-amber-500/30'
    : s === 'failed' ? 'bg-red-500/15 text-red-600 border-red-500/30'
    : s === 'generating' || s === 'validating' ? 'bg-primary/15 text-primary border-primary/30'
    : 'bg-muted text-muted-foreground border-border';

export function PlanPipelinePanel({ clientId, onDone }: { clientId: string; onDone?: () => void }) {
  const { job, days, isActive, completed, failed, start, retryDay } = usePlanPipeline(clientId);

  const dayByWeekday: Record<string, any> = {};
  for (const d of days) dayByWeekday[d.weekday] = d;

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" /> Gerar em etapas (beta)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Geração persistente e resumível: estratégia semanal → um dia por vez → validação dos macros pelo banco de alimentos. Não trava por tempo e pode continuar após recarregar a página.
        </p>

        {!job || job.status === 'completed' || job.status === 'failed' ? (
          <Button className="w-full gap-2" onClick={() => start.mutate(undefined)} disabled={start.isPending}>
            {start.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
            {job?.status === 'completed' ? 'Gerar novamente em etapas' : 'Iniciar geração em etapas'}
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              {isActive && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              {job.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
              {job.status === 'partially_failed' && <AlertTriangle className="h-4 w-4 text-amber-500" />}
              <span className="font-medium">{job.current_stage || STAGE_LABEL[job.status] || job.status}</span>
              <span className="text-muted-foreground text-xs ml-auto">{completed}/7 dias</span>
            </div>

            {days.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {PIPELINE_WEEKDAYS.map((wd) => {
                  const d = dayByWeekday[wd];
                  const st = d?.status || 'pending';
                  return (
                    <button
                      key={wd}
                      disabled={st !== 'failed'}
                      onClick={() => retryDay(wd)}
                      title={d?.error || d?.validation_result?.issues?.join('\n') || st}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${dayColor(st)} ${st === 'failed' ? 'cursor-pointer hover:opacity-80' : ''}`}
                    >
                      {WEEKDAY_LABEL[wd]}
                      {(st === 'generating' || st === 'validating') && ' …'}
                      {st === 'completed' && ' ✓'}
                      {st === 'correction_required' && ' !'}
                      {st === 'failed' && ' ↻'}
                    </button>
                  );
                })}
              </div>
            )}

            {failed.length > 0 && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-2">
                <span className="text-xs text-red-600">{failed.length} dia(s) com erro. Toque no dia para repetir só ele.</span>
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => failed.forEach((d) => retryDay(d.weekday))}>
                  <RefreshCw className="h-3 w-3" /> Repetir com erro
                </Button>
              </div>
            )}

            {job.status === 'partially_failed' && (
              <p className="text-xs text-amber-600">Plano montado, mas alguns dias precisam de ajuste seu (marcados com “!”). Você já pode revisar/editar abaixo.</p>
            )}
            {(job.status === 'completed' || job.status === 'partially_failed') && (
              <Button variant="outline" size="sm" className="w-full" onClick={onDone}>Ver plano gerado</Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
