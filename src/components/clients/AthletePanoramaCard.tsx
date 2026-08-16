import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  ClipboardCheck, CalendarCheck, Pencil, Snowflake, Trophy, AlertCircle, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAthletePanorama, CHECKIN_LABEL, CONSULT_LABEL, type PendKind } from '@/hooks/useAthletePanorama';

// Cor por DONO da pendência: vermelho = depende de você; âmbar = depende do
// atleta; azul = agenda. Mesmo código do Radar no dashboard.
const PEND_TONE: Record<PendKind, string> = {
  nutri_pendente: 'border-rose-500/40 bg-rose-500/5 text-rose-600',
  atleta_nao_respondeu: 'border-amber-500/40 bg-amber-500/5 text-amber-600',
  checkin_atrasado: 'border-yellow-500/40 bg-yellow-500/5 text-yellow-700',
  consulta_atrasada: 'border-sky-500/40 bg-sky-500/5 text-sky-600',
  consulta_nunca: 'border-slate-500/40 bg-slate-500/5 text-slate-600',
};

const fmt = (d: string | null) => (d ? format(parseISO(d), 'dd/MM/yy', { locale: ptBR }) : '—');

export function AthletePanoramaCard({ clientId, onEditClient }: { clientId: string; onEditClient?: () => void }) {
  const { data: p, isLoading } = useAthletePanorama(clientId);
  const [editing, setEditing] = useState(false);
  const navigate = useNavigate();

  if (isLoading || !p) return null;

  // Faixa do contrato: responde "que plano é esse?" num olhar.
  const modality = [
    p.hasConsultations
      ? `Consulta ${CONSULT_LABEL[p.consultationFrequency ?? ''] ?? p.consultationFrequency ?? ''}`.trim() +
        (p.consultationCount ? ` · ${p.consultationsDone}/${p.consultationCount}` : '')
      : 'Sem consulta',
    p.hasCheckin
      ? `Check-in ${CHECKIN_LABEL[p.checkinFrequency ?? ''] ?? p.checkinFrequency ?? ''}`.trim()
      : 'Sem check-in',
  ];

  return (
    <>
      <Card className="mb-4">
        <CardContent className="p-4 space-y-3">
          {/* Contrato vigente */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Acompanhamento
            </span>
            {p.planType && <Badge variant="secondary" className="text-[11px] capitalize">{p.planType.replace(/_/g, ' ')}</Badge>}
            {p.planDuration && <Badge variant="outline" className="text-[11px]">{p.planDuration}</Badge>}
            {p.isFrozen && (
              <Badge className="text-[11px] bg-blue-600 hover:bg-blue-600 gap-1">
                <Snowflake className="h-3 w-3" /> Congelado
              </Badge>
            )}
            {p.daysToEnd != null && !p.isFrozen && (
              <Badge variant={p.daysToEnd <= 15 ? 'destructive' : 'outline'} className="text-[11px]">
                {p.daysToEnd < 0 ? `Venceu há ${Math.abs(p.daysToEnd)}d` : `Vence em ${p.daysToEnd}d`}
              </Badge>
            )}
            <Button variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-xs text-muted-foreground ml-auto"
              onClick={() => setEditing(true)}>
              <Pencil className="h-3 w-3" /> Editar acompanhamento
            </Button>
          </div>

          {/* Modalidade — o que foi contratado */}
          <div className="flex flex-wrap gap-2">
            {modality.map((m) => (
              <span key={m} className={`rounded-md border px-2 py-1 text-xs ${
                m.startsWith('Sem') ? 'text-muted-foreground border-dashed' : 'font-medium'
              }`}>{m}</span>
            ))}
            {p.targetRace && (
              <span className="rounded-md border border-primary/40 bg-primary/5 px-2 py-1 text-xs font-medium text-primary inline-flex items-center gap-1">
                <Trophy className="h-3 w-3" /> {p.targetRace}
                {p.weeksToRace != null && p.weeksToRace >= 0 && ` · ${p.weeksToRace} sem.`}
              </span>
            )}
          </div>

          {/* Últimos marcos — o que aconteceu */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
            <Marco label="Última consulta" value={fmt(p.lastConsultation)} />
            <Marco label="Próxima consulta" value={fmt(p.nextConsultation)} />
            <Marco label="Check-in enviado" value={fmt(p.lastCheckinSent)} />
            <Marco label="Check-in respondido" value={fmt(p.lastCheckinAnswered)} />
          </div>

          {/* Pendências, com ação direta */}
          {p.pendings.length > 0 ? (
            <div className="space-y-1.5">
              {p.pendings.map((pd, i) => (
                <div key={i} className={`flex flex-wrap items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${PEND_TONE[pd.kind]}`}>
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 min-w-0">{pd.label}</span>
                  {pd.responseId && (
                    <Button size="sm" className="h-6 gap-1 text-[11px]"
                      onClick={() => navigate(`/checkin-review/${pd.responseId}`)}>
                      <ClipboardCheck className="h-3 w-3" /> Responder
                    </Button>
                  )}
                  {(pd.kind === 'consulta_atrasada' || pd.kind === 'consulta_nunca') && (
                    <Button size="sm" variant="outline" className="h-6 gap-1 text-[11px]"
                      onClick={() => navigate('/calendar')}>
                      <CalendarCheck className="h-3 w-3" /> Agendar
                    </Button>
                  )}
                  {pd.kind === 'checkin_atrasado' && (
                    <Button size="sm" variant="outline" className="h-6 gap-1 text-[11px]"
                      onClick={() => navigate('/checkin')}>
                      <ClipboardCheck className="h-3 w-3" /> Enviar check-in
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1.5 text-xs text-emerald-700">
              Acompanhamento em dia.
            </p>
          )}
        </CardContent>
      </Card>

      {editing && (
        <EditFollowUpDialog clientId={clientId} panorama={p} onClose={() => setEditing(false)} />
      )}
    </>
  );
}

function Marco({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

// Edição da MODALIDADE do acompanhamento — o que o nutri contratou com o atleta.
function EditFollowUpDialog({ clientId, panorama, onClose }: {
  clientId: string; panorama: ReturnType<typeof useAthletePanorama>['data']; onClose: () => void;
}) {
  const p = panorama!;
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    has_consultations: p.hasConsultations,
    consultation_frequency: p.consultationFrequency ?? 'monthly',
    consultation_count: p.consultationCount ?? 1,
    has_checkin: p.hasCheckin,
    checkin_frequency: p.checkinFrequency ?? 'weekly',
    end_date: p.endDate ?? '',
  });

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('clients').update({
        has_consultations: f.has_consultations,
        consultation_frequency: f.has_consultations ? f.consultation_frequency : null,
        consultation_count: f.has_consultations ? Number(f.consultation_count) || null : null,
        has_checkin: f.has_checkin,
        checkin_frequency: f.has_checkin ? f.checkin_frequency : null,
        end_date: f.end_date || null,
      } as any).eq('id', clientId);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['athlete-panorama', clientId] });
      qc.invalidateQueries({ queryKey: ['athlete-radar'] });
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Acompanhamento atualizado.');
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Não foi possível salvar.');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Editar acompanhamento</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Plano com consulta</Label>
              <Switch checked={f.has_consultations} onCheckedChange={(v) => setF({ ...f, has_consultations: v })} />
            </div>
            {f.has_consultations && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Periodicidade</Label>
                  <Select value={f.consultation_frequency} onValueChange={(v) => setF({ ...f, consultation_frequency: v })}>
                    <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="six_weeks">A cada 6 semanas</SelectItem>
                      <SelectItem value="once">Única</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Total contratado</Label>
                  <Input type="number" min={1} className="mt-1 h-9" value={f.consultation_count}
                    onChange={(e) => setF({ ...f, consultation_count: Number(e.target.value) })} />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Plano com check-in</Label>
              <Switch checked={f.has_checkin} onCheckedChange={(v) => setF({ ...f, has_checkin: v })} />
            </div>
            {f.has_checkin && (
              <div>
                <Label className="text-xs text-muted-foreground">Periodicidade</Label>
                <Select value={f.checkin_frequency} onValueChange={(v) => setF({ ...f, checkin_frequency: v })}>
                  <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="biweekly">Quinzenal</SelectItem>
                    <SelectItem value="three_weeks">A cada 3 semanas</SelectItem>
                    <SelectItem value="monthly">Mensal (4 semanas)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Vencimento do plano</Label>
            <Input type="date" className="mt-1 h-9" value={f.end_date}
              onChange={(e) => setF({ ...f, end_date: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
