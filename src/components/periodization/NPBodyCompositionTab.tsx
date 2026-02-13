import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Save, Plus, Info, ScanLine, Loader2 } from 'lucide-react';
import { useNutritionalPeriodization } from '@/hooks/useNutritionalPeriodization';
import { femalePercentiles, malePercentiles, bodyFatReference } from '@/data/bodyCompositionReference';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Props {
  consultationId: string;
  clientId: string;
}

const circumferenceFields = [
  { key: 'chest', label: 'Peitoral' },
  { key: 'waist', label: 'Cintura' },
  { key: 'abdomen', label: 'Abdômen' },
  { key: 'hip', label: 'Quadril' },
  { key: 'right_arm', label: 'Braço D' },
  { key: 'left_arm', label: 'Braço E' },
  { key: 'right_arm_contracted', label: 'Braço D Contraído' },
  { key: 'forearm', label: 'Antebraço' },
  { key: 'right_thigh_max', label: 'Coxa max D' },
  { key: 'left_thigh_max', label: 'Coxa max E' },
  { key: 'right_calf', label: 'Panturrilha D' },
  { key: 'left_calf', label: 'Panturrilha E' },
];

const skinfoldFields = [
  { key: 'triceps', label: 'Tríceps' },
  { key: 'subscapular', label: 'Subescapular' },
  { key: 'biceps', label: 'Bíceps' },
  { key: 'suprailiac', label: 'Supra-ilíaca' },
  { key: 'abdominal', label: 'Abdominal' },
  { key: 'thigh', label: 'Coxa' },
  { key: 'calf', label: 'Panturrilha' },
];

export function NPBodyCompositionTab({ consultationId, clientId }: Props) {
  const { fetchAssessments, saveAssessment } = useNutritionalPeriodization(clientId);
  const { data: assessments = [] } = fetchAssessments(consultationId);
  const [form, setForm] = useState<any>({ consultation_id: consultationId, client_id: clientId, assessment_date: new Date().toISOString().split('T')[0] });

  const [scanType, setScanType] = useState<string>('bioimpedance');
  const [scanning, setScanning] = useState(false);
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = (key: string, value: any) => setForm((prev: any) => ({ ...prev, [key]: value }));

  const skinfoldSum = skinfoldFields.reduce((sum, f) => sum + (Number(form[f.key]) || 0), 0);

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

      // Apply extracted data to form
      const mapping: Record<string, string> = {
        weight: 'weight',
        fat_percentage: 'fat_percentage',
        fat_kg: 'fat_kg',
        lean_mass_percentage: 'lean_mass_percentage',
        lean_mass_kg: 'lean_mass_kg',
        bmr_kcal: 'bmr_kcal',
      };

      // For ultrasound fields
      const usMapping: Record<string, string> = {
        fat_percentage: 'us_fat_percentage',
        lean_mass_percentage: 'us_lean_mass_percentage',
        fat_kg: 'us_fat_kg',
        lean_mass_kg: 'us_lean_mass_kg',
      };

      setForm((prev: any) => {
        const updated = { ...prev };
        Object.entries(data).forEach(([key, value]) => {
          if (value != null) {
            const formKey = mapping[key];
            if (formKey) updated[formKey] = value;
          }
        });
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
    saveAssessment.mutate({ ...form, consultation_id: consultationId, client_id: clientId });
  };

  const loadAssessment = (assessment: any) => {
    setForm({ ...assessment });
  };

  return (
    <div className="space-y-4">
      {/* Previous assessments */}
      {assessments.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Avaliações Anteriores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {assessments.map((a: any) => (
                <Button key={a.id} variant="outline" size="sm" onClick={() => loadAssessment(a)}>
                  {new Date(a.assessment_date).toLocaleDateString('pt-BR')}
                </Button>
              ))}
              <Button variant="ghost" size="sm" onClick={() => setForm({ consultation_id: consultationId, client_id: clientId, assessment_date: new Date().toISOString().split('T')[0] })}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Nova
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {/* AI Scanner */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Dialog open={scanDialogOpen} onOpenChange={setScanDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  <ScanLine className="h-4 w-4" /> Escanear Exame (IA)
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
                    Envie uma foto do resultado do exame. A IA irá extrair os dados automaticamente para preencher os campos.
                  </p>
                </div>
              </DialogContent>
            </Dialog>
            <span className="text-xs text-muted-foreground">Envie foto de bioimpedância ou calorimetria para preenchimento automático</span>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="measures">
        <TabsList>
          <TabsTrigger value="measures">Medidas</TabsTrigger>
          <TabsTrigger value="ultrasound">Ultrassom</TabsTrigger>
          <TabsTrigger value="percentiles">Percentis</TabsTrigger>
          <TabsTrigger value="fatref">% Gordura Ref.</TabsTrigger>
        </TabsList>

        <TabsContent value="measures">
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Data da Avaliação</label>
                <Input type="date" value={form.assessment_date || ''} onChange={e => update('assessment_date', e.target.value)} className="w-48" />
              </div>

              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">Circunferências (cm) - ISAK</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {circumferenceFields.map(f => (
                    <div key={f.key}>
                      <label className="text-xs text-muted-foreground">{f.label}</label>
                      <Input type="number" step="0.1" value={form[f.key] || ''} onChange={e => update(f.key, e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                  Dobras Cutâneas (mm) - ISAK
                  <Badge className="bg-primary/20 text-primary ml-2">Σ7: {skinfoldSum.toFixed(1)} mm</Badge>
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {skinfoldFields.map(f => (
                    <div key={f.key}>
                      <label className="text-xs text-muted-foreground">{f.label}</label>
                      <Input type="number" step="0.1" value={form[f.key] || ''} onChange={e => update(f.key, e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={handleSave} className="gap-1">
                <Save className="h-4 w-4" /> Salvar Avaliação
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ultrasound">
          <Card>
            <CardContent className="pt-4 space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground">Dados do Ultrassom</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">% Gordura</label>
                  <Input type="number" step="0.1" value={form.us_fat_percentage || ''} onChange={e => update('us_fat_percentage', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">% MLG</label>
                  <Input type="number" step="0.1" value={form.us_lean_mass_percentage || ''} onChange={e => update('us_lean_mass_percentage', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Gordura (kg)</label>
                  <Input type="number" step="0.1" value={form.us_fat_kg || ''} onChange={e => update('us_fat_kg', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">MLG (kg)</label>
                  <Input type="number" step="0.1" value={form.us_lean_mass_kg || ''} onChange={e => update('us_lean_mass_kg', e.target.value)} />
                </div>
              </div>
              <Button onClick={handleSave} className="gap-1">
                <Save className="h-4 w-4" /> Salvar
              </Button>
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

        <TabsContent value="fatref">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">% Gordura por Modalidade Esportiva</CardTitle></CardHeader>
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
      </Tabs>
    </div>
  );
}
