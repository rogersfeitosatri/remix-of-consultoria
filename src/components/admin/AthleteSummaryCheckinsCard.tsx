import { differenceInDays, parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ClipboardCheck, FileText, AlertCircle, CheckCircle2, History, FilePlus, Send, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { useCheckinStats, useAnamneseData } from '@/hooks/useAthleteSummary';
import { Client } from '@/hooks/useClients';

// Map frequency to expected days between check-ins
const FREQUENCY_DAYS: Record<string, number> = {
  daily: 2,
  weekly: 9,
  biweekly: 16,
  three_weeks: 23,
  monthly: 35,
  bimonthly: 65,
  quarterly: 95,
};

interface AthleteSummaryCheckinsCardProps {
  client: Client;
}

export function AthleteSummaryCheckinsCard({ client }: AthleteSummaryCheckinsCardProps) {
  const navigate = useNavigate();
  const { data: checkinStats, isLoading: loadingCheckins } = useCheckinStats(client.id);
  const { data: anamneseData, isLoading: loadingAnamnese } = useAnamneseData(client.id);
  
  const isLoading = loadingCheckins || loadingAnamnese;
  
  // Dynamic threshold based on actual frequency
  const threshold = client.checkin_frequency 
    ? (FREQUENCY_DAYS[client.checkin_frequency] || 9)
    : 9;
  
  const daysSinceLastCheckin = checkinStats?.lastCheckinAt
    ? differenceInDays(new Date(), parseISO(checkinStats.lastCheckinAt))
    : null;
    
  const isCheckinUpToDate = daysSinceLastCheckin !== null && daysSinceLastCheckin <= threshold;

  const FREQ_LABELS: Record<string, string> = {
    daily: 'Diário',
    weekly: 'Semanal',
    biweekly: 'Quinzenal',
    three_weeks: '3 Semanas',
    monthly: 'Mensal',
    bimonthly: 'Bimestral',
    quarterly: 'Trimestral',
  };
  
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
      <CardContent className="space-y-3">
        {/* Frequência + Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2.5 rounded-lg bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Frequência</p>
            <p className="text-sm font-semibold">
              {client.has_checkin && client.checkin_frequency 
                ? FREQ_LABELS[client.checkin_frequency] || client.checkin_frequency
                : 'Sem'}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Total</p>
            <p className="text-sm font-bold text-primary">{checkinStats?.total || 0}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Mês</p>
            <p className="text-sm font-bold">{checkinStats?.lastMonth || 0}</p>
          </div>
        </div>
        
        {/* Último check-in */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Último check-in</p>
              <p className="text-sm font-medium">
                {checkinStats?.lastCheckinAt 
                  ? format(parseISO(checkinStats.lastCheckinAt), "dd/MM/yyyy", { locale: ptBR })
                  : 'Nenhum'}
              </p>
            </div>
          </div>
          {daysSinceLastCheckin !== null && (
            <Badge 
              variant="outline" 
              className={`text-xs ${daysSinceLastCheckin > threshold ? 'border-destructive/50 text-destructive' : ''}`}
            >
              há {daysSinceLastCheckin}d
            </Badge>
          )}
        </div>
        
        {/* Anamnese */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Anamnese</p>
              {anamneseData?.submittedAt && (
                <p className="text-xs">
                  {format(parseISO(anamneseData.submittedAt), "dd/MM/yy", { locale: ptBR })}
                </p>
              )}
            </div>
          </div>
          <Badge 
            variant={anamneseData?.hasAnamnese ? 'default' : 'secondary'}
            className={anamneseData?.hasAnamnese ? 'bg-green-500/10 text-green-500 border-green-500/20' : ''}
          >
            {anamneseData?.hasAnamnese ? (
              <><CheckCircle2 className="h-3 w-3 mr-1" />Preenchida</>
            ) : (
              <><AlertCircle className="h-3 w-3 mr-1" />Pendente</>
            )}
          </Badge>
        </div>
        
        {/* Ações */}
        <div className="pt-1">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full gap-1 text-xs h-8"
            onClick={() => navigate(`/clients/${client.id}/checkin-planning`)}
          >
            <Send className="h-3 w-3" />
            Check-ins
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
