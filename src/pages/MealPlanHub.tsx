// Hub central do plano alimentar do atleta.
// Rota: /meal-plans/:clientId/hub
// - Cards de acesso rápido às informações do atleta (dados, anamnese,
//   check-ins, avaliações, exames).
// - Histórico do plano alimentar: rascunho local (não salvo) e planos salvos
//   com data. O botão "Voltar" nas telas filhas retorna aqui.
//
// ETAPA 6B: histórico de "Planos salvos" e "Anexar plano" migrado para
// `meal_plan_versions` (via useMealPlanVersions). `ai_analyses.raw_response`
// só é lido como FALLBACK read-only (atletas ainda não migrados) — nunca
// mais gravado por este arquivo.

import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  ArrowLeft, User, ClipboardCheck, MessageCircle, TrendingUp, FlaskConical,
  FileEdit, Utensils, Pencil, CalendarClock, ChevronRight, PlusCircle, History,
  Copy, Send, Loader2, Trash2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AttachedPlanPanel } from '@/components/admin/AttachedPlanPanel';
import { MealPlanLinksCard } from '@/components/admin/MealPlanLinksCard';
import { PlanVersionsCard } from '@/components/mealplan/PlanVersionsCard';
import {
  parseRaw, readSavedPlans, countMeals, variationCount, planTotals,
  type SavedPlan,
} from '@/lib/planHistory';
import { saveWorkingPlan, versionToRaw } from '@/lib/planStore';
import { useMealPlanVersions, useCreateMealPlanVersion, mealPlanVersionsKey } from '@/hooks/useMealPlanVersions';
import { logOperationalEvent } from '@/lib/operationalEvents';
import type { MealPlanVersion } from '@/lib/mealPlanCore';

type DraftPreview = { hasDraft: boolean; days: number; chars: number } | null;

// Entrada de "Plano salvo" exibida no card — pode vir de uma versão canônica
// (meal_plan_versions) ou, em fallback, de um registro legado read-only.
interface DisplayPlan extends SavedPlan {
  legacy: boolean;
  versionId: string | null;
  statusLabel?: string;
}

interface DisplayAttached {
  id: string;
  versionId: string | null;
  legacy: boolean;
  date: string;
  label: string;
  sent_to_zona_nutri: boolean;
  sent_at: string | null;
  totals?: { kcal?: number; meals?: number };
}

function readDraft(clientId?: string): DraftPreview {
  if (!clientId) return null;
  try {
    const raw = localStorage.getItem(`smart-plan-draft-v2:${clientId}`);
    if (!raw) return null;
    const obj = JSON.parse(raw) as Record<string, string>;
    const filled = Object.entries(obj).filter(([, v]) => (v || '').trim().length > 0);
    if (!filled.length) return null;
    const chars = filled.reduce((s, [, v]) => s + v.length, 0);
    return { hasDraft: true, days: filled.length, chars };
  } catch { return null; }
}

