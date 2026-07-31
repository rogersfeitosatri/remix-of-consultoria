import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Radar, ChevronDown, MessageCircle, ClipboardCheck, User, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useAthleteRadar, type RadarRow, type IssueKind } from '@/hooks/useAthleteRadar';

const STYLE: Record<IssueKind, { dot: string; chip: string }> = {
  nutri_pendente:       { dot: 'bg-rose-500',    chip: 'border-rose-500/40 text-rose-600' },
  atleta_nao_respondeu: { dot: 'bg-amber-500',   chip: 'border-amber-500/40 text-amber-600' },
  consulta_atrasada:    { dot: 'bg-sky-500',     chip: 'border-sky-500/40 text-sky-600' },
  consulta_nunca:       { dot: 'bg-slate-500',   chip: 'border-slate-500/40 text-slate-600' },
  checkin_atrasado:     { dot: 'bg-yellow-500',  chip: 'border-yellow-500/40 text-yellow-600' },
};

function waLink(phone: string | null, name: string): string | null {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  const cc = digits.startsWith('55') ? digits : `55${digits}`;
  const first = (name || '').split(' ')[0];
  const msg = `Oi ${first}! Tudo bem? Vi que seu check-in ainda está pendente — quando puder, me responde pra eu acompanhar sua evolução. 😊`;
  return `https://wa.me/${cc}?text=${encodeURIComponent(msg)}`;
}

export function AthleteRadarPanel() {
  const { problems, ok, total, counts, isLoading } = useAthleteRadar();
  const [open, setOpen] = useState(false);
  const [okOpen, setOkOpen] = useState(false);
  const navigate = useNavigate();

  if (isLoading || total === 0) return null;

  const openWa = (r: RadarRow) => {
    const link = waLink(r.phone, r.name);
    if (!link) { toast.error('Atleta sem telefone válido.'); return; }
    window.open(link, '_blank', 'noopener');
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="mt-3 border-primary/30">
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-2 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Radar className="h-4 w-4 text-primary" /> Radar de atletas
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant={problems.length ? 'default' : 'secondary'} className="text-[11px]">
                  {problems.length} fora do combinado
                </Badge>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
              </div>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              {counts.nutriPendente > 0 && <span className="text-rose-600 font-medium">● {counts.nutriPendente} aguardando você</span>}
              {counts.atletaNaoRespondeu > 0 && <span>● {counts.atletaNaoRespondeu} não responderam</span>}
              {counts.checkinAtrasado > 0 && <span>● {counts.checkinAtrasado} check-in atrasado</span>}
              {counts.consulta > 0 && <span>● {counts.consulta} consulta pendente</span>}
              {problems.length === 0 && <span>Todos os {total} atletas ativos estão em dia ✅</span>}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-2">
            {problems.length === 0 ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700">
                ✅ Nenhum atleta fora do combinado. Tudo em dia!
              </div>
            ) : problems.map((r) => (
              <div key={r.id} className="rounded-lg border p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{r.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.issues.map((i, k) => (
                        <span key={k} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${STYLE[i.kind].chip}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${STYLE[i.kind].dot}`} />
                          {i.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {r.pendingResponseId && (
                    <Button size="sm" className="h-8 gap-1 text-xs"
                      onClick={() => navigate(`/checkin-review/${r.pendingResponseId}`)}>
                      <ClipboardCheck className="h-3.5 w-3.5" /> Responder check-in
                    </Button>
                  )}
                  <Button size="sm" variant="outline"
                    className="h-8 gap-1 text-xs text-green-600 border-green-600/30 hover:bg-green-600/10"
                    onClick={() => openWa(r)}>
                    <MessageCircle className="h-3.5 w-3.5" /> Cobrar no WhatsApp
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs text-muted-foreground"
                    onClick={() => navigate(`/clients/${r.id}`)}>
                    <User className="h-3.5 w-3.5" /> Abrir ficha
                  </Button>
                </div>
              </div>
            ))}

            {ok.length > 0 && (
              <Collapsible open={okOpen} onOpenChange={setOkOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1.5 px-0 text-muted-foreground">
                    <Check className="h-3.5 w-3.5 text-emerald-600" /> Em dia ({ok.length})
                    <ChevronDown className={`h-4 w-4 transition-transform ${okOpen ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-1">
                  <div className="flex flex-wrap gap-1.5">
                    {ok.map((r) => (
                      <span key={r.id} className="rounded-full border bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground">
                        {r.name}
                      </span>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
