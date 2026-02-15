import { useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Download, Brain, RefreshCw, AlertTriangle, CheckCircle2, ArrowRight, Utensils, Pill, Stethoscope } from 'lucide-react';
import { ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip } from 'recharts';
import { metabolicCategories, getInterpretation, getCategoryRecommendations } from '@/data/metabolicScreeningQuestions';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  screening: any;
  onReanalyze?: () => void;
  isAnalyzing?: boolean;
}

const scoreKeys = [
  'score_assimilacao', 'score_defesa_reparo', 'score_energia', 'score_biotransformacao',
  'score_transporte', 'score_comunicacao', 'score_integridade_estrutural', 'score_mental_emocional',
];

export function MetabolicWebChart({ screening, onReanalyze, isAnalyzing }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const aiAnalysis = screening.ai_analysis as any;

  const radarData = useMemo(() =>
    metabolicCategories.map((cat, i) => ({
      category: cat.shortLabel,
      fullLabel: cat.label,
      score: screening[scoreKeys[i]] || 0,
      maxScore: cat.questions.length * 4,
      color: cat.color,
    })), [screening]);

  const interpretation = getInterpretation(screening.score_total);

  const sortedCategories = useMemo(() =>
    metabolicCategories
      .map((cat, i) => ({ ...cat, score: screening[scoreKeys[i]] || 0, maxScore: cat.questions.length * 4 }))
      .sort((a, b) => b.score - a.score)
  , [screening]);

  const handleDownload = async () => {
    if (!chartRef.current) return;
    try {
      const svg = chartRef.current.querySelector('svg');
      if (!svg) return;
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      img.onload = () => {
        canvas.width = img.width * 2;
        canvas.height = img.height * 2;
        ctx!.scale(2, 2);
        ctx!.fillStyle = '#1a1a2e';
        ctx!.fillRect(0, 0, canvas.width, canvas.height);
        ctx!.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        const link = document.createElement('a');
        link.download = `teia-metabolica-${screening.screening_date}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      };
      img.src = url;
    } catch { /* silent */ }
  };

  return (
    <div className="space-y-4">
      {/* Radar Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Teia de Interconexão Metabólica</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {format(new Date(screening.screening_date + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })}
              </Badge>
              <Button variant="ghost" size="sm" onClick={handleDownload} className="gap-1">
                <Download className="h-3.5 w-3.5" /> PNG
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div ref={chartRef} className="w-full" style={{ height: 360 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="category" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <PolarRadiusAxis angle={90} domain={[0, 40]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} />
                <Radar name="Score" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.25} strokeWidth={2} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                  formatter={(val: number, _: any, entry: any) => [`${val}/${entry.payload.maxScore}`, entry.payload.fullLabel]}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Diagnosis */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: interpretation.color }} />
            <div>
              <p className="text-sm font-semibold text-foreground">{interpretation.label} — {screening.score_total} pontos</p>
              <p className="text-xs text-muted-foreground mt-0.5">{interpretation.description}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
            {sortedCategories.map(cat => {
              const pct = Math.round((cat.score / cat.maxScore) * 100);
              return (
                <div key={cat.key} className="p-2 rounded-lg border border-border bg-card">
                  <p className="text-[10px] text-muted-foreground truncate">{cat.label}</p>
                  <p className="text-sm font-bold" style={{ color: pct > 50 ? 'hsl(0, 70%, 60%)' : pct > 25 ? 'hsl(45, 80%, 55%)' : 'hsl(120, 60%, 50%)' }}>
                    {cat.score}/{cat.maxScore}
                  </p>
                  <div className="w-full h-1 bg-muted rounded-full mt-1">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cat.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* AI Analysis Section */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              Análise de IA — Nutrição Funcional
            </CardTitle>
            {onReanalyze && (
              <Button variant="outline" size="sm" onClick={onReanalyze} disabled={isAnalyzing} className="gap-1 text-xs">
                {isAnalyzing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {isAnalyzing ? 'Analisando...' : 'Reanalisar'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isAnalyzing && !aiAnalysis && (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
              <p className="text-sm text-muted-foreground">Gerando análise com IA baseada no Tratado de Nutrição Esportiva Funcional...</p>
            </div>
          )}

          {!aiAnalysis && !isAnalyzing && (
            <div className="text-center py-6">
              <Brain className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">Análise de IA não disponível. Clique em "Reanalisar" para gerar.</p>
            </div>
          )}

          {aiAnalysis && (
            <div className="space-y-4">
              {screening.ai_analyzed_at && (
                <p className="text-[10px] text-muted-foreground">
                  Análise gerada em: {format(new Date(screening.ai_analyzed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              )}

              {/* Diagnostic */}
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-1">
                  <Stethoscope className="h-3.5 w-3.5 text-primary" /> Diagnóstico
                </h4>
                <p className="text-xs text-foreground/90 whitespace-pre-line leading-relaxed">{aiAnalysis.diagnostic}</p>
              </div>

              <Separator />

              {/* Top Imbalances */}
              {aiAnalysis.top_imbalances?.map((imb: any, i: number) => (
                <div key={i} className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                    {imb.system} ({imb.score}/40)
                  </h4>
                  <p className="text-xs text-muted-foreground">{imb.interpretation}</p>
                  
                  {imb.dietary_recommendations?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-foreground flex items-center gap-1 mb-0.5">
                        <Utensils className="h-3 w-3" /> Alimentação
                      </p>
                      <ul className="space-y-0.5">
                        {imb.dietary_recommendations.map((r: string, j: number) => (
                          <li key={j} className="text-xs text-muted-foreground pl-3 relative before:content-['•'] before:absolute before:left-0">
                            {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {imb.supplementation?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-foreground flex items-center gap-1 mb-0.5">
                        <Pill className="h-3 w-3" /> Suplementação
                      </p>
                      <ul className="space-y-0.5">
                        {imb.supplementation.map((s: string, j: number) => (
                          <li key={j} className="text-xs text-muted-foreground pl-3 relative before:content-['•'] before:absolute before:left-0">
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {imb.clinical_actions?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-foreground flex items-center gap-1 mb-0.5">
                        <Stethoscope className="h-3 w-3" /> Ações Clínicas
                      </p>
                      <ul className="space-y-0.5">
                        {imb.clinical_actions.map((a: string, j: number) => (
                          <li key={j} className="text-xs text-muted-foreground pl-3 relative before:content-['•'] before:absolute before:left-0">
                            {a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {i < (aiAnalysis.top_imbalances.length - 1) && <Separator />}
                </div>
              ))}

              <Separator />

              {/* General Recommendations */}
              {aiAnalysis.general_recommendations && (
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-1">
                    <Utensils className="h-3.5 w-3.5 text-green-500" /> Orientações Gerais
                  </h4>
                  <p className="text-xs text-foreground/90 whitespace-pre-line leading-relaxed">{aiAnalysis.general_recommendations}</p>
                </div>
              )}

              {/* Evolution Notes */}
              {aiAnalysis.evolution_notes && (
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" /> Evolução
                  </h4>
                  <p className="text-xs text-foreground/90 whitespace-pre-line leading-relaxed">{aiAnalysis.evolution_notes}</p>
                </div>
              )}

              {/* Priority Actions */}
              {aiAnalysis.priority_actions?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                    <ArrowRight className="h-3.5 w-3.5 text-primary" /> Ações Prioritárias
                  </h4>
                  <div className="space-y-1.5">
                    {aiAnalysis.priority_actions.map((action: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
                        <Badge variant="outline" className="shrink-0 text-primary border-primary/30 bg-primary/10 text-[10px]">
                          {i + 1}
                        </Badge>
                        <span className="text-xs text-foreground/90">{action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Athlete Feedback */}
              {aiAnalysis.athlete_feedback && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-[10px] font-medium text-primary mb-1">Feedback para o atleta:</p>
                  <p className="text-xs text-foreground/90">{aiAnalysis.athlete_feedback}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Static Recommendations (fallback) */}
      {!aiAnalysis && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recomendações Nutricionais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {sortedCategories.slice(0, 3).filter(c => c.score >= 10).map(cat => {
              const recs = getCategoryRecommendations(cat.key, cat.score);
              if (!recs.length) return null;
              return (
                <div key={cat.key}>
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                    {cat.label} ({cat.score} pts)
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {recs.map((r, i) => (
                      <li key={i} className="text-xs text-muted-foreground pl-4 relative before:content-['•'] before:absolute before:left-1 before:text-muted-foreground">
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {sortedCategories.filter(c => c.score >= 10).length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhuma categoria com pontuação significativa para recomendações.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
