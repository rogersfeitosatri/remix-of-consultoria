import { ArrowLeft, CalendarDays, MapPin, Timer, Check, Circle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useActiveRace } from '@/hooks/useNutriPeriodiza';
import {
  calculateWeeksToRace,
  calculatePhase,
  categorizeDistance,
  getStaticProtocol,
  DISTANCE_LABEL,
  PHASE_META,
  type RacePhase,
} from '@/lib/nutriperiodiza';

const GOLD = 'hsl(43,74%,49%)';
const PHASE_ORDER: RacePhase[] = ['base', 'build', 'specific', 'peak', 'taper', 'race'];

function fmtTime(min?: number | null) {
  if (!min || min <= 0) return null;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`;
}

export function RacePlanScreen({ clientId, onBack }: { clientId: string; onBack: () => void }) {
  const { data: race } = useActiveRace(clientId);

  if (!race || !race.race_date) {
    return (
      <div className="space-y-4">
        <BackBtn onBack={onBack} />
        <div className="rounded-3xl bg-[#131417] border border-gray-800 py-14 text-center">
          <p className="text-4xl mb-3">🏁</p>
          <p className="text-gray-300 font-medium">Nenhuma prova cadastrada.</p>
          <p className="text-gray-500 text-sm mt-1">Quando houver uma prova-alvo, o plano aparecerá aqui.</p>
        </div>
      </div>
    );
  }

  const weeks = calculateWeeksToRace(race.race_date);
  const phase = calculatePhase(weeks);
  const dist = categorizeDistance(race.race_distance_km);
  const days = Math.max(0, Math.ceil((parseISO(race.race_date).getTime() - Date.now()) / 86400000));
  const protocol = phase ? getStaticProtocol(phase, dist) : null;
  const currentIdx = phase ? PHASE_ORDER.indexOf(phase) : -1;
  const targetTime = fmtTime(race.target_time_minutes);

  return (
    <div className="space-y-5">
      <BackBtn onBack={onBack} />

      {/* Hero */}
      <div
        className="rounded-3xl p-5 border border-[hsl(43,74%,49%)]/30"
        style={{ background: 'linear-gradient(135deg, rgba(191,150,54,0.16), rgba(0,0,0,0.25))' }}
      >
        <p className="text-[11px] uppercase tracking-wide text-gray-300">Sua prova-alvo</p>
        <h1 className="text-2xl font-extrabold text-white mt-1">{race.race_name || 'Prova'}</h1>
        <p className="text-sm text-gray-300 mt-1 flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" />
          {format(parseISO(race.race_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
        <div className="flex items-end justify-between mt-4">
          <div className="flex flex-wrap gap-2">
            {race.race_distance_km ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-black/30 border border-gray-700 px-2.5 py-1 text-xs text-gray-200">
                <MapPin className="h-3 w-3" /> {race.race_distance_km} km {dist && `· ${DISTANCE_LABEL[dist]}`}
              </span>
            ) : null}
            {targetTime && (
              <span className="inline-flex items-center gap-1 rounded-full bg-black/30 border border-gray-700 px-2.5 py-1 text-xs text-gray-200">
                <Timer className="h-3 w-3" /> {targetTime}
              </span>
            )}
          </div>
          <div className="text-right">
            <p className="text-3xl font-extrabold leading-none" style={{ color: GOLD }}>{days}</p>
            <p className="text-[10px] uppercase tracking-wide text-gray-400">dias restantes</p>
          </div>
        </div>
      </div>

      {/* Timeline of phases */}
      <div>
        <h2 className="text-sm font-bold text-white mb-3">Cronograma da preparação</h2>
        <div className="relative pl-2">
          {PHASE_ORDER.map((p, i) => {
            const meta = PHASE_META[p];
            const done = currentIdx >= 0 && i < currentIdx;
            const active = i === currentIdx;
            return (
              <div key={p} className="flex gap-3 pb-4 last:pb-0 relative">
                {i < PHASE_ORDER.length - 1 && (
                  <span className="absolute left-[11px] top-6 bottom-0 w-px bg-gray-800" />
                )}
                <div
                  className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 z-10 border ${
                    active ? 'border-[hsl(43,74%,49%)]' : done ? 'border-emerald-500/50 bg-emerald-500/15' : 'border-gray-700 bg-[#131417]'
                  }`}
                  style={active ? { background: GOLD } : undefined}
                >
                  {done ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Circle className={`h-2 w-2 ${active ? 'text-black' : 'text-gray-600'}`} fill="currentColor" />}
                </div>
                <div className={`flex-1 rounded-2xl border px-3.5 py-2.5 ${active ? 'border-[hsl(43,74%,49%)]/40 bg-[hsl(43,74%,49%)]/[0.06]' : 'border-gray-800 bg-[#131417]'}`}>
                  <div className="flex items-center gap-2">
                    <span>{meta.emoji}</span>
                    <span className={`font-bold text-sm ${active ? 'text-white' : 'text-gray-300'}`}>{meta.label}</span>
                    {active && <span className="ml-auto text-[10px] font-bold uppercase tracking-wide" style={{ color: GOLD }}>Agora</span>}
                  </div>
                  {active && <p className="text-xs text-gray-400 mt-1">{meta.description}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Nutrition strategy */}
      {protocol && (
        <div>
          <h2 className="text-sm font-bold text-white mb-3">Estratégia nutricional (fase atual)</h2>
          <div className="space-y-2.5">
            <StrategyRow label="Carboidrato diário" value={protocol.cho_daily_range} />
            <StrategyRow label="Treino intestinal" value={protocol.gut_training} />
            <StrategyRow label="Pré-treino" value={protocol.pre_training} />
            <StrategyRow label="Durante o treino" value={protocol.intra_training} />
            <StrategyRow label="Carbo-loading" value={protocol.carboloading} highlight={protocol.carboloading_indicated} />
          </div>
        </div>
      )}

      {race.notes && (
        <div className="rounded-3xl bg-[#131417] border border-gray-800 p-4">
          <h3 className="font-bold text-white mb-1.5">Observações do nutricionista</h3>
          <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{race.notes}</p>
        </div>
      )}
    </div>
  );
}

function StrategyRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${highlight ? 'border-[hsl(43,74%,49%)]/30 bg-[hsl(43,74%,49%)]/[0.05]' : 'border-gray-800 bg-[#131417]'}`}>
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-sm text-gray-100 mt-0.5">{value}</p>
    </div>
  );
}

function BackBtn({ onBack }: { onBack: () => void }) {
  return (
    <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-gray-400 active:text-white">
      <ArrowLeft className="h-4 w-4" /> Voltar
    </button>
  );
}
