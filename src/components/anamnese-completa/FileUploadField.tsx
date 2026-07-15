// Upload de anexos (exames) para o bucket PRIVADO athlete-attachments.
// Caminho: <clientId>/<timestamp>-<arquivo>. Guarda apenas metadados (path/name)
// na resposta; a visualização assinada é feita na área do admin (Fase 3).
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Paperclip, X, FileText } from 'lucide-react';

interface Attachment { path: string; name: string; size?: number; uploaded_at?: string }

export function FileUploadField({ value, onChange, disabled, clientId }: {
  value: any; onChange: (v: Attachment[]) => void; answersByKey?: Record<string, any>; disabled?: boolean; clientId?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const files: Attachment[] = Array.isArray(value) ? value : [];

  const pick = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    if (!clientId) { toast.error('Não foi possível identificar o atleta para o upload.'); return; }
    if (file.size > 15 * 1024 * 1024) { toast.error('Arquivo muito grande (máx. 15 MB).'); return; }
    setBusy(true);
    try {
      const safe = file.name.replace(/[^\w.\-]+/g, '_');
      const path = `${clientId}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage.from('athlete-attachments').upload(path, file, { upsert: false });
      if (error) throw error;
      onChange([...files, { path, name: file.name, size: file.size, uploaded_at: new Date().toISOString() }]);
      toast.success('Arquivo anexado.');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao anexar o arquivo.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async (att: Attachment) => {
    try { await supabase.storage.from('athlete-attachments').remove([att.path]); } catch { /* ignora */ }
    onChange(files.filter((f) => f.path !== att.path));
  };

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" className="hidden" accept="application/pdf,image/*"
        onChange={(e) => pick(e.target.files)} disabled={disabled || busy} />
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => inputRef.current?.click()} disabled={disabled || busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />} Anexar arquivo
      </Button>
      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((f) => (
            <div key={f.path} className="flex items-center gap-2 rounded border bg-muted/30 px-2 py-1.5 text-xs">
              <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="truncate">{f.name}</span>
              {!disabled && <button type="button" className="ml-auto text-destructive" onClick={() => remove(f)}><X className="h-3.5 w-3.5" /></button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
