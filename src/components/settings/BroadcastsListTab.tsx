import { useState } from 'react';
import { useBroadcasts, useBroadcastRecipients, useCancelBroadcast } from '@/hooks/useBroadcasts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronDown, ChevronRight, XCircle, RefreshCw, Repeat, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { BroadcastPrefill } from './BroadcastComposeDialog';

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'outline' },
  scheduled: { label: 'Agendado', variant: 'secondary' },
  sending: { label: 'Enviando...', variant: 'default' },
  sent: { label: 'Enviado', variant: 'default' },
  partial_failed: { label: 'Parcial', variant: 'destructive' },
  failed: { label: 'Falhou', variant: 'destructive' },
  cancelled: { label: 'Cancelado', variant: 'outline' },
};

interface BroadcastsListTabProps {
  onResend?: (prefill: BroadcastPrefill) => void;
}

export function BroadcastsListTab({ onResend }: BroadcastsListTabProps) {
  const { data: broadcasts = [], isLoading } = useBroadcasts();
  const cancelBroadcast = useCancelBroadcast();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (broadcasts.length === 0) {
    return <div className="text-center p-8 text-muted-foreground">Nenhuma mensagem enviada ainda.</div>;
  }

  const filtered = statusFilter === 'all' 
    ? broadcasts 
    : broadcasts.filter(b => b.status === statusFilter);

  return (
    <div className="space-y-3">
      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Filtrar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="sent">Enviados</SelectItem>
            <SelectItem value="scheduled">Agendados</SelectItem>
            <SelectItem value="sending">Enviando</SelectItem>
            <SelectItem value="failed">Falharam</SelectItem>
            <SelectItem value="cancelled">Cancelados</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} envios</span>
      </div>

      <ScrollArea className="h-[500px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30px]"></TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Destinatários</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Data</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(b => {
              const status = STATUS_MAP[b.status] || { label: b.status, variant: 'outline' as const };
              const isExpanded = expandedId === b.id;
              const isRecurring = (b as any).is_recurring;

              return (
                <>
                  <TableRow key={b.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setExpandedId(isExpanded ? null : b.id)}>
                    <TableCell>
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1.5">
                        {isRecurring && <Repeat className="h-3.5 w-3.5 text-blue-500" />}
                        <span className="truncate max-w-[180px]">{b.internal_title}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant} className={b.status === 'sent' ? 'bg-emerald-500' : ''}>
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <span className="text-emerald-500 font-medium">{b.sent_count}</span>
                        {b.failed_count > 0 && <span className="text-destructive">/{b.failed_count}</span>}
                        <span className="text-muted-foreground">/{b.total_recipients}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {b.send_type === 'scheduled' ? '📅' : '⚡'} {b.send_type === 'scheduled' ? 'Agendado' : 'Imediato'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(b.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        {b.status === 'scheduled' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => cancelBroadcast.mutate(b.id)}
                            title="Cancelar"
                          >
                            <XCircle className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                        {(b.status === 'cancelled' || b.status === 'failed') && onResend && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Reenviar"
                            onClick={() => {
                              onResend({
                                title: b.internal_title,
                                body: b.body,
                                media_url: b.media_url,
                                media_type: b.media_type,
                              });
                            }}
                          >
                            <RefreshCw className="h-4 w-4 text-primary" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {isExpanded && <BroadcastRecipientsRow broadcastId={b.id} />}
                </>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}

function BroadcastRecipientsRow({ broadcastId }: { broadcastId: string }) {
  const { data: recipients = [], isLoading } = useBroadcastRecipients(broadcastId);

  if (isLoading) return (
    <TableRow><TableCell colSpan={7} className="text-center py-2"><Loader2 className="h-4 w-4 animate-spin inline" /></TableCell></TableRow>
  );

  return (
    <>
      {recipients.map(r => (
        <TableRow key={r.id} className="bg-muted/20">
          <TableCell></TableCell>
          <TableCell className="text-sm pl-8">{r.recipient_name || '-'}</TableCell>
          <TableCell>
            <Badge variant={r.status === 'sent' ? 'default' : r.status === 'failed' ? 'destructive' : 'outline'} className={r.status === 'sent' ? 'bg-emerald-500' : ''}>
              {r.status === 'sent' ? 'Enviado' : r.status === 'failed' ? 'Falhou' : 'Na fila'}
            </Badge>
          </TableCell>
          <TableCell className="text-sm font-mono text-muted-foreground">{r.phone}</TableCell>
          <TableCell colSpan={2} className="text-sm text-muted-foreground">
            {r.error_message ? <span className="text-destructive text-xs">{r.error_message.substring(0, 60)}</span> : 
             r.sent_at ? format(new Date(r.sent_at), "HH:mm:ss") : '-'}
          </TableCell>
          <TableCell></TableCell>
        </TableRow>
      ))}
    </>
  );
}
