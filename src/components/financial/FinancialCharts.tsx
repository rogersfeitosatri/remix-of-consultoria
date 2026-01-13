import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { DailyData, MonthlyData } from '@/hooks/useFinancialData';
import { TrendingUp, Calendar } from 'lucide-react';

interface ChartProps {
  dailyData: DailyData[];
  monthlyData: MonthlyData[];
  title: string;
  color: string;
  icon: React.ReactNode;
}

function FinancialChart({ dailyData, monthlyData, title, color, icon }: ChartProps) {
  const [viewType, setViewType] = useState<'daily' | 'monthly'>('daily');
  
  const data = viewType === 'daily' ? dailyData : monthlyData;
  const xKey = viewType === 'daily' ? 'day' : 'month';
  
  // Para mobile, reduzir quantidade de labels no eixo X
  const getInterval = () => {
    if (viewType === 'daily') {
      // Para diário, mostrar a cada 5 dias no mobile, a cada 4 no desktop
      return typeof window !== 'undefined' && window.innerWidth < 640 ? 6 : 4;
    }
    // Para mensal, mostrar a cada 2 meses no mobile
    return typeof window !== 'undefined' && window.innerWidth < 640 ? 1 : 0;
  };
  
  const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };
  
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-foreground">
            {viewType === 'daily' ? `Dia ${label}` : label}
          </p>
          <p className="text-sm font-semibold text-primary">
            {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };
  
  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <Tabs value={viewType} onValueChange={(v) => setViewType(v as 'daily' | 'monthly')}>
          <TabsList className="h-8">
            <TabsTrigger value="daily" className="text-xs px-2 sm:px-3 h-6">
              <Calendar className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Diário</span>
              <span className="sm:hidden">Dia</span>
            </TabsTrigger>
            <TabsTrigger value="monthly" className="text-xs px-2 sm:px-3 h-6">
              <TrendingUp className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Mensal</span>
              <span className="sm:hidden">Mês</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="pt-2">
        {/* Altura maior no mobile para melhor visualização */}
        <div className="h-[220px] sm:h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {viewType === 'daily' ? (
              <BarChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis 
                  dataKey={xKey} 
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                  interval={getInterval()}
                />
                <YAxis 
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                  tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
                  width={35}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="value" 
                  fill={color}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            ) : (
              <LineChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis 
                  dataKey={xKey} 
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                  interval={getInterval()}
                />
                <YAxis 
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                  tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
                  width={35}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke={color}
                  strokeWidth={2}
                  dot={{ fill: color, strokeWidth: 0, r: 3 }}
                  activeDot={{ r: 5, fill: color }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

interface FinancialChartsProps {
  dailyIncomeData: DailyData[];
  monthlyIncomeData: MonthlyData[];
  dailyDueData: DailyData[];
  monthlyDueData: MonthlyData[];
}

export function FinancialCharts({ 
  dailyIncomeData, 
  monthlyIncomeData, 
  dailyDueData, 
  monthlyDueData 
}: FinancialChartsProps) {
  return (
    <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
      <FinancialChart
        dailyData={dailyIncomeData}
        monthlyData={monthlyIncomeData}
        title="Entradas"
        color="hsl(var(--success))"
        icon={<TrendingUp className="h-4 w-4 text-success" />}
      />
      <FinancialChart
        dailyData={dailyDueData}
        monthlyData={monthlyDueData}
        title="Vencimentos"
        color="hsl(var(--warning))"
        icon={<Calendar className="h-4 w-4 text-warning" />}
      />
    </div>
  );
}
