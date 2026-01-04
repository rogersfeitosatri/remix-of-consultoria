import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConsultationSchedule, Client } from '@/hooks/useClients';
import { format, parseISO, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, User, Send, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface CalendarPreviewProps {
  consultations: (ConsultationSchedule & { client_name: string })[];
  clients?: Client[];
}

export function CalendarPreview({ consultations, clients = [] }: CalendarPreviewProps) {
  const currentMonth = new Date();

  const clientsById = useMemo(() => {
    const map = new Map<string, Client>();
    clients.forEach(c => map.set(c.id, c));
    return map;
  }, [clients]);

  // Calculate consultation number for each schedule
  const getConsultationNumber = (schedule: ConsultationSchedule): { current: number; total: number } | null => {
    const client = clientsById.get(schedule.client_id);
    if (!client || !client.consultation_count) return null;

    const clientConsultations = consultations
      .filter(c => c.client_id === schedule.client_id)
      .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());

    const index = clientConsultations.findIndex(c => c.id === schedule.id);
    if (index === -1) return null;

    return {
      current: index + 1,
      total: client.consultation_count
    };
  };

  const isFirstConsultationRow = (s: ConsultationSchedule) => {
    const first = clientsById.get(s.client_id)?.first_consultation_date;
    return !!first && s.scheduled_date === first && s.send_link_date === first;
  };

  const isSendLinkEventRow = (s: ConsultationSchedule) => {
    return !isFirstConsultationRow(s) && s.status === 'pending';
  };

  // Generate calendar days for the current month view
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // Get events for a specific date
  const getEventsForDate = (date: Date) => {
    const events: { type: 'first' | 'sendLink'; schedule?: ConsultationSchedule & { client_name: string }; client?: Client }[] = [];

    clients
      .filter(c => c.first_consultation_date && c.is_active && isSameDay(parseISO(c.first_consultation_date), date))
      .forEach(client => {
        events.push({ type: 'first', client });
      });

    consultations
      .filter(c => isSendLinkEventRow(c) && isSameDay(parseISO(c.send_link_date), date))
      .forEach(schedule => {
        events.push({ type: 'sendLink', schedule });
      });

    return events;
  };

  const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  return (
    <Card className="border-border bg-card">
      <CardHeader className="p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-foreground text-base sm:text-lg">
              <CalendarDays className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              Calendário de Consultas
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </CardDescription>
          </div>
          <Button asChild size="sm" variant="outline" className="gap-1">
            <Link to="/calendar">
              <span className="hidden sm:inline">Ver completo</span>
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-2 sm:p-4 lg:p-6 pt-0 sm:pt-0 lg:pt-0">
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-emerald-500/20 border border-emerald-500" />
            <span className="text-muted-foreground">1ª Consulta</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-amber-500/20 border border-amber-500" />
            <span className="text-muted-foreground">Enviar Link</span>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="border border-border rounded-lg overflow-hidden">
          {/* Week days header */}
          <div className="grid grid-cols-7 bg-muted/50">
            {weekDays.map((day, i) => (
              <div
                key={`${day}-${i}`}
                className="p-1.5 text-center text-xs font-semibold text-foreground border-b border-border"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, index) => {
              const events = getEventsForDate(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isToday = isSameDay(day, new Date());
              const hasFirstConsultation = events.some(e => e.type === 'first');
              const hasSendLink = events.some(e => e.type === 'sendLink');

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "min-h-[50px] sm:min-h-[60px] p-1 border-b border-r border-border relative flex flex-col",
                    !isCurrentMonth && "bg-muted/30",
                    isToday && "bg-primary/5",
                    index % 7 === 6 && "border-r-0"
                  )}
                >
                  {/* Day number */}
                  <div className={cn(
                    "text-xs font-medium",
                    !isCurrentMonth && "text-muted-foreground/50",
                    isToday && "text-primary font-bold"
                  )}>
                    {format(day, 'd')}
                  </div>

                  {/* Event indicators */}
                  <div className="flex-1 flex items-end gap-0.5 pb-0.5">
                    {hasFirstConsultation && (
                      <div 
                        className="w-2 h-2 rounded-full bg-emerald-500"
                        title="1ª Consulta"
                      />
                    )}
                    {hasSendLink && (
                      <div 
                        className="w-2 h-2 rounded-full bg-amber-500"
                        title="Enviar Link"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming tasks preview */}
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase">Próximas tarefas</p>
          <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
            {consultations
              .filter(c => isSendLinkEventRow(c) && parseISO(c.send_link_date) >= new Date())
              .sort((a, b) => new Date(a.send_link_date).getTime() - new Date(b.send_link_date).getTime())
              .slice(0, 5)
              .map(consultation => {
                const consultNum = getConsultationNumber(consultation);
                const displayName = consultNum 
                  ? `${consultation.client_name} - ${consultNum.current}/${consultNum.total}`
                  : consultation.client_name;

                return (
                  <div
                    key={consultation.id}
                    className="flex items-center gap-2 text-xs p-2 rounded-lg bg-amber-500/10 border border-amber-500/20"
                  >
                    <Send className="h-3 w-3 text-amber-500 flex-shrink-0" />
                    <span className="truncate flex-1 text-foreground">{displayName}</span>
                    <span className="text-muted-foreground text-[10px] flex-shrink-0">
                      {format(parseISO(consultation.send_link_date), 'dd/MM')}
                    </span>
                  </div>
                );
              })}
            {consultations.filter(c => isSendLinkEventRow(c) && parseISO(c.send_link_date) >= new Date()).length === 0 && (
              <p className="text-xs text-muted-foreground py-2 text-center">
                Nenhuma tarefa pendente
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
