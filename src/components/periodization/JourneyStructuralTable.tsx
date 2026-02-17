import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Save, Target, Utensils, Pill, FlaskConical, StickyNote, Zap } from 'lucide-react';
import { parseISO, format, isAfter, isBefore } from 'date-fns';

const PHASE_BADGE: Record<string, string> = {
  'Base': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Específica': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'Competitiva': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  'Pico': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'Transição': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

const getBadgeStyle = (name: string) =>
  Object.entries(PHASE_BADGE).find(([k]) => name.includes(k))?.[1] || 'bg-muted text-muted-foreground';

interface Props {
  phases: any[];
  onUpdatePhase: (phaseId: string, data: any) => void;
  isSaving: boolean;
}

export function JourneyStructuralTable({ phases, onUpdatePhase, isSaving }: Props) {
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});

  const today = new Date();

  const getPhaseStatus = (phase: any) => {
    if (!phase.start_date || !phase.end_date) return 'pending';
    const s = parseISO(phase.start_date);
    const e = parseISO(phase.end_date);
    if (isAfter(today, e)) return 'completed';
    if (!isBefore(today, s) && !isAfter(today, e)) return 'active';
    return 'pending';
  };

  const startEditing = (phase: any) => {
    setEditingPhaseId(phase.id);
    setEditData({
      objective: phase.objective || '',
      cho_range: phase.cho_range || '',
      train_low_strategy: phase.train_low_strategy || 'permitido',
      recovery_strategy: phase.recovery_strategy || '',
      body_comp_strategy: phase.body_comp_strategy || '',
      supplement_base: phase.supplement_base || '',
      strategic_notes: phase.strategic_notes || '',
      creatine: phase.creatine || '',
      beta_alanine: phase.beta_alanine || '',
      caffeine: phase.caffeine || '',
      nitrate: phase.nitrate || '',
      supplement_general: phase.supplement_general || '',
    });
  };

  const handleSave = () => {
    if (editingPhaseId) {
      onUpdatePhase(editingPhaseId, editData);
      setEditingPhaseId(null);
    }
  };

  if (phases.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Overview Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Utensils className="h-4 w-4 text-primary" />
            Tabela Estrutural da Periodização
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-[11px]">
                  <TableHead className="text-[11px] font-medium">Fase</TableHead>
                  <TableHead className="text-[11px] font-medium">Objetivo</TableHead>
                  <TableHead className="text-[11px] font-medium">CHO (g/kg)</TableHead>
                  <TableHead className="text-[11px] font-medium">Train-Low</TableHead>
                  <TableHead className="text-[11px] font-medium">Recuperação</TableHead>
                  <TableHead className="text-[11px] font-medium">Comp. Corporal</TableHead>
                  <TableHead className="text-[11px] font-medium">Suplementação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {phases.map((phase) => {
                  const status = getPhaseStatus(phase);
                  return (
                    <TableRow
                      key={phase.id}
                      className={`cursor-pointer hover:bg-muted/50 transition-colors ${status === 'active' ? 'bg-primary/5' : status === 'completed' ? 'opacity-60' : ''}`}
                      onClick={() => startEditing(phase)}
                    >
                      <TableCell className="py-2">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 ${getBadgeStyle(phase.phase_name)}`}>
                            {phase.phase_name}
                          </Badge>
                          {status === 'active' && <Zap className="h-3 w-3 text-primary" />}
                        </div>
                        <p className="text-[9px] text-muted-foreground mt-0.5">{phase.duration_weeks} sem</p>
                      </TableCell>
                      <TableCell className="py-2 text-xs max-w-[150px] truncate">{phase.objective || '—'}</TableCell>
                      <TableCell className="py-2 text-xs font-mono">{phase.cho_range || '—'}</TableCell>
                      <TableCell className="py-2">
                        <Badge variant="outline" className={`text-[9px] ${
                          phase.train_low_strategy === 'permitido' ? 'text-emerald-400 border-emerald-500/30' :
                          phase.train_low_strategy === 'reduzido' ? 'text-amber-400 border-amber-500/30' :
                          'text-destructive border-destructive/30'
                        }`}>
                          {phase.train_low_strategy || '—'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 text-xs max-w-[120px] truncate">{phase.recovery_strategy || '—'}</TableCell>
                      <TableCell className="py-2 text-xs max-w-[120px] truncate">{phase.body_comp_strategy || '—'}</TableCell>
                      <TableCell className="py-2 text-xs max-w-[140px] truncate">{phase.supplement_base || '—'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Phase Detail Editor (Accordion) */}
      {editingPhaseId && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Editar: {phases.find(p => p.id === editingPhaseId)?.phase_name}
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditingPhaseId(null)} className="text-xs h-7">Cancelar</Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1 text-xs h-7">
                  <Save className="h-3 w-3" /> Salvar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="structural" className="w-full">
              <TabsList className="h-7">
                <TabsTrigger value="structural" className="text-[10px] gap-1"><Utensils className="h-3 w-3" /> Estrutural</TabsTrigger>
                <TabsTrigger value="supplements" className="text-[10px] gap-1"><Pill className="h-3 w-3" /> Suplementação</TabsTrigger>
                <TabsTrigger value="notes" className="text-[10px] gap-1"><StickyNote className="h-3 w-3" /> Observações</TabsTrigger>
              </TabsList>

              <TabsContent value="structural" className="mt-3 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground block mb-1">Objetivo da Fase</label>
                    <Textarea
                      value={editData.objective}
                      onChange={e => setEditData({ ...editData, objective: e.target.value })}
                      rows={2}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground block mb-1">Faixa de CHO (g/kg)</label>
                    <Input
                      value={editData.cho_range}
                      onChange={e => setEditData({ ...editData, cho_range: e.target.value })}
                      placeholder="ex: 3-5 g/kg"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground block mb-1">Estratégia Train-Low</label>
                    <Select value={editData.train_low_strategy} onValueChange={v => setEditData({ ...editData, train_low_strategy: v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="permitido">Permitido</SelectItem>
                        <SelectItem value="reduzido">Reduzido</SelectItem>
                        <SelectItem value="proibido">Proibido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground block mb-1">Estratégia de Recuperação</label>
                    <Input
                      value={editData.recovery_strategy}
                      onChange={e => setEditData({ ...editData, recovery_strategy: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground block mb-1">Composição Corporal</label>
                    <Input
                      value={editData.body_comp_strategy}
                      onChange={e => setEditData({ ...editData, body_comp_strategy: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground block mb-1">Suplementação Base</label>
                    <Input
                      value={editData.supplement_base}
                      onChange={e => setEditData({ ...editData, supplement_base: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="supplements" className="mt-3 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground block mb-1">Creatina</label>
                    <Input
                      value={editData.creatine}
                      onChange={e => setEditData({ ...editData, creatine: e.target.value })}
                      placeholder="ex: 5g/dia"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground block mb-1">Beta-alanina</label>
                    <Input
                      value={editData.beta_alanine}
                      onChange={e => setEditData({ ...editData, beta_alanine: e.target.value })}
                      placeholder="ex: 3.2g/dia"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground block mb-1">Cafeína</label>
                    <Input
                      value={editData.caffeine}
                      onChange={e => setEditData({ ...editData, caffeine: e.target.value })}
                      placeholder="ex: 3 mg/kg"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground block mb-1">Nitrato</label>
                    <Input
                      value={editData.nitrate}
                      onChange={e => setEditData({ ...editData, nitrate: e.target.value })}
                      placeholder="ex: 400-800mg"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground block mb-1">Estratégia Geral de Suplementação</label>
                  <Textarea
                    value={editData.supplement_general}
                    onChange={e => setEditData({ ...editData, supplement_general: e.target.value })}
                    rows={2}
                    className="text-xs"
                  />
                </div>
              </TabsContent>

              <TabsContent value="notes" className="mt-3">
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground block mb-1">Observações Estratégicas</label>
                  <Textarea
                    value={editData.strategic_notes}
                    onChange={e => setEditData({ ...editData, strategic_notes: e.target.value })}
                    rows={4}
                    placeholder="Notas estratégicas para esta fase..."
                    className="text-xs"
                  />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
