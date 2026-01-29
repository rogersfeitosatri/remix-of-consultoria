import { useState } from 'react';
import { differenceInDays, parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarCheck, Clock, Video, Calendar, Edit2, Save, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useConsultationStats } from '@/hooks/useAthleteSummary';
import { Client } from '@/hooks/useClients';

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
  const { data: stats, isLoading } = useConsultationStats(client.id);
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState(adminNotesShort || '');
  
  const today = new Date();
  
  // Calcular dias desde última consulta
  const daysSinceLastConsult = stats?.lastCompletedAt 
    ? differenceInDays(today, parseISO(stats.lastCompletedAt))
    : null;
    
  // Calcular dias até próxima consulta
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
            Consultas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-20 w-full" />
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
            Consultas
          </CardTitle>
          {client.has_consultations && client.consultation_count && (
            <Badge variant="outline" className="text-xs">
              {client.remaining_consultations ?? client.consultation_count} de {client.consultation_count}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Última consulta */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Última consulta
            </p>
            <p className="text-sm font-medium">
              {stats?.lastCompletedAt 
                ? format(parseISO(stats.lastCompletedAt), "dd/MM/yy", { locale: ptBR })
                : 'Nenhuma'}
            </p>
            {daysSinceLastConsult !== null && (
              <p className="text-xs text-muted-foreground">
                há {daysSinceLastConsult} dias
              </p>
            )}
          </div>
          
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Próxima consulta
            </p>
            <p className="text-sm font-medium">
              {stats?.nextScheduledAt 
                ? format(parseISO(stats.nextScheduledAt), "dd/MM/yy", { locale: ptBR })
                : 'Não agendada'}
            </p>
            {daysUntilNextConsult !== null && daysUntilNextConsult >= 0 && (
              <p className="text-xs text-muted-foreground">
                em {daysUntilNextConsult} dias
              </p>
            )}
          </div>
        </div>
        
        {/* Link do Meet */}
        {stats?.nextMeetLink && (
          <Button variant="outline" size="sm" className="w-full gap-2" asChild>
            <a href={stats.nextMeetLink} target="_blank" rel="noopener noreferrer">
              <Video className="h-3 w-3" />
              Abrir Google Meet
            </a>
          </Button>
        )}
        
        {/* Observações rápidas */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Observações rápidas</span>
            {!isEditing && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2"
                onClick={() => setIsEditing(true)}
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            )}
          </div>
          
          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anotações sobre as consultas..."
                className="min-h-[60px] text-sm"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="gap-1"
                >
                  <Save className="h-3 w-3" />
                  Salvar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground bg-muted/30 p-2 rounded min-h-[40px]">
              {adminNotesShort || 'Sem observações'}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
