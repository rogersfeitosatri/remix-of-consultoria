import { supabase } from '@/integrations/supabase/client';

// Keywords that indicate a question/answer is about a target race.
// IMPORTANT: keep keywords very specific to avoid matching questions like
// "Alimentação durante o treino/competição" (which is a strategy answer, not a race name).
const RACE_QUESTION_KEYWORDS = [
  'prova alvo', 'prova objetivo', 'qual a sua prova', 'qual sua prova',
  'qual é a prova', 'próxima prova', 'prova principal', 'corrida alvo',
  'nome da prova', 'prova que pretende', 'prova inscrit'
];

// Reject obviously invalid race-name answers (paragraphs, strategies, etc.)
function isPlausibleRaceName(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length < 2 || trimmed.length > 80) return false;
  if (/[\n\r]/.test(trimmed)) return false;
  // Reject answers that look like food/strategy descriptions
  if (/\b(gel|carbo|carboidrato|gatorade|isotônico|pão|café|banana|km|min|ml|hora)\b/i.test(trimmed)) return false;
  return true;
}

const DATE_QUESTION_KEYWORDS = [
  'data da prova', 'quando será', 'data do evento',
  'data da corrida', 'data da competição', 'quando é a prova'
];

/**
 * Extracts target race info from dynamic anamnese responses by scanning question texts
 */
export function extractRaceFromDynamicResponses(
  questions: { id: string; question_text: string; question_type: string }[],
  responses: Record<string, any>
): { raceName: string | null; raceDate: string | null } {
  let raceName: string | null = null;
  let raceDate: string | null = null;

  for (const q of questions) {
    const qLower = q.question_text.toLowerCase();
    const response = responses[q.id];
    const answerText = extractAnswerText(response);

    if (!answerText) continue;

    // Check if this question is about a target race
    if (RACE_QUESTION_KEYWORDS.some(kw => qLower.includes(kw))) {
      raceName = answerText;
    }

    // Check if this question is about a race date
    if (DATE_QUESTION_KEYWORDS.some(kw => qLower.includes(kw))) {
      raceDate = answerText;
    }
  }

  return { raceName, raceDate };
}

/**
 * Extract text from an answer (handles both old and new format)
 */
function extractAnswerText(response: any): string | null {
  if (!response) return null;

  if (typeof response === 'object' && response.answer !== undefined) {
    const answer = response.answer;
    if (Array.isArray(answer)) return answer.join(', ') || null;
    return answer ? String(answer) : null;
  }

  if (Array.isArray(response)) return response.join(', ') || null;
  return response ? String(response) : null;
}

/**
 * Try to parse a date string in various formats
 */
function tryParseDate(dateStr: string): string | null {
  if (!dateStr) return null;

  // Already ISO format (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return dateStr.substring(0, 10);
  }

  // DD/MM/YYYY
  const brMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return null;
}

/**
 * Auto-fill target_race on athlete_profiles if not already set
 */
export async function autoFillTargetRace(
  clientId: string,
  raceName: string | null,
  raceDate: string | null
): Promise<boolean> {
  if (!raceName) return false;

  try {
    // Check current profile
    const { data: profile } = await supabase
      .from('athlete_profiles')
      .select('id, target_race, target_deadline')
      .eq('client_id', clientId)
      .maybeSingle();

    // Only auto-fill if target_race is currently empty
    if (profile?.target_race) return false;

    const parsedDate = raceDate ? tryParseDate(raceDate) : null;

    const updateData: Record<string, any> = {
      target_race: raceName.trim(),
    };
    if (parsedDate) {
      updateData.target_deadline = parsedDate;
    }

    if (profile) {
      const { error } = await supabase
        .from('athlete_profiles')
        .update(updateData)
        .eq('client_id', clientId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('athlete_profiles')
        .insert({ client_id: clientId, ...updateData });
      if (error) throw error;
    }

    console.log(`[AutoFill] Target race set for client ${clientId}: ${raceName}`);
    return true;
  } catch (error) {
    console.error('[AutoFill] Error setting target race:', error);
    return false;
  }
}

/**
 * Scan all existing anamnese responses and auto-fill target_race where missing.
 * Returns count of athletes updated.
 */
export async function scanAndFillTargetRaces(): Promise<{
  scanned: number;
  updated: number;
  details: { clientId: string; clientName: string; raceName: string }[];
}> {
  const details: { clientId: string; clientName: string; raceName: string }[] = [];

  // 1. Get athletes with no target_race
  const { data: profilesWithoutRace } = await supabase
    .from('athlete_profiles')
    .select('client_id')
    .is('target_race', null);

  const clientIdsWithoutRace = new Set(
    (profilesWithoutRace || []).map(p => p.client_id)
  );

  // Also include clients that don't have a profile yet
  const { data: allClients } = await supabase
    .from('clients')
    .select('id, name')
    .eq('is_active', true);

  if (!allClients) return { scanned: 0, updated: 0, details };

  // 2. Get all anamnese responses
  const { data: allResponses } = await supabase
    .from('anamnese_responses')
    .select('client_id, form_id, responses')
    .not('client_id', 'is', null)
    .order('submitted_at', { ascending: false });

  if (!allResponses) return { scanned: allClients.length, updated: 0, details };

  // 3. Get all anamnese questions for keyword scanning
  const formIds = [...new Set(allResponses.map(r => r.form_id))];
  const { data: allQuestions } = await supabase
    .from('anamnese_questions')
    .select('id, form_id, question_text, question_type')
    .in('form_id', formIds);

  const questionsByForm = (allQuestions || []).reduce((acc, q) => {
    if (!acc[q.form_id]) acc[q.form_id] = [];
    acc[q.form_id].push(q);
    return acc;
  }, {} as Record<string, typeof allQuestions>);

  // 4. Also check specific_target from athlete_profiles
  const { data: profilesWithSpecificTarget } = await supabase
    .from('athlete_profiles')
    .select('client_id, specific_target')
    .is('target_race', null)
    .not('specific_target', 'is', null);

  // 5. Process each athlete
  const clientNameMap = new Map(allClients.map(c => [c.id, c.name]));

  // First pass: check specific_target field
  for (const profile of profilesWithSpecificTarget || []) {
    if (!profile.specific_target) continue;
    const name = clientNameMap.get(profile.client_id);
    if (!name) continue;

    const filled = await autoFillTargetRace(profile.client_id, profile.specific_target, null);
    if (filled) {
      details.push({
        clientId: profile.client_id,
        clientName: name,
        raceName: profile.specific_target,
      });
    }
  }

  // Second pass: scan dynamic anamnese responses
  const processedClients = new Set(details.map(d => d.clientId));

  for (const response of allResponses) {
    if (!response.client_id || processedClients.has(response.client_id)) continue;
    if (!clientIdsWithoutRace.has(response.client_id)) continue;

    const questions = questionsByForm[response.form_id];
    if (!questions) continue;

    const { raceName, raceDate } = extractRaceFromDynamicResponses(
      questions,
      response.responses as Record<string, any>
    );

    if (raceName) {
      const name = clientNameMap.get(response.client_id) || 'Desconhecido';
      const filled = await autoFillTargetRace(response.client_id, raceName, raceDate);
      if (filled) {
        details.push({
          clientId: response.client_id,
          clientName: name,
          raceName,
        });
        processedClients.add(response.client_id);
      }
    }
  }

  return {
    scanned: allClients.length,
    updated: details.length,
    details,
  };
}
