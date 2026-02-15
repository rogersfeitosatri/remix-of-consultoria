import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Plus, Info, ScanLine, Loader2 } from 'lucide-react';
import { useNutritionalPeriodization } from '@/hooks/useNutritionalPeriodization';
import { femalePercentiles, malePercentiles, bodyFatReference } from '@/data/bodyCompositionReference';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { calculateAge } from '@/lib/nutritionalCalcs';

interface Props {
  consultationId: string;
  clientId: string;
  consultation: any;
  onSaveConsultation: (data: any) => void;
}

export function NPBodyCompositionTab({ consultationId, clientId, consultation, onSaveConsultation }: Props) {
  const { fetchAssessments, saveAssessment } = useNutritionalPeriodization(clientId);
  const { data: assessments = [] } = fetchAssessments(consultationId);

  // Fetch athlete profile for age/sex
  const { data: athleteProfile } = useQuery({
    queryKey: ['athlete-profile-body-comp', clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data } = await supabase
        .from('athlete_profiles')
        .select('birth_date, gender, current_weight, height')
        .eq('client_id', clientId)
        .maybeSingle();
      return data;
    },
    enabled: !!clientId,
  });

  const [form, setForm] = useState<any>({});
  const [scanType, setScanType] = useState<string>('bioimpedance');
  const [scanning, setScanning] = useState(false);
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize form from consultation data
  useEffect(() => {
    if (consultation) {
      setForm({
        weight: consultation.weight || '',
        height: consultation.height || '',
        fat_percentage: consultation.fat_percentage || '',
        fat_kg: consultation.fat_kg || '',
        lean_mass_percentage: consultation.lean_mass_percentage || '',
        lean_mass_kg: consultation.lean_mass_kg || '',
      });
    }
  }, [consultation]);

  const update = (key: string, value: any) => {
    setForm((prev: any) => {
      const next = { ...prev, [key]: value };
      const weight = Number(next.weight) || 0;
      const fatPct = Number(next.fat_percentage) || 0;

      // Auto-calculate derived fields when weight and fat% are available
      if (weight > 0 && fatPct > 0) {
        const fatKg = (weight * fatPct) / 100;
        const leanPct = 100 - fatPct;
        const leanKg = weight - fatKg;
        next.fat_kg = fatKg.toFixed(1);
        next.lean_mass_percentage = leanPct.toFixed(1);
        next.lean_mass_kg = leanKg.toFixed(1);
      }

      return next;
    });
  };

  // Compute age from athlete profile or manual override
  const autoAge = athleteProfile?.birth_date && consultation?.consultation_date
    ? calculateAge(athleteProfile.birth_date, consultation.consultation_date)
    : null;

  const [manualAge, setManualAge] = useState<string>('');
  const [manualGender, setManualGender] = useState<string>('');

  useEffect(() => {
    if (consultation) {
      setManualAge(consultation.manual_age?.toString() || '');
      setManualGender(consultation.manual_gender || '');
    }
  }, [consultation]);

  const age = consultation?.manual_age || autoAge;
  const gender = consultation?.manual_gender || athleteProfile?.gender || '';

  const handleScan = async (file: File) => {
    setScanning(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke('scan-body-composition', {
        body: { imageBase64: base64, scanType },
      });

      if (error) throw error;

      setForm((prev: any) => {
        const updated = { ...prev };
        if (data.weight != null) updated.weight = data.weight;
        if (data.fat_percentage != null) updated.fat_percentage = data.fat_percentage;
        if (data.fat_kg != null) updated.fat_kg = data.fat_kg;
        if (data.lean_mass_percentage != null) updated.lean_mass_percentage = data.lean_mass_percentage;
        if (data.lean_mass_kg != null) updated.lean_mass_kg = data.lean_mass_kg;

        // Recalculate derived fields
        const weight = Number(updated.weight) || 0;
        const fatPct = Number(updated.fat_percentage) || 0;
        if (weight > 0 && fatPct > 0) {
          updated.fat_kg = ((weight * fatPct) / 100).toFixed(1);
          updated.lean_mass_percentage = (100 - fatPct).toFixed(1);
          updated.lean_mass_kg = (weight - Number(updated.fat_kg)).toFixed(1);
        }

        return updated;
      });

      toast({ title: 'Dados extraídos com sucesso', description: 'Revise os valores antes de salvar.' });
      setScanDialogOpen(false);
    } catch (err: any) {
      toast({ title: 'Erro ao escanear', description: err.message, variant: 'destructive' });
    } finally {
      setScanning(false);
    }
  };

  const handleSave = () => {
    // Save to consultation (syncs with TMB tab and dashboard)
    onSaveConsultation({
      id: consultationId,
      weight: form.weight ? Number(form.weight) : null,
      height: form.height ? Number(form.height) : null,
      fat_percentage: form.fat_percentage ? Number(form.fat_percentage) : null,
      fat_kg: form.fat_kg ? Number(form.fat_kg) : null,
      lean_mass_percentage: form.lean_mass_percentage ? Number(form.lean_mass_percentage) : null,
      lean_mass_kg: form.lean_mass_kg ? Number(form.lean_mass_kg) : null,
      manual_age: manualAge ? Number(manualAge) : null,
      manual_gender: manualGender || null,
    });
  };

  return (
    <div className="space-y-4">
      {/* AI Scanner */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Dialog open={scanDialogOpen} onOpenChange={setScanDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  <ScanLine className="h-4 w-4" /> Escanear Bioimpedância (IA)
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Escanear Exame com IA</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Tipo de Exame</label>
                    <Select value={scanType} onValueChange={setScanType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bioimpedance">Bioimpedância</SelectItem>
                        <SelectItem value="calorimetry">Calorimetria Indireta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Foto do Exame</label>
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="mt-1"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleScan(file);
                      }}
                      disabled={scanning}
                    />
                  </div>
                  {scanning && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analisando exame com IA...
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Envie uma foto do resultado do exame. A IA irá extrair os dados automaticamente.
                  </p>
                </div>
              </DialogContent>
            </Dialog>
            <span className="text-xs text-muted-foreground">Envie foto de bioimpedância para preenchimento automático dos dados</span>
          </div>
        </CardContent>
      </Card>

      {/* Main Body Composition */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            Composição Corporal
            <Tooltip>
              <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-sm">
                Insira peso e % de gordura. Os campos %MLG e MLG (kg) são calculados automaticamente.
              </TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Peso (kg)</label>
              <Input type="number" step="0.1" value={form.weight || ''} onChange={e => update('weight', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Estatura (cm)</label>
              <Input type="number" value={form.height || ''} onChange={e => update('height', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Idade</label>
              {autoAge != null ? (
                <Input value={autoAge} disabled className="bg-muted/30" />
              ) : (
                <Input
                  type="number"
                  placeholder="Inserir manualmente"
                  value={manualAge}
                  onChange={e => setManualAge(e.target.value)}
                />
              )}
              {!athleteProfile?.birth_date && !manualAge && (
                <p className="text-xs text-amber-500 mt-0.5">Preencha manualmente ou vincule anamnese</p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Sexo</label>
              {athleteProfile?.gender ? (
                <Input value={athleteProfile.gender === 'masculino' ? 'Masculino' : athleteProfile.gender === 'feminino' ? 'Feminino' : athleteProfile.gender} disabled className="bg-muted/30" />
              ) : (
                <Select value={manualGender} onValueChange={setManualGender}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="feminino">Feminino</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">% Gordura</label>
              <Input type="number" step="0.1" value={form.fat_percentage || ''} onChange={e => update('fat_percentage', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">% MLG</label>
              <Input type="number" step="0.1" value={form.lean_mass_percentage || ''} disabled className="bg-muted/30" />
              <p className="text-xs text-muted-foreground mt-0.5">Auto-calculado</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Gordura (kg)</label>
              <Input type="number" step="0.1" value={form.fat_kg || ''} disabled className="bg-muted/30" />
              <p className="text-xs text-muted-foreground mt-0.5">Auto-calculado</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">MLG (kg)</label>
              <Input type="number" step="0.1" value={form.lean_mass_kg || ''} disabled className="bg-muted/30" />
              <p className="text-xs text-muted-foreground mt-0.5">Auto-calculado</p>
            </div>
          </div>

          <Button onClick={handleSave} className="gap-1">
            <Save className="h-4 w-4" /> Salvar Composição Corporal
          </Button>
        </CardContent>
      </Card>

      {/* Reference Tables */}
      <Tabs defaultValue="fatref">
        <TabsList>
          <TabsTrigger value="fatref">% Gordura Ref.</TabsTrigger>
          <TabsTrigger value="percentiles">Percentis Σ7</TabsTrigger>
        </TabsList>

        <TabsContent value="fatref">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">% Gordura por Modalidade Esportiva (Endurance)</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Esporte</TableHead>
                    <TableHead className="text-xs text-center">Homens</TableHead>
                    <TableHead className="text-xs text-center">Mulheres</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bodyFatReference.map(r => (
                    <TableRow key={r.sport}>
                      <TableCell className="text-xs py-1">{r.sport}</TableCell>
                      <TableCell className="text-xs text-center py-1">{r.male}</TableCell>
                      <TableCell className="text-xs text-center py-1">{r.female}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="percentiles">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Percentis Masculinos - Σ7 Dobras</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Esporte</TableHead>
                      <TableHead className="text-xs text-center">P5</TableHead>
                      <TableHead className="text-xs text-center">P25</TableHead>
                      <TableHead className="text-xs text-center">Med</TableHead>
                      <TableHead className="text-xs text-center">P75</TableHead>
                      <TableHead className="text-xs text-center">P95</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {malePercentiles.map(p => (
                      <TableRow key={p.sport}>
                        <TableCell className="text-xs py-1">{p.sport}</TableCell>
                        <TableCell className="text-xs text-center py-1">{p.p5}</TableCell>
                        <TableCell className="text-xs text-center py-1">{p.p25}</TableCell>
                        <TableCell className="text-xs text-center py-1">{p.median}</TableCell>
                        <TableCell className="text-xs text-center py-1">{p.p75}</TableCell>
                        <TableCell className="text-xs text-center py-1">{p.p95}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Percentis Femininos - Σ7 Dobras</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Esporte</TableHead>
                      <TableHead className="text-xs text-center">P5</TableHead>
                      <TableHead className="text-xs text-center">P25</TableHead>
                      <TableHead className="text-xs text-center">Med</TableHead>
                      <TableHead className="text-xs text-center">P75</TableHead>
                      <TableHead className="text-xs text-center">P95</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {femalePercentiles.map(p => (
                      <TableRow key={p.sport}>
                        <TableCell className="text-xs py-1">{p.sport}</TableCell>
                        <TableCell className="text-xs text-center py-1">{p.p5}</TableCell>
                        <TableCell className="text-xs text-center py-1">{p.p25}</TableCell>
                        <TableCell className="text-xs text-center py-1">{p.median}</TableCell>
                        <TableCell className="text-xs text-center py-1">{p.p75}</TableCell>
                        <TableCell className="text-xs text-center py-1">{p.p95}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
