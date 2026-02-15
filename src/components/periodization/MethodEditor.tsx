import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  BookOpen, Plus, Trash2, Edit, Save, ChevronDown, ChevronUp, GripVertical, Loader2
} from 'lucide-react';
import { usePeriodizationMethod } from '@/hooks/usePeriodizationMethod';

export function MethodEditor() {
  const { method, phases, loadingMethod, loadingPhases, createMethod, updatePhase, addPhase, deletePhase, togglePhase } = usePeriodizationMethod();
  const [editingPhase, setEditingPhase] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);

  // Auto-create method if none exists
  if (!loadingMethod && !method) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-sm font-semibold">Nenhum método configurado</h3>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Crie o método global de periodização com as fases do manual.
          </p>
          <Button size="sm" onClick={() => createMethod.mutate()} disabled={createMethod.isPending} className="gap-1">
            {createMethod.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            Criar Método Periodiza
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loadingPhases) {
    return <Card><CardContent className="py-6 text-center text-xs text-muted-foreground">Carregando fases...</CardContent></Card>;
  }

  const openNewPhase = () => {
    setEditingPhase({
      phase_name: '',
      phase_order: phases.length,
      phase_goal: '',
      macro_targets: [''],
      supplementation_daily: [''],
      pre_intra_long_run: { pre: '', intra: '', post: '' },
      functional_support: [''],
      do_checklist: [''],
      avoid_checklist: [''],
      is_active: true,
    });
    setDialogOpen(true);
  };

  const openEditPhase = (phase: any) => {
    setEditingPhase({
      ...phase,
      macro_targets: Array.isArray(phase.macro_targets) ? phase.macro_targets : [],
      supplementation_daily: Array.isArray(phase.supplementation_daily) ? phase.supplementation_daily : [],
      pre_intra_long_run: phase.pre_intra_long_run || { pre: '', intra: '', post: '' },
      functional_support: Array.isArray(phase.functional_support) ? phase.functional_support : [],
      do_checklist: Array.isArray(phase.do_checklist) ? phase.do_checklist : [],
      avoid_checklist: Array.isArray(phase.avoid_checklist) ? phase.avoid_checklist : [],
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!editingPhase) return;
    // Clean empty strings from arrays
    const cleaned = {
      ...editingPhase,
      macro_targets: editingPhase.macro_targets.filter((s: string) => s.trim()),
      supplementation_daily: editingPhase.supplementation_daily.filter((s: string) => s.trim()),
      functional_support: editingPhase.functional_support.filter((s: string) => s.trim()),
      do_checklist: editingPhase.do_checklist.filter((s: string) => s.trim()),
      avoid_checklist: editingPhase.avoid_checklist.filter((s: string) => s.trim()),
    };

    if (cleaned.id) {
      updatePhase.mutate(cleaned);
    } else {
      addPhase.mutate(cleaned);
    }
    setDialogOpen(false);
    setEditingPhase(null);
  };

  const updateListItem = (field: string, idx: number, value: string) => {
    const list = [...(editingPhase[field] || [])];
    list[idx] = value;
    setEditingPhase({ ...editingPhase, [field]: list });
  };

  const addListItem = (field: string) => {
    setEditingPhase({ ...editingPhase, [field]: [...(editingPhase[field] || []), ''] });
  };

  const removeListItem = (field: string, idx: number) => {
    const list = [...(editingPhase[field] || [])];
    list.splice(idx, 1);
    setEditingPhase({ ...editingPhase, [field]: list });
  };

  const PHASE_COLORS: Record<string, string> = {
    'Base': 'border-l-blue-500',
    'Construção': 'border-l-amber-500',
    'Pico': 'border-l-emerald-500',
    'Transição': 'border-l-purple-500',
  };

  const getPhaseColor = (name: string) => {
    return Object.entries(PHASE_COLORS).find(([k]) => name.includes(k))?.[1] || 'border-l-muted-foreground';
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Manual do Método
            <Badge variant="outline" className="text-[10px]">{phases.length} fases</Badge>
          </CardTitle>
          <Button size="sm" onClick={openNewPhase} className="gap-1 text-xs h-7">
            <Plus className="h-3 w-3" /> Nova Fase
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {phases.map((phase: any) => (
          <Collapsible
            key={phase.id}
            open={expandedPhase === phase.id}
            onOpenChange={() => setExpandedPhase(expandedPhase === phase.id ? null : phase.id)}
          >
            <div className={`border rounded-lg border-l-4 ${getPhaseColor(phase.phase_name)} ${!phase.is_active ? 'opacity-50' : ''}`}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{phase.phase_name}</span>
                    <Badge variant="outline" className="text-[9px]">Ordem {phase.phase_order + 1}</Badge>
                    {!phase.is_active && <Badge variant="outline" className="text-[9px] text-muted-foreground">Inativa</Badge>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={phase.is_active}
                      onCheckedChange={(v) => { togglePhase.mutate({ id: phase.id, is_active: v }); }}
                      className="scale-75"
                      onClick={(e) => e.stopPropagation()}
                    />
                    {expandedPhase === phase.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </div>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
                  <p className="text-xs text-muted-foreground"><strong>Objetivo:</strong> {phase.phase_goal}</p>

                  {phase.macro_targets?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Macronutrientes</p>
                      {(phase.macro_targets as string[]).map((t: string, i: number) => (
                        <p key={i} className="text-xs">• {t}</p>
                      ))}
                    </div>
                  )}

                  {phase.supplementation_daily?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Suplementação</p>
                      {(phase.supplementation_daily as string[]).map((s: string, i: number) => (
                        <p key={i} className="text-xs">• {s}</p>
                      ))}
                    </div>
                  )}

                  {phase.do_checklist?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">✅ O que fazer</p>
                      {(phase.do_checklist as string[]).map((d: string, i: number) => (
                        <p key={i} className="text-xs">• {d}</p>
                      ))}
                    </div>
                  )}

                  {phase.avoid_checklist?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">🚫 O que evitar</p>
                      {(phase.avoid_checklist as string[]).map((a: string, i: number) => (
                        <p key={i} className="text-xs text-destructive/80">• {a}</p>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => openEditPhase(phase)} className="gap-1 text-xs h-6">
                      <Edit className="h-3 w-3" /> Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deletePhase.mutate(phase.id)} className="gap-1 text-xs h-6 text-destructive">
                      <Trash2 className="h-3 w-3" /> Excluir
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}

        {/* Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-sm">{editingPhase?.id ? 'Editar Fase' : 'Nova Fase'}</DialogTitle>
            </DialogHeader>
            {editingPhase && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Nome da Fase</label>
                    <Input value={editingPhase.phase_name} onChange={e => setEditingPhase({ ...editingPhase, phase_name: e.target.value })} className="h-8 text-xs" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Ordem</label>
                    <Input type="number" value={editingPhase.phase_order} onChange={e => setEditingPhase({ ...editingPhase, phase_order: Number(e.target.value) })} className="h-8 text-xs" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Objetivo da Fase</label>
                  <Textarea value={editingPhase.phase_goal} onChange={e => setEditingPhase({ ...editingPhase, phase_goal: e.target.value })} rows={2} className="text-xs" />
                </div>

                {/* Dynamic list fields */}
                {[
                  { field: 'macro_targets', label: 'Macronutrientes (bullets)' },
                  { field: 'supplementation_daily', label: 'Suplementação Diária' },
                  { field: 'functional_support', label: 'Nutrição Funcional' },
                  { field: 'do_checklist', label: '✅ O que fazer' },
                  { field: 'avoid_checklist', label: '🚫 O que evitar' },
                ].map(({ field, label }) => (
                  <div key={field}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-muted-foreground">{label}</label>
                      <Button variant="ghost" size="sm" onClick={() => addListItem(field)} className="h-5 text-[10px] gap-0.5 px-1">
                        <Plus className="h-2.5 w-2.5" /> add
                      </Button>
                    </div>
                    {(editingPhase[field] || []).map((item: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-1 mb-1">
                        <Input value={item} onChange={e => updateListItem(field, idx, e.target.value)} className="h-7 text-xs flex-1" />
                        <Button variant="ghost" size="sm" onClick={() => removeListItem(field, idx)} className="h-7 w-7 p-0 text-destructive shrink-0">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ))}

                {/* Pre/Intra/Post Long Run */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Estratégia Longão / Treino</label>
                  {['pre', 'intra', 'post'].map(k => (
                    <div key={k} className="mt-1">
                      <span className="text-[10px] text-muted-foreground capitalize">{k === 'pre' ? 'Pré' : k === 'intra' ? 'Durante' : 'Pós'}</span>
                      <Textarea
                        value={editingPhase.pre_intra_long_run?.[k] || ''}
                        onChange={e => setEditingPhase({
                          ...editingPhase,
                          pre_intra_long_run: { ...editingPhase.pre_intra_long_run, [k]: e.target.value }
                        })}
                        rows={2}
                        className="text-xs"
                      />
                    </div>
                  ))}
                </div>

                <Button size="sm" onClick={handleSave} disabled={!editingPhase.phase_name} className="gap-1 w-full">
                  <Save className="h-3 w-3" /> Salvar Fase
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
