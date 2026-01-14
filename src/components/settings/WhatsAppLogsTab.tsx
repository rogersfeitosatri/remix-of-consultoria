import { WhatsAppMessageLog } from '@/hooks/useWhatsAppTemplates';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface WhatsAppLogsTabProps {
  logs: WhatsAppMessageLog[];
  isLoading: boolean;
}

export function WhatsAppLogsTab({ logs, isLoading }: WhatsAppLogsTabProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        Nenhum log de mensagem encontrado.
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'skipped':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-500">Enviado</Badge>;
      case 'failed':
        return <Badge variant="destructive">Falhou</Badge>;
      case 'skipped':
        return <Badge variant="secondary">Ignorado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'reminder_15m': return 'Lembrete 15min';
      case 'booking_invite': return 'Convite Agendamento';
      case 'booking_confirmed': return 'Confirmação';
      case 'weekly_booking_link': return 'Link Semanal';
      default: return type;
    }
  };

  return (
    <TooltipProvider>
      <ScrollArea className="h-[500px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Status</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Atleta</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Detalhes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>
                  <Tooltip>
                    <TooltipTrigger>
                      {getStatusIcon(log.status)}
                    </TooltipTrigger>
                    <TooltipContent>
                      {log.status === 'success' ? 'Enviado com sucesso' :
                       log.status === 'failed' ? 'Falha no envio' :
                       log.status === 'skipped' ? 'Envio ignorado' : log.status}
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{getTypeLabel(log.message_type)}</Badge>
                </TableCell>
                <TableCell className="font-medium">
                  {log.clients?.name || 'N/A'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground font-mono">
                  {log.to_phone}
                </TableCell>
                <TableCell className="text-sm">
                  {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </TableCell>
                <TableCell className="max-w-[200px]">
                  {log.error_message ? (
                    <Tooltip>
                      <TooltipTrigger>
                        <span className="text-sm text-red-500 truncate block">
                          {log.error_message.substring(0, 50)}...
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[300px]">
                        <p className="text-sm">{log.error_message}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : log.payload_preview ? (
                    <Tooltip>
                      <TooltipTrigger>
                        <span className="text-sm text-muted-foreground truncate block">
                          {log.payload_preview.substring(0, 50)}...
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[400px]">
                        <pre className="text-xs whitespace-pre-wrap">{log.payload_preview}</pre>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </TooltipProvider>
  );
}
