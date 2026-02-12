import { useState } from 'react';
import { useBroadcasts, useBroadcastRecipients, useCancelBroadcast } from '@/hooks/useBroadcasts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronDown, ChevronRight, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'outline' },
  scheduled: { label: 'Agendado', variant: 'secondary' },
  sending: { label: 'Enviando...', variant: 'default' },
  sent: { label: 'Enviado', variant: 'default' },
  partial_failed: { label: 'Parcial', variant: 'destructive' },
  failed: { label: 'Falhou', variant: 'destructive' },
  cancelled: { label: 'Cancelado', variant: 'outline' },
};

export function BroadcastsListTab() {
  const { data: broadcasts = [], isLoading } = useBroadcasts();
  const cancelBroadcast = useCancelBroadcast();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (broadcasts.length === 0) {
    return <div className="text-center p-8 text-muted-foreground">Nenhuma mensagem enviada ainda.</div>;
  }

  return (
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
          {broadcasts.map(b => {
            const status = STATUS_MAP[b.status] || { label: b.status, variant: 'outline' as const };
            const isExpanded = expandedId === b.id;

            return (
              <>
                <TableRow key={b.id} className="cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : b.id)}>
                  <TableCell>
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </TableCell>
                  <TableCell className="font-medium">{b.internal_title}</TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-green-500">{b.sent_count}</span>
                    {b.failed_count > 0 && <span className="text-red-500 ml-1">/ {b.failed_count} falhas</span>}
                    <span className="text-muted-foreground ml-1">/ {b.total_recipients}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{b.send_type === 'scheduled' ? 'Agendado' : 'Imediato'}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(b.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    {b.status === 'scheduled' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={e => { e.stopPropagation(); cancelBroadcast.mutate(b.id); }}
                      >
                        <XCircle className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
                {isExpanded && <BroadcastRecipientsRow broadcastId={b.id} />}
              </>
            );
          })}
        </TableBody>
      </Table>
    </ScrollArea>
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
            <Badge variant={r.status === 'sent' ? 'default' : r.status === 'failed' ? 'destructive' : 'outline'} className={r.status === 'sent' ? 'bg-green-500' : ''}>
              {r.status === 'sent' ? 'Enviado' : r.status === 'failed' ? 'Falhou' : 'Na fila'}
            </Badge>
          </TableCell>
          <TableCell className="text-sm font-mono text-muted-foreground">{r.phone}</TableCell>
          <TableCell colSpan={2} className="text-sm text-muted-foreground">
            {r.error_message ? <span className="text-red-400">{r.error_message.substring(0, 60)}</span> : 
             r.sent_at ? format(new Date(r.sent_at), "HH:mm:ss") : '-'}
          </TableCell>
          <TableCell></TableCell>
        </TableRow>
      ))}
    </>
  );
}
