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
import { formatAnyAnswer } from '@/lib/formatAnamneseAnswer';
import { isAnamneseCompletaForm } from '@/lib/anamneseCompletaQuestions';
import { AnamneseCompletaAdminView } from '@/components/admin/AnamneseCompletaAdminView';
import { EditableMealPlan } from '@/components/admin/EditableMealPlan';

interface AnamneseQuestion {
  id: string;
  question_text: string;
  question_type: string;
  section: string;
  subsection?: string | null;
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

  // Separate query for meal schedule fields (non-blocking if columns don't exist)
  const { data: mealScheduleData } = useQuery({
    queryKey: ['anamnese_meal_schedule', responseId],
    queryFn: async () => {
      try {
        const { data } = await (supabase as any)
          .from('anamnese_responses')
          .select('current_weight, meal_breakfast, meal_morning_snack, meal_morning_snack_enabled, meal_lunch, meal_afternoon_snack, meal_afternoon_snack_enabled, meal_dinner, meal_supper, meal_supper_enabled')
          .eq('id', responseId)
          .maybeSingle();
        return data;
      } catch {
        return null;
      }
    },
    enabled: !!responseId,
    retry: 0,
    staleTime: 300000,
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

  const formatAnswer = (questionId: string, questionType: string): string => {
    const responses = responseData?.responses as Record<string, any> | null;
    if (!responses) return '(não respondeu)';
    let answer = responses[questionId];
    if (answer === undefined || answer === null || answer === '') return '(não respondeu)';

    if (typeof answer === 'object' && !Array.isArray(answer) && 'answer' in answer) {
      const mainAnswer = answer.answer;
      const comment = answer.comment;
      const body = formatAnyAnswer(mainAnswer);
      const hasComment = comment && String(comment).trim();
      if (body === '(não respondeu)' && !hasComment) return '(não respondeu)';
      let result = body === '(não respondeu)' ? '' : body;
      if (hasComment) result += (result ? '\n' : '') + `Observação: ${String(comment).trim()}`;
      return result || '(não respondeu)';
    }
    return formatAnyAnswer(answer);
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

  const generatePDF = async (mode: 'complete' | 'meals' | 'analysis') => {
    // Modo "analysis" agora usa layout Dietitian (minimalista, roxo/verde) via HTML→PDF.
    if (mode === 'analysis') {
      if (!responseData) { toast.error('Nenhum dado para exportar'); return; }
      const sa = getStructuredAnalysis();
      if (!sa) { toast.error('Análise não disponível'); return; }
      const clientName = (responseData.clients as any)?.name || (responseData as any).respondent_name || 'Atleta';
      const safeName = clientName.replace(/[^a-zA-Z0-9À-ÿ ]/g, '').replace(/\s+/g, '_');
      try {
        const { downloadMealPlanPdf, structuredAnalysisToPdfInput } = await import('@/lib/mealPlanPdf');
        const input = structuredAnalysisToPdfInput(sa, clientName, {
          startDate: format(parseISO(responseData.submitted_at), 'dd/MM/yyyy'),
          signatureName: 'Rogers Feitosa',
          crn: 'CRN 14885',
        });
        await downloadMealPlanPdf(input, safeName);
        toast.success('PDF gerado!');
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || 'Erro ao gerar PDF');
      }
      return;
    }

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

    // Modo analysis já foi tratado no início da função.


    // Original PDF modes (complete / meals)
    if (!questions.length) { toast.error('Nenhuma resposta para exportar'); return; }
    addText(mode === 'complete' ? 'ANAMNESE COMPLETA' : 'ROTINA ALIMENTAR', 18, true, [30, 80, 60]);
    addSpace(4);
    addText(`Atleta: ${clientName}`, 12, true);
    addText(`Data: ${submittedAt}`, 10, false, [100, 100, 100]);
    addSpace(2);
    addSeparator();

    Object.entries(groupedQuestions).forEach(([section, sqs]) => {
      const bySub: Record<string, AnamneseQuestion[]> = {};
      sqs.forEach((q) => {
        const key = ((q as any).subsection || '').trim();
        if (!bySub[key]) bySub[key] = [];
        bySub[key].push(q);
      });
      if (mode === 'meals') {
        const sectionIsMeal = isMealSection(section);
        const mealQs = sqs.filter(q => q.question_type !== 'info' && (sectionIsMeal || isMealQuestion(q.question_text)));
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
        Object.entries(bySub).forEach(([sub, subQs]) => {
          if (sub) { addText(sub, 11, true, [90, 90, 90]); addSpace(2); }
          subQs.forEach(q => {
            if (q.question_type === 'info') return;
            const answer = formatAnswer(q.id, q.question_type);
            addText(q.question_text, 10, true);
            addText(answer, 10, false, answer === '(não respondeu)' ? [160, 160, 160] : [33, 33, 33]);
            addSpace(5);
          });
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
              <CardContent className="space-y-8">
                {isAnamneseCompletaForm((responseData as any)?.anamnese_forms) && (
                  <AnamneseCompletaAdminView
                    response={responseData as any}
                    questions={questions as any}
                    onUpdated={() => queryClient.invalidateQueries({ queryKey: ['anamnese_response_detail', responseId] })}
                  />
                )}
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-8">
                    <h3 className="text-base font-semibold text-muted-foreground">Todas as respostas (fonte original)</h3>
                    {Object.entries(groupedQuestions).map(([section, sectionQuestions]) => {
                      // Agrupar por subseção dentro de cada seção
                      const bySub: Record<string, AnamneseQuestion[]> = {};
                      sectionQuestions.forEach((q) => {
                        const key = (q.subsection || '').trim();
                        if (!bySub[key]) bySub[key] = [];
                        bySub[key].push(q);
                      });
                      return (
                        <div key={section}>
                          <h3 className="text-lg font-semibold mb-4 pb-2 border-b">{section}</h3>
                          {Object.entries(bySub).map(([sub, subQs]) => (
                            <div key={sub || 'no-sub'} className="mb-6">
                              {sub && (
                                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">{sub}</h4>
                              )}
                              <div className="space-y-4">
                                {subQs.map((question, index) => {
                                  if (question.question_type === 'info') return null;
                                  const answer = formatAnswer(question.id, question.question_type);
                                  const isEmpty = answer === '(não respondeu)';
                                  return (
                                    <div key={question.id} className="space-y-2">
                                      <p className="font-medium text-foreground text-sm">{index + 1}. {question.question_text}</p>
                                      <div className={`p-3 rounded-lg ${isEmpty ? 'bg-muted/50' : 'bg-primary/5 border border-primary/10'}`}>
                                        <p className={`text-sm ${isEmpty ? 'text-muted-foreground italic' : 'text-foreground'} whitespace-pre-wrap break-words`}>{answer}</p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
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
            {/* Atalho para a nova área dedicada de Plano Alimentar */}
            {responseData?.client_id && (
              <Card className="border-primary/40 bg-primary/[0.04]">
                <CardContent className="py-3 flex items-center gap-3">
                  <UtensilsCrossed className="h-5 w-5 text-primary shrink-0" />
                  <p className="text-sm flex-1">
                    O plano alimentar agora tem uma <span className="font-medium">área dedicada</span> — crie do zero ou pela IA, edite metas e orientações num só lugar.
                  </p>
                  <Button size="sm" onClick={() => navigate(`/meal-plans/${responseData.client_id}`)} className="gap-1.5 shrink-0">
                    Abrir Plano Alimentar
                  </Button>
                </CardContent>
              </Card>
            )}

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
                    athleteWeightKg={mealScheduleData?.current_weight ?? null}
                    mealSchedule={mealScheduleData ? {
                      cafe_da_manha: mealScheduleData.meal_breakfast,
                      lanche_manha: mealScheduleData.meal_morning_snack,
                      lanche_manha_enabled: mealScheduleData.meal_morning_snack_enabled,
                      almoco: mealScheduleData.meal_lunch,
                      lanche_tarde: mealScheduleData.meal_afternoon_snack,
                      lanche_tarde_enabled: mealScheduleData.meal_afternoon_snack_enabled,
                      jantar: mealScheduleData.meal_dinner,
                      ceia: mealScheduleData.meal_supper,
                      ceia_enabled: mealScheduleData.meal_supper_enabled,
                    } : undefined}
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
