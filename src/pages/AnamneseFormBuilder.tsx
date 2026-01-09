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
import { ArrowLeft, Plus, Trash2, GripVertical, Save, Eye, Copy, Settings, Library, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useAnamneseFormWithQuestions,
  useUpdateAnamneseForm,
  useAddAnamneseQuestion,
  useUpdateAnamneseQuestion,
  useDeleteAnamneseQuestion,
  AnamneseQuestion,
} from '@/hooks/useAnamneseForms';
import { useQuestionTemplates, QUESTION_CATEGORIES, type QuestionTemplate } from '@/hooks/useQuestionBank';

const questionTypes = [
  { value: 'text', label: 'Texto Curto' },
  { value: 'textarea', label: 'Texto Longo' },
  { value: 'number', label: 'Número' },
  { value: 'select', label: 'Seleção Única' },
  { value: 'multiselect', label: 'Múltipla Escolha' },
  { value: 'scale', label: 'Escala (1-10)' },
  { value: 'boolean', label: 'Sim/Não' },
  { value: 'date', label: 'Data' },
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
  });
  const [newOption, setNewOption] = useState('');
  const [formSettings, setFormSettings] = useState({
    title: '',
    description: '',
    is_active: true,
    is_required: true,
  });

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
        comment_field_required: question.comment_field_required,
        comment_field_label: question.comment_field_label || 'Comentário adicional',
        options: question.options || [],
        scale_min: question.scale_min || 1,
        scale_max: question.scale_max || 10,
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
      const payload = {
        question_text: questionData.question_text,
        question_type: questionData.question_type,
        section: questionData.section,
        is_required: questionData.is_required,
        has_comment_field: questionData.has_comment_field,
        comment_field_required: questionData.comment_field_required,
        comment_field_label: questionData.comment_field_label,
        options: ['select', 'multiselect'].includes(questionData.question_type) ? questionData.options : null,
        scale_min: questionData.question_type === 'scale' ? questionData.scale_min : null,
        scale_max: questionData.question_type === 'scale' ? questionData.scale_max : null,
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

        // Map question types
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

  const questions = formData.questions || [];
  const sections = [...new Set(questions.map(q => q.section))];

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
        {questions.length === 0 ? (
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
          <div className="space-y-6">
            {sections.map(section => (
              <div key={section}>
                <h3 className="text-lg font-semibold mb-3 text-primary">{section}</h3>
                <div className="space-y-3">
                  {questions
                    .filter(q => q.section === section)
                    .sort((a, b) => a.order_index - b.order_index)
                    .map((question, index) => (
                      <Card key={question.id} className="hover:border-primary/50 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-1 text-muted-foreground">
                              <GripVertical className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="font-medium">{question.question_text}</p>
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    <Badge variant="outline">
                                      {questionTypes.find(t => t.value === question.question_type)?.label}
                                    </Badge>
                                    {question.is_required && (
                                      <Badge variant="secondary">Obrigatória</Badge>
                                    )}
                                    {question.has_comment_field && (
                                      <Badge variant="secondary">Com comentário</Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleOpenQuestionDialog(question)}
                                  >
                                    <Settings className="h-4 w-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon" className="text-destructive">
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Excluir pergunta?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Esta ação não pode ser desfeita.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteQuestion(question.id)}>
                                          Excluir
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </div>
            ))}
          </div>
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
              <Label>Pergunta *</Label>
              <Textarea
                value={questionData.question_text}
                onChange={(e) => setQuestionData({ ...questionData, question_text: e.target.value })}
                placeholder="Digite a pergunta..."
                rows={2}
              />
            </div>

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

            {/* Scale options */}
            {questionData.question_type === 'scale' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor Mínimo</Label>
                  <Input
                    type="number"
                    value={questionData.scale_min}
                    onChange={(e) => setQuestionData({ ...questionData, scale_min: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor Máximo</Label>
                  <Input
                    type="number"
                    value={questionData.scale_max}
                    onChange={(e) => setQuestionData({ ...questionData, scale_max: parseInt(e.target.value) })}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label>Resposta Obrigatória</Label>
              <Switch
                checked={questionData.is_required}
                onCheckedChange={(checked) => setQuestionData({ ...questionData, is_required: checked })}
              />
            </div>

            <div className="space-y-3 p-4 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between">
                <Label>Campo de Comentário Adicional</Label>
                <Switch
                  checked={questionData.has_comment_field}
                  onCheckedChange={(checked) => setQuestionData({ ...questionData, has_comment_field: checked })}
                />
              </div>

              {questionData.has_comment_field && (
                <>
                  <div className="space-y-2">
                    <Label>Rótulo do Campo</Label>
                    <Input
                      value={questionData.comment_field_label}
                      onChange={(e) => setQuestionData({ ...questionData, comment_field_label: e.target.value })}
                      placeholder="Ex: Explique melhor..."
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Comentário Obrigatório</Label>
                    <Switch
                      checked={questionData.comment_field_required}
                      onCheckedChange={(checked) => setQuestionData({ ...questionData, comment_field_required: checked })}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuestionDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveQuestion} disabled={addQuestion.isPending || updateQuestion.isPending}>
              {editingQuestion ? 'Salvar Alterações' : 'Adicionar Pergunta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurações do Formulário</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Título</Label>
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

            <div className="flex items-center justify-between">
              <Label>Formulário Ativo</Label>
              <Switch
                checked={formSettings.is_active}
                onCheckedChange={(checked) => setFormSettings({ ...formSettings, is_active: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Obrigatório para Novos Atletas</Label>
              <Switch
                checked={formSettings.is_required}
                onCheckedChange={(checked) => setFormSettings({ ...formSettings, is_required: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveSettings} disabled={updateForm.isPending}>
              Salvar Configurações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import from Bank Dialog */}
      <Dialog open={showBankDialog} onOpenChange={setShowBankDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Library className="h-5 w-5" />
              Importar do Banco de Perguntas
            </DialogTitle>
            <DialogDescription>
              Selecione as perguntas que deseja adicionar ao formulário. As perguntas serão copiadas e a exclusão do formulário não afeta o banco.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[400px] pr-4">
            {isLoadingTemplates ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : questionTemplates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Library className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>Nenhuma pergunta no banco de perguntas.</p>
                <p className="text-sm mt-1">Acesse o Banco de Perguntas para criar perguntas reutilizáveis.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {QUESTION_CATEGORIES.map(cat => {
                  const catTemplates = questionTemplates.filter(t => t.category === cat.value);
                  if (catTemplates.length === 0) return null;
                  
                  return (
                    <div key={cat.value} className="space-y-2">
                      <h4 className="font-medium text-sm text-muted-foreground">{cat.label}</h4>
                      {catTemplates.map(template => (
                        <div
                          key={template.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedTemplates.includes(template.id) 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => toggleTemplateSelection(template.id)}
                        >
                          <Checkbox
                            checked={selectedTemplates.includes(template.id)}
                            onCheckedChange={() => toggleTemplateSelection(template.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{template.question_text}</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {template.question_type}
                              </Badge>
                              {template.is_required && (
                                <Badge variant="secondary" className="text-xs">Obrigatória</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="flex items-center justify-between">
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
