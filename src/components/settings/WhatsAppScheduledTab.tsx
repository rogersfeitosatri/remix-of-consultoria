import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Video, VideoOff, Clock, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getTemplateLabel } from '@/hooks/useWhatsAppTemplates';

interface ScheduledMessage {
  id: string;
  type: string;
  template_key: string;
  template_title?: string;
  template_name?: string;
  scheduled_for: string;
  client_name: string;
  client_phone: string;
  client_email: string | null;
  appointment_date?: string | null;
  appointment_time?: string | null;
  has_meet_link: boolean;
  status: string;
  context_data?: Record<string, unknown>;
}

interface WhatsAppScheduledTabProps {
  messages: ScheduledMessage[];
  isLoading: boolean;
}

export function WhatsAppScheduledTab({ messages, isLoading }: WhatsAppScheduledTabProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        Nenhuma mensagem programada no momento.
      </div>
    );
  }

  const getStatusBadge = (status: string, hasMeetLink: boolean) => {
    if (status === 'sent') {
      return (
        <Badge variant="default" className="bg-green-500">
          <CheckCircle className="h-3 w-3 mr-1" />
          Enviado
        </Badge>
      );
    }
    if (status === 'pending_meet') {
      return (
        <Badge variant="destructive">
          <VideoOff className="h-3 w-3 mr-1" />
          Sem Meet
        </Badge>
      );
    }
    if (status === 'failed') {
      return (
        <Badge variant="destructive">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Falhou
        </Badge>
      );
    }
    if (status === 'cancelled') {
      return (
        <Badge variant="secondary">
          Cancelado
        </Badge>
      );
    }
    return (
      <Badge variant="outline">
        <Clock className="h-3 w-3 mr-1" />
        Agendado
      </Badge>
    );
  };

  // Group by status for better visualization
  const scheduled = messages.filter(m => m.status === 'scheduled');
  const pendingMeet = messages.filter(m => m.status === 'pending_meet');
  const sent = messages.filter(m => m.status === 'sent');
  const failed = messages.filter(m => m.status === 'failed');

  const sortedMessages = [...pendingMeet, ...failed, ...scheduled, ...sent];

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-amber-600 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Atualização automática:</strong> Se você alterar um template na Central, 
              todas as mensagens programadas usarão a nova versão automaticamente!
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-sm">
            <Clock className="h-3 w-3 mr-1" />
            {scheduled.length} agendadas
          </Badge>
          {pendingMeet.length > 0 && (
            <Badge variant="destructive" className="text-sm">
              <VideoOff className="h-3 w-3 mr-1" />
              {pendingMeet.length} sem Meet
            </Badge>
          )}
          {failed.length > 0 && (
            <Badge variant="destructive" className="text-sm">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {failed.length} falharam
            </Badge>
          )}
          <Badge variant="default" className="bg-green-500 text-sm">
            <CheckCircle className="h-3 w-3 mr-1" />
            {sent.length} enviadas
          </Badge>
        </div>

        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Atleta</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Consulta</TableHead>
                <TableHead>Envio Programado</TableHead>
                <TableHead>Meet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedMessages.map((msg) => (
                <TableRow 
                  key={msg.id} 
                  className={
                    msg.status === 'pending_meet' ? 'bg-red-50 dark:bg-red-950' : 
                    msg.status === 'failed' ? 'bg-red-50 dark:bg-red-950' : ''
                  }
                >
                  <TableCell>
                    {getStatusBadge(msg.status, msg.has_meet_link)}
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge variant="outline" className="max-w-[150px] truncate">
                          {msg.template_title || getTemplateLabel(msg.template_key)}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-medium">{msg.template_name || msg.template_key}</p>
                        <p className="text-xs text-muted-foreground">
                          Título: {msg.template_title || 'Não definido'}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="font-medium">
                    {msg.client_name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono">
                    {msg.client_phone}
                  </TableCell>
                  <TableCell className="text-sm">
                    {msg.appointment_date ? (
                      <>
                        {format(parseISO(msg.appointment_date), "dd/MM/yyyy", { locale: ptBR })}
                        {msg.appointment_time && ` às ${msg.appointment_time.substring(0, 5)}`}
                      </>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(parseISO(msg.scheduled_for), "dd/MM HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger>
                        {msg.has_meet_link ? (
                          <Video className="h-4 w-4 text-green-500" />
                        ) : (
                          <VideoOff className="h-4 w-4 text-red-500" />
                        )}
                      </TooltipTrigger>
                      <TooltipContent>
                        {msg.has_meet_link ? 'Link do Meet configurado' : 'Sem link do Meet - mensagem não será enviada'}
                      </TooltipContent>
                    </Tooltip>
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