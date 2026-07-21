import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Plus, Trash2, GripVertical, Save, Eye, Copy, Settings, Library, Loader2, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useAnamneseFormWithQuestions,
  useUpdateAnamneseForm,
  useAddAnamneseQuestion,
  useUpdateAnamneseQuestion,
  useDeleteAnamneseQuestion,
  useReorderAnamneseQuestions,
  useRenameAnamneseSection,
  AnamneseQuestion,
} from '@/hooks/useAnamneseForms';
import { useQuestionTemplates, QUESTION_CATEGORIES, type QuestionTemplate } from '@/hooks/useQuestionBank';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableQuestionCard } from '@/components/forms/SortableQuestionCard';
import { SortableSectionHeader } from '@/components/forms/SortableSectionHeader';

const questionTypes = [
  { value: 'info', label: '💡 Bloco informativo (sem resposta)' },
  { value: 'text', label: 'Texto Curto' },
  { value: 'textarea', label: 'Texto Longo' },
  { value: 'number', label: 'Número' },
  { value: 'select', label: 'Seleção Única' },
  { value: 'multiselect', label: 'Múltipla Escolha' },
  { value: 'scale', label: 'Escala (1-10)' },
  { value: 'boolean', label: 'Sim/Não' },
  { value: 'date', label: 'Data' },
  { value: 'time', label: 'Horário (HH:MM)' },
  { value: 'chips', label: '🏷️ Tags / lista de itens' },
  { value: 'meal_items', label: '🍽️ Refeição (horário + alimentos)' },
  { value: 'training_week', label: '🏋️ Rotina de Treino Semanal' },
  { value: 'symptom_scale', label: '📊 Sintomas (frequência 0–5)' },
  // Tipos da ANAMNESE COMPLETA (renderização rica na Fase 2)
  { value: 'field_group', label: '🧩 Grupo de campos (condicionais)' },
  { value: 'structured_list', label: '📋 Lista estruturada (repetível)' },
  { value: 'meal_plan_editor', label: '🍴 Editor de refeições habituais' },
  { value: 'symptom_grid', label: '🩺 Grade de sintomas (momento/freq/intensidade)' },
  { value: 'frequency_grid', label: '📈 Grade de frequência alimentar' },
  { value: 'file_upload', label: '📎 Anexo de arquivo (exames)' },
];

