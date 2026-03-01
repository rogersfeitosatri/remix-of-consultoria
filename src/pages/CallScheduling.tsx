import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCallSchedulingLinks, useCreateCallSchedulingLink, useCallBookings } from '@/hooks/useCallScheduling';
import { useStrategicCalls } from '@/hooks/useStrategicCalls';
import { Plus, Loader2, Calendar, Link2, Copy, Settings } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

function BookingCount({ linkId }: { linkId: string }) {
  const { data: bookings } = useCallBookings(linkId);
  const active = bookings?.filter(b => b.status !== 'cancelled').length ?? 0;
  return <span>{active}</span>;
}

export default function CallScheduling() {
  const navigate = useNavigate();
  const { data: links = [], isLoading } = useCallSchedulingLinks();
  const { data: calls = [] } = useStrategicCalls();
  const createLink = useCreateCallSchedulingLink();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [selectedCallId, setSelectedCallId] = useState<string>('');

  const handleCreate = () => {
    if (!newTitle.trim() || !newSlug.trim()) return;
    createLink.mutate(
      { title: newTitle, slug: newSlug, strategic_call_id: selectedCallId || undefined },
      {
        onSuccess: (data: any) => {
          setShowCreate(false);
          setNewTitle('');
          setNewSlug('');
          setSelectedCallId('');
          navigate(`/scheduling-links/${data.id}`);
        },
      }
    );
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/agendar-call/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!', { description: url });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Agendamento</h1>
            <p className="text-muted-foreground">Gerencie links de agendamento para calls</p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Criar novo link
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : links.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum link de agendamento criado.</p>
              <Button onClick={() => setShowCreate(true)} variant="outline" className="mt-4">Criar primeiro link</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {links.map(link => (
              <Card key={link.id} className="hover:border-primary/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between py-4">
                  <div className="space-y-1 cursor-pointer flex-1" onClick={() => navigate(`/scheduling-links/${link.id}`)}>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-primary" />
                      {link.title}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">/agendar-call/{link.slug} · {link.slot_duration_minutes}min · {link.timezone}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={link.status === 'active' ? 'default' : 'secondary'}>
                      {link.status === 'active' ? 'Ativo' : 'Inativo'}
                    </Badge>
                    <div className="text-sm text-muted-foreground">
                      <BookingCount linkId={link.id} /> reservas
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => copyLink(link.slug)} title="Copiar link">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => navigate(`/scheduling-links/${link.id}`)} className="gap-1">
                      <Settings className="h-4 w-4" /> Configurar
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Link de Agendamento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Call Estratégica - Maratona" />
            </div>
            <div>
              <Label>URL pública</Label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">/agendar-call/</span>
                <Input value={newSlug} onChange={e => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} placeholder="call-maratona" />
              </div>
            </div>
            <div>
              <Label>Vincular a Call (opcional)</Label>
              <Select value={selectedCallId} onValueChange={setSelectedCallId}>
                <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {calls.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createLink.isPending || !newTitle.trim() || !newSlug.trim()}>
              {createLink.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
