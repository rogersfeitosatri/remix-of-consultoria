import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { ConsultationSchedule, Client } from '@/hooks/useClients';
import { format, parseISO, isSameDay, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, User, Send, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConsultationCalendarProps {
  consultations: (ConsultationSchedule & { client_name: string })[];
  clients?: Client[];
}

export function ConsultationCalendar({ consultations, clients = [] }: ConsultationCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  // Dates with scheduled consultations
  const consultationDates = consultations.map(c => parseISO(c.scheduled_date));
  
  // Dates for sending links (Mondays)
  const sendLinkDates = consultations
    .filter(c => c.status === 'pending')
    .map(c => parseISO(c.send_link_date));

  // First consultation dates from clients
  const firstConsultationDates = clients
    .filter(c => c.first_consultation_date && c.is_active)
    .map(c => parseISO(c.first_consultation_date!));

  // Items for selected date
  const consultationsOnSelectedDate = selectedDate 
    ? consultations.filter(c => isSameDay(parseISO(c.scheduled_date), selectedDate))
    : [];

  const sendLinksOnSelectedDate = selectedDate
    ? consultations.filter(c => 
        c.status === 'pending' && 
        isSameDay(parseISO(c.send_link_date), selectedDate)
      )
    : [];

  const firstConsultationsOnSelectedDate = selectedDate
    ? clients.filter(c => 
        c.first_consultation_date && 
        c.is_active &&
        isSameDay(parseISO(c.first_consultation_date), selectedDate)
      )
    : [];

  const hasConsultation = (date: Date) => consultationDates.some(d => isSameDay(d, date));
  const hasSendLink = (date: Date) => sendLinkDates.some(d => isSameDay(d, date));
  const hasFirstConsultation = (date: Date) => firstConsultationDates.some(d => isSameDay(d, date));

  return (
    <Card className="border-border bg-card">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="flex items-center gap-2 text-foreground text-base sm:text-lg">
          <CalendarDays className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          Calendário de Consultas
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">Consultas agendadas e datas de envio de link</CardDescription>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:gap-8">
          <div className="flex-shrink-0 overflow-x-auto">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              locale={ptBR}
              className="rounded-md border border-border pointer-events-auto mx-auto"
            components={{
              DayContent: ({ date }) => {
                const isConsultation = hasConsultation(date);
                const isSendLink = hasSendLink(date);
                const isFirstConsultation = hasFirstConsultation(date);
                const isMonday = getDay(date) === 1;

                return (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <span>{date.getDate()}</span>
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 flex gap-0.5">
                      {isFirstConsultation && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="1ª Consulta" />
                      )}
                      {isConsultation && !isFirstConsultation && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" title="Consulta" />
                      )}
                      {isSendLink && isMonday && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Enviar Link" />
                      )}
                    </div>
                  </div>
                );
              },
            }}
          />
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm text-foreground mb-3">
              {selectedDate 
                ? format(selectedDate, "d 'de' MMMM", { locale: ptBR })
                : 'Selecione uma data'}
            </h4>
            
            {/* Legend */}
            <div className="flex flex-wrap gap-2 sm:gap-3 mb-4 text-xs">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                <span className="text-muted-foreground">1ª Consulta</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                <span className="text-muted-foreground">Consulta</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                <span className="text-muted-foreground">Enviar Link</span>
              </div>
            </div>

            {/* First consultations on selected date */}
            {firstConsultationsOnSelectedDate.length > 0 && (
              <div className="mb-4">
                <h5 className="text-xs font-semibold text-emerald-500 uppercase mb-2 flex items-center gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  1ª Consulta
                </h5>
                <div className="space-y-2">
                  {firstConsultationsOnSelectedDate.map(client => (
                    <div
                      key={client.id}
                      className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border bg-emerald-500/10 border-emerald-500/20"
                    >
                      <User className="h-4 w-4 text-emerald-500" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {client.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Primeira consulta do atleta
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Send links on selected date */}
            {sendLinksOnSelectedDate.length > 0 && (
              <div className="mb-4">
                <h5 className="text-xs font-semibold text-amber-500 uppercase mb-2 flex items-center gap-1">
                  <Send className="h-3 w-3" />
                  Enviar Link de Agendamento
                </h5>
                <div className="space-y-2">
                  {sendLinksOnSelectedDate.map(consultation => (
                    <div
                      key={`link-${consultation.id}`}
                      className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border bg-amber-500/10 border-amber-500/20"
                    >
                      <Send className="h-4 w-4 text-amber-500" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {consultation.client_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Consulta em {format(parseISO(consultation.scheduled_date), "dd/MM/yyyy")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Consultations on selected date */}
            {consultationsOnSelectedDate.length > 0 && (
              <div className="mb-4">
                <h5 className="text-xs font-semibold text-primary uppercase mb-2 flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  Consultas Agendadas
                </h5>
                <div className="space-y-2">
                  {consultationsOnSelectedDate.map(consultation => (
                    <div
                      key={consultation.id}
                      className={cn(
                        "flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border",
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
              </div>
            )}

            {consultationsOnSelectedDate.length === 0 && 
             sendLinksOnSelectedDate.length === 0 && 
             firstConsultationsOnSelectedDate.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum evento agendado para esta data.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
