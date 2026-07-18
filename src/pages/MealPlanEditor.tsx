// Página do Editor Inteligente de Plano Alimentar (Fase 1).
// Rota: /meal-plans/:clientId/editor
// - Carrega o plano existente (ai_analyses.raw_response.meal_plan.meals) e
//   converte para texto do editor. Se não houver plano, começa em branco.
// - Autosave em localStorage (rascunho). Botão "Salvar plano" persiste em
//   ai_analyses.raw_response.meal_plan.meals (mesmo formato canônico usado
//   pelas outras telas e pelo envio ao Zona Nutri).
// - Botão "Enviar ao Zona Nutri" chama a edge function existente.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SmartPlanEditor } from '@/components/mealplan-v3/SmartPlanEditor';
import { TotalsPanel } from '@/components/mealplan-v3/TotalsPanel';
import { useSmartPlanDraft } from '@/hooks/useSmartPlanDraft';
import { useAthleteWeight } from '@/hooks/useAthleteWeight';
import { mealsToText } from '@/lib/smartPlan/fromMeals';
import { parseText } from '@/lib/smartPlan/parse';
import { astToMeals } from '@/lib/smartPlan/serialize';

export default function MealPlanEditor() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: client } = useQuery({
    queryKey: ['meal-plan-editor-client', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id,name').eq('id', clientId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: analysisRow } = useQuery({
    queryKey: ['meal-plan-editor-row', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_analyses').select('*').eq('client_id', clientId!)
        .order('updated_at', { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });

  const initialText = useMemo(() => {
    try {
      const raw = analysisRow?.raw_response as any;
      const meals = raw?.meal_plan?.meals || raw?.meals || [];
      if (Array.isArray(meals) && meals.length) return mealsToText(meals);
    } catch { /* fallthrough */ }
    return '';
  }, [analysisRow]);

  const { text, setText, state } = useSmartPlanDraft(clientId, initialText);
  // Sincroniza rascunho local com o carregado quando o carregamento termina.
  useEffect(() => {
    if (!analysisRow) return;
    // só carrega do banco se o rascunho local estiver vazio
    try {
      const key = `smart-plan-draft:${clientId}`;
      if (!localStorage.getItem(key) && initialText) setText(initialText);
    } catch { /* noop */ }
  }, [analysisRow, initialText, clientId, setText]);

  const { data: weightInfo } = useAthleteWeight(clientId);
  const weightKg = weightInfo?.weightKg ?? null;

  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const savePlan = async () => {
    if (!clientId) return;
    try {
      setSaving(true);
      const ast = parseText(text);
      const meals = astToMeals(ast);
      const currentRaw = (analysisRow?.raw_response as any) || {};
      const nextRaw = {
        ...currentRaw,
        meal_plan: { ...(currentRaw.meal_plan || {}), meals },
        editor: 'smart-plan-v3',
      };
      if (analysisRow?.id) {
        const { error } = await supabase.from('ai_analyses').update({ raw_response: nextRaw }).eq('id', analysisRow.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('ai_analyses').insert({ client_id: clientId, raw_response: nextRaw });
        if (error) throw error;
      }
      toast.success('Plano salvo.');
      qc.invalidateQueries({ queryKey: ['meal-plan-editor-row', clientId] });
      qc.invalidateQueries({ queryKey: ['ai_analysis', clientId] });
    } catch (e: any) {
      toast.error(`Não foi possível salvar: ${e.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  const sendToZonaNutri = async () => {
    if (!clientId) return;
    try {
      setSending(true);
      await savePlan();
      const { data, error } = await supabase.functions.invoke('send-meal-plan-to-zona-nutri', { body: { client_id: clientId } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('Plano enviado ao Zona Nutri.');
    } catch (e: any) {
      toast.error(`Falha no envio: ${e.message || e}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-[1400px] mx-auto p-3 md:p-6">
        <div className="flex items-center justify-between mb-4 gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/meal-plans/${clientId}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
          <div className="text-right">
            <h1 className="text-lg md:text-xl font-bold">Editor inteligente</h1>
            <p className="text-xs text-muted-foreground">{client?.name || '—'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Digite o plano como um documento. <b>Enter</b> = novo alimento. <b>ou</b> = substituição. <b>HH:MM Nome</b> = nova refeição.</span>
                <a
                  href={`/meal-plans/${clientId}`}
                  className="ml-auto inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Editor clássico <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <SmartPlanEditor value={text} onChange={setText} />
            </CardContent>
          </Card>

          <div className="lg:block">
            <TotalsPanel
              text={text}
              weightKg={weightKg}
              saveState={saving ? 'saving' : state}
              onSave={savePlan}
              onSendZonaNutri={sendToZonaNutri}
              sending={sending}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}
