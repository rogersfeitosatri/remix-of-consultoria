import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { addMonths, addWeeks, parseISO, isPast, differenceInDays, format } from 'date-fns';

export interface TargetRaceAlertData {
  hasTargetRace: boolean;
  targetRace: string | null;
  targetDeadline: string | null;
  daysToRace: number | null;
  needsDietAdjustment: boolean;
  lastAdjustmentAt: string | null;
  nextAdjustmentDue: string | null;
  adjustmentReason: 'checkin_monthly' | 'checkin_cycle' | 'consultation' | null;
}

export interface AthleteWithTargetRaceAlert {
  clientId: string;
  clientName: string;
  planType: string;
  checkinFrequency: string | null;
  targetRace: string;
  targetDeadline: string | null;
  daysToRace: number | null;
  needsDietAdjustment: boolean;
  lastAdjustmentAt: string | null;
  consultationFrequency: string | null;
}

// Hook para dados de alerta de prova alvo de um atleta específico
export function useTargetRaceAlert(clientId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['target-race-alert', clientId],
    queryFn: async (): Promise<TargetRaceAlertData> => {
      if (!clientId) {
        return {
          hasTargetRace: false,
          targetRace: null,
          targetDeadline: null,
          daysToRace: null,
          needsDietAdjustment: false,
          lastAdjustmentAt: null,
          nextAdjustmentDue: null,
          adjustmentReason: null,
        };
      }

      // Buscar dados do atleta
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, checkin_frequency, consultation_frequency, has_consultations')
        .eq('id', clientId)
        .single();

      if (clientError) throw clientError;

      // Buscar perfil do atleta para prova alvo
      const { data: profile, error: profileError } = await supabase
        .from('athlete_profiles')
        .select('target_race, target_deadline')
        .eq('client_id', clientId)
        .maybeSingle();

      if (profileError) throw profileError;

      // Se não tem prova alvo, retorna vazio
      if (!profile?.target_race) {
        return {
          hasTargetRace: false,
          targetRace: null,
          targetDeadline: null,
          daysToRace: null,
          needsDietAdjustment: false,
          lastAdjustmentAt: null,
          nextAdjustmentDue: null,
          adjustmentReason: null,
        };
      }

      // Calcular dias até a prova
      let daysToRace: number | null = null;
      if (profile.target_deadline) {
        const raceDate = parseISO(profile.target_deadline);
        daysToRace = differenceInDays(raceDate, new Date());
      }

      // Buscar último ajuste de dieta (da tabela diet_adjustment_alerts)
      const { data: alert, error: alertError } = await supabase
        .from('diet_adjustment_alerts')
        .select('last_adjustment_at, next_alert_at')
        .eq('client_id', clientId)
        .maybeSingle();

      if (alertError) throw alertError;

      const lastAdjustmentAt = alert?.last_adjustment_at || null;
      const nextAlertAt = alert?.next_alert_at || null;

      // Determinar se precisa de ajuste baseado na frequência
      let needsDietAdjustment = false;
      let adjustmentReason: 'checkin_monthly' | 'checkin_cycle' | 'consultation' | null = null;
      let nextAdjustmentDue: string | null = null;

      const now = new Date();
      const checkinFreq = client.checkin_frequency;
      const consultFreq = client.consultation_frequency;
      const hasConsultations = client.has_consultations;

      // Lógica de ajuste:
      // - Se checkin mensal: ajuste obrigatório a cada checkin (ou mês)
      // - Se checkin semanal/quinzenal com consultas: ajuste baseado nas consultas
      // - Se checkin semanal/quinzenal sem consultas: ajuste mensal
      
      if (checkinFreq === 'monthly') {
        // Checkin mensal = ajuste a cada mês
        adjustmentReason = 'checkin_monthly';
        if (!lastAdjustmentAt) {
          needsDietAdjustment = true;
        } else {
          const lastAdj = parseISO(lastAdjustmentAt);
          nextAdjustmentDue = format(addMonths(lastAdj, 1), 'yyyy-MM-dd');
          needsDietAdjustment = isPast(parseISO(nextAdjustmentDue));
        }
      } else if (checkinFreq === 'weekly' || checkinFreq === 'biweekly') {
        // Checkin semanal ou quinzenal
        if (hasConsultations && consultFreq) {
          // Tem consultas recorrentes - ajuste baseado nas consultas
          adjustmentReason = 'consultation';
          if (consultFreq === 'monthly') {
            if (!lastAdjustmentAt) {
              needsDietAdjustment = true;
            } else {
              const lastAdj = parseISO(lastAdjustmentAt);
              nextAdjustmentDue = format(addMonths(lastAdj, 1), 'yyyy-MM-dd');
              needsDietAdjustment = isPast(parseISO(nextAdjustmentDue));
            }
          } else if (consultFreq === 'six_weeks') {
            if (!lastAdjustmentAt) {
              needsDietAdjustment = true;
            } else {
              const lastAdj = parseISO(lastAdjustmentAt);
              nextAdjustmentDue = format(addWeeks(lastAdj, 6), 'yyyy-MM-dd');
              needsDietAdjustment = isPast(parseISO(nextAdjustmentDue));
            }
          }
        } else {
          // Sem consultas - ajuste mensal baseado no ciclo de checkins
          adjustmentReason = 'checkin_cycle';
          if (!lastAdjustmentAt) {
            needsDietAdjustment = true;
          } else {
            const lastAdj = parseISO(lastAdjustmentAt);
            nextAdjustmentDue = format(addMonths(lastAdj, 1), 'yyyy-MM-dd');
            needsDietAdjustment = isPast(parseISO(nextAdjustmentDue));
          }
        }
      } else {
        // Outras frequências (three_weeks, bimonthly, quarterly) - mensal também
        adjustmentReason = 'checkin_cycle';
        if (!lastAdjustmentAt) {
          needsDietAdjustment = true;
        } else {
          const lastAdj = parseISO(lastAdjustmentAt);
          nextAdjustmentDue = format(addMonths(lastAdj, 1), 'yyyy-MM-dd');
          needsDietAdjustment = isPast(parseISO(nextAdjustmentDue));
        }
      }

      return {
        hasTargetRace: true,
        targetRace: profile.target_race,
        targetDeadline: profile.target_deadline,
        daysToRace,
        needsDietAdjustment,
        lastAdjustmentAt,
        nextAdjustmentDue,
        adjustmentReason,
      };
    },
    enabled: !!clientId && !!user,
  });
}

