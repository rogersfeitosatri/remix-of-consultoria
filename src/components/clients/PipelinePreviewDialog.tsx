import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, AlertTriangle, CalendarCheck, Send, CheckCircle2 } from 'lucide-react';
import { format, parseISO, isBefore, startOfDay, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

interface PipelinePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with whether the 1st consultation has already been done (retroactive). */
  onConfirm: (opts: { firstConsultAlreadyDone: boolean }) => void;
  startDate?: string;
  endDate?: string;
  consultationCount?: number;
  consultationFrequency?: string | null;
  hasConsultations?: boolean;
  athleteName?: string;
}

interface PipelineRow {
  sequence_index: number;
  scheduled_date: string;
  send_link_date: string;
  exceeds_end_date: boolean;
}

export function PipelinePreviewDialog({
  open,
  onOpenChange,
  onConfirm,
  startDate,
  endDate,
  consultationCount,
  consultationFrequency,
  hasConsultations,
  athleteName,
}: PipelinePreviewDialogProps) {
  const [rows, setRows] = useState<PipelineRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // null = not yet answered (only matters when start_date is in the past)
  const [firstAlreadyDone, setFirstAlreadyDone] = useState<boolean | null>(null);

  // Detect retroactive 1st consultation
  const isStartInPast = !!startDate && isBefore(parseISO(startDate), startOfDay(new Date()));
  const startDow = startDate ? getDay(parseISO(startDate)) : null;
  const startsOnWeekend = startDow === 0 || startDow === 6;

  useEffect(() => {
    if (!open) {
      setFirstAlreadyDone(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !hasConsultations || !startDate) {
      setRows([]);
      return;
    }

    const fetchPreview = async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase.rpc('preview_consultation_pipeline', {
        p_start_date: startDate,
        p_consultation_count: consultationCount ?? 0,
        p_consultation_frequency: consultationFrequency ?? 'monthly',
        p_end_date: endDate || null,
      });
      if (error) {
        setError(error.message);
      } else {
        setRows((data as PipelineRow[]) || []);
      }
      setLoading(false);
    };

    fetchPreview();
  }, [open, startDate, endDate, consultationCount, consultationFrequency, hasConsultations]);

  const fmt = (d: string) => {
    try {
      return format(parseISO(d), "dd 'de' MMM (EEE)", { locale: ptBR });
    } catch {
      return d;
    }
  };

  const exceededCount = rows.filter((r) => r.exceeds_end_date).length;

  // Block confirmation until the retroactive question is answered
  const requiresAnswer = hasConsultations && isStartInPast && firstAlreadyDone === null;

  const handleConfirm = () => {
    onConfirm({ firstConsultAlreadyDone: !!firstAlreadyDone });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" />
            Prévia da Pipeline de Consultas
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                Confirme as datas projetadas para{' '}
                <strong>{athleteName || 'o atleta'}</strong> antes de salvar.
              </p>
              {!hasConsultations && (
                <p className="text-muted-foreground text-sm">
                  Este plano não inclui consultas — apenas check-ins/acompanhamento.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {hasConsultations && (
          <div className="my-2 space-y-3">
            {/* Retroactive 1st consultation question */}
            {isStartInPast && (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
                <div className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>A 1ª consulta está no passado</strong> ({startDate ? fmt(startDate) : '—'}).
                    <p className="text-muted-foreground text-xs mt-0.5">
                      A 1ª consulta já aconteceu? Se sim, ela será marcada como realizada e o envio dos próximos links começará a partir da 2ª.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setFirstAlreadyDone(true)}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm transition ${
                      firstAlreadyDone === true
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 font-medium'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    <CheckCircle2 className="inline h-3.5 w-3.5 mr-1" />
                    Sim, já realizada
                  </button>
                  <button
                    type="button"
                    onClick={() => setFirstAlreadyDone(false)}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm transition ${
                      firstAlreadyDone === false
                        ? 'border-amber-500 bg-amber-500/10 text-amber-700 font-medium'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    Não, ainda vai acontecer
                  </button>
                </div>
              </div>
            )}

            {startsOnWeekend && (
              <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-2.5 text-xs text-muted-foreground">
                ℹ️ A 1ª consulta cai em um fim de semana. A data do registro fica como você escolheu — os envios de link vão automaticamente para a segunda-feira mais próxima conforme a periodicidade.
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Calculando prévia...
              </div>
            ) : error ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                Erro ao carregar prévia: {error}
              </div>
            ) : rows.length === 0 ? (
              <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                Nenhuma consulta projetada com os parâmetros atuais.
              </div>
            ) : (
              <>
                {exceededCount > 0 && (
                  <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>{exceededCount}</strong>{' '}
                      {exceededCount === 1 ? 'consulta ultrapassa' : 'consultas ultrapassam'} a
                      vigência do plano ({endDate ? fmt(endDate) : '—'}). Ajuste a data final ou
                      a cadência se desejar.
                    </div>
                  </div>
                )}
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2 font-medium w-12">#</th>
                        <th className="text-left p-2 font-medium">
                          <CalendarCheck className="inline h-3 w-3 mr-1" />
                          Consulta
                        </th>
                        <th className="text-left p-2 font-medium">
                          <Send className="inline h-3 w-3 mr-1" />
                          Envio do link
                        </th>
                        <th className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const isRetroFirst = r.sequence_index === 1 && firstAlreadyDone === true;
                        return (
                          <tr
                            key={r.sequence_index}
                            className={`border-t ${
                              r.exceeds_end_date ? 'bg-amber-500/5' : ''
                            } ${isRetroFirst ? 'opacity-60' : ''}`}
                          >
                            <td className="p-2 text-muted-foreground">{r.sequence_index}</td>
                            <td className="p-2">{fmt(r.scheduled_date)}</td>
                            <td className="p-2 text-muted-foreground">
                              {isRetroFirst ? (
                                <span className="line-through">{fmt(r.send_link_date)}</span>
                              ) : (
                                fmt(r.send_link_date)
                              )}
                            </td>
                            <td className="p-2">
                              {isRetroFirst && (
                                <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">
                                  Já realizada
                                </Badge>
                              )}
                              {!isRetroFirst && r.exceeds_end_date && (
                                <Badge variant="outline" className="border-amber-500 text-amber-600">
                                  Fora da vigência
                                </Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  As datas de envio caem na segunda-feira da semana anterior à consulta. Após
                  salvar, esta pipeline será criada automaticamente.
                </p>
              </>
            )}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Voltar e ajustar</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={loading || requiresAnswer}>
            {requiresAnswer ? 'Responda acima para continuar' : 'Confirmar e salvar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
