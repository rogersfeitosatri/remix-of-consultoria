import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  useProtocolDefaults,
  useUpsertProtocolDefault,
  type ProtocolDefaultRow,
} from '@/hooks/useNutriPeriodizaDefaults';
import {
  PHASE_META,
  DISTANCE_LABEL,
  type RacePhase,
  type DistanceCategory,
  getStaticProtocol,
} from '@/lib/nutriperiodiza';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Save } from 'lucide-react';

const PHASES: RacePhase[] = ['base', 'build', 'specific', 'peak', 'taper', 'race'];
const DISTANCES: DistanceCategory[] = ['5k_10k', 'half', 'marathon', 'ultra'];

function emptyRow(phase: RacePhase, distance: DistanceCategory): ProtocolDefaultRow {
  const fb = getStaticProtocol(phase, distance);
  return {
    phase,
    distance_category: distance,
    cho_daily_range: fb.cho_daily_range,
    gut_training_description: fb.gut_training,
    pre_training_protocol: fb.pre_training,
    cho_intra_min_g_h: null,
    cho_intra_max_g_h: null,
    cho_intra_description: fb.intra_training,
    cho_intra_source: null,
    carboloading_indicated: fb.carboloading_indicated,
    carboloading_protocol: fb.carboloading,
    carboloading_duration_days: null,
    carboloading_min_gkg: null,
    carboloading_max_gkg: null,
    clinical_focus: null,
    alerts_contraindications: null,
  };
}

