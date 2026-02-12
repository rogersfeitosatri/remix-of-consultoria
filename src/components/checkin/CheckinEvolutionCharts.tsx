import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp, Scale, Moon, Dumbbell, Utensils, Heart } from 'lucide-react';

interface CheckinResponse {
  id: string;
  submitted_at: string;
  responses: any;
}

interface CheckinQuestion {
  id: string;
  question_text: string;
  question_type: string;
  options?: any;
}

interface Props {
  responses: CheckinResponse[];
  questions: CheckinQuestion[];
}

// Map options to numeric values for charting
const optionToValue: Record<string, number> = {
  // Percepção corporal
  'Diminuíram significativamente': 5,
  'Diminuíram levemente': 4,
  'Se mantiveram': 3,
  'Aumentaram levemente': 2,
  'Aumentaram significativamente': 1,
  
  // Fome
  'Muito baixo – quase não sinto fome': 1,
  'Baixo – sinto fome em alguns momentos, mas nada relevante': 2,
  'Médio – sinto fome em alguns momentos, mas consigo lidar bem': 3,
  'Alto – sinto fome com frequência': 4,
  'Muito alto – sinto fome o tempo todo e isso tem me incomodado': 5,
  
  // Disposição
  'Muito disposto(a)': 5,
  'Geralmente bem disposto(a)': 4,
  'Oscilando entre dias bons e cansativos': 2,
  'Muito cansado(a), a maior parte do tempo': 1,
  
  // Sono
  'Excelente – durmo bem e acordo disposto': 5,
  'Boa – durmo bem, mas com alguns despertares': 4,
  'Regular – tenho dificuldade para dormir ou acordo cansado': 2,
  'Ruim – sono leve, agitado ou insuficiente': 1,
  
  // Intestinal
  'Evacuo todos os dias': 5,
  'Evacuo em dias alternados': 3,
  'Estou um pouco constipado(a)': 2,
  'Sinto constipação frequente': 1,
  
  // Treinos
  'Me senti muito bem em todos os treinos': 5,
  'Me senti bem na maioria, com alguns dias mais difíceis': 4,
  'Tive dificuldades em vários treinos': 2,
  'Não consegui realizar os treinos intensos': 1,
  
  // Refeições fora
  'Não fiz nenhuma': 5,
  'Sim, 1': 4,
  'Sim, 2': 2,
  'Sim, 3 ou mais': 1,
};

// Question text patterns to identify question types
const questionPatterns = {
  weight: /peso.*jejum/i,
  perception: /mudança.*composição.*corporal/i,
  hunger: /fome.*apetite/i,
  disposition: /disposição.*energia/i,
  sleep: /qualidade.*sono/i,
  intestinal: /frequência.*evacuação/i,
  training: /treinos.*intensos/i,
  mealsOut: /refeição.*fora.*plano/i,
  weeklyScore: /nota.*daria.*semana/i,
};

