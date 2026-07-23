import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MessageCircle, Check, ChevronDown, HeartHandshake, Undo2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useBiweeklyContacts, CONTACT_CYCLE_DAYS, type ContactRow } from '@/hooks/useBiweeklyContacts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function waLink(phone: string | null, name: string): string | null {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  const withCc = digits.startsWith('55') ? digits : `55${digits}`;
  const firstName = (name || '').split(' ')[0];
  const msg = `Oi ${firstName}! Passando aqui pra saber como você está. 😊 Tudo certo com o plano? Alguma dúvida ou dificuldade em que eu possa te ajudar?`;
  return `https://wa.me/${withCc}?text=${encodeURIComponent(msg)}`;
}

function sinceLabel(r: ContactRow): { text: string; overdue: boolean } {
  if (r.daysSince == null) return { text: 'Nunca contatado', overdue: true };
  if (r.daysSince === 0) return { text: 'Contato hoje', overdue: false };
  const overdue = r.daysSince >= CONTACT_CYCLE_DAYS;
  return { text: `há ${r.daysSince} dia${r.daysSince > 1 ? 's' : ''}`, overdue };
}

export function BiweeklyContactPanel() {
  const { pending, done, total, isLoading, markContacted, undoContact } = useBiweeklyContacts();
  const [doneOpen, setDoneOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  if (isLoading) return null;
  if (total === 0) return null; // sem atletas ativos → nada a mostrar

  const openWa = (r: ContactRow) => {
    const link = waLink(r.phone, r.name);
    if (!link) { toast.error('Atleta sem telefone válido.'); return; }
    window.open(link, '_blank', 'noopener');
  };

  return (
    <Card className="mt-3 border-primary/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <HeartHandshake className="h-4 w-4 text-primary" /> Contato quinzenal
          </CardTitle>
          <Badge variant={pending.length ? 'default' : 'secondary'} className="text-[11px]">
            {pending.length} pendente{pending.length !== 1 ? 's' : ''}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Um "oi" no WhatsApp a cada {CONTACT_CYCLE_DAYS} dias com quem está ativo — além dos check-ins.
          Marque <strong>Falei</strong> ao concluir; volta sozinho no próximo ciclo.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {pending.length === 0 ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700">
            ✅ Todos os ativos foram contatados neste ciclo. Bom trabalho!
          </div>
        ) : (
          <div className="space-y-1.5">
            {pending.map((r) => {
              const s = sinceLabel(r);
              return (
                <div key={r.id} className="rounded-lg border p-2.5 sm:p-2">
                  <div className="flex items-start gap-2 sm:items-center">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.name}</p>
                      <span className={`text-[11px] ${s.overdue ? 'text-amber-600' : 'text-muted-foreground'}`}>
                        {s.text}
                      </span>
                    </div>
                    <div className="hidden sm:flex items-center gap-2">
                      <Button size="sm" variant="outline" className="h-8 gap-1 text-xs text-green-600 border-green-600/30 hover:bg-green-600/10"
                        onClick={() => openWa(r)}>
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </Button>
                      <Button size="sm" className="h-8 gap-1 text-xs" onClick={() => { markContacted(r.id); toast.success(`Contato com ${r.name.split(' ')[0]} registrado.`); }}>
                        <Check className="h-3.5 w-3.5" /> Falei
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:hidden">
                    <Button size="sm" variant="outline" className="h-9 gap-1 text-xs text-green-600 border-green-600/30 hover:bg-green-600/10"
                      onClick={() => openWa(r)}>
                      <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                    </Button>
                    <Button size="sm" className="h-9 gap-1 text-xs" onClick={() => { markContacted(r.id); toast.success(`Contato com ${r.name.split(' ')[0]} registrado.`); }}>
                      <Check className="h-3.5 w-3.5" /> Falei
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {done.length > 0 && (
          <Collapsible open={doneOpen} onOpenChange={setDoneOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 px-0 text-muted-foreground">
                <Check className="h-3.5 w-3.5 text-emerald-600" /> Em dia neste ciclo ({done.length})
                <ChevronDown className={`h-4 w-4 transition-transform ${doneOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1.5 pt-1">
              {done.map((r) => (
                <div key={r.id} className="flex items-center gap-2 rounded-lg border bg-muted/20 p-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{r.name}</p>
                    {r.lastContactedAt && (
                      <span className="text-[11px] text-muted-foreground">
                        Falei em {format(parseISO(r.lastContactedAt), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </span>
                    )}
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-muted-foreground"
                    onClick={() => { undoContact(r.id); }}>
                    <Undo2 className="h-3 w-3" /> Desfazer
                  </Button>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
