import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, Video, User, ExternalLink, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useConsultationAppointments } from '@/hooks/useConsultations';

export function ScheduledAppointmentsView() {
  const { data: appointments = [], isLoading } = useConsultationAppointments();

  // Filter only scheduled/confirmed appointments and sort by date
  const upcomingAppointments = useMemo(() => {
    const today = startOfDay(new Date());
    
    return appointments
      .filter(apt => 
        (apt.status === 'scheduled' || apt.status === 'confirmed') &&
        !isBefore(parseISO(apt.appointment_date), today)
      )
      .sort((a, b) => {
        const dateCompare = a.appointment_date.localeCompare(b.appointment_date);
        if (dateCompare !== 0) return dateCompare;
        return a.appointment_time.localeCompare(b.appointment_time);
      });
  }, [appointments]);

  if (isLoading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="py-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        </CardContent>
      </Card>
    );
  }

  if (upcomingAppointments.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="py-12 text-center">
          <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground">Nenhuma consulta agendada.</p>
        </CardContent>
      </Card>
    );
  }

  // Group by date
  const groupedByDate = useMemo(() => {
    const groups: { date: string; appointments: typeof upcomingAppointments }[] = [];
    
    upcomingAppointments.forEach(apt => {
      const existingGroup = groups.find(g => g.date === apt.appointment_date);
      if (existingGroup) {
        existingGroup.appointments.push(apt);
      } else {
        groups.push({ date: apt.appointment_date, appointments: [apt] });
      }
    });
    
    return groups;
  }, [upcomingAppointments]);

  const isToday = (dateStr: string) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return dateStr === today;
  };

  return (
    <div className="space-y-4">
      {groupedByDate.map(group => {
        const isTodayGroup = isToday(group.date);
        
        return (
          <Card 
            key={group.date}
            className={cn(
              "border-border bg-card",
              isTodayGroup && "border-primary ring-2 ring-primary/20"
            )}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="capitalize">
                  {format(parseISO(group.date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </span>
                {isTodayGroup && (
                  <Badge className="bg-primary text-primary-foreground text-xs">
                    Hoje
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {group.appointments.map(apt => (
                  <div 
                    key={apt.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-full p-2 bg-emerald-500/20">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      </div>
                        <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{typeof apt.client?.name === 'string' ? apt.client.name : 'Cliente'}</p>
                          <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                            Confirmada
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {apt.appointment_time.substring(0, 5)}
                          </span>
                          {apt.google_meet_link && (
                            <a 
                              href={apt.google_meet_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-blue-500 hover:text-blue-600"
                            >
                              <Video className="h-3 w-3" />
                              Google Meet
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        asChild
                        className="h-7 text-xs"
                      >
                        <Link to={`/appointments/${apt.id}`}>
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Detalhes
                        </Link>
                      </Button>
                      {typeof apt.client?.name === 'string' && apt.client.name && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          asChild
                          className="h-7 text-xs"
                        >
                          <Link to={`/clients?search=${encodeURIComponent(String(apt.client.name))}`}>
                            <User className="h-3 w-3 mr-1" />
                            Ver atleta
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
