import { useState } from 'react';
import { Target, TrendingUp, Edit2, Save, X, AlertTriangle, Focus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAnamneseData, AthleteSummaryData } from '@/hooks/useAthleteSummary';
import { Client } from '@/hooks/useClients';

interface AthleteSummaryGoalsCardProps {
  client: Client;
  summaryData: AthleteSummaryData | null;
  onSaveField: (field: keyof AthleteSummaryData, value: string | null) => void;
  isSaving?: boolean;
}

type EditableField = 'admin_summary' | 'admin_attention_points' | 'admin_next_focus';

const FIELDS: { field: EditableField; label: string; placeholder: string; icon: React.ReactNode }[] = [
  { field: 'admin_summary', label: 'Resumo', placeholder: 'Resumo do acompanhamento...', icon: <TrendingUp className="h-3 w-3" /> },
  { field: 'admin_attention_points', label: 'Atenção', placeholder: 'Pontos de atenção...', icon: <AlertTriangle className="h-3 w-3" /> },
  { field: 'admin_next_focus', label: 'Foco 2 sem.', placeholder: 'Foco das próximas semanas...', icon: <Focus className="h-3 w-3" /> },
];

export function AthleteSummaryGoalsCard({ 
  client, 
  summaryData,
  onSaveField,
  isSaving 
}: AthleteSummaryGoalsCardProps) {
  const { data: anamneseData, isLoading } = useAnamneseData(client.id);
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  
  const handleStartEdit = (field: EditableField) => {
    setEditingField(field);
    setEditValue(summaryData?.[field] || '');
  };
  
  const handleSave = () => {
    if (editingField) {
      onSaveField(editingField, editValue.trim() || null);
      setEditingField(null);
    }
  };
  
  const handleCancel = () => {
    setEditingField(null);
    setEditValue('');
  };

  // Count filled notes
  const filledCount = FIELDS.filter(f => summaryData?.[f.field]).length;
  
  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Objetivos & Evolução
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Objetivos & Evolução
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Objetivo Principal */}
        <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/10">
          <p className="text-xs text-muted-foreground mb-0.5">Objetivo Principal</p>
          <p className="text-sm font-medium">
            {anamneseData?.mainGoal || (anamneseData?.hasAnamnese ? 'Não identificado' : 'Sem anamnese')}
          </p>
        </div>
        
        {anamneseData?.secondaryGoal && (
          <div className="p-2.5 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-0.5">Objetivo Secundário</p>
            <p className="text-sm">{anamneseData.secondaryGoal}</p>
          </div>
        )}
        
        {/* Notas do Admin - Collapsible */}
        <Collapsible open={isNotesOpen} onOpenChange={setIsNotesOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between h-8 text-xs px-2">
              <span className="flex items-center gap-1.5">
                <Edit2 className="h-3 w-3" />
                Notas do Acompanhamento
              </span>
              <span className="text-muted-foreground">{filledCount}/{FIELDS.length}</span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2">
            {FIELDS.map(({ field, label, placeholder, icon }) => {
              const value = summaryData?.[field];
              const isEditing = editingField === field;
              
              return (
                <div key={field} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      {icon} {label}
                    </span>
                    {!isEditing && (
                      <Button variant="ghost" size="sm" className="h-5 px-1.5" onClick={() => handleStartEdit(field)}>
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  
                  {isEditing ? (
                    <div className="space-y-1.5">
                      <Textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder={placeholder}
                        className="min-h-[50px] text-xs"
                      />
                      <div className="flex gap-1.5">
                        <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1 h-7 text-xs">
                          <Save className="h-3 w-3" /> Salvar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleCancel} className="h-7">
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded whitespace-pre-wrap">
                      {value || <span className="italic">{placeholder}</span>}
                    </p>
                  )}
                </div>
              );
            })}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
