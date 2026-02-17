import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingUp } from 'lucide-react';

interface Props {
  phaseName: string;
  dynamics: any[];
  sessions: any[];
}

export function JourneyStrategicPanel({ phaseName, dynamics, sessions }: Props) {
  if (dynamics.length === 0) return null;

  // Calculate metrics
  const total = dynamics.length;
  const lowCount = dynamics.filter(d => d.cho_classification === 'Low').length;
  const highCount = dynamics.filter(d => d.cho_classification === 'High').length;
  const medCount = dynamics.filter(d => d.cho_classification === 'Medium').length;
  const recoveryCount = dynamics.filter(d => d.cho_classification === 'Recovery').length;

  const pctLow = total > 0 ? Math.round((lowCount / total) * 100) : 0;
  const pctHigh = total > 0 ? Math.round((highCount / total) * 100) : 0;
  const pctMed = total > 0 ? Math.round((medCount / total) * 100) : 0;

  // Sleep-low estimation: nights after Low days that precede a training day
  const sleepLowCount = dynamics.filter((d, i) => {
    if (d.cho_classification !== 'Low') return false;
    const nextDay = dynamics.find(n => n.day_of_week === (d.day_of_week + 1) % 7);
    if (!nextDay) return false;
    const nextSession = sessions.find(s => s.day_of_week === nextDay.day_of_week);
    return nextSession?.modality && nextSession.modality.trim() !== '';
  }).length;

  const sleepLowFreq = total > 0 ? Math.round((sleepLowCount / (total / 7)) * 100) : 0;

  // Strategy badge
  let strategyLevel: 'balanced' | 'aggressive' | 'risk' = 'balanced';
  let strategyLabel = 'Estratégia equilibrada';
  let strategyColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';

  if (pctLow > 50) {
    strategyLevel = 'aggressive';
    strategyLabel = 'Estratégia agressiva';
    strategyColor = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  }
  if (pctLow > 65 || (pctLow > 50 && sleepLowCount > 3)) {
    strategyLevel = 'risk';
    strategyLabel = 'Risco metabólico';
    strategyColor = 'bg-red-500/20 text-red-400 border-red-500/30';
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Painel Estratégico — {phaseName}
          </CardTitle>
          <Badge variant="outline" className={`text-[10px] ${strategyColor}`}>
            {strategyLevel === 'balanced' ? '🟢' : strategyLevel === 'aggressive' ? '🟡' : '🔴'} {strategyLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <MetricCard label="Sessões Low" value={`${pctLow}%`} sub={`${lowCount} dias`} color="text-blue-400" />
          <MetricCard label="Sessões High" value={`${pctHigh}%`} sub={`${highCount} dias`} color="text-emerald-400" />
          <MetricCard label="Sessões Medium" value={`${pctMed}%`} sub={`${medCount} dias`} color="text-amber-400" />
          <MetricCard label="Recovery" value={`${recoveryCount}`} sub="dias" color="text-purple-400" />
          <MetricCard label="Sleep-Low" value={`${sleepLowCount}`} sub={`~${sleepLowFreq}%/sem`} color="text-cyan-400" />
        </div>

        {/* Strategic alerts */}
        <div className="mt-3 space-y-1">
          {pctLow > 50 && (
            <p className="text-[10px] text-amber-400">⚠️ Alta frequência de dias Low ({pctLow}%). Monitorar disponibilidade energética.</p>
          )}
          {sleepLowCount > 3 && (
            <p className="text-[10px] text-amber-400">⚠️ Sleep-low frequente ({sleepLowCount}x). Avaliar impacto na recuperação.</p>
          )}
          {pctHigh < 20 && total > 7 && (
            <p className="text-[10px] text-amber-400">⚠️ Poucos dias High ({pctHigh}%). Garantir suporte para treinos-chave.</p>
          )}
          {strategyLevel === 'balanced' && (
            <p className="text-[10px] text-emerald-400">✅ Distribuição equilibrada entre dias Low e High.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="p-2.5 rounded-lg border border-border bg-muted/20 text-center">
      <p className="text-[9px] text-muted-foreground uppercase mb-0.5">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground">{sub}</p>
    </div>
  );
}
