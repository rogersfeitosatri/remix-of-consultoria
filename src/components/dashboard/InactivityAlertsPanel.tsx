import { useInactivityAlerts } from '@/hooks/useInactivityAlerts';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserX, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export function InactivityAlertsPanel() {
  const { data: inactiveAthletes = [] } = useInactivityAlerts(14);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (inactiveAthletes.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-destructive/20">
        <CardContent className="p-4">
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full text-left">
              <div className="flex items-center gap-2">
                <UserX className="h-4 w-4 text-destructive" />
                <span className="text-sm font-semibold text-foreground">Atletas sem interação</span>
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                  {inactiveAthletes.length}
                </Badge>
              </div>
              {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="mt-3 space-y-2">
            {inactiveAthletes.map(athlete => (
              <div key={athlete.id} className="flex items-center justify-between rounded-lg bg-destructive/5 px-3 py-2 border border-destructive/10">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{athlete.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Última: {athlete.lastInteractionType} em {athlete.lastInteractionDate} ({athlete.daysSinceLastInteraction}d)
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {athlete.phone && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-success"
                      onClick={() => {
                        const digits = athlete.phone!.replace(/\D/g, '');
                        const withDDI = digits.startsWith('55') ? digits : `55${digits}`;
                        window.open(`https://wa.me/${withDDI}?text=${encodeURIComponent(`Olá! Tudo bem? Percebi que faz um tempo que não nos falamos. Como está indo? 💪`)}`, '_blank');
                      }}
                    >
                      <Zap className="h-3 w-3" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => navigate(`/clients/${athlete.id}`)}>
                    Ver
                  </Button>
                </div>
              </div>
            ))}
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
}
