import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useClients } from '@/hooks/useClients';
import { useWhatsAppContacts, useCreateBroadcast } from '@/hooks/useBroadcasts';
import { Send, Clock, Upload, X, Search, UserPlus, Users, Paperclip, Eye, Trash2, Repeat } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface BroadcastPrefill {
  title: string;
  body: string;
  media_url?: string | null;
  media_type?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill?: BroadcastPrefill;
}

interface Recipient {
  id: string;
  name: string;
  phone: string;
  type: 'client' | 'contact';
  clientId?: string;
  contactId?: string;
}

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function BroadcastComposeDialog({ open, onOpenChange, prefill }: Props) {
  const { data: clients = [] } = useClients();
  const { data: contacts = [] } = useWhatsAppContacts();
  const createBroadcast = useCreateBroadcast();
  
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sendType, setSendType] = useState<'immediate' | 'scheduled'>('immediate');
  const [scheduledAt, setScheduledAt] = useState('');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [search, setSearch] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [manualPhone, setManualPhone] = useState('');
  const [manualName, setManualName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recurrence state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([1]); // Monday
  const [recurrenceTime, setRecurrenceTime] = useState('09:00');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');

  useEffect(() => {
    if (open && prefill) {
      setTitle(prefill.title || '');
      setBody(prefill.body || '');
      setMediaUrl(prefill.media_url || null);
      setMediaType(prefill.media_type || null);
    }
  }, [open, prefill]);

  const availableClients = clients.filter(c => 
    c.phone && 
    !recipients.find(r => r.clientId === c.id) &&
    (search === '' || c.name.toLowerCase().includes(search.toLowerCase()))
  );

  const availableContacts = contacts.filter(c =>
    !recipients.find(r => r.contactId === c.id) &&
    (search === '' || (c.full_name || c.phone).toLowerCase().includes(search.toLowerCase()))
  );

  const addClient = (client: any) => {
    setRecipients(prev => [...prev, {
      id: `c-${client.id}`,
      name: client.name,
      phone: client.phone!,
      type: 'client',
      clientId: client.id,
    }]);
  };

  const addContact = (contact: any) => {
    setRecipients(prev => [...prev, {
      id: `ct-${contact.id}`,
      name: contact.full_name || contact.phone,
      phone: contact.phone,
      type: 'contact',
      contactId: contact.id,
    }]);
  };

  const addManualRecipient = () => {
    if (!manualPhone.trim()) return;
    setRecipients(prev => [...prev, {
      id: `m-${Date.now()}`,
      name: manualName || manualPhone,
      phone: manualPhone,
      type: 'contact',
    }]);
    setManualPhone('');
    setManualName('');
  };

  const addAllActiveClients = () => {
    const activeClients = clients.filter(c => c.phone && c.is_active && !recipients.find(r => r.clientId === c.id));
    setRecipients(prev => [
      ...prev,
      ...activeClients.map(c => ({
        id: `c-${c.id}`,
        name: c.name,
        phone: c.phone!,
        type: 'client' as const,
        clientId: c.id,
      })),
    ]);
  };

  const removeRecipient = (id: string) => {
    setRecipients(prev => prev.filter(r => r.id !== id));
  };

  const toggleRecurrenceDay = (day: number) => {
    setRecurrenceDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('broadcast-media')
        .upload(path, file);
      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('broadcast-media')
        .getPublicUrl(path);

      setMediaUrl(urlData.publicUrl);

      if (file.type.startsWith('image/')) setMediaType('image');
      else if (file.type.startsWith('video/')) setMediaType('video');
      else if (file.type.startsWith('audio/')) setMediaType('audio');
      else setMediaType('document');

      setMediaFile(file);
    } catch (err) {
      toast.error('Erro ao fazer upload');
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async () => {
    if (!title.trim()) { toast.error('Informe o título'); return; }
    if (!body.trim()) { toast.error('Informe o corpo da mensagem'); return; }
    if (recipients.length === 0) { toast.error('Adicione pelo menos 1 destinatário'); return; }
    if (sendType === 'scheduled' && !scheduledAt) { toast.error('Informe a data/hora do agendamento'); return; }
    if (isRecurring && recurrenceDays.length === 0) { toast.error('Selecione pelo menos 1 dia para recorrência'); return; }

    createBroadcast.mutate({
      internal_title: title,
      body,
      media_url: mediaUrl,
      media_type: mediaType,
      send_type: sendType,
      scheduled_at: sendType === 'scheduled' ? new Date(scheduledAt).toISOString() : null,
      is_recurring: isRecurring,
      recurrence_type: isRecurring ? recurrenceType : undefined,
      recurrence_days: isRecurring ? recurrenceDays : undefined,
      recurrence_time: isRecurring ? recurrenceTime : undefined,
      recurrence_end_date: isRecurring && recurrenceEndDate ? recurrenceEndDate : undefined,
      recipients: recipients.map(r => ({
        client_id: r.clientId || null,
        contact_id: r.contactId || null,
        phone: r.phone,
        recipient_name: r.name,
      })),
    }, {
      onSuccess: () => {
        onOpenChange(false);
        resetForm();
      },
    });
  };

  const resetForm = () => {
    setTitle(''); setBody(''); setSendType('immediate');
    setScheduledAt(''); setRecipients([]);
    setMediaFile(null); setMediaUrl(null); setMediaType(null);
    setShowPreview(false); setIsRecurring(false);
    setRecurrenceType('weekly'); setRecurrenceDays([1]);
    setRecurrenceTime('09:00'); setRecurrenceEndDate('');
  };

  const insertVariable = (v: string) => {
    setBody(prev => prev + `{${v}}`);
  };

  const renderPreviewText = (text: string) => {
    return text
      .replace(/\{nome\}/g, 'João Silva')
      .replace(/\{primeiro_nome\}/g, 'João')
      .replace(/\{data\}/g, new Date().toLocaleDateString('pt-BR'))
      .replace(/\{link_checkin\}/g, 'https://rogersfeitosa.com.br/form/...')
      .replace(/\{prazo_resposta\}/g, '48h')
      .replace(/\{plano\}/g, 'Premium');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-emerald-500" />
            Nova Mensagem WhatsApp
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Title */}
          <div>
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Título interno</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Lembrete check-in semanal"
              className="mt-1"
            />
          </div>

          {/* Body */}
          <div>
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Corpo da mensagem</Label>
            <div className="flex flex-wrap gap-1 my-1.5">
              {['nome', 'primeiro_nome', 'link_checkin', 'prazo_resposta', 'plano', 'data'].map(v => (
                <Badge
                  key={v}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary/10 text-xs"
                  onClick={() => insertVariable(v)}
                >
                  {`{${v}}`}
                </Badge>
              ))}
            </div>
            <Textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Digite sua mensagem..."
              rows={5}
            />
            {body && (
              <Button variant="ghost" size="sm" className="mt-1 gap-1 text-xs" onClick={() => setShowPreview(!showPreview)}>
                <Eye className="h-3 w-3" />
                {showPreview ? 'Ocultar' : 'Preview'}
              </Button>
            )}
            {showPreview && (
              <div className="mt-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-sm whitespace-pre-wrap">
                {renderPreviewText(body)}
              </div>
            )}
          </div>

          {/* Attachments */}
          <div>
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Anexo (opcional)</Label>
            <div className="flex items-center gap-2 mt-1">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                <Paperclip className="h-4 w-4 mr-1" />
                {uploading ? 'Enviando...' : 'Anexar'}
              </Button>
              {mediaFile && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">{mediaFile.name}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => { setMediaFile(null); setMediaUrl(null); setMediaType(null); }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Send type */}
          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center gap-4">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Tipo de envio</Label>
              <div className="flex items-center gap-2">
                <Switch checked={sendType === 'scheduled'} onCheckedChange={v => setSendType(v ? 'scheduled' : 'immediate')} />
                <span className="text-sm font-medium">{sendType === 'scheduled' ? '📅 Agendado' : '⚡ Imediato'}</span>
              </div>
            </div>
            {sendType === 'scheduled' && (
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                className="w-auto"
              />
            )}

            {/* Recurrence */}
            <div className="border-t pt-3 space-y-3">
              <div className="flex items-center gap-2">
                <Repeat className="h-4 w-4 text-blue-500" />
                <Label className="text-sm font-medium">Recorrência</Label>
                <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
                <span className="text-xs text-muted-foreground">{isRecurring ? 'Ativada' : 'Desativada'}</span>
              </div>

              {isRecurring && (
                <div className="space-y-3 pl-6">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Select value={recurrenceType} onValueChange={(v: any) => setRecurrenceType(v)}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="biweekly">Quinzenal</SelectItem>
                        <SelectItem value="monthly">Mensal</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground">às</span>
                    <Input
                      type="time"
                      value={recurrenceTime}
                      onChange={e => setRecurrenceTime(e.target.value)}
                      className="w-[100px]"
                    />
                  </div>

                  {recurrenceType !== 'monthly' && (
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Dias da semana</Label>
                      <div className="flex gap-1.5">
                        {DAY_LABELS.map((label, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => toggleRecurrenceDay(i)}
                            className={`w-9 h-9 rounded-full text-xs font-medium border transition-colors ${
                              recurrenceDays.includes(i) 
                                ? 'bg-primary text-primary-foreground border-primary' 
                                : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="text-xs text-muted-foreground">Encerrar em (opcional)</Label>
                    <Input
                      type="date"
                      value={recurrenceEndDate}
                      onChange={e => setRecurrenceEndDate(e.target.value)}
                      className="w-auto mt-1"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recipients */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                Destinatários ({recipients.length})
              </Label>
              <div className="flex gap-2">
                {recipients.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setRecipients([])} className="gap-1 text-destructive hover:text-destructive text-xs h-7">
                    <Trash2 className="h-3 w-3" />
                    Limpar
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={addAllActiveClients} className="gap-1 text-xs h-7">
                  <Users className="h-3 w-3" />
                  Todos ativos
                </Button>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar atleta ou contato..."
                className="pl-9"
              />
            </div>

            {search && (availableClients.length > 0 || availableContacts.length > 0) && (
              <ScrollArea className="h-32 border rounded-lg p-2">
                {availableClients.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { addClient(c); setSearch(''); }}
                    className="w-full text-left px-3 py-1.5 rounded hover:bg-muted text-sm flex justify-between"
                  >
                    <span>{c.name}</span>
                    <span className="text-muted-foreground text-xs">{c.phone}</span>
                  </button>
                ))}
                {availableContacts.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { addContact(c); setSearch(''); }}
                    className="w-full text-left px-3 py-1.5 rounded hover:bg-muted text-sm flex justify-between"
                  >
                    <span>{c.full_name || c.phone}</span>
                    <Badge variant="outline" className="text-xs">contato</Badge>
                  </button>
                ))}
              </ScrollArea>
            )}

            {/* Manual add */}
            <div className="flex gap-2">
              <Input
                value={manualName}
                onChange={e => setManualName(e.target.value)}
                placeholder="Nome (opcional)"
                className="flex-1"
              />
              <Input
                value={manualPhone}
                onChange={e => setManualPhone(e.target.value)}
                placeholder="Telefone"
                className="flex-1"
              />
              <Button variant="outline" size="sm" onClick={addManualRecipient}>
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>

            {/* Selected recipients */}
            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {recipients.map(r => (
                  <Badge key={r.id} variant="secondary" className="gap-1 text-xs">
                    {r.name}
                    <button onClick={() => removeRecipient(r.id)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Action */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              onClick={handleSend}
              disabled={createBroadcast.isPending}
              className="gap-2"
            >
              {isRecurring ? <Repeat className="h-4 w-4" /> : sendType === 'immediate' ? <Send className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
              {createBroadcast.isPending ? 'Enviando...' :
                isRecurring ? `Criar recorrência (${recipients.length})` :
                sendType === 'immediate' ? `Enviar para ${recipients.length}` : 'Agendar envio'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
