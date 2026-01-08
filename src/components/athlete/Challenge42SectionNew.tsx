import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Target, Loader2, Trophy, Lock, CheckCircle2, Play } from 'lucide-react';
import { toast } from 'sonner';
import {
  useAthleteActivities,
  useAthleteProgress,
  useAthleteDailyMarks,
  useStartChallenge,
  useToggleDailyMark,
  useCompleteWeek,
} from '@/hooks/useChallenge42';

interface Challenge42SectionNewProps {
  clientId: string;
  isPreview?: boolean;
}

const DAYS_OF_WEEK = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
];

export function Challenge42SectionNew({ clientId, isPreview = false }: Challenge42SectionNewProps) {
  const { data: activities = [], isLoading: activitiesLoading } = useAthleteActivities();
  const { data: progress, isLoading: progressLoading } = useAthleteProgress(clientId);
  const { data: dailyMarks = [], isLoading: marksLoading } = useAthleteDailyMarks(clientId);
  const startChallenge = useStartChallenge();
  const toggleDailyMark = useToggleDailyMark();
  const completeWeek = useCompleteWeek();
  
  const [showCongrats, setShowCongrats] = useState(false);

  const isLoading = activitiesLoading || progressLoading || marksLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {isPreview 
              ? 'Nenhuma atividade configurada. Configure as atividades em Conteúdo do Atleta.'
              : 'O Desafio 42 ainda não foi configurado. Aguarde seu nutricionista.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  // If no progress, show start button
  if (!progress) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Desafio 42 Dias
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <Trophy className="h-16 w-16 mx-auto text-primary mb-4" />
          <h3 className="text-xl font-bold mb-2">Pronto para o Desafio?</h3>
          <p className="text-muted-foreground mb-6">
            São 6 semanas de atividades comportamentais para transformar seus hábitos.
            Complete cada semana para desbloquear a próxima!
          </p>
          <Button 
            size="lg" 
            onClick={() => startChallenge.mutate(clientId)}
            disabled={startChallenge.isPending || isPreview}
            className="gap-2"
          >
            {startChallenge.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Iniciar Desafio
          </Button>
        </CardContent>
      </Card>
    );
  }

  const completedWeeks = progress.completed_weeks || [];
  const currentWeek = progress.current_week;

  // Check if day is marked
  const isDayMarked = (weekNumber: number, dayOfWeek: number) => {
    return dailyMarks.some(
      m => m.week_number === weekNumber && m.day_of_week === dayOfWeek && m.completed
    );
  };

  // Count completed days for a week
  const getCompletedDaysCount = (weekNumber: number) => {
    return dailyMarks.filter(m => m.week_number === weekNumber && m.completed).length;
  };

  // Get week status
  const getWeekStatus = (weekIndex: number): 'completed' | 'current' | 'locked' => {
    const weekNumber = weekIndex + 1;
    if (completedWeeks.includes(weekNumber)) return 'completed';
    if (weekNumber === currentWeek) return 'current';
    return 'locked';
  };

  // Handle day toggle
  const handleDayToggle = async (weekNumber: number, dayOfWeek: number) => {
    if (isPreview) return;
    const isMarked = isDayMarked(weekNumber, dayOfWeek);
    try {
      await toggleDailyMark.mutateAsync({
        clientId,
        weekNumber,
        dayOfWeek,
        completed: !isMarked,
      });
    } catch (error) {
      toast.error('Erro ao atualizar');
    }
  };

  // Handle complete week
  const handleCompleteWeek = async (weekNumber: number) => {
    if (isPreview) return;
    try {
      await completeWeek.mutateAsync({ clientId, weekNumber });
      setShowCongrats(true);
      toast.success('🎉 Parabéns! Semana concluída!');
      setTimeout(() => setShowCongrats(false), 3000);
    } catch (error) {
      toast.error('Erro ao finalizar semana');
    }
  };

  // Calculate overall progress
  const totalWeeks = Math.min(activities.length, 6);
  const progressPercent = (completedWeeks.length / totalWeeks) * 100;

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Desafio 42 Dias
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progresso Geral</span>
              <span className="font-medium">{completedWeeks.length} de {totalWeeks} semanas</span>
            </div>
            <Progress value={progressPercent} className="h-3" />
            
            {showCongrats && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center animate-pulse">
                <Trophy className="h-8 w-8 mx-auto text-primary mb-2" />
                <p className="font-bold text-primary">Parabéns! Continue assim!</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Weekly Accordion */}
      <Accordion 
        type="single" 
        collapsible 
        defaultValue={`week-${currentWeek}`}
        className="space-y-3"
      >
        {activities.slice(0, 6).map((activity, index) => {
          const weekNumber = index + 1;
          const status = getWeekStatus(index);
          const completedDays = getCompletedDaysCount(weekNumber);
          const requiredDays = activity.required_days || 7;
          const canComplete = completedDays >= requiredDays && status === 'current';

          return (
            <AccordionItem
              key={activity.id}
              value={`week-${weekNumber}`}
              className={`border rounded-lg overflow-hidden ${
                status === 'completed' 
                  ? 'border-green-500/30 bg-green-500/5' 
                  : status === 'current'
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-muted bg-muted/30 opacity-60'
              }`}
              disabled={status === 'locked'}
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-3 w-full">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    status === 'completed' 
                      ? 'bg-green-500 text-white' 
                      : status === 'current'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {status === 'completed' ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : status === 'locked' ? (
                      <Lock className="h-4 w-4" />
                    ) : (
                      <span className="font-bold">{weekNumber}</span>
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{activity.title}</span>
                      {status === 'completed' && (
                        <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                          Concluída
                        </Badge>
                      )}
                      {status === 'current' && (
                        <Badge className="bg-primary/10 text-primary border-primary/20">
                          Em andamento
                        </Badge>
                      )}
                      {status === 'locked' && (
                        <Badge variant="outline" className="text-muted-foreground">
                          Bloqueada
                        </Badge>
                      )}
                    </div>
                    {status !== 'locked' && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {completedDays}/{requiredDays} dias completados
                      </p>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                {status === 'locked' ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Complete a semana {weekNumber - 1} para desbloquear esta atividade.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {activity.description && (
                      <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                        {activity.description}
                      </p>
                    )}
                    
                    {/* Daily checkboxes */}
                    <div className="grid grid-cols-7 gap-2">
                      {DAYS_OF_WEEK.map(day => {
                        const isMarked = isDayMarked(weekNumber, day.value);
                        const isDisabled = status === 'completed' || isPreview;
                        
                        return (
                          <div 
                            key={day.value}
                            className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors ${
                              isMarked 
                                ? 'bg-primary/10 border-primary/30' 
                                : 'bg-muted/30 border-muted'
                            } ${isDisabled ? 'opacity-60' : 'cursor-pointer hover:border-primary/50'}`}
                            onClick={() => !isDisabled && handleDayToggle(weekNumber, day.value)}
                          >
                            <span className="text-xs font-medium text-muted-foreground">
                              {day.label}
                            </span>
                            <Checkbox
                              checked={isMarked}
                              disabled={isDisabled}
                              onCheckedChange={() => !isDisabled && handleDayToggle(weekNumber, day.value)}
                              className="h-5 w-5"
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* Progress bar for current week */}
                    {status === 'current' && (
                      <div className="space-y-2">
                        <Progress value={(completedDays / requiredDays) * 100} className="h-2" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{completedDays} de {requiredDays} dias</span>
                          <span>{Math.round((completedDays / requiredDays) * 100)}%</span>
                        </div>
                      </div>
                    )}

                    {/* Complete week button */}
                    {status === 'current' && (
                      <Button
                        onClick={() => handleCompleteWeek(weekNumber)}
                        disabled={!canComplete || completeWeek.isPending}
                        className="w-full gap-2"
                      >
                        {completeWeek.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        {canComplete ? 'Finalizar Semana' : `Complete ${requiredDays - completedDays} dia(s) restante(s)`}
                      </Button>
                    )}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {/* Final completion message */}
      {completedWeeks.length === totalWeeks && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="py-8 text-center">
            <Trophy className="h-16 w-16 mx-auto text-primary mb-4" />
            <h3 className="text-2xl font-bold text-primary mb-2">🎉 Parabéns!</h3>
            <p className="text-muted-foreground">
              Você completou o Desafio 42 Dias! Seus novos hábitos estão formados.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
