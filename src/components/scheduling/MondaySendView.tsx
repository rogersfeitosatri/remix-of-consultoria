import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, startOfWeek, endOfWeek, isSameMonth, addWeeks, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Send, User, Calendar, Clock, ExternalLink, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConsultationSchedule, Client } from '@/hooks/useClients';
import { Link } from 'react-router-dom';

interface MondaySendViewProps {
  consultations: (ConsultationSchedule & { client_name: string })[];
  clients: Client[];
  onMarkAsSent: (id: string) => void;
  onSendLink: (id: string) => void;
}

interface MondayGroup {
  date: Date;
  schedules: (ConsultationSchedule & { client_name: string; consultationIndex?: number })[];
}

export function MondaySendView({ consultations, clients, onMarkAsSent, onSendLink }: MondaySendViewProps) {
  const clientsById = useMemo(() => {
    const map = new Map<string, Client>();
    clients.forEach(c => map.set(c.id, c));
    return map;
  }, [clients]);

  // Format week range with month crossing logic
  const formatWeekRange = (dateStr: string) => {
    const date = parseISO(dateStr);
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
    
    if (isSameMonth(weekStart, weekEnd)) {
      return `${format(weekStart, 'd', { locale: ptBR })} a ${format(weekEnd, 'd \'de\' MMMM', { locale: ptBR })}`;
    }
    return `${format(weekStart, 'd \'de\' MMM', { locale: ptBR })} a ${format(weekEnd, 'd \'de\' MMM', { locale: ptBR })}`;
  };

  // Calculate consultation index for a schedule
  const getConsultationIndex = (schedule: ConsultationSchedule): number => {
    const clientSchedules = consultations
      .filter(c => c.client_id === schedule.client_id)
      .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());
    
    const index = clientSchedules.findIndex(c => c.id === schedule.id);
    return index + 1;
  };

  // Group schedules by Monday (send_link_date)
  const mondayGroups = useMemo(() => {
    const today = startOfDay(new Date());
    const groupMap = new Map<string, MondayGroup>();
    
    // Filter only pending schedules (not scheduled/completed)
    const pendingSchedules = consultations.filter(s => 
      s.status === 'pending' || s.status === 'sent'
    );

    pendingSchedules.forEach(schedule => {
      const sendDate = parseISO(schedule.send_link_date);
      const monday = startOfWeek(sendDate, { weekStartsOn: 1 });
      const key = format(monday, 'yyyy-MM-dd');
      
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          date: monday,
          schedules: [],
        });
      }
      
      groupMap.get(key)!.schedules.push({
        ...schedule,
        consultationIndex: getConsultationIndex(schedule),
      });
    });

    // Sort groups by date and filter to show future + past 4 weeks
    const fourWeeksAgo = addWeeks(today, -4);
    const twelveWeeksAhead = addWeeks(today, 12);
    
    return Array.from(groupMap.values())
      .filter(g => !isBefore(g.date, fourWeeksAgo) && isBefore(g.date, twelveWeeksAhead))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [consultations]);

  const isToday = (date: Date) => {
    const today = startOfDay(new Date());
    return format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
  };

  const isPast = (date: Date) => {
    const today = startOfDay(new Date());
    return isBefore(date, today);
  };

  const isThisWeek = (date: Date) => {
    const today = new Date();
    const thisMonday = startOfWeek(today, { weekStartsOn: 1 });
    const nextMonday = addWeeks(thisMonday, 1);
    return !isBefore(date, thisMonday) && isBefore(date, nextMonday);
  };

  if (mondayGroups.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="py-12 text-center">
          <Send className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground">Nenhum envio de link agendado.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {mondayGroups.map(group => {
        const isCurrentWeek = isThisWeek(group.date);
        const isTodayGroup = isToday(group.date);
        const isPastGroup = isPast(group.date);
        
        return (
          <Card 
            key={format(group.date, 'yyyy-MM-dd')} 
            className={cn(
              "border-border bg-card",
              isCurrentWeek && "border-primary/50 bg-primary/5",
              isTodayGroup && "border-primary ring-2 ring-primary/20"
            )}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span>Segunda-feira, {format(group.date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                  {isCurrentWeek && (
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs">
                      Esta semana
                    </Badge>
                  )}
                  {isTodayGroup && (
                    <Badge className="bg-primary text-primary-foreground text-xs">
                      Hoje
                    </Badge>
                  )}
                  {isPastGroup && !isTodayGroup && (
                    <Badge variant="outline" className="text-muted-foreground text-xs">
                      Passado
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="text-xs">07:00</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {group.schedules.map(schedule => {
                  const client = clientsById.get(schedule.client_id);
                  const isLinkSent = schedule.status === 'sent';
                  
                  return (
                    <div 
                      key={schedule.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border",
                        isLinkSent 
                          ? "bg-emerald-500/10 border-emerald-500/30" 
                          : "bg-muted/50 border-border"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "rounded-full p-2",
                          isLinkSent ? "bg-emerald-500/20" : "bg-amber-500/20"
                        )}>
                          {isLinkSent ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <Send className="h-4 w-4 text-amber-500" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{schedule.client_name}</p>
                            <Badge variant="outline" className="text-xs">
                              Consulta #{schedule.consultationIndex}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Janela: {formatWeekRange(schedule.scheduled_date)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs",
                            isLinkSent 
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" 
                              : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                          )}
                        >
                          {isLinkSent ? 'Enviado' : 'Pendente'}
                        </Badge>
                        
                        {!isLinkSent && (
                          <>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => onSendLink(schedule.id)}
                              className="h-7 text-xs"
                            >
                              <Send className="h-3 w-3 mr-1" />
                              Enviar
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => onMarkAsSent(schedule.id)}
                              className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Marcar enviado
                            </Button>
                          </>
                        )}
                        
                        {client && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            asChild
                            className="h-7 text-xs"
                          >
                            <Link to={`/clients?search=${encodeURIComponent(client.name)}`}>
                              <User className="h-3 w-3 mr-1" />
                              Ver atleta
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
