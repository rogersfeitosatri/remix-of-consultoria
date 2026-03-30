import { useWeeklyReport } from '@/hooks/useWeeklyReport';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart3, CheckCircle, Clock, MessageSquare, Video, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function WeeklyReportPanel() {
  const { data: report, isLoading } = useWeeklyReport();

  if (isLoading) return <Skeleton className="h-24 w-full rounded-xl" />;
  if (!report) return null;

  const stats = [
    { icon: <CheckCircle className="h-4 w-4 text-success" />, label: 'Concluídas', value: report.tasksCompleted },
    { icon: <Clock className="h-4 w-4 text-warning" />, label: 'Pendentes', value: report.tasksPending },
    { icon: <MessageSquare className="h-4 w-4 text-primary" />, label: 'Check-ins', value: report.checkinsProcessed },
    { icon: <Video className="h-4 w-4 text-purple-500" />, label: 'Consultas', value: report.consultationsHeld },
    { icon: <Users className="h-4 w-4 text-muted-foreground" />, label: 'Atletas', value: report.totalAthletes },
  ];

  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Resumo Semanal</h3>
          <span className="text-xs text-muted-foreground ml-auto">{report.weekLabel}</span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {stats.map((s, i) => (
            <div key={i} className="text-center">
              <div className="flex justify-center mb-1">{s.icon}</div>
              <p className="text-lg font-bold text-foreground">{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
