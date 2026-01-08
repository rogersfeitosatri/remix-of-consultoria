import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useQuestionTemplates,
  useCreateQuestionTemplate,
  useUpdateQuestionTemplate,
  useDeleteQuestionTemplate,
  useDuplicateQuestionTemplate,
  QUESTION_CATEGORIES,
  QUESTION_TYPES,
  type QuestionTemplate,
} from '@/hooks/useQuestionBank';
import { Library, Plus, Trash2, Edit, Copy, Loader2, FileText, ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';

export function QuestionBankSection() {
  const [activeSection, setActiveSection] = useState('anamnese');
  const { data: templates = [], isLoading } = useQuestionTemplates(activeSection);
  const createTemplate = useCreateQuestionTemplate();
  const updateTemplate = useUpdateQuestionTemplate();
  const deleteTemplate = useDeleteQuestionTemplate();
  const duplicateTemplate = useDuplicateQuestionTemplate();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<QuestionTemplate | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<QuestionTemplate | null>(null);

  // Form state
  const [questionText, setQuestionText] = useState('');
  const [questionType, setQuestionType] = useState<string>('text');
  const [category, setCategory] = useState<string>('outros');
  const [options, setOptions] = useState('');
  const [scaleMin, setScaleMin] = useState(1);
  const [scaleMax, setScaleMax] = useState(10);
  const [isRequired, setIsRequired] = useState(true);
  const [hasCommentField, setHasCommentField] = useState(false);
  const [commentFieldLabel, setCommentFieldLabel] = useState('');
  const [commentFieldRequired, setCommentFieldRequired] = useState(false);

  const resetForm = () => {
    setQuestionText('');
    setQuestionType('text');
    setCategory('outros');
    setOptions('');
    setScaleMin(1);
    setScaleMax(10);
    setIsRequired(true);
    setHasCommentField(false);
    setCommentFieldLabel('');
    setCommentFieldRequired(false);
    setEditingTemplate(null);
  };

  const handleOpenDialog = (template?: QuestionTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setQuestionText(template.question_text);
      setQuestionType(template.question_type);
      setCategory(template.category);
      setOptions(template.options?.join('\n') || '');
      setScaleMin(template.scale_min || 1);
      setScaleMax(template.scale_max || 10);
      setIsRequired(template.is_required);
      setHasCommentField(template.has_comment_field);
      setCommentFieldLabel(template.comment_field_label || '');
      setCommentFieldRequired(template.comment_field_required || false);
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!questionText.trim()) {
      toast.error('Digite o texto da pergunta');
      return;
    }

    try {
      const data = {
        question_text: questionText,
        question_type: questionType as QuestionTemplate['question_type'],
        category,
        section: activeSection,
        options: ['multiple_choice', 'checkbox'].includes(questionType)
          ? options.split('\n').filter(o => o.trim())
          : null,
        scale_min: questionType === 'scale' ? scaleMin : null,
        scale_max: questionType === 'scale' ? scaleMax : null,
        is_required: isRequired,
        has_comment_field: hasCommentField,
        comment_field_label: hasCommentField ? commentFieldLabel : null,
        comment_field_required: hasCommentField ? commentFieldRequired : null,
      };

      if (editingTemplate) {
        await updateTemplate.mutateAsync({ id: editingTemplate.id, ...data });
        toast.success('Pergunta atualizada!');
      } else {
        await createTemplate.mutateAsync(data);
        toast.success('Pergunta criada!');
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar');
    }
  };

  const handleDelete = async () => {
    if (templateToDelete) {
      try {
        await deleteTemplate.mutateAsync(templateToDelete.id);
        toast.success('Pergunta excluída!');
        setDeleteDialogOpen(false);
        setTemplateToDelete(null);
      } catch (error) {
        toast.error('Erro ao excluir');
      }
    }
  };

  const handleDuplicate = async (template: QuestionTemplate) => {
    try {
      await duplicateTemplate.mutateAsync(template);
      toast.success('Pergunta duplicada!');
    } catch (error) {
      toast.error('Erro ao duplicar');
    }
  };

  const getCategoryLabel = (value: string) => {
    return QUESTION_CATEGORIES.find(c => c.value === value)?.label || value;
  };

  const getTypeLabel = (value: string) => {
    return QUESTION_TYPES.find(t => t.value === value)?.label || value;
  };

  // Group templates by category
  const templatesByCategory = templates.reduce((acc, template) => {
    const cat = template.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(template);
    return acc;
  }, {} as Record<string, QuestionTemplate[]>);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Library className="h-5 w-5" />
            Banco de Perguntas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Library className="h-5 w-5" />
              Banco de Perguntas
            </CardTitle>
            <Button size="sm" onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Pergunta
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={activeSection} onValueChange={setActiveSection}>
            <TabsList className="grid w-full grid-cols-2 max-w-xs">
              <TabsTrigger value="anamnese" className="gap-2 text-xs">
                <FileText className="h-3 w-3" />
                Anamnese
              </TabsTrigger>
              <TabsTrigger value="checkin" className="gap-2 text-xs">
                <ClipboardCheck className="h-3 w-3" />
                Check-in
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeSection} className="space-y-4 mt-4">
              {Object.keys(templatesByCategory).length === 0 ? (
                <div className="py-8 text-center">
                  <Library className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Nenhuma pergunta cadastrada para {activeSection === 'anamnese' ? 'Anamnese' : 'Check-in'}.
                  </p>
                  <Button size="sm" onClick={() => handleOpenDialog()} className="mt-3 gap-2">
                    <Plus className="h-4 w-4" />
                    Criar primeira pergunta
                  </Button>
                </div>
              ) : (
                Object.entries(templatesByCategory).map(([cat, catTemplates]) => (
                  <div key={cat} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{getCategoryLabel(cat)}</Badge>
                      <span className="text-xs text-muted-foreground">
                        ({catTemplates.length})
                      </span>
                    </div>
                    <div className="space-y-2">
                      {catTemplates.map((template) => (
                        <div
                          key={template.id}
                          className="flex items-start gap-2 p-3 rounded-lg border bg-muted/30"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{template.question_text}</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {getTypeLabel(template.question_type)}
                              </Badge>
                              {template.is_required && (
                                <Badge variant="outline" className="text-xs bg-red-500/10 text-red-500 border-red-500/20">
                                  Obrigatória
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleDuplicate(template)}
                              title="Duplicar"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleOpenDialog(template)}
                              title="Editar"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => {
                                setTemplateToDelete(template);
                                setDeleteDialogOpen(true);
                              }}
                              title="Excluir"
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Editar Pergunta' : 'Nova Pergunta'}
            </DialogTitle>
            <DialogDescription>
              {activeSection === 'anamnese' ? 'Pergunta para formulários de Anamnese' : 'Pergunta para formulários de Check-in'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Texto da Pergunta *</Label>
              <Textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Digite a pergunta..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Resposta</Label>
                <Select value={questionType} onValueChange={setQuestionType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUESTION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUESTION_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {['multiple_choice', 'checkbox'].includes(questionType) && (
              <div className="space-y-2">
                <Label>Opções (uma por linha)</Label>
                <Textarea
                  value={options}
                  onChange={(e) => setOptions(e.target.value)}
                  placeholder="Opção 1&#10;Opção 2&#10;Opção 3"
                  rows={4}
                />
              </div>
            )}

            {questionType === 'scale' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor Mínimo</Label>
                  <Input
                    type="number"
                    value={scaleMin}
                    onChange={(e) => setScaleMin(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor Máximo</Label>
                  <Input
                    type="number"
                    value={scaleMax}
                    onChange={(e) => setScaleMax(Number(e.target.value))}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label>Pergunta obrigatória</Label>
              <Switch checked={isRequired} onCheckedChange={setIsRequired} />
            </div>

            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label>Campo de comentário adicional</Label>
                <Switch checked={hasCommentField} onCheckedChange={setHasCommentField} />
              </div>

              {hasCommentField && (
                <>
                  <div className="space-y-2">
                    <Label>Título do campo de comentário</Label>
                    <Input
                      value={commentFieldLabel}
                      onChange={(e) => setCommentFieldLabel(e.target.value)}
                      placeholder="Ex: Observações adicionais"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Comentário obrigatório</Label>
                    <Switch
                      checked={commentFieldRequired}
                      onCheckedChange={setCommentFieldRequired}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={createTemplate.isPending || updateTemplate.isPending}
            >
              {(createTemplate.isPending || updateTemplate.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pergunta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A pergunta será removida permanentemente do banco.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}