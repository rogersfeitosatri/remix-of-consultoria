import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Trophy, Flame, Star, TrendingUp } from 'lucide-react';
import { useTaskGamification, LEVEL_LABELS } from '@/hooks/useTaskGamification';

const LEVEL_THRESHOLDS = [0, 100, 500, 2000, 5000];

export function GamificationPanel() {
  const { data: g } = useTaskGamification();
  if (!g) return null;

  const levelInfo = LEVEL_LABELS[g.level] || LEVEL_LABELS[1];
  const currentBase = LEVEL_THRESHOLDS[g.level - 1] ?? 0;
  const nextThreshold = levelInfo.next;
  const progress =
    nextThreshold !== null
      ? Math.min(100, ((g.total_xp - currentBase) / (nextThreshold - currentBase)) * 100)
      : 100;

  return (
    <Card className="border-primary/30 bg-gradient-to-r from-primary/5 via-amber-500/5 to-transparent">
      <CardContent className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: levelInfo.color + '20' }}
            >
              <Trophy className="h-6 w-6" style={{ color: levelInfo.color }} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Nível</div>
              <div className="font-bold text-lg" style={{ color: levelInfo.color }}>
                {levelInfo.name}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Star className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-muted-foreground">XP total</div>
              <div className="font-bold text-lg">{g.total_xp}</div>
              {nextThreshold !== null && (
                <Progress value={progress} className="h-1.5 mt-1" />
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/10">
              <Flame className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Ofensiva</div>
              <div className="font-bold text-lg">
                {g.current_streak} <span className="text-xs font-normal">dia(s)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
              <TrendingUp className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Recorde</div>
              <div className="font-bold text-lg">{g.longest_streak}</div>
            </div>
          </div>
        </div>
        {nextThreshold !== null && (
          <div className="mt-3 text-xs text-muted-foreground text-center">
            Faltam <Badge variant="secondary">{nextThreshold - g.total_xp} XP</Badge> para o próximo
            nível
          </div>
        )}
      </CardContent>
    </Card>
  );
}
