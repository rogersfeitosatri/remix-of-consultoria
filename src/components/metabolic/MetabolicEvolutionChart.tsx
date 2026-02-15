import { useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { metabolicCategories } from '@/data/metabolicScreeningQuestions';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const scoreKeys = [
  'score_assimilacao', 'score_defesa_reparo', 'score_energia', 'score_biotransformacao',
  'score_transporte', 'score_comunicacao', 'score_integridade_estrutural', 'score_mental_emocional',
];

interface Props {
  screenings: any[];
}

export function MetabolicEvolutionChart({ screenings }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);

  const chartData = useMemo(() => {
    return [...screenings]
      .sort((a, b) => a.screening_date.localeCompare(b.screening_date))
      .map(s => {
        const point: any = {
          date: format(new Date(s.screening_date + 'T12:00:00'), 'dd/MM/yy', { locale: ptBR }),
          total: s.score_total,
        };
        metabolicCategories.forEach((cat, i) => {
          point[cat.key] = s[scoreKeys[i]] || 0;
        });
        return point;
      });
  }, [screenings]);

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
        link.download = `evolucao-metabolica.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      };
      img.src = url;
    } catch { /* silent */ }
  };

  if (screenings.length < 2) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">São necessários pelo menos 2 rastreamentos para visualizar a evolução.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Evolução dos Escores</CardTitle>
          <Button variant="ghost" size="sm" onClick={handleDownload} className="gap-1">
            <Download className="h-3.5 w-3.5" /> PNG
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div ref={chartRef} style={{ height: 400 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {metabolicCategories.map(cat => (
                <Line
                  key={cat.key}
                  type="monotone"
                  dataKey={cat.key}
                  name={cat.shortLabel}
                  stroke={cat.color}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Total score trend */}
        <div className="mt-4" style={{ height: 180 }}>
          <p className="text-xs font-medium text-muted-foreground mb-2">Score Total</p>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
              <Line type="monotone" dataKey="total" name="Total" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
