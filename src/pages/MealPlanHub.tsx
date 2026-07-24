// Hub central do plano alimentar do atleta.
// Rota: /meal-plans/:clientId/hub
// - Cards de acesso rápido às informações do atleta (dados, anamnese,
//   check-ins, avaliações, exames).
// - Histórico do plano alimentar: rascunho local (não salvo) e planos salvos
//   com data. O botão "Voltar" nas telas filhas retorna aqui.

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
import {
  parseRaw, readSavedPlans, countMeals, variationCount, planTotals,
  duplicatePlan, setActivePlan, genPlanId, removeSavedPlan, removeAttachedPlan,
  type SavedPlan,
} from '@/lib/planHistory';

type DraftPreview = { hasDraft: boolean; days: number; chars: number } | null;

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

  const { data: analysisRow } = useQuery({
    queryKey: ['meal-plan-hub-analysis', clientId],
    enabled: !!clientId,
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

  // Histórico de planos salvos (fallback: sintetiza uma entrada do meal_plan
  // canônico quando ainda não há histórico — planos salvos antes desta versão).
  const savedPlans: SavedPlan[] = useMemo(() => {
    const list = readSavedPlans(rawObj);
    if (list.length) return list;
    const mp = rawObj?.meal_plan;
    if (mp && countMeals(mp) > 0) {
      return [{
        id: rawObj.active_plan_id || 'legacy',
        label: 'Plano atual',
        savedAt: analysisRow?.updated_at || new Date().toISOString(),
        meal_plan: mp,
        sent_to_zona_nutri: !!rawObj?.zona_nutri_sent_at,
        sent_at: rawObj?.zona_nutri_sent_at || null,
      }];
    }
    return [];
  }, [rawObj, analysisRow]);

  // Planos salvos pela área "Anexar plano" (texto livre) — histórico separado.
  const attachedPlans = useMemo(() => {
    const list = Array.isArray(rawObj?.attached_plans) ? rawObj.attached_plans : [];
    // Enviados ao Zona Nutri primeiro (envio mais recente no topo); depois o resto por data.
    return [...list].sort((a: any, b: any) => {
      const as = a?.sent_to_zona_nutri ? (a.sent_at || a.date || '') : '';
      const bs = b?.sent_to_zona_nutri ? (b.sent_at || b.date || '') : '';
      if (as && bs) return String(bs).localeCompare(String(as));
      if (as) return -1;
      if (bs) return 1;
      return String(b?.date || '').localeCompare(String(a?.date || ''));
    });
  }, [rawObj]);

  // Pedido para abrir um plano anexado no painel "Anexar plano".
  const [openAttached, setOpenAttached] = useState<{ id: string; nonce: number } | undefined>(undefined);
  const openAttachedPlan = (id: string) => setOpenAttached({ id, nonce: Date.now() });

  const draft = useMemo(() => readDraft(clientId), [clientId, analysisRow]);

  // Persiste o rawObj (coluna TEXT → JSON string) e atualiza a UI.
  const persistRaw = async (nextRaw: any) => {
    if (analysisRow?.id) {
      const { error } = await supabase.from('ai_analyses')
        .update({ raw_response: JSON.stringify(nextRaw), updated_at: new Date().toISOString() })
        .eq('id', analysisRow.id);
      if (error) throw error;
    } else {
      const { error } = await (supabase as any).from('ai_analyses')
        .insert({ client_id: clientId, raw_response: JSON.stringify(nextRaw) });
      if (error) throw error;
    }
    await qc.invalidateQueries({ queryKey: ['meal-plan-hub-analysis', clientId] });
    qc.invalidateQueries({ queryKey: ['meal-plan-editor-row', clientId] });
    qc.invalidateQueries({ queryKey: ['ai_analysis', clientId] });
  };

  const openEditor = () => navigate(`/meal-plans/${clientId}/editor`);

  // Garante que saved_plans exista (materializa o histórico legado) e retorna
  // { raw, id } com o id real da entrada equivalente a `sp`.
  const ensureMaterialized = (sp: SavedPlan): { raw: any; id: string } => {
    if (Array.isArray(rawObj?.saved_plans) && rawObj.saved_plans.length) {
      return { raw: rawObj, id: sp.id };
    }
    const id = sp.id && sp.id !== 'legacy' ? sp.id : genPlanId();
    const raw = { ...rawObj, saved_plans: [{ ...sp, id }], active_plan_id: id };
    return { raw, id };
  };

  // Abre um plano salvo para edição (torna-o o plano ativo do editor).
  const editPlan = async (sp: SavedPlan) => {
    setBusyId(sp.id);
    try {
      const { raw, id } = ensureMaterialized(sp);
      const next = setActivePlan(raw, id) ?? raw;
      await persistRaw(next);
      navigate(`/meal-plans/${clientId}/editor`);
    } catch (e: any) {
      toast.error(e.message || 'Não foi possível abrir o plano.');
    } finally { setBusyId(null); }
  };

  // Exclui um plano do histórico do editor.
  const deleteSaved = async (sp: SavedPlan) => {
    if (!window.confirm(`Excluir "${sp.label}"? Esta ação não pode ser desfeita.`)) return;
    setBusyId(sp.id);
    try {
      // Materializa o histórico legado antes de excluir (para persistir corretamente).
      const base = (Array.isArray(rawObj?.saved_plans) && rawObj.saved_plans.length)
        ? rawObj
        : { ...rawObj, saved_plans: savedPlans.map((p) => ({ ...p, id: p.id === 'legacy' ? genPlanId() : p.id })) };
      const realId = sp.id === 'legacy' ? base.saved_plans[0]?.id : sp.id;
      await persistRaw(removeSavedPlan(base, realId));
      toast.success('Plano excluído.');
    } catch (e: any) {
      toast.error(e.message || 'Não foi possível excluir o plano.');
    } finally { setBusyId(null); }
  };

  // Exclui um plano anexado (texto livre) do histórico.
  const deleteAttached = async (id: string, label?: string) => {
    if (!window.confirm(`Excluir "${label || 'plano anexado'}"? Esta ação não pode ser desfeita.`)) return;
    setBusyId(id);
    try {
      await persistRaw(removeAttachedPlan(rawObj, id));
      toast.success('Plano excluído.');
    } catch (e: any) {
      toast.error(e.message || 'Não foi possível excluir o plano.');
    } finally { setBusyId(null); }
  };

  // Duplica um plano salvo (nova cópia editável, sem envio) e abre no editor.
  const duplicate = async (sp: SavedPlan) => {
    setBusyId(sp.id);
    try {
      const { raw, id } = ensureMaterialized(sp);
      const dup = duplicatePlan(raw, id);
      if (!dup) { toast.error('Não foi possível duplicar.'); return; }
      await persistRaw(dup.raw);
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
                    {attachedPlans.map((p: any) => (
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
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground flex-wrap">
                              {p.date && (
                                <span className="flex items-center gap-1">
                                  <CalendarClock className="h-3 w-3" />
                                  {format(parseISO(p.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </span>
                              )}
                              {p.totals?.meals > 0 && <span>· {p.totals.meals} refeição{p.totals.meals > 1 ? 'ões' : ''}</span>}
                              {p.totals?.kcal > 0 && <span>· ~{p.totals.kcal} kcal</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2 pl-12">
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => openAttachedPlan(p.id)}>
                            <Pencil className="h-3 w-3" /> Abrir no anexar plano
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-destructive hover:text-destructive" disabled={busyId === p.id} onClick={() => deleteAttached(p.id, p.label)}>
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
