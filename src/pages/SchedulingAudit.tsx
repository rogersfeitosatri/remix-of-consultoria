import { useMemo, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, AlertTriangle, XCircle, Shield, RefreshCw, Send, Search, Phone, Calendar as CalIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSchedulingAudit } from '@/hooks/useSchedulingAudit';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const BLOCK_REASON_LABELS: Record<string, string> = {
  client_frozen: 'Atleta congelado',
  client_inactive: 'Atleta inativo',
  client_not_found: 'Atleta não encontrado',
  no_consultations_in_plan: 'Sem consultas no plano',
  plan_expired: 'Plano expirado',
  already_scheduled: 'Já tem consulta agendada',
  consultations_exhausted: 'Consultas esgotadas',
  duplicate_window: 'Duplicata (janela de tempo)',
  duplicate_schedule_template: 'Duplicata (mesmo schedule)',
  not_eligible: 'Não elegível',
};

const TRIGGER_LABELS: Record<string, string> = {
  cron_daily: 'Cron diário',
  cron_weekly_legacy: 'Cron semanal (antigo)',
  manual_admin: 'Manual',
  followup_cron: 'Follow-up',
  reminder_24h: 'Lembrete 24h',
  reminder_15m: 'Lembrete 15min',
  system: 'Sistema',
};

