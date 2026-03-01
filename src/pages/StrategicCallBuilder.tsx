import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useStrategicCall, useStrategicCallQuestions, useUpdateStrategicCall, useSaveStrategicCallQuestions, type StrategicCallQuestion } from '@/hooks/useStrategicCalls';
import { ArrowLeft, Plus, Trash2, GripVertical, Loader2, Eye, Save } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const QUESTION_TYPES = [
  { value: 'short_text', label: 'Texto curto' },
  { value: 'long_text', label: 'Texto longo' },
  { value: 'multiple_choice', label: 'Múltipla escolha' },
  { value: 'single_choice', label: 'Seleção única' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Data' },
  { value: 'phone', label: 'Telefone' },
  { value: 'email', label: 'Email' },
];

interface QuestionDraft {
  tempId: string;
  question_text: string;
  question_type: string;
  field_name: string;
  is_required: boolean;
  options: string[];
  score_map: Record<string, number>;
  order_index: number;
}

export default function StrategicCallBuilder() {
  const { callId } = useParams<{ callId: string }>();
  const navigate = useNavigate();
  const { data: call, isLoading } = useStrategicCall(callId);
  const { data: savedQuestions = [] } = useStrategicCallQuestions(callId);
  const updateCall = useUpdateStrategicCall();
  const saveQuestions = useSaveStrategicCallQuestions();

  // Page settings state
  const [pageTitle, setPageTitle] = useState('');
  const [pageText, setPageText] = useState('');
  const [buttonText, setButtonText] = useState('');
  const [buttonColor, setButtonColor] = useState('#10b981');
  const [whatsappMsg, setWhatsappMsg] = useState('');
  const [status, setStatus] = useState('active');
  const [closingDate, setClosingDate] = useState('');

  // Questions state
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);

  useEffect(() => {
    if (call) {
      setPageTitle(call.page_title || '');
      setPageText(call.page_text || '');
      setButtonText(call.button_text || '');
      setButtonColor(call.button_color || '#10b981');
      setWhatsappMsg(call.whatsapp_message || '');
      setStatus(call.status);
      setClosingDate(call.closing_date ? call.closing_date.split('T')[0] : '');
    }
  }, [call]);

  useEffect(() => {
    if (savedQuestions.length > 0) {
      setQuestions(savedQuestions.map(q => ({
        tempId: q.id,
        question_text: q.question_text,
        question_type: q.question_type,
        field_name: q.field_name || '',
        is_required: q.is_required,
        options: Array.isArray(q.options) ? q.options : [],
        score_map: q.score_map || {},
        order_index: q.order_index,
      })));
    }
  }, [savedQuestions]);

  const addQuestion = () => {
    setQuestions(prev => [...prev, {
      tempId: crypto.randomUUID(),
      question_text: '',
      question_type: 'short_text',
      field_name: '',
      is_required: true,
      options: [],
      score_map: {},
      order_index: prev.length,
    }]);
  };

  const updateQuestion = (idx: number, updates: Partial<QuestionDraft>) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, ...updates } : q));
  };

  const removeQuestion = (idx: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== idx).map((q, i) => ({ ...q, order_index: i })));
  };

  const moveQuestion = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= questions.length) return;
    const copy = [...questions];
    [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
    setQuestions(copy.map((q, i) => ({ ...q, order_index: i })));
  };

  const handleSavePage = () => {
    if (!callId) return;
    updateCall.mutate({
      id: callId,
      page_title: pageTitle,
      page_text: pageText,
      button_text: buttonText,
      button_color: buttonColor,
      whatsapp_message: whatsappMsg,
      status,
      closing_date: closingDate || null,
    });
  };

  const handleSaveQuestions = () => {
    if (!callId) return;
    saveQuestions.mutate({
      callId,
      questions: questions.map(q => ({
        call_id: callId,
        question_text: q.question_text,
        question_type: q.question_type,
        field_name: q.field_name || null,
        is_required: q.is_required,
        options: q.options.length > 0 ? q.options : null,
        score_map: Object.keys(q.score_map).length > 0 ? q.score_map : null,
        order_index: q.order_index,
      })),
    });
  };

  if (isLoading) {
    return <Layout><div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></Layout>;
  }

  if (!call) {
    return <Layout><p className="text-center text-muted-foreground py-12">Call não encontrada.</p></Layout>;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/calls')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">{call.name}</h1>
            <p className="text-sm text-muted-foreground">/{call.slug}</p>
          </div>
          <Button variant="outline" onClick={() => window.open(`/call/${call.slug}`, '_blank')} className="gap-2">
            <Eye className="h-4 w-4" /> Visualizar como atleta
          </Button>
        </div>

        <Tabs defaultValue="page">
          <TabsList>
            <TabsTrigger value="page">Página & Config</TabsTrigger>
            <TabsTrigger value="questions">Perguntas ({questions.length})</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          </TabsList>

          <TabsContent value="page" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Configurações Gerais</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="inactive">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Data de Encerramento (opcional)</Label>
                    <Input type="date" value={closingDate} onChange={e => setClosingDate(e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Texto da Página Pública</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Título</Label>
                  <Input value={pageTitle} onChange={e => setPageTitle(e.target.value)} />
                </div>
                <div>
                  <Label>Texto Principal</Label>
                  <Textarea value={pageText} onChange={e => setPageText(e.target.value)} rows={12} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Texto do Botão</Label>
                    <Input value={buttonText} onChange={e => setButtonText(e.target.value)} />
                  </div>
                  <div>
                    <Label>Cor do Botão</Label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={buttonColor} onChange={e => setButtonColor(e.target.value)} className="h-10 w-14 rounded cursor-pointer" />
                      <Input value={buttonColor} onChange={e => setButtonColor(e.target.value)} className="flex-1" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button onClick={handleSavePage} disabled={updateCall.isPending} className="gap-2">
              <Save className="h-4 w-4" /> {updateCall.isPending ? 'Salvando...' : 'Salvar Página'}
            </Button>
          </TabsContent>

          <TabsContent value="questions" className="space-y-4">
            {questions.map((q, idx) => (
              <Card key={q.tempId}>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    <Badge variant="outline">{idx + 1}</Badge>
                    <Select value={q.question_type} onValueChange={v => updateQuestion(idx, { question_type: v })}>
                      <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {QUESTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1 ml-auto">
                      <Label className="text-xs">Obrigatório</Label>
                      <Switch checked={q.is_required} onCheckedChange={v => updateQuestion(idx, { is_required: v })} />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => moveQuestion(idx, -1)} disabled={idx === 0}>↑</Button>
                    <Button variant="ghost" size="icon" onClick={() => moveQuestion(idx, 1)} disabled={idx === questions.length - 1}>↓</Button>
                    <Button variant="ghost" size="icon" onClick={() => removeQuestion(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Rótulo visível</Label>
                      <Input value={q.question_text} onChange={e => updateQuestion(idx, { question_text: e.target.value })} placeholder="Qual sua experiência com corrida?" />
                    </div>
                    <div>
                      <Label>Nome interno</Label>
                      <Input value={q.field_name} onChange={e => updateQuestion(idx, { field_name: e.target.value })} placeholder="experiencia_corrida" />
                    </div>
                  </div>
                  {(q.question_type === 'multiple_choice' || q.question_type === 'single_choice') && (
                    <div>
                      <Label>Opções (uma por linha)</Label>
                      <Textarea
                        value={q.options.join('\n')}
                        onChange={e => updateQuestion(idx, { options: e.target.value.split('\n') })}
                        rows={4}
                        placeholder="Opção 1&#10;Opção 2&#10;Opção 3"
                      />
                      <div className="mt-2">
                        <Label className="text-xs">Pontuação por opção (opcional, formato: opção=pontos, uma por linha)</Label>
                        <Textarea
                          value={Object.entries(q.score_map).map(([k, v]) => `${k}=${v}`).join('\n')}
                          onChange={e => {
                            const map: Record<string, number> = {};
                            e.target.value.split('\n').forEach(line => {
                              const [key, val] = line.split('=');
                              if (key && val) map[key.trim()] = parseInt(val.trim()) || 0;
                            });
                            updateQuestion(idx, { score_map: map });
                          }}
                          rows={3}
                          placeholder="Iniciante=1&#10;Intermediário=2&#10;Avançado=3"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            <div className="flex gap-3">
              <Button variant="outline" onClick={addQuestion} className="gap-2">
                <Plus className="h-4 w-4" /> Adicionar Pergunta
              </Button>
              <Button onClick={handleSaveQuestions} disabled={saveQuestions.isPending} className="gap-2">
                <Save className="h-4 w-4" /> {saveQuestions.isPending ? 'Salvando...' : 'Salvar Perguntas'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="whatsapp" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Mensagem WhatsApp Automática</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Enviada automaticamente quando o atleta submete a aplicação.</p>
                <Textarea value={whatsappMsg} onChange={e => setWhatsappMsg(e.target.value)} rows={8} />
                <Button onClick={handleSavePage} disabled={updateCall.isPending} className="gap-2">
                  <Save className="h-4 w-4" /> Salvar
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
