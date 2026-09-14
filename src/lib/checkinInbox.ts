import { supabase } from '@/integrations/supabase/client';
import { getAthleteState, type AthleteStateInput } from './athleteState';
import { checkinWorkflow, type CheckinFeedbackState } from './checkinWorkflow';

export interface CheckinInboxRow {
  id: string;
  client_id: string;
  submitted_at: string;
  review_status: string | null;
  closed_reason: string | null;
  clients: AthleteStateInput & { id: string; name: string; phone: string | null; checkin_frequency: string | null };
  checkin_forms: { title: string } | null;
  feedback: CheckinFeedbackState | null;
}

const SELECT = 'id, client_id, submitted_at, review_status, closed_reason, clients!inner(id, user_id, name, phone, checkin_frequency, is_active, is_frozen, archived_at, ended_at, end_date, service_type, has_checkin, has_consultations), checkin_forms(title)';

export async function fetchCheckinPage(userId: string, offset: number, size: number, openOnly = false, clientId?: string, search?: string) {
  let query = supabase.from('checkin_responses').select(SELECT)
    .eq('clients.user_id', userId)
    .order('submitted_at', { ascending: false }).order('id', { ascending: false })
    .range(offset, offset + size - 1);
  if (openOnly) query = query.or('review_status.is.null,review_status.neq.closed');
  if (clientId) query = query.eq('client_id', clientId);
  if (search?.trim()) query = query.ilike('clients.name', `%${search.trim()}%`);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data || []) as unknown as CheckinInboxRow[];
  if (!rows.length) return [];
  const { data: feedbacks, error: feedbackError } = await supabase.from('checkin_feedbacks')
    .select('checkin_response_id, status, publication_status, sent_at, published_at')
    .in('checkin_response_id', rows.map(row => row.id));
  if (feedbackError) throw feedbackError;
  const byResponse = new Map((feedbacks || []).map(f => [f.checkin_response_id, f]));
  return rows.map(row => ({ ...row, feedback: byResponse.get(row.id) || null }));
}

/** Page through every open response so older obligations cannot fall off a fixed limit. */
export async function fetchOpenCheckins(userId: string): Promise<CheckinInboxRow[]> {
  const pending: CheckinInboxRow[] = [];
  const size = 500;
  for (let offset = 0; ; offset += size) {
    const rows = await fetchCheckinPage(userId, offset, size, true);
    pending.push(...rows.filter(row => getAthleteState(row.clients).canAppearInOperationalQueues && !checkinWorkflow(row, row.feedback).resolved));
    if (rows.length < size) break;
  }
  return pending;
}
