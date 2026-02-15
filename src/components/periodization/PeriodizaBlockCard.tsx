import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ChevronDown, ChevronUp, Save, Copy, Check, Plus, Trash2, Pencil
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const PHASE_COLORS: Record<string, string> = {
  'Base Metabólica': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Transição': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'Performance': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'Taper': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

const DAY_TYPE_COLORS: Record<string, string> = {
  low: 'bg-blue-500/15 text-blue-400',
  moderate: 'bg-amber-500/15 text-amber-400',
  high: 'bg-emerald-500/15 text-emerald-400',
  recovery: 'bg-muted text-muted-foreground',
};

interface Props {
  block: any;
  index: number;
  isExpanded: boolean;
  isCurrent: boolean;
  onToggle: () => void;
  onSave: (updatedBlock: any) => void;
  trainingStimuli: Record<number, string[]>;
  geePerDay: number[];
}

export function PeriodizaBlockCard({ block, index, isExpanded, isCurrent, onToggle, onSave, trainingStimuli, geePerDay }: Props) {
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const phase = block.phase_name || 'Bloco';
  const phaseColor = Object.entries(PHASE_COLORS).find(([k]) => phase.includes(k))?.[1] || 'bg-muted text-muted-foreground border-border';

  const startEdit = () => {
    setEditData(JSON.parse(JSON.stringify(block)));
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditData(null);
  };

  const saveEdit = () => {
    onSave(editData);
    setEditing(false);
    setEditData(null);
  };

  const data = editing ? editData : block;

  // Supplement helpers
  const addSupplement = (type: 'supplements_daily' | 'functional_supps') => {
    if (type === 'supplements_daily') {
      const list = [...(editData.supplements_daily || []), { name: '', dose: '', timing: '' }];
      setEditData({ ...editData, supplements_daily: list });
    } else {
      const list = [...(editData.functional_supps || []), ''];
      setEditData({ ...editData, functional_supps: list });
    }
  };

  const removeSupplement = (type: 'supplements_daily' | 'functional_supps', idx: number) => {
    if (type === 'supplements_daily') {
      const list = [...(editData.supplements_daily || [])];
      list.splice(idx, 1);
      setEditData({ ...editData, supplements_daily: list });
    } else {
      const list = [...(editData.functional_supps || [])];
      list.splice(idx, 1);
      setEditData({ ...editData, functional_supps: list });
    }
  };

  const updateDailySupplement = (idx: number, field: string, value: string) => {
    const list = [...(editData.supplements_daily || [])];
    list[idx] = { ...list[idx], [field]: value };
    setEditData({ ...editData, supplements_daily: list });
  };

  const updateFunctionalSupplement = (idx: number, value: string) => {
    const list = [...(editData.functional_supps || [])];
    list[idx] = value;
    setEditData({ ...editData, functional_supps: list });
  };

  const updateTarget = (field: string, value: string) => {
    setEditData({
      ...editData,
      phase_targets: { ...(editData.phase_targets || {}), [field]: value }
    });
  };

  const updateStrategy = (section: string, field: string, value: string) => {
    setEditData({
      ...editData,
      [section]: { ...(editData[section] || {}), [field]: value }
    });
  };

  const updateWeeklyDay = (dayIdx: number, field: string, value: any) => {
    const table = [...(editData.weekly_table || [])];
    table[dayIdx] = { ...table[dayIdx], [field]: value };
    setEditData({ ...editData, weekly_table: table });
  };

  const copyBlock = () => {
    const lines = [
      `📋 ${block.phase_name} (${block.date_start} a ${block.date_end})`,
      '',
      `CHO: ${block.phase_targets?.cho_gkg || '—'} g/kg/dia`,
      `Proteína: ${block.phase_targets?.protein_gkg || '—'} g/kg/dia`,
      '',
      '📦 Suplementação:',
      ...(block.supplements_daily || []).map((s: any) => `  • ${s.name} ${s.dose} (${s.timing})`),
      '',
      '📅 Tabela Semanal:',
      ...(block.weekly_table || []).map((d: any) => `  ${d.day}: [${d.type?.toUpperCase()}] CHO ${d.cho_gkg}g/kg — ${d.note || ''}`),
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className={`${isCurrent ? 'ring-2 ring-primary/50' : ''} ${isExpanded ? 'border-primary/30' : ''}`}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={`text-xs ${phaseColor}`}>B{index + 1}</Badge>
          <span className="text-xs font-semibold">{phase}</span>
          <span className="text-[10px] text-muted-foreground">{block.date_start} → {block.date_end}</span>
          {isCurrent && <Badge className="text-[9px] bg-primary/20 text-primary border-primary/30">ATUAL</Badge>}
          {block.phase_targets?.cho_gkg && (
            <Badge variant="outline" className="text-[10px]">CHO {block.phase_targets.cho_gkg} g/kg</Badge>
          )}
        </div>
        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {isExpanded && (
        <CardContent className="space-y-4 border-t border-border pt-4">
          {/* Edit/Save Controls */}
          <div className="flex gap-2 justify-end">
            {!editing ? (
              <>
                <Button variant="outline" size="sm" onClick={copyBlock} className="gap-1 text-xs h-7">
                  {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
                <Button size="sm" onClick={startEdit} className="gap-1 text-xs h-7">
                  <Pencil className="h-3 w-3" /> Editar bloco
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={cancelEdit} className="text-xs h-7">Cancelar</Button>
                <Button size="sm" onClick={saveEdit} className="gap-1 text-xs h-7">
                  <Save className="h-3 w-3" /> Salvar alterações
                </Button>
              </>
            )}
          </div>

          {/* Phase Targets */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">🎯 Diretrizes Nutricionais</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { key: 'cho_gkg', label: 'CHO (g/kg/dia)' },
                { key: 'protein_gkg', label: 'Proteína (g/kg/dia)' },
                { key: 'fat_guidance', label: 'Gorduras' },
                { key: 'fiber_guidance', label: 'Fibras' },
              ].map(({ key, label }) => (
                <div key={key} className="p-2 rounded bg-muted/30 border border-border">
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                  {editing ? (
                    <Input
                      value={editData.phase_targets?.[key] || ''}
                      onChange={e => updateTarget(key, e.target.value)}
                      className="h-7 text-xs mt-1"
                    />
                  ) : (
                    <p className="text-sm font-bold">{data.phase_targets?.[key] || '—'}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Supplements Daily */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">💊 Suplementação Diária</p>
              {editing && (
                <Button variant="ghost" size="sm" onClick={() => addSupplement('supplements_daily')} className="h-6 text-xs gap-1">
                  <Plus className="h-3 w-3" /> Adicionar
                </Button>
              )}
            </div>
            {(data.supplements_daily || []).length > 0 ? (
              <div className="space-y-1">
                {(data.supplements_daily || []).map((s: any, si: number) => (
                  <div key={si} className="flex items-center gap-2">
                    {editing ? (
                      <>
                        <Input placeholder="Nome" value={s.name || ''} onChange={e => updateDailySupplement(si, 'name', e.target.value)} className="h-7 text-xs flex-1" />
                        <Input placeholder="Dose" value={s.dose || ''} onChange={e => updateDailySupplement(si, 'dose', e.target.value)} className="h-7 text-xs w-20" />
                        <Input placeholder="Timing" value={s.timing || ''} onChange={e => updateDailySupplement(si, 'timing', e.target.value)} className="h-7 text-xs w-24" />
                        <Button variant="ghost" size="sm" onClick={() => removeSupplement('supplements_daily', si)} className="h-7 w-7 p-0 text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">{s.name} {s.dose} ({s.timing})</Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground">Nenhum suplemento adicionado</p>
            )}
          </div>

          {/* Functional Supplements */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">🧬 Suplementação Funcional</p>
              {editing && (
                <Button variant="ghost" size="sm" onClick={() => addSupplement('functional_supps')} className="h-6 text-xs gap-1">
                  <Plus className="h-3 w-3" /> Adicionar
                </Button>
              )}
            </div>
            {(data.functional_supps || []).length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {(data.functional_supps || []).map((s: string, si: number) => (
                  editing ? (
                    <div key={si} className="flex items-center gap-1">
                      <Input value={s} onChange={e => updateFunctionalSupplement(si, e.target.value)} className="h-7 text-xs w-36" />
                      <Button variant="ghost" size="sm" onClick={() => removeSupplement('functional_supps', si)} className="h-7 w-7 p-0 text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Badge key={si} variant="outline" className="text-[10px]">{s}</Badge>
                  )
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground">Nenhum suplemento funcional</p>
            )}
          </div>

          {/* Long Run Strategy */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">🏃 Estratégia do Longão</p>
            <div className="grid grid-cols-3 gap-2">
              {['pre', 'intra', 'post'].map(field => (
                <div key={field} className="p-2 rounded bg-muted/20 border border-border">
                  <p className="text-[10px] text-muted-foreground capitalize">{field === 'pre' ? 'Pré' : field === 'intra' ? 'Durante' : 'Pós'}</p>
                  {editing ? (
                    <Textarea
                      value={editData.long_run_strategy?.[field] || ''}
                      onChange={e => updateStrategy('long_run_strategy', field, e.target.value)}
                      rows={2}
                      className="text-xs mt-1"
                    />
                  ) : (
                    <p className="text-xs mt-1">{data.long_run_strategy?.[field] || '—'}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Pre/Intra Strategy */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">⚡ Pré e Intra Treino</p>
            <div className="grid grid-cols-2 gap-2">
              {['pre', 'intra'].map(field => (
                <div key={field} className="p-2 rounded bg-muted/20 border border-border">
                  <p className="text-[10px] text-muted-foreground">{field === 'pre' ? 'Pré-treino' : 'Intra-treino'}</p>
                  {editing ? (
                    <Textarea
                      value={editData.pre_intra_strategy?.[field] || ''}
                      onChange={e => updateStrategy('pre_intra_strategy', field, e.target.value)}
                      rows={2}
                      className="text-xs mt-1"
                    />
                  ) : (
                    <p className="text-xs mt-1">{data.pre_intra_strategy?.[field] || '—'}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Weekly Table */}
          {data.weekly_table && data.weekly_table.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">📅 Tabela Semanal</p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] font-bold w-16"></TableHead>
                      {data.weekly_table.map((d: any, di: number) => (
                        <TableHead key={di} className="text-[10px] text-center font-bold">{d.day}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Stimulus */}
                    <TableRow>
                      <TableCell className="text-[10px] font-semibold py-1">Estímulo</TableCell>
                      {data.weekly_table.map((_: any, di: number) => (
                        <TableCell key={di} className="text-[9px] text-center py-1 text-muted-foreground max-w-[80px]">
                          {trainingStimuli[di]?.join(', ') || 'Descanso'}
                        </TableCell>
                      ))}
                    </TableRow>
                    {/* GEE */}
                    <TableRow>
                      <TableCell className="text-[10px] font-semibold py-1">GEE</TableCell>
                      {data.weekly_table.map((_: any, di: number) => (
                        <TableCell key={di} className="text-[10px] text-center py-1">
                          {geePerDay[di] > 0 ? Math.round(geePerDay[di]) : '—'}
                        </TableCell>
                      ))}
                    </TableRow>
                    {/* Type */}
                    <TableRow>
                      <TableCell className="text-[10px] font-semibold py-1">Tipo</TableCell>
                      {data.weekly_table.map((d: any, di: number) => (
                        <TableCell key={di} className="py-1 text-center">
                          {editing ? (
                            <select
                              value={d.type || 'low'}
                              onChange={e => updateWeeklyDay(di, 'type', e.target.value)}
                              className="text-[9px] bg-transparent border border-border rounded px-1 py-0.5"
                            >
                              <option value="low">LOW</option>
                              <option value="moderate">MOD</option>
                              <option value="high">HIGH</option>
                              <option value="recovery">REC</option>
                            </select>
                          ) : (
                            <Badge className={`text-[9px] ${DAY_TYPE_COLORS[d.type] || ''}`}>
                              {d.type?.toUpperCase() || '—'}
                            </Badge>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                    {/* CHO */}
                    <TableRow>
                      <TableCell className="text-[10px] font-semibold py-1">CHO g/kg</TableCell>
                      {data.weekly_table.map((d: any, di: number) => (
                        <TableCell key={di} className="text-[10px] text-center py-1">
                          {editing ? (
                            <Input
                              type="number"
                              step="0.5"
                              value={d.cho_gkg || ''}
                              onChange={e => updateWeeklyDay(di, 'cho_gkg', Number(e.target.value))}
                              className="h-6 text-[10px] text-center w-14 mx-auto"
                            />
                          ) : (
                            <span className="font-medium">{d.cho_gkg || '—'}</span>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                    {/* Pre/Intra/Post/Note */}
                    {['pre_training', 'intra_training', 'post_training', 'note'].map(field => (
                      <TableRow key={field}>
                        <TableCell className="text-[10px] font-semibold py-1">
                          {field === 'pre_training' ? 'Pré' : field === 'intra_training' ? 'Intra' : field === 'post_training' ? 'Pós' : 'Nota'}
                        </TableCell>
                        {data.weekly_table.map((d: any, di: number) => (
                          <TableCell key={di} className="text-[9px] text-center py-1 text-muted-foreground">
                            {editing ? (
                              <Input
                                value={d[field] || ''}
                                onChange={e => updateWeeklyDay(di, field, e.target.value)}
                                className="h-6 text-[9px] w-full"
                              />
                            ) : (
                              d[field] || '—'
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Admin Notes */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">📝 Observações do Nutri</p>
            {editing ? (
              <Textarea
                value={editData.notes_admin || ''}
                onChange={e => setEditData({ ...editData, notes_admin: e.target.value })}
                rows={2}
                className="text-xs"
                placeholder="Anotações que complementam ou sobrescrevem a IA..."
              />
            ) : (
              <p className="text-xs text-muted-foreground italic">{data.notes_admin || 'Nenhuma observação'}</p>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
