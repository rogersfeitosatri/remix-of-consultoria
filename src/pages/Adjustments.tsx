/**
 * ETAPA 5A — Ajustes = Revisões nutricionais canônicas.
 *
 * A tela não calcula nada: ela lê e opera entidades reais (`nutrition_reviews`).
 * Cadência fixa por plano/produto (com override individual), independente de check-in.
 */
import { useMemo, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  SlidersHorizontal, Bell, BellRing, Loader2, CalendarClock, ArrowRight,
  AlertTriangle, CheckCircle2, HelpCircle, Snowflake,
} from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useNutritionReviews, type ReviewWithClient } from '@/hooks/useNutritionReviews';
import {
  REVIEW_DECISION_LABEL, REVIEW_STATUS_LABEL, todayKey, type ReviewDecision,
} from '@/lib/nutritionReview';

const fmt = (d: string) => format(parseISO(d.slice(0, 10)), "dd 'de' MMM, yyyy", { locale: ptBR });
const fmtShort = (d: string) => format(parseISO(d.slice(0, 10)), 'dd/MM/yy', { locale: ptBR });

function StatusBadge({ r }: { r: ReviewWithClient }) {
  const late = r.scheduled_for < todayKey() && r.status !== 'completed' && r.status !== 'cancelled';
  const checkin = reviewCheckinState(r);
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Badge className="text-[10px]">{STRUCTURAL_REVIEW_BADGE}</Badge>
      <Badge variant={late ? 'destructive' : 'outline'} className="text-[10px]">
        {REVIEW_STATUS_LABEL[r.status]}
      </Badge>
      <Badge
        variant={checkin === 'answered' ? 'secondary' : 'outline'}
        className="text-[10px]"
      >
        {REVIEW_CHECKIN_STATE_LABEL[checkin]}
      </Badge>
      {r.source === 'manual_extra_review' && (
        <Badge variant="secondary" className="text-[10px]">Extra</Badge>
      )}
      {r.needs_review && (
        <Badge variant="secondary" className="text-[10px] gap-1">
          <AlertTriangle className="h-3 w-3" /> Conferir
        </Badge>
      )}
      {r.override_without_checkin && (
        <Badge variant="outline" className="text-[10px]">Revisada sem check-in</Badge>
      )}
    </div>
  );
}

