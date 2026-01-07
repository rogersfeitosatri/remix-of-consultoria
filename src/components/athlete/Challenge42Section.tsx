import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Target, Trophy } from 'lucide-react';
import { useAthleteChallengeActivities, useAthleteWeeklyMarks, useToggleWeeklyMark } from '@/hooks/useChallengeActivities';
import { toast } from 'sonner';

interface Challenge42SectionProps {
  clientId: string;
}

export function Challenge42Section({ clientId }: Challenge42SectionProps) {
  const { data: activities = [], isLoading: activitiesLoading } = useAthleteChallengeActivities();
  const { data: marks = [], isLoading: marksLoading } = useAthleteWeeklyMarks(clientId);
  const toggleMark = useToggleWeeklyMark();
  
  const [currentWeek] = useState(() => {
    // Calculate current week (1-6)
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
    return ((weekNumber - 1) % 6) + 1; // Cycle through 1-6
  });

  const isLoading = activitiesLoading || marksLoading;

  const handleToggle = async (activityId: string, weekNumber: number, currentlyCompleted: boolean) => {
    try {
      await toggleMark.mutateAsync({
        clientId,
        activityId,
        weekNumber,
        completed: !currentlyCompleted,
      });
      toast.success(!currentlyCompleted ? 'Atividade marcada!' : 'Atividade desmarcada');
    } catch (error) {
      toast.error('Erro ao atualizar');
    }
  };

  const isMarked = (activityId: string, weekNumber: number) => {
    return marks.some(m => m.activity_id === activityId && m.week_number === weekNumber && m.completed);
  };

  const totalCompleted = marks.filter(m => m.completed).length;
  const totalPossible = activities.length * 6;
  const progressPercentage = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;

  if (isLoading) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="py-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[hsl(43,74%,49%)] mx-auto"></div>
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="py-12 text-center">
          <Target className="h-12 w-12 mx-auto mb-4 text-gray-600" />
          <p className="text-gray-400">Desafio 42 em breve</p>
          <p className="text-xs text-gray-500 mt-2">As atividades serão configuradas pelo seu nutricionista</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress Card */}
      <Card className="bg-gradient-to-r from-[hsl(43,74%,49%)]/10 to-transparent border-[hsl(43,74%,49%)]/30">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="h-6 w-6 text-[hsl(43,74%,49%)]" />
              <div>
                <p className="text-white font-medium">Seu Progresso</p>
                <p className="text-sm text-gray-400">{totalCompleted} de {totalPossible} atividades completadas</p>
              </div>
            </div>
            <Badge className="bg-[hsl(43,74%,49%)] text-black font-bold text-lg px-4 py-2">
              {progressPercentage}%
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Activities Grid */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Target className="h-5 w-5 text-[hsl(43,74%,49%)]" />
            Atividades Semanais
          </CardTitle>
          <CardDescription className="text-gray-400">
            Marque as atividades que você completou em cada semana
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 px-2 text-sm text-gray-400">Atividade</th>
                  {[1, 2, 3, 4, 5, 6].map(week => (
                    <th key={week} className="text-center py-3 px-2 text-sm text-gray-400">
                      <span className={week === currentWeek ? 'text-[hsl(43,74%,49%)] font-bold' : ''}>
                        S{week}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activities.map((activity) => (
                  <tr key={activity.id} className="border-b border-gray-800/50">
                    <td className="py-3 px-2">
                      <p className="text-sm text-white font-medium">{activity.title}</p>
                      {activity.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{activity.description}</p>
                      )}
                    </td>
                    {[1, 2, 3, 4, 5, 6].map(week => {
                      const marked = isMarked(activity.id, week);
                      return (
                        <td key={week} className="text-center py-3 px-2">
                          <Checkbox
                            checked={marked}
                            onCheckedChange={() => handleToggle(activity.id, week, marked)}
                            className={`border-gray-600 data-[state=checked]:bg-[hsl(43,74%,49%)] data-[state=checked]:border-[hsl(43,74%,49%)] ${
                              week === currentWeek ? 'ring-1 ring-[hsl(43,74%,49%)]/50' : ''
                            }`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
