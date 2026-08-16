import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Paperclip, Sparkles, Save, Send, Loader2, ChevronDown, History,
  FileText, ListChecks, TrendingUp, ArrowRight,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { logOperationalEvent } from '@/lib/operationalEvents';

const WEEKDAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
const DAY_LABEL: Record<string, string> = {
  seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sáb', dom: 'Dom',
};

interface DayMacro { day: string; kcal: number; cho_g: number; protein_g: number; fat_g: number; meals: number }
interface Totals { kcal: number; cho_g: number; protein_g: number; fat_g: number; meals: number }
interface AttachedPlan {
  id: string;
  versionId: string | null;
  legacy: boolean;
  date: string;          // ISO
  label: string;
  text: string;
  orientations: string;
  summary: string;
  totals: Totals;
  per_day: DayMacro[];
  meal_names: string[];
  version: number;
  sent_to_zona_nutri?: boolean;
  sent_at?: string | null;
}

const EMPTY_TOTALS: Totals = { kcal: 0, cho_g: 0, protein_g: 0, fat_g: 0, meals: 0 };

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return iso; }
}

// Delta com sinal para comparação plano-a-plano.
function Delta({ curr, prev, unit }: { curr: number; prev?: number; unit?: string }) {
  if (prev == null) return <span className="text-muted-foreground">—</span>;
  const d = Math.round((curr - prev) * 10) / 10;
  if (d === 0) return <span className="text-muted-foreground">= {curr}{unit}</span>;
  const up = d > 0;
  return (
    <span className={up ? 'text-emerald-600' : 'text-amber-600'}>
      {curr}{unit} <span className="text-xs">({up ? '+' : ''}{d})</span>
    </span>
  );
}

