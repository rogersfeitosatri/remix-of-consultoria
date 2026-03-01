import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Loader2, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callId: string;
  onSuccess: () => void;
}

interface ColumnMapping {
  name: string;
  email: string;
  phone: string;
}

export default function ImportResponsesDialog({ open, onOpenChange, callId, onSuccess }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'map' | 'importing' | 'done'>('upload');
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({ name: '', email: '', phone: '' });
  const [result, setResult] = useState({ imported: 0, skipped: 0 });

  const reset = () => {
    setStep('upload');
    setColumns([]);
    setRows([]);
    setMapping({ name: '', email: '', phone: '' });
    setResult({ imported: 0, skipped: 0 });
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

        if (json.length === 0) {
          toast.error('Planilha vazia.');
          return;
        }

        const cols = Object.keys(json[0]);
        setColumns(cols);
        setRows(json);

        // Auto-detect columns
        const autoMap: ColumnMapping = { name: '', email: '', phone: '' };
        for (const col of cols) {
          const lower = col.toLowerCase();
          if (!autoMap.name && (lower.includes('nome') || lower.includes('name') || lower === 'nome completo')) {
            autoMap.name = col;
          }
          if (!autoMap.email && (lower.includes('email') || lower.includes('e-mail'))) {
            autoMap.email = col;
          }
          if (!autoMap.phone && (lower.includes('telefone') || lower.includes('phone') || lower.includes('whatsapp') || lower.includes('celular'))) {
            autoMap.phone = col;
          }
        }
        setMapping(autoMap);
        setStep('map');
      } catch {
        toast.error('Erro ao ler a planilha.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const formatPhone = (raw: any): string => {
    if (!raw) return '';
    let phone = String(raw).replace(/\D/g, '');
    if (phone.startsWith('0')) phone = phone.substring(1);
    if (!phone.startsWith('55')) phone = '55' + phone;
    return phone;
  };

  const handleImport = async () => {
    if (!mapping.name) {
      toast.error('Selecione a coluna de Nome.');
      return;
    }

    setStep('importing');
    let imported = 0;
    let skipped = 0;

    const answerColumns = columns.filter(
      c => c !== mapping.name && c !== mapping.email && c !== mapping.phone
      && !c.toLowerCase().includes('carimbo') && !c.toLowerCase().includes('timestamp')
    );

    for (const row of rows) {
      try {
        const name = row[mapping.name] ? String(row[mapping.name]).trim() : '';
        const email = mapping.email && row[mapping.email] ? String(row[mapping.email]).trim() : '';
        const phone = formatPhone(mapping.phone ? row[mapping.phone] : '');

        if (!name && !email && !phone) {
          skipped++;
          continue;
        }

        // Build answers object from remaining columns
        const answers: Record<string, string> = {};
        for (const col of answerColumns) {
          if (row[col] !== undefined && row[col] !== null && row[col] !== '') {
            answers[col] = String(row[col]);
          }
        }

        const { error } = await supabase
          .from('strategic_call_responses')
          .insert({
            call_id: callId,
            respondent_name: name || null,
            respondent_email: email || null,
            respondent_phone: phone || null,
            answers,
            total_score: 0,
            classification: 'medium',
            whatsapp_sent: false,
          } as any);

        if (error) {
          skipped++;
        } else {
          imported++;
        }
      } catch {
        skipped++;
      }
    }

    setResult({ imported, skipped });
    setStep('done');
    if (imported > 0) onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar respostas do Google Forms
          </DialogTitle>
          <DialogDescription>
            Exporte as respostas do Google Forms como Excel (.xlsx) e importe aqui.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
            <Button variant="outline" className="w-full h-24 border-dashed" onClick={() => fileRef.current?.click()}>
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Clique para selecionar a planilha</span>
              </div>
            </Button>
          </div>
        )}

        {step === 'map' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{rows.length} respostas encontradas. Mapeie as colunas:</p>

            <div className="space-y-3">
              <div>
                <Label>Coluna de Nome *</Label>
                <Select value={mapping.name} onValueChange={(v) => setMapping(m => ({ ...m, name: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Coluna de E-mail</Label>
                <Select value={mapping.email} onValueChange={(v) => setMapping(m => ({ ...m, email: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">(nenhuma)</SelectItem>
                    {columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Coluna de Telefone/WhatsApp</Label>
                <Select value={mapping.phone} onValueChange={(v) => setMapping(m => ({ ...m, phone: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">(nenhuma)</SelectItem>
                    {columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              As demais colunas serão importadas como respostas. Telefones serão formatados com DDI +55 automaticamente.
            </p>

            <Button className="w-full" onClick={handleImport}>
              Importar {rows.length} respostas
            </Button>
          </div>
        )}

        {step === 'importing' && (
          <div className="flex flex-col items-center py-8 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Importando respostas...</p>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center py-6 gap-3">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <p className="text-sm font-medium">{result.imported} respostas importadas com sucesso!</p>
            {result.skipped > 0 && (
              <p className="text-xs text-muted-foreground">{result.skipped} linhas ignoradas (vazias ou com erro)</p>
            )}
            <Button onClick={() => { reset(); onOpenChange(false); }}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
