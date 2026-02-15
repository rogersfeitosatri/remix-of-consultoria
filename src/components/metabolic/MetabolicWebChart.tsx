import { useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip } from 'recharts';
import { metabolicCategories, getInterpretation, getCategoryRecommendations } from '@/data/metabolicScreeningQuestions';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  screening: any;
}

const scoreKeys = [
  'score_assimilacao', 'score_defesa_reparo', 'score_energia', 'score_biotransformacao',
  'score_transporte', 'score_comunicacao', 'score_integridade_estrutural', 'score_mental_emocional',
];

export function MetabolicWebChart({ screening }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);

  const radarData = useMemo(() =>
    metabolicCategories.map((cat, i) => ({
      category: cat.shortLabel,
      fullLabel: cat.label,
      score: screening[scoreKeys[i]] || 0,
      maxScore: cat.questions.length * 4,
      color: cat.color,
    })), [screening]);

  const interpretation = getInterpretation(screening.score_total);

  // Sorted categories by score descending
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

          {/* Category breakdown */}
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

      {/* Recommendations for top 3 categories */}
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
    </div>
  );
}