export function AttachedPlanPanel({
  clientId,
  openRequest,
}: {
  clientId: string;
  analysisRow?: any;
  // Pedido externo (do hub) para abrir um plano anexado específico para edição.
  openRequest?: { id: string; nonce: number };
}) {
  const queryClient = useQueryClient();
  const cardRef = useRef<HTMLDivElement>(null);

  // ETAPA 6B: histórico dos planos anexados vive em `meal_plan_versions`
  // (source='attached_plan'). `ai_analyses.raw_response` só é lido como
  // fallback read-only quando o atleta ainda não tem nenhuma versão anexada.
  const sortAttached = (list: AttachedPlan[]) => [...list].sort((a, b) => {
    const as = a.sent_to_zona_nutri ? (a.sent_at || a.date || '') : '';
    const bs = b.sent_to_zona_nutri ? (b.sent_at || b.date || '') : '';
    if (as && bs) return bs.localeCompare(as);
    if (as) return -1;
    if (bs) return 1;
    return (b.date || '').localeCompare(a.date || '');
  });

  const dbVersionToAttached = (v: any): AttachedPlan => {
    const meta = v.metadata || {};
    return {
      id: v.id,
      versionId: v.id,
      legacy: false,
      date: meta.date || v.created_at,
      label: meta.label || `Plano v${v.version_number}`,
      text: v.content?.text || '',
      orientations: v.orientations || meta.orientations || '',
      summary: meta.summary || '',
      totals: { ...EMPTY_TOTALS, ...(meta.totals || {}) },
      per_day: meta.per_day || [],
      meal_names: meta.meal_names || [],
      version: v.version_number,
      sent_to_zona_nutri: !!meta.zona_nutri_sent_at,
      sent_at: meta.zona_nutri_sent_at || null,
    };
  };

  const { data: history = [], refetch } = useQuery({
    queryKey: ['attached-plans', clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<AttachedPlan[]> => {
      const { data, error } = await (supabase as any)
        .from('meal_plan_versions')
        .select('*')
        .eq('client_id', clientId)
        .eq('source', 'attached_plan')
        .neq('status', 'archived')
        .order('version_number', { ascending: false });
      if (error) throw error;
      if (Array.isArray(data) && data.length > 0) {
        return sortAttached(data.map(dbVersionToAttached));
      }
      // Fallback legado read-only.
      const { data: row } = await supabase.from('ai_analyses').select('id, raw_response').eq('client_id', clientId).maybeSingle();
      try {
        const raw = typeof row?.raw_response === 'string' ? JSON.parse(row.raw_response) : row?.raw_response;
        const list = raw?.attached_plans;
        if (Array.isArray(list) && list.length > 0) {
          void logOperationalEvent({
            clientId,
            entityType: 'meal_plan',
            entityId: clientId,
            eventType: 'legacy_meal_plan_fallback_used',
            metadata: { surface: 'attached-plan-panel', ai_analysis_id: row?.id },
          });
          return sortAttached(list.map((p: any) => ({ ...p, versionId: null, legacy: true })));
        }
        return [];
      } catch { return []; }
    },
  });

  const [text, setText] = useState('');
  const [orientations, setOrientations] = useState('');
  const [label, setLabel] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [analysis, setAnalysis] = useState<{ summary: string; totals: Totals; per_day: DayMacro[]; meal_names: string[]; orientations: string } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [tab, setTab] = useState<'dados' | 'orientacoes' | 'evolucao'>('dados');

  const latest = history[0];
  const previous = history[1];

  // Carrega um plano anexado nos campos para edição (reusa texto + orientações).
  const loadPlan = (p: AttachedPlan, opts?: { scroll?: boolean; silent?: boolean }) => {
    setText(p.text || '');
    setOrientations(p.orientations || '');
    setLabel(p.label || '');
    setAnalysis({ summary: p.summary, totals: p.totals, per_day: p.per_day, meal_names: p.meal_names, orientations: p.orientations });
    if (opts?.scroll) cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (!opts?.silent) toast.info('Plano carregado para edição. "Salvar como novo" cria uma nova versão.');
  };

  // Atende o pedido do hub de abrir um plano anexado específico.
  useEffect(() => {
    if (!openRequest?.id) return;
    const p = history.find((h) => h.id === openRequest.id);
    if (p) loadPlan(p, { scroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRequest?.nonce, openRequest?.id, history]);

  const analyze = async () => {
    if (text.trim().length < 10) { toast.error('Cole o plano antes de analisar.'); return; }
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-attached-plan', { body: { text } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAnalysis({
        summary: data.summary || '',
        totals: { ...EMPTY_TOTALS, ...(data.totals || {}) },
        per_day: Array.isArray(data.per_day) ? data.per_day : [],
        meal_names: Array.isArray(data.meal_names) ? data.meal_names : [],
        orientations: data.orientations || '',
      });
      // Se o nutri não escreveu orientações à mão, sugere as extraídas.
      if (!orientations.trim() && data.orientations) setOrientations(data.orientations);
      toast.success('Plano analisado.');
    } catch (e: any) {
      toast.error(e.message || 'Falha ao analisar o plano.');
    } finally {
      setAnalyzing(false);
    }
  };

  // Grava o raw_response mesclando attached_plans (sem apagar meal_plan etc.).
  const persistAttached = async (nextList: AttachedPlan[]) => {
    const { data: row } = await supabase.from('ai_analyses').select('raw_response').eq('client_id', clientId).maybeSingle();
    let raw: any = {};
    try { raw = typeof row?.raw_response === 'string' ? JSON.parse(row.raw_response) : (row?.raw_response || {}); } catch { raw = {}; }
    raw.attached_plans = nextList;

    if (row) {
      const { error } = await supabase.from('ai_analyses')
        .update({ raw_response: JSON.stringify(raw), updated_at: new Date().toISOString() })
        .eq('client_id', clientId);
      if (error) throw error;
    } else {
      // Nenhuma análise ainda: cria a linha mínima com o histórico.
      const { data: prof } = await (supabase as any).from('athlete_profiles').select('id').eq('client_id', clientId).maybeSingle();
      const { error } = await supabase.from('ai_analyses').insert({
        client_id: clientId,
        athlete_profile_id: prof?.id ?? null,
        diagnosis: '',
        raw_response: JSON.stringify(raw),
      } as any);
      if (error) throw error;
    }
  };

  // Cada save é um NOVO plano (constrói histórico) — não edita o mesmo.
  const save = async () => {
    if (text.trim().length < 10) { toast.error('Cole o plano antes de salvar.'); return; }
    setSaving(true);
    try {
      let a = analysis;
      if (!a) {
        // Analisa na hora se ainda não o fez.
        const { data, error } = await supabase.functions.invoke('analyze-attached-plan', { body: { text } });
        if (!error && !data?.error && data) {
          a = {
            summary: data.summary || '', totals: { ...EMPTY_TOTALS, ...(data.totals || {}) },
            per_day: data.per_day || [], meal_names: data.meal_names || [], orientations: data.orientations || '',
          };
        }
      }
      const now = new Date();
      const version = (history[0]?.version ?? 0) + 1;
      const entry: AttachedPlan = {
        id: `${now.getTime()}-${version}`,
        date: now.toISOString(),
        label: label.trim() || `Plano v${version} — ${fmtDate(now.toISOString())}`,
        text,
        orientations: orientations.trim() || a?.orientations || '',
        summary: a?.summary || '',
        totals: a?.totals || EMPTY_TOTALS,
        per_day: a?.per_day || [],
        meal_names: a?.meal_names || [],
        version,
      };
      await persistAttached([entry, ...history]);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['ai_analysis', clientId] });
      queryClient.invalidateQueries({ queryKey: ['meal-plan-hub-analysis', clientId] });
      toast.success(`Plano salvo (v${version}). Histórico atualizado.`);
      // Limpa o editor para o próximo — cada save é um novo plano.
      setText(''); setOrientations(''); setLabel(''); setAnalysis(null);
      setHistoryOpen(true);
    } catch (e: any) {
      toast.error(e.message || 'Falha ao salvar o plano.');
    } finally {
      setSaving(false);
    }
  };

  // Envia ao Zona Nutri: estrutura o texto (import-meal-plan) e distribui por dia
  // (send-...). Registra o plano enviado no histórico e o DESTACA (apenas um por
  // vez fica destacado); o anterior perde o destaque.
  const sendToZn = async () => {
    if (text.trim().length < 10) { toast.error('Cole o plano antes de enviar.'); return; }
    setSending(true);
    try {
      const { data: imp, error: impErr } = await supabase.functions.invoke('import-meal-plan', {
        body: { clientId, planText: text },
      });
      if (impErr) throw impErr;
      if (imp?.error) throw new Error(imp.error);

      const { data, error } = await supabase.functions.invoke('send-meal-plan-to-zona-nutri', {
        body: { clientId },
      });
      if (error) {
        let detail = '';
        try { const body = await (error as any).context?.json?.(); detail = body?.error || body?.message || ''; } catch { /* ignore */ }
        throw new Error(detail || error.message || 'Falha no envio.');
      }
      if (data?.error) throw new Error(data.error);

      // Registra/atualiza o plano enviado no histórico de anexados e o destaca.
      try {
        const now = new Date().toISOString();
        // Se o texto atual bate com um plano já salvo, marca esse; senão, cria um.
        const existing = history.find((h) => (h.text || '').trim() === text.trim());
        let list: AttachedPlan[];
        if (existing) {
          list = history.map((h) => h.id === existing.id
            ? { ...h, sent_to_zona_nutri: true, sent_at: now }
            : { ...h, sent_to_zona_nutri: false });
        } else {
          const version = (history[0]?.version ?? 0) + 1;
          const entry: AttachedPlan = {
            id: `${Date.now()}-${version}`, date: now,
            label: label.trim() || `Plano v${version} — ${fmtDate(now)}`,
            text, orientations: orientations.trim() || analysis?.orientations || '',
            summary: analysis?.summary || '', totals: analysis?.totals || EMPTY_TOTALS,
            per_day: analysis?.per_day || [], meal_names: analysis?.meal_names || [], version,
            sent_to_zona_nutri: true, sent_at: now,
          };
          list = [entry, ...history.map((h) => ({ ...h, sent_to_zona_nutri: false }))];
        }
        await persistAttached(list);
        await refetch();
      } catch { /* não bloqueia o sucesso do envio */ }

      queryClient.invalidateQueries({ queryKey: ['ai_analysis', clientId] });
      queryClient.invalidateQueries({ queryKey: ['meal-plan-hub-analysis', clientId] });
      toast.success('Plano enviado ao Zona Nutri e destacado no histórico!');
    } catch (e: any) {
      toast.error(e.message || 'Falha ao enviar ao Zona Nutri.');
    } finally {
      setSending(false);
    }
  };

  // Série de evolução (ordem cronológica) para os gráficos.
  const evoData = useMemo(() => {
    return [...history].reverse().map((p) => ({
      name: `v${p.version}`,
      kcal: p.totals?.kcal || 0,
      cho: p.totals?.cho_g || 0,
      prot: p.totals?.protein_g || 0,
      fat: p.totals?.fat_g || 0,
    }));
  }, [history]);

  const shown = analysis ? {
    summary: analysis.summary, totals: analysis.totals, per_day: analysis.per_day, meal_names: analysis.meal_names,
  } : latest ? {
    summary: latest.summary, totals: latest.totals, per_day: latest.per_day, meal_names: latest.meal_names,
  } : null;

  // Baseline de comparação: se há um rascunho de análise, compara com o último
  // salvo; senão (mostrando o último salvo), compara com o anterior a ele.
  const baseline = analysis ? latest : previous;

  return (
    <Card ref={cardRef} id="anexar-plano" className="border-primary/30 scroll-mt-4">
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-primary" /> Anexar plano (texto livre + orientações)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <p className="text-xs text-muted-foreground">
          Cole aqui um plano existente <strong>com as orientações</strong>. Você pode editar, <strong>analisar</strong> (a IA extrai
          resumo, calorias, carboidrato, refeições e dados por dia da semana), <strong>salvar</strong> (cada salvamento vira um
          <strong> novo plano</strong> no histórico) e <strong>enviar ao Zona Nutri</strong> (ele traduz e distribui pelos dias).
        </p>

        {/* Editor de texto do plano */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Plano alimentar (texto)</label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder={'Ex.:\nSEGUNDA A SEXTA\nCafé da manhã (07h) — 2 fatias de pão, 2 ovos, café\nAlmoço (12h) — arroz, feijão, frango 150g, salada\n...\n\nSÁBADO E DOMINGO\n...'}
            className="font-mono text-xs"
          />
        </div>

        {/* Orientações do plano */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Orientações deste plano</label>
          <Textarea
            value={orientations}
            onChange={(e) => setOrientations(e.target.value)}
            rows={4}
            placeholder="Hidratação, suplementos, horários, observações... (salvas junto com o plano para comparação plano a plano)"
            className="text-sm"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-muted-foreground">Rótulo do plano (opcional)</label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: Ajuste pós check-in de julho" className="text-sm h-9" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={analyze} disabled={analyzing || saving}>
              {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Analisar
            </Button>
            <Button className="gap-2" onClick={save} disabled={saving || analyzing}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar como novo
            </Button>
            <Button variant="secondary" className="gap-2" onClick={sendToZn} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar ao Zona Nutri
            </Button>
          </div>
        </div>

        {/* Dados extraídos (prévia da análise atual OU do último plano salvo) */}
        {shown && (
          <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
            <div className="inline-flex rounded-lg border p-0.5 bg-background text-xs">
              {([['dados', 'Dados', FileText], ['orientacoes', 'Orientações', ListChecks], ['evolucao', 'Evolução', TrendingUp]] as const).map(([k, lbl, Icon]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 ${tab === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                >
                  <Icon className="h-3.5 w-3.5" /> {lbl}
                </button>
              ))}
            </div>

            {tab === 'dados' && (
              <div className="space-y-3">
                {shown.summary && (
                  <div>
                    <span className="text-xs font-semibold text-foreground">Resumo</span>
                    <p className="text-sm text-foreground mt-0.5">{shown.summary}</p>
                  </div>
                )}
                {/* Totais do dia com comparação vs plano anterior */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {([
                    ['Calorias', shown.totals.kcal, baseline?.totals?.kcal, ' kcal'],
                    ['Carboidrato', shown.totals.cho_g, baseline?.totals?.cho_g, ' g'],
                    ['Proteína', shown.totals.protein_g, baseline?.totals?.protein_g, ' g'],
                    ['Gordura', shown.totals.fat_g, baseline?.totals?.fat_g, ' g'],
                    ['Refeições', shown.totals.meals, baseline?.totals?.meals, ''],
                  ] as const).map(([lbl, curr, prev, unit]) => (
                    <div key={lbl} className="rounded-md border bg-background p-2">
                      <div className="text-[11px] text-muted-foreground">{lbl}</div>
                      <div className="text-sm font-semibold"><Delta curr={curr} prev={prev} unit={unit} /></div>
                    </div>
                  ))}
                </div>
                {baseline && (
                  <p className="text-[11px] text-muted-foreground">Comparação em relação ao plano anterior (v{baseline.version} — {fmtDate(baseline.date)}).</p>
                )}
                {shown.meal_names.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {shown.meal_names.map((m, i) => <Badge key={i} variant="secondary" className="text-[11px]">{m}</Badge>)}
                  </div>
                )}
                {/* Dados por dia da semana */}
                {shown.per_day.length > 0 && (
                  <div className="rounded-md border overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2">Dia</th>
                          <th className="text-right p-2">kcal</th>
                          <th className="text-right p-2">CHO (g)</th>
                          <th className="text-right p-2">PTN (g)</th>
                          <th className="text-right p-2">GORD (g)</th>
                          <th className="text-right p-2">Refeições</th>
                        </tr>
                      </thead>
                      <tbody>
                        {WEEKDAYS.filter((d) => shown.per_day.some((p) => p.day === d)).map((d) => {
                          const row = shown.per_day.find((p) => p.day === d)!;
                          return (
                            <tr key={d} className="border-t">
                              <td className="p-2 font-medium">{DAY_LABEL[d]}</td>
                              <td className="p-2 text-right">{row.kcal}</td>
                              <td className="p-2 text-right">{row.cho_g}</td>
                              <td className="p-2 text-right">{row.protein_g}</td>
                              <td className="p-2 text-right">{row.fat_g}</td>
                              <td className="p-2 text-right">{row.meals}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {tab === 'orientacoes' && (
              <div className="space-y-2">
                <div>
                  <span className="text-xs font-semibold text-foreground">Orientações atuais</span>
                  <p className="text-sm text-foreground whitespace-pre-wrap mt-0.5">{orientations || latest?.orientations || '(sem orientações)'}</p>
                </div>
                {baseline?.orientations && (
                  <div className="rounded-md border bg-background p-2">
                    <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                      <ArrowRight className="h-3 w-3" /> Plano anterior (v{baseline.version} — {fmtDate(baseline.date)})
                    </span>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-0.5">{baseline.orientations}</p>
                  </div>
                )}
              </div>
            )}

            {tab === 'evolucao' && (
              evoData.length >= 2 ? (
                <div className="space-y-4">
                  <div>
                    <span className="text-xs font-semibold text-foreground">Evolução de calorias</span>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={evoData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="name" fontSize={11} />
                        <YAxis fontSize={11} />
                        <Tooltip />
                        <Line type="monotone" dataKey="kcal" name="kcal" stroke="#6366f1" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-foreground">Evolução de macronutrientes (g)</span>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={evoData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="name" fontSize={11} />
                        <YAxis fontSize={11} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="cho" name="Carboidrato" stroke="#f59e0b" strokeWidth={2} />
                        <Line type="monotone" dataKey="prot" name="Proteína" stroke="#10b981" strokeWidth={2} />
                        <Line type="monotone" dataKey="fat" name="Gordura" stroke="#ef4444" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Salve ao menos 2 planos para ver os gráficos de evolução.</p>
              )
            )}
          </div>
        )}

        {/* Histórico de planos anexados */}
        {history.length > 0 && (
          <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 px-0 text-muted-foreground">
                <History className="h-3.5 w-3.5" /> Histórico de planos anexados ({history.length})
                <ChevronDown className={`h-4 w-4 transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-2">
              {history.map((p, i) => {
                const prev = history[i + 1];
                return (
                  <div key={p.id} className={`rounded-md border p-2.5 space-y-1 ${p.sent_to_zona_nutri ? 'border-emerald-500/60 bg-emerald-500/5 ring-1 ring-emerald-500/30' : ''}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium flex items-center gap-1.5">
                        {p.sent_to_zona_nutri && <Send className="h-3.5 w-3.5 text-emerald-600" />}
                        {p.label}
                      </span>
                      <Badge variant="outline" className="text-[11px]">{fmtDate(p.date)}</Badge>
                    </div>
                    {p.sent_to_zona_nutri && (
                      <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600">
                        Enviado ao Zona Nutri{p.sent_at ? ` · ${fmtDate(p.sent_at)}` : ''}
                      </Badge>
                    )}
                    {p.summary && <p className="text-xs text-muted-foreground">{p.summary}</p>}
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                      <span>Cal: <Delta curr={p.totals?.kcal || 0} prev={prev?.totals?.kcal} unit=" kcal" /></span>
                      <span>CHO: <Delta curr={p.totals?.cho_g || 0} prev={prev?.totals?.cho_g} unit=" g" /></span>
                      <span>PTN: <Delta curr={p.totals?.protein_g || 0} prev={prev?.totals?.protein_g} unit=" g" /></span>
                      <span>Refeições: <Delta curr={p.totals?.meals || 0} prev={prev?.totals?.meals} /></span>
                    </div>
                    <Button
                      variant="link" size="sm" className="h-6 px-0 text-xs"
                      onClick={() => loadPlan(p, { scroll: true })}
                    >
                      Carregar para edição
                    </Button>
                  </div>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
