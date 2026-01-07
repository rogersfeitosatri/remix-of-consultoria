import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp, TrendingDown, Scale, Activity } from 'lucide-react';

interface CheckinResponse {
  id: string;
  submitted_at: string;
  responses: any;
  checkin_forms?: {
    title: string;
  };
}

interface EvolutionChartsProps {
  checkinResponses: CheckinResponse[];
}

export function EvolutionCharts({ checkinResponses }: EvolutionChartsProps) {
  const chartData = useMemo(() => {
    // Sort by date ascending
    const sorted = [...checkinResponses].sort(
      (a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
    );

    return sorted.map((response, index) => {
      const responses = response.responses || {};
      
      // Extract weight from responses (look for peso/weight fields)
      let weight: number | null = null;
      let energyLevel: number | null = null;
      let sleepQuality: number | null = null;
      let overallWellbeing: number | null = null;

      Object.entries(responses).forEach(([key, value]: [string, any]) => {
        const answer = value?.answer ?? value;
        const answerStr = String(answer).toLowerCase();
        
        // Try to extract numeric values
        if (typeof answer === 'number') {
          // Check for scale values (1-10 typically)
          if (answer >= 1 && answer <= 10) {
            if (!energyLevel) energyLevel = answer;
            else if (!sleepQuality) sleepQuality = answer;
            else if (!overallWellbeing) overallWellbeing = answer;
          }
        }
        
        // Try to extract weight from text responses containing numbers
        if (typeof answer === 'string') {
          const weightMatch = answer.match(/(\d+[\.,]?\d*)\s*(kg)?/i);
          if (weightMatch && !weight) {
            weight = parseFloat(weightMatch[1].replace(',', '.'));
          }
        }
        
        if (typeof answer === 'number' && answer > 30 && answer < 200) {
          if (!weight) weight = answer;
        }
      });

      return {
        date: format(parseISO(response.submitted_at), "dd/MM", { locale: ptBR }),
        fullDate: format(parseISO(response.submitted_at), "dd 'de' MMM", { locale: ptBR }),
        weight,
        energyLevel,
        sleepQuality,
        overallWellbeing,
        checkinNumber: index + 1,
      };
    });
  }, [checkinResponses]);

  // Calculate weight trend
  const weightData = chartData.filter(d => d.weight !== null);
  const hasWeightData = weightData.length >= 2;
  
  const weightTrend = useMemo(() => {
    if (!hasWeightData) return null;
    const firstWeight = weightData[0]?.weight || 0;
    const lastWeight = weightData[weightData.length - 1]?.weight || 0;
    const change = lastWeight - firstWeight;
    return {
      change: change.toFixed(1),
      isLoss: change < 0,
      percentage: ((Math.abs(change) / firstWeight) * 100).toFixed(1),
    };
  }, [weightData, hasWeightData]);

  // Calculate scale averages
  const scaleData = chartData.filter(d => d.energyLevel !== null || d.sleepQuality !== null);
  const hasScaleData = scaleData.length >= 2;

  if (checkinResponses.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Gráficos de Evolução
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            É necessário ter pelo menos 2 check-ins para gerar gráficos de evolução.
          </p>
        </CardContent>
      </Card>
    );
  }

  const chartConfig = {
    weight: {
      label: 'Peso (kg)',
      color: 'hsl(var(--primary))',
    },
    energy: {
      label: 'Energia',
      color: 'hsl(var(--chart-2))',
    },
    sleep: {
      label: 'Sono',
      color: 'hsl(var(--chart-3))',
    },
  };

  return (
    <div className="space-y-6">
      {/* Weight Evolution */}
      {hasWeightData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-5 w-5" />
                  Evolução do Peso
                </CardTitle>
                <CardDescription>
                  Histórico de peso registrado nos check-ins (kg)
                </CardDescription>
              </div>
              {weightTrend && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                  weightTrend.isLoss ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-500'
                }`}>
                  {weightTrend.isLoss ? (
                    <TrendingDown className="h-4 w-4" />
                  ) : (
                    <TrendingUp className="h-4 w-4" />
                  )}
                  <span className="text-sm font-medium">
                    {weightTrend.isLoss ? '' : '+'}{weightTrend.change} kg ({weightTrend.percentage}%)
                  </span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <AreaChart data={weightData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                <XAxis 
                  dataKey="fullDate" 
                  tick={{ fontSize: 12 }} 
                  className="text-muted-foreground"
                />
                <YAxis 
                  domain={['dataMin - 2', 'dataMax + 2']}
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  tickFormatter={(value) => `${value}kg`}
                />
                <ChartTooltip 
                  content={<ChartTooltipContent />}
                  formatter={(value) => [`${value} kg`, 'Peso']}
                />
                <Area
                  type="monotone"
                  dataKey="weight"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#weightGradient)"
                  dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Scale Metrics Evolution */}
      {hasScaleData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Evolução das Métricas
            </CardTitle>
            <CardDescription>
              Níveis de energia, sono e bem-estar ao longo do tempo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <LineChart data={scaleData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                <XAxis 
                  dataKey="fullDate" 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  domain={[1, 10]}
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="energyLevel"
                  name="Energia"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--chart-2))', strokeWidth: 2, r: 3 }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="sleepQuality"
                  name="Sono"
                  stroke="hsl(var(--chart-3))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--chart-3))', strokeWidth: 2, r: 3 }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="overallWellbeing"
                  name="Bem-estar"
                  stroke="hsl(var(--chart-4))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--chart-4))', strokeWidth: 2, r: 3 }}
                  connectNulls
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Checkin Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-sm text-muted-foreground">Total de Check-ins</p>
              <p className="text-2xl font-bold text-primary">{checkinResponses.length}</p>
            </div>
            {hasWeightData && (
              <>
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">Peso Inicial</p>
                  <p className="text-2xl font-bold">{weightData[0]?.weight} kg</p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">Peso Atual</p>
                  <p className="text-2xl font-bold">{weightData[weightData.length - 1]?.weight} kg</p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
