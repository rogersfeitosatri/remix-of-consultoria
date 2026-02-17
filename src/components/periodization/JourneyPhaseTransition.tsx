import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ArrowRight, History, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { parseISO, format, isAfter } from 'date-fns';

interface Props {
  phases: any[];
  currentPhaseId?: string;
  transitions: any[];
  onTransition: (fromPhaseId: string, toPhaseId: string, notes: string) => void;
  isTransitioning: boolean;
}

export function JourneyPhaseTransition({ phases, currentPhaseId, transitions, onTransition, isTransitioning }: Props) {
  const [notes, setNotes] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const today = new Date();
  const currentPhase = phases.find(p => p.id === currentPhaseId);
  const currentIdx = currentPhase ? phases.findIndex(p => p.id === currentPhase.id) : -1;
  const nextPhase = currentIdx >= 0 && currentIdx < phases.length - 1 ? phases[currentIdx + 1] : null;

  // Check if current phase end date has passed
  const phaseExpired = currentPhase?.end_date && isAfter(today, parseISO(currentPhase.end_date));

  const handleTransition = () => {
    if (currentPhase && nextPhase) {
      onTransition(currentPhase.id, nextPhase.id, notes);
      setNotes('');
      setShowConfirm(false);
    }
  };

  const autoAdjustments = nextPhase ? [
    nextPhase.train_low_strategy === 'proibido' && currentPhase?.train_low_strategy !== 'proibido'
      ? `Train-Low será desativado (${currentPhase?.train_low_strategy} → proibido)`
      : null,
    nextPhase.train_low_strategy === 'reduzido' && currentPhase?.train_low_strategy === 'permitido'
      ? `Train-Low será reduzido (permitido → reduzido)`
      : null,
    `Faixa de CHO: ${currentPhase?.cho_range || '?'} → ${nextPhase.cho_range || '?'}`,
  ].filter(Boolean) : [];

  return (
    <div className="space-y-3">
      {/* Transition Control */}
      {currentPhase && nextPhase && (
        <Card className={phaseExpired ? 'border-amber-500/50' : ''}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-primary" />
                Controle de Transição
              </CardTitle>
              {phaseExpired && (
                <Badge className="text-[9px] bg-amber-500/20 text-amber-400 border-amber-500/30">
                  <AlertTriangle className="h-3 w-3 mr-1" /> Fase expirada
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 p-2 rounded-lg border border-border bg-muted/30 text-center">
                <p className="text-[9px] text-muted-foreground uppercase">Fase Atual</p>
                <p className="text-xs font-bold">{currentPhase.phase_name}</p>
                <p className="text-[9px] text-muted-foreground">
                  até {currentPhase.end_date ? format(parseISO(currentPhase.end_date), 'dd/MM/yy') : '—'}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 p-2 rounded-lg border border-primary/30 bg-primary/5 text-center">
                <p className="text-[9px] text-muted-foreground uppercase">Próxima Fase</p>
                <p className="text-xs font-bold text-primary">{nextPhase.phase_name}</p>
                <p className="text-[9px] text-muted-foreground">
                  {nextPhase.start_date ? format(parseISO(nextPhase.start_date), 'dd/MM/yy') : '—'}
                </p>
              </div>
            </div>

            {/* Auto adjustments preview */}
            {autoAdjustments.length > 0 && (
              <div className="p-2 rounded-lg bg-muted/30 border border-border">
                <p className="text-[9px] font-medium text-muted-foreground uppercase mb-1">Ajustes automáticos</p>
                {autoAdjustments.map((adj, i) => (
                  <p key={i} className="text-[10px] text-muted-foreground">• {adj}</p>
                ))}
              </div>
            )}

            {!showConfirm ? (
              <Button size="sm" onClick={() => setShowConfirm(true)} className="gap-1 text-xs w-full">
                <ArrowRight className="h-3 w-3" /> Iniciar Transição para {nextPhase.phase_name}
              </Button>
            ) : (
              <div className="space-y-2">
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Notas sobre a transição (opcional)..."
                  rows={2}
                  className="text-xs"
                />
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowConfirm(false)} className="text-xs flex-1">
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleTransition} disabled={isTransitioning} className="gap-1 text-xs flex-1">
                    <CheckCircle2 className="h-3 w-3" /> Confirmar Transição
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Transition History */}
      {transitions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              Histórico de Transições
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {transitions.map((t) => (
                <div key={t.id} className="flex items-start gap-2 p-2 rounded-lg border border-border bg-muted/10 text-xs">
                  <div className="shrink-0 mt-0.5">
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">
                      {t.from_phase_name || '—'} → {t.to_phase_name || '—'}
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      {format(parseISO(t.transition_date), 'dd/MM/yyyy')}
                    </p>
                    {t.notes && <p className="text-[10px] text-muted-foreground mt-0.5">{t.notes}</p>}
                    {t.auto_adjustments && (t.auto_adjustments as any[]).length > 0 && (
                      <div className="mt-1">
                        {(t.auto_adjustments as string[]).map((adj, i) => (
                          <Badge key={i} variant="outline" className="text-[8px] mr-1 mb-0.5">{adj}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
