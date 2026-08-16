/**
 * ETAPA 2A — Badges canônicos do estado do atleta.
 * Fonte única: `getAthleteState`. Nenhuma tela deve recalcular estado.
 */
import { Badge } from '@/components/ui/badge';
import { Snowflake, Archive, CircleSlash, ClipboardList, CheckCircle2 } from 'lucide-react';
import { getAthleteState, type AthleteStateInput } from '@/lib/athleteState';

interface Props {
  client: AthleteStateInput;
  /** Mostra o badge de pendência de onboarding (aguardando anamnese). */
  showOnboarding?: boolean;
  size?: 'sm' | 'md';
}

export function AthleteStateBadges({ client, showOnboarding = true, size = 'sm' }: Props) {
  const state = getAthleteState(client);
  const cls = size === 'sm' ? 'gap-1 text-[11px]' : 'gap-1 text-xs';

  return (
    <>
      {state.isArchived ? (
        <Badge variant="secondary" className={cls}>
          <Archive className="h-3 w-3" /> Arquivado
        </Badge>
      ) : state.isEnded ? (
        <Badge variant="outline" className={`${cls} border-muted-foreground/40 text-muted-foreground`}>
          <CircleSlash className="h-3 w-3" /> Encerrado
        </Badge>
      ) : state.isFrozen ? (
        <Badge variant="outline" className={`${cls} border-blue-500/40 bg-blue-500/10 text-blue-600`}>
          <Snowflake className="h-3 w-3" /> Congelado
        </Badge>
      ) : state.isOperational ? (
        <Badge variant="outline" className={`${cls} border-emerald-500/40 bg-emerald-500/10 text-emerald-600`}>
          <CheckCircle2 className="h-3 w-3" /> Ativo
        </Badge>
      ) : (
        <Badge variant="secondary" className={cls}>Inativo</Badge>
      )}

      {showOnboarding && state.isInOnboarding && (
        <Badge variant="outline" className={`${cls} border-amber-500/40 bg-amber-500/10 text-amber-600`}>
          <ClipboardList className="h-3 w-3" /> Aguardando anamnese
        </Badge>
      )}
    </>
  );
}
