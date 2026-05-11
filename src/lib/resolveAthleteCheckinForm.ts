import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves the correct check-in form to send to a specific athlete.
 *
 * Priority order:
 *  1. The form linked to the athlete's active schedule (athlete_checkin_schedules.checkin_form_id)
 *  2. The admin's first active form (fallback)
 *
 * Returns null if no usable form is found OR if the resolved form has zero questions
 * (an empty form would render a blank page for the athlete).
 */
export async function resolveAthleteCheckinForm(
  clientId: string,
  adminUserId: string,
): Promise<{ id: string; title: string } | null> {
  // 1) Prefer the form linked in the athlete's active schedule
  const { data: schedule } = await supabase
    .from("athlete_checkin_schedules")
    .select("checkin_form_id")
    .eq("client_id", clientId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let formId = schedule?.checkin_form_id ?? null;

  // 2) Fallback to admin's first active form
  if (!formId) {
    const { data: activeForm } = await supabase
      .from("checkin_forms")
      .select("id")
      .eq("user_id", adminUserId)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    formId = activeForm?.id ?? null;
  }

  if (!formId) return null;

  // Validate: form must be active AND have at least one question
  const { data: form } = await supabase
    .from("checkin_forms")
    .select("id, title, is_active")
    .eq("id", formId)
    .maybeSingle();

  if (!form?.is_active) return null;

  const { count } = await supabase
    .from("checkin_questions")
    .select("id", { count: "exact", head: true })
    .eq("form_id", formId);

  if (!count || count === 0) return null;

  return { id: form.id, title: form.title };
}
