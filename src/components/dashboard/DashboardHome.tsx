/**
 * Home do Dashboard — camada 100% visual.
 * Toda a lógica (Etapa 2B) continua nos hooks: nada de regra de negócio aqui.
 * A Home mostra RESUMO + PRÓXIMAS AÇÕES; listas completas ficam em drawers.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, CalendarDays, Check, ChevronDown, ChevronRight, Video } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useOperationalDashboard } from '@/hooks/useOperationalDashboard';
import { useDailyAgenda } from '@/hooks/useDailyAgenda';
import { useAthleteRadar } from '@/hooks/useAthleteRadar';
import { useBiweeklyContacts } from '@/hooks/useBiweeklyContacts';
import { overdueBusinessDays, toDateKey, type Operation } from '@/lib/dashboardOperations';
import { BiweeklyContactPanel } from './BiweeklyContactPanel';

/** Quantas ações aparecem na seção "Agora". */
const NOW_LIMIT = 3;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** Prazo curto: "Atrasado", "Hoje", "Amanhã", "12/08". Sem números gritantes. */
function dueLabel(op: Operation, holidays: Set<string>): { text: string; late: boolean } {
  const late = overdueBusinessDays(op, holidays) > 0;
  if (late) return { text: 'Atrasado', late: true };
  if (!op.dueDate) return { text: '—', late: false };
  const today = toDateKey(new Date());
  if (op.dueDate === today) return { text: 'Hoje', late: false };
  const tomorrow = toDateKey(new Date(Date.now() + 86_400_000));
  if (op.dueDate === tomorrow) return { text: 'Amanhã', late: false };
  if (op.dueDate < today) return { text: 'Atrasado', late: true };
  return { text: `${op.dueDate.slice(8, 10)}/${op.dueDate.slice(5, 7)}`, late: false };
}

function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 px-1">
      <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{children}</h2>
      {action}
    </div>
  );
}

function OpRow({ op, holidays, onClick }: { op: Operation; holidays: Set<string>; onClick: () => void }) {
  const due = dueLabel(op, holidays);
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-md px-1 py-2.5 text-left transition-colors hover:bg-muted/50 active:bg-muted"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium leading-tight">{op.clientName}</p>
        <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{op.title}</p>
      </div>
      <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
        {due.late && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-destructive" />}
        {due.text}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />
    </button>
  );
}

