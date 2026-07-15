import { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Layers, RefreshCw, CheckCircle2, AlertTriangle, FileUp, X } from 'lucide-react';
import { usePlanPipeline, PIPELINE_WEEKDAYS, WEEKDAY_LABEL } from '@/hooks/usePlanPipeline';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  const fileRef = useRef<HTMLInputElement>(null);
  const [refPdf, setRefPdf] = useState<{ name: string; text: string } | null>(null);
  const [extracting, setExtracting] = useState(false);

  const dayByWeekday: Record<string, any> = {};
  for (const d of days) dayByWeekday[d.weekday] = d;

  const handlePdf = async (file: File | null) => {
    if (!file) { setRefPdf(null); return; }
    setExtracting(true);
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => {
          const result = r.result as string;
          resolve(result.includes(',') ? result.split(',')[1] : result);
        };
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });
      const { data, error } = await supabase.functions.invoke('extract-pdf-text', { body: { pdfBase64: b64 } });
      if (error) throw error;
      if (!data?.text) throw new Error('Não foi possível extrair texto do PDF.');
      setRefPdf({ name: file.name, text: String(data.text) });
      toast.success('PDF de referência carregado — a IA vai considerar essa dieta.');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Erro ao ler o PDF.');
    } finally {
      setExtracting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const startPipeline = () => {
    const guidance: any = {};
    if (refPdf?.text) {
      guidance.reference_diet_text = refPdf.text;
      guidance.reference_diet_source = refPdf.name;
    }
    start.mutate(Object.keys(guidance).length ? guidance : undefined);
  };

  const canStart = !job || job.status === 'completed' || job.status === 'failed';

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

        {canStart && (
          <div className="rounded-lg border border-dashed p-3 space-y-2 bg-muted/20">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1">
                <p className="text-xs font-medium">Considerar uma dieta em PDF como base (opcional)</p>
                <p className="text-[11px] text-muted-foreground">
                  A IA lê o PDF e usa refeições, horários, preferências e alimentos como referência ao montar o plano-base e as variações da semana.
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => handlePdf(e.target.files?.[0] || null)}
              />
              {!refPdf ? (
                <Button size="sm" variant="outline" className="gap-1 shrink-0" onClick={() => fileRef.current?.click()} disabled={extracting}>
                  {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
                  <span className="text-xs">{extracting ? 'Lendo…' : 'Anexar PDF'}</span>
                </Button>
              ) : (
                <Button size="sm" variant="ghost" className="gap-1 shrink-0 text-destructive" onClick={() => setRefPdf(null)}>
                  <X className="h-3.5 w-3.5" /> <span className="text-xs">Remover</span>
                </Button>
              )}
            </div>
            {refPdf && (
              <div className="flex items-center gap-2 rounded bg-primary/5 border border-primary/20 px-2 py-1.5">
                <FileUp className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-xs truncate">{refPdf.name}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">{Math.round(refPdf.text.length / 1000)} k chars</span>
              </div>
            )}
          </div>
        )}

        {canStart ? (
          <Button className="w-full gap-2" onClick={startPipeline} disabled={start.isPending || extracting}>
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
