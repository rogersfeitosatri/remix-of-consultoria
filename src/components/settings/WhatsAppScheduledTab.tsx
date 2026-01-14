import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Video, VideoOff, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ScheduledMessage {
  id: string;
  type: string;
  scheduled_for: string;
  client_name: string;
  client_phone: string;
  client_email: string | null;
  appointment_date: string;
  appointment_time: string;
  has_meet_link: boolean;
  status: string;
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
    if (status === 'overdue') {
      return (
        <Badge variant="secondary" className="bg-yellow-500 text-white">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Atrasado
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

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'reminder_15m': return 'Lembrete 15min';
      case 'booking_invite': return 'Convite';
      default: return type;
    }
  };

  // Group by status for better visualization
  const scheduled = messages.filter(m => m.status === 'scheduled');
  const pendingMeet = messages.filter(m => m.status === 'pending_meet');
  const sent = messages.filter(m => m.status === 'sent');
  const overdue = messages.filter(m => m.status === 'overdue');

  const sortedMessages = [...pendingMeet, ...overdue, ...scheduled, ...sent];

  return (
    <TooltipProvider>
      <div className="space-y-4">
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
          {overdue.length > 0 && (
            <Badge variant="secondary" className="bg-yellow-500 text-white text-sm">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {overdue.length} atrasadas
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
                <TableHead>Tipo</TableHead>
                <TableHead>Atleta</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Consulta</TableHead>
                <TableHead>Envio Programado</TableHead>
                <TableHead>Meet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedMessages.map((msg) => (
                <TableRow key={msg.id} className={msg.status === 'pending_meet' ? 'bg-red-50 dark:bg-red-950' : ''}>
                  <TableCell>
                    {getStatusBadge(msg.status, msg.has_meet_link)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{getTypeLabel(msg.type)}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {msg.client_name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono">
                    {msg.client_phone}
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(parseISO(msg.appointment_date), "dd/MM/yyyy", { locale: ptBR })} às {msg.appointment_time.substring(0, 5)}
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
