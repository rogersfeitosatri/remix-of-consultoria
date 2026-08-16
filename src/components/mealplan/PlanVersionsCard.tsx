/**
 * ETAPA 3A — Histórico canônico de versões do plano (somente leitura).
 * Nada é apagado: cada publicação vira histórico consultável.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History } from 'lucide-react';
import { useMealPlanVersions } from '@/hooks/useMealPlanVersions';
import { SOURCE_LABEL, STATUS_LABEL, versionLabel } from '@/lib/mealPlanCore';

export function PlanVersionsCard({ clientId }: { clientId?: string }) {
  const { data: versions = [], isLoading } = useMealPlanVersions(clientId);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" /> Versões do plano
          {versions.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">{versions.length}</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma versão publicada ainda. Publique o plano para o atleta visualizá-lo no app.
          </p>
        ) : (
          <ul className="divide-y">
            {versions.map((v) => (
              <li key={v.id} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm truncate">{versionLabel(v)}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {SOURCE_LABEL[v.source] || v.source}
                    {v.needs_review ? ' · precisa de revisão' : ''}
                  </p>
                </div>
                <Badge variant={v.status === 'published' ? 'default' : 'secondary'} className="shrink-0">
                  {STATUS_LABEL[v.status] || v.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
