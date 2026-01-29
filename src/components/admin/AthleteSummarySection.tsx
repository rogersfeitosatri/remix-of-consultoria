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
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6" />
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Título */}
      <div className="flex items-center gap-2">
        <span className="text-lg">✅</span>
        <h2 className="text-lg font-semibold">Resumo do Atleta</h2>
      </div>
      
      {/* Grid de 4 Cartões */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Cartão 1: Plano & Vigência */}
        <AthleteSummaryPlanCard 
          client={client} 
          onRenewPlan={onRenewPlan}
        />
        
        {/* Cartão 2: Consultas */}
        <AthleteSummaryConsultCard 
          client={client}
          adminNotesShort={summaryData?.admin_notes_short || null}
          onSaveNotes={(notes) => handleSaveField('admin_notes_short', notes)}
          isSaving={updateSummary.isPending}
        />
        
        {/* Cartão 3: Check-ins & Formulários */}
        <AthleteSummaryCheckinsCard 
          client={client}
        />
        
        {/* Cartão 4: Objetivos & Evolução */}
        <AthleteSummaryGoalsCard 
          client={client}
          summaryData={summaryData || null}
          onSaveField={handleSaveField}
          isSaving={updateSummary.isPending}
        />
      </div>
      
      {/* Seção de Anexos */}
      <AthleteAttachmentsSection clientId={client.id} />
    </div>
  );
}