export default function SchedulingAudit() {
  const { linksSemRetorno, falhasZapi, bloqueados, isLoading, refetch } = useSchedulingAudit();
  const [search, setSearch] = useState('');
  const [resending, setResending] = useState<string | null>(null);

  const filterRow = (name: string | undefined, phone: string | undefined) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (name || '').toLowerCase().includes(q) || (phone || '').includes(q);
  };

  const noReturnFiltered = useMemo(
    () => linksSemRetorno.filter(r => filterRow(r.clients?.name, r.clients?.phone || undefined)),
    [linksSemRetorno, search]
  );
  const failedFiltered = useMemo(
    () => falhasZapi.filter(r => filterRow(r.clients?.name, r.to_phone)),
    [falhasZapi, search]
  );
  const blockedFiltered = useMemo(
    () => bloqueados.filter(r => filterRow(r.clients?.name, r.to_phone)),
    [bloqueados, search]
  );

  const handleResend = async (clientId: string, scheduleId: string) => {
    setResending(scheduleId);
    try {
      const { data, error } = await supabase.functions.invoke('send-booking-link', {
        body: {
          client_id: clientId,
          consultation_schedule_id: scheduleId,
          triggered_by: 'manual_admin',
          template_key: 'weekly_booking_link',
        },
      });
      if (error) throw error;
      if (data?.status === 'sent' || data?.success) {
        toast.success('Link reenviado com sucesso');
      } else if (data?.blocked_reason) {
        toast.warning(`Bloqueado: ${BLOCK_REASON_LABELS[data.blocked_reason] || data.blocked_reason}`);
      } else {
        toast.info(data?.message || 'Solicitação processada');
      }
      refetch();
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao reenviar');
    } finally {
      setResending(null);
    }
  };

  return (
    <Layout>
      <TooltipProvider>
        <div className="container mx-auto p-4 md:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Shield className="h-6 w-6 text-primary" />
                Auditoria de Consultas
              </h1>
              <p className="text-sm text-muted-foreground">
                Monitoramento dos envios de links, lembretes e follow-ups (últimos 30 dias).
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card className="border-amber-500/30">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 text-xs">
                  <AlertTriangle className="h-4 w-4 text-amber-500" /> Links sem retorno (3+ dias)
                </CardDescription>
                <CardTitle className="text-3xl">{linksSemRetorno.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-destructive/30">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 text-xs">
                  <XCircle className="h-4 w-4 text-destructive" /> Falhas Z-API
                </CardDescription>
                <CardTitle className="text-3xl">{falhasZapi.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-muted-foreground/30">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 text-xs">
                  <Shield className="h-4 w-4 text-muted-foreground" /> Envios bloqueados
                </CardDescription>
                <CardTitle className="text-3xl">{bloqueados.length}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="relative max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filtrar por atleta ou telefone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <Tabs defaultValue="no-return" className="space-y-3">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="no-return">
                Sem retorno ({noReturnFiltered.length})
              </TabsTrigger>
              <TabsTrigger value="failed">
                Falhas ({failedFiltered.length})
              </TabsTrigger>
              <TabsTrigger value="blocked">
                Bloqueados ({blockedFiltered.length})
              </TabsTrigger>
            </TabsList>

            {/* Tab: Links sem retorno */}
            <TabsContent value="no-return">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Links enviados sem agendamento</CardTitle>
                  <CardDescription>
                    Atletas que receberam o link há mais de 3 dias e ainda não escolheram horário.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
                  ) : noReturnFiltered.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center p-6">
                      Nenhum link pendente sem retorno. ✓
                    </p>
                  ) : (
                    <ScrollArea className="h-[420px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Atleta</TableHead>
                            <TableHead>Telefone</TableHead>
                            <TableHead>Consulta prevista</TableHead>
                            <TableHead>Link enviado em</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {noReturnFiltered.map(row => (
                            <TableRow key={row.id}>
                              <TableCell className="font-medium text-sm">
                                {row.clients?.name || '-'}
                              </TableCell>
                              <TableCell className="text-xs font-mono text-muted-foreground">
                                {row.clients?.phone || '-'}
                              </TableCell>
                              <TableCell className="text-xs">
                                <div className="flex items-center gap-1">
                                  <CalIcon className="h-3 w-3 text-muted-foreground" />
                                  {format(new Date(row.scheduled_date + 'T00:00'), 'dd/MM/yy', { locale: ptBR })}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {format(new Date(row.send_link_date + 'T00:00'), 'dd/MM/yy', { locale: ptBR })}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">{row.status}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={resending === row.id}
                                  onClick={() => handleResend(row.client_id, row.id)}
                                >
                                  {resending === row.id
                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                    : <><Send className="h-3 w-3 mr-1" />Reenviar</>}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Falhas Z-API */}
            <TabsContent value="failed">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Falhas no envio (Z-API)</CardTitle>
                  <CardDescription>
                    Mensagens que receberam erro do provedor.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
                  ) : failedFiltered.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center p-6">
                      Nenhuma falha registrada. ✓
                    </p>
                  ) : (
                    <ScrollArea className="h-[420px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Atleta</TableHead>
                            <TableHead>Template</TableHead>
                            <TableHead>Origem</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Erro</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {failedFiltered.map(row => (
                            <TableRow key={row.id}>
                              <TableCell className="text-sm font-medium">
                                {row.clients?.name || '-'}
                                <div className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                                  <Phone className="h-3 w-3" />{row.to_phone}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">{row.template_key || '-'}</Badge>
                              </TableCell>
                              <TableCell className="text-xs">
                                {TRIGGER_LABELS[row.triggered_by || ''] || row.triggered_by || '-'}
                              </TableCell>
                              <TableCell className="text-xs">
                                {format(new Date(row.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                              </TableCell>
                              <TableCell className="max-w-[280px]">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-xs text-destructive truncate block">
                                      {row.error_message?.substring(0, 60) || 'Erro desconhecido'}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-md">
                                    <p className="text-xs whitespace-pre-wrap">{row.error_message}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Bloqueados */}
            <TabsContent value="blocked">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Envios bloqueados (idempotência / elegibilidade)</CardTitle>
                  <CardDescription>
                    Tentativas que foram interceptadas pelo sistema antes de enviar (duplicata, atleta congelado, etc.).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
                  ) : blockedFiltered.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center p-6">
                      Nenhum envio bloqueado. ✓
                    </p>
                  ) : (
                    <ScrollArea className="h-[420px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Atleta</TableHead>
                            <TableHead>Template</TableHead>
                            <TableHead>Motivo</TableHead>
                            <TableHead>Origem</TableHead>
                            <TableHead>Data</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {blockedFiltered.map(row => (
                            <TableRow key={row.id}>
                              <TableCell className="text-sm font-medium">
                                {row.clients?.name || '-'}
                                <div className="text-xs font-mono text-muted-foreground">{row.to_phone}</div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">{row.template_key || '-'}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-xs">
                                  {BLOCK_REASON_LABELS[row.blocked_reason || ''] || row.blocked_reason}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs">
                                {TRIGGER_LABELS[row.triggered_by || ''] || row.triggered_by || '-'}
                              </TableCell>
                              <TableCell className="text-xs">
                                {format(new Date(row.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </TooltipProvider>
    </Layout>
  );
}
