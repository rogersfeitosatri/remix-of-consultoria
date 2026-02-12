import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useClients } from '@/hooks/useClients';
import { useWhatsAppContacts, useCreateBroadcast } from '@/hooks/useBroadcasts';
import { Send, Clock, Upload, X, Search, UserPlus, Users, Paperclip, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Recipient {
  id: string;
  name: string;
  phone: string;
  type: 'client' | 'contact';
  clientId?: string;
  contactId?: string;
}

export function BroadcastComposeDialog({ open, onOpenChange }: Props) {
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

      // Determine media type
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

    createBroadcast.mutate({
      internal_title: title,
      body,
      media_url: mediaUrl,
      media_type: mediaType,
      send_type: sendType,
      scheduled_at: sendType === 'scheduled' ? new Date(scheduledAt).toISOString() : null,
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
    setShowPreview(false);
  };

  const insertVariable = (v: string) => {
    setBody(prev => prev + `{${v}}`);
  };

  const renderPreview = (text: string) => {
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
          <DialogTitle>Nova Mensagem WhatsApp</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Title */}
          <div>
            <Label>Título interno</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Lembrete check-in semanal"
            />
          </div>

          {/* Body */}
          <div>
            <Label>Corpo da mensagem</Label>
            <div className="flex flex-wrap gap-1 mb-2">
              {['nome', 'primeiro_nome', 'link_checkin', 'prazo_resposta', 'plano', 'data'].map(v => (
                <Badge
                  key={v}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary/10"
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
              <Button variant="ghost" size="sm" className="mt-1 gap-1" onClick={() => setShowPreview(!showPreview)}>
                <Eye className="h-3 w-3" />
                {showPreview ? 'Ocultar preview' : 'Preview'}
              </Button>
            )}
            {showPreview && (
              <div className="mt-2 p-3 rounded-lg bg-muted/50 text-sm whitespace-pre-wrap">
                {renderPreview(body)}
              </div>
            )}
          </div>

          {/* Attachments */}
          <div>
            <Label>Anexo (opcional)</Label>
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
                {uploading ? 'Enviando...' : 'Anexar arquivo'}
              </Button>
              {mediaFile && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{mediaFile.name}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => { setMediaFile(null); setMediaUrl(null); setMediaType(null); }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Send type */}
          <div className="flex items-center gap-4">
            <Label>Tipo de envio:</Label>
            <div className="flex items-center gap-2">
              <Switch checked={sendType === 'scheduled'} onCheckedChange={v => setSendType(v ? 'scheduled' : 'immediate')} />
              <span className="text-sm">{sendType === 'scheduled' ? 'Agendado' : 'Imediato'}</span>
            </div>
            {sendType === 'scheduled' && (
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                className="w-auto"
              />
            )}
          </div>

          {/* Recipients */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Destinatários ({recipients.length})</Label>
              <Button variant="outline" size="sm" onClick={addAllActiveClients} className="gap-1">
                <Users className="h-3 w-3" />
                Todos ativos
              </Button>
            </div>

            {/* Search & add */}
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
              <div className="flex flex-wrap gap-1.5">
                {recipients.map(r => (
                  <Badge key={r.id} variant="secondary" className="gap-1">
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
              {sendType === 'immediate' ? <Send className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
              {createBroadcast.isPending ? 'Enviando...' :
                sendType === 'immediate' ? `Enviar para ${recipients.length}` : 'Agendar envio'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
