import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { format, parseISO, startOfDay, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { History, Search, User, Clock, CheckCircle2, Send, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConsultationSchedule, Client } from '@/hooks/useClients';
import { Link } from 'react-router-dom';

interface ConsultationHistoryViewProps {
  consultations: (ConsultationSchedule & { client_name: string })[];
  clients: Client[];
}

export function ConsultationHistoryView({ consultations, clients }: ConsultationHistoryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const clientsById = useMemo(() => {
    const map = new Map<string, Client>();
    clients.forEach(c => map.set(c.id, c));
    return map;
  }, [clients]);

  // Get past consultations only (send_link_date before today)
  const pastConsultations = useMemo(() => {
    const today = startOfDay(new Date());
    
    return consultations
      .filter(schedule => {
        const sendDate = parseISO(schedule.send_link_date);
        return isBefore(sendDate, today);
      })
      .sort((a, b) => {
        // Sort by date descending (most recent first)
        return new Date(b.send_link_date).getTime() - new Date(a.send_link_date).getTime();
      });
  }, [consultations]);

  // Filter by search
  const filteredConsultations = useMemo(() => {
    if (!searchQuery.trim()) return pastConsultations;
    
    const query = searchQuery.toLowerCase();
    return pastConsultations.filter(schedule => 
      schedule.client_name.toLowerCase().includes(query)
    );
  }, [pastConsultations, searchQuery]);

  // Group by month for better organization
  const groupedByMonth = useMemo(() => {
    const groups: { month: string; schedules: typeof filteredConsultations }[] = [];
    
    filteredConsultations.forEach(schedule => {
      const monthKey = format(parseISO(schedule.send_link_date), 'yyyy-MM');
      const monthLabel = format(parseISO(schedule.send_link_date), "MMMM 'de' yyyy", { locale: ptBR });
      
      const existingGroup = groups.find(g => g.month === monthKey);
      if (existingGroup) {
        existingGroup.schedules.push(schedule);
      } else {
        groups.push({ 
          month: monthKey, 
          schedules: [{ ...schedule, monthLabel } as any]
        });
      }
    });
    
    return groups;
  }, [filteredConsultations]);

  if (pastConsultations.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="py-12 text-center">
          <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground">Nenhum histórico de envios.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <Card className="border-border bg-card">
        <CardContent className="pt-4 pb-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar atleta no histórico..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Results count */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <History className="h-4 w-4" />
        <span>
          {filteredConsultations.length} registro{filteredConsultations.length !== 1 ? 's' : ''} no histórico
        </span>
      </div>

      {/* Grouped by month */}
      {groupedByMonth.map(group => {
        const monthLabel = format(parseISO(group.schedules[0].send_link_date), "MMMM 'de' yyyy", { locale: ptBR });
        
        return (
          <Card key={group.month} className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground capitalize">
                <Calendar className="h-4 w-4" />
                {monthLabel}
                <Badge variant="secondary" className="text-xs">
                  {group.schedules.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {group.schedules.map(schedule => {
                  const client = clientsById.get(schedule.client_id);
                  const isLinkSent = schedule.status === 'sent';
                  const isCompleted = schedule.status === 'completed';
                  
                  return (
                    <div 
                      key={schedule.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border",
                        isCompleted 
                          ? "bg-emerald-500/10 border-emerald-500/30" 
                          : isLinkSent
                            ? "bg-blue-500/10 border-blue-500/30"
                            : "bg-muted/50 border-border"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "rounded-full p-2",
                          isCompleted 
                            ? "bg-emerald-500/20" 
                            : isLinkSent 
                              ? "bg-blue-500/20"
                              : "bg-amber-500/20"
                        )}>
                          {isCompleted ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : isLinkSent ? (
                            <Send className="h-4 w-4 text-blue-500" />
                          ) : (
                            <Clock className="h-4 w-4 text-amber-500" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{schedule.client_name}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(schedule.send_link_date), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs",
                            isCompleted 
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" 
                              : isLinkSent
                                ? "bg-blue-500/10 text-blue-600 border-blue-500/30"
                                : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                          )}
                        >
                          {isCompleted ? 'Concluído' : isLinkSent ? 'Link Enviado' : 'Não Enviado'}
                        </Badge>
                        
                        {client && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            asChild
                            className="h-7 text-xs"
                          >
                            <Link to={`/clients?search=${encodeURIComponent(client.name)}`}>
                              <User className="h-3 w-3 mr-1" />
                              Ver atleta
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {filteredConsultations.length === 0 && searchQuery.trim() && (
        <Card className="border-border bg-card">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Nenhum resultado para "{searchQuery}"</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
