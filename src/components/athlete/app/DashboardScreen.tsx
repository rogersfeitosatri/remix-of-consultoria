import { useMemo, useState, useEffect } from 'react';
import { MessageCircle, BookOpen, ChevronRight, Flag, TrendingUp, TrendingDown, Clock, Shuffle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { PlanMeal } from '@/lib/athletePlan';
import { foodQuantityLine } from '@/lib/athletePlan';
import type { ActiveRace } from '@/hooks/useNutriPeriodiza';

const GOLD = 'hsl(43,74%,49%)';
const CARD = 'rounded-2xl bg-[#131417] border border-white/[0.06]';

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
  for (let i = 0; i < meals.length; i++) {
    const mm = timeToMinutes(meals[i].time);
    if (mm != null && mm >= nowMin) return i;
  }
  return meals.length - 1;
}

function NextMealHero({ meals, onGoPlano }: { meals: PlanMeal[]; onGoPlano: () => void }) {
  const initialIdx = useMemo(() => pickNextMealIndexByTime(meals), [meals]);
  const [idx, setIdx] = useState(initialIdx);

  useEffect(() => { setIdx(pickNextMealIndexByTime(meals)); }, [meals]);
  useEffect(() => {
    const t = setInterval(() => setIdx(pickNextMealIndexByTime(meals)), 60_000);
    return () => clearInterval(t);
  }, [meals]);

  if (meals.length === 0 || idx < 0) return null;
  const meal = meals[idx];

  return (
    <button
      type="button"
      onClick={onGoPlano}
      className="w-full text-left rounded-3xl bg-[#131417] border border-gray-800 p-5 active:scale-[0.99] transition-transform"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: GOLD }}>Próxima Refeição</span>
        <Clock className="h-3.5 w-3.5" style={{ color: GOLD }} />
      </div>
      <h3 className="text-xl font-extrabold text-white leading-tight mb-4">
        {meal.name}{meal.time ? ` – ${meal.time}` : ''}
      </h3>

      {meal.foods.length === 0 ? (
        <p className="text-sm text-gray-500">Sem itens cadastrados nessa refeição.</p>
      ) : (
        <div className="space-y-2.5">
          {meal.foods.slice(0, 4).map((g, i) => (
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
          {meal.foods.length > 4 && (
            <p className="text-xs text-gray-500">+{meal.foods.length - 4} itens</p>
          )}
        </div>
      )}
    </button>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function normalizeWhatsapp(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 10 ? digits : null;
}

export function DashboardScreen({
  firstName,
  meals,
  race,
  checkins,
  weightKg,
  supportWhatsapp,
  onOpenRace,
  onGoPlano,
  onGoEvolucao,
  onGoOrientacoes,
}: {
  firstName: string;
  meals: PlanMeal[];
  race?: ActiveRace | null;
  checkins: any[];
  weightKg?: number | null;
  supportWhatsapp?: string | null;
  onOpenRace: () => void;
  onGoPlano: () => void;
  onGoEvolucao: () => void;
  onGoOrientacoes: () => void;
}) {
  const weights = checkins
    .filter((c) => c?.responses?.peso)
    .map((c) => parseFloat(String(c.responses.peso).replace(',', '.')))
    .filter((w) => !isNaN(w));
  const displayWeight = weightKg ?? weights[0] ?? null;
  const weightDelta = weights[0] != null && weights[1] != null ? +(weights[0] - weights[1]).toFixed(1) : null;
  const lastCheckin = checkins[0];
  const raceDays = race?.race_date ? Math.max(0, Math.ceil((parseISO(race.race_date).getTime() - Date.now()) / 86400000)) : null;

  const waPhone = normalizeWhatsapp(supportWhatsapp);
  const waHref = waPhone
    ? `https://wa.me/${waPhone}?text=${encodeURIComponent(`Olá! Sou ${firstName} e preciso de suporte com meu plano alimentar.`)}`
    : null;

  return (
    <div className="space-y-6">
      {/* Race countdown */}
      {race && raceDays != null && (
        <button
          type="button"
          onClick={onOpenRace}
          className="w-full flex items-center gap-3 rounded-2xl p-4 text-left active:scale-[0.99] transition-transform border border-[hsl(43,74%,49%)]/25"
          style={{ background: 'linear-gradient(135deg, rgba(191,150,54,0.16), rgba(0,0,0,0.15))' }}
        >
          <Flag className="h-5 w-5 shrink-0" style={{ color: GOLD }} />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-gray-400">Próxima prova</p>
            <p className="font-semibold text-white truncate">{race.race_name || 'Prova'}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-extrabold leading-none" style={{ color: GOLD }}>{raceDays}</p>
            <p className="text-[10px] uppercase tracking-wide text-gray-500">dias</p>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-600 shrink-0" />
        </button>
      )}

      {/* Greeting */}
      <div className="px-1">
        <h1 className="text-[26px] font-extrabold text-white leading-tight">{greeting()}, {firstName}</h1>
        <p className="text-gray-500 mt-1">Seu resumo de hoje</p>
      </div>

      {/* Próxima refeição — apenas uma, baseada no horário */}
      <NextMealHero meals={meals} onGoPlano={onGoPlano} />

      {/* Ações rápidas: Suporte + Orientações */}
      <div className="grid grid-cols-2 gap-3">
        {waHref ? (
          <a
            href={waHref}
            target="_blank"
            rel="noreferrer"
            className={`${CARD} p-4 text-left active:scale-[0.98] transition-transform block`}
          >
            <div className="flex items-center gap-2 text-emerald-400 mb-3">
              <MessageCircle className="h-4 w-4" />
              <span className="text-sm">Suporte</span>
            </div>
            <p className="text-base font-extrabold text-white leading-tight">Fale no WhatsApp</p>
            <p className="text-xs text-gray-500 mt-1">Dúvidas do plano alimentar</p>
          </a>
        ) : (
          <div className={`${CARD} p-4 opacity-60`}>
            <div className="flex items-center gap-2 text-emerald-400 mb-3">
              <MessageCircle className="h-4 w-4" />
              <span className="text-sm">Suporte</span>
            </div>
            <p className="text-base font-extrabold text-white leading-tight">Em breve</p>
            <p className="text-xs text-gray-500 mt-1">Seu nutricionista ainda não configurou o contato</p>
          </div>
        )}

        <button
          type="button"
          onClick={onGoOrientacoes}
          className={`${CARD} p-4 text-left active:scale-[0.98] transition-transform`}
        >
          <div className="flex items-center gap-2 mb-3" style={{ color: GOLD }}>
            <BookOpen className="h-4 w-4" />
            <span className="text-sm">Orientações</span>
          </div>
          <p className="text-base font-extrabold text-white leading-tight">Ver suas orientações</p>
          <p className="text-xs text-gray-500 mt-1">Estratégia, treinos, suplementos</p>
        </button>
      </div>

      {/* Records */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 px-1 mb-2.5">Últimos registros</h2>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={onGoEvolucao} className={`${CARD} p-4 text-left active:scale-[0.98] transition-transform`}>
            <p className="text-sm text-gray-400 mb-2">Peso</p>
            <p className="text-2xl font-extrabold text-white leading-none">{displayWeight != null ? `${displayWeight}` : '—'}<span className="text-base text-gray-500"> kg</span></p>
            {weightDelta != null && (
              <p className={`text-xs mt-2 flex items-center gap-1 ${weightDelta <= 0 ? 'text-emerald-400' : 'text-orange-400'}`}>
                {weightDelta <= 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                {weightDelta > 0 ? '+' : ''}{weightDelta} kg
              </p>
            )}
          </button>
          <button onClick={onGoEvolucao} className={`${CARD} p-4 text-left active:scale-[0.98] transition-transform`}>
            <p className="text-sm text-gray-400 mb-2">Check-in</p>
            <p className="text-xl font-bold text-white leading-tight">
              {lastCheckin ? format(parseISO(lastCheckin.submitted_at), "dd/MM/yy", { locale: ptBR }) : '—'}
            </p>
            <p className="text-xs text-gray-500 mt-2">{checkins.length} registro{checkins.length === 1 ? '' : 's'}</p>
          </button>
        </div>
      </div>
    </div>
  );
}
