import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Brain,
  UtensilsCrossed,
  ClipboardCheck,
  MessageCircle,
  Save,
  Loader2,
  Play,
  Copy,
  ChevronDown,
  ChevronUp,
  Sparkles,
  FileUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { MealPlanSkillPanel } from '@/components/admin/MealPlanSkillPanel';

interface ContextConfig {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  variables: string[];
}

const CONTEXTS: ContextConfig[] = [
  {
    key: 'meal_plan_generation',
    label: 'Plano Alimentar',
    description: 'Prompt usado para gerar planos alimentares personalizados para cada atleta.',
    icon: <UtensilsCrossed className="h-4 w-4" />,
    variables: [
      '{{nome_atleta}}', '{{peso}}', '{{altura}}', '{{idade}}',
      '{{objetivo}}', '{{restricoes_alimentares}}', '{{alergias}}',
      '{{horas_treino_semana}}', '{{tipo_treino}}', '{{prova_alvo}}',
      '{{data_prova}}', '{{historico_lesoes}}', '{{suplementos_atuais}}',
    ],
  },
  {
    key: 'checkin_analysis',
    label: 'Análise de Check-in',
    description: 'Prompt para analisar os check-ins dos atletas e gerar insights.',
    icon: <ClipboardCheck className="h-4 w-4" />,
    variables: [
      '{{nome_atleta}}', '{{peso_atual}}', '{{peso_anterior}}',
      '{{nivel_energia}}', '{{qualidade_sono}}', '{{sintomas_digestivos}}',
      '{{aderencia_plano}}', '{{observacoes_atleta}}', '{{historico_checkins}}',
    ],
  },
  {
    key: 'whatsapp_support',
    label: 'Suporte WhatsApp',
    description: 'Prompt para o assistente de suporte via WhatsApp.',
    icon: <MessageCircle className="h-4 w-4" />,
    variables: [
      '{{nome_atleta}}', '{{plano_atual}}', '{{proximo_checkin}}',
      '{{mensagem_atleta}}', '{{historico_conversa}}', '{{objetivo}}',
    ],
  },
];

interface AiPrompt {
  id: string;
  user_id: string;
  context_key: string;
  prompt_text: string;
  created_at: string;
  updated_at: string;
}

