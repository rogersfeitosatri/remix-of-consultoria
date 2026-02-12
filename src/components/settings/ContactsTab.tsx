import { useState } from 'react';
import { useWhatsAppContacts, useCreateContact, useDeleteContact } from '@/hooks/useBroadcasts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export function ContactsTab() {
  const { data: contacts = [], isLoading } = useWhatsAppContacts();
  const createContact = useCreateContact();
  const deleteContact = useDeleteContact();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [tags, setTags] = useState('');
  const [source, setSource] = useState('');

  const handleAdd = () => {
    if (!phone.trim()) return;
    createContact.mutate({
      full_name: name || undefined,
      phone: phone.trim(),
      tags: tags ? tags.split(',').map(t => t.trim()) : [],
      source: source || undefined,
    }, {
      onSuccess: () => {
        setShowAdd(false);
        setName(''); setPhone(''); setTags(''); setSource('');
      },
    });
  };

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1">
          <Plus className="h-4 w-4" />
          Novo Contato
        </Button>
      </div>

      {contacts.length === 0 ? (
        <div className="text-center p-8 text-muted-foreground">
          Nenhum contato avulso. Adicione contatos para enviar mensagens fora da base de atletas.
        </div>
      ) : (
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.full_name || '-'}</TableCell>
                  <TableCell className="font-mono text-sm">{c.phone}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {c.tags?.map((t, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{t}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.source || '-'}</TableCell>
                  <TableCell className="text-sm">{format(new Date(c.created_at), "dd/MM/yy", { locale: ptBR })}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => deleteContact.mutate(c.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Contato</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome (opcional)</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome completo" />
            </div>
            <div>
              <Label>Telefone WhatsApp *</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(DD) 99999-9999" />
            </div>
            <div>
              <Label>Tags (separadas por vírgula)</Label>
              <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="lead, ex-aluno, parceiro" />
            </div>
            <div>
              <Label>Origem</Label>
              <Input value={source} onChange={e => setSource(e.target.value)} placeholder="Instagram, indicação..." />
            </div>
            <Button onClick={handleAdd} disabled={createContact.isPending} className="w-full">
              {createContact.isPending ? 'Salvando...' : 'Adicionar Contato'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
