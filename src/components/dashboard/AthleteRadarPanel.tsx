import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useAthleteRadar } from '@/hooks/useAthleteRadar';
import { DashboardSection, RowButton } from './DashboardSection';

export function AthleteRadarPanel() {
  const { problems, isLoading } = useAthleteRadar();
  const navigate = useNavigate();

  // Sem sinal relevante → o Radar simplesmente não ocupa espaço.
  if (isLoading || problems.length === 0) return null;

  return (
    <DashboardSection title="Radar" count={problems.length}>
      {problems.map((r) => (
        <RowButton
          key={r.id}
          onClick={() => navigate(r.pendingResponseId ? `/checkin-review/${r.pendingResponseId}` : `/clients/${r.id}`)}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium leading-tight">{r.name}</p>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {r.issues.map((i) => i.label).join(' · ')}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground" />
        </RowButton>
      ))}
    </DashboardSection>
  );
}
