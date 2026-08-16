/**
 * ETAPA 5B — CENTRAL DE IA CANÔNICA.
 * A IA é camada de APOIO: gera rascunhos, resume e sugere. Nunca publica plano,
 * nunca fecha check-in, nunca conclui revisão e nunca envia feedback sozinha.
 * Cada skill mostra: função, versão ativa, provider, modelo, regras, consumidores
 * e o PROMPT EFETIVO real. O playground roda a mesma pipeline de produção.
 */
import { useMemo, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Brain, UtensilsCrossed, ClipboardCheck, Save, Loader2, Play, Copy,
  ShieldCheck, History, FileUp, CheckCircle2, AlertTriangle, RotateCcw, FlaskConical,
} from 'lucide-react';
import { toast } from 'sonner';
import { MealPlanSkillPanel } from '@/components/admin/MealPlanSkillPanel';
import {
  AI_SKILLS, getSkill, activeVersion, draftVersions, validateForActivation,
  diffLines, diffSummary, buildEffectivePromptSections, effectivePromptText,
  type AiSkillKey, type PromptVersion,
} from '@/lib/aiSkills';
import {
  useAiPromptVersions, useCreateDraftVersion, useUpdateDraftVersion,
  useActivatePromptVersion, useRollbackToVersion, useAiRuns, useRecentCheckinResponses,
} from '@/hooks/useAiSkills';

const SKILL_ICON: Record<AiSkillKey, React.ReactNode> = {
  meal_plan_generation: <UtensilsCrossed className="h-4 w-4" />,
  checkin_analysis: <ClipboardCheck className="h-4 w-4" />,
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
    draft: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
    archived: 'bg-muted text-muted-foreground',
  };
  const label = status === 'active' ? 'Ativa (produção)' : status === 'draft' ? 'Rascunho' : 'Arquivada';
  return <Badge variant="outline" className={map[status] || ''}>{label}</Badge>;
}

