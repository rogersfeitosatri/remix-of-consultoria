import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Copy, FileText, Brain, CheckCircle, User, Mail, Calendar, RefreshCw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

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

  // Fetch the anamnese response with all related data
  const { data: responseData, isLoading, isError } = useQuery({
    queryKey: ['anamnese_response_detail', responseId],
    queryFn: async () => {
      // First try to fetch with client data (for linked responses)
      const { data: response, error } = await supabase
        .from('anamnese_responses')
        .select(`
          id,
          client_id,
          form_id,
          responses,
          submitted_at,
          ai_analysis,
          ai_analyzed_at,
          respondent_name,
          respondent_email,
          clients (
            id,
            name,
            email,
            phone
          ),
          anamnese_forms (
            id,
            title
          )
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

  // Fetch AI analysis from ai_analyses table
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

  // Mutation to trigger AI analysis
  const analyzeAthleteMutation = useMutation({
    mutationFn: async () => {
      if (!responseData?.client_id) throw new Error('Client ID not found');
      const { data, error } = await supabase.functions.invoke('analyze-athlete', {
        body: { clientId: responseData.client_id },
      });
      if (error) throw error;
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

  // Group questions by section
  const groupedQuestions = questions.reduce((acc, q) => {
    if (!acc[q.section]) {
      acc[q.section] = [];
    }
    acc[q.section].push(q);
    return acc;
  }, {} as Record<string, AnamneseQuestion[]>);

  // Format answer for display
  const formatAnswer = (questionId: string, questionType: string): string => {
    const responses = responseData?.responses as Record<string, any> | null;
    if (!responses) return '(não respondeu)';

    let answer = responses[questionId];
    
    if (answer === undefined || answer === null || answer === '') {
      return '(não respondeu)';
    }

    // Handle object with "answer" property (common format)
    if (typeof answer === 'object' && !Array.isArray(answer)) {
      // Extract the actual answer value from { answer: "...", comment: "..." } structure
      if ('answer' in answer) {
        const mainAnswer = answer.answer;
        const comment = answer.comment;
        
        if (mainAnswer === undefined || mainAnswer === null || mainAnswer === '') {
          return '(não respondeu)';
        }
        
        let result = '';
        
        if (Array.isArray(mainAnswer)) {
          result = mainAnswer.length > 0 ? mainAnswer.join(', ') : '(não respondeu)';
        } else {
          result = String(mainAnswer);
        }
        
        // Append comment if exists
        if (comment && String(comment).trim()) {
          result += `\nObservação: ${comment}`;
        }
        
        return result;
      }
      
      // For other complex objects (like meal data), try to format nicely
      const entries = Object.entries(answer);
      if (entries.length === 0) return '(não respondeu)';
      
      return entries
        .filter(([_, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n') || '(não respondeu)';
    }

    if (Array.isArray(answer)) {
      if (answer.length === 0) return '(não respondeu)';
      return answer.join(', ');
    }

    return String(answer);
  };

  // Copy all responses to clipboard
  const copyAllResponses = () => {
    if (!responseData || !questions.length) {
      toast.error('Nenhuma resposta para copiar');
      return;
    }

    const clientName = (responseData.clients as any)?.name || 'Atleta';
    const clientEmail = (responseData.clients as any)?.email || '';
    const submittedAt = format(parseISO(responseData.submitted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

    let textToCopy = `ANAMNESE - ${clientName}\n`;
    if (clientEmail) textToCopy += `Email: ${clientEmail}\n`;
    textToCopy += `Data: ${submittedAt}\n`;
    textToCopy += `${'='.repeat(50)}\n\n`;

    const sections = Object.keys(groupedQuestions);
    
    sections.forEach((section, sectionIndex) => {
      textToCopy += `--- ${section} ---\n\n`;
      
      groupedQuestions[section].forEach((question, qIndex) => {
        const answer = formatAnswer(question.id, question.question_type);
        textToCopy += `Pergunta ${sectionIndex + 1}.${qIndex + 1}: ${question.question_text}\n`;
        textToCopy += `Resposta: ${answer}\n\n`;
      });
    });

    navigator.clipboard.writeText(textToCopy);
    toast.success('Copiado ✅', {
      description: 'Anamnese completa copiada para a área de transferência',
    });
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

  // Handle both linked (with client) and unlinked (with respondent_name) responses
  const client = responseData.clients as any;
  const respondentName = (responseData as any).respondent_name;
  const respondentEmail = (responseData as any).respondent_email;
  const displayName = client?.name || respondentName || 'Anônimo';
  const displayEmail = client?.email || respondentEmail || null;
  const form = responseData.anamnese_forms as any;
  // Use AI analysis from dedicated table (priority) or from response field
  const aiAnalysis = aiAnalysisFromTable || (responseData.ai_analysis as any);

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
          <Button onClick={copyAllResponses} className="gap-2">
            <Copy className="h-4 w-4" />
            Copiar Anamnese Completa
          </Button>
        </div>

        {/* Client Info Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{displayName}</span>
                {!client && respondentName && (
                  <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20 text-xs">
                    Não vinculado
                  </Badge>
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
                <span className="text-muted-foreground">
                  {format(parseISO(responseData.submitted_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
              </div>
              <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
                <CheckCircle className="h-3 w-3 mr-1" />
                Concluída
              </Badge>
              {aiAnalysis && (
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
              {!aiAnalysis && !loadingAiAnalysis && <span className="text-xs ml-1">(gerar)</span>}
            </TabsTrigger>
          </TabsList>

          {/* Responses Tab */}
          <TabsContent value="respostas" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Respostas Originais</CardTitle>
                    <CardDescription>
                      Todas as perguntas e respostas exatamente como o atleta respondeu
                    </CardDescription>
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
                                <p className="font-medium text-foreground">
                                  {index + 1}. {question.question_text}
                                </p>
                                <div className={`p-3 rounded-lg ${isEmpty ? 'bg-muted/50' : 'bg-primary/5 border border-primary/10'}`}>
                                  <p className={`${isEmpty ? 'text-muted-foreground italic' : 'text-foreground'} whitespace-pre-wrap`}>
                                    {answer}
                                  </p>
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
          <TabsContent value="ia" className="mt-6">
            {aiAnalysis ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Brain className="h-5 w-5 text-blue-500" />
                        Análise da Inteligência Artificial
                      </CardTitle>
                      <CardDescription>
                        Análise gerada automaticamente baseada nas respostas do atleta
                        {aiAnalysis.updated_at && (
                          <span className="block mt-1">
                            Analisada em {format(parseISO(aiAnalysis.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => analyzeAthleteMutation.mutate()}
                      disabled={analyzeAthleteMutation.isPending}
                      className="gap-2"
                    >
                      {analyzeAthleteMutation.isPending ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Analisando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4" />
                          Reanalisar
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-6">
                      {aiAnalysis.diagnosis && (
                        <div>
                          <h4 className="font-semibold mb-2">Diagnóstico</h4>
                          <p className="text-muted-foreground whitespace-pre-wrap">{aiAnalysis.diagnosis}</p>
                        </div>
                      )}

                      {aiAnalysis.alerts && aiAnalysis.alerts.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2">Alertas</h4>
                          <ul className="space-y-2">
                            {aiAnalysis.alerts.map((alert: string, i: number) => (
                              <li key={i} className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                                <span className="text-yellow-500">⚠️</span>
                                <span>{alert}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {aiAnalysis.energy_expenditure && (
                        <div>
                          <h4 className="font-semibold mb-2">Gasto Energético</h4>
                          <div className="p-4 rounded-lg bg-muted/50">
                            <pre className="text-sm whitespace-pre-wrap">
                              {JSON.stringify(aiAnalysis.energy_expenditure, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}

                      {aiAnalysis.macronutrients && (
                        <div>
                          <h4 className="font-semibold mb-2">Macronutrientes</h4>
                          <div className="p-4 rounded-lg bg-muted/50">
                            <pre className="text-sm whitespace-pre-wrap">
                              {JSON.stringify(aiAnalysis.macronutrients, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}

                      {aiAnalysis.caloric_deficit && (
                        <div>
                          <h4 className="font-semibold mb-2">Déficit Calórico</h4>
                          <div className="p-4 rounded-lg bg-muted/50">
                            <pre className="text-sm whitespace-pre-wrap">
                              {JSON.stringify(aiAnalysis.caloric_deficit, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Brain className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Análise não disponível</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Esta anamnese ainda não foi analisada pela IA.
                    <br />
                    Clique no botão abaixo para gerar a análise automaticamente.
                  </p>
                  <Button 
                    onClick={() => analyzeAthleteMutation.mutate()}
                    disabled={analyzeAthleteMutation.isPending}
                    className="gap-2"
                  >
                    {analyzeAthleteMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Analisando...
                      </>
                    ) : (
                      <>
                        <Brain className="h-4 w-4" />
                        Gerar Análise com IA
                      </>
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
