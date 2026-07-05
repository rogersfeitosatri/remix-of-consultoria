import { Card, CardContent } from '@/components/ui/card';
import { Target, Dumbbell, Pill, Trophy, Lightbulb } from 'lucide-react';
import type { AthleteAnalysis } from '@/hooks/useAthleteAnalysis';

const GOLD = 'hsl(43,74%,49%)';

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <span style={{ color: GOLD }}>{icon}</span>
          <h3 className="font-bold text-white">{title}</h3>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: GOLD }} />
          <span className="text-sm text-gray-200 flex-1">{it}</span>
        </li>
      ))}
    </ul>
  );
}

export function AthleteStrategicView({ analysis }: { analysis: AthleteAnalysis | null | undefined }) {
  const so = analysis?.strategic_orientations;
  const summary = analysis?.athlete_summary;

  const hasContent = summary
    || (so?.meal_routine?.length)
    || (so?.training_strategy?.length)
    || (so?.supplementation?.length)
    || so?.race_context;

  if (!hasContent) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="py-12 text-center">
          <Target className="h-12 w-12 mx-auto mb-4 text-gray-600" />
          <p className="text-gray-300 font-medium">Suas orientações estratégicas aparecerão aqui.</p>
          <p className="text-gray-500 text-sm mt-1">Elas são geradas junto com o seu plano.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {summary && (
        <Card className="bg-gradient-to-br from-gray-900 to-black border-[hsl(43,74%,49%)]/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="h-4 w-4" style={{ color: GOLD }} />
              <h3 className="font-bold text-white">Resumo</h3>
            </div>
            <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{summary}</p>
          </CardContent>
        </Card>
      )}

      {so?.meal_routine && so.meal_routine.length > 0 && (
        <Section icon={<Target className="h-4 w-4" />} title="Rotina alimentar">
          <BulletList items={so.meal_routine} />
        </Section>
      )}

      {so?.training_strategy && so.training_strategy.length > 0 && (
        <Section icon={<Dumbbell className="h-4 w-4" />} title="Estratégia de treino">
          <BulletList items={so.training_strategy} />
        </Section>
      )}

      {so?.supplementation && so.supplementation.length > 0 && (
        <Section icon={<Pill className="h-4 w-4" />} title="Suplementação">
          <div className="grid sm:grid-cols-2 gap-2.5">
            {so.supplementation.map((s, i) => (
              <div key={i} className="rounded-xl border border-gray-800 bg-black/30 p-3">
                <p className="font-semibold text-white text-sm">{s.supplement}</p>
                <p className="text-xs text-gray-400 mt-1">{s.recommendation}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {so?.race_context && (
        <Section icon={<Trophy className="h-4 w-4" />} title="Contexto de prova">
          <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{so.race_context}</p>
        </Section>
      )}
    </div>
  );
}