export default function AiTrainingCenter() {
  const [skillKey, setSkillKey] = useState<AiSkillKey>('meal_plan_generation');
  const skill = getSkill(skillKey)!;

  const { data: versions = [], isLoading } = useAiPromptVersions(skillKey);
  const createDraft = useCreateDraftVersion(skillKey);
  const updateDraft = useUpdateDraftVersion(skillKey);
  const activate = useActivatePromptVersion(skillKey);
  const rollback = useRollbackToVersion(skillKey);
  const { data: runs = [] } = useAiRuns(skillKey);
  const { data: checkins = [] } = useRecentCheckinResponses();

  const active = activeVersion(versions);
  const drafts = draftVersions(versions);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');
  const [changeNotes, setChangeNotes] = useState('');
  const [importing, setImporting] = useState(false);

  const [testCheckinId, setTestCheckinId] = useState<string>('');
  const [testInput, setTestInput] = useState('');
  const [testVersionId, setTestVersionId] = useState<string>('active');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const editingVersion = versions.find((v) => v.id === editingId) || null;
  const baselineText = active?.prompt_text ?? '';
  const diff = useMemo(() => diffLines(baselineText, draftText), [baselineText, draftText]);
  const diffCount = diffSummary(diff);
  const check = useMemo(() => validateForActivation(skill, draftText), [skill, draftText]);

  const effectiveSections = useMemo(
    () => buildEffectivePromptSections(skill, active?.prompt_text ?? '(nenhuma versão ativa)'),
    [skill, active],
  );

  const startEditing = (v?: PromptVersion) => {
    if (v) {
      setEditingId(v.id);
      setDraftText(v.prompt_text);
      setChangeNotes(v.change_notes ?? '');
    } else {
      setEditingId(null);
      setDraftText(active?.prompt_text ?? '');
      setChangeNotes('');
    }
  };

  const handleSaveDraft = async () => {
    if (!draftText.trim()) return toast.error('Escreva o prompt antes de salvar.');
    if (editingVersion?.status === 'draft') {
      await updateDraft.mutateAsync({ versionId: editingVersion.id, promptText: draftText, changeNotes });
    } else {
      const created = await createDraft.mutateAsync({ promptText: draftText, changeNotes });
      setEditingId(created.id);
    }
  };

  const handleActivate = async (versionId: string) => {
    await activate.mutateAsync(versionId);
    setEditingId(null);
  };

  const handleImportFile = async (file: File | null) => {
    if (!file) return;
    try {
      setImporting(true);
      const name = file.name.toLowerCase();
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
        if (!data?.text?.trim()) throw new Error('Não consegui extrair texto do PDF.');
        setDraftText(data.text);
      } else {
        const text = await file.text();
        if (!text.trim()) throw new Error('Arquivo vazio.');
        setDraftText(text);
      }
      toast.success('Conteúdo importado para o rascunho.');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao importar o arquivo.');
    } finally {
      setImporting(false);
    }
  };

  const handleRunPlayground = async () => {
    if (skillKey === 'checkin_analysis' && !testCheckinId) {
      return toast.error('Selecione um check-in real para o teste.');
    }
    setTestLoading(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('run-ai-skill', {
        body: {
          skill_key: skillKey,
          prompt_version_id: testVersionId === 'active' ? null : testVersionId,
          checkin_response_id: testCheckinId || undefined,
          test_input: testInput || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setTestResult(data);
      toast.success('Teste executado (nada foi gravado no atleta).');
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao executar o teste.');
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6 pb-10">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2"><Brain className="h-5 w-5 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Central de IA</h1>
            <p className="text-sm text-muted-foreground">
              Configuração, versionamento e auditoria das funções de IA do sistema.
            </p>
          </div>
        </div>

        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertDescription className="text-sm">
            A IA é uma camada de apoio. Ela não publica plano, não fecha check-in, não conclui revisão
            estrutural e não envia feedback — toda decisão exige ação humana explícita.
          </AlertDescription>
        </Alert>

        <Tabs value={skillKey} onValueChange={(v) => { setSkillKey(v as AiSkillKey); setEditingId(null); setTestResult(null); }}>
          <TabsList>
            {AI_SKILLS.map((s) => (
              <TabsTrigger key={s.key} value={s.key} className="gap-2">
                {SKILL_ICON[s.key]}{s.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {AI_SKILLS.map((s) => (
            <TabsContent key={s.key} value={s.key} className="space-y-6 pt-4">
              {/* ---------- Visão geral da função ---------- */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">{s.label}</CardTitle>
                    {isLoading ? <Skeleton className="h-5 w-24" /> : active
                      ? <div className="flex items-center gap-2"><StatusBadge status="active" /><Badge variant="secondary">v{active.version_number}</Badge></div>
                      : <Badge variant="destructive">Sem versão ativa</Badge>}
                  </div>
                  <CardDescription>{s.description}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Execução</p>
                    <p>Provider: <span className="font-medium">{active?.provider || s.provider}</span></p>
                    <p>Modelo: <span className="font-medium">{active?.model || s.model}</span></p>
                    <p>Fallbacks: {s.fallbackModels.join(', ')}</p>
                    <p>Max tokens: {s.maxTokens} · Formato: {s.responseFormat}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Onde é usada</p>
                    <div className="flex flex-wrap gap-1">
                      {s.consumers.map((c) => <Badge key={c} variant="outline" className="font-mono text-[11px]">{c}</Badge>)}
                    </div>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Variáveis injetadas</p>
                    <div className="flex flex-wrap gap-1">
                      {s.variables.map((v) => <Badge key={v} variant="secondary" className="font-mono text-[11px]">{v}</Badge>)}
                    </div>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Regras do sistema</p>
                    <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
                      {s.systemRules.map((r) => <li key={r}>{r}</li>)}
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {s.hasModules && <MealPlanSkillPanel />}

              {/* ---------- Editor + versionamento ---------- */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Prompt-base e versões</CardTitle>
                  <CardDescription>
                    Edições geram um rascunho. A produção só muda quando você ativa a versão.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => startEditing()}>
                      Novo rascunho a partir da ativa
                    </Button>
                    {drafts.map((d) => (
                      <Button key={d.id} size="sm" variant={editingId === d.id ? 'default' : 'outline'} onClick={() => startEditing(d)}>
                        Editar rascunho v{d.version_number}
                      </Button>
                    ))}
                    <label className="ml-auto">
                      <input type="file" accept=".md,.markdown,.txt,.pdf" className="hidden"
                        onChange={(e) => handleImportFile(e.target.files?.[0] ?? null)} />
                      <Button size="sm" variant="ghost" asChild disabled={importing}>
                        <span className="cursor-pointer">
                          {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
                          Importar arquivo
                        </span>
                      </Button>
                    </label>
                  </div>

                  <Textarea
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    placeholder="Escreva o prompt-base desta função..."
                    className="min-h-[280px] font-mono text-xs"
                  />
                  <Input
                    value={changeNotes}
                    onChange={(e) => setChangeNotes(e.target.value)}
                    placeholder="Notas da mudança (o que muda nesta versão e por quê)"
                  />

                  {!check.ok && draftText.trim() && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <ul className="list-disc pl-4 text-xs">{check.errors.map((e) => <li key={e}>{e}</li>)}</ul>
                      </AlertDescription>
                    </Alert>
                  )}
                  {check.ok && check.warnings.length > 0 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <ul className="list-disc pl-4 text-xs">{check.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" onClick={handleSaveDraft} disabled={updateDraft.isPending || createDraft.isPending}>
                      <Save className="mr-2 h-4 w-4" />Salvar rascunho
                    </Button>
                    <Button
                      size="sm" variant="default"
                      disabled={!editingVersion || editingVersion.status !== 'draft' || !check.ok || activate.isPending}
                      onClick={() => editingVersion && handleActivate(editingVersion.id)}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />Ativar em produção
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Diferença vs. versão ativa: +{diffCount.added} / −{diffCount.removed} linhas
                    </span>
                  </div>

                  {(diffCount.added > 0 || diffCount.removed > 0) && (
                    <ScrollArea className="h-64 rounded-md border bg-muted/30 p-3">
                      <pre className="text-[11px] leading-relaxed">
                        {diff.map((l, i) => (
                          <div key={i} className={
                            l.type === 'added' ? 'text-emerald-600' :
                            l.type === 'removed' ? 'text-destructive' : 'text-muted-foreground'
                          }>
                            {l.type === 'added' ? '+ ' : l.type === 'removed' ? '- ' : '  '}{l.text}
                          </div>
                        ))}
                      </pre>
                    </ScrollArea>
                  )}

                  <Separator />

                  <div className="space-y-2">
                    <p className="flex items-center gap-2 text-sm font-medium"><History className="h-4 w-4" />Histórico</p>
                    {isLoading && <Skeleton className="h-16 w-full" />}
                    {!isLoading && versions.length === 0 && (
                      <p className="text-sm text-muted-foreground">Nenhuma versão registrada ainda.</p>
                    )}
                    {versions.map((v) => (
                      <div key={v.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
                        <Badge variant="secondary">v{v.version_number}</Badge>
                        <StatusBadge status={v.status} />
                        <span className="text-xs text-muted-foreground">
                          {new Date(v.created_at).toLocaleString('pt-BR')}
                          {v.change_notes ? ` · ${v.change_notes}` : ''}
                        </span>
                        <div className="ml-auto flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => { setDraftText(v.prompt_text); setEditingId(v.status === 'draft' ? v.id : null); }}>
                            <Copy className="mr-1 h-3.5 w-3.5" />Carregar
                          </Button>
                          {v.status === 'archived' && (
                            <Button size="sm" variant="outline" disabled={rollback.isPending} onClick={() => rollback.mutate(v)}>
                              <RotateCcw className="mr-1 h-3.5 w-3.5" />Rollback
                            </Button>
                          )}
                          {v.status === 'draft' && (
                            <Button size="sm" variant="outline" disabled={activate.isPending} onClick={() => handleActivate(v.id)}>
                              Ativar
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* ---------- Prompt efetivo ---------- */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Prompt efetivo (o que a IA realmente recebe)</CardTitle>
                  <CardDescription>Prompt-base + módulos + regras do sistema + contexto dinâmico + contrato de saída.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-72 rounded-md border bg-muted/30 p-3">
                    <pre className="whitespace-pre-wrap text-[11px] leading-relaxed">{effectivePromptText(effectiveSections)}</pre>
                  </ScrollArea>
                  <Button size="sm" variant="ghost" className="mt-2"
                    onClick={() => { navigator.clipboard.writeText(effectivePromptText(effectiveSections)); toast.success('Prompt efetivo copiado'); }}>
                    <Copy className="mr-2 h-4 w-4" />Copiar
                  </Button>
                </CardContent>
              </Card>

              {/* ---------- Playground ---------- */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base"><FlaskConical className="h-4 w-4" />Playground</CardTitle>
                  <CardDescription>
                    Roda a mesma pipeline de produção (mesmo provider, modelo, regras e contrato de saída).
                    Nada é gravado no atleta — apenas a execução fica registrada na auditoria.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Versão do prompt</p>
                      <Select value={testVersionId} onValueChange={setTestVersionId}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Versão ativa (produção)</SelectItem>
                          {drafts.map((d) => <SelectItem key={d.id} value={d.id}>Rascunho v{d.version_number}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {s.key === 'checkin_analysis' && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Check-in real</p>
                        <Select value={testCheckinId} onValueChange={setTestCheckinId}>
                          <SelectTrigger><SelectValue placeholder="Selecione um check-in" /></SelectTrigger>
                          <SelectContent>
                            {checkins.map((c: any) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.clients?.name} — {new Date(c.submitted_at).toLocaleDateString('pt-BR')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {s.key === 'meal_plan_generation' && (
                    <Textarea value={testInput} onChange={(e) => setTestInput(e.target.value)}
                      placeholder="Contexto de teste (opcional): dados do atleta, instruções..."
                      className="min-h-[100px] text-xs" />
                  )}

                  <Button size="sm" onClick={handleRunPlayground} disabled={testLoading}>
                    {testLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                    Executar teste
                  </Button>

                  {testResult && (
                    <div className="space-y-2 rounded-md border p-3">
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Badge variant="outline">{testResult.provider}/{testResult.model}</Badge>
                        <Badge variant="outline">
                          {testResult.prompt_version_number ? `v${testResult.prompt_version_number}` : 'sem versão'}
                          {testResult.prompt_version_status ? ` · ${testResult.prompt_version_status}` : ''}
                        </Badge>
                        <Badge variant="outline">hash {testResult.effective_prompt_hash}</Badge>
                        <Badge variant="secondary">não persistido</Badge>
                      </div>
                      <ScrollArea className="h-72 rounded bg-muted/30 p-3">
                        <pre className="whitespace-pre-wrap text-[11px]">
                          {typeof testResult.output === 'string' ? testResult.output : JSON.stringify(testResult.output, null, 2)}
                        </pre>
                      </ScrollArea>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ---------- Auditoria ---------- */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Auditoria de execuções</CardTitle>
                  <CardDescription>Toda execução (produção e playground) registra versão, provider, modelo e resultado.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {runs.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma execução registrada ainda.</p>}
                  {runs.map((r) => (
                    <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-xs">
                      <Badge variant={r.status === 'succeeded' ? 'secondary' : r.status === 'failed' ? 'destructive' : 'outline'}>
                        {r.status}
                      </Badge>
                      <Badge variant="outline">{r.environment}</Badge>
                      <span className="text-muted-foreground">
                        {new Date(r.created_at).toLocaleString('pt-BR')} · {r.provider}/{r.model}
                        {r.prompt_version_number ? ` · v${r.prompt_version_number}` : ''}
                        {r.duration_ms ? ` · ${(r.duration_ms / 1000).toFixed(1)}s` : ''}
                      </span>
                      {r.error && <span className="text-destructive">{r.error}</span>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </Layout>
  );
}
