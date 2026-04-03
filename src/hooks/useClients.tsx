import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { addMonths, addWeeks, format, parseISO, differenceInDays, startOfMonth, endOfMonth, isWithinInterval, nextMonday, startOfWeek, endOfWeek } from 'date-fns';
import { generateCheckinSchedules } from './useScheduledCheckins';

export interface Client {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  service_type: 'nutrition' | 'training' | 'both';
  plan_type: 'consultoria' | 'premium';
  plan_duration: 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'six_weeks' | 'custom';
  checkin_frequency: 'daily' | 'weekly' | 'biweekly' | 'three_weeks' | 'monthly' | 'bimonthly' | 'quarterly' | null;
  has_checkin: boolean;
  has_agenda_access: boolean;
  start_date: string;
  end_date: string;
  monthly_value: number;
  notes: string | null;
  is_active: boolean;
  has_consultations: boolean;
  consultation_count: number;
  consultation_frequency: 'once' | 'monthly' | 'six_weeks' | null;
  first_consultation_date: string | null;
  payment_type: 'pix' | 'card';
  payment_date: string | null;
  athlete_status: 'pending_anamnese' | 'active' | 'paused' | 'completed' | null;
  registration_source: 'manual' | 'kiwify';
  created_at: string;
  updated_at: string;
  // Migration fields
  onboarding_type: 'new' | 'continuation' | null;
  remaining_consultations: number | null;
  last_consultation_at: string | null;
  last_consultation_index: number | null;
  athlete_user_id: string | null;
  // Freeze fields
  is_frozen: boolean;
  frozen_at: string | null;
  total_frozen_days: number;
}

export interface Payment {
  id: string;
  user_id: string;
  client_id: string;
  due_date: string;
  amount: number;
  status: 'pending' | 'paid' | 'overdue';
  paid_at: string | null;
  payment_method?: string;
  notes?: string;
  plan_start_date?: string;
  plan_end_date?: string;
  created_at: string;
  updated_at: string;
  client_name?: string;
}

export interface ConsultationSchedule {
  id: string;
  client_id: string;
  user_id: string;
  scheduled_date: string;
  send_link_date: string;
  status: 'pending' | 'sent' | 'completed';
  created_at: string;
  updated_at: string;
  client_name?: string;
}

export function useClients() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['clients', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Client[];
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
  });
}

