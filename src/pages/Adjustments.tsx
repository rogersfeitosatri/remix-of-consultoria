import { useMemo, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Link } from 'react-router-dom';
import { useAdjustments } from '@/hooks/useAdjustments';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import {
  referenceMonday, checkinFrequencyLabel, adjustmentRuleLabel, ADJUSTMENTS_REFERENCE_START,
} from '@/lib/adjustments';
import { format, parseISO, addWeeks, subWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  SlidersHorizontal, ChevronLeft, ChevronRight, Bell, BellRing, ChevronDown,
  CalendarClock, ArrowRight, Loader2, ClipboardList,
} from 'lucide-react';

const fmt = (d: string) => format(parseISO(d), "dd 'de' MMM, yyyy", { locale: ptBR });
const fmtShort = (d: string) => format(parseISO(d), 'dd/MM/yy', { locale: ptBR });

export default function Adjustments() {
  const [refMonday, setRefMonday] = useState<Date>(() => referenceMonday());
  const { targets, dueOn, isLoading } = useAdjustments(refMonday);
  const push = usePushNotifications();

  const refStr = format(refMonday, 'yyyy-MM-dd');
  const dueThisWeek = useMemo(() => dueOn(refStr), [dueOn, refStr]);

  // Próximas 8 segundas-feiras com ajustes (a partir da referência)
  const upcoming = useMemo(() => {
    const allDates = new Set<string>();
    targets.forEach((t) =>
      t.info.adjustmentDates.forEach((d) => {
        if (d >= refStr) allDates.add(d);
      }),
    );
    return [...allDates]
      .sort()
      .slice(0, 8)
      .map((date) => ({ date, clients: dueOn(date) }));
  }, [targets, dueOn, refStr]);

  const goPrevWeek = () => setRefMonday((d) => subWeeks(d, 1));
  const goNextWeek = () => setRefMonday((d) => addWeeks(d, 1));

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
              <SlidersHorizontal className="h-6 w-6 text-primary" />
              Ajustes
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Atletas de consultoria (sem consultas ou só 1 inicial) que fecham o bloco mensal e precisam de ajuste no plano.
            </p>
          </div>
          <Button
            variant={push.enabled ? 'secondary' : 'default'}
            onClick={push.enable}
            disabled={push.status === 'loading' || !push.supported}
            className="gap-2 shrink-0"
            title={!push.supported ? 'Notificações não suportadas neste navegador' : undefined}
          >
            {push.status === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> :
              push.enabled ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
            {push.enabled ? 'Notificações ativas' : 'Ativar notificações'}
          </Button>
        </div>

        {push.error && (
          <p className="text-xs text-destructive">Push: {push.error}</p>
        )}

        {/* Week navigator */}
        <Card>
          <CardContent className="p-3 flex items-center justify-between gap-3">
            <Button variant="ghost" size="sm" onClick={goPrevWeek} className="gap-1">
              <ChevronLeft className="h-4 w-4" /> Semana anterior
            </Button>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Segunda de referência</p>
              <p className="text-sm font-semibold capitalize">{fmt(refStr)}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={goNextWeek} className="gap-1">
              Próxima semana <ChevronRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Ajustes desta semana */}
            <Card className="border-primary/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  Ajustes nesta segunda ({fmtShort(refStr)})
                  <Badge variant="secondary" className="ml-auto">{dueThisWeek.length}</Badge>
                </CardTitle>
                <CardDescription>Atletas que fecham o bloco mensal nesta data.</CardDescription>
              </CardHeader>
              <CardContent>
                {dueThisWeek.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Nenhum ajuste programado para esta segunda.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {dueThisWeek.map(({ client, info }) => (
                      <Link
                        key={client.id}
                        to={`/clients/${client.id}?tab=checkins`}
                        className="flex items-center justify-between gap-2 rounded-lg border p-3 hover:bg-accent transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">{client.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {checkinFrequencyLabel(client.checkin_frequency)} · {info.sentCheckins}/{info.totalCheckins} checkins enviados
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Próximas semanas */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Próximos fechamentos de bloco</CardTitle>
                <CardDescription>Próximas segundas com ajustes a partir de {fmtShort(refStr)}.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {upcoming.length === 0 && (
                  <p className="text-sm text-muted-foreground">Sem ajustes futuros nas próximas semanas.</p>
                )}
                {upcoming.map(({ date, clients }) => (
                  <div key={date} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <CalendarClock className="h-3.5 w-3.5 text-primary" />
                      <span className="text-sm font-semibold capitalize">{fmt(date)}</span>
                      <Badge variant="outline" className="ml-auto text-[10px]">{clients.length} atleta(s)</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {clients.map(({ client }) => (
                        <Link key={client.id} to={`/clients/${client.id}?tab=checkins`}>
                          <Badge variant="secondary" className="cursor-pointer hover:bg-accent text-[11px]">
                            {client.name}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Tabela geral */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  Todos os atletas em ciclo de ajuste
                  <Badge variant="secondary" className="ml-auto">{targets.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Atleta</TableHead>
                        <TableHead>Checkin</TableHead>
                        <TableHead>Regra do ajuste</TableHead>
                        <TableHead className="text-right">Enviados</TableHead>
                        <TableHead>Último ajuste</TableHead>
                        <TableHead>Próximo ajuste</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {targets.map(({ client, info }) => {
                        const dueNow = info.nextAdjustment === refStr;
                        return (
                          <TableRow key={client.id} className={dueNow ? 'bg-primary/5' : ''}>
                            <TableCell className="font-medium">
                              <Link to={`/clients/${client.id}?tab=checkins`} className="hover:underline">
                                {client.name}
                              </Link>
                            </TableCell>
                            <TableCell><Badge variant="outline" className="text-[10px]">{checkinFrequencyLabel(client.checkin_frequency)}</Badge></TableCell>
                            <TableCell className="text-xs text-muted-foreground">{adjustmentRuleLabel(client.checkin_frequency)}</TableCell>
                            <TableCell className="text-right text-sm">{info.sentCheckins}/{info.totalCheckins}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{info.lastAdjustment ? fmtShort(info.lastAdjustment) : '—'}</TableCell>
                            <TableCell className="text-xs">
                              {info.nextAdjustment ? (
                                <span className={dueNow ? 'font-semibold text-primary' : 'text-foreground'}>
                                  {fmtShort(info.nextAdjustment)}{dueNow && ' · esta segunda'}
                                </span>
                              ) : '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {targets.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground text-xs py-6">Nenhum atleta de consultoria sem consultas no momento.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Auditoria */}
            <Collapsible>
              <Card>
                <CollapsibleTrigger asChild>
                  <button type="button" className="w-full">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between cursor-pointer hover:bg-muted/30 rounded-t-lg">
                      <CardTitle className="text-sm">Auditoria de cálculo (datas de ajuste por atleta)</CardTitle>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="text-xs space-y-3">
                    <p className="text-muted-foreground">
                      Referência a partir de {fmtShort(ADJUSTMENTS_REFERENCE_START)}. Cada data abaixo é uma segunda em que o atleta fecha o bloco mensal (com o nº do checkin correspondente).
                    </p>
                    {targets.map(({ client, info }) => (
                      <div key={client.id} className="rounded border p-2">
                        <p className="font-medium text-foreground">{client.name} <span className="text-muted-foreground font-normal">· {checkinFrequencyLabel(client.checkin_frequency)} · {adjustmentRuleLabel(client.checkin_frequency)}</span></p>
                        <p className="text-muted-foreground mt-1">
                          {info.adjustmentDates.length === 0 ? 'Sem datas calculadas (sem checkins programados).' :
                            info.adjustmentDates.map((d, i) => `${fmtShort(d)} (checkin ${info.adjustmentCheckinIndices[i]})`).join('  ·  ')}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </>
        )}
      </div>
    </Layout>
  );
}