export default function MealPlanHub() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();

  const { data: client } = useQuery({
    queryKey: ['meal-plan-hub-client', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id,name,plan_type').eq('id', clientId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  // Núcleo canônico: versões do plano deste atleta.
  const { data: versions = [], isLoading: versionsLoading } = useMealPlanVersions(clientId);
  const createVersion = useCreateMealPlanVersion();
  const hasCanonicalHistory = versions.length > 0;

  // Fallback legado READ-ONLY — só é consultado quando não há nenhuma versão
  // canônica ainda (atleta não migrado). Nunca é gravado de volta.
  const { data: analysisRow } = useQuery({
    queryKey: ['meal-plan-hub-analysis', clientId],
    enabled: !!clientId && !versionsLoading && !hasCanonicalHistory,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_analyses')
        .select('id, updated_at, created_at, raw_response')
        .eq('client_id', clientId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const rawObj = useMemo(() => parseRaw(analysisRow?.raw_response), [analysisRow]);

  // Registra (uma vez por carga) o uso do fallback legado, sem conteúdo clínico.
  useMemo(() => {
    if (!clientId || versionsLoading || hasCanonicalHistory) return;
    if (!analysisRow) return;
    const hasLegacyContent = !!rawObj?.saved_plans?.length || !!rawObj?.attached_plans?.length || !!rawObj?.meal_plan;
    if (hasLegacyContent) {
      void logOperationalEvent({
        clientId,
        entityType: 'meal_plan',
        entityId: clientId,
        eventType: 'legacy_meal_plan_fallback_used',
        metadata: { surface: 'meal-plan-hub', ai_analysis_id: analysisRow.id },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, versionsLoading, hasCanonicalHistory, analysisRow]);

  // Versões canônicas do "editor inteligente" (tudo exceto planos anexados),
  // já excluindo arquivadas.
  const savedPlans: DisplayPlan[] = useMemo(() => {
    if (hasCanonicalHistory) {
      return versions
        .filter((v) => v.source !== 'attached_plan' && v.status !== 'archived')
        .map((v): DisplayPlan => ({
          id: v.id,
          versionId: v.id,
          legacy: v.source === 'legacy_import',
          label: v.source === 'legacy_import' ? `Versão migrada (v${v.version_number})` : `v${v.version_number}`,
          savedAt: v.published_at || v.created_at,
          meal_plan: v.content as any,
          sent_to_zona_nutri: !!(v.metadata as any)?.zona_nutri_sent_at,
          sent_at: (v.metadata as any)?.zona_nutri_sent_at || null,
          statusLabel: v.status,
        }));
    }
    // Fallback legado (read-only).
    const list = readSavedPlans(rawObj);
    if (list.length) return list.map((p) => ({ ...p, legacy: true, versionId: null }));
    const mp = rawObj?.meal_plan;
    if (mp && countMeals(mp) > 0) {
      return [{
        id: rawObj.active_plan_id || 'legacy',
        legacy: true,
        versionId: null,
        label: 'Plano atual (legado)',
        savedAt: analysisRow?.updated_at || new Date().toISOString(),
        meal_plan: mp,
        sent_to_zona_nutri: !!rawObj?.zona_nutri_sent_at,
        sent_at: rawObj?.zona_nutri_sent_at || null,
      }];
    }
    return [];
  }, [versions, hasCanonicalHistory, rawObj, analysisRow]);

  // Planos salvos pela área "Anexar plano" (texto livre) — versões com
  // source='attached_plan', ou fallback legado (attached_plans[]).
  const attachedPlans: DisplayAttached[] = useMemo(() => {
    if (hasCanonicalHistory) {
      const list = versions
        .filter((v) => v.source === 'attached_plan' && v.status !== 'archived')
        .map((v): DisplayAttached => ({
          id: v.id,
          versionId: v.id,
          legacy: false,
          date: v.created_at,
          label: (v.metadata as any)?.label || `Plano v${v.version_number}`,
          sent_to_zona_nutri: !!(v.metadata as any)?.zona_nutri_sent_at,
          sent_at: (v.metadata as any)?.zona_nutri_sent_at || null,
          totals: (v.metadata as any)?.totals,
        }));
      return [...list].sort((a, b) => {
        const as = a.sent_to_zona_nutri ? (a.sent_at || a.date || '') : '';
        const bs = b.sent_to_zona_nutri ? (b.sent_at || b.date || '') : '';
        if (as && bs) return String(bs).localeCompare(String(as));
        if (as) return -1;
        if (bs) return 1;
        return String(b.date || '').localeCompare(String(a.date || ''));
      });
    }
    const list = Array.isArray(rawObj?.attached_plans) ? rawObj.attached_plans : [];
    const mapped: DisplayAttached[] = list.map((p: any) => ({
      id: p.id,
      versionId: null,
      legacy: true,
      date: p.date,
      label: p.label,
      sent_to_zona_nutri: !!p.sent_to_zona_nutri,
      sent_at: p.sent_at || null,
      totals: p.totals,
    }));
    return [...mapped].sort((a, b) => {
      const as = a.sent_to_zona_nutri ? (a.sent_at || a.date || '') : '';
      const bs = b.sent_to_zona_nutri ? (b.sent_at || b.date || '') : '';
      if (as && bs) return String(bs).localeCompare(String(as));
      if (as) return -1;
      if (bs) return 1;
      return String(b.date || '').localeCompare(String(a.date || ''));
    });
  }, [versions, hasCanonicalHistory, rawObj]);

  // Pedido para abrir um plano anexado no painel "Anexar plano".
  const [openAttached, setOpenAttached] = useState<{ id: string; nonce: number } | undefined>(undefined);
  const openAttachedPlan = (id: string) => setOpenAttached({ id, nonce: Date.now() });

  const draft = useMemo(() => readDraft(clientId), [clientId, analysisRow]);

  const openEditor = () => navigate(`/meal-plans/${clientId}/editor`);

  // Abre uma versão para edição: garante um draft de trabalho derivado dela e
  // navega para o editor (nunca edita a versão publicada in-place).
  const editPlan = async (p: DisplayPlan) => {
    if (!clientId) return;
    setBusyId(p.id);
    try {
      if (!p.legacy) {
        await saveWorkingPlan({
          clientId,
          raw: versionToRaw(versions.find((v) => v.id === p.versionId) || undefined),
          source: 'manual_editor',
        });
        await qc.invalidateQueries({ queryKey: mealPlanVersionsKey(clientId) });
      }
      navigate(`/meal-plans/${clientId}/editor`);
    } catch (e: any) {
      toast.error(e.message || 'Não foi possível abrir o plano.');
    } finally { setBusyId(null); }
  };

  // Exclui (arquiva) uma versão do histórico. Versões publicadas nunca são
  // arquivadas/excluídas — a base bloqueia e mantém a história intacta.
  const deleteSaved = async (p: DisplayPlan) => {
    if (p.legacy) {
      toast.error('Este registro é legado (somente leitura) e não pode ser excluído por aqui.');
      return;
    }
    if (p.statusLabel === 'published') {
      toast.error('Uma versão publicada não pode ser excluída — ela é o histórico oficial do atleta.');
      return;
    }
    if (!window.confirm(`Excluir "${p.label}"? Esta ação não pode ser desfeita.`)) return;
    setBusyId(p.id);
    try {
      const { error } = await (supabase as any)
        .from('meal_plan_versions')
        .update({ status: 'archived' })
        .eq('id', p.versionId)
        .in('status', ['draft', 'reviewed']);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: mealPlanVersionsKey(clientId) });
      toast.success('Plano excluído.');
    } catch (e: any) {
      toast.error(e.message || 'Não foi possível excluir o plano.');
    } finally { setBusyId(null); }
  };

  // Exclui (arquiva) um plano anexado do histórico.
  const deleteAttached = async (p: DisplayAttached) => {
    if (p.legacy) {
      toast.error('Este registro é legado (somente leitura) e não pode ser excluído por aqui.');
      return;
    }
    if (!window.confirm(`Excluir "${p.label || 'plano anexado'}"? Esta ação não pode ser desfeita.`)) return;
    setBusyId(p.id);
    try {
      const { error } = await (supabase as any)
        .from('meal_plan_versions')
        .update({ status: 'archived' })
        .eq('id', p.versionId)
        .in('status', ['draft', 'reviewed']);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: mealPlanVersionsKey(clientId) });
      toast.success('Plano excluído.');
    } catch (e: any) {
      toast.error(e.message || 'Não foi possível excluir o plano.');
    } finally { setBusyId(null); }
  };

  // Duplica uma versão (nova draft editável, sem envio) e abre no editor.
  const duplicate = async (p: DisplayPlan) => {
    if (!clientId) return;
    if (p.legacy) {
      toast.error('Este registro é legado; abra-o no editor e salve para criar uma versão editável.');
      return;
    }
    setBusyId(p.id);
    try {
      const src = versions.find((v) => v.id === p.versionId);
      if (!src) throw new Error('Versão não encontrada.');
      await createVersion.mutateAsync({
        clientId,
        content: src.content,
        orientations: src.orientations,
        source: src.source,
        parentVersionId: src.id,
        metadata: { ...(src.metadata || {}), zona_nutri_sent_at: undefined },
      });
      toast.success('Plano duplicado. Abrindo cópia para edição.');
      navigate(`/meal-plans/${clientId}/editor`);
    } catch (e: any) {
      toast.error(e.message || 'Não foi possível duplicar o plano.');
    } finally { setBusyId(null); }
  };

  const openClientTab = (tab?: string) => {
    const params = new URLSearchParams();
    params.set('from', 'meal-plan-hub');
    if (tab) params.set('tab', tab);
    navigate(`/clients/${clientId}?${params.toString()}`);
  };

  const actions: Array<{ icon: any; title: string; desc: string; onClick: () => void }> = [
    { icon: User, title: 'Dados do atleta', desc: 'Perfil, plano, contato', onClick: () => openClientTab() },
    { icon: ClipboardCheck, title: 'Anamnese', desc: 'Respostas do formulário', onClick: () => openClientTab('anamnese') },
    { icon: MessageCircle, title: 'Histórico de check-ins', desc: 'Respostas recebidas', onClick: () => openClientTab('history') },
    { icon: TrendingUp, title: 'Avaliações', desc: 'Composição corporal (PDF/IA ou manual)', onClick: () => navigate(`/meal-plans/${clientId}/assessments`) },
    { icon: FlaskConical, title: 'Exames', desc: 'Pedido e resultados laboratoriais', onClick: () => navigate(`/meal-plans/${clientId}/lab-exams`) },
  ];

  return (
    <Layout>
      <div className="max-w-[1100px] mx-auto p-3 md:p-6 space-y-6">
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/meal-plans')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar aos atletas
          </Button>
          <div className="text-right">
            <h1 className="text-lg md:text-xl font-bold">Plano alimentar</h1>
            <p className="text-xs text-muted-foreground">{client?.name || '—'}</p>
          </div>
        </div>

        {/* Grid de acessos rápidos */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Informações do atleta</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {actions.map((a) => (
              <button
                key={a.title}
                onClick={a.onClick}
                className="w-full flex items-center gap-3 rounded-xl border bg-card p-4 text-left hover:bg-accent/50 transition-colors"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <a.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.desc}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Links de acesso rápido */}
        {clientId && <MealPlanLinksCard clientId={clientId} />}

        {/* Versões canônicas (Etapa 3A) */}
        {clientId && <PlanVersionsCard clientId={clientId} />}


        {/* Histórico de plano alimentar */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Plano alimentar</h2>
          <div className="space-y-3">
            {/* Rascunho */}
            <Card className={draft?.hasDraft ? 'border-amber-500/40' : ''}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileEdit className="h-4 w-4 text-amber-600" />
                  Rascunho em edição
                  {draft?.hasDraft && (
                    <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600">
                      Não salvo
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3">
                {draft?.hasDraft ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Você tem um rascunho local em <b>{draft.days}</b> aba{draft.days > 1 ? 's' : ''} do editor
                      ({draft.chars.toLocaleString('pt-BR')} caracteres). Ele fica salvo no seu navegador até que você
                      clique em "Salvar plano".
                    </p>
                    <Button onClick={openEditor}>
                      <Pencil className="h-4 w-4 mr-2" /> Continuar rascunho
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">Nenhum rascunho em andamento.</p>
                    <Button variant="outline" onClick={openEditor}>
                      <PlusCircle className="h-4 w-4 mr-2" /> Abrir editor
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Planos salvos */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  Planos salvos ({savedPlans.length + attachedPlans.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {savedPlans.length === 0 && attachedPlans.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Utensils className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Nenhum plano salvo ainda.</p>
                    <Button className="mt-3" onClick={openEditor}>
                      <PlusCircle className="h-4 w-4 mr-2" /> Criar primeiro plano
                    </Button>
                  </div>
                )}

                {/* Grupo 1 — planos do Editor inteligente */}
                {savedPlans.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <Utensils className="h-3 w-3" /> Do editor inteligente
                    </p>
                    {savedPlans.map((p) => {
                      const meals = countMeals(p.meal_plan);
                      const vars = variationCount(p.meal_plan);
                      const t = planTotals(p.meal_plan);
                      const sent = !!p.sent_to_zona_nutri;
                      return (
                        <div
                          key={p.id}
                          className={`rounded-lg border p-3 transition-colors ${sent ? 'border-emerald-500/60 bg-emerald-500/5 ring-1 ring-emerald-500/30' : 'hover:bg-accent/50'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${sent ? 'bg-emerald-500/20 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                              {sent ? <Send className="h-4 w-4" /> : <Utensils className="h-4 w-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-sm truncate">{p.label}</p>
                                {sent && (
                                  <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600">
                                    Enviado ao Zona Nutri
                                  </Badge>
                                )}
                                {p.legacy && (
                                  <Badge variant="outline" className="text-[10px] border-muted-foreground/40 text-muted-foreground">
                                    Legado
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground flex-wrap">
                                <span className="flex items-center gap-1">
                                  <CalendarClock className="h-3 w-3" />
                                  {format(parseISO(p.savedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </span>
                                {meals > 0 && <span>· {meals} refeição{meals > 1 ? 'ões' : ''}</span>}
                                {vars > 0 && <span>· {vars} variação{vars > 1 ? 'ões' : ''} de dia</span>}
                                {t.kcal > 0 && <span>· ~{t.kcal} kcal</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-2 pl-12">
                            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={busyId === p.id} onClick={() => editPlan(p)}>
                              {busyId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pencil className="h-3 w-3" />} Abrir no editor
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" disabled={busyId === p.id} onClick={() => duplicate(p)}>
                              <Copy className="h-3 w-3" /> Duplicar para ajustar
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-destructive hover:text-destructive" disabled={busyId === p.id} onClick={() => deleteSaved(p)}>
                              <Trash2 className="h-3 w-3" /> Excluir
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Grupo 2 — planos da área "Anexar plano" (texto livre / MD) */}
                {attachedPlans.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <FileEdit className="h-3 w-3" /> Do anexar plano (texto livre)
                    </p>
                    {attachedPlans.map((p) => (
                      <div key={p.id} className={`rounded-lg border p-3 transition-colors ${p.sent_to_zona_nutri ? 'border-emerald-500/60 bg-emerald-500/5 ring-1 ring-emerald-500/30' : 'hover:bg-accent/50'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${p.sent_to_zona_nutri ? 'bg-emerald-500/20 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                            {p.sent_to_zona_nutri ? <Send className="h-4 w-4" /> : <FileEdit className="h-4 w-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm truncate">{p.label || 'Plano anexado'}</p>
                              <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600">Texto livre</Badge>
                              {p.sent_to_zona_nutri && <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600">Enviado ao Zona Nutri</Badge>}
                              {p.legacy && (
                                <Badge variant="outline" className="text-[10px] border-muted-foreground/40 text-muted-foreground">
                                  Legado
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground flex-wrap">
                              {p.date && (
                                <span className="flex items-center gap-1">
                                  <CalendarClock className="h-3 w-3" />
                                  {format(parseISO(p.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </span>
                              )}
                              {(p.totals?.meals || 0) > 0 && <span>· {p.totals!.meals} refeição{(p.totals!.meals || 0) > 1 ? 'ões' : ''}</span>}
                              {(p.totals?.kcal || 0) > 0 && <span>· ~{p.totals!.kcal} kcal</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2 pl-12">
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => openAttachedPlan(p.id)}>
                            <Pencil className="h-3 w-3" /> Abrir no anexar plano
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-destructive hover:text-destructive" disabled={busyId === p.id} onClick={() => deleteAttached(p)}>
                            <Trash2 className="h-3 w-3" /> Excluir
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Anexar plano (texto livre) — histórico, comparação e envio ao Zona Nutri */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Anexar plano</h2>
          {clientId && <AttachedPlanPanel clientId={clientId} openRequest={openAttached} />}
        </div>
      </div>
    </Layout>
  );
}
