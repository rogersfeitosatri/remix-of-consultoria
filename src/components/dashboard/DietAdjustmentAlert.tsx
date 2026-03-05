import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Utensils, Check, User, Loader2, ClipboardList, ChevronDown, ChevronRight, CalendarDays, CheckCircle2 } from 'lucide-react';
import { useDietCycleAlerts, useMarkDietAdjustmentDone, DietCycleEntry } from '@/hooks/useDietAdjustmentAlerts';
import { format, isThisWeek, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

const CHECKIN_FREQ_LABELS: Record<string, string> = {
  monthly: 'Mensal',
  biweekly: 'Quinzenal',
};

interface MondayGroup {
  monday: Date;
  mondayKey: string;
  label: string;
  entries: DietCycleEntry[];
  isThisWeek: boolean;
  isPast: boolean;
  allDone: boolean;
}

export function DietAdjustmentAlert() {
  const { data: entries = [], isLoading } = useDietCycleAlerts();
  const markDone = useMarkDietAdjustmentDone();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const handleMarkDone = async (entry: DietCycleEntry) => {
    try {
      await markDone.mutateAsync({ clientId: entry.client_id, alertId: entry.alert_id });
      toast.success(`Ajuste de dieta marcado como realizado para ${entry.client_name}`);
    } catch {
      toast.error('Erro ao marcar ajuste como realizado');
    }
  };

  if (isLoading) {
    return (
      <Card className="border-orange-500/30 bg-orange-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-foreground">
            <Utensils className="h-5 w-5 text-orange-500" />
            Ajustes de Dieta — Calendário Mensal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Always visible — show empty state if no entries
  const hasEntries = entries.length > 0;

  // Group entries by Monday
  const today = startOfDay(new Date());
  const groups: Map<string, MondayGroup> = new Map();

  for (const entry of entries) {
    const monday = entry.adjustment_monday;
    const key = format(monday, 'yyyy-MM-dd');
    if (!groups.has(key)) {
      const thisWeek = isThisWeek(monday, { weekStartsOn: 1 });
      groups.set(key, {
        monday,
        mondayKey: key,
        label: format(monday, "EEEE, dd 'de' MMMM", { locale: ptBR }),
        entries: [],
        isThisWeek: thisWeek,
        isPast: isBefore(monday, today) && !thisWeek,
        allDone: true,
      });
    }
    const group = groups.get(key)!;
    group.entries.push(entry);
    if (!entry.is_done) group.allDone = false;
  }

  const sortedGroups = Array.from(groups.values()).sort(
    (a, b) => a.monday.getTime() - b.monday.getTime()
  );

  // Count pending (not done) this week
  const thisWeekPending = sortedGroups
    .filter(g => g.isThisWeek)
    .reduce((acc, g) => acc + g.entries.filter(e => !e.is_done).length, 0);

  const totalPending = entries.filter(e => !e.is_done).length;

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isSectionOpen = (group: MondayGroup) => {
    if (openSections[group.mondayKey] !== undefined) return openSections[group.mondayKey];
    // Default: expand this week's group
    return group.isThisWeek;
  };

  return (
    <Collapsible defaultOpen>
      <Card className="border-orange-500/30 bg-orange-500/5">
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-orange-500/10 transition-colors">
            <CardTitle className="flex items-center justify-between text-base text-foreground">
              <div className="flex items-center gap-2">
                <Utensils className="h-5 w-5 text-orange-500" />
                Ajustes de Dieta — Calendário Mensal
                {totalPending > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {totalPending} pendente{totalPending > 1 ? 's' : ''}
                  </Badge>
                )}
                {thisWeekPending > 0 && (
                  <Badge className="text-xs bg-orange-500">
                    {thisWeekPending} esta semana
                  </Badge>
                )}
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Ciclos mensais a partir da data de início do plano. Ajustes otimizados para a segunda-feira mais próxima.
            </p>
            {!hasEntries ? (
              <div className="text-center py-6 text-muted-foreground">
                <Utensils className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nenhum atleta elegível para ajuste de dieta este mês.</p>
                <p className="text-xs mt-1">Atletas de Consultoria/Consulta Única com check-in mensal ou quinzenal aparecerão aqui.</p>
              </div>
            ) : (
            <div className="space-y-2">
              {sortedGroups.map(group => (
                <div
                  key={group.mondayKey}
                  className={`rounded-lg border ${
                    group.isThisWeek
                      ? 'border-orange-500/50 bg-orange-500/5'
                      : group.allDone
                      ? 'border-green-500/30 bg-green-500/5'
                      : group.isPast
                      ? 'border-destructive/30 bg-destructive/5'
                      : 'border-border bg-background'
                  }`}
                >
                  <button
                    className="w-full flex items-center justify-between p-3 text-left"
                    onClick={() => toggleSection(group.mondayKey)}
                  >
                    <div className="flex items-center gap-2">
                      {isSectionOpen(group) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <CalendarDays className="h-4 w-4 text-orange-500" />
                      <span className="font-medium text-sm capitalize">{group.label}</span>
                      {group.isThisWeek && (
                        <Badge className="text-xs bg-orange-500">Esta semana</Badge>
                      )}
                      {group.allDone && (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-500/50">
                          <CheckCircle2 className="h-3 w-3 mr-0.5" />
                          Concluído
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {group.entries.filter(e => !e.is_done).length}/{group.entries.length} pendente(s)
                    </span>
                  </button>

                  {isSectionOpen(group) && (
                    <div className="px-3 pb-3 space-y-2">
                      {group.entries.map(entry => (
                        <div
                          key={`${entry.client_id}-${entry.cycle_number}`}
                          className={`flex items-center justify-between p-2 rounded-md text-sm ${
                            entry.is_done
                              ? 'bg-green-500/10 border border-green-500/20'
                              : 'bg-background border border-border'
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-medium ${entry.is_done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                              {entry.client_name}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {entry.plan_type === 'premium' ? 'Premium' : entry.plan_type === 'consulta_unica' ? 'Consulta Única' : 'Consultoria'}
                            </Badge>
                            {entry.checkin_frequency && (
                              <Badge variant="secondary" className="text-xs">
                                {CHECKIN_FREQ_LABELS[entry.checkin_frequency] || entry.checkin_frequency}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              Mês {entry.cycle_number}
                            </span>
                            {entry.is_done && entry.last_adjustment_at && (
                              <span className="text-xs text-green-600">
                                ✓ Ajustado em {format(new Date(entry.last_adjustment_at), 'dd/MM')}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button size="sm" variant="ghost" className="h-7 text-xs px-2" asChild>
                              <Link to={`/checkin?search=${encodeURIComponent(entry.client_name)}`}>
                                <ClipboardList className="h-3 w-3" />
                              </Link>
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs px-2" asChild>
                              <Link to={`/clients?search=${encodeURIComponent(entry.client_name)}`}>
                                <User className="h-3 w-3" />
                              </Link>
                            </Button>
                            {!entry.is_done && (
                              <Button
                                size="sm"
                                className="h-7 text-xs px-2 bg-orange-500 hover:bg-orange-600"
                                onClick={() => handleMarkDone(entry)}
                                disabled={markDone.isPending}
                              >
                                <Check className="h-3 w-3 mr-0.5" />
                                Feito
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
