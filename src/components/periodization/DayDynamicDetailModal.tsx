import { X, Sun, Sunset, Moon, Dumbbell, Clock, Zap, ArrowRight, Info, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

const CHO_STYLES: Record<string, { bg: string; text: string; border: string; icon: string; label: string }> = {
  'High': { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: '🔋', label: 'Alto CHO' },
  'Medium': { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', icon: '⚡', label: 'Moderado' },
  'Low': { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30', icon: '🧊', label: 'Baixo CHO' },
  'Recovery': { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30', icon: '💤', label: 'Recuperação' },
};

interface DayDynamic {
  day_of_week: number;
  cho_classification: string;
  cho_gkg?: number | null;
  morning_cho_pct?: number | null;
  afternoon_cho_pct?: number | null;
  night_cho_pct?: number | null;
  distribution_rationale?: string;
  pre_training?: string;
  intra_training?: string;
  post_training?: string;
  night_guidance?: string;
  notes?: string;
}

interface Props {
  day: DayDynamic;
  prevDay: DayDynamic | null;
  nextDay: DayDynamic | null;
  session: any;
  prevSession: any | null;
  nextSession: any | null;
  phaseName: string;
  athleteWeight?: number | null;
  onClose: () => void;
}

export function DayDynamicDetailModal({
  day, prevDay, nextDay, session, prevSession, nextSession, phaseName, athleteWeight, onClose,
}: Props) {
  const choStyle = CHO_STYLES[day.cho_classification] || CHO_STYLES['Medium'];
  const totalGrams = day.cho_gkg && athleteWeight ? Math.round(day.cho_gkg * athleteWeight) : null;
  const isOff = !session?.modality || session.modality === 'Day Off';

  const morningG = totalGrams && day.morning_cho_pct ? Math.round(totalGrams * day.morning_cho_pct / 100) : null;
  const afternoonG = totalGrams && day.afternoon_cho_pct ? Math.round(totalGrams * day.afternoon_cho_pct / 100) : null;
  const nightG = totalGrams && day.night_cho_pct ? Math.round(totalGrams * day.night_cho_pct / 100) : null;

  const renderSessionPill = (s: any, label: string) => {
    if (!s) return <span className="text-[10px] text-muted-foreground italic">Sem dados</span>;
    const off = !s.modality || s.modality === 'Day Off';
    return (
      <div className={`px-3 py-2 rounded-lg border text-center ${off ? 'bg-muted/30 border-border' : 'bg-primary/5 border-primary/20'}`}>
        <p className="text-[9px] text-muted-foreground uppercase font-semibold mb-0.5">{label}</p>
        {off ? (
          <p className="text-xs text-muted-foreground">🛌 Day Off</p>
        ) : (
          <>
            <p className="text-xs font-bold text-foreground">{s.modality}</p>
            <p className="text-[10px] text-muted-foreground">{s.shift} · {s.intensity} · {s.duration_minutes || 60}min</p>
          </>
        )}
      </div>
    );
  };

  const renderNeighborCho = (d: DayDynamic | null, label: string) => {
    if (!d) return null;
    const st = CHO_STYLES[d.cho_classification] || CHO_STYLES['Medium'];
    return (
      <div className={`px-3 py-2 rounded-lg border ${st.border} ${st.bg} text-center`}>
        <p className="text-[9px] text-muted-foreground uppercase font-semibold mb-0.5">{label}</p>
        <p className={`text-sm font-bold ${st.text}`}>{st.icon} {d.cho_gkg || '?'}g/kg</p>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-background/95 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div
        className="w-full max-w-2xl mx-4 my-6 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-5 py-4 ${choStyle.bg} border-b border-border flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{choStyle.icon}</span>
            <div>
              <h2 className="text-lg font-bold text-foreground">{DAYS[day.day_of_week]}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className={`text-xs ${choStyle.text} ${choStyle.border}`}>{choStyle.label}</Badge>
                <span className="text-xs text-muted-foreground">{phaseName}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {day.cho_gkg && (
              <div className="text-right">
                <p className={`text-2xl font-black ${choStyle.text}`}>{day.cho_gkg}<span className="text-sm font-normal opacity-70">g/kg</span></p>
                {totalGrams && <p className="text-xs text-muted-foreground">{totalGrams}g total</p>}
              </div>
            )}
            <button onClick={onClose} className="p-2 rounded-full hover:bg-muted/50 transition-colors">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Context: Previous → Current → Next training */}
          <div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Dumbbell className="h-3.5 w-3.5" /> Contexto de Treino
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {renderSessionPill(prevSession, `${prevDay ? DAYS[prevDay.day_of_week].substring(0, 3) : 'Ant.'} (anterior)`)}
              <div className={`px-3 py-2 rounded-lg border-2 text-center ${isOff ? 'bg-muted/30 border-muted-foreground/20' : 'bg-primary/10 border-primary/40'}`}>
                <p className="text-[9px] text-primary uppercase font-bold mb-0.5">Hoje</p>
                {isOff ? (
                  <p className="text-xs text-muted-foreground font-bold">🛌 Day Off</p>
                ) : (
                  <>
                    <p className="text-sm font-bold text-foreground">{session.modality}</p>
                    <p className="text-[10px] text-muted-foreground">{session.shift} · {session.intensity}</p>
                    <p className="text-[10px] text-muted-foreground">{session.duration_minutes || 60}min · Prio {session.priority}</p>
                  </>
                )}
              </div>
              {renderSessionPill(nextSession, `${nextDay ? DAYS[nextDay.day_of_week].substring(0, 3) : 'Próx.'} (próximo)`)}
            </div>
          </div>

          {/* CHO progression context */}
          <div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" /> Fluxo de CHO na Semana
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {renderNeighborCho(prevDay, DAYS[prevDay?.day_of_week ?? 0]?.substring(0, 3) || 'Ant.')}
              <div className={`px-3 py-2 rounded-lg border-2 ${choStyle.border} ${choStyle.bg} text-center`}>
                <p className="text-[9px] text-primary uppercase font-bold mb-0.5">Hoje</p>
                <p className={`text-lg font-black ${choStyle.text}`}>{day.cho_gkg || '?'}g/kg</p>
              </div>
              {renderNeighborCho(nextDay, DAYS[nextDay?.day_of_week ?? 0]?.substring(0, 3) || 'Próx.')}
            </div>
          </div>

          {/* Distribution bar */}
          <div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
              Distribuição Intra-Dia
            </h3>
            <div className="flex h-6 w-full rounded-full overflow-hidden border border-border">
              <div className="bg-amber-400/80 flex items-center justify-center" style={{ width: `${day.morning_cho_pct || 33}%` }}>
                <span className="text-[9px] font-bold text-amber-950">{day.morning_cho_pct || 33}%</span>
              </div>
              <div className="bg-orange-400/80 flex items-center justify-center" style={{ width: `${day.afternoon_cho_pct || 34}%` }}>
                <span className="text-[9px] font-bold text-orange-950">{day.afternoon_cho_pct || 34}%</span>
              </div>
              <div className="bg-indigo-400/80 flex items-center justify-center" style={{ width: `${day.night_cho_pct || 33}%` }}>
                <span className="text-[9px] font-bold text-indigo-950">{day.night_cho_pct || 33}%</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="text-center p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <Sun className="h-4 w-4 text-amber-400 mx-auto mb-0.5" />
                <p className="text-xs font-bold">{day.morning_cho_pct || 33}%</p>
                {morningG && <p className="text-[10px] text-muted-foreground">{morningG}g</p>}
                <p className="text-[9px] text-muted-foreground mt-0.5">Café + Lanche</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-orange-500/5 border border-orange-500/20">
                <Sunset className="h-4 w-4 text-orange-400 mx-auto mb-0.5" />
                <p className="text-xs font-bold">{day.afternoon_cho_pct || 34}%</p>
                {afternoonG && <p className="text-[10px] text-muted-foreground">{afternoonG}g</p>}
                <p className="text-[9px] text-muted-foreground mt-0.5">Almoço + Lanche</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-indigo-500/5 border border-indigo-500/20">
                <Moon className="h-4 w-4 text-indigo-400 mx-auto mb-0.5" />
                <p className="text-xs font-bold">{day.night_cho_pct || 33}%</p>
                {nightG && <p className="text-[10px] text-muted-foreground">{nightG}g</p>}
                <p className="text-[9px] text-muted-foreground mt-0.5">Jantar + Ceia</p>
              </div>
            </div>
          </div>

          {/* Rationale */}
          {day.distribution_rationale && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-semibold text-primary uppercase mb-0.5">Racional da Distribuição</p>
                <p className="text-sm text-foreground leading-relaxed">{day.distribution_rationale}</p>
              </div>
            </div>
          )}

          {/* Nutrient Timing */}
          <div className="grid grid-cols-2 gap-3">
            {day.pre_training && (
              <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[9px] font-black text-amber-500 bg-amber-500/15 rounded px-2 py-0.5">PRÉ</span>
                  <Clock className="h-3 w-3 text-amber-400" />
                </div>
                <p className="text-sm font-semibold text-foreground">{day.pre_training}</p>
              </div>
            )}
            {day.intra_training && (
              <div className="p-3 rounded-xl border border-orange-500/20 bg-orange-500/5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[9px] font-black text-orange-500 bg-orange-500/15 rounded px-2 py-0.5">INTRA</span>
                  <Zap className="h-3 w-3 text-orange-400" />
                </div>
                <p className="text-sm font-semibold text-foreground">{day.intra_training}</p>
              </div>
            )}
            {day.post_training && (
              <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[9px] font-black text-emerald-500 bg-emerald-500/15 rounded px-2 py-0.5">PÓS</span>
                  <ArrowRight className="h-3 w-3 text-emerald-400" />
                </div>
                <p className="text-sm font-semibold text-foreground">{day.post_training}</p>
              </div>
            )}
            {day.night_guidance && (
              <div className="p-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[9px] font-black text-indigo-400 bg-indigo-500/15 rounded px-2 py-0.5">NOITE</span>
                  <Moon className="h-3 w-3 text-indigo-400" />
                </div>
                <p className="text-sm font-semibold text-foreground">{day.night_guidance}</p>
              </div>
            )}
          </div>

          {/* Notes */}
          {day.notes && (
            <div className="p-3 rounded-lg border-l-4 border-primary/30 bg-muted/30">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Notas</p>
              <p className="text-sm text-foreground leading-relaxed">{day.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
