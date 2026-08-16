/**
 * ETAPA 3C — Painel de versões do formulário (Check-in e Anamnese).
 * Mostra o histórico imutável e permite publicar a definição atual como nova versão.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { History, Lock, Loader2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  useFormVersions,
  useFormVersionQuestions,
  usePublishFormVersion,
  useFormHasResponses,
  type FormKind,
} from '@/hooks/useFormVersions';

interface Props {
  kind: FormKind;
  formId: string;
}

const STATUS_LABEL: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  published: { label: 'Publicada', variant: 'default' },
  draft: { label: 'Rascunho', variant: 'outline' },
  superseded: { label: 'Substituída', variant: 'secondary' },
};

export function FormVersionsPanel({ kind, formId }: Props) {
  const { data: versions = [], isLoading } = useFormVersions(kind, formId);
  const { data: hasResponses } = useFormHasResponses(kind, formId);
  const publish = usePublishFormVersion(kind);
  const [note, setNote] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const { data: previewQuestions = [] } = useFormVersionQuestions(kind, previewId);

  const current = versions.find((v) => v.status === 'published');

  const handlePublish = async () => {
    try {
      await publish.mutateAsync({ formId, note: note.trim() || undefined });
      setNote('');
      toast.success('Nova versão publicada. Respostas anteriores permanecem ligadas à versão antiga.');
    } catch (e: any) {
      toast.error(e.message ?? 'Não foi possível publicar a versão');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" />
          Versões do formulário
        </CardTitle>
        <CardDescription>
          Editar o formulário nunca altera respostas já enviadas. Cada resposta fica ligada à versão
          que o atleta realmente viu.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {current && (
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <span className="font-medium">Versão atual: v{current.version_number}</span>
            {hasResponses && (
              <span className="ml-2 inline-flex items-center gap-1 text-muted-foreground">
                <Lock className="h-3 w-3" /> já possui respostas — mudanças exigem nova versão
              </span>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="O que mudou nesta versão? (opcional)"
            rows={2}
          />
          <Button onClick={handlePublish} disabled={publish.isPending} size="sm">
            {publish.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Publicar nova versão
          </Button>
        </div>

        <div className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando versões...</p>}
          {!isLoading && versions.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma versão publicada ainda.</p>
          )}
          {versions.map((v) => {
            const status = STATUS_LABEL[v.status] ?? STATUS_LABEL.draft;
            return (
              <div
                key={v.id}
                className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">v{v.version_number}</span>
                    <Badge variant={status.variant}>{status.label}</Badge>
                    {!!v.response_count && (
                      <span className="text-xs text-muted-foreground">
                        {v.response_count} resposta{v.response_count > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {v.published_at
                      ? format(new Date(v.published_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : format(new Date(v.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    {(v.metadata as any)?.note ? ` — ${(v.metadata as any).note}` : ''}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setPreviewId(v.id)}>
                  <Eye className="mr-1 h-4 w-4" /> Ver
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>

      <Dialog open={!!previewId} onOpenChange={(o) => !o && setPreviewId(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Definição congelada</DialogTitle>
            <DialogDescription>
              Perguntas exatamente como estavam quando esta versão foi publicada.
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-2">
            {previewQuestions.map((q, i) => (
              <li key={q.id} className="rounded-md border p-2 text-sm">
                <span className="text-muted-foreground">{i + 1}.</span> {q.question_text}
                <span className="ml-2 text-xs text-muted-foreground">
                  [{q.canonical_type ?? q.question_type}
                  {q.question_key ? ` · ${q.question_key}` : ''}]
                </span>
              </li>
            ))}
            {previewQuestions.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma pergunta nesta versão.</p>
            )}
          </ol>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