function ReviewRow({ r, onOpen }: { r: ReviewWithClient; onOpen: (r: ReviewWithClient) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0">
        <Link to={`/clients/${r.client_id}`} className="font-medium hover:underline truncate block">
          {r.client?.name || 'Atleta'}
        </Link>
        <p className="text-[11px] text-muted-foreground">
          Prevista para {fmtShort(r.scheduled_for)} · ciclo de {r.interval_days} dias
          {r.decision ? ` · ${REVIEW_DECISION_LABEL[r.decision]}` : ''}
        </p>
        <div className="mt-1"><StatusBadge r={r} /></div>
        {r.missing_information && (
          <p className="text-[11px] text-amber-600 mt-1">Falta: {r.missing_information}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {r.checkin_response_id && (
          <Button size="sm" variant="ghost" asChild>
            <Link to={`/checkin-review/${r.checkin_response_id}`}>Ver check-in</Link>
          </Button>
        )}
        <Button size="sm" variant="outline" className="gap-1" onClick={() => onOpen(r)}>
          Revisar <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}


export default function Adjustments() {
  const push = usePushNotifications();
  const {
    pending, upcoming, history, paused, needsReview, isLoading,
    complete, waitInformation, reschedule, cancel,
  } = useNutritionReviews();

  const [active, setActive] = useState<ReviewWithClient | null>(null);
  const [decision, setDecision] = useState<ReviewDecision>('no_change');
  const [notes, setNotes] = useState('');
  const [missing, setMissing] = useState('');
  const [override, setOverride] = useState(false);
  const [newDate, setNewDate] = useState('');

  const openReview = (r: ReviewWithClient) => {
    setActive(r);
    setDecision(r.decision ?? 'no_change');
    setNotes(r.notes ?? '');
    setMissing(r.missing_information ?? '');
    setOverride(r.override_without_checkin);
    setNewDate(r.scheduled_for);
  };

  const counters = useMemo(
    () => ({ pending: pending.length, upcoming: upcoming.length, history: history.length }),
    [pending, upcoming, history],
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
              <SlidersHorizontal className="h-6 w-6 text-primary" />
              Ajustes
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Revisões nutricionais com cadência fixa por plano. O check-in é insumo — nunca o gatilho.
            </p>
          </div>
          <Button
            variant={push.enabled ? 'secondary' : 'default'}
            onClick={push.enable}
            disabled={push.status === 'loading' || !push.supported}
            className="gap-2 shrink-0"
          >
            {push.status === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> :
              push.enabled ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
            {push.enabled ? 'Notificações ativas' : 'Ativar notificações'}
          </Button>
        </div>

        {needsReview.length > 0 && (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="p-3 text-sm flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <span>
                <strong>{needsReview.length}</strong> revisão(ões) precisam de conferência manual da data
                (regras antigas conflitantes ou retomada de congelamento). Confirme ou remarque.
              </span>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="pending">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="pending" className="flex-1 sm:flex-none">
                Pendentes <Badge variant="secondary" className="ml-2">{counters.pending}</Badge>
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="flex-1 sm:flex-none">
                Próximas <Badge variant="secondary" className="ml-2">{counters.upcoming}</Badge>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex-1 sm:flex-none">
                Histórico <Badge variant="secondary" className="ml-2">{counters.history}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-4 space-y-2">
              {pending.length === 0 && (
                <Card><CardContent className="p-6 text-sm text-muted-foreground text-center">
                  Nenhuma revisão vencida. Tudo em dia.
                </CardContent></Card>
              )}
              {pending.map((r) => <ReviewRow key={r.id} r={r} onOpen={openReview} />)}
            </TabsContent>

            <TabsContent value="upcoming" className="mt-4 space-y-2">
              {upcoming.length === 0 && (
                <Card><CardContent className="p-6 text-sm text-muted-foreground text-center">
                  Sem revisões futuras materializadas.
                </CardContent></Card>
              )}
              {upcoming.map((r) => <ReviewRow key={r.id} r={r} onOpen={openReview} />)}
            </TabsContent>

            <TabsContent value="history" className="mt-4 space-y-2">
              {history.length === 0 && (
                <Card><CardContent className="p-6 text-sm text-muted-foreground text-center">
                  Nenhuma revisão concluída ainda.
                </CardContent></Card>
              )}
              {history.map((r) => (
                <div key={r.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Link to={`/clients/${r.client_id}`} className="font-medium hover:underline truncate">
                      {r.client?.name || 'Atleta'}
                    </Link>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {r.reviewed_at ? fmt(r.reviewed_at) : fmt(r.scheduled_for)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                    {r.status === 'completed'
                      ? <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      : <HelpCircle className="h-3 w-3" />}
                    {r.decision ? REVIEW_DECISION_LABEL[r.decision] : REVIEW_STATUS_LABEL[r.status]}
                    {r.cancel_reason ? ` · ${r.cancel_reason}` : ''}
                  </p>
                  {r.notes && <p className="text-xs mt-1">{r.notes}</p>}
                </div>
              ))}
            </TabsContent>
          </Tabs>
        )}

        {paused.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Snowflake className="h-4 w-4 text-sky-500" />
                Pausadas por congelamento
                <Badge variant="secondary" className="ml-auto">{paused.length}</Badge>
              </CardTitle>
              <CardDescription>Retomam automaticamente ao descongelar, sem gerar acúmulo.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5">
              {paused.map((r) => (
                <Link key={r.id} to={`/clients/${r.client_id}`}>
                  <Badge variant="outline" className="text-[11px] cursor-pointer">{r.client?.name}</Badge>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto flex flex-col">
          {active && (
            <>
              <SheetHeader>
                <SheetTitle>{active.client?.name}</SheetTitle>
                <SheetDescription className="flex items-center gap-1">
                  <CalendarClock className="h-3.5 w-3.5" />
                  Revisão prevista para {fmt(active.scheduled_for)} · ciclo de {active.interval_days} dias
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Decisão clínica</Label>
                  <div className="grid gap-1.5">
                    {(['no_change', 'change_proposed', 'change_published'] as ReviewDecision[]).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDecision(d)}
                        className={`text-left text-sm rounded-md border px-3 py-2 transition-colors ${
                          decision === d ? 'border-primary bg-primary/5 font-medium' : 'hover:bg-accent'
                        }`}
                      >
                        {REVIEW_DECISION_LABEL[d]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Checkbox
                    id="override"
                    checked={override}
                    onCheckedChange={(v) => setOverride(!!v)}
                  />
                  <Label htmlFor="override" className="text-xs leading-snug font-normal">
                    Revisar mesmo sem check-in, usando os dados disponíveis (fica registrado).
                  </Label>
                </div>

                <div className="space-y-1.5">
                  <Label>Observação da revisão</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                    placeholder="O que foi avaliado e por quê" />
                </div>

                <Button
                  className="w-full"
                  disabled={complete.isPending}
                  onClick={() =>
                    complete.mutate(
                      { review: active, decision, notes, overrideWithoutCheckin: override },
                      { onSuccess: () => setActive(null) },
                    )
                  }
                >
                  Concluir revisão
                </Button>

                <div className="border-t pt-4 space-y-2">
                  <Label className="text-xs">Falta informação para revisar</Label>
                  <Input value={missing} onChange={(e) => setMissing(e.target.value)}
                    placeholder="Ex.: peso atual, check-in não respondido" />
                  <Button
                    variant="outline" size="sm" className="w-full"
                    disabled={!missing.trim() || waitInformation.isPending}
                    onClick={() =>
                      waitInformation.mutate({ review: active, missing }, { onSuccess: () => setActive(null) })
                    }
                  >
                    Marcar como aguardando informação
                  </Button>
                </div>

                <div className="border-t pt-4 space-y-2">
                  <Label className="text-xs">Remarcar esta revisão</Label>
                  <div className="flex gap-2">
                    <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                    <Button
                      variant="outline" size="sm"
                      disabled={!newDate || newDate === active.scheduled_for || reschedule.isPending}
                      onClick={() =>
                        reschedule.mutate({ review: active, date: newDate }, { onSuccess: () => setActive(null) })
                      }
                    >
                      Remarcar
                    </Button>
                  </div>
                  <Button
                    variant="ghost" size="sm"
                    className="w-full text-destructive hover:text-destructive"
                    disabled={cancel.isPending}
                    onClick={() =>
                      cancel.mutate(
                        { review: active, reason: notes.trim() || 'Cancelada pelo nutricionista' },
                        { onSuccess: () => setActive(null) },
                      )
                    }
                  >
                    Cancelar revisão
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </Layout>
  );
}