// Hook para listar todos atletas com prova alvo que precisam de ajuste
export function useAthletesWithTargetRaceAlerts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['athletes-target-race-alerts', user?.id],
    queryFn: async (): Promise<AthleteWithTargetRaceAlert[]> => {
      // Buscar todos atletas ativos
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, plan_type, checkin_frequency, consultation_frequency, has_consultations')
        .eq('is_active', true);

      if (clientsError) throw clientsError;

      // Buscar perfis com prova alvo
      const { data: profiles, error: profilesError } = await supabase
        .from('athlete_profiles')
        .select('client_id, target_race, target_deadline')
        .not('target_race', 'is', null);

      if (profilesError) throw profilesError;

      // Buscar alertas de dieta
      const { data: alerts, error: alertsError } = await supabase
        .from('diet_adjustment_alerts')
        .select('client_id, last_adjustment_at, next_alert_at');

      if (alertsError) throw alertsError;

      const result: AthleteWithTargetRaceAlert[] = [];
      const now = new Date();

      for (const profile of profiles || []) {
        const client = clients?.find(c => c.id === profile.client_id);
        if (!client) continue;

        const alert = alerts?.find(a => a.client_id === profile.client_id);
        const lastAdjustmentAt = alert?.last_adjustment_at || null;

        // Calcular dias até a prova
        let daysToRace: number | null = null;
        if (profile.target_deadline) {
          const raceDate = parseISO(profile.target_deadline);
          daysToRace = differenceInDays(raceDate, now);
        }

        // Determinar se precisa de ajuste
        let needsDietAdjustment = false;
        const checkinFreq = client.checkin_frequency;
        const consultFreq = client.consultation_frequency;
        const hasConsultations = client.has_consultations;

        if (!lastAdjustmentAt) {
          needsDietAdjustment = true;
        } else {
          const lastAdj = parseISO(lastAdjustmentAt);
          let nextDue: Date;

          if (hasConsultations && consultFreq === 'six_weeks') {
            nextDue = addWeeks(lastAdj, 6);
          } else {
            // Default mensal
            nextDue = addMonths(lastAdj, 1);
          }

          needsDietAdjustment = isPast(nextDue);
        }

        result.push({
          clientId: client.id,
          clientName: client.name,
          planType: client.plan_type,
          checkinFrequency: client.checkin_frequency,
          targetRace: profile.target_race!,
          targetDeadline: profile.target_deadline,
          daysToRace,
          needsDietAdjustment,
          lastAdjustmentAt,
          consultationFrequency: client.consultation_frequency,
        });
      }

      // Ordenar: primeiro os que precisam de ajuste, depois por dias até a prova
      return result.sort((a, b) => {
        // Prioridade 1: precisam de ajuste
        if (a.needsDietAdjustment && !b.needsDietAdjustment) return -1;
        if (!a.needsDietAdjustment && b.needsDietAdjustment) return 1;
        
        // Prioridade 2: prova mais próxima
        if (a.daysToRace !== null && b.daysToRace !== null) {
          return a.daysToRace - b.daysToRace;
        }
        if (a.daysToRace !== null) return -1;
        if (b.daysToRace !== null) return 1;
        
        return 0;
      });
    },
    enabled: !!user,
  });
}