export default function NutriPeriodizaProtocols() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: rows = [], isLoading } = useProtocolDefaults(user?.id);
  const upsert = useUpsertProtocolDefault(user?.id);

  const [activePhase, setActivePhase] = useState<RacePhase>('base');
  const [activeDistance, setActiveDistance] = useState<DistanceCategory>('marathon');
  const [draft, setDraft] = useState<Record<string, ProtocolDefaultRow>>({});

  const key = `${activePhase}::${activeDistance}`;
  const stored = useMemo(
    () => rows.find((r) => r.phase === activePhase && r.distance_category === activeDistance),
    [rows, activePhase, activeDistance],
  );
  const current: ProtocolDefaultRow = draft[key] ?? stored ?? emptyRow(activePhase, activeDistance);

  function update(patch: Partial<ProtocolDefaultRow>) {
    setDraft((d) => ({ ...d, [key]: { ...current, ...patch } }));
  }

  async function handleSave() {
    await upsert.mutateAsync(current);
    setDraft((d) => {
      const c = { ...d };
      delete c[key];
      return c;
    });
  }

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Editor de Protocolos NutriPeriodiza</h1>
          <p className="text-sm text-muted-foreground">
            Defina os defaults usados em cada combinação fase × distância. Os campos vazios usam o
            padrão científico embutido como fallback.
          </p>
        </div>
      </div>

      <Tabs value={activePhase} onValueChange={(v) => setActivePhase(v as RacePhase)}>
        <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full mb-4">
          {PHASES.map((p) => (
            <TabsTrigger key={p} value={p}>
              <span className="mr-1">{PHASE_META[p].emoji}</span>
              {PHASE_META[p].label}
            </TabsTrigger>
          ))}
        </TabsList>

        {PHASES.map((p) => (
          <TabsContent key={p} value={p}>
            <Tabs value={activeDistance} onValueChange={(v) => setActiveDistance(v as DistanceCategory)}>
              <TabsList className="grid grid-cols-4 w-full mb-4">
                {DISTANCES.map((d) => (
                  <TabsTrigger key={d} value={d}>
                    {DISTANCE_LABEL[d]}
                  </TabsTrigger>
                ))}
              </TabsList>

              {DISTANCES.map((d) => (
                <TabsContent key={d} value={d}>
                  {p === activePhase && d === activeDistance && (
                    <Card>
                      <CardHeader>
                        <CardTitle>
                          {PHASE_META[p].emoji} {PHASE_META[p].label} — {DISTANCE_LABEL[d]}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label>CHO diário (g/kg/dia)</Label>
                          <Input
                            value={current.cho_daily_range || ''}
                            onChange={(e) => update({ cho_daily_range: e.target.value })}
                            placeholder="ex.: 5–7 g/kg/dia"
                          />
                        </div>

                        <div>
                          <Label>Treino intestinal (descrição)</Label>
                          <Textarea
                            rows={2}
                            value={current.gut_training_description || ''}
                            onChange={(e) => update({ gut_training_description: e.target.value })}
                          />
                        </div>

                        <div>
                          <Label>Pré-treino (protocolo)</Label>
                          <Textarea
                            rows={2}
                            value={current.pre_training_protocol || ''}
                            onChange={(e) => update({ pre_training_protocol: e.target.value })}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Intra-treino — min (g/h)</Label>
                            <Input
                              type="number"
                              value={current.cho_intra_min_g_h ?? ''}
                              onChange={(e) =>
                                update({ cho_intra_min_g_h: e.target.value ? Number(e.target.value) : null })
                              }
                            />
                          </div>
                          <div>
                            <Label>Intra-treino — max (g/h)</Label>
                            <Input
                              type="number"
                              value={current.cho_intra_max_g_h ?? ''}
                              onChange={(e) =>
                                update({ cho_intra_max_g_h: e.target.value ? Number(e.target.value) : null })
                              }
                            />
                          </div>
                        </div>

                        <div>
                          <Label>Intra-treino (descrição)</Label>
                          <Textarea
                            rows={2}
                            value={current.cho_intra_description || ''}
                            onChange={(e) => update({ cho_intra_description: e.target.value })}
                          />
                        </div>

                        <div>
                          <Label>Fonte CHO recomendada</Label>
                          <Input
                            value={current.cho_intra_source || ''}
                            onChange={(e) => update({ cho_intra_source: e.target.value })}
                            placeholder="ex.: glicose:frutose 2:1"
                          />
                        </div>

                        <div className="border rounded-lg p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-base">Carbo-loading indicado</Label>
                            <Switch
                              checked={!!current.carboloading_indicated}
                              onCheckedChange={(v) => update({ carboloading_indicated: v })}
                            />
                          </div>
                          {current.carboloading_indicated && (
                            <>
                              <div>
                                <Label>Protocolo</Label>
                                <Textarea
                                  rows={2}
                                  value={current.carboloading_protocol || ''}
                                  onChange={(e) => update({ carboloading_protocol: e.target.value })}
                                />
                              </div>
                              <div className="grid grid-cols-3 gap-3">
                                <div>
                                  <Label>Dias</Label>
                                  <Input
                                    type="number"
                                    value={current.carboloading_duration_days ?? ''}
                                    onChange={(e) =>
                                      update({
                                        carboloading_duration_days: e.target.value ? Number(e.target.value) : null,
                                      })
                                    }
                                  />
                                </div>
                                <div>
                                  <Label>Min g/kg</Label>
                                  <Input
                                    type="number"
                                    step="0.1"
                                    value={current.carboloading_min_gkg ?? ''}
                                    onChange={(e) =>
                                      update({
                                        carboloading_min_gkg: e.target.value ? Number(e.target.value) : null,
                                      })
                                    }
                                  />
                                </div>
                                <div>
                                  <Label>Max g/kg</Label>
                                  <Input
                                    type="number"
                                    step="0.1"
                                    value={current.carboloading_max_gkg ?? ''}
                                    onChange={(e) =>
                                      update({
                                        carboloading_max_gkg: e.target.value ? Number(e.target.value) : null,
                                      })
                                    }
                                  />
                                </div>
                              </div>
                            </>
                          )}
                        </div>

                        <div>
                          <Label>Foco clínico</Label>
                          <Textarea
                            rows={2}
                            value={current.clinical_focus || ''}
                            onChange={(e) => update({ clinical_focus: e.target.value })}
                          />
                        </div>

                        <div>
                          <Label>Alertas / contraindicações</Label>
                          <Textarea
                            rows={2}
                            value={current.alerts_contraindications || ''}
                            onChange={(e) => update({ alerts_contraindications: e.target.value })}
                          />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <Button onClick={handleSave} disabled={upsert.isPending}>
                            <Save className="h-4 w-4 mr-2" />
                            {stored ? 'Atualizar' : 'Salvar protocolo'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </TabsContent>
        ))}
      </Tabs>

      {isLoading && <p className="text-sm text-muted-foreground mt-4">Carregando…</p>}
    </div>
  );
}
