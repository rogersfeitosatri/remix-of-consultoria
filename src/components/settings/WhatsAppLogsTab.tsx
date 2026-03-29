import { useState } from 'react';
import { WhatsAppMessageLog } from '@/hooks/useWhatsAppTemplates';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle, XCircle, AlertCircle, Clock, Search, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface WhatsAppLogsTabProps {
  logs: WhatsAppMessageLog[];
  isLoading: boolean;
}

export function WhatsAppLogsTab({ logs, isLoading }: WhatsAppLogsTabProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

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
      case 'success': return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'skipped': return <AlertCircle className="h-4 w-4 text-amber-500" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'reminder_15m': return 'Lembrete 15min';
      case 'booking_invite': return 'Convite Agend.';
      case 'booking_confirmed': return 'Confirmação';
      case 'confirmation': return 'Confirmação';
      case 'weekly_booking_link': return 'Link Semanal';
      case 'checkin_reminder': return 'Check-in';
      case 'broadcast': return 'Broadcast';
      default: return type;
    }
  };

  // Get unique types for filter
  const uniqueTypes = [...new Set(logs.map(l => l.message_type))];

  const filtered = logs.filter(log => {
    if (statusFilter !== 'all' && log.status !== statusFilter) return false;
    if (typeFilter !== 'all' && log.message_type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (log.clients?.name || '').toLowerCase().includes(q) ||
             log.to_phone.includes(q);
    }
    return true;
  });

  return (
    <TooltipProvider>
      <div className="space-y-3">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[150px]">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar atleta ou telefone..."
              className="pl-8 h-8 text-xs"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[110px] h-8 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="success">Enviados</SelectItem>
              <SelectItem value="failed">Falhas</SelectItem>
              <SelectItem value="skipped">Ignorados</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos tipos</SelectItem>
              {uniqueTypes.map(t => (
                <SelectItem key={t} value={t}>{getTypeLabel(t)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{filtered.length} registros</span>
        </div>

        <ScrollArea className="h-[450px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Atleta</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((log) => (
                <TableRow key={log.id} className={log.status === 'failed' ? 'bg-destructive/5' : ''}>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger>{getStatusIcon(log.status)}</TooltipTrigger>
                      <TooltipContent>
                        {log.status === 'success' ? 'Enviado' :
                         log.status === 'failed' ? 'Falhou' :
                         log.status === 'skipped' ? 'Ignorado' : log.status}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{getTypeLabel(log.message_type)}</Badge>
                  </TableCell>
                  <TableCell className="font-medium text-sm">{log.clients?.name || '-'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{log.to_phone}</TableCell>
                  <TableCell className="text-xs">
                    {format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    {log.error_message ? (
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="text-xs text-destructive truncate block">
                            {log.error_message.substring(0, 50)}...
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[300px]">
                          <p className="text-xs">{log.error_message}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : log.payload_preview ? (
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="text-xs text-muted-foreground truncate block">
                            {log.payload_preview.substring(0, 40)}...
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[400px]">
                          <pre className="text-xs whitespace-pre-wrap">{log.payload_preview}</pre>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
}
