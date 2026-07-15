// Normalização confiável da ANAMNESE COMPLETA → estrutura canônica para a IA.
// Lê respostas (keyed by question.id) usando o mapa question_key→id das perguntas.
// Não é o formato do banco; é a transformação para consumo da skill de plano.

interface QLike { id: string; question_key?: string | null; }

// Constrói { [question_key]: answer } a partir das respostas cruas (por id).
export function answersByKey(questions: QLike[], responses: Record<string, any> | null | undefined): Record<string, any> {
  const out: Record<string, any> = {};
  if (!responses) return out;
  for (const q of questions) {
    if (!q.question_key) continue;
    const raw = responses[q.id];
    out[q.question_key] = raw && typeof raw === 'object' && 'answer' in raw ? raw.answer : raw;
  }
  return out;
}

const PT_WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

function num(v: any): number | null {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export interface AnamneseCompletaNormalized {
  athlete_profile: Record<string, any>;
  goals: { selected: string[]; primary: string; other?: string };
  weight_history: Record<string, any>;
  sports_and_experience: Record<string, any>;
  weekly_training: { day: string; sessions: any[] }[];
  target_race: Record<string, any>;
  morning_pre_training: Record<string, any>;
  meal_to_training_interval: Record<string, any>;
  intra_training: any[];
  hydration_and_sweat: Record<string, any>;
  gastrointestinal_symptoms: any[];
  diagnoses_and_exams: Record<string, any>;
  medications: any[];
  health_and_recovery: Record<string, any>;
  energy_availability_flags: string[];
  menstrual_health: Record<string, any>;
  sleep: Record<string, any>;
  dietary_restrictions: any[];
  food_preferences: { preferred: string[]; avoid: string[] };
  habitual_meals: any[];
  day_to_day_food_changes: Record<string, any>;
  hunger_and_eating_behavior: Record<string, any>;
  supplements: any[];
  food_frequency: Record<string, string>;
  additional_notes: string;
  internal_alerts: any[];
}

export function normalizeAnamneseCompleta(
  questions: QLike[],
  responses: Record<string, any> | null | undefined,
  internalAlerts: any[] = [],
): AnamneseCompletaNormalized {
  const a = answersByKey(questions, responses);
  const g = (k: string) => a[k];
  const grp = (k: string): Record<string, any> => (a[k] && typeof a[k] === 'object' && !Array.isArray(a[k]) ? a[k] : {});

  // semana de treino → array normalizado (só dias com sessões)
  const rawWeek = grp('semana_treino');
  const weekly_training = PT_WEEKDAYS
    .map((day) => {
      const sessions = Array.isArray(rawWeek[day]) ? rawWeek[day] : [];
      return {
        day,
        sessions: sessions
          .filter((s: any) => s && (s.modality || s.session_type))
          .map((s: any) => ({
            start_time: s.start_time || '',
            modality: s.modality || '',
            session_type: s.session_type || '',
            duration_minutes: num(s.duration_minutes) ?? 0,
            distance_km: num(s.distance_km),
            rpe: num(s.rpe) ?? 0,
            notes: s.notes || '',
          })),
      };
    })
    .filter((d) => d.sessions.length > 0);

  const race = grp('prova_alvo');
  const target_race = race.possui === 'Sim' ? {
    modality: race.modalidade || '', name: race.nome || '', distance: race.distancia || '',
    date: race.data || null, start_time: race.horario_largada || '', estimated_duration: race.duracao_estimada || '',
    priority: race.prioridade || '', did_carbloading: race.ja_fez_carbloading || '',
    gi_discomfort: race.desconforto_gi || '', gi_discomfort_desc: race.desconforto_gi_desc || '',
  } : { has_target_race: false };

  // sintomas GI → lista
  const giRaw = g('sintomas_gi');
  const giSelected: string[] = giRaw?.selected || [];
  const giDetail: Record<string, any> = giRaw?.detail || {};
  const gastrointestinal_symptoms = giSelected
    .filter((s) => s !== 'Nenhum')
    .map((s) => ({ symptom: s, moments: giDetail[s]?.moments || [], frequency: giDetail[s]?.frequency || '', intensity: giDetail[s]?.intensity || '' }));

  // refeições habituais
  const meals = Array.isArray(g('alimentacao_habitual')) ? g('alimentacao_habitual') : [];
  const habitual_meals = meals
    .filter((m: any) => m && m.enabled !== false)
    .map((m: any) => ({
      meal_name: m.meal_name || '', time: m.time || '', days_per_week: num(m.days_per_week) ?? 0,
      training_relation: m.training_relation || '',
      foods: (Array.isArray(m.foods) ? m.foods : []).map((f: any) => ({
        food_name: f.food_name || '', quantity: num(f.quantity) ?? f.quantity ?? 0,
        unit: f.unit || '', preparation: f.preparation || '', brand: f.brand || '',
      })),
    }));

  const pre = grp('pre_treino_matinal');
  const restr = grp('restricoes');
  const pref = grp('preferencias');
  const supl = grp('suplementos');
  const intra = grp('intra_treino');
  const diag = grp('diagnosticos_exames');
  const med = grp('medicamentos');

  return {
    athlete_profile: {
      name: g('nome_completo') || '', birth_date: g('data_nascimento') || null, sex: g('sexo') || '',
      weight_kg: num(grp('peso_altura').peso_kg), height_cm: num(grp('peso_altura').altura_cm),
    },
    goals: { selected: grp('objetivos').selecionados || [], primary: grp('objetivos').prioritario || '', other: grp('objetivos').outro || '' },
    weight_history: { change: grp('mudanca_peso').mudanca || '', planned: grp('mudanca_peso').planejada || '' },
    sports_and_experience: { modalities: grp('modalidade_experiencia').modalidades || [], other: grp('modalidade_experiencia').outra_modalidade || '', experience: grp('modalidade_experiencia').tempo_pratica || '' },
    weekly_training,
    target_race,
    morning_pre_training: {
      situation: pre.situacao || '', time: pre.horario || '', foods: pre.alimentos || '',
      quantities: pre.quantidades || '', time_before_training: pre.tempo_ate_treino || '',
    },
    meal_to_training_interval: { interval: grp('intervalo_refeicao_treino').intervalo || '', varies_when: grp('intervalo_refeicao_treino').quando_varia || '' },
    intra_training: (Array.isArray(intra.produtos) ? intra.produtos : []).map((p: any) => ({
      product: p.produto || '', brand: p.marca || '', total_amount: p.quantidade_total || '',
      per_hour: p.frequencia_hora || '', fluids_per_hour: p.liquidos_hora || '', caffeine: p.cafeina || '',
    })),
    hydration_and_sweat: { fluids_per_day: grp('hidratacao').liquidos_dia || '', sweat: grp('hidratacao').transpiracao || '', signs: grp('hidratacao').sinais || [] },
    gastrointestinal_symptoms,
    diagnoses_and_exams: {
      diagnoses: diag.diagnosticos || [], description: diag.descricao || '',
      diagnosis_date: diag.data_diagnostico || null, exams_date: diag.data_exames || null,
      attachments: diag.anexos || [],
    },
    medications: med.usa === 'Sim' ? (Array.isArray(med.lista) ? med.lista : []).map((m: any) => ({ name: m.nome || '', dose: m.dose || '', time: m.horario || '', reason: m.motivo || '' })) : [],
    health_and_recovery: { situations: grp('saude_recuperacao').situacoes || [], description: grp('saude_recuperacao').descricao || '', since: grp('saude_recuperacao').ha_quanto_tempo || '', professional_followup: grp('saude_recuperacao').acompanhamento || '' },
    energy_availability_flags: Array.isArray(g('sinais_tres_meses')) ? g('sinais_tres_meses') : [],
    menstrual_health: { status: grp('ciclo_menstrual').situacao || '', last_spontaneous: grp('ciclo_menstrual').ultima_menstruacao || '' },
    sleep: { hours: grp('sono').horas || '', quality: grp('sono').qualidade || '', signs: grp('sono').sinais || [] },
    dietary_restrictions: (restr.tipos || []).filter((t: string) => t !== 'Nenhuma').map((t: string) => ({
      type: t, food_or_group: restr.alimento_grupo || '', reason: restr.reacao_motivo || '', professional_diagnosis: restr.diagnostico_profissional || '',
    })),
    food_preferences: { preferred: pref.gosta || [], avoid: pref.evitar || [] },
    habitual_meals,
    day_to_day_food_changes: { changes: grp('diferencas_entre_dias').mudancas || [], what_changes: grp('diferencas_entre_dias').o_que_muda || '' },
    hunger_and_eating_behavior: { patterns: grp('fome_comportamento').padroes || [], when: grp('fome_comportamento').quando || '' },
    supplements: (supl.itens || []).includes('Não utilizo') ? [] : (Array.isArray(supl.detalhes) ? supl.detalhes : []).map((s: any) => ({
      product: s.produto || '', brand: s.marca || '', amount: s.quantidade || '', time: s.horario || '', frequency: s.frequencia || '', recommended_by: s.quem_recomendou || '',
    })),
    food_frequency: (g('frequencia_alimentar') && typeof g('frequencia_alimentar') === 'object') ? g('frequencia_alimentar') : {},
    additional_notes: g('observacoes_adicionais') || '',
    internal_alerts: internalAlerts,
  };
}
