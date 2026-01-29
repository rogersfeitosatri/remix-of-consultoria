import { useState } from 'react';
import { Target, TrendingUp, Edit2, Save, X, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnamneseData, AthleteSummaryData } from '@/hooks/useAthleteSummary';
import { Client } from '@/hooks/useClients';

interface AthleteSummaryGoalsCardProps {
  client: Client;
  summaryData: AthleteSummaryData | null;
  onSaveField: (field: keyof AthleteSummaryData, value: string | null) => void;
  isSaving?: boolean;
}

type EditableField = 'admin_summary' | 'admin_attention_points' | 'admin_next_focus';

export function AthleteSummaryGoalsCard({ 
  client, 
  summaryData,
  onSaveField,
  isSaving 
}: AthleteSummaryGoalsCardProps) {
  const { data: anamneseData, isLoading } = useAnamneseData(client.id);
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [editValue, setEditValue] = useState('');
  
  const handleStartEdit = (field: EditableField) => {
    setEditingField(field);
    setEditValue(summaryData?.[field] || '');
  };
  
  const handleSave = () => {
    if (editingField) {
      onSaveField(editingField, editValue.trim() || null);
      setEditingField(null);
      setEditValue('');
    }
  };
  
  const handleCancel = () => {
    setEditingField(null);
    setEditValue('');
  };
  
  const renderEditableField = (
    field: EditableField,
    label: string,
    placeholder: string,
    icon: React.ReactNode
  ) => {
    const value = summaryData?.[field];
    const isEditing = editingField === field;
    
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            {icon}
            {label}
          </span>
          {!isEditing && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={() => handleStartEdit(field)}
            >
              <Edit2 className="h-3 w-3" />
            </Button>
          )}
        </div>
        
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder={placeholder}
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
          <p className="text-sm text-muted-foreground bg-muted/30 p-2 rounded min-h-[40px] whitespace-pre-wrap">
            {value || placeholder}
          </p>
        )}
      </div>
    );
  };
  
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
          <Skeleton className="h-20 w-full" />
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
      <CardContent className="space-y-4">
        {/* Objetivos da Anamnese */}
        <div className="space-y-2">
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">Objetivo Principal</p>
            <p className="text-sm font-medium">
              {anamneseData?.mainGoal || (anamneseData?.hasAnamnese ? 'Não identificado na anamnese' : '')}
            </p>
            {!anamneseData?.mainGoal && !anamneseData?.hasAnamnese && (
              <p className="text-sm text-muted-foreground italic">Sem anamnese preenchida</p>
            )}
          </div>
          
          {anamneseData?.secondaryGoal && (
            <div className="p-3 rounded-lg bg-muted/30">
              <p className="text-xs text-muted-foreground mb-1">Objetivo Secundário</p>
              <p className="text-sm">
                {anamneseData.secondaryGoal}
              </p>
            </div>
          )}
        </div>
        
        {/* Campos Editáveis */}
        <div className="space-y-4 pt-2 border-t">
          {renderEditableField(
            'admin_summary',
            'Resumo do Acompanhamento',
            'Adicione um resumo do acompanhamento...',
            <TrendingUp className="h-3 w-3" />
          )}
          
          {renderEditableField(
            'admin_attention_points',
            'Pontos de Atenção',
            'Pontos que precisam de atenção...',
            <AlertTriangle className="h-3 w-3" />
          )}
          
          {renderEditableField(
            'admin_next_focus',
            'Foco das Próximas 2 Semanas',
            'Qual o foco para as próximas semanas...',
            <Target className="h-3 w-3" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
