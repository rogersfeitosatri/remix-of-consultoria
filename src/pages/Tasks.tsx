import { Layout } from '@/components/layout/Layout';
import { TaskBoard } from '@/components/tasks/TaskBoard';

export default function Tasks() {
  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Tarefas</h1>
          <p className="mt-1 text-sm sm:text-base text-muted-foreground">
            Organize suas tarefas por dia da semana
          </p>
        </div>

        <TaskBoard />
      </div>
    </Layout>
  );
}
