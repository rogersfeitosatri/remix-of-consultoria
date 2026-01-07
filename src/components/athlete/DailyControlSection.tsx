import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar, Scale, Ruler, RefreshCw, Play, TrendingUp, TrendingDown } from 'lucide-react';
import { useActiveCycle, useAllCycles, useStartCycle, useResetCycle, useCycleEntries, useUpsertEntry } from '@/hooks/useDailyControl';
import { useAthleteSupportMaterials } from '@/hooks/useSupportMaterials';
import { format, parseISO, eachDayOfInterval, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DailyControlSectionProps {
  clientId: string | null;
  isPreview?: boolean;
}

export function DailyControlSection({ clientId, isPreview = false }: DailyControlSectionProps) {
  const { data: activeCycle, isLoading: cycleLoading } = useActiveCycle(clientId || '');
  const { data: allCycles = [] } = useAllCycles(clientId || '');
  const { data: entries = [] } = useCycleEntries(activeCycle?.id);
  const { data: instructions = [] } = useAthleteSupportMaterials('controle');
  const startCycle = useStartCycle();
  const resetCycle = useResetCycle();
  const upsertEntry = useUpsertEntry();

  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');

  const handleStartCycle = async () => {
    if (isPreview || !clientId) return;
    try {
      await startCycle.mutateAsync({ clientId, startDate: new Date(startDate) });
      toast.success('Ciclo iniciado!');
    } catch (error) {
      toast.error('Erro ao iniciar ciclo');
    }
  };

  const handleResetCycle = async () => {
    if (isPreview || !clientId) return;
    try {
      await resetCycle.mutateAsync({ clientId, startDate: new Date() });
      toast.success('Novo ciclo iniciado! O anterior foi arquivado.');
    } catch (error) {
      toast.error('Erro ao resetar ciclo');
    }
  };

  const handleSaveEntry = async () => {
    if (!activeCycle || !selectedDate) return;
    try {
      await upsertEntry.mutateAsync({
        cycleId: activeCycle.id,
        entryDate: selectedDate,
        weight: weight ? parseFloat(weight) : undefined,
        waistCircumference: waist ? parseFloat(waist) : undefined,
      });
      toast.success('Registro salvo!');
      setWeight('');
      setWaist('');
      setSelectedDate(null);
    } catch (error) {
      toast.error('Erro ao salvar');
    }
  };

  const getEntryForDate = (date: string) => {
    return entries.find(e => e.entry_date === date);
  };

  // Prepare chart data
  const chartData = entries
    .filter(e => e.weight !== null)
    .map(e => ({
      date: format(parseISO(e.entry_date), 'dd/MM'),
      peso: e.weight,
      cintura: e.waist_circumference,
    }));

  const archivedCycles = allCycles.filter(c => !c.is_active);

  if (cycleLoading) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="py-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[hsl(43,74%,49%)] mx-auto"></div>
        </CardContent>
      </Card>
    );
  }

  // No active cycle - Show start form
  if (!activeCycle) {
    return (
      <div className="space-y-4">
        {/* Instructions */}
        {instructions.length > 0 && (
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Instruções</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {instructions.map((item) => (
                <div key={item.id} className="p-3 rounded-lg bg-gray-800/50">
                  <p className="font-medium text-white text-sm">{item.title}</p>
                  {item.content && <p className="text-gray-400 text-sm mt-1 whitespace-pre-wrap">{item.content}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {instructions.length === 0 && isPreview && (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="py-8 text-center">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-600" />
              <p className="text-gray-400">Nenhuma instrução configurada. Configure na aba "Conteúdo" → "Controle Diário".</p>
            </CardContent>
          </Card>
        )}

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Calendar className="h-5 w-5 text-[hsl(43,74%,49%)]" />
              Iniciar Controle Diário
            </CardTitle>
            <CardDescription className="text-gray-400">
              {isPreview ? 'Prévia do formulário que o atleta verá para iniciar o ciclo' : 'Defina a data de início para começar seu ciclo de 6 semanas'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-white">Data de Início</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white"
                disabled={isPreview}
              />
            </div>
            <Button 
              onClick={handleStartCycle} 
              disabled={startCycle.isPending || isPreview}
              className="w-full bg-[hsl(43,74%,49%)] hover:bg-[hsl(43,74%,40%)] text-black font-bold"
            >
              <Play className="h-4 w-4 mr-2" />
              Iniciar Ciclo
            </Button>
          </CardContent>
        </Card>

        {/* Archived Cycles */}
        {archivedCycles.length > 0 && (
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white text-sm">Ciclos Anteriores</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {archivedCycles.map((cycle) => (
                  <div key={cycle.id} className="p-3 rounded-lg bg-gray-800/50 flex justify-between items-center">
                    <span className="text-sm text-gray-400">
                      {format(parseISO(cycle.start_date), 'dd/MM/yyyy')} - {format(parseISO(cycle.end_date), 'dd/MM/yyyy')}
                    </span>
                    <Badge variant="secondary">Arquivado</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Active cycle - Show calendar and charts
  const cycleDays = eachDayOfInterval({
    start: parseISO(activeCycle.start_date),
    end: parseISO(activeCycle.end_date),
  });

  return (
    <div className="space-y-4">
      {/* Instructions */}
      {instructions.length > 0 && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white text-sm">Instruções</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {instructions.map((item) => (
              <div key={item.id} className="p-2 rounded-lg bg-gray-800/50">
                <p className="font-medium text-white text-sm">{item.title}</p>
                {item.content && <p className="text-gray-400 text-xs mt-1">{item.content}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Current Cycle Info */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-white">
                <Calendar className="h-5 w-5 text-[hsl(43,74%,49%)]" />
                Ciclo Atual
              </CardTitle>
              <CardDescription className="text-gray-400">
                {format(parseISO(activeCycle.start_date), "dd 'de' MMMM", { locale: ptBR })} a {format(parseISO(activeCycle.end_date), "dd 'de' MMMM", { locale: ptBR })}
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleResetCycle}
              disabled={resetCycle.isPending}
              className="border-gray-700 text-gray-400 hover:bg-gray-800"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Resetar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 mb-4">
            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => (
              <div key={i} className="text-center text-xs text-gray-500 py-1">{day}</div>
            ))}
            {cycleDays.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const entry = getEntryForDate(dateStr);
              const hasData = entry && (entry.weight || entry.waist_circumference);
              const isToday = isSameDay(day, new Date());
              const isSelected = selectedDate === dateStr;
              
              return (
                <button
                  key={dateStr}
                  onClick={() => {
                    setSelectedDate(dateStr);
                    if (entry) {
                      setWeight(entry.weight?.toString() || '');
                      setWaist(entry.waist_circumference?.toString() || '');
                    } else {
                      setWeight('');
                      setWaist('');
                    }
                  }}
                  className={`
                    p-2 text-xs rounded-lg transition-colors
                    ${isSelected ? 'bg-[hsl(43,74%,49%)] text-black' : ''}
                    ${isToday && !isSelected ? 'ring-1 ring-[hsl(43,74%,49%)]' : ''}
                    ${hasData && !isSelected ? 'bg-green-500/20 text-green-400' : ''}
                    ${!hasData && !isSelected ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : ''}
                  `}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          {/* Entry Form */}
          {selectedDate && (
            <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700 space-y-4">
              <p className="text-sm text-gray-400">
                Registrar para: <span className="text-white font-medium">{format(parseISO(selectedDate), "dd 'de' MMMM", { locale: ptBR })}</span>
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-white flex items-center gap-2">
                    <Scale className="h-4 w-4" />
                    Peso (kg)
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="Ex: 72.5"
                    className="bg-gray-900 border-gray-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white flex items-center gap-2">
                    <Ruler className="h-4 w-4" />
                    Cintura (cm)
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={waist}
                    onChange={(e) => setWaist(e.target.value)}
                    placeholder="Ex: 85"
                    className="bg-gray-900 border-gray-700 text-white"
                  />
                </div>
              </div>
              <Button 
                onClick={handleSaveEntry}
                disabled={upsertEntry.isPending || (!weight && !waist)}
                className="w-full bg-[hsl(43,74%,49%)] hover:bg-[hsl(43,74%,40%)] text-black font-bold"
              >
                Salvar Registro
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts */}
      {chartData.length > 1 && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <TrendingUp className="h-5 w-5 text-[hsl(43,74%,49%)]" />
              Evolução
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} />
                  <YAxis stroke="#9CA3AF" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="peso" 
                    stroke="hsl(43, 74%, 49%)" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(43, 74%, 49%)' }}
                    name="Peso (kg)"
                  />
                  {chartData.some(d => d.cintura) && (
                    <Line 
                      type="monotone" 
                      dataKey="cintura" 
                      stroke="#10B981" 
                      strokeWidth={2}
                      dot={{ fill: '#10B981' }}
                      name="Cintura (cm)"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Archived Cycles */}
      {archivedCycles.length > 0 && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white text-sm">Ciclos Anteriores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {archivedCycles.map((cycle) => (
                <div key={cycle.id} className="p-3 rounded-lg bg-gray-800/50 flex justify-between items-center">
                  <span className="text-sm text-gray-400">
                    {format(parseISO(cycle.start_date), 'dd/MM/yyyy')} - {format(parseISO(cycle.end_date), 'dd/MM/yyyy')}
                  </span>
                  <Badge variant="secondary">Arquivado</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
