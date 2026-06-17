import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { differenceInCalendarDays, parseISO } from 'date-fns';

// ── Limiares editáveis ──────────────────────────────────────────────────────
const CHECKIN_MORNO_DIAS = 7;
const CHECKIN_FRIO_DIAS = 14;
const CONSULTA_MORNO_DIAS = 5;  // dias antes da janela vencer → Morno
const CICLO_MORNO_DIAS = 15;
// ───────────────────────────────────────────────────────────────────────────

export type Temperatura = 'frio' | 'morno' | 'quente';

interface Sinal {
  nivel: Temperatura;
  motivo: string;
}

export interface PacienteTemperatura {
  client_id: string;
  nome: string;
  phone: string | null;
  temperatura: Temperatura;
  motivo: string;
  acao: 'mensagem' | 'agendar' | 'renovar' | 'nenhuma';
  end_date: string;
}

const CONSULTA_FREQ_DIAS: Record<string, number> = {
  monthly: 30,
  six_weeks: 42,
};

export const ORDEM_TEMPERATURA: Record<Temperatura, number> = { frio: 0, morno: 1, quente: 2 };

function piorSinal(sinais: Sinal[]): Sinal {
  return sinais.reduce((a, b) => (ORDEM_TEMPERATURA[b.nivel] < ORDEM_TEMPERATURA[a.nivel] ? b : a));
}

export function useTemperaturaPacientes() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['temperatura-pacientes', user?.id],
    queryFn: async (): Promise<PacienteTemperatura[]> => {
      if (!user?.id) return [];

      const today = new Date();

      const { data: clients } = await supabase
        .from('clients')
        .select('id, name, phone, end_date, consultation_frequency, has_consultations')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .eq('is_frozen', false);

      if (!clients?.length) return [];

      const clientIds = clients.map(c => c.id);

      // Último check-in respondido por cliente
      const { data: checkins } = await supabase
        .from('checkin_responses')
        .select('client_id, submitted_at')
        .in('client_id', clientIds)
        .order('submitted_at', { ascending: false });

      const ultimoCheckin: Record<string, string> = {};
      (checkins || []).forEach(r => {
        if (!ultimoCheckin[r.client_id]) ultimoCheckin[r.client_id] = r.submitted_at;
      });

      // Última consulta concluída por cliente
      const { data: consultas } = await supabase
        .from('consultation_schedules')
        .select('client_id, scheduled_date')
        .in('client_id', clientIds)
        .eq('status', 'completed')
        .order('scheduled_date', { ascending: false });

      const ultimaConsulta: Record<string, string> = {};
      (consultas || []).forEach(c => {
        if (!ultimaConsulta[c.client_id]) ultimaConsulta[c.client_id] = c.scheduled_date;
      });

      const result: PacienteTemperatura[] = clients.map(client => {
        // Sinal 1 — Atividade de check-in (substitui Strava)
        const sinalCheckin = (): Sinal => {
          const last = ultimoCheckin[client.id];
          if (!last) return { nivel: 'frio', motivo: 'Sem check-ins registrados' };
          const dias = differenceInCalendarDays(today, parseISO(last));
          if (dias <= CHECKIN_MORNO_DIAS) return { nivel: 'quente', motivo: 'Em dia' };
          if (dias <= CHECKIN_FRIO_DIAS) return { nivel: 'morno', motivo: `Check-in há ${dias} dias` };
          return { nivel: 'frio', motivo: `Sem interação há ${dias} dias` };
        };

        // Sinal 2 — Cadência de consultas
        const sinalConsulta = (): Sinal => {
          if (!client.has_consultations || !client.consultation_frequency || client.consultation_frequency === 'once') {
            return { nivel: 'quente', motivo: 'Em dia' };
          }
          const freqDias = CONSULTA_FREQ_DIAS[client.consultation_frequency] ?? 30;
          const last = ultimaConsulta[client.id];
          if (!last) return { nivel: 'frio', motivo: 'Sem consultas realizadas' };
          const diasFrom = differenceInCalendarDays(today, parseISO(last));
          const diasAteVencer = freqDias - diasFrom;
          if (diasAteVencer > CONSULTA_MORNO_DIAS) return { nivel: 'quente', motivo: 'Em dia' };
          if (diasAteVencer >= 0) return { nivel: 'morno', motivo: `Consulta vence em ${diasAteVencer} dias` };
          return { nivel: 'frio', motivo: `Consulta vencida há ${Math.abs(diasAteVencer)} dias` };
        };

        // Sinal 3 — Fim de ciclo/renovação
        const sinalCiclo = (): Sinal => {
          const diasAteVencer = differenceInCalendarDays(parseISO(client.end_date), today);
          if (diasAteVencer > CICLO_MORNO_DIAS) return { nivel: 'quente', motivo: 'Em dia' };
          if (diasAteVencer > 0) return { nivel: 'morno', motivo: `Ciclo encerra em ${diasAteVencer} dias, renovação pendente` };
          return { nivel: 'frio', motivo: `Ciclo encerrado há ${Math.abs(diasAteVencer)} dias` };
        };

        const sinalFinal = piorSinal([sinalCheckin(), sinalConsulta(), sinalCiclo()]);

        const definirAcao = (): PacienteTemperatura['acao'] => {
          if (sinalFinal.nivel === 'quente') return 'nenhuma';
          const m = sinalFinal.motivo.toLowerCase();
          if (m.includes('check-in') || m.includes('interação')) return 'mensagem';
          if (m.includes('consulta')) return 'agendar';
          return 'renovar';
        };

        return {
          client_id: client.id,
          nome: client.name,
          phone: client.phone,
          temperatura: sinalFinal.nivel,
          motivo: sinalFinal.motivo,
          acao: definirAcao(),
          end_date: client.end_date,
        };
      });

      return result.sort((a, b) => ORDEM_TEMPERATURA[a.temperatura] - ORDEM_TEMPERATURA[b.temperatura]);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
}
