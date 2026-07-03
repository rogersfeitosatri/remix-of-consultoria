import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ArrowLeft, Copy, FileText, Brain, CheckCircle, User, Mail, Calendar, RefreshCw, Download, UtensilsCrossed, TrendingUp, Apple, Target, AlertTriangle, Utensils, Pill, Activity, Settings2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import { formatStructuredAnswer } from '@/lib/formatAnamneseAnswer';
import { EditableMealPlan } from '@/components/admin/EditableMealPlan';

interface AnamneseQuestion {
  id: string;
  question_text: string;
  question_type: string;
  section: string;
  order_index: number;
  options?: string[] | null;
}

export default function AnamneseResponseDetail() {
  const { responseId } = useParams<{ responseId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('respostas');

  // Admin guidance for AI (persisted per client in localStorage)
  const [guidance, setGuidance] = useState({
    meals_count: '' as string,
    target_kcal: '' as string,
    target_cho_gkg: '' as string,
    target_protein_gkg: '' as string,
    target_fat_gkg: '' as string,
    custom_instructions: '' as string,
  });

  const { data: responseData, isLoading, isError } = useQuery({
    queryKey: ['anamnese_response_detail', responseId],
    queryFn: async () => {
      const { data: response, error } = await supabase
        .from('anamnese_responses')
        .select(`
          id, client_id, form_id, responses, submitted_at, ai_analysis, ai_analyzed_at,
          respondent_name, respondent_email,
          clients (id, name, email, phone),
          anamnese_forms (id, title)
        `)
        .eq('id', responseId)
        .maybeSingle();
      if (error) throw error;
      return response;
    },
    enabled: !!responseId,
    retry: 2,
    staleTime: 30000,
  });

  const { data: aiAnalysisFromTable, isLoading: loadingAiAnalysis } = useQuery({
    queryKey: ['ai_analysis', responseData?.client_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_analyses')
        .select('*')
        .eq('client_id', responseData?.client_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!responseData?.client_id,
  });

  // Load saved guidance from localStorage when client is known
  const guidanceStorageKey = responseData?.client_id ? `ai-guidance:${responseData.client_id}` : null;
  useEffect(() => {
    if (!guidanceStorageKey) return;
    try {
      const raw = localStorage.getItem(guidanceStorageKey);
      if (raw) setGuidance((prev) => ({ ...prev, ...JSON.parse(raw) }));
    } catch {}
  }, [guidanceStorageKey]);

  const saveGuidanceLocal = (next: typeof guidance) => {
    setGuidance(next);
    if (guidanceStorageKey) {
      try { localStorage.setItem(guidanceStorageKey, JSON.stringify(next)); } catch {}
    }
  };

  const buildGuidancePayload = () => {
    const toNum = (v: string) => {
      const n = parseFloat(String(v).replace(',', '.'));
      return Number.isFinite(n) ? n : undefined;
    };
    const payload: Record<string, any> = {
      meals_count: toNum(guidance.meals_count),
      target_kcal: toNum(guidance.target_kcal),
      target_cho_gkg: toNum(guidance.target_cho_gkg),
      target_protein_gkg: toNum(guidance.target_protein_gkg),
      target_fat_gkg: toNum(guidance.target_fat_gkg),
      custom_instructions: guidance.custom_instructions?.trim() || undefined,
    };
    // Only return if anything is set
    const hasAny = Object.values(payload).some((v) => v !== undefined && v !== '');
    return hasAny ? payload : undefined;
  };

  const analyzeAthleteMutation = useMutation({
    mutationFn: async () => {
      if (!responseData?.client_id) throw new Error('Client ID not found');
      const adminGuidance = buildGuidancePayload();
      const { data, error } = await supabase.functions.invoke('analyze-athlete', {
        body: { clientId: responseData.client_id, adminGuidance },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success('Análise IA gerada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['ai_analysis', responseData?.client_id] });
      queryClient.invalidateQueries({ queryKey: ['anamnese_response_detail', responseId] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao gerar análise');
    },
  });

  const { data: questions = [] } = useQuery({
    queryKey: ['anamnese_questions', responseData?.form_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('anamnese_questions')
        .select('*')
        .eq('form_id', responseData?.form_id)
        .order('order_index', { ascending: true });
      if (error) throw error;
      return data as AnamneseQuestion[];
    },
    enabled: !!responseData?.form_id,
  });

  const groupedQuestions = questions.reduce((acc, q) => {
    if (!acc[q.section]) acc[q.section] = [];
    acc[q.section].push(q);
    return acc;
  }, {} as Record<string, AnamneseQuestion[]>);

  const formatStructured = formatStructuredAnswer;

  const formatAnswer = (questionId: string, questionType: string): string => {
    const responses = responseData?.responses as Record<string, any> | null;
    if (!responses) return '(não respondeu)';
    let answer = responses[questionId];
    if (answer === undefined || answer === null || answer === '') return '(não respondeu)';

    if (typeof answer === 'object' && !Array.isArray(answer)) {
      if ('answer' in answer) {
        const mainAnswer = answer.answer;
        const comment = answer.comment;
        if (mainAnswer === undefined || mainAnswer === null || mainAnswer === '') return '(não respondeu)';
        const structured = formatStructured(mainAnswer);
        let result = structured ?? (Array.isArray(mainAnswer) ? (mainAnswer.length > 0 ? mainAnswer.join(', ') : '(não respondeu)') : String(mainAnswer));
        if (comment && String(comment).trim()) result += `\nObservação: ${comment}`;
        return result;
      }
      const structured = formatStructured(answer);
      if (structured) return structured;
      const entries = Object.entries(answer);
      if (entries.length === 0) return '(não respondeu)';
      return entries.filter(([_, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => `${k}: ${v}`).join('\n') || '(não respondeu)';
    }
    if (Array.isArray(answer)) return answer.length === 0 ? '(não respondeu)' : answer.join(', ');
    return String(answer);
  };

  const copyAllResponses = () => {
    if (!responseData || !questions.length) { toast.error('Nenhuma resposta para copiar'); return; }
    const clientName = (responseData.clients as any)?.name || 'Atleta';
    const clientEmail = (responseData.clients as any)?.email || '';
    const submittedAt = format(parseISO(responseData.submitted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    let textToCopy = `ANAMNESE - ${clientName}\n`;
    if (clientEmail) textToCopy += `Email: ${clientEmail}\n`;
    textToCopy += `Data: ${submittedAt}\n${'='.repeat(50)}\n\n`;
    Object.entries(groupedQuestions).forEach(([section, sqs], si) => {
      textToCopy += `--- ${section} ---\n\n`;
      sqs.forEach((q, qi) => {
        textToCopy += `Pergunta ${si + 1}.${qi + 1}: ${q.question_text}\nResposta: ${formatAnswer(q.id, q.question_type)}\n\n`;
      });
    });
    navigator.clipboard.writeText(textToCopy);
    toast.success('Copiado ✅');
  };

  const MEAL_KEYWORDS = ['refeição', 'refeições', 'refeicao', 'alimentação', 'alimentar', 'rotina alimentar', 'café', 'cafe', 'almoço', 'almoco', 'jantar', 'lanche', 'ceia', 'meal', 'breakfast', 'lunch', 'dinner', 'snack', 'supper'];
  const isMealSection = (section: string) => MEAL_KEYWORDS.some(kw => section.toLowerCase().includes(kw));
  const isMealQuestion = (text: string) => {
    const kws = ['café da manhã', 'cafe da manha', 'almoço', 'almoco', 'jantar', 'lanche da manhã', 'lanche da tarde', 'ceia', 'pré-treino', 'pós-treino', 'refeição', 'o que come', 'o que costuma comer', 'rotina alimentar', 'descreva suas refeições', 'horário das refeições'];
    return kws.some(kw => text.toLowerCase().includes(kw));
  };

  // Parse the structured AI analysis from raw_response
  const getStructuredAnalysis = () => {
    const analysis = aiAnalysisFromTable || (responseData?.ai_analysis as any);
    if (!analysis) return null;

    try {
      // Try to parse raw_response first (new format)
      if (analysis.raw_response) {
        const parsed = typeof analysis.raw_response === 'string' ? JSON.parse(analysis.raw_response) : analysis.raw_response;
        if (parsed.athlete_summary && parsed.carb_estimation && parsed.meal_plan) {
          return { ...parsed, _isNewFormat: true, updated_at: analysis.updated_at };
        }
      }
    } catch {}

    // Fall back to old format
    return {
      _isNewFormat: false,
      athlete_summary: analysis.diagnosis || '',
      alerts: analysis.alerts || [],
      energy_expenditure: analysis.energy_expenditure,
      macronutrients: analysis.macronutrients,
      caloric_deficit: analysis.caloric_deficit,
      updated_at: analysis.updated_at,
    };
  };

  const generatePDF = (mode: 'complete' | 'meals' | 'analysis') => {
    if (!responseData) { toast.error('Nenhum dado para exportar'); return; }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 18;
    const maxWidth = pageWidth - margin * 2;
    let y = 22;

    // Strip emojis / non-WinAnsi symbols that jsPDF helvetica cannot render (avoids "Ø=ÜÊ" garbage)
    const clean = (s: any) => {
      if (s === null || s === undefined) return '';
      let str = String(s);
      // Remove emoji and symbol ranges
      str = str.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/gu, '');
      // Normalize arrows/bullets
      str = str.replace(/→/g, '->').replace(/[•·]/g, '-');
      return str.replace(/\s+\n/g, '\n').trim();
    };

    const ensureSpace = (needed: number) => {
      if (y + needed > pageHeight - 18) { doc.addPage(); y = 22; }
    };

    const addText = (text: string, size: number, bold = false, color: [number, number, number] = [33, 33, 33], opts: { indent?: number } = {}) => {
      const indent = opts.indent || 0;
      doc.setFontSize(size);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setTextColor(color[0], color[1], color[2]);
      const lineHeight = size * 0.5 + 1.2;
      const lines = doc.splitTextToSize(clean(text), maxWidth - indent);
      for (const line of lines) {
        ensureSpace(lineHeight);
        doc.text(line, margin + indent, y);
        y += lineHeight;
      }
    };
    const addSpace = (px: number) => { y += px; };
    const addSeparator = () => {
      ensureSpace(6);
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, y, pageWidth - margin, y);
      addSpace(6);
    };

    // Filled section header with colored bar
    const addSectionHeader = (title: string, color: [number, number, number] = [30, 80, 60]) => {
      ensureSpace(14);
      doc.setFillColor(color[0], color[1], color[2]);
      doc.rect(margin, y - 4, 3, 10, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(clean(title), margin + 6, y + 3);
      y += 12;
    };

    // Colored stat box used for macro/progression cards
    const drawStatBox = (x: number, w: number, label: string, value: string, fill: [number, number, number], stroke: [number, number, number], textColor: [number, number, number]) => {
      const h = 18;
      doc.setFillColor(fill[0], fill[1], fill[2]);
      doc.setDrawColor(stroke[0], stroke[1], stroke[2]);
      doc.roundedRect(x, y, w, h, 2, 2, 'FD');
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(clean(value), x + w / 2, y + 8, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(90, 90, 90);
      doc.text(clean(label), x + w / 2, y + 14, { align: 'center' });
    };

    const clientName = (responseData.clients as any)?.name || (responseData as any).respondent_name || 'Atleta';
    const submittedAt = format(parseISO(responseData.submitted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

    if (mode === 'analysis') {
      const sa = getStructuredAnalysis();
      if (!sa) { toast.error('Análise não disponível'); return; }

      // Header banner
      doc.setFillColor(30, 80, 60);
      doc.rect(0, 0, pageWidth, 16, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text('ANÁLISE NUTRICIONAL INTELIGENTE', margin, 11);
      y = 24;
      addText(`Atleta: ${clientName}    |    ${submittedAt}`, 10, false, [100, 100, 100]);
      addSpace(4);

      // 1. Summary
      addSectionHeader('1. Resumo do Atleta');
      addText(sa.athlete_summary || '-', 10);
      addSpace(6);

      // 2. Carb estimation
      if (sa.carb_estimation) {
        addSectionHeader('2. Estimativa Nutricional Atual');
        ensureSpace(24);
        const cols = 4;
        const gap = 4;
        const colW = (maxWidth - gap * (cols - 1)) / cols;
        const ce = sa.carb_estimation;
        drawStatBox(margin + 0 * (colW + gap), colW, 'CHO (g/kg)', `~${ce.current_cho_gkg}`, [255, 240, 230], [255, 180, 100], [200, 100, 30]);
        drawStatBox(margin + 1 * (colW + gap), colW, 'Classificação', String(ce.classification || '-'), [255, 230, 230], [220, 100, 100], [180, 50, 50]);
        drawStatBox(margin + 2 * (colW + gap), colW, 'PTN (g/kg)', ce.current_protein_gkg ? `~${ce.current_protein_gkg}` : '-', [230, 240, 255], [120, 160, 220], [50, 90, 170]);
        drawStatBox(margin + 3 * (colW + gap), colW, 'kcal/dia', ce.estimated_kcal ? `~${ce.estimated_kcal}` : '-', [235, 245, 235], [120, 180, 120], [40, 120, 50]);
        y += 22;
        addText(ce.reasoning, 9, false, [90, 90, 90]);
        addSpace(6);
      }

      // 3. Progression
      if (sa.carb_progression) {
        addSectionHeader('3. Estratégia de Progressão de Carboidratos');
        ensureSpace(24);
        const cp = sa.carb_progression;
        const cols = 3;
        const gap = 6;
        const colW = (maxWidth - gap * (cols - 1) - 50) / cols; // leave room for increment chip
        drawStatBox(margin + 0 * (colW + gap), colW, 'g/kg atual', String(cp.current ?? '-'), [255, 230, 230], [220, 100, 100], [180, 50, 50]);
        drawStatBox(margin + 1 * (colW + gap), colW, 'g/kg próximo', String(cp.next_target ?? '-'), [255, 245, 220], [220, 180, 80], [160, 110, 20]);
        drawStatBox(margin + 2 * (colW + gap), colW, 'g/kg meta', String(cp.final_goal ?? '-'), [230, 245, 230], [120, 180, 120], [40, 120, 50]);
        // Increment chip on the right
        const chipX = margin + 3 * (colW + gap);
        doc.setFillColor(240, 240, 240);
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(chipX, y, pageWidth - margin - chipX, 18, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(70, 70, 70);
        doc.text(clean(`Incremento: ${cp.increment ?? '-'}`), chipX + 4, y + 11);
        y += 22;
        addText(cp.rationale, 9, false, [90, 90, 90]);
        addSpace(6);
      }

      // 4. Meal plan
      if (sa.meal_plan?.meals) {
        addSectionHeader('4. Plano Alimentar');
        for (const meal of sa.meal_plan.meals) {
          ensureSpace(14);
          // Meal name pill
          doc.setFillColor(245, 248, 245);
          doc.setDrawColor(210, 225, 210);
          const pillH = 8;
          doc.roundedRect(margin, y - 1, maxWidth, pillH, 1.5, 1.5, 'FD');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10.5);
          doc.setTextColor(30, 80, 60);
          doc.text(clean(meal.meal_name), margin + 3, y + 5);
          y += pillH + 3;
          for (const fg of meal.food_groups || []) {
            addText(`${fg.group}: ${fg.options}`, 9.5, false, [40, 40, 40], { indent: 4 });
          }
          if (meal.meal_macros) addText(`Macros: ${meal.meal_macros}`, 8.5, true, [60, 120, 70], { indent: 4 });
          if (meal.timing_note) addText(`Timing: ${meal.timing_note}`, 8.5, false, [110, 110, 110], { indent: 4 });
          addSpace(4);
        }
        if (sa.meal_plan.daily_totals) {
          addSpace(2);
          ensureSpace(28);
          // Totals box
          const boxH = 22;
          doc.setFillColor(245, 250, 247);
          doc.setDrawColor(180, 210, 190);
          doc.roundedRect(margin, y, maxWidth, boxH, 2, 2, 'FD');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(30, 80, 60);
          doc.text('TOTAIS DIÁRIOS APROXIMADOS', margin + 4, y + 6);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(50, 50, 50);
          const dt = sa.meal_plan.daily_totals;
          const totals = [
            `kcal: ~${dt.kcal}`,
            `CHO: ~${dt.cho_g}g (${dt.cho_gkg} g/kg)`,
            `PTN: ~${dt.protein_g}g${dt.protein_gkg ? ` (${dt.protein_gkg} g/kg)` : ''}`,
            `LIP: ~${dt.fat_g}g`,
          ];
          const colW = maxWidth / 4;
          totals.forEach((t, i) => {
            doc.text(clean(t), margin + 4 + i * colW, y + 16);
          });
          y += boxH + 6;
        }
        addSpace(2);
      }

      // 5. Orientations
      if (sa.strategic_orientations) {
        addSectionHeader('5. Orientações Estratégicas');
        const so = sa.strategic_orientations;
        if (so.meal_routine?.length) {
          addText('Rotina Alimentar', 10, true, [50, 50, 50]);
          so.meal_routine.forEach((o: string) => addText(`- ${o}`, 9, false, [60, 60, 60], { indent: 4 }));
          addSpace(3);
        }
        if (so.training_strategy?.length) {
          addText('Estratégia para Treino', 10, true, [50, 50, 50]);
          so.training_strategy.forEach((o: string) => addText(`- ${o}`, 9, false, [60, 60, 60], { indent: 4 }));
          addSpace(3);
        }
        if (so.supplementation?.length) {
          addText('Suplementação', 10, true, [50, 50, 50]);
          so.supplementation.forEach((s: any) => addText(`- ${s.supplement}: ${s.recommendation}`, 9, false, [60, 60, 60], { indent: 4 }));
          addSpace(3);
        }
        if (so.race_context) {
          addText('Contexto da Prova', 10, true, [50, 50, 50]);
          addText(so.race_context, 9, false, [60, 60, 60], { indent: 4 });
        }
        addSpace(4);
      }

      // 6. Alerts
      if (sa.alerts?.length) {
        addSectionHeader('6. Alertas Importantes', [180, 80, 30]);
        sa.alerts.forEach((a: string) => {
          ensureSpace(10);
          doc.setFillColor(255, 248, 235);
          doc.setDrawColor(230, 180, 100);
          const lines = doc.splitTextToSize(clean(`! ${a}`), maxWidth - 6);
          const h = lines.length * 4.6 + 4;
          doc.roundedRect(margin, y, maxWidth, h, 1.5, 1.5, 'FD');
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(140, 70, 20);
          doc.text(lines, margin + 3, y + 5);
          y += h + 3;
        });
      }

      addSpace(6);
      addSeparator();
      addText('Rogers Feitosa - Nutrição & Treinamento', 8, false, [150, 150, 150]);

      const safeName = clientName.replace(/[^a-zA-Z0-9À-ÿ ]/g, '').replace(/\s+/g, '_');
      doc.save(`analise_nutricional_${safeName}.pdf`);
      toast.success('PDF da análise baixado!');
      return;
    }

    // Original PDF modes (complete / meals)
    if (!questions.length) { toast.error('Nenhuma resposta para exportar'); return; }
    addText(mode === 'complete' ? 'ANAMNESE COMPLETA' : 'ROTINA ALIMENTAR', 18, true, [30, 80, 60]);
    addSpace(4);
    addText(`Atleta: ${clientName}`, 12, true);
    addText(`Data: ${submittedAt}`, 10, false, [100, 100, 100]);
    addSpace(2);
    addSeparator();

    Object.entries(groupedQuestions).forEach(([section, sqs]) => {
      if (mode === 'meals') {
        const sectionIsMeal = isMealSection(section);
        const mealQs = sqs.filter(q => sectionIsMeal || isMealQuestion(q.question_text));
        if (mealQs.length === 0) return;
        addText(section, 13, true, [30, 80, 60]);
        addSpace(4);
        mealQs.forEach(q => {
          const answer = formatAnswer(q.id, q.question_type);
          addText(q.question_text, 10, true);
          addText(answer, 10, false, answer === '(não respondeu)' ? [160, 160, 160] : [33, 33, 33]);
          addSpace(5);
        });
        addSpace(4);
      } else {
        addText(section, 13, true, [30, 80, 60]);
        addSpace(4);
        sqs.forEach(q => {
          const answer = formatAnswer(q.id, q.question_type);
          addText(q.question_text, 10, true);
          addText(answer, 10, false, answer === '(não respondeu)' ? [160, 160, 160] : [33, 33, 33]);
          addSpace(5);
        });
        addSpace(4);
      }
    });

    addSpace(6);
    addSeparator();
    addText('Rogers Feitosa - Nutrição & Treinamento', 8, false, [150, 150, 150]);

    const suffix = mode === 'complete' ? 'completa' : 'refeicoes';
    const safeName = clientName.replace(/[^a-zA-Z0-9À-ÿ ]/g, '').replace(/\s+/g, '_');
    doc.save(`anamnese_${suffix}_${safeName}.pdf`);
    toast.success(`PDF ${mode === 'complete' ? 'completo' : 'de refeições'} baixado!`);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (!responseData && !isLoading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">{isError ? 'Erro ao carregar anamnese' : 'Anamnese não encontrada'}</h2>
          <Button variant="outline" onClick={() => navigate('/forms')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>
      </Layout>
    );
  }

  const client = responseData.clients as any;
  const respondentName = (responseData as any).respondent_name;
  const respondentEmail = (responseData as any).respondent_email;
  const displayName = client?.name || respondentName || 'Anônimo';
  const displayEmail = client?.email || respondentEmail || null;
  const form = responseData.anamnese_forms as any;
  const structuredAnalysis = getStructuredAnalysis();

  const choClassColor = (c: string) => {
    switch (c) {
      case 'Baixa': return 'text-red-600 bg-red-500/10 border-red-500/20';
      case 'Moderada': return 'text-yellow-600 bg-yellow-500/10 border-yellow-500/20';
      case 'Adequada': return 'text-green-600 bg-green-500/10 border-green-500/20';
      case 'Alta': return 'text-blue-600 bg-blue-500/10 border-blue-500/20';
      default: return 'text-muted-foreground bg-muted border-border';
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/forms?tab=respostas')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Anamnese de {displayName}</h1>
              <p className="text-muted-foreground">
                {form?.title || 'Formulário'} • Enviada em {format(parseISO(responseData.submitted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={copyAllResponses} variant="outline" className="gap-2">
              <Copy className="h-4 w-4" />
              Copiar
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="gap-2">
                  <Download className="h-4 w-4" />
                  Baixar PDF
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => generatePDF('complete')} className="gap-2 cursor-pointer">
                  <FileText className="h-4 w-4 text-primary" />
                  Anamnese Completa
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => generatePDF('meals')} className="gap-2 cursor-pointer">
                  <UtensilsCrossed className="h-4 w-4 text-primary" />
                  Apenas Refeições
                </DropdownMenuItem>
                {structuredAnalysis && (
                  <DropdownMenuItem onClick={() => generatePDF('analysis')} className="gap-2 cursor-pointer">
                    <Brain className="h-4 w-4 text-primary" />
                    Plano Alimentar IA
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Client Info */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{displayName}</span>
                {!client && respondentName && (
                  <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20 text-xs">Não vinculado</Badge>
                )}
              </div>
              {displayEmail && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{displayEmail}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{format(parseISO(responseData.submitted_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
              </div>
              <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
                <CheckCircle className="h-3 w-3 mr-1" />
                Concluída
              </Badge>
              {structuredAnalysis && (
                <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                  <Brain className="h-3 w-3 mr-1" />
                  Análise IA disponível
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="respostas" className="gap-2">
              <FileText className="h-4 w-4" />
              Respostas do Atleta
            </TabsTrigger>
            <TabsTrigger value="ia" className="gap-2">
              <Brain className="h-4 w-4" />
              Análise da IA
              {!structuredAnalysis && !loadingAiAnalysis && <span className="text-xs ml-1">(gerar)</span>}
            </TabsTrigger>
          </TabsList>

          {/* Responses Tab */}
          <TabsContent value="respostas" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Respostas Originais</CardTitle>
                    <CardDescription>Todas as perguntas e respostas exatamente como o atleta respondeu</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={copyAllResponses} className="gap-2">
                    <Copy className="h-4 w-4" />
                    Copiar tudo
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-8">
                    {Object.entries(groupedQuestions).map(([section, sectionQuestions]) => (
                      <div key={section}>
                        <h3 className="text-lg font-semibold mb-4 pb-2 border-b">{section}</h3>
                        <div className="space-y-6">
                          {sectionQuestions.map((question, index) => {
                            const answer = formatAnswer(question.id, question.question_type);
                            const isEmpty = answer === '(não respondeu)';
                            return (
                              <div key={question.id} className="space-y-2">
                                <p className="font-medium text-foreground">{index + 1}. {question.question_text}</p>
                                <div className={`p-3 rounded-lg ${isEmpty ? 'bg-muted/50' : 'bg-primary/5 border border-primary/10'}`}>
                                  <p className={`${isEmpty ? 'text-muted-foreground italic' : 'text-foreground'} whitespace-pre-wrap`}>{answer}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {Object.keys(groupedQuestions).length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>Nenhuma pergunta encontrada para este formulário</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Analysis Tab */}
          <TabsContent value="ia" className="mt-6 space-y-6">
            {/* Admin guidance panel — always available so the admin can tune the AI before (re)analyzing */}
            <Card className="border-primary/30 bg-primary/[0.03]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-primary" />
                  Orientações para a IA (antes de gerar a análise)
                </CardTitle>
                <CardDescription>
                  Defina parâmetros e instruções específicas. A IA usará esses valores como base obrigatória ao montar a progressão de CHO, o plano alimentar e os totais diários. Salvos automaticamente neste navegador.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="space-y-1">
                    <Label htmlFor="g_meals" className="text-xs">Nº de refeições</Label>
                    <Input id="g_meals" inputMode="numeric" placeholder="ex: 5" value={guidance.meals_count}
                      onChange={(e) => saveGuidanceLocal({ ...guidance, meals_count: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="g_kcal" className="text-xs">Meta calórica (kcal/dia)</Label>
                    <Input id="g_kcal" inputMode="numeric" placeholder="ex: 2200" value={guidance.target_kcal}
                      onChange={(e) => saveGuidanceLocal({ ...guidance, target_kcal: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="g_cho" className="text-xs">CHO (g/kg)</Label>
                    <Input id="g_cho" inputMode="decimal" placeholder="ex: 5" value={guidance.target_cho_gkg}
                      onChange={(e) => saveGuidanceLocal({ ...guidance, target_cho_gkg: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="g_ptn" className="text-xs">PTN (g/kg)</Label>
                    <Input id="g_ptn" inputMode="decimal" placeholder="ex: 1.8" value={guidance.target_protein_gkg}
                      onChange={(e) => saveGuidanceLocal({ ...guidance, target_protein_gkg: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="g_lip" className="text-xs">LIP (g/kg)</Label>
                    <Input id="g_lip" inputMode="decimal" placeholder="ex: 1.0" value={guidance.target_fat_gkg}
                      onChange={(e) => saveGuidanceLocal({ ...guidance, target_fat_gkg: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="g_notes" className="text-xs">Orientações adicionais para a IA</Label>
                  <Textarea
                    id="g_notes"
                    rows={3}
                    placeholder="Ex: priorizar carboidratos integrais, evitar lactose, incluir lanche pré-treino às 17h, focar em recuperação após long run de sábado..."
                    value={guidance.custom_instructions}
                    onChange={(e) => saveGuidanceLocal({ ...guidance, custom_instructions: e.target.value })}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => analyzeAthleteMutation.mutate()}
                    disabled={analyzeAthleteMutation.isPending}
                    className="gap-2"
                  >
                    {analyzeAthleteMutation.isPending ? (
                      <><RefreshCw className="h-4 w-4 animate-spin" />Analisando...</>
                    ) : structuredAnalysis ? (
                      <><RefreshCw className="h-4 w-4" />Reanalisar com estas orientações</>
                    ) : (
                      <><Brain className="h-4 w-4" />Gerar análise com estas orientações</>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => saveGuidanceLocal({ meals_count: '', target_kcal: '', target_cho_gkg: '', target_protein_gkg: '', target_fat_gkg: '', custom_instructions: '' })}
                  >
                    Limpar orientações
                  </Button>
                </div>
              </CardContent>
            </Card>

            {structuredAnalysis ? (
              <div className="space-y-6">
                {/* Header with reanalyze */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <Brain className="h-5 w-5 text-blue-500" />
                      Análise Nutricional Inteligente
                    </h2>
                    {structuredAnalysis.updated_at && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Gerada em {format(parseISO(structuredAnalysis.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => analyzeAthleteMutation.mutate()}
                    disabled={analyzeAthleteMutation.isPending}
                    className="gap-2"
                  >
                    {analyzeAthleteMutation.isPending ? (
                      <><RefreshCw className="h-4 w-4 animate-spin" />Analisando...</>
                    ) : (
                      <><RefreshCw className="h-4 w-4" />Reanalisar</>
                    )}
                  </Button>
                </div>

                {/* 1. RESUMO */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />
                      1. Resumo Inteligente do Atleta
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{structuredAnalysis.athlete_summary}</p>
                  </CardContent>
                </Card>

                {/* 2. ESTIMATIVA NUTRICIONAL */}
                {structuredAnalysis.carb_estimation && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Apple className="h-4 w-4 text-primary" />
                        2. Estimativa Nutricional Atual
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="text-center p-3 rounded-lg bg-muted/50">
                          <p className="text-2xl font-bold text-primary">~{structuredAnalysis.carb_estimation.current_cho_gkg}</p>
                          <p className="text-xs text-muted-foreground">CHO (g/kg)</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-muted/50">
                          <Badge className={`${choClassColor(structuredAnalysis.carb_estimation.classification)} text-sm`}>
                            {structuredAnalysis.carb_estimation.classification}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">Classificação</p>
                        </div>
                        {structuredAnalysis.carb_estimation.current_protein_gkg && (
                          <div className="text-center p-3 rounded-lg bg-muted/50">
                            <p className="text-2xl font-bold">~{structuredAnalysis.carb_estimation.current_protein_gkg}</p>
                            <p className="text-xs text-muted-foreground">PTN (g/kg)</p>
                          </div>
                        )}
                        {structuredAnalysis.carb_estimation.estimated_kcal && (
                          <div className="text-center p-3 rounded-lg bg-muted/50">
                            <p className="text-2xl font-bold">~{structuredAnalysis.carb_estimation.estimated_kcal}</p>
                            <p className="text-xs text-muted-foreground">kcal/dia</p>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground italic">{structuredAnalysis.carb_estimation.reasoning}</p>
                    </CardContent>
                  </Card>
                )}

                {/* 3. PROGRESSÃO DE CHO */}
                {structuredAnalysis.carb_progression && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        3. Estratégia de Progressão de Carboidratos
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3 mb-4 flex-wrap">
                        <div className="flex items-center gap-2">
                          <div className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
                            <p className="text-lg font-bold text-red-600">{structuredAnalysis.carb_progression.current}</p>
                            <p className="text-[10px] text-red-600">g/kg atual</p>
                          </div>
                          <span className="text-muted-foreground">→</span>
                          <div className="px-4 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-center">
                            <p className="text-lg font-bold text-yellow-600">{structuredAnalysis.carb_progression.next_target}</p>
                            <p className="text-[10px] text-yellow-600">g/kg próximo</p>
                          </div>
                          <span className="text-muted-foreground">→</span>
                          <div className="px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                            <p className="text-lg font-bold text-green-600">{structuredAnalysis.carb_progression.final_goal}</p>
                            <p className="text-[10px] text-green-600">g/kg meta</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          Incremento: {structuredAnalysis.carb_progression.increment}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground italic">{structuredAnalysis.carb_progression.rationale}</p>
                    </CardContent>
                  </Card>
                )}

                {/* 4. PLANO ALIMENTAR (Editável) */}
                {structuredAnalysis.meal_plan?.meals && responseData?.client_id && (
                  <EditableMealPlan
                    analysis={structuredAnalysis}
                    clientId={responseData.client_id}
                    onUpdated={() => {
                      queryClient.invalidateQueries({ queryKey: ['ai_analysis', responseData?.client_id] });
                      queryClient.invalidateQueries({ queryKey: ['anamnese_response_detail', responseId] });
                    }}
                  />
                )}

                {/* 5. ORIENTAÇÕES ESTRATÉGICAS */}
                {structuredAnalysis.strategic_orientations && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary" />
                        5. Orientações Estratégicas
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      {structuredAnalysis.strategic_orientations.meal_routine?.length > 0 && (
                        <div>
                          <h5 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                            <Activity className="h-3.5 w-3.5" />
                            Rotina Alimentar
                          </h5>
                          <ul className="space-y-1.5">
                            {structuredAnalysis.strategic_orientations.meal_routine.map((o: string, i: number) => (
                              <li key={i} className="text-sm text-muted-foreground flex gap-2">
                                <span className="text-primary mt-0.5">•</span>
                                <span>{o}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {structuredAnalysis.strategic_orientations.training_strategy?.length > 0 && (
                        <div>
                          <Separator className="mb-4" />
                          <h5 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                            <TrendingUp className="h-3.5 w-3.5" />
                            Estratégia para Treino
                          </h5>
                          <ul className="space-y-1.5">
                            {structuredAnalysis.strategic_orientations.training_strategy.map((o: string, i: number) => (
                              <li key={i} className="text-sm text-muted-foreground flex gap-2">
                                <span className="text-primary mt-0.5">•</span>
                                <span>{o}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {structuredAnalysis.strategic_orientations.supplementation?.length > 0 && (
                        <div>
                          <Separator className="mb-4" />
                          <h5 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                            <Pill className="h-3.5 w-3.5" />
                            Suplementação
                          </h5>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {structuredAnalysis.strategic_orientations.supplementation.map((s: any, i: number) => (
                              <div key={i} className="p-3 rounded-lg bg-muted/50 border">
                                <p className="text-sm font-medium">{s.supplement}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{s.recommendation}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {structuredAnalysis.strategic_orientations.race_context && (
                        <div>
                          <Separator className="mb-4" />
                          <h5 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                            <Target className="h-3.5 w-3.5" />
                            Contexto da Prova
                          </h5>
                          <p className="text-sm text-muted-foreground">{structuredAnalysis.strategic_orientations.race_context}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* 6. ALERTAS */}
                {structuredAnalysis.alerts?.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        6. Alertas Importantes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {structuredAnalysis.alerts.map((alert: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                            <span className="text-yellow-500 mt-0.5">⚠️</span>
                            <span className="text-sm">{alert}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Old format fallback display */}
                {!structuredAnalysis._isNewFormat && (
                  <>
                    {structuredAnalysis.energy_expenditure && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Gasto Energético</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="p-4 rounded-lg bg-muted/50">
                            <pre className="text-sm whitespace-pre-wrap">{JSON.stringify(structuredAnalysis.energy_expenditure, null, 2)}</pre>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    {structuredAnalysis.macronutrients && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Macronutrientes</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="p-4 rounded-lg bg-muted/50">
                            <pre className="text-sm whitespace-pre-wrap">{JSON.stringify(structuredAnalysis.macronutrients, null, 2)}</pre>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Brain className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Análise não disponível</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Esta anamnese ainda não foi analisada pela IA.<br />
                    Clique no botão abaixo para gerar a análise automaticamente.
                  </p>
                  <Button
                    onClick={() => analyzeAthleteMutation.mutate()}
                    disabled={analyzeAthleteMutation.isPending}
                    className="gap-2"
                  >
                    {analyzeAthleteMutation.isPending ? (
                      <><RefreshCw className="h-4 w-4 animate-spin" />Analisando...</>
                    ) : (
                      <><Brain className="h-4 w-4" />Gerar Análise com IA</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
