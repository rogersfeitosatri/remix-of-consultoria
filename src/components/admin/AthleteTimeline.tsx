import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  FileText, Video, MessageSquare, Utensils, Send, Settings, 
  ChevronDown, ChevronUp
} from 'lucide-react';
import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface TimelineEvent {
  id: string;
  date: string;
  type: 'anamnese' | 'consultation' | 'checkin' | 'meal_plan' | 'whatsapp' | 'diet_adjustment';
  title: string;
  description?: string;
  icon: React.ReactNode;
  color: string;
}

const typeConfig = {
  anamnese: { icon: <FileText className="h-3.5 w-3.5" />, color: 'bg-blue-500' },
  consultation: { icon: <Video className="h-3.5 w-3.5" />, color: 'bg-primary' },
  checkin: { icon: <MessageSquare className="h-3.5 w-3.5" />, color: 'bg-success' },
  meal_plan: { icon: <Utensils className="h-3.5 w-3.5" />, color: 'bg-purple-500' },
  whatsapp: { icon: <Send className="h-3.5 w-3.5" />, color: 'bg-green-600' },
  diet_adjustment: { icon: <Settings className="h-3.5 w-3.5" />, color: 'bg-yellow-600' },
};

export function AthleteTimeline({ clientId }: { clientId: string }) {
  const [expanded, setExpanded] = useState(false);
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['athlete-timeline', clientId],
    queryFn: async () => {
      const timeline: TimelineEvent[] = [];

      // Fetch in parallel
      const [anamneseRes, appointmentsRes, checkinsRes, mealPlanRes] = await Promise.all([
        supabase.from('anamnese_responses').select('id, submitted_at').eq('client_id', clientId).order('submitted_at', { ascending: false }),
        supabase.from('appointments').select('id, appointment_date, appointment_time, status, google_meet_link').eq('client_id', clientId).in('status', ['confirmed', 'scheduled', 'completed']).order('appointment_date', { ascending: false }),
        supabase.from('checkin_responses').select('id, submitted_at').eq('client_id', clientId).order('submitted_at', { ascending: false }),
        supabase.from('meal_plan_status').select('id, status, sent_at, created_at').eq('client_id', clientId).order('created_at', { ascending: false }),
      ]);

      // Anamnese
      for (const a of anamneseRes.data || []) {
        timeline.push({
          id: `anamnese-${a.id}`,
          date: a.submitted_at,
          type: 'anamnese',
          title: 'Anamnese preenchida',
          icon: typeConfig.anamnese.icon,
          color: typeConfig.anamnese.color,
        });
      }

      // Appointments
      for (const a of appointmentsRes.data || []) {
        const statusLabel = a.status === 'completed' ? 'Realizada' : a.status === 'confirmed' ? 'Confirmada' : 'Agendada';
        timeline.push({
          id: `consult-${a.id}`,
          date: `${a.appointment_date}T${a.appointment_time}`,
          type: 'consultation',
          title: `Consulta ${statusLabel}`,
          description: a.appointment_time?.substring(0, 5),
          icon: typeConfig.consultation.icon,
          color: typeConfig.consultation.color,
        });
      }

      // Check-ins
      for (const c of checkinsRes.data || []) {
        timeline.push({
          id: `checkin-${c.id}`,
          date: c.submitted_at,
          type: 'checkin',
          title: 'Check-in respondido',
          icon: typeConfig.checkin.icon,
          color: typeConfig.checkin.color,
        });
      }

      // Meal plans
      for (const m of mealPlanRes.data || []) {
        timeline.push({
          id: `meal-${m.id}`,
          date: m.sent_at || m.created_at,
          type: 'meal_plan',
          title: m.status === 'sent' ? 'Plano alimentar enviado' : 'Plano alimentar criado',
          icon: typeConfig.meal_plan.icon,
          color: typeConfig.meal_plan.color,
        });
      }

      // WhatsApp
      for (const w of whatsappRes.data || []) {
        const templateLabels: Record<string, string> = {
          checkin_reminder: 'Lembrete de check-in',
          booking_link: 'Link de agendamento',
          consultation_reminder: 'Lembrete de consulta',
          credentials: 'Credenciais enviadas',
        };
        timeline.push({
          id: `wa-${w.id}`,
          date: w.created_at,
          type: 'whatsapp',
          title: templateLabels[w.template_key || ''] || 'Mensagem WhatsApp',
          description: w.status === 'sent' ? 'Enviado' : w.status === 'failed' ? 'Falhou' : w.status,
          icon: typeConfig.whatsapp.icon,
          color: typeConfig.whatsapp.color,
        });
      }

      // Sort by date descending
      timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return timeline;
    },
    enabled: !!clientId,
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (events.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground">
        Nenhuma interação registrada ainda.
      </div>
    );
  }

  const visibleEvents = expanded ? events : events.slice(0, 5);

  return (
    <div className="space-y-1">
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
        
        {visibleEvents.map((event, i) => (
          <div key={event.id} className="relative flex gap-3 pb-3">
            {/* Dot */}
            <div className={cn('relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white', event.color)}>
              {event.icon}
            </div>
            {/* Content */}
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{format(parseISO(event.date), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}</span>
                {event.description && <span>• {event.description}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {events.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-primary hover:underline mx-auto"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? 'Ver menos' : `Ver todas (${events.length})`}
        </button>
      )}
    </div>
  );
}
