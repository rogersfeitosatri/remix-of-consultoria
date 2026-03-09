import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCheckinResponseStatus } from '@/hooks/useCheckinResponseStatus';

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  monthly: 'Mensal',
};

export function CheckinResponseAlert() {
  const navigate = useNavigate();
  const { data: athletes = [], isLoading } = useCheckinResponseStatus();

  if (isLoading || athletes.length === 0) return null;

  return (
    <Card className="border-orange-500/30 bg-orange-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-orange-500" />
          Atletas com pendência de resposta
          <Badge variant="secondary" className="bg-orange-500/20 text-orange-700">
            {athletes.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {athletes.map((athlete) => (
            <div
              key={athlete.clientId}
              className="flex items-center justify-between p-3 rounded-lg bg-background/80 hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => navigate(`/clients/${athlete.clientId}`)}
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{athlete.clientName}</p>
                <p className="text-xs text-muted-foreground">
                  Check-in {FREQUENCY_LABELS[athlete.checkinFrequency]} · {athlete.unrespondedCount} sem resposta
                  {athlete.lastSentAt && (
                    <> · último envio {formatDistanceToNow(parseISO(athlete.lastSentAt), { addSuffix: true, locale: ptBR })}</>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-700 border-orange-500/20">
                  {athlete.unrespondedCount}x pendente
                </Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
