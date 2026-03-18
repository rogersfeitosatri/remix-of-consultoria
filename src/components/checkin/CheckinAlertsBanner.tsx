import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCheckinResponseStatus } from '@/hooks/useCheckinResponseStatus';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  monthly: 'Mensal',
};

export function CheckinAlertsBanner() {
  const navigate = useNavigate();
  const { data: athletes = [], isLoading } = useCheckinResponseStatus();
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading || athletes.length === 0) return null;

  // Split into critical (3+) and warning (1-2)
  const critical = athletes.filter(a => a.unrespondedCount >= 3);
  const warning = athletes.filter(a => a.unrespondedCount < 3);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between p-3 rounded-lg border border-destructive/30 bg-destructive/5 cursor-pointer hover:bg-destructive/10 transition-colors">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <span className="font-medium text-sm">
              {athletes.length} atleta{athletes.length !== 1 ? 's' : ''} sem resposta
            </span>
            {critical.length > 0 && (
              <Badge variant="destructive" className="text-[10px]">
                {critical.length} crítico{critical.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{athletes.length}</Badge>
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-1.5 max-h-[250px] overflow-y-auto rounded-lg border p-2">
          {athletes.map((athlete) => (
            <div
              key={athlete.clientId}
              className="flex items-center justify-between p-2.5 rounded-md bg-muted/30 hover:bg-muted/60 transition-colors cursor-pointer"
              onClick={() => navigate(`/clients/${athlete.clientId}`)}
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{athlete.clientName}</p>
                <p className="text-xs text-muted-foreground">
                  {FREQUENCY_LABELS[athlete.checkinFrequency] || athlete.checkinFrequency} · {athlete.unrespondedCount} sem resposta
                  {athlete.lastSentAt && (
                    <> · {formatDistanceToNow(parseISO(athlete.lastSentAt), { addSuffix: true, locale: ptBR })}</>
                  )}
                </p>
              </div>
              <Badge 
                variant={athlete.unrespondedCount >= 3 ? "destructive" : "outline"}
                className="text-[10px] ml-2"
              >
                {athlete.unrespondedCount}x
              </Badge>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
