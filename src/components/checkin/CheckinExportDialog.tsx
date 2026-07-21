// Diálogo para selecionar quais check-ins baixar (todos ou alguns) e gerar o PDF
// com as respostas e os gráficos de evolução.
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Loader2, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { downloadCheckinsPdf } from '@/lib/checkinExport';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  clientName: string;
}

export function CheckinExportDialog({ open, onOpenChange, clientId, clientName }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [includeAnswers, setIncludeAnswers] = useState(true);
  const [includeCharts, setIncludeCharts] = useState(true);
  const [generating, setGenerating] = useState(false);

  const { data: checkins = [], isLoading } = useQuery({
    queryKey: ['checkin-export-list', clientId],
    enabled: open && !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checkin_responses')
        .select('id, form_id, submitted_at, responses, checkin_forms (title)')
        .eq('client_id', clientId)
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Perguntas de todos os formulários envolvidos (para rotular respostas + séries).
  const formIds = useMemo(() => Array.from(new Set((checkins as any[]).map((c) => c.form_id).filter(Boolean))), [checkins]);
  const { data: questions = [] } = useQuery({
    queryKey: ['checkin-export-questions', formIds],
    enabled: open && formIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checkin_questions')
        .select('id, question_text, order_index, form_id')
        .in('form_id', formIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const allSelected = checkins.length > 0 && selected.size === checkins.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set((checkins as any[]).map((c) => c.id)));
  const toggle = (id: string) => setSelected((prev) => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const handleDownload = async () => {
    const chosen = (checkins as any[]).filter((c) => selected.has(c.id));
    if (!chosen.length) { toast.error('Selecione ao menos um check-in.'); return; }
    if (!includeAnswers && !includeCharts) { toast.error('Escolha incluir respostas e/ou gráficos.'); return; }
    setGenerating(true);
    try {
      downloadCheckinsPdf({ clientName, checkins: chosen, questions: questions as any[], includeAnswers, includeCharts });
      toast.success('PDF gerado.');
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Falha ao gerar o PDF: ' + (e?.message || e));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Baixar check-ins — {clientName}</DialogTitle>
          <DialogDescription>Selecione os check-ins e o que incluir no PDF.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-4 rounded-lg border p-2.5 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={includeAnswers} onCheckedChange={(v) => setIncludeAnswers(!!v)} /> Respostas
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={includeCharts} onCheckedChange={(v) => setIncludeCharts(!!v)} /> Gráficos de evolução
            </label>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {selected.size} de {checkins.length} selecionado(s)
            </span>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={toggleAll} disabled={!checkins.length}>
              {allSelected ? 'Limpar seleção' : 'Selecionar todos'}
            </Button>
          </div>

          <div className="max-h-[280px] overflow-y-auto rounded-lg border divide-y">
            {isLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : checkins.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum check-in encontrado.</p>
            ) : (checkins as any[]).map((c) => (
              <label key={c.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent/40">
                <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{format(parseISO(c.submitted_at), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}</p>
                  {c.checkin_forms?.title && <p className="text-[11px] text-muted-foreground truncate">{c.checkin_forms.title}</p>}
                </div>
              </label>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleDownload} disabled={generating || !selected.size} className="gap-2">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Baixar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
