import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Check, ChevronDown, ChevronRight, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { useBiweeklyContacts, type ContactRow } from '@/hooks/useBiweeklyContacts';
import { DashboardSection } from './DashboardSection';

function waLink(phone: string | null, name: string): string | null {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  const withCc = digits.startsWith('55') ? digits : `55${digits}`;
  const firstName = (name || '').split(' ')[0];
  const msg = `Oi ${firstName}! Passando aqui pra saber como você está. 😊 Tudo certo com o plano? Alguma dúvida ou dificuldade em que eu possa te ajudar?`;
  return `https://wa.me/${withCc}?text=${encodeURIComponent(msg)}`;
}

function sinceLabel(r: ContactRow): string {
  if (r.daysSince == null) return 'sem registro';
  if (r.daysSince === 0) return 'hoje';
  return `${r.daysSince} dias`;
}

export function BiweeklyContactPanel() {
  const { pending, done, total, isLoading, error, refetch, markContacted, undoContact } = useBiweeklyContacts();
  const [doneOpen, setDoneOpen] = useState(false);

  if (isLoading) return <p role="status">Carregando contatos…</p>;
  if (error) return <div role="alert"><p>Não foi possível conferir os contatos.</p><button onClick={() => refetch()} className="min-h-11 underline">Tentar novamente</button></div>;
  if (total === 0) return <p>Nenhum atleta vigente nesta fila.</p>;

  const openWa = (r: ContactRow) => {
    const link = waLink(r.phone, r.name);
    if (!link) { toast.error('Atleta sem telefone válido.'); return; }
    window.open(link, '_blank', 'noopener');
  };

  return (
    <DashboardSection title="Contatos" count={pending.length}>
      <p className="px-3 pb-3 text-sm text-muted-foreground">Treino e ambos: semanal. Dieta: quinzenal. Sem registro significa contato a confirmar.</p>
      {pending.map((r) => (
        <div key={r.id} className="group flex items-center gap-2 rounded-md transition-colors hover:bg-muted/50">
          <button
            type="button"
            onClick={() => openWa(r)}
            className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-3 text-left"
          >
            <span className="min-w-0 flex-1 truncate text-[15px]">{r.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{sinceLabel(r)}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
          </button>
          <button
            type="button"
            aria-label={`Marcar contato com ${r.name}`}
            onClick={() => markContacted(r.id)}
            className="mr-1.5 flex h-11 w-11 items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
          >
            <Check className="h-4 w-4" />
          </button>
        </div>
      ))}

      {done.length > 0 && (
        <Collapsible open={doneOpen} onOpenChange={setDoneOpen}>
          <CollapsibleTrigger className="flex w-full items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
            Contatos registrados no prazo ({done.length})
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${doneOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            {done.map((r) => (
              <div key={r.id} className="flex items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{r.name}</span>
                <button
                  type="button"
                  aria-label={`Desfazer contato com ${r.name}`}
                  onClick={() => undoContact(r.id)}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </DashboardSection>
  );
}
