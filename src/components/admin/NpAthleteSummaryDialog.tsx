import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles, Send, Save } from 'lucide-react';
import {
  useEvolutionSummaries,
  useGenerateEvolutionSummary,
  useUpdateAthleteSummary,
  useSendAthleteSummaryWhatsapp,
  type EvolutionSummary,
} from '@/hooks/useNutriPeriodizaSummary';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NpAthleteSummaryDialog({ clientId, open, onOpenChange }: Props) {
  const { data: summaries = [], isLoading } = useEvolutionSummaries(clientId, 'athlete');
  const generate = useGenerateEvolutionSummary(clientId);
  const update = useUpdateAthleteSummary(clientId);
  const send = useSendAthleteSummaryWhatsapp(clientId);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const active: EvolutionSummary | undefined = summaries.find((s) => s.id === activeId) || summaries[0];

  useEffect(() => {
    if (active) {
      setActiveId(active.id);
      setDraft(active.edited_content ?? active.summary_markdown ?? '');
    } else {
      setDraft('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  const handleGenerate = () => {
    generate.mutate('athlete', {
      onSuccess: (s) => {
        setActiveId(s.id);
        setDraft(s.summary_markdown);
      },
    });
  };

  const handleSave = () => {
    if (!active) return;
    update.mutate({ id: active.id, edited_content: draft });
  };

  const handleSend = () => {
    if (!active) return;
    send.mutate({ id: active.id, content: draft });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Resumo para o atleta (Versão motivacional)
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant={active ? 'outline' : 'default'}
              onClick={handleGenerate}
              disabled={generate.isPending}
            >
              {generate.isPending ? (
                <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Gerando…</>
              ) : (
                <><Sparkles className="h-3 w-3 mr-1" /> {active ? 'Gerar nova versão' : 'Gerar resumo'}</>
              )}
            </Button>
            {active && (
              <>
                <Badge variant="outline">
                  {format(parseISO(active.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </Badge>
                {active.whatsapp_sent_at && (
                  <Badge variant="secondary">
                    Enviado em {format(parseISO(active.whatsapp_sent_at), "dd/MM HH:mm", { locale: ptBR })}
                  </Badge>
                )}
              </>
            )}
          </div>

          {!active && !isLoading && !generate.isPending && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma versão para o atleta ainda. Clique em "Gerar resumo" para criar
              uma mensagem motivacional em 2ª pessoa baseada na evolução.
            </p>
          )}

          {active && (
            <>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Edite à vontade antes de enviar (use linguagem direta com o atleta).
                </label>
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={14}
                  className="font-mono text-sm"
                />
              </div>

              {summaries.length > 1 && (
                <div className="text-xs text-muted-foreground">
                  Versões anteriores:
                  <div className="flex flex-wrap gap-1 mt-1">
                    {summaries.slice(1).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setActiveId(s.id);
                          setDraft(s.edited_content ?? s.summary_markdown);
                        }}
                        className="px-2 py-1 border rounded hover:bg-muted"
                      >
                        {format(parseISO(s.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={!active || update.isPending || draft === (active?.edited_content ?? active?.summary_markdown)}
          >
            {update.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
            Salvar edição
          </Button>
          <Button
            onClick={handleSend}
            disabled={!active || send.isPending || !draft.trim()}
          >
            {send.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
            Enviar via WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
