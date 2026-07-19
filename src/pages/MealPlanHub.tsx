// Hub central do plano alimentar do atleta.
// Rota: /meal-plans/:clientId/hub
// - Cards de acesso rápido às informações do atleta (dados, anamnese,
//   check-ins, avaliações, exames).
// - Histórico do plano alimentar: rascunho local (não salvo) e planos salvos
//   com data. O botão "Voltar" nas telas filhas retorna aqui.

import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowLeft, User, ClipboardCheck, MessageCircle, TrendingUp, FlaskConical,
  FileEdit, Utensils, Pencil, CalendarClock, ChevronRight, PlusCircle, History,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

  const { data: analyses = [] } = useQuery({
    queryKey: ['meal-plan-hub-analyses', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_analyses')
        .select('id, updated_at, created_at, raw_response')
        .eq('client_id', clientId!)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const savedPlans = useMemo(() => {
    return (analyses as any[])
      .map((r) => {
        const meals = r?.raw_response?.meal_plan?.meals || r?.raw_response?.meals || [];
        const dayVars = r?.raw_response?.meal_plan?.day_variations || {};
        return {
          id: r.id,
          updated_at: r.updated_at,
          created_at: r.created_at,
          mealCount: Array.isArray(meals) ? meals.length : 0,
          variationCount: Object.keys(dayVars).length,
          hasPending: !!r?.raw_response?.pending_update,
        };
      })
      .filter((r) => r.mealCount > 0);
  }, [analyses]);

  const draft = useMemo(() => readDraft(clientId), [clientId, analyses]);

  const openEditor = () => navigate(`/meal-plans/${clientId}/editor`);
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
    { icon: TrendingUp, title: 'Avaliações', desc: 'Evolução e gráficos', onClick: () => openClientTab('evolution') },
    { icon: FlaskConical, title: 'Exames', desc: 'Análise nutricional da IA', onClick: () => navigate(`/clients/${clientId}/analysis?from=meal-plan-hub`) },
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
                  Planos salvos ({savedPlans.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {savedPlans.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Utensils className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Nenhum plano salvo ainda.</p>
                    <Button className="mt-3" onClick={openEditor}>
                      <PlusCircle className="h-4 w-4 mr-2" /> Criar primeiro plano
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {savedPlans.map((p, i) => (
                      <button
                        key={p.id}
                        onClick={openEditor}
                        className="w-full flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-accent/50 transition-colors"
                      >
                        <div className="h-9 w-9 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                          <Utensils className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm">
                              {i === 0 ? 'Plano atual' : `Plano ${savedPlans.length - i}`}
                            </p>
                            {i === 0 && <Badge variant="secondary" className="text-[10px]">Ativo</Badge>}
                            {p.hasPending && (
                              <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600">
                                Proposta pendente
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <CalendarClock className="h-3 w-3" />
                              Salvo em {format(parseISO(p.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </span>
                            <span>· {p.mealCount} refeição{p.mealCount > 1 ? 'ões' : ''}</span>
                            {p.variationCount > 0 && (
                              <span>· {p.variationCount} variação{p.variationCount > 1 ? 'ões' : ''} de dia</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
