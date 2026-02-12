import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  TrendingUp, Brain, RefreshCw, Target, AlertTriangle,
  CheckCircle2, Utensils, Zap, ArrowRight
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckinEvolutionCharts } from './CheckinEvolutionCharts';

interface EvolutionAnalysisTabProps {
  clientId: string;
  clientName: string;
  responses: any[];
  questions: any[];
}

interface EvolutionAnalysis {
  overall_evolution: string;
  nutrition_insights: string;
  periodization: string;
  action_items: string[];
  athlete_strengths: string[];
  attention_points: string[];
  suggested_adjustments: string;
}

export function EvolutionAnalysisTab({ clientId, clientName, responses, questions }: EvolutionAnalysisTabProps) {
  const [analysis, setAnalysis] = useState<EvolutionAnalysis | null>(null);
  const [hasTargetRace, setHasTargetRace] = useState(false);
  const [targetRace, setTargetRace] = useState<{ name: string; deadline: string } | null>(null);

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('analyze-evolution', {
        body: { clientId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setAnalysis(data.analysis);
      setHasTargetRace(data.has_target_race);
      setTargetRace(data.target_race);
      toast.success('Análise de evolução gerada!');
    },
    onError: (error: any) => {
      console.error('Evolution analysis error:', error);
      toast.error('Erro ao gerar análise: ' + (error.message || 'Tente novamente'));
    },
  });

  return (
    <div className="space-y-6">
      {/* Evolution Charts */}
      <CheckinEvolutionCharts responses={responses} questions={questions} />

      {/* AI Evolution Analysis */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                Análise de Evolução com IA
              </CardTitle>
              <CardDescription>
                Insights de nutrição funcional e periodização nutricional para {clientName}
              </CardDescription>
            </div>
            <Button
              onClick={() => analyzeMutation.mutate()}
              disabled={analyzeMutation.isPending}
              variant={analysis ? 'outline' : 'default'}
              className="gap-2"
            >
              {analyzeMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Analisando...
                </>
              ) : analysis ? (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Reanalisar
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4" />
                  Gerar Análise de Evolução
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        {!analysis && !analyzeMutation.isPending && (
          <CardContent className="text-center py-8">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">
              Clique em "Gerar Análise de Evolução" para obter insights detalhados sobre a evolução do atleta,
              recomendações de nutrição funcional e periodização nutricional.
            </p>
          </CardContent>
        )}

        {analyzeMutation.isPending && (
          <CardContent className="text-center py-12">
            <RefreshCw className="h-10 w-10 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Analisando evolução do atleta com IA...</p>
            <p className="text-xs text-muted-foreground mt-1">Isso pode levar alguns segundos</p>
          </CardContent>
        )}

        {analysis && (
          <CardContent className="space-y-6">
            {/* Target Race Badge */}
            {hasTargetRace && targetRace && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                <Target className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-sm text-foreground">
                    Prova Alvo: {targetRace.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(targetRace.deadline).toLocaleDateString('pt-BR')} — {Math.ceil((new Date(targetRace.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} dias restantes
                  </p>
                </div>
                <Badge variant="outline" className="ml-auto bg-primary/10 text-primary border-primary/30">
                  Periodização Ativa
                </Badge>
              </div>
            )}

            {!hasTargetRace && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                <Target className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Sem prova alvo cadastrada — cadastre uma para orientações de periodização nutricional específica.
                </p>
              </div>
            )}

            <Separator />

            {/* Overall Evolution */}
            <div>
              <h3 className="font-semibold flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Evolução Geral
              </h3>
              <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">{analysis.overall_evolution}</p>
            </div>

            <Separator />

            {/* Nutrition Insights */}
            <div>
              <h3 className="font-semibold flex items-center gap-2 mb-2">
                <Utensils className="h-4 w-4 text-orange-500" />
                Insights de Nutrição Funcional
              </h3>
              <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">{analysis.nutrition_insights}</p>
            </div>

            <Separator />

            {/* Periodization */}
            <div>
              <h3 className="font-semibold flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-primary" />
                Periodização Nutricional
              </h3>
              <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">{analysis.periodization}</p>
            </div>

            <Separator />

            {/* Strengths & Attention Points */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="font-semibold flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Pontos Fortes
                </h3>
                <ul className="space-y-2">
                  {analysis.athlete_strengths?.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-green-500 shrink-0" />
                      <span className="text-foreground/90">{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  Pontos de Atenção
                </h3>
                <ul className="space-y-2">
                  {analysis.attention_points?.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-yellow-500 shrink-0" />
                      <span className="text-foreground/90">{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <Separator />

            {/* Action Items */}
            <div>
              <h3 className="font-semibold flex items-center gap-2 mb-3">
                <ArrowRight className="h-4 w-4 text-primary" />
                Ações Recomendadas
              </h3>
              <div className="space-y-2">
                {analysis.action_items?.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <Badge variant="outline" className="shrink-0 mt-0.5 text-primary border-primary/30 bg-primary/10">
                      {i + 1}
                    </Badge>
                    <span className="text-sm text-foreground/90">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Suggested Adjustments */}
            <div>
              <h3 className="font-semibold flex items-center gap-2 mb-2">
                <Utensils className="h-4 w-4 text-blue-500" />
                Ajustes Sugeridos
              </h3>
              <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">{analysis.suggested_adjustments}</p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
