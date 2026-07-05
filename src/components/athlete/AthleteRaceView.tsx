import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, CalendarDays, MapPin, Timer, Flag } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useActiveRace } from '@/hooks/useNutriPeriodiza';
import {
  calculateWeeksToRace,
  calculatePhase,
  categorizeDistance,
  DISTANCE_LABEL,
  PHASE_META,
} from '@/lib/nutriperiodiza';

const GOLD = 'hsl(43,74%,49%)';

function formatTargetTime(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`;
}

export function AthleteRaceView({ clientId }: { clientId?: string }) {
  const { data: race, isLoading } = useActiveRace(clientId);

  if (isLoading) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="py-10 text-center text-gray-500 text-sm">Carregando…</CardContent>
      </Card>
    );
  }

  if (!race || !race.race_date) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="py-12 text-center">
          <Trophy className="h-12 w-12 mx-auto mb-4 text-gray-600" />
          <p className="text-gray-300 font-medium">Nenhuma prova cadastrada.</p>
          <p className="text-gray-500 text-sm mt-1">Quando você tiver uma prova-alvo, o planejamento aparecerá aqui.</p>
        </CardContent>
      </Card>
    );
  }

  const weeks = calculateWeeksToRace(race.race_date);
  const phase = calculatePhase(weeks);
  const phaseMeta = phase ? PHASE_META[phase] : null;
  const distCat = categorizeDistance(race.race_distance_km);
  const targetTime = formatTargetTime(race.target_time_minutes);
  const daysToRace = weeks != null ? Math.max(0, Math.ceil((parseISO(race.race_date).getTime() - Date.now()) / 86400000)) : null;

  return (
    <div className="space-y-4">
      {/* Race hero */}
      <Card className="bg-gradient-to-br from-gray-900 to-black border-[hsl(43,74%,49%)]/30 overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Flag className="h-4 w-4" style={{ color: GOLD }} />
                <span className="text-[11px] uppercase tracking-wide text-gray-400">Sua prova-alvo</span>
              </div>
              <h2 className="text-xl font-extrabold text-white truncate">{race.race_name || 'Prova'}</h2>
              <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                {format(parseISO(race.race_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
            {daysToRace != null && (
              <div className="text-center shrink-0 rounded-2xl bg-black/40 border border-gray-700 px-3 py-2">
                <div className="text-2xl font-extrabold" style={{ color: GOLD }}>{daysToRace}</div>
                <div className="text-[10px] uppercase tracking-wide text-gray-400">dias</div>
              </div>
            )}
          </div>

          {/* meta chips */}
          <div className="flex flex-wrap gap-2 mt-4">
            {race.race_distance_km ? (
              <Badge variant="outline" className="gap-1 border-gray-700 text-gray-200">
                <MapPin className="h-3 w-3" /> {race.race_distance_km} km
                {distCat && <span className="text-gray-500">· {DISTANCE_LABEL[distCat]}</span>}
              </Badge>
            ) : null}
            {targetTime && (
              <Badge variant="outline" className="gap-1 border-gray-700 text-gray-200">
                <Timer className="h-3 w-3" /> Meta {targetTime}
              </Badge>
            )}
            {weeks != null && weeks > 0 && (
              <Badge variant="outline" className="border-gray-700 text-gray-200">
                {weeks} {weeks === 1 ? 'semana' : 'semanas'} restantes
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Current phase */}
      {phaseMeta && (
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] uppercase tracking-wide text-gray-400">Fase atual da preparação</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl flex items-center justify-center text-2xl bg-black/40 border border-gray-700 shrink-0">
                {phaseMeta.emoji}
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-white">{phaseMeta.label}</h3>
                <p className="text-sm text-gray-400">{phaseMeta.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {race.notes && (
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-4">
            <h3 className="font-bold text-white mb-1.5">Observações</h3>
            <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{race.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
