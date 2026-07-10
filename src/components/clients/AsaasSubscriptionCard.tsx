import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CreditCard, ExternalLink, Loader2, XCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  client: {
    id: string;
    name: string;
    monthly_value: number;
    plan_duration: string;
    asaas_customer_id: string | null;
    asaas_subscription_id: string | null;
    asaas_subscription_status: string | null;
  };
}

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  ACTIVE: { label: 'Ativa', variant: 'default' },
  PENDING: { label: 'Pendente', variant: 'secondary' },
  OVERDUE: { label: 'Atrasada', variant: 'destructive' },
  CANCELLED: { label: 'Cancelada', variant: 'outline' },
  EXPIRED: { label: 'Expirada', variant: 'outline' },
};

const SUPPORTED = ['monthly', 'quarterly', 'semiannual', 'annual'];

export function AsaasSubscriptionCard({ client }: Props) {
  const qc = useQueryClient();
  const [cpf, setCpf] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);

  const supported = SUPPORTED.includes(client.plan_duration);
  const hasSubscription = !!client.asaas_subscription_id;

  const handleCreate = async () => {
    if (!supported) {
      toast.error('Este plano não é compatível com recorrência automática');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('asaas-create-subscription', {
        body: { client_id: client.id, cpf_cnpj: cpf.replace(/\D/g, '') || undefined },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setPaymentLink((data as any)?.payment_link ?? null);
      toast.success('Assinatura criada no Asaas');
      qc.invalidateQueries({ queryKey: ['clients'] });
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao criar assinatura');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Cancelar a assinatura Asaas deste atleta?')) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('asaas-cancel-subscription', {
        body: { client_id: client.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('Assinatura cancelada');
      qc.invalidateQueries({ queryKey: ['clients'] });
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao cancelar');
    } finally {
      setLoading(false);
    }
  };

  const statusInfo = client.asaas_subscription_status
    ? STATUS_LABELS[client.asaas_subscription_status] ?? { label: client.asaas_subscription_status, variant: 'outline' as const }
    : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" />
          Cobrança recorrente (Asaas)
          {statusInfo && <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!supported && (
          <p className="text-xs text-muted-foreground">
            Plano "{client.plan_duration}" não suporta recorrência automática no Asaas. Use mensal, trimestral, semestral ou anual.
          </p>
        )}

        {!hasSubscription && supported && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="cpf" className="text-xs">CPF/CNPJ (opcional, mas recomendado)</Label>
              <Input
                id="cpf"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                placeholder="000.000.000-00"
              />
            </div>
            <Button onClick={handleCreate} disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CreditCard className="h-4 w-4 mr-2" />}
              Criar assinatura no Asaas
            </Button>
          </>
        )}

        {hasSubscription && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              ID da assinatura: <span className="font-mono">{client.asaas_subscription_id}</span>
            </p>
            {paymentLink && (
              <a href={paymentLink} target="_blank" rel="noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline">
                <ExternalLink className="h-3 w-3" /> Abrir link de pagamento
              </a>
            )}
            <Button variant="destructive" size="sm" onClick={handleCancel} disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              Cancelar assinatura
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
