import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface AthleteSummaryData {
  admin_summary: string | null;
  admin_attention_points: string | null;
  admin_next_focus: string | null;
  admin_notes_short: string | null;
}

export interface AthleteAttachment {
  id: string;
  client_id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  type_tag: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  client_id: string;
  admin_id: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

// Hook para buscar dados de resumo do atleta
export function useAthleteSummaryData(clientId: string | undefined) {
  return useQuery({
    queryKey: ['athlete-summary', clientId],
    queryFn: async () => {
      if (!clientId) return null;
      
      const { data, error } = await supabase
        .from('clients')
        .select('admin_summary, admin_attention_points, admin_next_focus, admin_notes_short')
        .eq('id', clientId)
        .single();
      
      if (error) throw error;
      return data as AthleteSummaryData;
    },
    enabled: !!clientId,
  });
}

// Hook para atualizar campos do resumo com audit log
export function useUpdateAthleteSummary() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      clientId, 
      field, 
      value, 
      oldValue 
    }: { 
      clientId: string; 
      field: keyof AthleteSummaryData; 
      value: string | null;
      oldValue: string | null;
    }) => {
      if (!user) throw new Error('Não autenticado');
      
      // Atualizar o campo
      const { error: updateError } = await supabase
        .from('clients')
        .update({ [field]: value })
        .eq('id', clientId);
      
      if (updateError) throw updateError;
      
      // Criar log de auditoria
      const { error: auditError } = await supabase
        .from('athlete_summary_audit_logs')
        .insert({
          client_id: clientId,
          admin_id: user.id,
          field_changed: field,
          old_value: oldValue,
          new_value: value,
        });
      
      if (auditError) {
        console.error('Erro ao criar audit log:', auditError);
      }
      
      return { field, value };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['athlete-summary', variables.clientId] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Salvo com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar: ' + (error.message || 'Tente novamente'));
    },
  });
}

// Hook para buscar anexos do atleta
export function useAthleteAttachments(clientId: string | undefined) {
  return useQuery({
    queryKey: ['athlete-attachments', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      
      const { data, error } = await supabase
        .from('athlete_attachments')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as AthleteAttachment[];
    },
    enabled: !!clientId,
  });
}

