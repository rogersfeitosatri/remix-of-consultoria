import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ClipboardCheck, 
  ChevronDown, 
  ChevronUp, 
  Brain, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface AnamneseResponseSectionProps {
  clientId: string;
  clientName: string;
}

interface AnamneseResponse {
  id: string;
  form_id: string;
  client_id: string;
  responses: Record<string, any>;
  submitted_at: string;
  ai_analysis: any;
  ai_analyzed_at: string | null;
  anamnese_forms: {
    title: string;
    description: string | null;
  } | null;
}

interface AnamneseQuestion {
  id: string;
  question_text: string;
  section: string;
  question_type: string;
  order_index: number;
}

export function AnamneseResponseSection({ clientId, clientName }: AnamneseResponseSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const queryClient = useQueryClient();

  // Fetch anamnese responses for this client
  const { data: anamneseResponses, isLoading: loadingResponses } = useQuery({
    queryKey: ['anamnese_responses', 'client', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('anamnese_responses')
        .select(`
          *,
          anamnese_forms (title, description)
        `)
        .eq('client_id', clientId)
        .order('submitted_at', { ascending: false });
      
      if (error) throw error;
      return data as AnamneseResponse[];
    },
    enabled: !!clientId,
  });

  // Fetch AI analysis for this client
  const { data: aiAnalysis, isLoading: loadingAnalysis } = useQuery({
    queryKey: ['ai_analysis', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_analyses')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  // Fetch questions for the first form
  const firstFormId = anamneseResponses?.[0]?.form_id;
  const { data: questions = [] } = useQuery({
    queryKey: ['anamnese_questions', firstFormId],
    queryFn: async () => {
      if (!firstFormId) return [];
      
      const { data, error } = await supabase
        .from('anamnese_questions')
        .select('id, question_text, section, question_type, order_index')
        .eq('form_id', firstFormId)
        .order('order_index', { ascending: true });
      
      if (error) throw error;
      return data as AnamneseQuestion[];
    },
    enabled: !!firstFormId,
  });

  // Mutation to trigger AI analysis
  const analyzeAthleteMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('analyze-athlete', {
        body: { clientId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Análise IA gerada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['ai_analysis', clientId] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao gerar análise');
    },
  });

  const latestResponse = anamneseResponses?.[0];

  // Group questions by section
  const groupedQuestions = questions.reduce((acc, q) => {
    if (!acc[q.section]) acc[q.section] = [];
    acc[q.section].push(q);
    return acc;
  }, {} as Record<string, AnamneseQuestion[]>);

  const formatAnswer = (response: any): string => {
    if (!response) return 'Não respondido';
    
    // Handle new format with answer and comment
    if (typeof response === 'object' && response.answer !== undefined) {
      const answer = response.answer;
      const answerText = Array.isArray(answer) ? answer.join(', ') : String(answer);
      if (response.comment) {
        return `${answerText} (Comentário: ${response.comment})`;
      }
      return answerText || 'Não respondido';
    }
    
    // Handle old format
    if (Array.isArray(response)) {
      return response.join(', ');
    }
    
    return String(response) || 'Não respondido';
  };

  if (loadingResponses) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!latestResponse) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Anamnese
          </CardTitle>
          <CardDescription>Formulário de anamnese do atleta</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              O atleta ainda não preencheu a anamnese. A análise por IA só pode ser gerada após o preenchimento.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ClipboardCheck className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Anamnese
                    <Badge variant="outline" className="text-xs">
                      {format(parseISO(latestResponse.submitted_at), "dd/MM/yyyy", { locale: ptBR })}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    {latestResponse.anamnese_forms?.title || 'Formulário de anamnese'}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {aiAnalysis && (
                  <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Análise IA disponível
                  </Badge>
                )}
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* AI Analysis Section */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-3">
                <Brain className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Análise por IA</p>
                  <p className="text-sm text-muted-foreground">
                    {aiAnalysis 
                      ? `Última análise: ${format(parseISO(aiAnalysis.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                      : 'Gere uma análise automática da anamnese'}
                  </p>
                </div>
              </div>
              <Button
                onClick={() => analyzeAthleteMutation.mutate()}
                disabled={analyzeAthleteMutation.isPending}
                variant={aiAnalysis ? 'outline' : 'default'}
              >
                {analyzeAthleteMutation.isPending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Analisando...
                  </>
                ) : (
                  <>
                    <Brain className="mr-2 h-4 w-4" />
                    {aiAnalysis ? 'Reanalisar' : 'Gerar Análise'}
                  </>
                )}
              </Button>
            </div>

            {/* AI Analysis Results */}
            {aiAnalysis && (
              <div className="space-y-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
                <h4 className="font-semibold flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" />
                  Resumo Técnico (Somente Admin)
                </h4>
                
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Diagnóstico</p>
                    <p className="text-sm whitespace-pre-wrap">{aiAnalysis.diagnosis}</p>
                  </div>
                  
                  {aiAnalysis.alerts && aiAnalysis.alerts.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Pontos de Atenção e Alertas</p>
                      <ul className="space-y-1">
                        {aiAnalysis.alerts.map((alert: string, index: number) => (
                          <li key={index} className="text-sm flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                            <span>{alert}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Anamnese Responses */}
            <div className="space-y-4">
              <h4 className="font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Respostas do Atleta
              </h4>
              
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-6">
                  {Object.entries(groupedQuestions).map(([section, sectionQuestions]) => (
                    <div key={section} className="space-y-3">
                      <h5 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">
                        {section.replace(/_/g, ' ')}
                      </h5>
                      <div className="space-y-3">
                        {sectionQuestions.map((question) => {
                          const response = latestResponse.responses[question.id];
                          return (
                            <div key={question.id} className="space-y-1">
                              <p className="text-sm font-medium">{question.question_text}</p>
                              <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                                {formatAnswer(response)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}