export default function AnamneseFormBuilder() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: formData, isLoading } = useAnamneseFormWithQuestions(formId);
  const { data: questionTemplates = [], isLoading: isLoadingTemplates } = useQuestionTemplates('anamnese');
  const updateForm = useUpdateAnamneseForm();
  const addQuestion = useAddAnamneseQuestion();
  const updateQuestion = useUpdateAnamneseQuestion();
  const deleteQuestion = useDeleteAnamneseQuestion();
  const reorderQuestions = useReorderAnamneseQuestions();
  const renameSection = useRenameAnamneseSection();

  const [showQuestionDialog, setShowQuestionDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showBankDialog, setShowBankDialog] = useState(false);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [editingQuestion, setEditingQuestion] = useState<AnamneseQuestion | null>(null);
  const [questionData, setQuestionData] = useState({
    question_text: '',
    question_type: 'text',
    section: 'Geral',
    is_required: false,
    has_comment_field: false,
    comment_field_required: false,
    comment_field_label: 'Comentário adicional',
    options: [] as string[],
    scale_min: 1,
    scale_max: 10,
    info_body: '',
    info_button_label: 'Vamos lá',
  });
  const [newOption, setNewOption] = useState('');
  const [formSettings, setFormSettings] = useState({
    title: '',
    description: '',
    is_active: true,
    is_required: true,
  });
  const [localQuestions, setLocalQuestions] = useState<AnamneseQuestion[]>([]);
  // Sections list persisted locally (includes empty sections not yet backed by questions)
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (formData?.form) {
      setFormSettings({
        title: formData.form.title,
        description: formData.form.description || '',
        is_active: formData.form.is_active,
        is_required: formData.form.is_required,
      });
    }
  }, [formData?.form]);

  useEffect(() => {
    if (formData?.questions) {
      setLocalQuestions(formData.questions);
    }
  }, [formData?.questions]);

  const resetQuestionData = () => {
    setQuestionData({
      question_text: '',
      question_type: 'text',
      section: 'Geral',
      is_required: false,
      has_comment_field: false,
      comment_field_required: false,
      comment_field_label: 'Comentário adicional',
      options: [],
      scale_min: 1,
      scale_max: 10,
      info_body: '',
      info_button_label: 'Vamos lá',
    });
    setEditingQuestion(null);
    setNewOption('');
  };

  const handleOpenQuestionDialog = (question?: AnamneseQuestion) => {
    if (question) {
      setEditingQuestion(question);
      setQuestionData({
        question_text: question.question_text,
        question_type: question.question_type,
        section: question.section,
        is_required: question.is_required,
        has_comment_field: question.has_comment_field,
        comment_field_required: question.comment_field_required || false,
        comment_field_label: question.comment_field_label || 'Comentário adicional',
        options: question.options || [],
        scale_min: question.scale_min || 1,
        scale_max: question.scale_max || 10,
        info_body: question.config?.body || '',
        info_button_label: question.config?.buttonLabel || 'Vamos lá',
      });
    } else {
      resetQuestionData();
    }
    setShowQuestionDialog(true);
  };

  const handleAddOption = () => {
    if (newOption.trim()) {
      setQuestionData({
        ...questionData,
        options: [...questionData.options, newOption.trim()],
      });
      setNewOption('');
    }
  };

  const handleRemoveOption = (index: number) => {
    setQuestionData({
      ...questionData,
      options: questionData.options.filter((_, i) => i !== index),
    });
  };

  const handleSaveQuestion = async () => {
    if (!questionData.question_text.trim()) {
      toast({
        title: 'Erro',
        description: 'O texto da pergunta é obrigatório.',
        variant: 'destructive',
      });
      return;
    }

    if (['select', 'multiselect'].includes(questionData.question_type) && questionData.options.length === 0) {
      toast({
        title: 'Erro',
        description: 'Adicione pelo menos uma opção para perguntas de seleção.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const isInfo = questionData.question_type === 'info';
      const payload = {
        question_text: questionData.question_text,
        question_type: questionData.question_type,
        section: questionData.section,
        is_required: isInfo ? false : questionData.is_required,
        has_comment_field: isInfo ? false : questionData.has_comment_field,
        comment_field_required: isInfo ? false : questionData.comment_field_required,
        comment_field_label: questionData.comment_field_label,
        options: ['select', 'multiselect'].includes(questionData.question_type) ? questionData.options : null,
        scale_min: questionData.question_type === 'scale' ? questionData.scale_min : null,
        scale_max: questionData.question_type === 'scale' ? questionData.scale_max : null,
        config: isInfo
          ? { body: questionData.info_body, buttonLabel: questionData.info_button_label || 'Vamos lá' }
          : (editingQuestion?.config ?? null),
      };

      if (editingQuestion) {
        await updateQuestion.mutateAsync({
          id: editingQuestion.id,
          form_id: formId!,
          ...payload,
        });
        toast({ title: 'Pergunta atualizada!' });
      } else {
        await addQuestion.mutateAsync({
          form_id: formId!,
          order_index: (formData?.questions?.length || 0),
          ...payload,
        });
        toast({ title: 'Pergunta adicionada!' });
      }

      setShowQuestionDialog(false);
      resetQuestionData();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar a pergunta.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    try {
      await deleteQuestion.mutateAsync({ id: questionId, form_id: formId! });
      toast({ title: 'Pergunta excluída!' });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir a pergunta.',
        variant: 'destructive',
      });
    }
  };

  const handleDuplicateQuestion = async (question: AnamneseQuestion) => {
    try {
      await addQuestion.mutateAsync({
        form_id: formId!,
        section: question.section,
        question_text: `${question.question_text} (cópia)`,
        question_type: question.question_type,
        options: question.options ?? undefined,
        scale_min: question.scale_min,
        scale_max: question.scale_max,
        is_required: question.is_required,
        has_comment_field: question.has_comment_field,
        comment_field_label: question.comment_field_label,
        comment_field_required: question.comment_field_required,
        order_index: (formData?.questions?.length || 0),
        config: question.config ?? null,
      });
      toast({ title: 'Pergunta duplicada!' });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível duplicar a pergunta.',
        variant: 'destructive',
      });
    }
  };

  const handleSaveSettings = async () => {
    try {
      await updateForm.mutateAsync({
        id: formId!,
        title: formSettings.title,
        description: formSettings.description || null,
        is_active: formSettings.is_active,
        is_required: formSettings.is_required,
      });
      toast({ title: 'Configurações salvas!' });
      setShowSettingsDialog(false);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      });
    }
  };

  const handleImportFromBank = async () => {
    if (selectedTemplates.length === 0) {
      toast({ title: 'Selecione pelo menos uma pergunta', variant: 'destructive' });
      return;
    }

    try {
      const currentQuestionsCount = formData?.questions?.length || 0;
      
      for (let i = 0; i < selectedTemplates.length; i++) {
        const templateId = selectedTemplates[i];
        const template = questionTemplates.find(t => t.id === templateId);
        if (!template) continue;

        const typeMap: Record<string, string> = {
          'multiple_choice': 'select',
          'checkbox': 'multiselect',
          'text': 'text',
          'textarea': 'textarea',
          'scale': 'scale',
        };

        await addQuestion.mutateAsync({
          form_id: formId!,
          question_text: template.question_text,
          question_type: typeMap[template.question_type] || 'text',
          section: template.category ? QUESTION_CATEGORIES.find(c => c.value === template.category)?.label || 'Geral' : 'Geral',
          is_required: template.is_required,
          has_comment_field: template.has_comment_field,
          comment_field_required: template.comment_field_required || false,
          comment_field_label: template.comment_field_label || 'Comentário adicional',
          options: template.options || null,
          scale_min: template.scale_min,
          scale_max: template.scale_max,
          order_index: currentQuestionsCount + i,
        });
      }

      toast({ title: `${selectedTemplates.length} pergunta(s) importada(s) com sucesso!` });
      setSelectedTemplates([]);
      setShowBankDialog(false);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível importar as perguntas.',
        variant: 'destructive',
      });
    }
  };

  const toggleTemplateSelection = (templateId: string) => {
    setSelectedTemplates(prev => 
      prev.includes(templateId) 
        ? prev.filter(id => id !== templateId)
        : [...prev, templateId]
    );
  };

  const copyFormLink = () => {
    const link = `${window.location.origin}/anamnese-form/${formId}`;
    navigator.clipboard.writeText(link);
    toast({ title: 'Link copiado!' });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    // Find items in the flat list ordered by order_index
    const sortedQuestions = [...localQuestions].sort((a, b) => a.order_index - b.order_index);
    const oldIndex = sortedQuestions.findIndex(q => q.id === active.id);
    const newIndex = sortedQuestions.findIndex(q => q.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newQuestions = arrayMove(sortedQuestions, oldIndex, newIndex);
    
    // Update order_index for all questions
    const updatedQuestions = newQuestions.map((q, index) => ({
      ...q,
      order_index: index,
    }));
    
    setLocalQuestions(updatedQuestions);

    // Update order_index for all affected questions
    const updates = updatedQuestions.map((q) => ({
      id: q.id,
      order_index: q.order_index,
    }));

    try {
      await reorderQuestions.mutateAsync({
        form_id: formId!,
        updates,
      });
      toast({ title: 'Ordem atualizada!' });
    } catch (error) {
      // Revert on error
      setLocalQuestions(formData?.questions || []);
      toast({
        title: 'Erro',
        description: 'Não foi possível reordenar as perguntas.',
        variant: 'destructive',
      });
    }
  };

  const handleRenameSection = async (oldSection: string, newSection: string) => {
    try {
      await renameSection.mutateAsync({
        form_id: formId!,
        old_section: oldSection,
        new_section: newSection,
      });
      toast({ title: 'Seção renomeada!' });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível renomear a seção.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (!formData?.form) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Formulário não encontrado.</p>
          <Button variant="link" onClick={() => navigate('/forms')}>
            Voltar para formulários
          </Button>
        </div>
      </Layout>
    );
  }

  const sortedQuestions = [...localQuestions].sort((a, b) => a.order_index - b.order_index);
  const sections = [...new Set(sortedQuestions.map(q => q.section))];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/forms')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{formData.form.title}</h1>
                <Badge variant={formData.form.is_active ? 'default' : 'secondary'}>
                  {formData.form.is_active ? 'Ativo' : 'Inativo'}
                </Badge>
                {formData.form.is_required && (
                  <Badge variant="destructive">Obrigatório</Badge>
                )}
              </div>
              {formData.form.description && (
                <p className="text-muted-foreground mt-1">{formData.form.description}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={copyFormLink} className="gap-2">
              <Copy className="h-4 w-4" />
              Copiar Link
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowSettingsDialog(true)} className="gap-2">
              <Settings className="h-4 w-4" />
              Configurações
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setSelectedTemplates([]); setShowBankDialog(true); }} className="gap-2">
              <Library className="h-4 w-4" />
              Importar do Banco
            </Button>
            <Button size="sm" onClick={() => handleOpenQuestionDialog()} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Pergunta
            </Button>
          </div>
        </div>

        {/* Questions */}
        {sortedQuestions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground mb-4">Nenhuma pergunta adicionada ainda.</p>
              <Button onClick={() => handleOpenQuestionDialog()} className="gap-2">
                <Plus className="h-4 w-4" />
                Adicionar Primeira Pergunta
              </Button>
            </CardContent>
          </Card>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sortedQuestions.map(q => q.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-6">
                {sections.map(section => {
                  const sectionQuestions = sortedQuestions.filter(q => q.section === section);

                  return (
                    <div key={section} className="group">
                      <EditableSectionHeader
                        section={section}
                        onRename={handleRenameSection}
                      />
                      <div className="space-y-3">
                        {sectionQuestions.map((question, index) => (
                          <SortableQuestionCard
                            key={question.id}
                            id={question.id}
                            question={question}
                            index={index}
                            typeLabel={questionTypes.find(t => t.value === question.question_type)?.label || question.question_type}
                            onEdit={() => handleOpenQuestionDialog(question)}
                            onDelete={() => handleDeleteQuestion(question.id)}
                            onDuplicate={() => handleDuplicateQuestion(question)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Question Dialog */}
      <Dialog open={showQuestionDialog} onOpenChange={setShowQuestionDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingQuestion ? 'Editar Pergunta' : 'Nova Pergunta'}
            </DialogTitle>
            <DialogDescription>
              Configure os detalhes da pergunta
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{questionData.question_type === 'info' ? 'Título do bloco *' : 'Pergunta *'}</Label>
              <Textarea
                value={questionData.question_text}
                onChange={(e) => setQuestionData({ ...questionData, question_text: e.target.value })}
                placeholder={questionData.question_type === 'info' ? 'Ex: Sobre suas refeições habituais' : 'Digite a pergunta...'}
                rows={2}
              />
            </div>

            {questionData.question_type === 'info' && (
              <>
                <div className="space-y-2">
                  <Label>Texto explicativo *</Label>
                  <Textarea
                    value={questionData.info_body}
                    onChange={(e) => setQuestionData({ ...questionData, info_body: e.target.value })}
                    placeholder="Explique como o próximo bloco deve ser respondido. Este texto aparece antes das próximas perguntas e o paciente clica em 'Vamos lá' para prosseguir."
                    rows={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Texto do botão</Label>
                  <Input
                    value={questionData.info_button_label}
                    onChange={(e) => setQuestionData({ ...questionData, info_button_label: e.target.value })}
                    placeholder="Vamos lá"
                  />
                </div>
              </>
            )}


            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Resposta</Label>
                <Select
                  value={questionData.question_type}
                  onValueChange={(value) => setQuestionData({ ...questionData, question_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {questionTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Seção</Label>
                <Input
                  value={questionData.section}
                  onChange={(e) => setQuestionData({ ...questionData, section: e.target.value })}
                  placeholder="Ex: Dados Pessoais, Histórico..."
                />
              </div>
            </div>

            {/* Options for select/multiselect */}
            {['select', 'multiselect'].includes(questionData.question_type) && (
              <div className="space-y-2">
                <Label>Opções</Label>
                <div className="flex gap-2">
                  <Input
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    placeholder="Nova opção..."
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddOption())}
                  />
                  <Button type="button" onClick={handleAddOption} size="sm">
                    Adicionar
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {questionData.options.map((option, index) => (
                    <Badge key={index} variant="secondary" className="gap-1">
                      {option}
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(index)}
                        className="ml-1 hover:text-destructive"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Scale settings */}
            {questionData.question_type === 'scale' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor Mínimo</Label>
                  <Input
                    type="number"
                    value={questionData.scale_min}
                    onChange={(e) => setQuestionData({ ...questionData, scale_min: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor Máximo</Label>
                  <Input
                    type="number"
                    value={questionData.scale_max}
                    onChange={(e) => setQuestionData({ ...questionData, scale_max: Number(e.target.value) })}
                  />
                </div>
              </div>
            )}

            {questionData.question_type !== 'info' && (
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_required"
                    checked={questionData.is_required}
                    onCheckedChange={(checked) => setQuestionData({ ...questionData, is_required: checked })}
                  />
                  <Label htmlFor="is_required">Obrigatória</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="has_comment"
                    checked={questionData.has_comment_field}
                    onCheckedChange={(checked) => setQuestionData({ ...questionData, has_comment_field: checked })}
                  />
                  <Label htmlFor="has_comment">Campo de comentário</Label>
                </div>
              </div>
            )}

            {questionData.question_type !== 'info' && questionData.has_comment_field && (
              <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                <div className="space-y-2">
                  <Label>Label do comentário</Label>
                  <Input
                    value={questionData.comment_field_label}
                    onChange={(e) => setQuestionData({ ...questionData, comment_field_label: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="comment_required"
                    checked={questionData.comment_field_required}
                    onCheckedChange={(checked) => setQuestionData({ ...questionData, comment_field_required: checked })}
                  />
                  <Label htmlFor="comment_required">Comentário obrigatório</Label>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuestionDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveQuestion} disabled={addQuestion.isPending || updateQuestion.isPending}>
              {(addQuestion.isPending || updateQuestion.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingQuestion ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurações do Formulário</DialogTitle>
            <DialogDescription>
              Configure os detalhes do formulário de anamnese
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={formSettings.title}
                onChange={(e) => setFormSettings({ ...formSettings, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formSettings.description}
                onChange={(e) => setFormSettings({ ...formSettings, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="is_active"
                  checked={formSettings.is_active}
                  onCheckedChange={(checked) => setFormSettings({ ...formSettings, is_active: checked })}
                />
                <Label htmlFor="is_active">Ativo</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="is_required_form"
                  checked={formSettings.is_required}
                  onCheckedChange={(checked) => setFormSettings({ ...formSettings, is_required: checked })}
                />
                <Label htmlFor="is_required_form">Obrigatório para novos clientes</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveSettings} disabled={updateForm.isPending}>
              {updateForm.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bank Import Dialog */}
      <Dialog open={showBankDialog} onOpenChange={setShowBankDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Importar do Banco de Perguntas</DialogTitle>
            <DialogDescription>
              Selecione as perguntas que deseja adicionar ao formulário
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[400px] pr-4">
            {isLoadingTemplates ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : questionTemplates.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma pergunta disponível no banco.
              </p>
            ) : (
              <div className="space-y-3">
                {questionTemplates.map(template => (
                  <Card
                    key={template.id}
                    className={`cursor-pointer transition-colors ${
                      selectedTemplates.includes(template.id)
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-muted-foreground/50'
                    }`}
                    onClick={() => toggleTemplateSelection(template.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedTemplates.includes(template.id)}
                          onCheckedChange={() => toggleTemplateSelection(template.id)}
                        />
                        <div className="flex-1">
                          <p className="font-medium">{template.question_text}</p>
                          <div className="flex gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {template.question_type}
                            </Badge>
                            {template.category && (
                              <Badge variant="secondary" className="text-xs">
                                {QUESTION_CATEGORIES.find(c => c.value === template.category)?.label}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>

          <DialogFooter>
            <div className="flex items-center justify-between w-full">
              <span className="text-sm text-muted-foreground">
                {selectedTemplates.length} pergunta(s) selecionada(s)
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowBankDialog(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleImportFromBank}
                  disabled={selectedTemplates.length === 0 || addQuestion.isPending}
                >
                  {addQuestion.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Importar Selecionadas
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
