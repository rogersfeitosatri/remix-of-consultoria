import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTargetRaces, useCreateTargetRace } from '@/hooks/useTargetRaces';
import { useActiveRace, useUpsertActiveRace } from '@/hooks/useNutriPeriodiza';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface NpDraft {
  enabled: boolean;
  race_name: string;
  race_date: string;
  race_distance_km: number | null;
  race_type: string;
  target_time_minutes: number | null;
  notes: string;
}

interface Props {
  clientId?: string;
  onDraftChange?: (d: NpDraft) => void;
}

export function NpRegistrationSection({ clientId, onDraftChange }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [newRaceName, setNewRaceName] = useState('');

  const { data: races } = useTargetRaces();
  const { mutateAsync: createRace, isPending: creating } = useCreateTargetRace();
  const { data: activeRace } = useActiveRace(clientId);
  const { mutateAsync: upsertRace, isPending: saving } = useUpsertActiveRace(clientId, user?.id);

  const [draft, setDraft] = useState<NpDraft>({
    enabled: false,
    race_name: '',
    race_date: '',
    race_distance_km: null,
    race_type: 'road',
    target_time_minutes: null,
    notes: '',
  });

  // Load existing race when editing
  useEffect(() => {
    if (activeRace) {
      setOpen(true);
      setDraft({
        enabled: true,
        race_name: activeRace.race_name || '',
        race_date: activeRace.race_date || '',
        race_distance_km: activeRace.race_distance_km,
        race_type: activeRace.race_type || 'road',
        target_time_minutes: activeRace.target_time_minutes,
        notes: activeRace.notes || '',
      });
    }
  }, [activeRace?.id]);

  useEffect(() => {
    onDraftChange?.(draft);
  }, [draft]);

  const handleCreateRace = async () => {
    if (!newRaceName.trim()) return;
    try {
      const r = await createRace(newRaceName.trim());
      setDraft({ ...draft, race_name: r.name });
      setNewRaceName('');
      toast.success('Prova adicionada à biblioteca');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao adicionar');
    }
  };

  const handleSaveNow = async () => {
    if (!clientId) {
      toast.info('Salve o cadastro do atleta primeiro');
      return;
    }
    if (!draft.race_date) {
      toast.error('Informe a data da prova');
      return;
    }
    try {
      await upsertRace({
        id: activeRace?.id,
        race_name: draft.race_name || null,
        race_date: draft.race_date,
        race_distance_km: draft.race_distance_km,
        race_type: draft.race_type,
        target_time_minutes: draft.target_time_minutes,
        notes: draft.notes || null,
      });
    } catch {}
  };

  return (
    <div className="border rounded-lg">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/40"
      >
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <span className="font-medium">Periodização Nutricional & Prova Alvo</span>
          {activeRace && (
            <span className="text-xs text-muted-foreground">
              ({activeRace.race_name || 'sem nome'} · {activeRace.race_date})
            </span>
          )}
        </div>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      {open && (
        <div className="p-4 pt-0 space-y-4 border-t">
          <div className="flex items-center justify-between">
            <Label htmlFor="np_enabled">Habilitar acompanhamento de prova alvo</Label>
            <Switch
              id="np_enabled"
              checked={draft.enabled}
              onCheckedChange={(v) => setDraft({ ...draft, enabled: v })}
            />
          </div>

          {draft.enabled && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Prova (biblioteca)</Label>
                  <Select
                    value={draft.race_name}
                    onValueChange={(v) => setDraft({ ...draft, race_name: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma prova" />
                    </SelectTrigger>
                    <SelectContent>
                      {(races || []).map((r) => (
                        <SelectItem key={r.id} value={r.name}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Adicionar nova prova"
                      value={newRaceName}
                      onChange={(e) => setNewRaceName(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleCreateRace}
                      disabled={creating || !newRaceName.trim()}
                    >
                      Adicionar
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="np_race_date">Data da prova</Label>
                  <Input
                    id="np_race_date"
                    type="date"
                    value={draft.race_date}
                    onChange={(e) => setDraft({ ...draft, race_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="np_distance">Distância</Label>
                  <Select
                    value={
                      draft.race_distance_km === 5 ? '5' :
                      draft.race_distance_km === 10 ? '10' :
                      draft.race_distance_km === 21.1 ? '21.1' :
                      draft.race_distance_km === 42.2 ? '42.2' :
                      draft.race_distance_km != null && draft.race_distance_km >= 50 ? 'ultra' :
                      draft.race_distance_km != null ? 'custom' : ''
                    }
                    onValueChange={(v) => {
                      if (v === 'custom' || v === 'ultra') {
                        setDraft({ ...draft, race_distance_km: draft.race_distance_km ?? (v === 'ultra' ? 50 : null) });
                      } else {
                        setDraft({ ...draft, race_distance_km: Number(v) });
                      }
                    }}
                  >
                    <SelectTrigger id="np_distance">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5K</SelectItem>
                      <SelectItem value="10">10K</SelectItem>
                      <SelectItem value="21.1">Meia-maratona (21,1K)</SelectItem>
                      <SelectItem value="42.2">Maratona (42,2K)</SelectItem>
                      <SelectItem value="ultra">Ultramaratona (50K+)</SelectItem>
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="km exatos"
                    value={draft.race_distance_km ?? ''}
                    onChange={(e) =>
                      setDraft({ ...draft, race_distance_km: e.target.value ? Number(e.target.value) : null })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={draft.race_type}
                    onValueChange={(v) => setDraft({ ...draft, race_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="road">Rua / Asfalto</SelectItem>
                      <SelectItem value="trail">Trail</SelectItem>
                      <SelectItem value="ultra">Ultra</SelectItem>
                      <SelectItem value="triathlon">Triatlo</SelectItem>
                      <SelectItem value="cycling">Ciclismo</SelectItem>
                      <SelectItem value="other">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="np_target_time">Meta de tempo (min)</Label>
                  <Input
                    id="np_target_time"
                    type="number"
                    min="0"
                    value={draft.target_time_minutes ?? ''}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        target_time_minutes: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="np_notes">Observações da prova</Label>
                <Input
                  id="np_notes"
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  placeholder="Estratégia, suplementação, etc."
                />
              </div>

              {clientId && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveNow}
                    disabled={saving || !draft.race_date}
                  >
                    Salvar prova alvo
                  </Button>
                </div>
              )}
              {!clientId && (
                <p className="text-xs text-muted-foreground">
                  Salve o cadastro primeiro. A prova alvo será salva em seguida na aba "Preparação de Prova" do perfil.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
