import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { Link as LinkIcon, ClipboardCheck, ArrowUp, ArrowRight, ArrowDown, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useNpCheckins,
  useGenerateNpCheckinLink,
  useDecideNpCheckin,
  type NpCheckinResponse,
} from '@/hooks/useNpCheckins';
import { giScoreColorClass } from '@/lib/nutriperiodiza';

interface Props {
  clientId: string;
  userId: string;
}

export function NpCheckinPanel({ clientId, userId }: Props) {
  const { data: checkins = [] } = useNpCheckins(clientId);
  const generateLink = useGenerateNpCheckinLink(clientId, userId);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Check-ins de Periodização</CardTitle>
        </div>
        <Button
          size="sm"
          onClick={() => generateLink.mutate()}
          disabled={generateLink.isPending}
        >
          {generateLink.isPending ? (
            <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Gerando…</>
          ) : (
            <><LinkIcon className="h-3 w-3 mr-1" /> Gerar link para o atleta</>
          )}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {checkins.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum check-in recebido ainda. Gere o link e envie ao atleta via WhatsApp.
          </p>
        )}
        {checkins.map((c) => (
          <CheckinCard key={c.id} checkin={c} clientId={clientId} />
        ))}
      </CardContent>
    </Card>
  );
}

function CheckinCard({ checkin: c, clientId }: { checkin: NpCheckinResponse; clientId: string }) {
  const decide = useDecideNpCheckin(clientId);
  const [open, setOpen] = useState(false);
  const [decision, setDecision] = useState<'advance' | 'maintain' | 'regress'>('maintain');
  const [note, setNote] = useState('');

  const handleConfirm = () => {
    decide.mutate(
      { checkin_id: c.id, decision, decision_note: note || undefined },
      { onSuccess: () => setOpen(false) },
    );
  };

  return (
    <div className="border rounded-md p-4 bg-muted/20 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline">
          {format(parseISO(c.submitted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </Badge>
        {c.phase && <Badge variant="secondary">Fase: {c.phase}</Badge>}
        {c.decision && (
          <Badge variant="default" className={
            c.decision === 'advance' ? 'bg-green-600' :
            c.decision === 'regress' ? 'bg-amber-600' : ''
          }>
            {decisionLabel(c.decision)}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <Metric label="Aderência" value={c.adherence_pct != null ? `${c.adherence_pct}%` : '—'} />
        <Metric
          label="GI Score"
          value={c.gi_score != null ? `${c.gi_score}/10` : '—'}
          valueClass={giScoreColorClass(c.gi_score)}
        />
        <Metric label="Energia" value={c.energy_score != null ? `${c.energy_score}/10` : '—'} />
        <Metric label="Sono" value={c.sleep_score != null ? `${c.sleep_score}/10` : '—'} />
        <Metric label="Peso" value={c.weight_kg != null ? `${c.weight_kg} kg` : '—'} />
        <Metric label="Volume" value={c.weekly_mileage_km != null ? `${c.weekly_mileage_km} km` : '—'} />
        <Metric label="Long run" value={c.long_run_completed == null ? '—' : c.long_run_completed ? '✓ feito' : '✗ não fez'} />
      </div>

      {c.notes && (
        <div className="text-sm bg-background/60 border rounded p-2">
          <p className="text-xs text-muted-foreground mb-1">Observações do atleta:</p>
          <p className="whitespace-pre-wrap">{c.notes}</p>
        </div>
      )}

      {c.decision_note && (
        <div className="text-sm bg-background/60 border rounded p-2">
          <p className="text-xs text-muted-foreground mb-1">Decisão registrada:</p>
          <p className="whitespace-pre-wrap">{c.decision_note}</p>
        </div>
      )}

      {!c.decision && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">Registrar decisão</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Decisão sobre este check-in</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-3 gap-2">
                <DecisionButton selected={decision === 'advance'} onClick={() => setDecision('advance')} icon={<ArrowUp className="h-4 w-4" />} label="Avançar" tone="green" />
                <DecisionButton selected={decision === 'maintain'} onClick={() => setDecision('maintain')} icon={<ArrowRight className="h-4 w-4" />} label="Manter" tone="blue" />
                <DecisionButton selected={decision === 'regress'} onClick={() => setDecision('regress')} icon={<ArrowDown className="h-4 w-4" />} label="Regredir" tone="amber" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Justificativa (opcional)</label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ex.: Atleta tolerou bem 80g/h sem GI, avançar para 90g/h…"
                  rows={3}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                A decisão é registrada no histórico. A fase do atleta deve ser ajustada manualmente
                no card "Fase atual" se necessário.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleConfirm} disabled={decide.isPending}>
                {decide.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function Metric({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold ${valueClass || ''}`}>{value}</p>
    </div>
  );
}

function DecisionButton({
  selected, onClick, icon, label, tone,
}: {
  selected: boolean; onClick: () => void; icon: React.ReactNode; label: string;
  tone: 'green' | 'blue' | 'amber';
}) {
  const toneClass =
    selected
      ? tone === 'green' ? 'bg-green-600 text-white border-green-600'
      : tone === 'amber' ? 'bg-amber-600 text-white border-amber-600'
      : 'bg-primary text-primary-foreground border-primary'
      : 'bg-background hover:bg-muted';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 border rounded-md py-3 transition ${toneClass}`}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

function decisionLabel(d: string): string {
  if (d === 'advance') return 'Avançar';
  if (d === 'maintain') return 'Manter';
  if (d === 'regress') return 'Regredir';
  return d;
}
