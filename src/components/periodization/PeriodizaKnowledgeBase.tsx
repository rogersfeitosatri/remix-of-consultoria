import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, BookOpen, Trash2, Edit, Search, Loader2, Save, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

const TAG_OPTIONS = ['train-low', 'carb-loading', 'taper', 'gut-training', 'EA/RED-S', 'cafeína', 'hidratação', 'sódio', 'proteína', 'recuperação', 'maratona', 'meia', 'triathlon', 'ultra', 'ciclismo'];
const SOURCE_TYPES = ['paper', 'guideline', 'nota do admin', 'livro', 'podcast', 'experiência clínica'];
const COLLECTIONS = ['Maratona', 'Meia Maratona', 'Triathlon LD', 'Triathlon Sprint', 'Ultra', 'Ciclismo', 'Geral'];

interface KBEntry {
  id?: string;
  title: string;
  tags: string[];
  content: string;
  source_type: string;
  source_reference: string;
  priority: number;
  collection: string;
  active: boolean;
}

const emptyEntry: KBEntry = {
  title: '', tags: [], content: '', source_type: 'nota do admin',
  source_reference: '', priority: 3, collection: 'Geral', active: true,
};

export function PeriodizaKnowledgeBase() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterCollection, setFilterCollection] = useState('');
  const [editing, setEditing] = useState<KBEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['periodiza-kb', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('periodiza_knowledge_base')
        .select('*')
        .eq('user_id', user!.id)
        .order('priority', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async (entry: KBEntry) => {
      if (entry.id) {
        const { error } = await supabase
          .from('periodiza_knowledge_base')
          .update({ ...entry, updated_at: new Date().toISOString() })
          .eq('id', entry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('periodiza_knowledge_base')
          .insert({ ...entry, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['periodiza-kb'] });
      setDialogOpen(false);
      setEditing(null);
      toast({ title: 'Conteúdo salvo' });
    },
    onError: (err: any) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('periodiza_knowledge_base').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['periodiza-kb'] });
      toast({ title: 'Conteúdo excluído' });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from('periodiza_knowledge_base')
        .update({ active, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['periodiza-kb'] }),
  });

  const filtered = entries.filter((e: any) => {
    if (search && !e.title.toLowerCase().includes(search.toLowerCase()) && !e.content.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterTag && !(e.tags || []).includes(filterTag)) return false;
    if (filterCollection && e.collection !== filterCollection) return false;
    return true;
  });

  const openEdit = (entry?: any) => {
    setEditing(entry ? { ...entry } : { ...emptyEntry });
    setDialogOpen(true);
  };

  const toggleTag = (tag: string) => {
    if (!editing) return;
    const tags = editing.tags || [];
    setEditing({
      ...editing,
      tags: tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag],
    });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Base de Conhecimento
            <Badge variant="outline" className="text-[10px]">{entries.length} itens</Badge>
          </CardTitle>
          <Button size="sm" onClick={() => openEdit()} className="gap-1 text-xs h-7">
            <Plus className="h-3 w-3" /> Adicionar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[150px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="h-7 text-xs pl-7" />
          </div>
          <Select value={filterTag} onValueChange={v => setFilterTag(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-7 text-xs w-36"><SelectValue placeholder="Tag" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas tags</SelectItem>
              {TAG_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterCollection} onValueChange={v => setFilterCollection(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-7 text-xs w-36"><SelectValue placeholder="Coleção" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {COLLECTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Entries list */}
        <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
          {filtered.map((entry: any) => (
            <div key={entry.id} className={`flex items-center gap-2 p-2 rounded-lg border ${entry.active ? 'border-border bg-muted/20' : 'border-border/50 bg-muted/5 opacity-60'}`}>
              <Switch checked={entry.active} onCheckedChange={(v) => toggleActive.mutate({ id: entry.id, active: v })} className="scale-75" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium truncate">{entry.title}</p>
                  <Badge variant="outline" className="text-[9px] shrink-0">P{entry.priority}</Badge>
                  {entry.collection && <Badge variant="outline" className="text-[9px] shrink-0">{entry.collection}</Badge>}
                </div>
                <div className="flex gap-1 mt-0.5 flex-wrap">
                  {(entry.tags || []).slice(0, 4).map((t: string) => (
                    <Badge key={t} className="text-[8px] h-4 bg-primary/10 text-primary border-primary/20">{t}</Badge>
                  ))}
                  <span className="text-[10px] text-muted-foreground">{entry.source_type}</span>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => openEdit(entry)} className="h-6 w-6 p-0">
                <Edit className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(entry.id)} className="h-6 w-6 p-0 text-destructive">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhum conteúdo encontrado.</p>
          )}
        </div>

        {/* Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-sm">{editing?.id ? 'Editar Conteúdo' : 'Novo Conteúdo'}</DialogTitle>
            </DialogHeader>
            {editing && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Título</label>
                  <Input value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} className="h-8 text-xs" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Conteúdo</label>
                  <Textarea value={editing.content} onChange={e => setEditing({ ...editing, content: e.target.value })} rows={6} className="text-xs" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Tipo de Fonte</label>
                    <Select value={editing.source_type} onValueChange={v => setEditing({ ...editing, source_type: v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SOURCE_TYPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Referência (link)</label>
                    <Input value={editing.source_reference} onChange={e => setEditing({ ...editing, source_reference: e.target.value })} className="h-8 text-xs" placeholder="https://..." />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Prioridade (1-5)</label>
                    <Input type="number" min={1} max={5} value={editing.priority} onChange={e => setEditing({ ...editing, priority: Number(e.target.value) })} className="h-8 text-xs" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Coleção</label>
                    <Select value={editing.collection} onValueChange={v => setEditing({ ...editing, collection: v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COLLECTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Tags</label>
                  <div className="flex flex-wrap gap-1">
                    {TAG_OPTIONS.map(tag => (
                      <Badge
                        key={tag}
                        variant={(editing.tags || []).includes(tag) ? 'default' : 'outline'}
                        className="text-[10px] cursor-pointer"
                        onClick={() => toggleTag(tag)}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button size="sm" onClick={() => saveMutation.mutate(editing)} disabled={saveMutation.isPending || !editing.title || !editing.content} className="gap-1 w-full">
                  {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Salvar
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