export function CheckinEvolutionCharts({ responses, questions }: Props) {
  // Process data for charts
  const chartData = useMemo(() => {
    if (!responses.length || !questions.length) return [];
    
    // Sort responses by date (oldest first)
    const sortedResponses = [...responses].sort(
      (a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
    );
    
    return sortedResponses.map((response) => {
      const data: Record<string, any> = {
        date: format(parseISO(response.submitted_at), 'dd/MM', { locale: ptBR }),
        fullDate: format(parseISO(response.submitted_at), "dd 'de' MMM", { locale: ptBR }),
      };
      
      questions.forEach((question) => {
        const responseData = response.responses?.[question.id];
        const answer = responseData?.answer || responseData;
        
        if (!answer) return;
        
        // Identify question type and extract value
        if (questionPatterns.weight.test(question.question_text)) {
          const numValue = parseFloat(String(answer).replace(',', '.').replace(/[^\d.]/g, ''));
          if (!isNaN(numValue)) data.weight = numValue;
        } else if (questionPatterns.perception.test(question.question_text)) {
          data.perception = optionToValue[answer] || 3;
        } else if (questionPatterns.hunger.test(question.question_text)) {
          data.hunger = optionToValue[answer] || 3;
        } else if (questionPatterns.disposition.test(question.question_text)) {
          data.disposition = optionToValue[answer] || 3;
        } else if (questionPatterns.sleep.test(question.question_text)) {
          data.sleep = optionToValue[answer] || 3;
        } else if (questionPatterns.intestinal.test(question.question_text)) {
          data.intestinal = optionToValue[answer] || 3;
        } else if (questionPatterns.training.test(question.question_text)) {
          data.training = optionToValue[answer] || 3;
        } else if (questionPatterns.mealsOut.test(question.question_text)) {
          data.mealsOut = optionToValue[answer] || 3;
        } else if (questionPatterns.weeklyScore.test(question.question_text)) {
          const numValue = typeof answer === 'number' ? answer : parseInt(String(answer));
          if (!isNaN(numValue)) data.weeklyScore = numValue;
        }
      });
      
      return data;
    });
  }, [responses, questions]);

  if (chartData.length < 2) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Dados insuficientes</h3>
          <p className="text-muted-foreground">
            São necessários pelo menos 2 check-ins para gerar gráficos de evolução.
          </p>
        </CardContent>
      </Card>
    );
  }

  const chartConfig = {
    weight: { label: 'Peso (kg)', color: 'hsl(var(--primary))' },
    perception: { label: 'Percepção Corporal', color: 'hsl(var(--chart-1))' },
    disposition: { label: 'Disposição', color: 'hsl(var(--chart-2))' },
    sleep: { label: 'Sono', color: 'hsl(var(--chart-3))' },
    training: { label: 'Treinos', color: 'hsl(var(--chart-4))' },
    weeklyScore: { label: 'Nota Semanal', color: 'hsl(var(--chart-5))' },
  };

  const hasWeight = chartData.some(d => d.weight !== undefined);
  const hasPerception = chartData.some(d => d.perception !== undefined);
  const hasDisposition = chartData.some(d => d.disposition !== undefined);
  const hasSleep = chartData.some(d => d.sleep !== undefined);
  const hasTraining = chartData.some(d => d.training !== undefined);
  const hasWeeklyScore = chartData.some(d => d.weeklyScore !== undefined);

  return (
    <div className="space-y-6">
      {/* Weight Evolution */}
      {hasWeight && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-4 w-4 text-primary" />
              Evolução do Peso
            </CardTitle>
            <CardDescription>Peso em jejum ao longo dos check-ins</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis 
                    domain={['dataMin - 1', 'dataMax + 1']} 
                    tick={{ fontSize: 12 }}
                    width={40}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line 
                    type="monotone" 
                    dataKey="weight" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                    connectNulls
                    name="Peso (kg)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Weekly Score */}
      {hasWeeklyScore && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Heart className="h-4 w-4 text-red-500" />
              Nota da Semana
            </CardTitle>
            <CardDescription>Auto-avaliação semanal (1-5)</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 12 }} width={30} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar 
                    dataKey="weeklyScore" 
                    fill="hsl(var(--chart-5))" 
                    radius={[4, 4, 0, 0]}
                    name="Nota"
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Combined Wellness Metrics */}
      {(hasDisposition || hasSleep || hasTraining) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Indicadores de Bem-Estar
            </CardTitle>
            <CardDescription>Disposição, Sono e Treinos (1-5)</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 12 }} width={30} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  {hasDisposition && (
                    <Line 
                      type="monotone" 
                      dataKey="disposition" 
                      stroke="hsl(var(--chart-2))" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      connectNulls
                      name="Disposição"
                    />
                  )}
                  {hasSleep && (
                    <Line 
                      type="monotone" 
                      dataKey="sleep" 
                      stroke="hsl(var(--chart-3))" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      connectNulls
                      name="Sono"
                    />
                  )}
                  {hasTraining && (
                    <Line 
                      type="monotone" 
                      dataKey="training" 
                      stroke="hsl(var(--chart-4))" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      connectNulls
                      name="Treinos"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
            <div className="flex flex-wrap gap-4 mt-4 justify-center text-sm">
              {hasDisposition && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[hsl(var(--chart-2))]" />
                  <span className="text-muted-foreground">Disposição</span>
                </div>
              )}
              {hasSleep && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[hsl(var(--chart-3))]" />
                  <span className="text-muted-foreground">Sono</span>
                </div>
              )}
              {hasTraining && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[hsl(var(--chart-4))]" />
                  <span className="text-muted-foreground">Treinos</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Perception Evolution */}
      {hasPerception && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Utensils className="h-4 w-4 text-orange-500" />
              Percepção Corporal
            </CardTitle>
            <CardDescription>Mudanças percebidas na composição (5 = diminuiu, 1 = aumentou)</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 12 }} width={30} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line 
                    type="monotone" 
                    dataKey="perception" 
                    stroke="hsl(var(--chart-1))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--chart-1))', r: 4 }}
                    connectNulls
                    name="Percepção"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}