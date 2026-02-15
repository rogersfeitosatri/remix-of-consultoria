import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Metabolic categories with question IDs (must match frontend)
const metabolicCategories = [
  { key: 'assimilacao', questionIds: ['a1','a2','a3','a4','a5','a6','a7','a8','a9','a10'] },
  { key: 'defesa_reparo', questionIds: ['dr1','dr2','dr3','dr4','dr5','dr6','dr7','dr8','dr9','dr10'] },
  { key: 'energia', questionIds: ['e1','e2','e3','e4','e5','e6','e7','e8','e9','e10'] },
  { key: 'biotransformacao', questionIds: ['b1','b2','b3','b4','b5','b6','b7','b8','b9','b10'] },
  { key: 'transporte', questionIds: ['t1','t2','t3','t4','t5','t6','t7','t8','t9','t10'] },
  { key: 'comunicacao', questionIds: ['c1','c2','c3','c4','c5','c6','c7','c8','c9','c10'] },
  { key: 'integridade_estrutural', questionIds: ['ie1','ie2','ie3','ie4','ie5','ie6','ie7','ie8','ie9','ie10'] },
  { key: 'mental_emocional', questionIds: ['me1','me2','me3','me4','me5','me6','me7','me8','me9','me10'] },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { clientId, responses, notes } = await req.json();

    if (!clientId || !responses) {
      return new Response(JSON.stringify({ error: "clientId and responses are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get client to find admin user_id
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, user_id")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      return new Response(JSON.stringify({ error: "Client not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate scores per category
    const scores: Record<string, number> = {};
    let total = 0;
    for (const cat of metabolicCategories) {
      let catScore = 0;
      for (const qId of cat.questionIds) {
        catScore += (responses[qId] || 0);
      }
      scores[cat.key] = catScore;
      total += catScore;
    }

    const row = {
      client_id: clientId,
      user_id: client.user_id,
      screening_date: new Date().toISOString().split('T')[0],
      responses,
      score_assimilacao: scores.assimilacao || 0,
      score_defesa_reparo: scores.defesa_reparo || 0,
      score_energia: scores.energia || 0,
      score_biotransformacao: scores.biotransformacao || 0,
      score_transporte: scores.transporte || 0,
      score_comunicacao: scores.comunicacao || 0,
      score_integridade_estrutural: scores.integridade_estrutural || 0,
      score_mental_emocional: scores.mental_emocional || 0,
      score_total: total,
      notes: notes || null,
    };

    const { data: screening, error: insertError } = await supabase
      .from("metabolic_screening_responses")
      .insert(row)
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to save screening" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Public metabolic screening saved:", screening.id);

    // Trigger AI analysis asynchronously
    try {
      const analyzeUrl = `${supabaseUrl}/functions/v1/analyze-metabolic-screening`;
      fetch(analyzeUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ screeningId: screening.id }),
      }).catch(err => console.error("AI analysis trigger error:", err));
    } catch (e) {
      console.error("Failed to trigger AI analysis:", e);
    }

    return new Response(JSON.stringify({ success: true, screeningId: screening.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[submit-public-metabolic-screening] Error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
