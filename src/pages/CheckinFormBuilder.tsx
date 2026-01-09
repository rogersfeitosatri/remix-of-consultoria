import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ArrowLeft, Plus, GripVertical, Trash2, Copy, ExternalLink, Eye, FileText, X, Edit } from 'lucide-react';
import { useCheckinFormWithQuestions, useUpdateCheckinForm, useAddCheckinQuestion, useUpdateCheckinQuestion, useDeleteCheckinQuestion, useCheckinFormResponses, type QuestionType } from '@/hooks/useCheckinForms';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const questionTypeLabels: Record<QuestionType, string> = {
  short_text: 'Texto Curto',
  long_text: 'Texto Longo',
  multiple_choice: 'Múltipla Escolha',
  checkbox: 'Caixas de Seleção',
  scale: 'Escala Numérica',
};

export default function CheckinFormBuilder() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useCheckinFormWithQuestions(formId);
  const { data: responses = [] } = useCheckinFormResponses(formId);
  const updateForm = useUpdateCheckinForm();
  const addQuestion = useAddCheckinQuestion();
  const updateQuestion = useUpdateCheckinQuestion();
  const deleteQuestion = useDeleteCheckinQuestion();

  const [isAddQuestionOpen, setIsAddQuestionOpen] = useState(false);
  const [newQuestion, setNewQuestion] = useState({
    question_text: '',
    question_type: 'short_text' as QuestionType,
    options: [''],
    scale_min: 1,
    scale_max: 10,
    is_required: false,
    has_comment_field: false,
    comment_field_label: 'Se quiser explicar melhor, comente aqui',
    comment_field_required: false,
    comment_field_type: 'short' as 'short' | 'medium',
  });

  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  
  const [isEditQuestionOpen, setIsEditQuestionOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<{
    id: string;
    question_text: string;
    question_type: QuestionType;
    options: string[];
    scale_min: number;
    scale_max: number;
    is_required: boolean;
    has_comment_field: boolean;
    comment_field_label: string;
    comment_field_required: boolean;
    comment_field_type: 'short' | 'medium';
  } | null>(null);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Formulário não encontrado</p>
          <Button variant="link" onClick={() => navigate('/checkin')}>
            Voltar para Checkin
          </Button>
        </div>
      </Layout>
    );
  }

  const { form, questions } = data;

  const handleUpdateTitle = async () => {
    if (!editTitle.trim()) return;
    try {
      await updateForm.mutateAsync({ id: form.id, title: editTitle });
      setEditingTitle(false);
      toast.success('Título atualizado!');
    } catch (error) {
      toast.error('Erro ao atualizar título');
    }
  };

  const handleAddQuestion = async () => {
    if (!newQuestion.question_text.trim()) {
      toast.error('Texto da pergunta é obrigatório');
      return;
    }

    const questionData = {
      form_id: form.id,
      question_text: newQuestion.question_text,
      question_type: newQuestion.question_type,
      options: ['multiple_choice', 'checkbox'].includes(newQuestion.question_type)
        ? newQuestion.options.filter(o => o.trim())
        : null,
      scale_min: newQuestion.scale_min,
      scale_max: newQuestion.scale_max,
      is_required: newQuestion.is_required,
      order_index: questions.length,
      has_comment_field: ['multiple_choice', 'checkbox', 'scale'].includes(newQuestion.question_type) 
        ? newQuestion.has_comment_field 
        : false,
      comment_field_label: newQuestion.has_comment_field ? newQuestion.comment_field_label : null,
      comment_field_required: newQuestion.has_comment_field ? newQuestion.comment_field_required : false,
      comment_field_type: newQuestion.has_comment_field ? newQuestion.comment_field_type : null,
    };

    try {
      await addQuestion.mutateAsync(questionData);
      toast.success('Pergunta adicionada!');
      setIsAddQuestionOpen(false);
      setNewQuestion({
        question_text: '',
        question_type: 'short_text',
        options: [''],
        scale_min: 1,
        scale_max: 10,
        is_required: false,
        has_comment_field: false,
        comment_field_label: 'Se quiser explicar melhor, comente aqui',
        comment_field_required: false,
        comment_field_type: 'short',
      });
    } catch (error) {
      toast.error('Erro ao adicionar pergunta');
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    try {
      await deleteQuestion.mutateAsync({ id: questionId, formId: form.id });
      toast.success('Pergunta removida!');
    } catch (error) {
      toast.error('Erro ao remover pergunta');
    }
  };

  const handleToggleRequired = async (questionId: string, currentRequired: boolean) => {
    try {
      await updateQuestion.mutateAsync({
        id: questionId,
        form_id: form.id,
        is_required: !currentRequired,
      });
    } catch (error) {
      toast.error('Erro ao atualizar pergunta');
    }
  };

  const copyFormLink = () => {
    const link = `${window.location.origin}/form/${form.id}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copiado!');
  };

  const addOption = () => {
    setNewQuestion(prev => ({
      ...prev,
      options: [...prev.options, ''],
    }));
  };

  const updateOption = (index: number, value: string) => {
    setNewQuestion(prev => ({
      ...prev,
      options: prev.options.map((o, i) => (i === index ? value : o)),
    }));
  };

  const removeOption = (index: number) => {
    setNewQuestion(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }));
  };

  const openEditQuestion = (question: any) => {
    setEditingQuestion({
      id: question.id,
      question_text: question.question_text,
      question_type: question.question_type,
      options: question.options || [''],
      scale_min: question.scale_min || 1,
      scale_max: question.scale_max || 10,
      is_required: question.is_required,
      has_comment_field: question.has_comment_field || false,
      comment_field_label: question.comment_field_label || 'Se quiser explicar melhor, comente aqui',
      comment_field_required: question.comment_field_required || false,
      comment_field_type: question.comment_field_type || 'short',
    });
    setIsEditQuestionOpen(true);
  };

  const handleUpdateQuestionFull = async () => {
    if (!editingQuestion) return;
    if (!editingQuestion.question_text.trim()) {
      toast.error('Texto da pergunta é obrigatório');
      return;
    }

    try {
      await updateQuestion.mutateAsync({
        id: editingQuestion.id,
        form_id: form.id,
        question_text: editingQuestion.question_text,
        question_type: editingQuestion.question_type,
        options: ['multiple_choice', 'checkbox'].includes(editingQuestion.question_type)
          ? editingQuestion.options.filter(o => o.trim())
          : null,
        scale_min: editingQuestion.scale_min,
        scale_max: editingQuestion.scale_max,
        is_required: editingQuestion.is_required,
        has_comment_field: ['multiple_choice', 'checkbox', 'scale'].includes(editingQuestion.question_type) 
          ? editingQuestion.has_comment_field 
          : false,
        comment_field_label: editingQuestion.has_comment_field ? editingQuestion.comment_field_label : null,
        comment_field_required: editingQuestion.has_comment_field ? editingQuestion.comment_field_required : false,
        comment_field_type: editingQuestion.has_comment_field ? editingQuestion.comment_field_type : null,
      });
      toast.success('Pergunta atualizada!');
      setIsEditQuestionOpen(false);
      setEditingQuestion(null);
    } catch (error) {
      toast.error('Erro ao atualizar pergunta');
    }
  };

  const addEditOption = () => {
    if (!editingQuestion) return;
    setEditingQuestion(prev => prev ? ({
      ...prev,
      options: [...prev.options, ''],
    }) : null);
  };

  const updateEditOption = (index: number, value: string) => {
    if (!editingQuestion) return;
    setEditingQuestion(prev => prev ? ({
      ...prev,
      options: prev.options.map((o, i) => (i === index ? value : o)),
    }) : null);
  };

  const removeEditOption = (index: number) => {
    if (!editingQuestion) return;
    setEditingQuestion(prev => prev ? ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }) : null);
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/checkin')} className="gap-2 w-fit">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>

          <div className="flex-1 flex items-center gap-3">
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="max-w-xs"
                  autoFocus
                />
                <Button size="sm" onClick={handleUpdateTitle}>Salvar</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingTitle(false)}>Cancelar</Button>
              </div>
            ) : (
              <h1
                className="text-2xl font-bold cursor-pointer hover:text-primary transition-colors"
                onClick={() => {
                  setEditTitle(form.title);
                  setEditingTitle(true);
                }}
              >
                {form.title}
              </h1>
            )}
            <Badge variant={form.is_active ? 'default' : 'secondary'}>
              {form.is_active ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1" onClick={copyFormLink}>
              <Copy className="h-3 w-3" />
              Copiar Link
            </Button>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => window.open(`/form/${form.id}`, '_blank')}>
              <ExternalLink className="h-3 w-3" />
              Visualizar
            </Button>
          </div>
        </div>

        <Tabs defaultValue="questions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="questions" className="gap-2">
              <FileText className="h-4 w-4" />
              Perguntas ({questions.length})
            </TabsTrigger>
            <TabsTrigger value="responses" className="gap-2">
              <Eye className="h-4 w-4" />
              Respostas ({responses.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="questions" className="space-y-4">
            {/* Questions List */}
            {questions.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhuma pergunta ainda</h3>
                  <p className="text-muted-foreground mb-4">
                    Adicione perguntas ao seu formulário
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {questions.map((question, index) => (
                  <Card key={question.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <GripVertical className="h-5 w-5" />
                          <span className="font-medium">{index + 1}.</span>
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="font-medium">{question.question_text}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {questionTypeLabels[question.question_type]}
                                </Badge>
                                {question.is_required && (
                                  <Badge variant="secondary" className="text-xs">Obrigatória</Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-2">
                                <Label htmlFor={`required-${question.id}`} className="text-xs text-muted-foreground">
                                  Obrigatória
                                </Label>
                                <Switch
                                  id={`required-${question.id}`}
                                  checked={question.is_required}
                                  onCheckedChange={() => handleToggleRequired(question.id, question.is_required)}
                                />
                              </div>
                              <Button variant="ghost" size="sm" onClick={() => openEditQuestion(question)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir Pergunta?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteQuestion(question.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                          {question.question_type === 'scale' && (
                            <p className="text-sm text-muted-foreground">
                              Escala: {question.scale_min} a {question.scale_max}
                            </p>
                          )}
                          {question.options && question.options.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {(question.options as string[]).map((option, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {option}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {question.has_comment_field && (
                            <div className="mt-2 p-2 bg-muted/50 rounded-md">
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <span className="font-medium">Campo anexo:</span>
                                {question.comment_field_label}
                                {question.comment_field_required && (
                                  <Badge variant="secondary" className="text-xs ml-1">Obrigatório</Badge>
                                )}
                                <Badge variant="outline" className="text-xs ml-1">
                                  {question.comment_field_type === 'short' ? 'Texto curto' : 'Texto médio'}
                                </Badge>
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Add Question Button */}
            <Dialog open={isAddQuestionOpen} onOpenChange={setIsAddQuestionOpen}>
              <DialogTrigger asChild>
                <Button className="w-full gap-2" variant="outline">
                  <Plus className="h-4 w-4" />
                  Adicionar Pergunta
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Nova Pergunta</DialogTitle>
                  <DialogDescription>
                    Configure os detalhes da pergunta
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Texto da Pergunta</Label>
                    <Textarea
                      value={newQuestion.question_text}
                      onChange={(e) => setNewQuestion(prev => ({ ...prev, question_text: e.target.value }))}
                      placeholder="Digite sua pergunta..."
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo de Resposta</Label>
                    <Select
                      value={newQuestion.question_type}
                      onValueChange={(value: QuestionType) => setNewQuestion(prev => ({ ...prev, question_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="short_text">Texto Curto</SelectItem>
                        <SelectItem value="long_text">Texto Longo</SelectItem>
                        <SelectItem value="multiple_choice">Múltipla Escolha (única)</SelectItem>
                        <SelectItem value="checkbox">Caixas de Seleção (múltiplas)</SelectItem>
                        <SelectItem value="scale">Escala Numérica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {['multiple_choice', 'checkbox'].includes(newQuestion.question_type) && (
                    <div className="space-y-2">
                      <Label>Opções</Label>
                      <div className="space-y-2">
                        {newQuestion.options.map((option, index) => (
                          <div key={index} className="flex gap-2">
                            <Input
                              value={option}
                              onChange={(e) => updateOption(index, e.target.value)}
                              placeholder={`Opção ${index + 1}`}
                            />
                            {newQuestion.options.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeOption(index)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button type="button" variant="outline" size="sm" onClick={addOption} className="w-full">
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar Opção
                        </Button>
                      </div>
                    </div>
                  )}

                  {newQuestion.question_type === 'scale' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Valor Mínimo</Label>
                        <Input
                          type="number"
                          value={newQuestion.scale_min}
                          onChange={(e) => setNewQuestion(prev => ({ ...prev, scale_min: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Valor Máximo</Label>
                        <Input
                          type="number"
                          value={newQuestion.scale_max}
                          onChange={(e) => setNewQuestion(prev => ({ ...prev, scale_max: parseInt(e.target.value) || 10 }))}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Switch
                      id="required"
                      checked={newQuestion.is_required}
                      onCheckedChange={(checked) => setNewQuestion(prev => ({ ...prev, is_required: checked }))}
                    />
                    <Label htmlFor="required">Pergunta obrigatória</Label>
                  </div>

                  {/* Comment attachment field configuration */}
                  {['multiple_choice', 'checkbox', 'scale'].includes(newQuestion.question_type) && (
                    <div className="space-y-4 border-t pt-4 mt-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="has_comment_field"
                          checked={newQuestion.has_comment_field}
                          onCheckedChange={(checked) => setNewQuestion(prev => ({ ...prev, has_comment_field: checked }))}
                        />
                        <Label htmlFor="has_comment_field">Adicionar campo anexo de comentário</Label>
                      </div>

                      {newQuestion.has_comment_field && (
                        <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                          <div className="space-y-2">
                            <Label>Título do campo</Label>
                            <Input
                              value={newQuestion.comment_field_label}
                              onChange={(e) => setNewQuestion(prev => ({ ...prev, comment_field_label: e.target.value }))}
                              placeholder="Se quiser explicar melhor, comente aqui"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Tipo de resposta</Label>
                            <Select
                              value={newQuestion.comment_field_type}
                              onValueChange={(value: 'short' | 'medium') => setNewQuestion(prev => ({ ...prev, comment_field_type: value }))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="short">Texto curto (1 linha)</SelectItem>
                                <SelectItem value="medium">Texto médio (3 linhas)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex items-center gap-2">
                            <Switch
                              id="comment_field_required"
                              checked={newQuestion.comment_field_required}
                              onCheckedChange={(checked) => setNewQuestion(prev => ({ ...prev, comment_field_required: checked }))}
                            />
                            <Label htmlFor="comment_field_required">Campo de comentário obrigatório</Label>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddQuestionOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleAddQuestion} disabled={addQuestion.isPending}>
                    Adicionar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Edit Question Dialog */}
            <Dialog open={isEditQuestionOpen} onOpenChange={setIsEditQuestionOpen}>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Editar Pergunta</DialogTitle>
                  <DialogDescription>
                    Altere os detalhes da pergunta
                  </DialogDescription>
                </DialogHeader>
                {editingQuestion && (
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Texto da Pergunta</Label>
                      <Textarea
                        value={editingQuestion.question_text}
                        onChange={(e) => setEditingQuestion(prev => prev ? ({ ...prev, question_text: e.target.value }) : null)}
                        placeholder="Digite sua pergunta..."
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Tipo de Resposta</Label>
                      <Select
                        value={editingQuestion.question_type}
                        onValueChange={(value: QuestionType) => setEditingQuestion(prev => prev ? ({ ...prev, question_type: value }) : null)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="short_text">Texto Curto</SelectItem>
                          <SelectItem value="long_text">Texto Longo</SelectItem>
                          <SelectItem value="multiple_choice">Múltipla Escolha (única)</SelectItem>
                          <SelectItem value="checkbox">Caixas de Seleção (múltiplas)</SelectItem>
                          <SelectItem value="scale">Escala Numérica</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {['multiple_choice', 'checkbox'].includes(editingQuestion.question_type) && (
                      <div className="space-y-2">
                        <Label>Opções</Label>
                        <div className="space-y-2">
                          {editingQuestion.options.map((option, index) => (
                            <div key={index} className="flex gap-2">
                              <Input
                                value={option}
                                onChange={(e) => updateEditOption(index, e.target.value)}
                                placeholder={`Opção ${index + 1}`}
                              />
                              {editingQuestion.options.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeEditOption(index)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                          <Button type="button" variant="outline" size="sm" onClick={addEditOption} className="w-full">
                            <Plus className="h-4 w-4 mr-2" />
                            Adicionar Opção
                          </Button>
                        </div>
                      </div>
                    )}

                    {editingQuestion.question_type === 'scale' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Valor Mínimo</Label>
                          <Input
                            type="number"
                            value={editingQuestion.scale_min}
                            onChange={(e) => setEditingQuestion(prev => prev ? ({ ...prev, scale_min: parseInt(e.target.value) || 0 }) : null)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Valor Máximo</Label>
                          <Input
                            type="number"
                            value={editingQuestion.scale_max}
                            onChange={(e) => setEditingQuestion(prev => prev ? ({ ...prev, scale_max: parseInt(e.target.value) || 10 }) : null)}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Switch
                        id="edit_required"
                        checked={editingQuestion.is_required}
                        onCheckedChange={(checked) => setEditingQuestion(prev => prev ? ({ ...prev, is_required: checked }) : null)}
                      />
                      <Label htmlFor="edit_required">Pergunta obrigatória</Label>
                    </div>

                    {['multiple_choice', 'checkbox', 'scale'].includes(editingQuestion.question_type) && (
                      <div className="space-y-4 border-t pt-4 mt-4">
                        <div className="flex items-center gap-2">
                          <Switch
                            id="edit_has_comment_field"
                            checked={editingQuestion.has_comment_field}
                            onCheckedChange={(checked) => setEditingQuestion(prev => prev ? ({ ...prev, has_comment_field: checked }) : null)}
                          />
                          <Label htmlFor="edit_has_comment_field">Adicionar campo anexo de comentário</Label>
                        </div>

                        {editingQuestion.has_comment_field && (
                          <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                            <div className="space-y-2">
                              <Label>Título do campo</Label>
                              <Input
                                value={editingQuestion.comment_field_label}
                                onChange={(e) => setEditingQuestion(prev => prev ? ({ ...prev, comment_field_label: e.target.value }) : null)}
                                placeholder="Se quiser explicar melhor, comente aqui"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Tipo de resposta</Label>
                              <Select
                                value={editingQuestion.comment_field_type}
                                onValueChange={(value: 'short' | 'medium') => setEditingQuestion(prev => prev ? ({ ...prev, comment_field_type: value }) : null)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="short">Texto curto (1 linha)</SelectItem>
                                  <SelectItem value="medium">Texto médio (3 linhas)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="flex items-center gap-2">
                              <Switch
                                id="edit_comment_field_required"
                                checked={editingQuestion.comment_field_required}
                                onCheckedChange={(checked) => setEditingQuestion(prev => prev ? ({ ...prev, comment_field_required: checked }) : null)}
                              />
                              <Label htmlFor="edit_comment_field_required">Campo de comentário obrigatório</Label>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setIsEditQuestionOpen(false); setEditingQuestion(null); }}>
                    Cancelar
                  </Button>
                  <Button onClick={handleUpdateQuestionFull} disabled={updateQuestion.isPending}>
                    Salvar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="responses" className="space-y-4">
            {responses.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Eye className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhuma resposta ainda</h3>
                  <p className="text-muted-foreground">
                    Quando atletas preencherem o formulário, as respostas aparecerão aqui
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {responses.map((response: any) => (
                  <Card key={response.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base">{response.clients?.name || 'Atleta'}</CardTitle>
                          <p className="text-sm text-muted-foreground">{response.clients?.email}</p>
                        </div>
                        <Badge variant="outline">
                          {format(new Date(response.submitted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {questions.map((question) => {
                          const responseData = response.responses[question.id];
                          // Handle both old format (direct value) and new format (object with answer/comment)
                          const answer = responseData?.answer !== undefined ? responseData.answer : responseData;
                          const comment = responseData?.comment;
                          return (
                            <div key={question.id} className="border-l-2 border-primary/20 pl-3">
                              <p className="text-sm font-medium text-muted-foreground">{question.question_text}</p>
                              <p className="text-sm mt-1">
                                {Array.isArray(answer) ? answer.join(', ') : answer || '-'}
                              </p>
                              {comment && (
                                <div className="mt-1 pl-2 border-l border-muted text-xs text-muted-foreground italic">
                                  <span className="font-medium">{question.comment_field_label || 'Comentário'}:</span>{' '}
                                  {comment}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
