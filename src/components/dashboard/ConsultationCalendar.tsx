import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { ConsultationSchedule } from '@/hooks/useClients';
import { format, parseISO, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConsultationCalendarProps {
  consultations: (ConsultationSchedule & { client_name: string })[];
}

export function ConsultationCalendar({ consultations }: ConsultationCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const consultationDates = consultations.map(c => parseISO(c.scheduled_date));
  
  const consultationsOnSelectedDate = selectedDate 
    ? consultations.filter(c => isSameDay(parseISO(c.scheduled_date), selectedDate))
    : [];

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <CalendarDays className="h-5 w-5 text-primary" />
          Calendário de Consultas
        </CardTitle>
        <CardDescription>Consultas agendadas do mês</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row gap-4">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            locale={ptBR}
            className="rounded-md border border-border pointer-events-auto"
            modifiers={{
              hasConsultation: consultationDates,
            }}
            modifiersStyles={{
              hasConsultation: {
                backgroundColor: 'hsl(var(--primary))',
                color: 'hsl(var(--primary-foreground))',
                borderRadius: '50%',
              },
            }}
          />
          
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm text-foreground mb-3">
              {selectedDate 
                ? format(selectedDate, "d 'de' MMMM", { locale: ptBR })
                : 'Selecione uma data'}
            </h4>
            
            {consultationsOnSelectedDate.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma consulta agendada para esta data.
              </p>
            ) : (
              <div className="space-y-2">
                {consultationsOnSelectedDate.map(consultation => (
                  <div
                    key={consultation.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border",
                      consultation.status === 'completed' 
                        ? "bg-muted/50 border-muted" 
                        : "bg-primary/10 border-primary/20"
                    )}
                  >
                    <User className="h-4 w-4 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {consultation.client_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {consultation.status === 'completed' ? 'Realizada' : 
                         consultation.status === 'sent' ? 'Link enviado' : 'Pendente'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}