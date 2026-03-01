import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAllCallBookings, useUpdateCallBooking } from '@/hooks/useCallScheduling';
import { Calendar, ChevronLeft, ChevronRight, Loader2, Clock, User } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, getDay, isSameDay, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  confirmed: { label: 'Confirmado', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  pending: { label: 'Pendente', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  cancelled: { label: 'Cancelado', className: 'bg-destructive/20 text-destructive border-destructive/30' },
  completed: { label: 'Concluído', className: 'bg-primary/20 text-primary border-primary/30' },
  rescheduled: { label: 'Reagendado', className: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
};

export default function CallBookingsCalendar() {
  const { data: bookings = [], isLoading } = useAllCallBookings();
  const updateBooking = useUpdateCallBooking();
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calStart, end: calEnd });

  const bookingsByDate = useMemo(() => {
    const map: Record<string, typeof bookings> = {};
    for (const b of bookings) {
      if (!map[b.booking_date]) map[b.booking_date] = [];
      map[b.booking_date].push(b);
    }
    return map;
  }, [bookings]);

  const selectedBookings = selectedDay ? (bookingsByDate[selectedDay] || []) : [];

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(prev => addMonths(prev, -1))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h3 className="text-lg font-semibold capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
        </h3>
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => (
          <div key={d} className="bg-muted/50 text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
        ))}
        {calendarDays.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayBookings = bookingsByDate[dateStr] || [];
          const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
          const isSelected = selectedDay === dateStr;
          const isToday = isSameDay(day, new Date());
          const activeBookings = dayBookings.filter(b => b.status !== 'cancelled');

          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDay(isSelected ? null : dateStr)}
              className={`
                min-h-[72px] p-1.5 text-left transition-colors bg-background
                ${!isCurrentMonth ? 'opacity-40' : ''}
                ${isSelected ? 'ring-2 ring-primary ring-inset' : ''}
                ${isToday ? 'bg-primary/5' : ''}
                hover:bg-muted/50
              `}
            >
              <span className={`text-xs font-medium ${isToday ? 'text-primary font-bold' : 'text-foreground'}`}>
                {format(day, 'd')}
              </span>
              {activeBookings.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {activeBookings.slice(0, 3).map(b => (
                    <div
                      key={b.id}
                      className={`text-[10px] leading-tight px-1 py-0.5 rounded truncate ${STATUS_CONFIG[b.status]?.className || 'bg-muted text-muted-foreground'}`}
                    >
                      {b.booking_time?.slice(0, 5)} {b.lead_name?.split(' ')[0] || ''}
                    </div>
                  ))}
                  {activeBookings.length > 3 && (
                    <div className="text-[10px] text-muted-foreground px-1">+{activeBookings.length - 3}</div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              {format(parseISO(selectedDay), "EEEE, dd 'de' MMMM", { locale: ptBR })}
              <Badge variant="secondary" className="ml-auto">{selectedBookings.length} reserva(s)</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma reserva nesta data.</p>
            ) : (
              selectedBookings.map(b => {
                const link = (b as any).call_scheduling_links;
                return (
                  <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div className="flex items-center gap-3">
                      <div className="text-center min-w-[50px]">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground mx-auto mb-0.5" />
                        <span className="text-sm font-semibold">{b.booking_time?.slice(0, 5)}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium text-sm">{b.lead_name || 'Sem nome'}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {b.lead_phone || ''} {b.lead_email ? `· ${b.lead_email}` : ''}
                        </p>
                        {link && <p className="text-xs text-primary/70 mt-0.5">{link.title}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={STATUS_CONFIG[b.status]?.className || ''}>
                        {STATUS_CONFIG[b.status]?.label || b.status}
                      </Badge>
                      <Select value={b.status} onValueChange={v => updateBooking.mutate({ id: b.id, status: v } as any)}>
                        <SelectTrigger className="w-[120px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
