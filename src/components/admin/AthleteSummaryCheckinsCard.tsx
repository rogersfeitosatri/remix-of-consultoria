import { differenceInDays, parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ClipboardCheck, FileText, AlertCircle, CheckCircle2, History, FilePlus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { useCheckinStats, useAnamneseData } from '@/hooks/useAthleteSummary';
import { Client } from '@/hooks/useClients';

const CHECKIN_DAYS_THRESHOLD = 7; // Dias para considerar "em dia"

interface AthleteSummaryCheckinsCardProps {
  client: Client;
}

export function AthleteSummaryCheckinsCard({ client }: AthleteSummaryCheckinsCardProps) {
  const navigate = useNavigate();
  const { data: checkinStats, isLoading: loadingCheckins } = useCheckinStats(client.id);
  const { data: anamneseData, isLoading: loadingAnamnese } = useAnamneseData(client.id);
  
  const isLoading = loadingCheckins || loadingAnamnese;
  
  // Calcular status do check-in
  const daysSinceLastCheckin = checkinStats?.lastCheckinAt
    ? differenceInDays(new Date(), parseISO(checkinStats.lastCheckinAt))
    : null;
    
  const isCheckinUpToDate = daysSinceLastCheckin !== null && daysSinceLastCheckin <= CHECKIN_DAYS_THRESHOLD;
  
  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            Check-ins & Formulários
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            Check-ins & Formulários
          </CardTitle>
          {client.has_checkin && (
            <Badge 
              variant={isCheckinUpToDate ? 'default' : 'destructive'}
              className={isCheckinUpToDate ? 'bg-green-500/10 text-green-500 border-green-500/20' : ''}
            >
              {isCheckinUpToDate ? 'Em dia' : 'Atrasado'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Estatísticas de Check-in */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">Total de Check-ins</p>
            <p className="text-lg font-bold text-primary">{checkinStats?.total || 0}</p>
          </div>
          
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">Último Mês</p>
            <p className="text-lg font-bold">{checkinStats?.lastMonth || 0}</p>
          </div>
        </div>
        
        {/* Último check-in */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div>
            <p className="text-xs text-muted-foreground">Último check-in</p>
            <p className="text-sm font-medium">
              {checkinStats?.lastCheckinAt 
                ? format(parseISO(checkinStats.lastCheckinAt), "dd/MM/yyyy", { locale: ptBR })
                : 'Nenhum'}
            </p>
          </div>
          {daysSinceLastCheckin !== null && (
            <Badge variant="outline" className="text-xs">
              há {daysSinceLastCheckin} dias
            </Badge>
          )}
        </div>
        
        {/* Anamnese */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Anamnese</p>
              {anamneseData?.submittedAt && (
                <p className="text-xs text-muted-foreground">
                  {format(parseISO(anamneseData.submittedAt), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              )}
            </div>
          </div>
          <Badge 
            variant={anamneseData?.hasAnamnese ? 'default' : 'secondary'}
            className={anamneseData?.hasAnamnese ? 'bg-green-500/10 text-green-500 border-green-500/20' : ''}
          >
            {anamneseData?.hasAnamnese ? (
              <>
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Sim
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3 mr-1" />
                Não
              </>
            )}
          </Badge>
        </div>
        
        {/* Ações */}
        <div className="flex gap-2 pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 gap-1"
            onClick={() => navigate(`/clients/${client.id}/history`)}
          >
            <History className="h-3 w-3" />
            Histórico
          </Button>
          {!anamneseData?.hasAnamnese && (
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 gap-1"
              onClick={() => navigate('/forms')}
            >
              <FilePlus className="h-3 w-3" />
              Anamnese
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
