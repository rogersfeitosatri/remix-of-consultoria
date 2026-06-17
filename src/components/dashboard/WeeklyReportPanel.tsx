import { useState } from 'react';
import { useWeeklyReport } from '@/hooks/useWeeklyReport';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { BarChart3, CheckCircle, Clock, MessageSquare, Video, Users, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function WeeklyReportPanel() {
  const { data: report, isLoading } = useWeeklyReport();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  if (isLoading) return <Skeleton className="h-24 w-full rounded-xl" />;
  if (!report) return null;

  const total = report.tasksCompleted + report.checkinsProcessed + report.consultationsHeld;

  const stats = [
    { icon: <CheckCircle className="h-4 w-4 text-success" />, label: 'Concluídas', value: report.tasksCompleted, go: () => navigate('/tasks') },
    { icon: <Clock className="h-4 w-4 text-warning" />, label: 'Pendentes', value: report.tasksPending, go: () => navigate('/tasks') },
    { icon: <MessageSquare className="h-4 w-4 text-primary" />, label: 'Check-ins', value: report.checkinsProcessed, go: () => navigate('/checkins') },
    { icon: <Video className="h-4 w-4 text-purple-500" />, label: 'Consultas', value: report.consultationsHeld, go: () => navigate('/calendar') },
    { icon: <Users className="h-4 w-4 text-muted-foreground" />, label: 'Atletas', value: report.totalAthletes, go: () => navigate('/clients') },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left transition-transform hover:scale-[1.01]"
      >
        <Card className="border-border/50 hover:border-primary/40 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Resumo Semanal</h3>
              <span className="text-xs text-muted-foreground ml-auto">{report.weekLabel}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">{total}</span>
              <span className="text-xs text-muted-foreground">ações na semana</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {report.tasksCompleted} tarefas · {report.checkinsProcessed} check-ins · {report.consultationsHeld} consultas
            </p>
          </CardContent>
        </Card>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" /> Resumo Semanal
            </DialogTitle>
            <DialogDescription>{report.weekLabel}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {stats.map((s, i) => (
              <button
                key={i}
                onClick={() => { setOpen(false); s.go(); }}
                className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-3 hover:border-primary/40 hover:bg-muted/40 transition"
              >
                <div className="shrink-0">{s.icon}</div>
                <div className="text-left">
                  <p className="text-xl font-bold leading-none">{s.value}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{s.label}</p>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
