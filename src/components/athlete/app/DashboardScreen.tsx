import { useMemo, useState, useEffect } from 'react';
import { Utensils, Droplets, Scale, ClipboardCheck, ChevronRight, Flag, Plus, TrendingUp, TrendingDown, Clock, Shuffle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { PlanMeal, PlanFood } from '@/lib/athletePlan';
import { foodQuantityLine } from '@/lib/athletePlan';
import type { ActiveRace } from '@/hooks/useNutriPeriodiza';
import { calculateWeeksToRace } from '@/lib/nutriperiodiza';

const GOLD = 'hsl(43,74%,49%)';

function timeToMinutes(t?: string): number | null {
  if (!t) return null;
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function pickNextMealIndexByTime(meals: PlanMeal[]): number {
  if (meals.length === 0) return -1;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  // First meal whose time >= now
  for (let i = 0; i < meals.length; i++) {
    const mm = timeToMinutes(meals[i].time);
    if (mm != null && mm >= nowMin) return i;
  }
  // Otherwise last meal of the day (already passed all) — or first
  return meals.length - 1;
}

function NextMealHero({ meals, onGoPlano }: { meals: PlanMeal[]; onGoPlano: () => void }) {
  const initialIdx = useMemo(() => pickNextMealIndexByTime(meals), [meals]);
  const [selectedIdx, setSelectedIdx] = useState(initialIdx);

  // Re-sync when meals load or every minute
  useEffect(() => { setSelectedIdx(pickNextMealIndexByTime(meals)); }, [meals]);
  useEffect(() => {
    const t = setInterval(() => setSelectedIdx(pickNextMealIndexByTime(meals)), 60_000);
    return () => clearInterval(t);
  }, [meals]);

  if (meals.length === 0 || selectedIdx < 0) return null;
  const meal = meals[selectedIdx];

  return (
    <div className="space-y-3">
      {/* Meal tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
        {meals.map((m, i) => {
          const active = i === selectedIdx;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setSelectedIdx(i)}
              className={`shrink-0 px-4 h-10 rounded-full border text-sm font-semibold transition-colors ${
                active
                  ? 'bg-[hsl(43,74%,49%)] text-black border-transparent'
                  : 'bg-[#131417] text-gray-300 border-gray-800'
              }`}
            >
              {m.name}
              {m.time && <span className={`ml-2 font-normal ${active ? 'text-black/70' : 'text-gray-500'}`}>{m.time}</span>}
            </button>
          );
        })}
      </div>

      {/* Next meal card */}
      <button
        type="button"
        onClick={onGoPlano}
        className="w-full text-left rounded-3xl bg-[#131417] border border-gray-800 p-4 active:scale-[0.99] transition-transform"
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: GOLD }}>Próxima Refeição</span>
          <Clock className="h-3.5 w-3.5" style={{ color: GOLD }} />
        </div>
        <h3 className="text-lg font-extrabold text-white leading-tight mb-3">
          {meal.name}{meal.time ? ` – ${meal.time}` : ''}
        </h3>

        {meal.foods.length === 0 ? (
          <p className="text-sm text-gray-500">Sem itens cadastrados nessa refeição.</p>
        ) : (
          <div className="space-y-2.5">
            {meal.foods.slice(0, 3).map((g, i) => (
              <div key={i}>
                <p className="text-sm text-gray-100">
                  {g.primary.name}
                  {(() => {
                    const q = foodQuantityLine(g.primary);
                    return q ? <span className="text-gray-400"> - {q}</span> : null;
                  })()}
                  {g.alternatives.length > 0 && <span className="text-gray-500"> ou</span>}
                </p>
                {g.alternatives.length > 0 && (
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                    <Shuffle className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {g.alternatives[0].name}
                      {(() => {
                        const q = foodQuantityLine(g.alternatives[0]);
                        return q ? ` - ${q}` : '';
                      })()}
                      {g.alternatives.length > 1 && ` ou +${g.alternatives.length - 1} opções`}
                    </span>
                  </p>
                )}
              </div>
            ))}
            {meal.foods.length > 3 && meal.foods.some(g => g.alternatives.length > 0) && (
              <p className="text-xs text-gray-500">+{meal.foods.length - 3} itens</p>
            )}
          </div>
        )}

        {/* Dots pagination */}
        {meals.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-4">
            {meals.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === selectedIdx ? 'w-4 bg-[hsl(43,74%,49%)]' : 'w-1.5 bg-gray-700'
                }`}
              />
            ))}
          </div>
        )}
      </button>
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function StatTile({ icon, label, value, hint, onClick }: { icon: React.ReactNode; label: string; value: string; hint?: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-3xl bg-[#131417] border border-gray-800 p-4 active:scale-[0.98] transition-transform"
    >
      <div className="flex items-center gap-2 text-gray-400 mb-2">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-2xl font-extrabold text-white leading-none">{value}</p>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </button>
  );
}

export function DashboardScreen({
  firstName,
  meals,
  completedMeals,
  waterMl,
  waterGoalMl,
  onAddWater,
  race,
  checkins,
  readOnly,
  onOpenRace,
  onGoPlano,
  onGoEvolucao,
}: {
  firstName: string;
  meals: PlanMeal[];
  completedMeals: string[];
  waterMl: number;
  waterGoalMl: number;
  onAddWater: (ml: number) => void;
  race?: ActiveRace | null;
  checkins: any[];
  readOnly?: boolean;
  onOpenRace: () => void;
  onGoPlano: () => void;
  onGoEvolucao: () => void;
}) {
  const totalMeals = meals.length;
  const doneCount = meals.filter((m) => completedMeals.includes(m.key)).length;
  const remaining = Math.max(0, totalMeals - doneCount);
  const nextMeal = meals.find((m) => !completedMeals.includes(m.key));

  const weightEntries = checkins
    .filter((c) => c?.responses?.peso)
    .map((c) => ({ w: parseFloat(String(c.responses.peso).replace(',', '.')), at: c.submitted_at }))
    .filter((e) => !isNaN(e.w));
  const latestWeight = weightEntries[0];
  const prevWeight = weightEntries[1];
  const weightDelta = latestWeight && prevWeight ? +(latestWeight.w - prevWeight.w).toFixed(1) : null;

  const lastCheckin = checkins[0];
  const raceWeeks = race?.race_date ? calculateWeeksToRace(race.race_date) : null;
  const raceDays = race?.race_date ? Math.max(0, Math.ceil((parseISO(race.race_date).getTime() - Date.now()) / 86400000)) : null;

  const waterPct = waterGoalMl > 0 ? Math.min(100, Math.round((waterMl / waterGoalMl) * 100)) : 0;

  return (
    <div className="space-y-5">
      {/* Race countdown badge */}
      {race && raceDays != null && (
        <button
          type="button"
          onClick={onOpenRace}
          className="w-full flex items-center gap-3 rounded-3xl p-4 text-left active:scale-[0.99] transition-transform border border-[hsl(43,74%,49%)]/30"
          style={{ background: 'linear-gradient(135deg, rgba(191,150,54,0.18), rgba(0,0,0,0.2))' }}
        >
          <div className="h-12 w-12 rounded-2xl bg-black/40 border border-[hsl(43,74%,49%)]/40 flex items-center justify-center shrink-0">
            <Flag className="h-5 w-5" style={{ color: GOLD }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-gray-300">Próxima prova</p>
            <p className="font-bold text-white truncate">{race.race_name || 'Prova'}</p>
          </div>
          <div className="text-center shrink-0">
            <p className="text-2xl font-extrabold leading-none" style={{ color: GOLD }}>{raceDays}</p>
            <p className="text-[10px] uppercase tracking-wide text-gray-400">dias</p>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-500 shrink-0" />
        </button>
      )}

      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-extrabold text-white">{greeting()}, {firstName} 👋</h1>
        <p className="text-gray-400 text-sm mt-0.5">Vamos fechar o dia com adesão total.</p>
      </div>

      {/* Próxima refeição (hero baseado na hora local) */}
      <NextMealHero meals={meals} onGoPlano={onGoPlano} />

      {/* Top cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          icon={<Utensils className="h-4 w-4" />}
          label="Refeições restantes"
          value={`${remaining}`}
          hint={totalMeals ? `de ${totalMeals} hoje` : 'sem plano'}
          onClick={onGoPlano}
        />
        <StatTile
          icon={<Clock className="h-4 w-4" />}
          label="Próxima refeição"
          value={nextMeal ? (nextMeal.time || '—') : '✓'}
          hint={nextMeal ? nextMeal.name : 'Tudo concluído!'}
          onClick={onGoPlano}
        />
      </div>

      {/* Hydration */}
      <div className="rounded-3xl bg-[#131417] border border-gray-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-gray-300">
            <Droplets className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-medium">Água do dia</span>
          </div>
          <span className="text-sm text-gray-400">
            <span className="text-white font-bold">{(waterMl / 1000).toFixed(1)}L</span> / {(waterGoalMl / 1000).toFixed(1)}L
          </span>
        </div>
        <ProgressBar value={waterMl} max={waterGoalMl} color="#3b82f6" />
        {!readOnly && (
          <div className="flex gap-2 mt-3">
            <button onClick={() => onAddWater(250)} className="flex-1 h-10 rounded-xl bg-blue-500/15 text-blue-300 text-sm font-medium flex items-center justify-center gap-1 active:scale-95 transition-transform">
              <Plus className="h-4 w-4" /> 1 copo
            </button>
            <button onClick={() => onAddWater(500)} className="flex-1 h-10 rounded-xl bg-blue-500/15 text-blue-300 text-sm font-medium flex items-center justify-center gap-1 active:scale-95 transition-transform">
              <Plus className="h-4 w-4" /> 500 ml
            </button>
            {waterMl > 0 && (
              <button onClick={() => onAddWater(-250)} className="w-10 h-10 rounded-xl bg-white/5 text-gray-400 flex items-center justify-center active:scale-95 transition-transform">−</button>
            )}
          </div>
        )}
      </div>

      {/* Adherence */}
      <div>
        <h2 className="text-sm font-bold text-white mb-2.5">Resumo da adesão</h2>
        <div className="rounded-3xl bg-[#131417] border border-gray-800 p-4 space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-gray-300">Refeições concluídas</span>
              <span className="text-white font-semibold">{doneCount}/{totalMeals}</span>
            </div>
            <ProgressBar value={doneCount} max={totalMeals} color={GOLD} />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-gray-300">Água</span>
              <span className="text-white font-semibold">{waterPct}%</span>
            </div>
            <ProgressBar value={waterMl} max={waterGoalMl} color="#3b82f6" />
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-gray-300 text-sm flex items-center gap-2"><Scale className="h-4 w-4 text-purple-400" /> Peso atual</span>
            <span className="text-white font-semibold">{latestWeight ? `${latestWeight.w} kg` : '—'}</span>
          </div>
        </div>
      </div>

      {/* Latest records */}
      <div>
        <h2 className="text-sm font-bold text-white mb-2.5">Últimos registros</h2>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={onGoEvolucao} className="text-left rounded-3xl bg-[#131417] border border-gray-800 p-4 active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-2 text-gray-400 mb-2"><Scale className="h-4 w-4 text-purple-400" /><span className="text-xs">Peso</span></div>
            <p className="text-xl font-extrabold text-white">{latestWeight ? `${latestWeight.w} kg` : '—'}</p>
            {weightDelta != null && (
              <p className={`text-xs mt-1 flex items-center gap-1 ${weightDelta <= 0 ? 'text-emerald-400' : 'text-orange-400'}`}>
                {weightDelta <= 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                {weightDelta > 0 ? '+' : ''}{weightDelta} kg
              </p>
            )}
          </button>
          <button onClick={onGoEvolucao} className="text-left rounded-3xl bg-[#131417] border border-gray-800 p-4 active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-2 text-gray-400 mb-2"><ClipboardCheck className="h-4 w-4 text-emerald-400" /><span className="text-xs">Check-in</span></div>
            <p className="text-base font-bold text-white leading-tight">
              {lastCheckin ? format(parseISO(lastCheckin.submitted_at), "dd/MM/yy", { locale: ptBR }) : '—'}
            </p>
            <p className="text-xs text-gray-500 mt-1">{checkins.length} registro{checkins.length === 1 ? '' : 's'}</p>
          </button>
        </div>
      </div>
    </div>
  );
}
