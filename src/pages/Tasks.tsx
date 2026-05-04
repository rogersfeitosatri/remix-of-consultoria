import { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TaskBoard } from '@/components/tasks/TaskBoard';
import { DailyTaskView } from '@/components/tasks/DailyTaskView';
import { MonthlyTaskView } from '@/components/tasks/MonthlyTaskView';
import { GamificationPanel } from '@/components/tasks/GamificationPanel';
import { TaskNotificationsBell } from '@/components/tasks/TaskNotificationsBell';
import { CalendarDays, Calendar, LayoutGrid, Sun } from 'lucide-react';

const STORAGE_KEY = 'tasks_view_preference_v1';
type ViewKey = 'daily' | 'weekly' | 'monthly' | 'shift';

export default function Tasks() {
  const [view, setView] = useState<ViewKey>('daily');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ViewKey | null;
    if (saved && ['daily', 'weekly', 'monthly', 'shift'].includes(saved)) setView(saved);
  }, []);

  const handleChange = (v: string) => {
    setView(v as ViewKey);
    localStorage.setItem(STORAGE_KEY, v);
  };

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Tarefas</h1>
          <p className="mt-1 text-sm sm:text-base text-muted-foreground">
            Organize suas tarefas manualmente, configure recorrências e ganhe XP ao concluí-las.
          </p>
        </div>

        <GamificationPanel />

        <Tabs value={view} onValueChange={handleChange}>
          <TabsList className="w-full sm:w-auto grid grid-cols-4 sm:inline-flex">
            <TabsTrigger value="daily" className="gap-1.5">
              <Sun className="h-4 w-4" /> <span className="hidden sm:inline">Diária</span>
            </TabsTrigger>
            <TabsTrigger value="weekly" className="gap-1.5">
              <LayoutGrid className="h-4 w-4" /> <span className="hidden sm:inline">Semanal</span>
            </TabsTrigger>
            <TabsTrigger value="monthly" className="gap-1.5">
              <Calendar className="h-4 w-4" /> <span className="hidden sm:inline">Mensal</span>
            </TabsTrigger>
            <TabsTrigger value="shift" className="gap-1.5">
              <CalendarDays className="h-4 w-4" /> <span className="hidden sm:inline">Por turno</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="mt-4">
            <DailyTaskView />
          </TabsContent>
          <TabsContent value="weekly" className="mt-4">
            <TaskBoard />
          </TabsContent>
          <TabsContent value="monthly" className="mt-4">
            <MonthlyTaskView />
          </TabsContent>
          <TabsContent value="shift" className="mt-4">
            <DailyTaskView />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
