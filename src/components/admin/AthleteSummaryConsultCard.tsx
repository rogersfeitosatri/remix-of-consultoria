import { useState } from 'react';
import { differenceInDays, parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarCheck, Clock, Video, Calendar, Edit2, Save, X, Send, ListTodo } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { useConsultationStats } from '@/hooks/useAthleteSummary';
import { Client } from '@/hooks/useClients';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AthleteSummaryConsultCardProps {
  client: Client;
  adminNotesShort: string | null;
  onSaveNotes: (notes: string | null) => void;
  isSaving?: boolean;
}

export function AthleteSummaryConsultCard({ 
  client, 
  adminNotesShort, 
  onSaveNotes,
  isSaving 
}: AthleteSummaryConsultCardProps) {
  const navigate = useNavigate();
  const { data: stats, isLoading } = useConsultationStats(client.id);
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState(adminNotesShort || '');

  // Pending tasks count for this athlete
  const { data: pendingTasksCount = 0 } = useQuery({
    queryKey: ['athlete-pending-tasks', client.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', client.id)
        .in('status', ['pending', 'in_progress']);
      if (error) throw error;
      return count || 0;
    },
  });

  // Meal plan status
  const { data: mealPlanStatus } = useQuery({
    queryKey: ['athlete-meal-plan-status', client.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meal_plan_status')
        .select('status, sent_at')
        .eq('client_id', client.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  
  const today = new Date();
  const daysSinceLastConsult = stats?.lastCompletedAt 
    ? differenceInDays(today, parseISO(stats.lastCompletedAt))
    : null;
  const daysUntilNextConsult = stats?.nextScheduledAt
    ? differenceInDays(parseISO(stats.nextScheduledAt), today)
    : null;
  
  const handleSave = () => {
    onSaveNotes(notes.trim() || null);
    setIsEditing(false);
  };
  
  const handleCancel = () => {
    setNotes(adminNotesShort || '');
    setIsEditing(false);
  };
  
  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-primary" />
            Consultas & Tarefas
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
            <CalendarCheck className="h-4 w-4 text-primary" />
            Consultas & Tarefas
          </CardTitle>
          <div className="flex gap-1.5">
            {pendingTasksCount > 0 && (
              <Badge variant="secondary" className="text-xs gap-1">
                <ListTodo className="h-3 w-3" />
                {pendingTasksCount}
              </Badge>
            )}
            {client.has_consultations && client.consultation_count > 0 && (
              <Badge variant="outline" className="text-xs">
                {client.remaining_consultations ?? client.consultation_count}/{client.consultation_count}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Consultas */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
              <Clock className="h-3 w-3" /> Última
            </p>
            <p className="text-sm font-medium">
              {stats?.lastCompletedAt 
                ? format(parseISO(stats.lastCompletedAt), "dd/MM/yy", { locale: ptBR })
                : '—'}
            </p>
            {daysSinceLastConsult !== null && (
              <p className="text-xs text-muted-foreground">há {daysSinceLastConsult}d</p>
            )}
          </div>
          
          <div className="p-2.5 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Próxima
            </p>
            <p className="text-sm font-medium">
              {stats?.nextScheduledAt 
                ? format(parseISO(stats.nextScheduledAt), "dd/MM/yy", { locale: ptBR })
                : '—'}
            </p>
            {daysUntilNextConsult !== null && daysUntilNextConsult >= 0 && (
              <p className="text-xs text-muted-foreground">em {daysUntilNextConsult}d</p>
            )}
          </div>
        </div>

        {/* Meal plan status */}
        {(client.service_type === 'nutrition' || client.service_type === 'both') && (
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
            <span className="text-xs text-muted-foreground">Plano Alimentar</span>
            <Badge 
              variant={mealPlanStatus?.status === 'sent' ? 'default' : 'secondary'}
              className={`text-xs ${mealPlanStatus?.status === 'sent' ? 'bg-green-500/10 text-green-500 border-green-500/20' : ''}`}
            >
              {mealPlanStatus?.status === 'sent' 
                ? `Enviado ${mealPlanStatus.sent_at ? format(parseISO(mealPlanStatus.sent_at), 'dd/MM', { locale: ptBR }) : ''}`
                : mealPlanStatus?.status === 'pending' 
                  ? 'Pendente' 
                  : 'Não criado'}
            </Badge>
          </div>
        )}

        {/* Google Meet */}
        {stats?.nextMeetLink && (
          <Button variant="outline" size="sm" className="w-full gap-2 h-8 text-xs" asChild>
            <a href={stats.nextMeetLink} target="_blank" rel="noopener noreferrer">
              <Video className="h-3 w-3" />
              Abrir Google Meet
            </a>
          </Button>
        )}
        
        {/* Observações rápidas */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Observações</span>
            {!isEditing && (
              <Button variant="ghost" size="sm" className="h-5 px-1.5" onClick={() => setIsEditing(true)}>
                <Edit2 className="h-3 w-3" />
              </Button>
            )}
          </div>
          
          {isEditing ? (
            <div className="space-y-1.5">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anotações rápidas..."
                className="min-h-[50px] text-xs"
              />
              <div className="flex gap-1.5">
                <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1 h-7 text-xs">
                  <Save className="h-3 w-3" /> Salvar
                </Button>
                <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving} className="h-7">
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded min-h-[32px] whitespace-pre-wrap">
              {adminNotesShort || 'Sem observações'}
            </p>
          )}
        </div>

        {/* Ações */}
        <div className="flex gap-2 pt-1">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 gap-1 text-xs h-8"
            onClick={() => navigate('/calendar')}
          >
            <Calendar className="h-3 w-3" />
            Agenda
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 gap-1 text-xs h-8"
            onClick={() => navigate('/tasks')}
          >
            <ListTodo className="h-3 w-3" />
            Tarefas
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