function LinkRow({ label, count, onClick }: { label: string; count?: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-md px-1 py-3 text-left text-[15px] transition-colors hover:bg-muted/50 active:bg-muted"
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count != null && count > 0 && (
        <span className="shrink-0 tabular-nums text-sm text-muted-foreground">{count}</span>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />
    </button>
  );
}

function Drawer({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="pb-2 text-left">
          <SheetTitle className="text-base">{title}</SheetTitle>
        </SheetHeader>
        <div className="-mx-2 flex-1 overflow-y-auto px-2 pb-8">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

export function DashboardHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { groups, legacy, total, isLoading, error, holidays } = useOperationalDashboard();
  const { appointments, isLoading: loadingAgenda } = useDailyAgenda();
  const { problems } = useAthleteRadar();
  const { pending: contactsPending } = useBiweeklyContacts();

  const [drawer, setDrawer] = useState<null | 'pending' | 'radar' | 'contacts' | 'agenda'>(null);
  const [legacyOpen, setLegacyOpen] = useState(false);

  const firstName = useMemo(() => user?.user_metadata?.full_name?.split(' ')[0] || '', [user]);
  const pending = useMemo(
    () => [...groups.overdue, ...groups.today, ...groups.upcoming],
    [groups],
  );

  if (isLoading || loadingAgenda) {
    return (
      <div className="space-y-6 py-4">
        <Skeleton className="h-10 w-1/2 rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
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

  const stats: { text: string; tone?: 'late' }[] = [];
  if (total > 0) stats.push({ text: `${total} ${total === 1 ? 'pendência' : 'pendências'}` });
  if (groups.overdue.length > 0)
    stats.push({ text: `${groups.overdue.length} atrasada${groups.overdue.length > 1 ? 's' : ''}`, tone: 'late' });
  if (appointments.length > 0)
    stats.push({ text: `${appointments.length} consulta${appointments.length > 1 ? 's' : ''} hoje` });

  const now = pending.slice(0, NOW_LIMIT);

  return (
    <div className="space-y-9">
      <header className="px-1 pt-1">
        <h1 className="text-[22px] font-semibold tracking-tight sm:text-2xl">
          {greeting()}{firstName ? `, ${firstName}` : ''}
        </h1>
        {total === 0 ? (
          <p className="mt-1.5 flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-primary" />
            <span className="font-medium">Tudo em dia</span>
            {appointments.length > 0 && (
              <span className="text-muted-foreground">
                · {appointments.length} consulta{appointments.length > 1 ? 's' : ''} hoje
              </span>
            )}
          </p>
        ) : (
          stats.length > 0 && (
            <p className="mt-1 text-[13px] text-muted-foreground">
              {stats.map((s, i) => (
                <span key={s.text}>
                  {i > 0 && <span className="mx-1.5 opacity-40">·</span>}
                  <span className={s.tone === 'late' ? 'text-destructive' : undefined}>{s.text}</span>
                </span>
              ))}
            </p>
          )
        )}
      </header>

      {now.length > 0 && (
        <section className="space-y-1">
          <SectionTitle>Agora</SectionTitle>
          <div className="divide-y divide-border/40">
            {now.map((op) => (
              <OpRow key={op.id} op={op} holidays={holidays} onClick={() => navigate(op.route)} />
            ))}
          </div>
          {pending.length > now.length && (
            <button
              type="button"
              onClick={() => setDrawer('pending')}
              className="px-1 pt-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Ver todas as pendências →
            </button>
          )}
        </section>
      )}

      <section className="space-y-1">
        <SectionTitle>Hoje</SectionTitle>
        {appointments.length === 0 ? (
          <p className="px-1 py-2 text-sm text-muted-foreground">Nenhuma consulta</p>
        ) : (
          <>
            <div className="divide-y divide-border/40">
              {appointments.slice(0, 3).map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-1 py-2.5">
                  <span className="w-11 shrink-0 text-sm tabular-nums text-muted-foreground">{a.time}</span>
                  <span className="min-w-0 flex-1 truncate text-[15px]">{a.clientName}</span>
                  {a.meetLink && (
                    <button
                      type="button"
                      aria-label={`Entrar na consulta de ${a.clientName}`}
                      onClick={() => window.open(a.meetLink!, '_blank', 'noopener')}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                    >
                      <Video className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => (appointments.length > 3 ? setDrawer('agenda') : navigate('/calendar'))}
              className="px-1 pt-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Ver agenda →
            </button>
          </>
        )}
      </section>

      <section className="space-y-1">
        <SectionTitle>Acessos rápidos</SectionTitle>
        <div className="divide-y divide-border/40">
          <LinkRow label="Pendências" count={total} onClick={() => setDrawer('pending')} />
          <LinkRow label="Contatos" count={contactsPending.length} onClick={() => setDrawer('contacts')} />
          <LinkRow label="Radar" count={problems.length} onClick={() => setDrawer('radar')} />
          <LinkRow label="Calendário" onClick={() => navigate('/calendar')} />
          <LinkRow label="Atletas" onClick={() => navigate('/clients')} />
        </div>
      </section>

      <Drawer open={drawer === 'pending'} onOpenChange={(v) => !v && setDrawer(null)} title={`Pendências (${total})`}>
        <div className="divide-y divide-border/40">
          {pending.map((op) => (
            <OpRow
              key={op.id}
              op={op}
              holidays={holidays}
              onClick={() => { setDrawer(null); navigate(op.route); }}
            />
          ))}
        </div>
        {legacy.length > 0 && (
          <Collapsible open={legacyOpen} onOpenChange={setLegacyOpen} className="mt-4">
            <CollapsibleTrigger className="flex w-full items-center gap-1.5 px-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
              Pendências antigas ({legacy.length})
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${legacyOpen ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1 divide-y divide-border/40">
              {legacy.map((op) => (
                <OpRow
                  key={op.id}
                  op={op}
                  holidays={holidays}
                  onClick={() => { setDrawer(null); navigate(op.route); }}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </Drawer>

      <Drawer open={drawer === 'radar'} onOpenChange={(v) => !v && setDrawer(null)} title={`Radar (${problems.length})`}>
        <div className="divide-y divide-border/40">
          {problems.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setDrawer(null);
                navigate(r.pendingResponseId ? `/checkin-review/${r.pendingResponseId}` : `/clients/${r.id}`);
              }}
              className="flex w-full items-center gap-3 rounded-md px-1 py-2.5 text-left transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium leading-tight">{r.name}</p>
                <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                  {r.issues.map((i) => i.label).join(' · ')}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />
            </button>
          ))}
        </div>
      </Drawer>

      <Drawer open={drawer === 'contacts'} onOpenChange={(v) => !v && setDrawer(null)} title="Contatos">
        <BiweeklyContactPanel />
      </Drawer>

      <Drawer open={drawer === 'agenda'} onOpenChange={(v) => !v && setDrawer(null)} title="Agenda de hoje">
        <div className="divide-y divide-border/40">
          {appointments.map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-1 py-2.5">
              <span className="w-11 shrink-0 text-sm tabular-nums text-muted-foreground">{a.time}</span>
              <span className="min-w-0 flex-1 truncate text-[15px]">{a.clientName}</span>
              {a.meetLink && (
                <button
                  type="button"
                  aria-label={`Entrar na consulta de ${a.clientName}`}
                  onClick={() => window.open(a.meetLink!, '_blank', 'noopener')}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                >
                  <Video className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => { setDrawer(null); navigate('/calendar'); }}
            className="flex w-full items-center gap-2 px-1 py-3 text-left text-[13px] text-muted-foreground hover:text-foreground"
          >
            <CalendarDays className="h-4 w-4" /> Abrir calendário
          </button>
        </div>
      </Drawer>
    </div>
  );
}
