import { useState, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Network, ClipboardList, BarChart3, Search, ChevronsUpDown, Check, Trash2, Link2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { useClients } from '@/hooks/useClients';
import { useMetabolicScreening } from '@/hooks/useMetabolicScreening';
import { MetabolicQuestionnaire } from '@/components/metabolic/MetabolicQuestionnaire';
import { MetabolicWebChart } from '@/components/metabolic/MetabolicWebChart';
import { MetabolicEvolutionChart } from '@/components/metabolic/MetabolicEvolutionChart';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function MetabolicWeb() {
  const { data: clients } = useClients();
  const [selectedClientId, setSelectedClientId] = useState('');
  const [activeTab, setActiveTab] = useState('questionnaire');
  const [searchQuery, setSearchQuery] = useState('');
  const [comboOpen, setComboOpen] = useState(false);
  const [selectedScreeningId, setSelectedScreeningId] = useState<string | null>(null);

  const activeClients = (clients || []).filter((c: any) => c.is_active);
  const selectedClient = activeClients.find((c: any) => c.id === selectedClientId);

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return activeClients;
    const q = searchQuery.toLowerCase();
    return activeClients.filter((c: any) => c.name.toLowerCase().includes(q));
  }, [activeClients, searchQuery]);

  const { screenings, isLoading, saveScreening, deleteScreening, analyzeScreening } = useMetabolicScreening(selectedClientId);

  const selectedScreening = screenings.find((s: any) => s.id === selectedScreeningId) || screenings[0];

  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    setComboOpen(false);
    setSearchQuery('');
    setSelectedScreeningId(null);
  };

  const handleSubmitQuestionnaire = (responses: Record<string, number>, notes: string) => {
    saveScreening.mutate({
      client_id: selectedClientId,
      screening_date: new Date().toISOString().split('T')[0],
      responses,
      notes,
    }, {
      onSuccess: (data: any) => {
        setSelectedScreeningId(data.id);
        setActiveTab('web');
      }
    });
  };

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Interconexão Metabólica</h1>
            <p className="text-sm text-muted-foreground">Rastreamento metabólico e teia de interconexões para atletas</p>
          </div>
          {selectedClientId && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                const url = `${window.location.origin}/metabolic-screening?client=${selectedClientId}`;
                navigator.clipboard.writeText(url);
                toast.success('Link copiado! Envie ao atleta pelo WhatsApp.');
              }}
            >
              <Link2 className="h-3.5 w-3.5" />
              Copiar Link
            </Button>
          )}
        </div>

        {/* Athlete selector */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 min-w-[250px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Atleta</label>
                <Popover open={comboOpen} onOpenChange={setComboOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between h-9 text-sm font-normal">
                      {selectedClient ? selectedClient.name : 'Pesquisar atleta...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <div className="p-2 border-b border-border">
                      <div className="flex items-center gap-2 px-2">
                        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Input
                          placeholder="Buscar por nome..."
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          className="h-8 border-0 p-0 focus-visible:ring-0 shadow-none text-sm"
                        />
                      </div>
                    </div>
                    <div className="max-h-[250px] overflow-y-auto p-1">
                      {filteredClients.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Nenhum atleta encontrado</p>
                      ) : filteredClients.map((c: any) => (
                        <button
                          key={c.id}
                          onClick={() => handleSelectClient(c.id)}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors text-left",
                            selectedClientId === c.id && "bg-accent"
                          )}
                        >
                          <Check className={cn("h-3.5 w-3.5 shrink-0", selectedClientId === c.id ? "opacity-100 text-primary" : "opacity-0")} />
                          <span className="truncate">{c.name}</span>
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* History selector */}
              {screenings.length > 0 && (
                <div className="min-w-[200px]">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Histórico</label>
                  <div className="flex gap-1 flex-wrap">
                    {screenings.slice(0, 6).map((s: any) => (
                      <button
                        key={s.id}
                        onClick={() => { setSelectedScreeningId(s.id); setActiveTab('web'); }}
                        className={cn(
                          'px-2 py-1 rounded text-xs border transition-all',
                          selectedScreening?.id === s.id
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card text-muted-foreground border-border hover:bg-accent/30'
                        )}
                      >
                        {format(new Date(s.screening_date + 'T12:00:00'), 'dd/MM/yy', { locale: ptBR })}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {selectedClientId ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full flex-wrap h-auto gap-1 bg-muted/50 p-1">
              <TabsTrigger value="questionnaire" className="gap-1 text-xs"><ClipboardList className="h-3.5 w-3.5" />Questionário</TabsTrigger>
              <TabsTrigger value="web" className="gap-1 text-xs" disabled={!selectedScreening}><Network className="h-3.5 w-3.5" />Teia</TabsTrigger>
              <TabsTrigger value="evolution" className="gap-1 text-xs" disabled={screenings.length < 2}><BarChart3 className="h-3.5 w-3.5" />Evolução</TabsTrigger>
            </TabsList>

            <TabsContent value="questionnaire">
              <MetabolicQuestionnaire onSubmit={handleSubmitQuestionnaire} isSubmitting={saveScreening.isPending} />
            </TabsContent>

            <TabsContent value="web">
              {selectedScreening ? (
                <div className="space-y-2">
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive gap-1 text-xs"
                      onClick={() => {
                        if (confirm('Excluir este rastreamento?')) {
                          deleteScreening.mutate(selectedScreening.id, {
                            onSuccess: () => setSelectedScreeningId(null),
                          });
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Excluir
                    </Button>
                  </div>
                  <MetabolicWebChart 
                    screening={selectedScreening} 
                    onReanalyze={() => analyzeScreening.mutate(selectedScreening.id)}
                    isAnalyzing={analyzeScreening.isPending}
                  />
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-sm text-muted-foreground">Nenhum rastreamento encontrado. Preencha o questionário primeiro.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="evolution">
              <MetabolicEvolutionChart screenings={screenings} />
            </TabsContent>
          </Tabs>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Network className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground">Selecione um atleta</h3>
              <p className="text-sm text-muted-foreground mt-1">Pesquise e selecione um atleta para acessar o rastreamento metabólico</p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
