/**
 * ETAPA 3A — Controle único de publicação (usado pelo Editor Inteligente e pelo Clássico).
 * Publicar é a ÚNICA ação que torna o plano visível para o atleta.
 */
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useMealPlanVersions } from '@/hooks/useMealPlanVersions';
import { usePublishCurrentPlan } from '@/hooks/usePublishCurrentPlan';
import { findPublished, type MealPlanVersionSource } from '@/lib/mealPlanCore';

interface Props {
  clientId?: string;
  source: MealPlanVersionSource;
  /** Salva o rascunho antes de publicar (o editor passa seu próprio save). */
  onBeforePublish?: () => Promise<void> | void;
  size?: 'sm' | 'default';
  className?: string;
}

export function PublishPlanControl({ clientId, source, onBeforePublish, size = 'sm', className }: Props) {
  const { data: versions = [] } = useMealPlanVersions(clientId);
  const publish = usePublishCurrentPlan();
  const published = findPublished(versions);

  if (!clientId) return null;

  const run = async () => {
    try {
      if (onBeforePublish) await onBeforePublish();
      await publish.mutateAsync({ clientId, source });
    } catch { /* toast já exibido */ }
  };

  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      {published ? (
        <Badge variant="secondary" className="whitespace-nowrap">
          Publicado v{published.version_number}
        </Badge>
      ) : (
        <Badge variant="outline" className="whitespace-nowrap">Não publicado</Badge>
      )}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size={size} disabled={publish.isPending}>
            {publish.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Publicar
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publicar plano para o atleta?</AlertDialogTitle>
            <AlertDialogDescription>
              {published
                ? `A versão v${published.version_number} passa a ser histórico e a nova versão vira a vigente. Nada é apagado.`
                : 'O plano ficará visível na área do atleta. Versões publicadas não podem ser editadas — cada ajuste gera uma nova versão.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={run}>Publicar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