// Hook para adicionar anexo
export function useAddAthleteAttachment() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      clientId, 
      file, 
      typeTag, 
      notes 
    }: { 
      clientId: string; 
      file: File; 
      typeTag: string;
      notes?: string;
    }) => {
      if (!user) throw new Error('Não autenticado');
      
      // Upload do arquivo
      const fileExt = file.name.split('.').pop();
      const fileName = `${clientId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('athlete-attachments')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      // Obter URL do arquivo
      const { data: urlData } = supabase.storage
        .from('athlete-attachments')
        .getPublicUrl(fileName);
      
      // Criar registro no banco
      const { data, error } = await supabase
        .from('athlete_attachments')
        .insert({
          client_id: clientId,
          user_id: user.id,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: file.type,
          file_size: file.size,
          type_tag: typeTag,
          notes,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['athlete-attachments', variables.clientId] });
      toast.success('Arquivo enviado com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao enviar arquivo: ' + (error.message || 'Tente novamente'));
    },
  });
}

// Hook para deletar anexo
export function useDeleteAthleteAttachment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, clientId, fileUrl }: { id: string; clientId: string; fileUrl: string }) => {
      // Extrair path do arquivo da URL
      const urlParts = fileUrl.split('/athlete-attachments/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabase.storage
          .from('athlete-attachments')
          .remove([filePath]);
      }
      
      // Deletar registro
      const { error } = await supabase
        .from('athlete_attachments')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { id, clientId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['athlete-attachments', data.clientId] });
      toast.success('Arquivo removido!');
    },
    onError: (error: any) => {
      toast.error('Erro ao remover arquivo: ' + (error.message || 'Tente novamente'));
    },
  });
}

// Hook para buscar audit logs
export function useAthleteSummaryAuditLogs(clientId: string | undefined) {
  return useQuery({
    queryKey: ['athlete-summary-audit-logs', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      
      const { data, error } = await supabase
        .from('athlete_summary_audit_logs')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data as AuditLog[];
    },
    enabled: !!clientId,
  });
}

// Hook para estatísticas de check-ins
export function useCheckinStats(clientId: string | undefined) {
  return useQuery({
    queryKey: ['checkin-stats', clientId],
    queryFn: async () => {
      if (!clientId) return null;
      
      // Total de check-ins
      const { count: totalCount, error: totalError } = await supabase
        .from('checkin_responses')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', clientId);
      
      if (totalError) throw totalError;
      
      // Check-ins do último mês
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      
      const { count: monthCount, error: monthError } = await supabase
        .from('checkin_responses')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .gte('submitted_at', oneMonthAgo.toISOString());
      
      if (monthError) throw monthError;
      
      // Último check-in
      const { data: lastCheckin, error: lastError } = await supabase
        .from('checkin_responses')
        .select('submitted_at')
        .eq('client_id', clientId)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (lastError) throw lastError;
      
      return {
        total: totalCount || 0,
        lastMonth: monthCount || 0,
        lastCheckinAt: lastCheckin?.submitted_at || null,
      };
    },
    enabled: !!clientId,
  });
}

// Hook para estatísticas de consultas
export function useConsultationStats(clientId: string | undefined) {
  return useQuery({
    queryKey: ['consultation-stats', clientId],
    queryFn: async () => {
      if (!clientId) return null;
      
      // Última consulta realizada
      const { data: lastCompleted, error: lastError } = await supabase
        .from('appointments')
        .select('appointment_date, appointment_time')
        .eq('client_id', clientId)
        .eq('status', 'completed')
        .order('appointment_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (lastError) throw lastError;
      
      // Próxima consulta agendada
      const today = new Date().toISOString().split('T')[0];
      const { data: nextScheduled, error: nextError } = await supabase
        .from('appointments')
        .select('appointment_date, appointment_time, google_meet_link')
        .eq('client_id', clientId)
        .in('status', ['scheduled', 'confirmed'])
        .gte('appointment_date', today)
        .order('appointment_date', { ascending: true })
        .limit(1)
        .maybeSingle();
      
      if (nextError) throw nextError;
      
      return {
        lastCompletedAt: lastCompleted ? `${lastCompleted.appointment_date}T${lastCompleted.appointment_time}` : null,
        nextScheduledAt: nextScheduled ? `${nextScheduled.appointment_date}T${nextScheduled.appointment_time}` : null,
        nextMeetLink: nextScheduled?.google_meet_link || null,
      };
    },
    enabled: !!clientId,
  });
}

// Hook para dados da anamnese
export function useAnamneseData(clientId: string | undefined) {
  return useQuery({
    queryKey: ['anamnese-data', clientId],
    queryFn: async () => {
      if (!clientId) return null;
      
      // Buscar perfil do atleta
      const { data: profile, error: profileError } = await supabase
        .from('athlete_profiles')
        .select('main_goal, secondary_goal, anamnese_submitted_at')
        .eq('client_id', clientId)
        .maybeSingle();
      
      if (profileError) throw profileError;
      
      // Buscar última resposta de anamnese
      const { data: anamneseResponse, error: responseError } = await supabase
        .from('anamnese_responses')
        .select('submitted_at')
        .eq('client_id', clientId)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (responseError) throw responseError;
      
      return {
        hasAnamnese: !!profile?.anamnese_submitted_at || !!anamneseResponse,
        submittedAt: profile?.anamnese_submitted_at || anamneseResponse?.submitted_at || null,
        mainGoal: profile?.main_goal || null,
        secondaryGoal: profile?.secondary_goal || null,
      };
    },
    enabled: !!clientId,
  });
}
