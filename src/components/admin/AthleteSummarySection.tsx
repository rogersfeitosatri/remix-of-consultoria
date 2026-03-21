import { Skeleton } from '@/components/ui/skeleton';
import { Client } from '@/hooks/useClients';
import { 
  useAthleteSummaryData, 
  useUpdateAthleteSummary,
  AthleteSummaryData 
} from '@/hooks/useAthleteSummary';
import { AthleteSummaryPlanCard } from './AthleteSummaryPlanCard';
import { AthleteSummaryConsultCard } from './AthleteSummaryConsultCard';
import { AthleteSummaryCheckinsCard } from './AthleteSummaryCheckinsCard';
import { AthleteSummaryGoalsCard } from './AthleteSummaryGoalsCard';
import { AthleteAttachmentsSection } from './AthleteAttachmentsSection';
import { Badge } from '@/components/ui/badge';

interface AthleteSummarySectionProps {
  client: Client;
  onEditClient?: () => void;
  onRenewPlan?: () => void;
}

export function AthleteSummarySection({ client, onEditClient, onRenewPlan }: AthleteSummarySectionProps) {
  const { data: summaryData, isLoading } = useAthleteSummaryData(client.id);
  const updateSummary = useUpdateAthleteSummary();
  
  const handleSaveField = (field: keyof AthleteSummaryData, value: string | null) => {
    updateSummary.mutate({
      clientId: client.id,
      field,
      value,
      oldValue: summaryData?.[field] || null,
    });
  };
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }
  
  // Determine athlete status badge
  const statusConfig = {
    pending_anamnese: { label: 'Aguardando Anamnese', variant: 'secondary' as const },
    active: { label: 'Ativo', variant: 'default' as const },
    paused: { label: 'Pausado', variant: 'secondary' as const },
    completed: { label: 'Concluído', variant: 'outline' as const },
  };
  const athleteStatus = client.athlete_status ? statusConfig[client.athlete_status] : null;
  
  return (
    <div className="space-y-4">
      {/* Título com status */}
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">Resumo do Atleta</h2>
        {athleteStatus && (
          <Badge variant={athleteStatus.variant}>{athleteStatus.label}</Badge>
        )}
        {!client.is_active && (
          <Badge variant="destructive">Inativo</Badge>
        )}
      </div>
      
      {/* Grid de 4 Cartões */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <AthleteSummaryPlanCard 
          client={client} 
          onRenewPlan={onRenewPlan}
        />
        
        <AthleteSummaryConsultCard 
          client={client}
          adminNotesShort={summaryData?.admin_notes_short || null}
          onSaveNotes={(notes) => handleSaveField('admin_notes_short', notes)}
          isSaving={updateSummary.isPending}
        />
        
        <AthleteSummaryCheckinsCard client={client} />
        
        <AthleteSummaryGoalsCard 
          client={client}
          summaryData={summaryData || null}
          onSaveField={handleSaveField}
          isSaving={updateSummary.isPending}
        />
      </div>
      
      {/* Anexos */}
      <AthleteAttachmentsSection clientId={client.id} />
    </div>
  );
}
