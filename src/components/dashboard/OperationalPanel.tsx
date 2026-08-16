/**
 * ETAPA 2B — Painel operacional canônico do dashboard.
 * Uma lista única de operações, agrupada por urgência real (dias úteis).
 * Não existe "concluir/esconder": o item some quando é resolvido na origem.
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertTriangle, CalendarClock, CheckCircle, ChevronDown, ClipboardList,
  History, ListTodo, MessageSquare, RefreshCw, UtensilsCrossed, Video,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useOperationalDashboard } from '@/hooks/useOperationalDashboard';
import { useDailyAgenda } from '@/hooks/useDailyAgenda';
import { overdueBusinessDays, OPERATION_LABEL, type Operation, type OperationKind } from '@/lib/dashboardOperations';

const ICONS: Record<OperationKind, JSX.Element> = {
  checkin_review: <MessageSquare className="h-4 w-4" />,
  meal_plan: <UtensilsCrossed className="h-4 w-4" />,
  anamnese_review: <ClipboardList className="h-4 w-4" />,
  booking_invite: <CalendarClock className="h-4 w-4" />,
  renewal: <RefreshCw className="h-4 w-4" />,
  manual_task: <ListTodo className="h-4 w-4" />,
  legacy_task: <History className="h-4 w-4" />,
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function formatDue(due: string | null): string {
  if (!due) return 'Sem prazo';
  return due.split('-').reverse().join('/');
}

function OperationRow({ op, accent, holidays }: { op: Operation; accent: string; holidays: Set<string> }) {
  const navigate = useNavigate();
  const late = overdueBusinessDays(op, holidays);

  return (
    <button
      type="button"
      onClick={() => navigate(op.route)}
      className={`w-full text-left rounded-lg border border-border/60 bg-card p-3 border-l-4 ${accent} transition-colors hover:bg-muted/40`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-muted-foreground shrink-0">{ICONS[op.kind]}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium truncate">{op.clientName}</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {OPERATION_LABEL[op.kind]}
            </Badge>
            {late > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-500/30 text-red-500">
                {late} {late === 1 ? 'dia útil' : 'dias úteis'} de atraso
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{op.title}</p>
          {op.subtitle && <p className="text-[11px] text-muted-foreground/80 truncate">{op.subtitle}</p>}
        </div>
        <span className="text-[11px] text-muted-foreground shrink-0">{formatDue(op.dueDate)}</span>
      </div>
    </button>
  );
}

function Group({
  title, icon, ops, accent, holidays, tone,
}: {
  title: string; icon: JSX.Element; ops: Operation[]; accent: string; holidays: Set<string>; tone: string;
}) {
  if (ops.length === 0) return null;
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={tone}>{icon}</span>
        <h2 className="text-sm font-semibold">{title}</h2>
        <Badge variant="secondary" className="text-[10px]">{ops.length}</Badge>
      </div>
      <div className="space-y-2">
        {ops.map((op) => <OperationRow key={op.id} op={op} accent={accent} holidays={holidays} />)}
      </div>
    </section>
  );
}

export function OperationalPanel() {
  const { user } = useAuth();
  const { groups, legacy, total, isLoading, error, holidays } = useOperationalDashboard();
  const { appointments, isLoading: loadingAgenda } = useDailyAgenda();
  const firstName = useMemo(
    () => user?.user_metadata?.full_name?.split(' ')[0] || '',
    [user],
  );

  if (isLoading || loadingAgenda) {
    return (
      <div className="space-y-4 py-4">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="flex items-center gap-3 py-5 text-sm">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <div>
            <p className="font-medium">Não foi possível carregar a operação.</p>
            <p className="text-muted-foreground">{error.message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-7">
      <div className="pt-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting()}{firstName ? `, ${firstName}` : ''}.
        </h1>
        <p className="text-muted-foreground mt-1">
          {total === 0
            ? 'Nenhuma pendência operacional. Tudo em dia!'
            : <>Você tem <span className="font-medium text-foreground">{total} {total === 1 ? 'pendência' : 'pendências'}</span>
                {groups.overdue.length > 0 && <> — <span className="text-red-500 font-medium">{groups.overdue.length} em atraso</span></>}.</>}
        </p>
      </div>

      {/* Agenda do dia — contexto, não fila */}
      {appointments.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Video className="h-4 w-4 text-primary" /> Agenda de hoje
              <Badge variant="secondary" className="text-[10px]">{appointments.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {appointments.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border p-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{a.time} · {a.clientName}</p>
                  <p className="text-[11px] text-muted-foreground">{a.durationMinutes} min</p>
                </div>
                {a.meetLink && (
                  <Button size="sm" variant="outline" onClick={() => window.open(a.meetLink!, '_blank', 'noopener')}>
                    Entrar
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {total === 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-6">
          <CheckCircle className="h-6 w-6 text-emerald-500" />
          <div>
            <p className="font-medium">Mesa limpa!</p>
            <p className="text-sm text-muted-foreground">Nenhuma operação aguardando você.</p>
          </div>
        </div>
      )}

      <Group
        title="Atrasadas"
        icon={<AlertTriangle className="h-4 w-4" />}
        tone="text-red-500"
        ops={groups.overdue}
        accent="border-l-red-500"
        holidays={holidays}
      />
      <Group
        title="Para hoje"
        icon={<CalendarClock className="h-4 w-4" />}
        tone="text-yellow-600"
        ops={groups.today}
        accent="border-l-yellow-500"
        holidays={holidays}
      />
      <Group
        title="Próximas"
        icon={<ListTodo className="h-4 w-4" />}
        tone="text-muted-foreground"
        ops={groups.upcoming}
        accent="border-l-muted-foreground/30"
        holidays={holidays}
      />

      {/* Pendências legadas: tarefas derivadas criadas por automações antigas */}
      {legacy.length > 0 && (
        <Collapsible>
          <Card className="border-dashed">
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-2 cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <History className="h-4 w-4 text-muted-foreground" /> Pendências antigas
                    <Badge variant="secondary" className="text-[10px]">{legacy.length}</Badge>
                  </CardTitle>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Tarefas geradas por automações desativadas. Resolva ou arquive em Tarefas.
                </p>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-2">
                {legacy.map((op) => (
                  <OperationRow key={op.id} op={op} accent="border-l-muted-foreground/30" holidays={holidays} />
                ))}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  );
}
