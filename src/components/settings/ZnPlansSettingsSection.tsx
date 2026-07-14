import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Loader2, Save } from 'lucide-react';
import { useZnPlans, useUpdateZnPlan, type ZnPlan } from '@/hooks/useZnAssessoria';
import { toast } from 'sonner';

const ORDER = ['monthly', 'semiannual', 'annual'];

export function ZnPlansSettingsSection() {
  const { data: plans = [], isLoading } = useZnPlans();
  const update = useUpdateZnPlan();
  const [draft, setDraft] = useState<Record<string, { name: string; price: string; is_active: boolean }>>({});

  useEffect(() => {
    const d: Record<string, any> = {};
    for (const p of plans) d[p.id] = { name: p.name, price: String(p.price ?? ''), is_active: p.is_active };
    setDraft(d);
  }, [plans]);

  const sorted = [...plans].sort((a, b) => ORDER.indexOf(a.code) - ORDER.indexOf(b.code));

  const save = (p: ZnPlan) => {
    const d = draft[p.id];
    if (!d) return;
    const price = parseFloat(String(d.price).replace(',', '.'));
    if (isNaN(price) || price < 0) { toast.error('Informe um valor válido.'); return; }
    update.mutate({ id: p.id, name: d.name.trim() || p.name, price, is_active: d.is_active });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /> Planos da Assessoria (ZN)</CardTitle>
        <CardDescription>
          Edite aqui o <strong>nome</strong>, o <strong>valor</strong> e se o plano está <strong>ativo</strong>. Isso é a fonte única:
          o wizard da anamnese, a cobrança gerada no Asaas e o cálculo de cupons passam a usar estes valores automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}
        {!isLoading && sorted.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum plano encontrado. Eles são criados automaticamente no primeiro uso da ZN Assessoria.</p>
        )}
        {sorted.map((p) => {
          const d = draft[p.id] || { name: p.name, price: String(p.price), is_active: p.is_active };
          return (
            <div key={p.id} className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="uppercase text-[10px]">{p.code}</Badge>
                <span className="text-xs text-muted-foreground">{p.duration_months} {p.duration_months === 1 ? 'mês' : 'meses'}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nome do plano</Label>
                  <Input value={d.name} onChange={(e) => setDraft(s => ({ ...s, [p.id]: { ...d, name: e.target.value } }))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Valor (R$)</Label>
                  <Input inputMode="decimal" value={d.price} onChange={(e) => setDraft(s => ({ ...s, [p.id]: { ...d, price: e.target.value } }))} placeholder="0,00" className="mt-1" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={d.is_active} onCheckedChange={(v) => setDraft(s => ({ ...s, [p.id]: { ...d, is_active: v } }))} />
                  {d.is_active ? 'Ativo' : 'Inativo'}
                </label>
                <Button size="sm" className="gap-1.5" onClick={() => save(p)} disabled={update.isPending}>
                  {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar
                </Button>
              </div>
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground">
          Planos inativos não aparecem para o atleta escolher na anamnese/checkout.
        </p>
      </CardContent>
    </Card>
  );
}
