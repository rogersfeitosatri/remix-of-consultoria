/**
 * ETAPA 2B — Painel operacional canônico do dashboard.
 * Uma lista única de operações, agrupada por urgência real (dias úteis).
 * Não existe "concluir/esconder": o item some quando é resolvido na origem.
 *
 * Camada visual (frontend-design): lista de trabalho, sem cards aninhados,
 * sem badges por status, sem parágrafos. Só nome, ação, prazo e um CTA.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, Check, ChevronDown, ChevronRight, Video } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useOperationalDashboard } from '@/hooks/useOperationalDashboard';
import { useDailyAgenda } from '@/hooks/useDailyAgenda';
import { overdueBusinessDays, toDateKey, type Operation } from '@/lib/dashboardOperations';
import { DashboardSection, RowButton } from './DashboardSection';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** Prazo em uma expressão curta: "Hoje", "Amanhã", "2 dias atrasado", "12/08". */
function dueLabel(op: Operation, holidays: Set<string>): { text: string; late: boolean } {
  const late = overdueBusinessDays(op, holidays);
  if (late > 0) return { text: `${late} ${late === 1 ? 'dia' : 'dias'} atrasado`, late: true };
  if (!op.dueDate) return { text: 'Sem prazo', late: false };
  const today = toDateKey(new Date());
  if (op.dueDate === today) return { text: 'Hoje', late: false };
  const tomorrow = toDateKey(new Date(Date.now() + 86_400_000));
  if (op.dueDate === tomorrow) return { text: 'Amanhã', late: false };
  if (op.dueDate < today) return { text: 'Atrasado', late: true };
  return { text: op.dueDate.slice(8, 10) + '/' + op.dueDate.slice(5, 7), late: false };
}

function OperationRow({ op, holidays }: { op: Operation; holidays: Set<string> }) {
  const navigate = useNavigate();
  const due = dueLabel(op, holidays);

  return (
    <RowButton onClick={() => navigate(op.route)} lateMark={due.late}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium leading-tight">{op.clientName}</p>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">{op.title}</p>
      </div>
      <span className={`shrink-0 text-xs ${due.late ? 'text-destructive' : 'text-muted-foreground'}`}>
        {due.text}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground" />
    </RowButton>
  );
}

export function OperationalPanel() {
  const { user } = useAuth();
  const { groups, legacy, total, isLoading, error, holidays } = useOperationalDashboard();
  const { appointments, isLoading: loadingAgenda } = useDailyAgenda();
  const [legacyOpen, setLegacyOpen] = useState(false);

  const firstName = useMemo(
    () => user?.user_metadata?.full_name?.split(' ')[0] || '',
    [user],
  );

  const pending = useMemo(
    () => [...groups.overdue, ...groups.today, ...groups.upcoming],
    [groups],
  );

  if (isLoading || loadingAgenda) {
    return (
      <div className="space-y-6 py-4">
        <Skeleton className="h-12 w-2/3 rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-destructive/40 p-4 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div>
          <p className="font-medium">Não foi possível carregar a operação.</p>
          <p className="text-muted-foreground">{error.message}</p>
        </div>
      </div>
    );
  }

  const stats: string[] = [];
  if (total > 0) stats.push(`${total} ${total === 1 ? 'pendência' : 'pendências'}`);
  if (groups.overdue.length > 0) stats.push(`${groups.overdue.length} atrasada${groups.overdue.length > 1 ? 's' : ''}`);
  if (appointments.length > 0) stats.push(`${appointments.length} consulta${appointments.length > 1 ? 's' : ''} hoje`);

  return (
    <div className="space-y-8">
      <header className="px-1 pt-1">
        <h1 className="text-[22px] font-semibold tracking-tight sm:text-2xl">
          {greeting()}{firstName ? `, ${firstName}` : ''}
        </h1>
        {stats.length > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            {stats.map((s, i) => (
              <span key={s}>
                {i > 0 && <span className="mx-1.5 opacity-40">•</span>}
                <span className={i === 1 ? 'text-destructive' : undefined}>{s}</span>
              </span>
            ))}
          </p>
        )}
      </header>

      {total === 0 ? (
        <div className="flex items-center gap-2.5 px-1 text-sm">
          <Check className="h-4 w-4 text-primary" />
          <span className="font-medium">Tudo em dia</span>
          {appointments.length > 0 && (
            <span className="text-muted-foreground">
              · próxima consulta às {appointments[0].time}
            </span>
          )}
        </div>
      ) : (
        <DashboardSection title="Pendências" count={total}>
          {pending.map((op) => <OperationRow key={op.id} op={op} holidays={holidays} />)}
        </DashboardSection>
      )}

      {appointments.length > 0 && (
        <DashboardSection title="Hoje" count={appointments.length}>
          {appointments.map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-3 py-3">
              <span className="w-12 shrink-0 text-sm tabular-nums text-muted-foreground">{a.time}</span>
              <span className="min-w-0 flex-1 truncate text-[15px]">{a.clientName}</span>
              {a.meetLink && (
                <button
                  type="button"
                  aria-label={`Entrar na consulta de ${a.clientName}`}
                  onClick={() => window.open(a.meetLink!, '_blank', 'noopener')}
                  className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                >
                  <Video className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </DashboardSection>
      )}

      {legacy.length > 0 && (
        <Collapsible open={legacyOpen} onOpenChange={setLegacyOpen}>
          <CollapsibleTrigger className="flex w-full items-center gap-1.5 px-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
            Pendências antigas ({legacy.length})
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${legacyOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1 divide-y divide-border/50">
            {legacy.map((op) => <OperationRow key={op.id} op={op} holidays={holidays} />)}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
