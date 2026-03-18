import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Utensils, Check, User, Loader2, ClipboardList, ChevronDown, ChevronRight, CalendarDays, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
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
  pendingCount: number;
}

export function DietAdjustmentAlert() {
  const { data: entries = [], isLoading } = useDietCycleAlerts();
  const markDone = useMarkDietAdjustmentDone();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const handleMarkDone = async (entry: DietCycleEntry) => {
    try {
      await markDone.mutateAsync({ clientId: entry.client_id, alertId: entry.alert_id });
      toast.success(`Ajuste marcado como realizado para ${entry.client_name}`);
    } catch {
      toast.error('Erro ao marcar ajuste como realizado');
    }
  };

  const handleMarkAllDone = async (group: MondayGroup) => {
    const pending = group.entries.filter(e => !e.is_done);
    try {
      for (const entry of pending) {
        await markDone.mutateAsync({ clientId: entry.client_id, alertId: entry.alert_id });
      }
      toast.success(`${pending.length} ajuste(s) marcado(s) como realizado(s)`);
    } catch {
      toast.error('Erro ao marcar ajustes');
    }
  };

  const { sortedGroups, overdue, thisWeekPending, done } = useMemo(() => {
    const today = startOfDay(new Date());
    const groups: Map<string, MondayGroup> = new Map();

    for (const entry of entries) {
      const monday = entry.adjustment_monday;
      const key = format(monday, 'yyyy-MM-dd');
      if (!groups.has(key)) {
        const tw = isThisWeek(monday, { weekStartsOn: 1 });
        groups.set(key, {
          monday,
          mondayKey: key,
          label: format(monday, "EEEE, dd 'de' MMMM", { locale: ptBR }),
          entries: [],
          isThisWeek: tw,
          isPast: isBefore(monday, today) && !tw,
          allDone: true,
          pendingCount: 0,
        });
      }
      const group = groups.get(key)!;
      group.entries.push(entry);
      if (!entry.is_done) {
        group.allDone = false;
        group.pendingCount++;
      }
    }

    const sorted = Array.from(groups.values()).sort(
      (a, b) => a.monday.getTime() - b.monday.getTime()
    );

    let ov = 0, tw = 0, dn = 0;
    sorted.forEach(g => {
      if (g.isPast && !g.allDone) ov += g.pendingCount;
      else if (g.isThisWeek && !g.allDone) tw += g.pendingCount;
      if (g.allDone) dn += g.entries.length;
    });

    return { sortedGroups: sorted, overdue: ov, thisWeekPending: tw, done: dn };
  }, [entries]);

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isSectionOpen = (group: MondayGroup) => {
    if (openSections[group.mondayKey] !== undefined) return openSections[group.mondayKey];
    // Auto-expand: overdue groups and this week
    return group.isThisWeek || (group.isPast && !group.allDone);
  };

  if (isLoading) {
    return (
      <Card className="border-orange-500/30 bg-orange-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-foreground">
            <Utensils className="h-5 w-5 text-orange-500" />
            Ajustes de Dieta
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

  const hasEntries = entries.length > 0;

  return (
    <Collapsible defaultOpen>
      <Card className="border-orange-500/30 bg-orange-500/5">
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-orange-500/10 transition-colors">
            <CardTitle className="flex items-center justify-between text-base text-foreground">
              <div className="flex items-center gap-2 flex-wrap">
                <Utensils className="h-5 w-5 text-orange-500" />
                <span>Ajustes de Dieta</span>
                {/* Urgency summary chips */}
                {overdue > 0 && (
                  <Badge className="text-[10px] bg-destructive text-destructive-foreground gap-1">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    {overdue} atrasado{overdue > 1 ? 's' : ''}
                  </Badge>
                )}
                {thisWeekPending > 0 && (
                  <Badge className="text-[10px] bg-orange-500 text-white gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {thisWeekPending} esta semana
                  </Badge>
                )}
                {done > 0 && overdue === 0 && thisWeekPending === 0 && (
                  <Badge variant="outline" className="text-[10px] text-green-600 border-green-500/50 gap-1">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    Tudo em dia
                  </Badge>
                )}
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {!hasEntries ? (
              <div className="text-center py-6 text-muted-foreground">
                <Utensils className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nenhum atleta elegível para ajuste este mês.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedGroups.map(group => {
                  const open = isSectionOpen(group);
                  return (
                    <div
                      key={group.mondayKey}
                      className={`rounded-lg border transition-colors ${
                        group.isPast && !group.allDone
                          ? 'border-destructive/40 bg-destructive/5'
                          : group.isThisWeek
                          ? 'border-orange-500/50 bg-orange-500/5'
                          : group.allDone
                          ? 'border-green-500/30 bg-green-500/5'
                          : 'border-border bg-background'
                      }`}
                    >
                      <button
                        className="w-full flex items-center justify-between p-3 text-left"
                        onClick={() => toggleSection(group.mondayKey)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {open ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <CalendarDays className={`h-4 w-4 shrink-0 ${
                            group.isPast && !group.allDone ? 'text-destructive' : 'text-orange-500'
                          }`} />
                          <span className="font-medium text-sm capitalize truncate">{group.label}</span>
                          {group.isPast && !group.allDone && (
                            <Badge className="text-[10px] bg-destructive/20 text-destructive border-destructive/30 shrink-0">
                              Atrasado
                            </Badge>
                          )}
                          {group.isThisWeek && (
                            <Badge className="text-[10px] bg-orange-500 text-white shrink-0">Esta semana</Badge>
                          )}
                          {group.allDone && (
                            <Badge variant="outline" className="text-[10px] text-green-600 border-green-500/50 shrink-0">
                              <CheckCircle2 className="h-3 w-3 mr-0.5" />
                              Concluído
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0 ml-2">
                          {group.pendingCount}/{group.entries.length} pendente{group.pendingCount !== 1 ? 's' : ''}
                        </span>
                      </button>

                      {open && (
                        <div className="px-3 pb-3 space-y-1.5">
                          <TooltipProvider delayDuration={200}>
                            {group.entries.map(entry => (
                              <div
                                key={`${entry.client_id}-${entry.cycle_number}`}
                                className={`flex items-center justify-between p-2 rounded-md text-sm ${
                                  entry.is_done
                                    ? 'bg-green-500/10 border border-green-500/20'
                                    : 'bg-background border border-border'
                                }`}
                              >
                                <div className="flex items-center gap-2 flex-wrap min-w-0">
                                  <span className={`font-medium truncate ${entry.is_done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                    {entry.client_name}
                                  </span>
                                  <Badge variant="outline" className="text-[10px]">
                                    {entry.plan_type === 'premium' ? 'Premium' : entry.plan_type === 'consulta_unica' ? 'Consulta Única' : 'Consultoria'}
                                  </Badge>
                                  {entry.checkin_frequency && (
                                    <Badge variant="secondary" className="text-[10px]">
                                      {CHECKIN_FREQ_LABELS[entry.checkin_frequency] || entry.checkin_frequency}
                                    </Badge>
                                  )}
                                  <span className="text-[10px] text-muted-foreground">
                                    Mês {entry.cycle_number}
                                  </span>
                                  {entry.is_done && entry.last_adjustment_at && (
                                    <span className="text-[10px] text-green-600">
                                      ✓ {format(new Date(entry.last_adjustment_at), 'dd/MM')}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
                                        <Link to={`/checkin?search=${encodeURIComponent(entry.client_name)}`}>
                                          <ClipboardList className="h-3.5 w-3.5" />
                                        </Link>
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top"><p>Ver check-ins</p></TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
                                        <Link to={`/clients?search=${encodeURIComponent(entry.client_name)}`}>
                                          <User className="h-3.5 w-3.5" />
                                        </Link>
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top"><p>Ver atleta</p></TooltipContent>
                                  </Tooltip>
                                  {!entry.is_done && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="sm"
                                          className="h-7 text-xs px-2 bg-orange-500 hover:bg-orange-600"
                                          onClick={() => handleMarkDone(entry)}
                                          disabled={markDone.isPending}
                                        >
                                          <Check className="h-3 w-3 mr-0.5" />
                                          Feito
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top"><p>Marcar ajuste como realizado</p></TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              </div>
                            ))}
                          </TooltipProvider>

                          {/* Batch action */}
                          {group.pendingCount > 1 && (
                            <div className="flex justify-end pt-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1 text-orange-600 border-orange-500/30 hover:bg-orange-500/10"
                                onClick={() => handleMarkAllDone(group)}
                                disabled={markDone.isPending}
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                Marcar todos como feito ({group.pendingCount})
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
