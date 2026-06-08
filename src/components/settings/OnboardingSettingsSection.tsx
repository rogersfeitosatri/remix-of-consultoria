import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, KeyRound, Info, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface OnboardingPlan {
  id: string;
  slug: string;
  name: string;
  category: string;
  periodicity: string;
  duration_months: number;
  consultations_count: number;
  checkin_frequency: string | null;
  payment_link: string | null;
  price: number;
  is_active: boolean;
  order_index: number;
}

interface PaymentSettings {
  id?: string;
  mp_public_key: string | null;
  reminder_days: number;
  anamnese_form_id: string | null;
}

export function OnboardingSettingsSection() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [localPlans, setLocalPlans] = useState<Record<string, { payment_link: string; price: string }>>({});
  const [settings, setSettings] = useState<PaymentSettings>({ mp_public_key: '', reminder_days: 2 });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['onboarding_plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('onboarding_plans')
        .select('*')
        .order('order_index', { ascending: true });
      if (error) throw error;
      return data as OnboardingPlan[];
    },
  });

  const { data: settingsData } = useQuery({
    queryKey: ['onboarding_payment_settings', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('onboarding_payment_settings')
        .select('*')
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      return data as PaymentSettings | null;
    },
  });

  useEffect(() => {
    if (settingsData) {
      setSettings({
        id: settingsData.id,
        mp_public_key: settingsData.mp_public_key ?? '',
        reminder_days: settingsData.reminder_days ?? 2,
      });
    }
  }, [settingsData]);

  useEffect(() => {
    if (plans.length && Object.keys(localPlans).length === 0) {
      const next: Record<string, { payment_link: string; price: string }> = {};
      plans.forEach((p) => {
        next[p.id] = { payment_link: p.payment_link ?? '', price: String(p.price ?? 0) };
      });
      setLocalPlans(next);
    }
  }, [plans, localPlans]);

  const savePlan = useMutation({
    mutationFn: async (plan: OnboardingPlan) => {
      const local = localPlans[plan.id];
      const { error } = await supabase
        .from('onboarding_plans')
        .update({
          payment_link: local.payment_link.trim() || null,
          price: Number(local.price) || 0,
        })
        .eq('id', plan.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Plano atualizado');
      qc.invalidateQueries({ queryKey: ['onboarding_plans'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao salvar'),
  });

  const saveSettings = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Sem usuário');
      const payload = {
        user_id: userId,
        mp_public_key: settings.mp_public_key?.trim() || null,
        reminder_days: Number(settings.reminder_days) || 2,
      };
      const { error } = await supabase
        .from('onboarding_payment_settings')
        .upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Configurações salvas');
      qc.invalidateQueries({ queryKey: ['onboarding_payment_settings'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao salvar'),
  });

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Esta seção configura o <strong>novo fluxo de onboarding</strong> via Mercado Pago. Atletas
          já cadastrados <strong>não são afetados</strong>. O <em>Access Token</em> do Mercado Pago
          é guardado como secret no servidor (peça em <em>Lovable Cloud → Secrets</em> com o nome{' '}
          <code>MP_ACCESS_TOKEN</code>).
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Mercado Pago
          </CardTitle>
          <CardDescription>Chave pública e configurações de lembrete.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="mp-public-key">Public Key (Mercado Pago)</Label>
            <Input
              id="mp-public-key"
              placeholder="APP_USR-..."
              value={settings.mp_public_key ?? ''}
              onChange={(e) => setSettings((s) => ({ ...s, mp_public_key: e.target.value }))}
            />
          </div>
          <div className="grid gap-2 max-w-xs">
            <Label htmlFor="reminder-days">Lembrar pagamento após (dias)</Label>
            <Input
              id="reminder-days"
              type="number"
              min={1}
              value={settings.reminder_days}
              onChange={(e) =>
                setSettings((s) => ({ ...s, reminder_days: Number(e.target.value) }))
              }
            />
          </div>
          <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
            {saveSettings.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar configurações
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Planos e Links de Pagamento</CardTitle>
          <CardDescription>
            Cole aqui o link de checkout do Mercado Pago de cada plano e ajuste o valor se
            necessário. O atleta <strong>não verá os valores</strong> na anamnese.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {plansLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {plans.map((plan) => {
                const local = localPlans[plan.id] ?? { payment_link: '', price: '0' };
                return (
                  <div
                    key={plan.id}
                    className="border rounded-lg p-4 space-y-3 bg-muted/30"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <div className="font-semibold">{plan.name}</div>
                        <div className="text-xs text-muted-foreground">
                          <Badge variant="outline" className="mr-1">
                            {plan.category}
                          </Badge>
                          <Badge variant="outline" className="mr-1">
                            {plan.duration_months} meses
                          </Badge>
                          {plan.consultations_count > 0 && (
                            <Badge variant="outline" className="mr-1">
                              {plan.consultations_count} consultas
                            </Badge>
                          )}
                          <Badge variant="outline">
                            check-in {plan.checkin_frequency === 'biweekly' ? 'quinzenal' : 'mensal'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-[1fr_140px_auto] gap-2 items-end">
                      <div className="space-y-1">
                        <Label className="text-xs">Link do Mercado Pago</Label>
                        <Input
                          placeholder="https://mpago.la/..."
                          value={local.payment_link}
                          onChange={(e) =>
                            setLocalPlans((prev) => ({
                              ...prev,
                              [plan.id]: { ...prev[plan.id], payment_link: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Valor (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={local.price}
                          onChange={(e) =>
                            setLocalPlans((prev) => ({
                              ...prev,
                              [plan.id]: { ...prev[plan.id], price: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <Button
                        size="sm"
                        onClick={() => savePlan.mutate(plan)}
                        disabled={savePlan.isPending}
                      >
                        <Save className="h-4 w-4 mr-1" /> Salvar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
