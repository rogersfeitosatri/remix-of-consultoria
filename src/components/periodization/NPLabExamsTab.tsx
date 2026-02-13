import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Save, Plus, Trash2, AlertTriangle, Info } from 'lucide-react';
import { useNutritionalPeriodization } from '@/hooks/useNutritionalPeriodization';
import { labExamsReference, LabExamRef } from '@/data/labExamsReference';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  clientId: string;
}

export function NPLabExamsTab({ clientId }: Props) {
  const { fetchLabResults, saveLabResult, deleteLabResult } = useNutritionalPeriodization(clientId);
  const { data: results = [] } = fetchLabResults(clientId);
  const [panelName, setPanelName] = useState('');
  const [collectionDate, setCollectionDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const categories = useMemo(() => {
    const cats = new Set(labExamsReference.map(e => e.category));
    return Array.from(cats);
  }, []);

  const filteredExams = selectedCategory === 'all'
    ? labExamsReference
    : labExamsReference.filter(e => e.category === selectedCategory);

  // Group results by panel
  const panels = useMemo(() => {
    const map: Record<string, any[]> = {};
    results.forEach((r: any) => {
      const key = `${r.panel_name}|${r.collection_date}`;
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return map;
  }, [results]);

  const isOutOfRange = (value: number, ref: LabExamRef): boolean => {
    if (ref.refMin !== null && value < ref.refMin) return true;
    if (ref.refMax !== null && value > ref.refMax) return true;
    return false;
  };

  const handleSavePanel = () => {
    if (!panelName) return;
    Object.entries(editValues).forEach(([examName, valueStr]) => {
      const value = Number(valueStr);
      if (isNaN(value) || !valueStr) return;
      const ref = labExamsReference.find(e => e.name === examName);
      if (!ref) return;
      saveLabResult.mutate({
        client_id: clientId,
        panel_name: panelName,
        collection_date: collectionDate,
        exam_name: examName,
        exam_category: ref.category,
        result_value: value,
        unit: ref.unit,
        ref_min: ref.refMin,
        ref_max: ref.refMax,
        rcv_95: ref.rcv95,
      });
    });
    setEditValues({});
  };

  return (
    <div className="space-y-4">
      {/* New Panel Entry */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            Registrar Painel de Exames
            <Tooltip>
              <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-sm">Resultados fora da faixa de referência serão destacados em vermelho.</TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nome do Painel</label>
              <Input value={panelName} onChange={e => setPanelName(e.target.value)} placeholder="Ex: Baseline Janeiro" className="w-48" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Data Coleta</label>
              <Input type="date" value={collectionDate} onChange={e => setCollectionDate(e.target.value)} className="w-40" />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="max-h-[50vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Exame</TableHead>
                  <TableHead className="text-xs">Categoria</TableHead>
                  <TableHead className="text-xs text-center">Ref. Min</TableHead>
                  <TableHead className="text-xs text-center">Ref. Max</TableHead>
                  <TableHead className="text-xs text-center">RCV 95%</TableHead>
                  <TableHead className="text-xs text-center">Unidade</TableHead>
                  <TableHead className="text-xs text-center">Resultado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExams.map((exam, i) => {
                  const val = editValues[exam.name];
                  const numVal = Number(val);
                  const outRange = val && !isNaN(numVal) && isOutOfRange(numVal, exam);
                  return (
                    <TableRow key={i} className={outRange ? 'bg-destructive/10' : ''}>
                      <TableCell className="text-xs py-1">{exam.name}</TableCell>
                      <TableCell className="text-xs py-1 text-muted-foreground">{exam.category}</TableCell>
                      <TableCell className="text-xs text-center py-1">{exam.refMin ?? '—'}</TableCell>
                      <TableCell className="text-xs text-center py-1">{exam.refMax ?? '—'}</TableCell>
                      <TableCell className="text-xs text-center py-1">{exam.rcv95 ?? '—'}</TableCell>
                      <TableCell className="text-xs text-center py-1">{exam.unit}</TableCell>
                      <TableCell className="py-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={val || ''}
                          onChange={e => setEditValues(prev => ({ ...prev, [exam.name]: e.target.value }))}
                          className={`h-7 text-xs w-20 text-center ${outRange ? 'border-destructive text-destructive' : ''}`}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <Button onClick={handleSavePanel} size="sm" className="gap-1" disabled={!panelName}>
            <Save className="h-3.5 w-3.5" /> Salvar Painel
          </Button>
        </CardContent>
      </Card>

      {/* Existing Panels */}
      {Object.entries(panels).map(([key, panelResults]) => {
        const [name, date] = key.split('|');
        return (
          <Card key={key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                {name}
                <Badge variant="outline" className="text-xs">{date ? new Date(date + 'T12:00:00').toLocaleDateString('pt-BR') : ''}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Exame</TableHead>
                    <TableHead className="text-xs text-center">Resultado</TableHead>
                    <TableHead className="text-xs text-center">Referência</TableHead>
                    <TableHead className="text-xs text-center">Status</TableHead>
                    <TableHead className="text-xs w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {panelResults.map((r: any) => {
                    const outRange = r.result_value != null && (
                      (r.ref_min != null && r.result_value < r.ref_min) ||
                      (r.ref_max != null && r.result_value > r.ref_max)
                    );
                    return (
                      <TableRow key={r.id} className={outRange ? 'bg-destructive/10' : ''}>
                        <TableCell className="text-xs py-1">{r.exam_name}</TableCell>
                        <TableCell className="text-xs text-center py-1 font-semibold">{r.result_value} {r.unit}</TableCell>
                        <TableCell className="text-xs text-center py-1 text-muted-foreground">
                          {r.ref_min ?? '—'} – {r.ref_max ?? '—'}
                        </TableCell>
                        <TableCell className="text-xs text-center py-1">
                          {outRange ? (
                            <Badge className="bg-destructive/20 text-destructive text-xs gap-1">
                              <AlertTriangle className="h-3 w-3" /> Fora
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">Normal</Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteLabResult.mutate(r.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
