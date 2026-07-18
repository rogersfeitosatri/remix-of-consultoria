// Central de IA — painel da habilidade "Plano alimentar": versionamento do
// prompt (salvar/ativar/restaurar/histórico), módulos complementares com
// verificação obrigatória e validação de prontidão. Reutiliza ai_prompts como
// ponteiro ativo (edge functions continuam lendo dela).
import { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import {
  CheckCircle2, AlertTriangle, History, Save, RotateCcw, Power, Loader2, Puzzle, ChevronDown, FileDown,
} from 'lucide-react';
import defaultPrompt from '@/content/mealPlanSkillPrompt.md?raw';
import {
  SKILL_MODULES, MEAL_PLAN_SKILL_KEY, computeReadiness, type StoredModule, type ModuleStatus,
} from '@/lib/aiSkill';

const CONTEXT = MEAL_PLAN_SKILL_KEY;

const STATUS_STYLE: Record<ModuleStatus, { label: string; cls: string }> = {
  configured: { label: 'Configurado', cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
  pending: { label: 'Pendente', cls: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
  inactive: { label: 'Inativo', cls: 'bg-muted text-muted-foreground' },
  update_available: { label: 'Atualização disponível', cls: 'bg-sky-500/10 text-sky-600 border-sky-500/30' },
  error: { label: 'Erro de carregamento', cls: 'bg-red-500/10 text-red-600 border-red-500/30' },
};

interface Version { id: string; version_number: number; prompt_text: string; note: string | null; author_name: string | null; is_active: boolean; created_at: string; }

export function MealPlanSkillPanel({ promptText, setPromptText }: { promptText: string; setPromptText: (v: string) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [modulesOpen, setModulesOpen] = useState(true);
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [moduleDraft, setModuleDraft] = useState('');

  const versionsQ = useQuery({
    queryKey: ['ai_prompt_versions', user?.id, CONTEXT],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('ai_prompt_versions' as any)
        .select('*').eq('user_id', user!.id).eq('context_key', CONTEXT)
        .order('version_number', { ascending: false });
      if (error) throw error;
      return (data as any[]) as Version[];
    },
  });

  const modulesQ = useQuery({
    queryKey: ['ai_skill_modules', user?.id, CONTEXT],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('ai_skill_modules' as any)
        .select('*').eq('user_id', user!.id).eq('skill_key', CONTEXT);
      if (error) throw error;
      return (data as any[]) as StoredModule[];
    },
  });

  const modules = modulesQ.data ?? [];
  const readiness = useMemo(() => computeReadiness(promptText, modules), [promptText, modules]);

  const nextVersion = (versionsQ.data?.[0]?.version_number ?? 0) + 1;

  const saveVersion = useMutation({
    mutationFn: async ({ text, noteText, activate }: { text: string; noteText: string; activate: boolean }) => {
      const ver = nextVersion;
      // desativa versões anteriores se esta for ativada
      if (activate) {
        await supabase.from('ai_prompt_versions' as any).update({ is_active: false }).eq('user_id', user!.id).eq('context_key', CONTEXT);
      }
      const { error } = await supabase.from('ai_prompt_versions' as any).insert({
        user_id: user!.id, context_key: CONTEXT, version_number: ver, prompt_text: text,
        note: noteText || null, author_id: user!.id, author_name: user!.email ?? null, is_active: activate,
      });
      if (error) throw error;
      if (activate) {
        await supabase.from('ai_prompts' as any).upsert(
          { user_id: user!.id, context_key: CONTEXT, prompt_text: text, active_version_number: ver, updated_by: user!.id, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,context_key' },
        );
      }
      return ver;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['ai_prompt_versions', user?.id, CONTEXT] });
      qc.invalidateQueries({ queryKey: ['ai_prompts', user?.id] });
      setNote('');
      toast.success(vars.activate ? 'Nova versão salva e ativada.' : 'Versão salva.');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao salvar versão. A migration da Fase 1 foi aplicada?'),
  });

  const activateVersion = useMutation({
    mutationFn: async (v: Version) => {
      await supabase.from('ai_prompt_versions' as any).update({ is_active: false }).eq('user_id', user!.id).eq('context_key', CONTEXT);
      await supabase.from('ai_prompt_versions' as any).update({ is_active: true }).eq('id', v.id);
      await supabase.from('ai_prompts' as any).upsert(
        { user_id: user!.id, context_key: CONTEXT, prompt_text: v.prompt_text, active_version_number: v.version_number, updated_by: user!.id, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,context_key' },
      );
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['ai_prompt_versions', user?.id, CONTEXT] });
      qc.invalidateQueries({ queryKey: ['ai_prompts', user?.id] });
      setPromptText(v.prompt_text);
      toast.success(`Versão v${v.version_number} ativada.`);
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao ativar.'),
  });

  const saveModule = useMutation({
    mutationFn: async ({ module_key, content, is_active, title, required }: { module_key: string; content: string; is_active: boolean; title: string; required: boolean }) => {
      const existing = modules.find((m) => m.module_key === module_key);
      const version_number = (existing?.version_number ?? 0) + (existing && (existing.content || '') !== content ? 1 : (existing ? 0 : 1));
      const { error } = await supabase.from('ai_skill_modules' as any).upsert(
        { user_id: user!.id, skill_key: CONTEXT, module_key, title, content, is_active, required, version_number: version_number || 1, updated_by: user!.id },
        { onConflict: 'user_id,skill_key,module_key' },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai_skill_modules', user?.id, CONTEXT] });
      setEditingModule(null);
      toast.success('Módulo salvo.');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao salvar módulo.'),
  });

  const toggleModuleActive = (module_key: string) => {
    const def = SKILL_MODULES.find((d) => d.module_key === module_key)!;
    const existing = modules.find((m) => m.module_key === module_key);
    if (!existing || !(existing.content || '').trim()) { toast.error('Cadastre o conteúdo do módulo antes de ativar.'); return; }
    saveModule.mutate({ module_key, content: existing.content || '', is_active: !existing.is_active, title: existing.title || def.title, required: def.required });
  };

  return (
    <div className="space-y-4">
      {/* Prontidão */}
      <Card className={readiness.ready ? 'border-emerald-500/40' : 'border-amber-500/40'}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            {readiness.ready ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
            {readiness.ready ? 'Habilidade pronta' : 'Habilidade incompleta'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-1.5 text-xs">
          <div className="grid gap-1 sm:grid-cols-2">
            <span>Prompt principal: <strong>{readiness.mainLoaded ? 'carregado' : 'ausente'}</strong>{versionsQ.data?.find((v) => v.is_active) ? ` · v${versionsQ.data.find((v) => v.is_active)!.version_number}` : ''}</span>
            <span>Prompt (caracteres): <strong>{readiness.promptChars.toLocaleString('pt-BR')}</strong></span>
            <span>Módulos obrigatórios: <strong>{readiness.modules.filter((m) => m.required && m.included).length}/{readiness.modules.filter((m) => m.required).length}</strong></span>
            <span>Prompt efetivo: <strong>{readiness.effectiveChars.toLocaleString('pt-BR')}</strong> caracteres · hash {readiness.effectiveHash}</span>
          </div>
          {readiness.missing.length > 0 && (
            <p className="text-amber-600">Módulos obrigatórios faltando/inativos: {readiness.missing.join(', ')}. Cadastre e ative para liberar a habilidade.</p>
          )}
          {!readiness.mainLoaded && (
            <Button size="sm" variant="outline" className="mt-1 gap-1.5" onClick={() => { setPromptText(defaultPrompt); toast.message('Prompt padrão carregado no editor — revise e salve como versão.'); }}>
              <FileDown className="h-3.5 w-3.5" /> Carregar prompt padrão da habilidade
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Versionamento */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><History className="h-4 w-4 text-primary" /> Versão do prompt</CardTitle></CardHeader>
        <CardContent className="pt-0 space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Observação da alteração (ex.: ajuste de carbloading)" className="flex-1" />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => saveVersion.mutate({ text: promptText, noteText: note, activate: false })} disabled={saveVersion.isPending || !promptText.trim()}>
                <Save className="h-3.5 w-3.5" /> Salvar em edição
              </Button>
              <Button size="sm" className="gap-1.5" onClick={() => saveVersion.mutate({ text: promptText, noteText: note, activate: true })} disabled={saveVersion.isPending || !promptText.trim()}>
                {saveVersion.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />} Salvar e ativar (v{nextVersion})
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">“Salvar em edição” guarda a versão sem publicar. “Salvar e ativar” passa a valer nas próximas gerações. Cada plano gerado registra a versão usada.</p>

          <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 px-0 text-muted-foreground">
                <ChevronDown className={`h-4 w-4 transition-transform ${historyOpen ? 'rotate-180' : ''}`} /> Histórico de versões ({versionsQ.data?.length ?? 0})
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-1 space-y-1">
              {(versionsQ.data ?? []).map((v) => (
                <div key={v.id} className="flex items-center justify-between gap-2 rounded border p-2 text-xs">
                  <div className="min-w-0">
                    <span className="font-medium">v{v.version_number}</span>
                    {v.is_active && <Badge className="ml-1 text-[10px]" variant="default">ativa</Badge>}
                    <span className="text-muted-foreground"> · {new Date(v.created_at).toLocaleDateString('pt-BR')}{v.author_name ? ` · ${v.author_name}` : ''}</span>
                    {v.note && <span className="block text-muted-foreground truncate">{v.note}</span>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setPromptText(v.prompt_text)}>Ver no editor</Button>
                    {!v.is_active && <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => activateVersion.mutate(v)}><RotateCcw className="h-3 w-3" /> Ativar</Button>}
                  </div>
                </div>
              ))}
              {(versionsQ.data?.length ?? 0) === 0 && <p className="text-xs text-muted-foreground">Nenhuma versão ainda. Salve a primeira.</p>}
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Módulos da habilidade */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Puzzle className="h-4 w-4 text-primary" /> Módulos da habilidade</CardTitle></CardHeader>
        <CardContent className="pt-0 space-y-2">
          {SKILL_MODULES.map((def) => {
            const stored = modules.find((m) => m.module_key === def.module_key);
            const status = readiness.modules.find((m) => m.module_key === def.module_key)!;
            const st = STATUS_STYLE[status.status];
            const isEditing = editingModule === def.module_key;
            return (
              <div key={def.module_key} className="rounded-lg border p-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-sm font-medium">{def.title}</span>
                    {!def.required && <Badge variant="outline" className="ml-1 text-[10px]">não usada nesta etapa</Badge>}
                    <p className="text-[11px] text-muted-foreground">references/{def.module_key}.md — {def.role}</p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${st.cls}`}>{st.label}</Badge>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{status.chars.toLocaleString('pt-BR')} caracteres{status.version_number ? ` · v${status.version_number}` : ''}{stored?.updated_at ? ` · ${new Date(stored.updated_at).toLocaleDateString('pt-BR')}` : ''}</span>
                  {status.included && <span className="text-emerald-600">✓ incluído no prompt efetivo</span>}
                </div>
                {isEditing ? (
                  <div className="space-y-1.5">
                    <Textarea value={moduleDraft} onChange={(e) => setModuleDraft(e.target.value)} rows={8} className="font-mono text-xs" placeholder={`Cole aqui o conteúdo de ${def.module_key}.md`} />
                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 text-xs gap-1" onClick={() => saveModule.mutate({ module_key: def.module_key, content: moduleDraft, is_active: def.required ? true : false, title: def.title, required: def.required })} disabled={saveModule.isPending}>
                        {saveModule.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Salvar{def.required ? ' e ativar' : ''}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingModule(null)}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditingModule(def.module_key); setModuleDraft(stored?.content || ''); }}>
                      {stored?.content ? 'Editar conteúdo' : 'Cadastrar conteúdo'}
                    </Button>
                    {def.required && (stored?.content || '').trim() && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => toggleModuleActive(def.module_key)}>
                        <Power className="h-3 w-3" /> {stored?.is_active ? 'Desativar' : 'Ativar'}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-[11px] text-muted-foreground">O módulo de PDF permanece armazenado, mas não é carregado na geração (esta etapa é somente Markdown).</p>
        </CardContent>
      </Card>
    </div>
  );
}