export default function AiTrainingCenter() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedContext, setSelectedContext] = useState(CONTEXTS[0].key);
  const [promptText, setPromptText] = useState('');
  const [promptLoaded, setPromptLoaded] = useState<string | null>(null);
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [variablesOpen, setVariablesOpen] = useState(true);
  const [playgroundOpen, setPlaygroundOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [testProvider, setTestProvider] = useState<'gemini' | 'openai'>('gemini');
  const [openaiModel, setOpenaiModel] = useState<string>('openai/gpt-5.6-luna');


  // Importa o conteúdo de um arquivo (.md/.txt lido direto; .pdf transcrito via IA)
  // para o editor do prompt.
  const handleImportFile = async (file: File | null) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    try {
      setImporting(true);
      if (name.endsWith('.pdf') || file.type === 'application/pdf') {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const r = String(reader.result || '');
            resolve(r.includes(',') ? r.split(',')[1] : r);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const { data, error } = await supabase.functions.invoke('extract-pdf-text', { body: { pdfBase64: base64 } });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        const text = data?.text || '';
        if (!text.trim()) throw new Error('Não consegui extrair texto do PDF.');
        setPromptText(text);
        toast.success('PDF importado para o prompt.');
      } else {
        // .md / .markdown / .txt / outros textos
        const text = await file.text();
        if (!text.trim()) throw new Error('Arquivo vazio.');
        setPromptText(text);
        toast.success('Arquivo importado para o prompt.');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao importar o arquivo.');
    } finally {
      setImporting(false);
    }
  };

  const currentContext = CONTEXTS.find((c) => c.key === selectedContext)!;

  const { data: prompts, isLoading } = useQuery({
    queryKey: ['ai_prompts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_prompts' as any)
        .select('*')
        .eq('user_id', user!.id);
      if (error) throw error;
      return (data as any[]) as AiPrompt[];
    },
    enabled: !!user?.id,
  });

  // Sync prompt text when context changes or data loads
  const existingPrompt = prompts?.find((p) => p.context_key === selectedContext);
  if (existingPrompt && promptLoaded !== selectedContext) {
    setPromptText(existingPrompt.prompt_text);
    setPromptLoaded(selectedContext);
  } else if (!existingPrompt && promptLoaded !== selectedContext) {
    setPromptText('');
    setPromptLoaded(selectedContext);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('ai_prompts' as any)
        .upsert(
          {
            user_id: user!.id,
            context_key: selectedContext,
            prompt_text: promptText,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: 'user_id,context_key' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai_prompts', user?.id] });
      toast.success('Prompt salvo com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao salvar o prompt.');
    },
  });

  const handleTest = async () => {
    if (!promptText.trim()) {
      toast.error('Escreva um prompt antes de testar.');
      return;
    }
    setTestLoading(true);
    setTestResult('');
    try {
      const { data, error } = await supabase.functions.invoke('test-ai-prompt', {
        body: {
          context_key: selectedContext,
          prompt_text: promptText,
          test_input: testInput,
          provider: testProvider,
          openai_model: openaiModel,
        },
      });
      if (error) throw error;
      const usedProvider = data?.provider ? ` [${data.provider}/${data.model}]` : '';
      setTestResult((data?.result || data?.output || JSON.stringify(data, null, 2)) + usedProvider);

    } catch (err: any) {
      setTestResult(`Erro: ${err.message || 'Falha ao gerar teste.'}`);
    } finally {
      setTestLoading(false);
    }
  };

  const copyVariable = (variable: string) => {
    navigator.clipboard.writeText(variable);
    toast.success(`${variable} copiado!`);
  };

  const handleContextChange = (key: string) => {
    setSelectedContext(key);
    setPromptLoaded(null);
    setTestResult('');
    setTestInput('');
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Brain className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Central de IA</h1>
            <p className="text-muted-foreground text-sm">
              Gerencie os prompts do sistema para cada contexto de IA.
            </p>
          </div>
        </div>

        <Tabs
          value={selectedContext}
          onValueChange={handleContextChange}
          className="flex flex-col md:flex-row gap-6"
        >
          {/* Sidebar / Top tabs */}
          <TabsList className="flex md:flex-col h-auto bg-transparent gap-1 md:w-56 shrink-0">
            {CONTEXTS.map((ctx) => (
              <TabsTrigger
                key={ctx.key}
                value={ctx.key}
                className="justify-start gap-2 px-3 py-2.5 w-full data-[state=active]:bg-card data-[state=active]:shadow-sm"
              >
                {ctx.icon}
                <span className="hidden sm:inline">{ctx.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Main content area */}
          <div className="flex-1 min-w-0">
            {CONTEXTS.map((ctx) => (
              <TabsContent key={ctx.key} value={ctx.key} className="mt-0 space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      {ctx.icon}
                      <CardTitle className="text-lg">{ctx.label}</CardTitle>
                    </div>
                    <CardDescription>{ctx.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* System Prompt Editor */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-sm font-medium">System Prompt</label>
                        <div>
                          <input
                            id="prompt-file-import"
                            type="file"
                            accept=".md,.markdown,.txt,.pdf,text/markdown,text/plain,application/pdf"
                            className="hidden"
                            onChange={(e) => { handleImportFile(e.target.files?.[0] ?? null); e.currentTarget.value = ''; }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            disabled={importing}
                            onClick={() => document.getElementById('prompt-file-import')?.click()}
                          >
                            {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
                            Importar PDF/MD
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">Anexe um arquivo <strong>.md</strong>, <strong>.txt</strong> ou <strong>.pdf</strong> — o conteúdo substitui o texto abaixo (revise e clique em Salvar).</p>
                      {isLoading ? (
                        <Skeleton className="h-64 w-full" />
                      ) : (
                        <Textarea
                          value={promptText}
                          onChange={(e) => setPromptText(e.target.value)}
                          placeholder="Escreva o prompt do sistema aqui..."
                          className="font-mono text-sm min-h-[300px] resize-y"
                          rows={12}
                        />
                      )}
                    </div>

                    {/* Dynamic Variables */}
                    <Collapsible open={variablesOpen} onOpenChange={setVariablesOpen}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-2 px-0 text-muted-foreground hover:text-foreground">
                          <Sparkles className="h-4 w-4" />
                          Variáveis disponíveis
                          {variablesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-2">
                        <div className="flex flex-wrap gap-2">
                          {ctx.variables.map((v) => (
                            <Badge
                              key={v}
                              variant="secondary"
                              className="cursor-pointer hover:bg-primary/10 transition-colors gap-1"
                              onClick={() => copyVariable(v)}
                            >
                              <Copy className="h-3 w-3" />
                              {v}
                            </Badge>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Save Button — nos demais contextos. No Plano Alimentar o
                        salvamento é feito por versão no painel da habilidade. */}
                    {ctx.key !== 'meal_plan_generation' && (
                      <div className="flex justify-end">
                        <Button
                          onClick={() => saveMutation.mutate()}
                          disabled={saveMutation.isPending}
                          className="gap-2"
                        >
                          {saveMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          Salvar Prompt
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Habilidade "Plano alimentar": versões + módulos + prontidão */}
                {ctx.key === 'meal_plan_generation' && (
                  <MealPlanSkillPanel promptText={promptText} setPromptText={setPromptText} />
                )}

                {/* Test Playground */}
                <Collapsible open={playgroundOpen} onOpenChange={setPlaygroundOpen}>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Play className="h-4 w-4 text-primary" />
                            <CardTitle className="text-lg">Playground de Teste</CardTitle>
                          </div>
                          {playgroundOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                        <CardDescription>Simule uma entrada para testar o prompt.</CardDescription>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="space-y-4 pt-0">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Entrada do atleta (simulação)</label>
                          <Textarea
                            value={testInput}
                            onChange={(e) => setTestInput(e.target.value)}
                            placeholder="Ex: Atleta com 75kg, 1.80m, objetivo de perda de peso..."
                            rows={4}
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Provedor de IA</label>
                            <select
                              value={testProvider}
                              onChange={(e) => setTestProvider(e.target.value as 'gemini' | 'openai')}
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              <option value="gemini">Google Gemini 2.5 Flash</option>
                              <option value="openai">OpenAI (ChatGPT)</option>
                            </select>
                          </div>
                          {testProvider === 'openai' && (
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Modelo OpenAI</label>
                              <select
                                value={openaiModel}
                                onChange={(e) => setOpenaiModel(e.target.value)}
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              >
                                <option value="gpt-4o-mini">gpt-4o-mini (rápido/barato)</option>
                                <option value="gpt-4o">gpt-4o (completo)</option>
                                <option value="gpt-5-mini">gpt-5-mini</option>
                                <option value="gpt-5">gpt-5 (mais capaz)</option>
                              </select>
                            </div>
                          )}
                        </div>

                        <Button
                          onClick={handleTest}
                          disabled={testLoading}
                          variant="outline"
                          className="gap-2"
                        >

                          {testLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                          Gerar Teste
                        </Button>

                        {(testResult || testLoading) && (
                          <div className="bg-muted/50 rounded-lg p-4">
                            <label className="text-sm font-medium mb-2 block">Resultado</label>
                            {testLoading ? (
                              <div className="space-y-2">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-4 w-5/6" />
                              </div>
                            ) : (
                              <div className="whitespace-pre-wrap text-sm font-mono">
                                {testResult}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </div>
    </Layout>
  );
}
