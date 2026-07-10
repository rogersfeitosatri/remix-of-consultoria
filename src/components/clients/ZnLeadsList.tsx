import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageCircle, Trash2, Copy, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PLAN_LABEL: Record<string, string> = {
  monthly: 'Mensal',
  semiannual: 'Semestral',
  annual: 'Anual',
};

export function ZnLeadsList() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['zn_athletes', 'leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zn_athletes')
        .select('id, name, email, phone, plan_choice, status, created_at, lead_marked_at, last_payment_link, body_goal, target_race')
        .in('status', ['pending', 'lead'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const deleteLead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('zn_athletes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zn_athletes'] });
      toast({ title: 'Lead removido' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const copyLink = (link: string | null) => {
    if (!link) return toast({ title: 'Sem link disponível', variant: 'destructive' });
    navigator.clipboard.writeText(link);
    toast({ title: 'Link copiado' });
  };

  const sendWhatsApp = async (lead: any) => {
    if (!lead.phone || !lead.last_payment_link) {
      return toast({ title: 'Falta WhatsApp ou link', variant: 'destructive' });
    }
    const message = `Olá ${lead.name}! Finalize sua assinatura ZN Assessoria (${PLAN_LABEL[lead.plan_choice] ?? ''}) pelo link seguro do Asaas: ${lead.last_payment_link}`;
    try {
      const { error } = await supabase.functions.invoke('send-whatsapp', {
        body: { phone: lead.phone, message, context: 'zn_lead_reminder' },
      });
      if (error) throw error;
      toast({ title: 'Mensagem enviada' });
    } catch (e: any) {
      toast({ title: 'Erro ao enviar', description: e.message, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (leads.length === 0) {
    return (
      <Card><CardContent className="py-10 text-center text-muted-foreground">
        Nenhum lead ainda. Atletas que iniciam o cadastro no wizard mas não pagam aparecem aqui.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-3">
      {leads.map((l: any) => (
        <Card key={l.id}>
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold truncate">{l.name}</h3>
                  <Badge variant={l.status === 'lead' ? 'destructive' : 'secondary'}>
                    {l.status === 'lead' ? 'Lead (7+ dias)' : 'Pendente'}
                  </Badge>
                  {l.plan_choice && <Badge variant="outline">{PLAN_LABEL[l.plan_choice] ?? l.plan_choice}</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{l.email} · {l.phone ?? 'sem telefone'}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Cadastrado {formatDistanceToNow(new Date(l.created_at), { addSuffix: true, locale: ptBR })}
                </p>
                {l.target_race && <p className="text-xs text-muted-foreground">Prova: {l.target_race}</p>}
              </div>

              <div className="flex gap-2 flex-wrap">
                {l.last_payment_link && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => copyLink(l.last_payment_link)}>
                      <Copy className="h-3.5 w-3.5 mr-1" /> Link
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <a href={l.last_payment_link} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir
                      </a>
                    </Button>
                  </>
                )}
                <Button size="sm" variant="secondary" onClick={() => sendWhatsApp(l)}>
                  <MessageCircle className="h-3.5 w-3.5 mr-1" /> WhatsApp
                </Button>
                <Button size="sm" variant="ghost" onClick={() => {
                  if (confirm(`Remover lead ${l.name}?`)) deleteLead.mutate(l.id);
                }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
