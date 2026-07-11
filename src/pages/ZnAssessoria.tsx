import { useMemo, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  useZnAthletes, useZnSubscriptions, useZnPayments, useZnPlans, useZnWebhookEvents,
  useCancelZnSubscription, useZnOutbox, useRetryZnOutbox,
} from '@/hooks/useZnAssessoria';
import {
  ZnSubscriptionStatusBadge, ZnPaymentStatusBadge, ZnAthleteStatusBadge, ZnPlanBadge,
} from '@/components/zn/ZnBadges';
import { Trophy, Users, CreditCard, DollarSign, AlertCircle, ExternalLink, Info, KeyRound, RefreshCw, Cloud, Ticket, Megaphone, Award, Package } from 'lucide-react';
import { ZnApiKeysTab } from '@/components/zn/ZnApiKeysTab';
import { ZnCouponsSection, ZnPromotersSection, ZnPromoterRanking } from '@/components/zn/ZnCouponsTab';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const fmtBRL = (v: number) => `R$ ${Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const fmtDate = (s: string | null) => (s ? format(parseISO(s), "dd/MM/yyyy", { locale: ptBR }) : '—');

export default function ZnAssessoria() {
  const { data: athletes = [] } = useZnAthletes();
  const { data: subs = [] } = useZnSubscriptions();
  const { data: payments = [] } = useZnPayments();
  const { data: plans = [] } = useZnPlans();
  const { data: events = [] } = useZnWebhookEvents();
  const cancelSub = useCancelZnSubscription();

  const kpis = useMemo(() => {
    const active = subs.filter(s => s.status === 'active').length;
    const overdue = subs.filter(s => s.status === 'overdue').length;
    const pendingAthletes = athletes.filter(a => a.status === 'pending').length;

    const now = new Date();
    const last30 = payments.filter(p => {
      if (!p.paid_at) return false;
      const d = parseISO(p.paid_at);
      return differenceInDays(now, d) <= 30 && (p.status === 'confirmed' || p.status === 'received');
    });
    const revenue30 = last30.reduce((s, p) => s + Number(p.amount || 0), 0);

    // MRR estimado: para cada assinatura ativa, valor do plano / meses do ciclo
    const planByCode = new Map(plans.map(p => [p.code, p]));
    const mrr = subs
      .filter(s => s.status === 'active')
      .reduce((sum, s) => {
        const pl = planByCode.get(s.plan_code);
        if (!pl || !pl.duration_months) return sum;
        return sum + Number(pl.price || 0) / pl.duration_months;
      }, 0);

    return { active, overdue, pendingAthletes, revenue30, mrr };
  }, [subs, athletes, payments, plans]);

  const athletesById = useMemo(
    () => new Map(athletes.map(a => [a.id, a])),
    [athletes],
  );

  const [tab, setTab] = useState('athletes');

  const navCards: { value: string; label: string; icon: React.ReactNode; hint: string }[] = [
    { value: 'athletes', label: 'Atletas', icon: <Users className="h-5 w-5" />, hint: `${athletes.length} cadastrados` },
    { value: 'subscriptions', label: 'Assinaturas', icon: <CreditCard className="h-5 w-5" />, hint: `${subs.length} no total` },
    { value: 'payments', label: 'Pagamentos', icon: <DollarSign className="h-5 w-5" />, hint: `${payments.length} registros` },
    { value: 'coupons', label: 'Cupons', icon: <Ticket className="h-5 w-5" />, hint: 'Descontos e grátis' },
    { value: 'promoters', label: 'Criadores', icon: <Megaphone className="h-5 w-5" />, hint: 'Afiliados / divulgação' },
    { value: 'ranking', label: 'Ranking', icon: <Award className="h-5 w-5" />, hint: 'Quem mais converte' },
    { value: 'plans', label: 'Planos', icon: <Package className="h-5 w-5" />, hint: 'Catálogo' },
    { value: 'sync', label: 'Sincronização', icon: <Cloud className="h-5 w-5" />, hint: 'Zona Nutri' },
    { value: 'api', label: 'API Pública', icon: <KeyRound className="h-5 w-5" />, hint: 'Chaves de acesso' },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Trophy className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">ZN Assessoria</h1>
            <p className="text-sm text-muted-foreground">
              Módulo isolado. Cadastro, assinaturas e pagamentos separados da consultoria.
            </p>
          </div>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Como funciona</AlertTitle>
          <AlertDescription className="text-xs">
            Pagamentos aprovados no Asaas caem no webhook <code>/functions/v1/zn-asaas-webhook</code>,
            criam automaticamente o atleta, a assinatura e o registro do pagamento — tudo em tabelas
            <code> zn_*</code> separadas. Integração com Zona Nutri fica preparada em fila (nenhum envio agora).
          </AlertDescription>
        </Alert>

        {/* KPIs */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          <KpiCard icon={<CreditCard className="h-4 w-4" />} label="Assinaturas ativas" value={kpis.active.toString()} />
          <KpiCard icon={<AlertCircle className="h-4 w-4 text-destructive" />} label="Atrasadas" value={kpis.overdue.toString()} />
          <KpiCard icon={<Users className="h-4 w-4" />} label="Atletas pendentes" value={kpis.pendingAthletes.toString()} />
          <KpiCard icon={<DollarSign className="h-4 w-4 text-green-500" />} label="Receita 30d" value={fmtBRL(kpis.revenue30)} />
          <KpiCard icon={<DollarSign className="h-4 w-4 text-primary" />} label="MRR estimado" value={fmtBRL(kpis.mrr)} />
        </div>

        {/* Dashboard — botões de acesso rápido */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {navCards.map(c => (
            <button
              key={c.value}
              onClick={() => setTab(c.value)}
              className={`text-left rounded-xl border p-4 transition hover:border-primary hover:bg-primary/5 ${tab === c.value ? 'border-primary bg-primary/5' : 'border-border'}`}
            >
              <div className="flex items-center gap-2 text-primary mb-2">{c.icon}</div>
              <div className="font-semibold text-foreground text-sm">{c.label}</div>
              <div className="text-xs text-muted-foreground">{c.hint}</div>
            </button>
          ))}
        </div>

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="athletes">Atletas ({athletes.length})</TabsTrigger>
            <TabsTrigger value="subscriptions">Assinaturas ({subs.length})</TabsTrigger>
            <TabsTrigger value="payments">Pagamentos ({payments.length})</TabsTrigger>
            <TabsTrigger value="coupons"><Ticket className="h-3 w-3 mr-1" />Cupons</TabsTrigger>
            <TabsTrigger value="promoters"><Megaphone className="h-3 w-3 mr-1" />Criadores</TabsTrigger>
            <TabsTrigger value="ranking"><Award className="h-3 w-3 mr-1" />Ranking</TabsTrigger>
            <TabsTrigger value="plans">Planos</TabsTrigger>
            <TabsTrigger value="events">Eventos webhook</TabsTrigger>
            <TabsTrigger value="sync"><Cloud className="h-3 w-3 mr-1" />Sincronização</TabsTrigger>
            <TabsTrigger value="api"><KeyRound className="h-3 w-3 mr-1" />API Pública</TabsTrigger>
          </TabsList>

          <TabsContent value="athletes">
            <Card>
              <CardHeader><CardTitle className="text-sm">Atletas ZN</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>1º pagamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {athletes.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum atleta ZN ainda.</TableCell></TableRow>
                    )}
                    {athletes.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.name}</TableCell>
                        <TableCell className="text-muted-foreground">{a.email}</TableCell>
                        <TableCell className="text-muted-foreground">{a.phone ?? '—'}</TableCell>
                        <TableCell><ZnAthleteStatusBadge status={a.status} /></TableCell>
                        <TableCell className="text-muted-foreground">{fmtDate(a.first_payment_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subscriptions">
            <Card>
              <CardHeader><CardTitle className="text-sm">Assinaturas</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Atleta</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Expira em</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subs.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma assinatura.</TableCell></TableRow>
                    )}
                    {subs.map(s => {
                      const a = athletesById.get(s.athlete_id);
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{a?.name ?? '—'}</TableCell>
                          <TableCell><ZnPlanBadge plan={s.plan_code} /></TableCell>
                          <TableCell><ZnSubscriptionStatusBadge status={s.status} /></TableCell>
                          <TableCell className="text-muted-foreground">{fmtDate(s.start_date)}</TableCell>
                          <TableCell className="text-muted-foreground">{fmtDate(s.expires_at)}</TableCell>
                          <TableCell className="text-right">
                            {s.status !== 'cancelled' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (confirm('Cancelar esta assinatura no sistema? (não cancela no Asaas)')) {
                                    cancelSub.mutate(s.id);
                                  }
                                }}
                              >
                                Cancelar
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <Card>
              <CardHeader><CardTitle className="text-sm">Pagamentos recentes</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Atleta</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pago em</TableHead>
                      <TableHead>Fatura</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum pagamento registrado.</TableCell></TableRow>
                    )}
                    {payments.map(p => {
                      const a = p.athlete_id ? athletesById.get(p.athlete_id) : null;
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{a?.name ?? '—'}</TableCell>
                          <TableCell>{fmtBRL(p.amount)}</TableCell>
                          <TableCell className="uppercase text-xs">{p.billing_type ?? '—'}</TableCell>
                          <TableCell><ZnPaymentStatusBadge status={p.status} /></TableCell>
                          <TableCell className="text-muted-foreground">{fmtDate(p.paid_at)}</TableCell>
                          <TableCell>
                            {p.invoice_url ? (
                              <a href={p.invoice_url} target="_blank" rel="noreferrer" className="text-primary hover:underline text-xs inline-flex items-center gap-1">
                                <ExternalLink className="h-3 w-3" /> Abrir
                              </a>
                            ) : '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="coupons">
            <ZnCouponsSection />
          </TabsContent>

          <TabsContent value="promoters">
            <ZnPromotersSection />
          </TabsContent>

          <TabsContent value="ranking">
            <ZnPromoterRanking />
          </TabsContent>

          <TabsContent value="plans">
            <Card>
              <CardHeader><CardTitle className="text-sm">Catálogo de planos</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-3">
                  {plans.map(pl => (
                    <Card key={pl.id} className="border-primary/20">
                      <CardContent className="p-4 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-foreground">{pl.name}</p>
                          <ZnPlanBadge plan={pl.code} />
                        </div>
                        <p className="text-xs text-muted-foreground">{pl.duration_months} {pl.duration_months === 1 ? 'mês' : 'meses'}</p>
                        <p className="text-lg font-bold text-primary">{fmtBRL(pl.price)}</p>
                        {!pl.is_active && <Badge variant="outline">Inativo</Badge>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Edição de preços será liberada em Configurações → ZN Assessoria (próxima etapa).
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events">
            <Card>
              <CardHeader><CardTitle className="text-sm">Últimos eventos recebidos do Asaas</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recebido em</TableHead>
                      <TableHead>Evento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Erro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum evento ainda.</TableCell></TableRow>
                    )}
                    {events.map(e => (
                      <TableRow key={e.id}>
                        <TableCell className="text-xs text-muted-foreground">{fmtDate(e.received_at)} {e.received_at ? format(parseISO(e.received_at), 'HH:mm') : ''}</TableCell>
                        <TableCell className="font-mono text-xs">{e.event_type}</TableCell>
                        <TableCell>
                          <Badge variant={
                            e.status === 'processed' ? 'default' :
                            e.status === 'failed' ? 'destructive' :
                            'outline'
                          }>{e.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-destructive max-w-[300px] truncate">{e.error ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sync">
            <ZnSyncTab />
          </TabsContent>

          <TabsContent value="api">
            <ZnApiKeysTab />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          {icon} {label}
        </div>
        <p className="text-lg font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function ZnSyncTab() {
  const { data: rows = [], isLoading } = useZnOutbox();
  const retry = useRetryZnOutbox();

  const counts = useMemo(() => {
    return rows.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [rows]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-sm">Sincronização Zona Nutri</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Fila de eventos enviados ao Zona Nutri (idempotentes, com retry automático em até 5 tentativas).
          </p>
          <div className="flex gap-2 mt-2 text-xs">
            <Badge variant="outline">Pendentes: {counts.pending ?? 0}</Badge>
            <Badge className="bg-green-600">Enviados: {counts.sent ?? 0}</Badge>
            <Badge variant="destructive">Erros: {counts.error ?? 0}</Badge>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => retry.mutate(undefined)} disabled={retry.isPending}>
          <RefreshCw className={`h-3 w-3 mr-1 ${retry.isPending ? 'animate-spin' : ''}`} />
          Reprocessar fila
        </Button>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Criado em</TableHead>
              <TableHead>Evento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tentativas</TableHead>
              <TableHead>HTTP</TableHead>
              <TableHead>Último erro</TableHead>
              <TableHead>Próxima tentativa</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>
            )}
            {!isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum evento na fila.</TableCell></TableRow>
            )}
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="text-xs text-muted-foreground">
                  {fmtDate(r.created_at)} {format(parseISO(r.created_at), 'HH:mm')}
                </TableCell>
                <TableCell className="font-mono text-xs">{r.event_type}</TableCell>
                <TableCell>
                  <Badge variant={
                    r.status === 'sent' ? 'default' :
                    r.status === 'error' ? 'destructive' :
                    'outline'
                  }>{r.status}</Badge>
                </TableCell>
                <TableCell className="text-xs">{r.attempts ?? 0}</TableCell>
                <TableCell className="text-xs">{r.http_status ?? '—'}</TableCell>
                <TableCell className="text-xs text-destructive max-w-[280px] truncate">{r.last_error ?? '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.next_attempt_at ? `${fmtDate(r.next_attempt_at)} ${format(parseISO(r.next_attempt_at), 'HH:mm')}` : '—'}
                </TableCell>
                <TableCell className="text-right">
                  {r.status !== 'sent' && (
                    <Button size="sm" variant="ghost" onClick={() => retry.mutate(r.id)} disabled={retry.isPending}>
                      Tentar agora
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