export function usePayments() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['payments', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          clients (name)
        `)
        .order('due_date', { ascending: true });

      if (error) throw error;
      return data.map(p => ({
        ...p,
        client_name: p.clients?.name,
      })) as (Payment & { client_name: string })[];
    },
    enabled: !!user,
  });
}

export function useConsultationSchedules() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['consultation_schedules', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consultation_schedules')
        .select(`
          *,
          clients (name)
        `)
        .order('scheduled_date', { ascending: true });

      if (error) throw error;
      return data.map(s => ({
        ...s,
        client_name: s.clients?.name,
      })) as (ConsultationSchedule & { client_name: string })[];
    },
    enabled: !!user,
  });
}

// Helper to get the first Monday AFTER a given date (never the same day)
function getFirstMondayAfter(date: Date): Date {
  return nextMonday(date);
}

// Calculate number of consultations based on plan duration and frequency
function calculateConsultationCount(
  planDuration: 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'six_weeks',
  consultationFrequency: 'once' | 'monthly' | 'six_weeks'
): number {
  if (consultationFrequency === 'once') return 1;

  // Plan duration in months/weeks
  const durationMonths: Record<string, number> = {
    six_weeks: 1.5, // 6 weeks = ~1.5 months
    monthly: 1,
    quarterly: 3,
    semiannual: 6,
    annual: 12,
  };

  const months = durationMonths[planDuration] || 1;

  if (consultationFrequency === 'monthly') {
    // One consultation per month (e.g., 6 months = 6 consultations)
    return Math.max(1, Math.floor(months));
  } else if (consultationFrequency === 'six_weeks') {
    // One consultation every 6 weeks (~1.5 months)
    // 6 months = ~4 consultations, 12 months = ~8 consultations
    const weeksInPlan = months * 4.33; // Approximate weeks per month
    return Math.max(1, Math.floor(weeksInPlan / 6));
  }

  return 1;
}

function generateConsultationSchedules(
  userId: string,
  clientId: string,
  firstConsultationDate: string,
  consultationFrequency: 'once' | 'monthly' | 'six_weeks',
  planDuration: 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'six_weeks',
  endDate: string,
  consultationCount: number // Use the registered consultation count
): Omit<ConsultationSchedule, 'id' | 'created_at' | 'updated_at' | 'client_name'>[] {
  const schedules: Omit<ConsultationSchedule, 'id' | 'created_at' | 'updated_at' | 'client_name'>[] = [];
  const firstDate = parseISO(firstConsultationDate);
  const planEndDate = parseISO(endDate);

  console.debug(
    `[Automação Consultas] Iniciando ciclo de automação para client_id=${clientId} | frequência=${consultationFrequency} | duração=${planDuration} | término=${format(planEndDate, 'yyyy-MM-dd')} | 1ª consulta=${format(firstDate, 'yyyy-MM-dd')} | total_consultas=${consultationCount}`
  );

  // If only one consultation or no recurring frequency, just add the first one
  if (consultationFrequency === 'once' || consultationCount <= 1) {
    schedules.push({
      client_id: clientId,
      user_id: userId,
      scheduled_date: format(firstDate, 'yyyy-MM-dd'),
      // A primeira consulta é marcada manualmente, então não criamos tarefa de envio de link
      send_link_date: format(firstDate, 'yyyy-MM-dd'),
      status: 'pending',
    });
    return schedules;
  }

  // Primeira consulta: agendada manualmente (guardamos no histórico de schedules)
  schedules.push({
    client_id: clientId,
    user_id: userId,
    scheduled_date: format(firstDate, 'yyyy-MM-dd'),
    // Mesma data para permitir diferenciar no calendário (não é tarefa de envio)
    send_link_date: format(firstDate, 'yyyy-MM-dd'),
    status: 'pending',
  });

  // Loop de criação de tarefas de envio de link, respeitando consultation_count
  let currentConsultationDate = firstDate;
  let consultationsCreated = 1; // First consultation already added

  while (consultationsCreated < consultationCount) {
    // Fim do intervalo (1 mês ou 6 semanas) a partir da consulta base
    let intervalEndDate: Date;
    if (consultationFrequency === 'monthly') {
      intervalEndDate = addMonths(currentConsultationDate, 1);
    } else {
      intervalEndDate = addWeeks(currentConsultationDate, 6);
    }

    // A tarefa deve ser criada na primeira segunda-feira APÓS o fim do intervalo
    const sendLinkDate = getFirstMondayAfter(intervalEndDate);

    console.debug(
      `[Automação Consultas] Consulta ${consultationsCreated + 1}/${consultationCount}: base=${format(currentConsultationDate, 'yyyy-MM-dd')} | fim_intervalo=${format(intervalEndDate, 'yyyy-MM-dd')} | próxima_tarefa=${format(sendLinkDate, 'yyyy-MM-dd')}`
    );

    // Condição de parada: se a próxima tarefa ultrapassa o término do plano
    if (sendLinkDate > planEndDate) {
      console.debug(
        `[Automação Consultas] Loop finalizado: próxima_tarefa=${format(sendLinkDate, 'yyyy-MM-dd')} ultrapassa término=${format(planEndDate, 'yyyy-MM-dd')}`
      );
      break;
    }

    schedules.push({
      client_id: clientId,
      user_id: userId,
      // Mantemos a data "prevista" da consulta como fim do intervalo (sem mudar arquitetura)
      scheduled_date: format(intervalEndDate, 'yyyy-MM-dd'),
      send_link_date: format(sendLinkDate, 'yyyy-MM-dd'),
      status: 'pending',
    });

    consultationsCreated++;
    // Próximo ciclo parte do fim do intervalo atual
    currentConsultationDate = intervalEndDate;
  }

  return schedules;
}

// Generate consultation schedules for CONTINUATION (migration) clients
// Uses last_consultation_at to calculate future windows based on interval
// CRITICAL: Link is sent on the Monday AFTER the full interval period ends
// Example: If last consult was 10/01/2026 and interval is 4 weeks:
// - 4 weeks end on 07/02/2026 (Saturday)
// - The Monday AFTER that is 09/02/2026 - this is when we send the link
// 
// The consultation_index parameter indicates which consultation was the last one completed.
// The generated schedules will continue the numbering from there.
// For example: if last_consultation_index = 1, the first generated schedule will be Consulta 2
// ContinuationSchedule is the same as the base schedule type
// Note: consultation_index is only used for display/logging, not stored in DB
type ContinuationSchedule = Omit<ConsultationSchedule, 'id' | 'created_at' | 'updated_at' | 'client_name'>;

function generateContinuationConsultationSchedules(
  userId: string,
  clientId: string,
  consultationFrequency: 'once' | 'monthly' | 'six_weeks',
  endDate: string,
  remainingConsultations: number,
  lastConsultationAt?: string | null,
  lastConsultationIndex?: number | null,
  customScheduleDates?: Array<{ consultationNumber: number; sendLinkDate: string; isCustom: boolean }> | null
): ContinuationSchedule[] {
  const schedules: ContinuationSchedule[] = [];
  const planEndDate = parseISO(endDate);
  const today = new Date();
  
  // The next consultation number starts after the last completed one
  const startingIndex = (lastConsultationIndex || 0) + 1;
  
  // Interval type
  const intervalLabel = consultationFrequency === 'six_weeks' ? '6 semanas' : 'mensal';
  
  console.debug(
    `[Automação Consultas - Continuação] client_id=${clientId} | remaining=${remainingConsultations} | starting_index=${startingIndex} | intervalo=${intervalLabel} | término=${format(planEndDate, 'yyyy-MM-dd')} | last_consultation_at=${lastConsultationAt || 'não informado'}`
  );
  
  if (remainingConsultations <= 0) {
    console.debug('[Automação Consultas - Continuação] Sem consultas restantes');
    return schedules;
  }

  // Calculate the cutoff date: last consultation must be at least 3 weeks before plan end
  const cutoffDate = addWeeks(planEndDate, -3);

  // If we have last_consultation_at, calculate windows based on it
  if (lastConsultationAt) {
    const lastConsultation = parseISO(lastConsultationAt);
    let currentBaseDate = lastConsultation;
    let windowsCreated = 0;

    while (windowsCreated < remainingConsultations) {
      // Calculate when the interval period ENDS
      const intervalEndDate = consultationFrequency === 'six_weeks'
        ? addWeeks(currentBaseDate, 6)
        : addMonths(currentBaseDate, 1);

      // The Monday AFTER the interval ends is when we send the link
      const sendLinkMonday = nextMonday(intervalEndDate);

      // The consultation window is the week of the sendLinkMonday
      const windowStart = sendLinkMonday;
      const windowEnd = endOfWeek(sendLinkMonday, { weekStartsOn: 1 });

      // Stop if send link date is beyond cutoff (3 weeks before plan end)
      if (sendLinkMonday > cutoffDate) {
        console.debug(`[Automação Consultas - Continuação] Parando: data de envio ${format(sendLinkMonday, 'yyyy-MM-dd')} está a menos de 3 semanas do fim do plano (cutoff: ${format(cutoffDate, 'yyyy-MM-dd')})`);
        break;
      }

      // Only include future dates
      if (sendLinkMonday >= today) {
        const consultationNumber = startingIndex + windowsCreated;
        
        // Check if there's a custom date for this consultation
        const customDateEntry = customScheduleDates?.find(c => c.consultationNumber === consultationNumber);
        const finalSendLinkDate = customDateEntry?.isCustom 
          ? customDateEntry.sendLinkDate 
          : format(sendLinkMonday, 'yyyy-MM-dd');
        
        console.debug(
          `[Automação Consultas - Continuação] Consulta ${consultationNumber} (janela ${windowsCreated + 1}/${remainingConsultations}): baseDate=${format(currentBaseDate, 'yyyy-MM-dd')} | intervalEnd=${format(intervalEndDate, 'yyyy-MM-dd')} | sendLink=${finalSendLinkDate}${customDateEntry?.isCustom ? ' (CUSTOMIZADO)' : ''} | window=${format(windowStart, 'yyyy-MM-dd')} a ${format(windowEnd, 'yyyy-MM-dd')}`
        );

        schedules.push({
          client_id: clientId,
          user_id: userId,
          // The scheduled_date is the Monday of the consultation window (or custom date)
          scheduled_date: finalSendLinkDate,
          // The send_link_date is when we send the booking link
          send_link_date: finalSendLinkDate,
          status: 'pending',
        });

        windowsCreated++;
      }

      // Next cycle: the interval starts from the current intervalEndDate
      currentBaseDate = intervalEndDate;
    }
  } else {
    // Fallback: no last_consultation_at - use today as reference
    // Calculate first send date as Monday after one interval from today
    let currentBaseDate = today;

    for (let i = 0; i < remainingConsultations; i++) {
      const intervalEndDate = consultationFrequency === 'six_weeks'
        ? addWeeks(currentBaseDate, 6)
        : addMonths(currentBaseDate, 1);
      const sendLinkMonday = nextMonday(intervalEndDate);

      // Stop if send link date is beyond cutoff (3 weeks before plan end)
      if (sendLinkMonday > cutoffDate) {
        console.debug(`[Automação Consultas - Continuação Fallback] Parando: data de envio ${format(sendLinkMonday, 'yyyy-MM-dd')} está a menos de 3 semanas do fim do plano`);
        break;
      }

      const consultationNumber = startingIndex + i;
      schedules.push({
        client_id: clientId,
        user_id: userId,
        scheduled_date: format(sendLinkMonday, 'yyyy-MM-dd'),
        send_link_date: format(sendLinkMonday, 'yyyy-MM-dd'),
        status: 'pending',
      });

      currentBaseDate = intervalEndDate;
    }
  }
  
  return schedules;
}

// Helper function for date addition
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function useAddClient() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clientData: Omit<Client, 'id' | 'user_id' | 'created_at' | 'updated_at'> & { 
      custom_schedule_dates?: Array<{ consultationNumber: number; sendLinkDate: string; isCustom: boolean }> | null 
    }) => {
      if (!user) throw new Error('Not authenticated');

      // Extract custom_schedule_dates before inserting into DB (it's not a DB column)
      const { custom_schedule_dates, ...clientDataForDB } = clientData;

      const { data: client, error } = await supabase
        .from('clients')
        .insert({
          ...clientDataForDB,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // NOTE: Financial entries are now created separately via the Financial module
      // The useAddPayment hook handles payment registration independently

      // Generate consultation schedules if applicable
      if (client.has_consultations && client.consultation_frequency) {
        let schedules: Omit<ConsultationSchedule, 'id' | 'created_at' | 'updated_at' | 'client_name'>[] = [];
        
        // Check if this is a continuation (migration) client
        if (client.onboarding_type === 'continuation' && client.remaining_consultations) {
          // Generate only future consultations for continuation clients
          // Pass custom_schedule_dates if provided
          schedules = generateContinuationConsultationSchedules(
            user.id,
            client.id,
            client.consultation_frequency as 'once' | 'monthly' | 'six_weeks',
            client.end_date,
            client.remaining_consultations,
            client.last_consultation_at,
            client.last_consultation_index,
            custom_schedule_dates
          );
        } else if (client.first_consultation_date) {
          // Standard new client flow
          schedules = generateConsultationSchedules(
            user.id,
            client.id,
            client.first_consultation_date,
            client.consultation_frequency as 'once' | 'monthly' | 'six_weeks',
            client.plan_duration as 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'six_weeks',
            client.end_date,
            client.consultation_count || 1
          );
        }

        if (schedules.length > 0) {
          const { error: schedulesError } = await supabase
            .from('consultation_schedules')
            .insert(schedules);

          if (schedulesError) throw schedulesError;
        }
        
        // Create booking_link for clients with consultations
        const { error: bookingLinkError } = await supabase
          .from('booking_links')
          .insert({
            client_id: client.id,
            token: crypto.randomUUID(),
            active: true,
          });
        
        if (bookingLinkError) {
          console.error('Error creating booking link:', bookingLinkError);
        }
      }

      // Generate scheduled checkins if has_checkin is enabled
      if (client.has_checkin && client.checkin_frequency) {
        const checkinSchedules = generateCheckinSchedules(
          user.id,
          client.id,
          client.start_date,
          client.end_date,
          client.checkin_frequency
        );

        if (checkinSchedules.length > 0) {
          const { error: checkinError } = await supabase
            .from('scheduled_checkins')
            .insert(checkinSchedules);

          if (checkinError) {
            console.error('Error creating checkin schedules:', checkinError);
          }
        }

        // Auto-create dispatch schedule (athlete_checkin_schedules)
        // Find the first active checkin form to use
        const { data: activeForms } = await supabase
          .from('checkin_forms')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .limit(1);

        if (activeForms && activeForms.length > 0) {
          // Map client frequency to dispatch frequency
          const freqMap: Record<string, string> = {
            daily: 'weekly',
            weekly: 'weekly',
            biweekly: 'biweekly',
            three_weeks: 'three_weeks',
            monthly: 'monthly',
            bimonthly: 'bimonthly',
            quarterly: 'quarterly',
          };
          const dispatchFreq = freqMap[client.checkin_frequency] || 'weekly';

          const { error: dispatchError } = await supabase
            .from('athlete_checkin_schedules')
            .insert({
              user_id: user.id,
              client_id: client.id,
              checkin_form_id: activeForms[0].id,
              start_date: client.start_date,
              frequency_type: dispatchFreq,
              weekly_days: [1], // Monday
              send_time: '07:00:00',
              due_in_hours: 48,
              is_active: true,
            });

          if (dispatchError) {
            console.error('Error creating dispatch schedule:', dispatchError);
          }
        }
      }

      // CRITICAL: Create athlete_profile for the new client
      // This is required for the athlete tab to be visible in admin area
      const { error: profileError } = await supabase
        .from('athlete_profiles')
        .insert({
          client_id: client.id,
        });

      if (profileError) {
        console.error('Error creating athlete profile:', profileError);
      }

      // Create meal plan status (pending) and associated task
      // This triggers the meal plan alert on dashboard
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ...
      
      // Create the task first
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          title: `Enviar plano alimentar - ${clientData.name}`,
          description: `Pendente: enviar plano alimentar para o atleta ${clientData.name}`,
          day_of_week: dayOfWeek === 0 ? 1 : dayOfWeek, // Default to Monday if Sunday
          is_pinned: true, // Pin meal plan tasks
        })
        .select('id')
        .single();

      if (taskError) {
        console.error('Error creating meal plan task:', taskError);
      }

      // Create meal plan status
      const { error: mealPlanError } = await supabase
        .from('meal_plan_status')
        .insert({
          client_id: client.id,
          user_id: user.id,
          status: 'pending',
          task_id: taskData?.id || null,
        });

      if (mealPlanError) {
        console.error('Error creating meal plan status:', mealPlanError);
      }

      return client;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['consultation_schedules'] });
      queryClient.invalidateQueries({ queryKey: ['scheduled_checkins'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['meal-plan-status'] });
      queryClient.invalidateQueries({ queryKey: ['pending-meal-plans'] });
    },
  });
}

export function useUpdateClient() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Client> & { id: string; custom_schedule_dates?: any }) => {
      // Strip virtual/non-DB fields before sending to Supabase
      const { custom_schedule_dates, ...dbUpdates } = updates as any;

      // First get the current client data to compare
      const { data: currentClient, error: fetchError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Update the client
      const { data, error } = await supabase
        .from('clients')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Check if we need to regenerate consultation schedules
      const consultationFieldsChanged = 
        dbUpdates.start_date !== undefined ||
        dbUpdates.end_date !== undefined ||
        dbUpdates.first_consultation_date !== undefined ||
        dbUpdates.consultation_frequency !== undefined ||
        dbUpdates.has_consultations !== undefined ||
        dbUpdates.plan_duration !== undefined;

      // Check if we need to regenerate checkin schedules
      const checkinFieldsChanged =
        dbUpdates.start_date !== undefined ||
        dbUpdates.end_date !== undefined ||
        dbUpdates.has_checkin !== undefined ||
        dbUpdates.checkin_frequency !== undefined;

      if (consultationFieldsChanged && user) {
        const updatedClient = data as Client;

        // Delete only pending/future schedules — preserve completed history
        await supabase
          .from('consultation_schedules')
          .delete()
          .eq('client_id', id)
          .in('status', ['pending', 'sent', 'link_sent']);

        // Regenerate if consultations are enabled
        if (updatedClient.has_consultations && updatedClient.consultation_frequency) {
          let schedules: Omit<ConsultationSchedule, 'id' | 'created_at' | 'updated_at' | 'client_name'>[] = [];

          // Continuation clients
          if (updatedClient.onboarding_type === 'continuation' && updatedClient.remaining_consultations) {
            schedules = generateContinuationConsultationSchedules(
              user.id,
              id,
              updatedClient.consultation_frequency as 'once' | 'monthly' | 'six_weeks',
              updatedClient.end_date,
              updatedClient.remaining_consultations,
              updatedClient.last_consultation_at,
              updatedClient.last_consultation_index
            );
          }
          // New clients (standard flow)
          else if (updatedClient.first_consultation_date) {
            schedules = generateConsultationSchedules(
              user.id,
              id,
              updatedClient.first_consultation_date,
              updatedClient.consultation_frequency as 'once' | 'monthly' | 'six_weeks',
              updatedClient.plan_duration as 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'six_weeks',
              updatedClient.end_date,
              updatedClient.consultation_count || 1
            );
          }

          if (schedules.length > 0) {
            await supabase
              .from('consultation_schedules')
              .insert(schedules);
          }
        }
      }

      // Regenerate checkin schedules if relevant fields changed
      if (checkinFieldsChanged && user) {
        const updatedClient = data as Client;
        
        // Delete only pending scheduled checkins
        await supabase
          .from('scheduled_checkins')
          .delete()
          .eq('client_id', id)
          .eq('status', 'pending');

        // Regenerate if checkins are enabled
        if (updatedClient.has_checkin && updatedClient.checkin_frequency) {
          const checkinSchedules = generateCheckinSchedules(
            user.id,
            id,
            updatedClient.start_date,
            updatedClient.end_date,
            updatedClient.checkin_frequency
          );

          if (checkinSchedules.length > 0) {
            await supabase
              .from('scheduled_checkins')
              .insert(checkinSchedules);
          }
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['consultation_schedules'] });
      queryClient.invalidateQueries({ queryKey: ['athlete-consultation-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['scheduled_checkins'] });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['consultation_schedules'] });
    },
  });
}

export function useUpdatePaymentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, paid_at }: { id: string; status: 'pending' | 'paid' | 'overdue'; paid_at?: string | null }) => {
      const { data, error } = await supabase
        .from('payments')
        .update({ status, paid_at })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
  });
}

export function useUpdatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      amount, 
      status, 
      due_date, 
      paid_at, 
      payment_method, 
      plan_start_date, 
      plan_end_date,
      notes 
    }: { 
      id: string; 
      amount?: number;
      status?: 'pending' | 'paid' | 'overdue'; 
      due_date?: string;
      paid_at?: string | null;
      payment_method?: string | null;
      plan_start_date?: string | null;
      plan_end_date?: string | null;
      notes?: string | null;
    }) => {
      const updateData: Record<string, unknown> = {};
      if (amount !== undefined) updateData.amount = amount;
      if (status !== undefined) updateData.status = status;
      if (due_date !== undefined) updateData.due_date = due_date;
      if (paid_at !== undefined) updateData.paid_at = paid_at;
      if (payment_method !== undefined) updateData.payment_method = payment_method;
      if (plan_start_date !== undefined) updateData.plan_start_date = plan_start_date;
      if (plan_end_date !== undefined) updateData.plan_end_date = plan_end_date;
      if (notes !== undefined) updateData.notes = notes;

      const { data, error } = await supabase
        .from('payments')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
  });
}

export function useDeletePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('payments')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
  });
}

// Mutation to update consultation schedule (for editing send_link_date or status)
export function useUpdateConsultationSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ConsultationSchedule> & { id: string }) => {
      const { data, error } = await supabase
        .from('consultation_schedules')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultation_schedules'] });
    },
  });
}

// Mutation to delete a consultation schedule
export function useDeleteConsultationSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('consultation_schedules')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultation_schedules'] });
    },
  });
}

// Mutation to add a consultation schedule manually
export function useAddConsultationSchedule() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (scheduleData: { client_id: string; scheduled_date: string; send_link_date: string }) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('consultation_schedules')
        .insert({
          ...scheduleData,
          user_id: user.id,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultation_schedules'] });
    },
  });
}

// Helper functions for computed data
export function getExpiringClients(clients: Client[], days: number = 30): Client[] {
  const today = new Date();
  return clients
    .filter(client => {
      if (!client.is_active) return false;
      const endDate = parseISO(client.end_date);
      const daysUntilExpiry = differenceInDays(endDate, today);
      return daysUntilExpiry >= 0 && daysUntilExpiry <= days;
    })
    .sort((a, b) => parseISO(a.end_date).getTime() - parseISO(b.end_date).getTime());
}

export function getUpcomingPayments(payments: (Payment & { client_name: string })[], days: number = 30) {
  const today = new Date();
  return payments
    .filter(payment => {
      if (payment.status === 'paid') return false;
      const dueDate = parseISO(payment.due_date);
      const daysUntilDue = differenceInDays(dueDate, today);
      return daysUntilDue >= -30 && daysUntilDue <= days;
    })
    .map(payment => {
      const daysUntilDue = differenceInDays(parseISO(payment.due_date), today);
      return {
        ...payment,
        status: daysUntilDue < 0 ? 'overdue' as const : payment.status,
      };
    })
    .sort((a, b) => parseISO(a.due_date).getTime() - parseISO(b.due_date).getTime());
}

export function getOverduePayments(payments: (Payment & { client_name: string })[]) {
  const today = new Date();
  return payments
    .filter(payment => {
      if (payment.status === 'paid') return false;
      const dueDate = parseISO(payment.due_date);
      return dueDate < today;
    })
    .sort((a, b) => parseISO(a.due_date).getTime() - parseISO(b.due_date).getTime());
}

export function getMonthlyRevenue(payments: (Payment & { client_name: string })[], year: number, month: number) {
  const monthStart = startOfMonth(new Date(year, month));
  const monthEnd = endOfMonth(new Date(year, month));

  const monthPayments = payments.filter(payment => {
    const dueDate = parseISO(payment.due_date);
    return isWithinInterval(dueDate, { start: monthStart, end: monthEnd });
  });

  const total = monthPayments.reduce((sum, p) => sum + p.amount, 0);

  return { total, payments: monthPayments };
}

export function getTotalMonthlyRecurring(clients: Client[]): number {
  return clients.filter(c => c.is_active).reduce((sum, c) => sum + c.monthly_value, 0);
}

export function getNewPlansThisMonth(clients: Client[], year: number, month: number): { count: number; total: number } {
  const monthStart = startOfMonth(new Date(year, month));
  const monthEnd = endOfMonth(new Date(year, month));

  const newClients = clients.filter(client => {
    const startDate = parseISO(client.start_date);
    return isWithinInterval(startDate, { start: monthStart, end: monthEnd });
  });

  return {
    count: newClients.length,
    total: newClients.reduce((sum, c) => sum + c.monthly_value, 0),
  };
}

export function getMonthlyIncome(payments: (Payment & { client_name: string })[], year: number, month: number): number {
  const monthStart = startOfMonth(new Date(year, month));
  const monthEnd = endOfMonth(new Date(year, month));

  return payments
    .filter(payment => {
      if (payment.status !== 'paid' || !payment.paid_at) return false;
      const paidDate = parseISO(payment.paid_at);
      return isWithinInterval(paidDate, { start: monthStart, end: monthEnd });
    })
    .reduce((sum, p) => sum + p.amount, 0);
}

export function getExpiringThisMonth(clients: Client[], year: number, month: number): Client[] {
  const monthStart = startOfMonth(new Date(year, month));
  const monthEnd = endOfMonth(new Date(year, month));

  return clients
    .filter(client => {
      if (!client.is_active) return false;
      const endDate = parseISO(client.end_date);
      return isWithinInterval(endDate, { start: monthStart, end: monthEnd });
    })
    .sort((a, b) => parseISO(a.end_date).getTime() - parseISO(b.end_date).getTime());
}

export function getConsultationsThisMonth(
  schedules: (ConsultationSchedule & { client_name: string })[],
  year: number,
  month: number
) {
  const monthStart = startOfMonth(new Date(year, month));
  const monthEnd = endOfMonth(new Date(year, month));

  return schedules.filter(schedule => {
    const scheduledDate = parseISO(schedule.scheduled_date);
    return isWithinInterval(scheduledDate, { start: monthStart, end: monthEnd });
  });
}

/**
 * Mutation to add a new payment entry (for the Financial module)
 * This is used to register payments independently from client registration
 */
export function useAddPayment() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentData: {
      client_id: string;
      amount: number;
      payment_method: string;
      payment_date: string;
      notes?: string;
      plan_start_date?: string;
      plan_end_date?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('payments')
        .insert({
          user_id: user.id,
          client_id: paymentData.client_id,
          amount: paymentData.amount,
          due_date: paymentData.payment_date,
          status: 'paid' as const,
          paid_at: new Date(paymentData.payment_date).toISOString(),
          payment_method: paymentData.payment_method,
          notes: paymentData.notes || null,
          plan_start_date: paymentData.plan_start_date || null,
          plan_end_date: paymentData.plan_end_date || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
  });
}