import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Activity, User, Heart, Flame, BookOpen, Timer, Bike, Calendar, FlaskConical, BarChart3, Search, ChevronsUpDown, Check } from 'lucide-react';
import { useClients } from '@/hooks/useClients';
import { useNutritionalPeriodization } from '@/hooks/useNutritionalPeriodization';
import { NPPatientDataTab } from '@/components/periodization/NPPatientDataTab';
import { NPBodyCompositionTab } from '@/components/periodization/NPBodyCompositionTab';
import { NPTMBTab } from '@/components/periodization/NPTMBTab';
import { NPMETCompendiumTab } from '@/components/periodization/NPMETCompendiumTab';
import { NPRunningTab } from '@/components/periodization/NPRunningTab';
import { NPTriathlonTab } from '@/components/periodization/NPTriathlonTab';
import { NPPeriodizationTab } from '@/components/periodization/NPPeriodizationTab';
import { NPLabExamsTab } from '@/components/periodization/NPLabExamsTab';
import { NPDashboardTab } from '@/components/periodization/NPDashboardTab';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export default function NutritionalPeriodization() {
  const [searchParams] = useSearchParams();
  const initialClient = searchParams.get('client') || '';
  const initialTab = searchParams.get('tab') || 'periodization';
  const { data: clients } = useClients();
  const [selectedClientId, setSelectedClientId] = useState<string>(initialClient);
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [comboOpen, setComboOpen] = useState(false);

  // Keep consultation logic in background for tabs that need it
  const [selectedConsultationId, setSelectedConsultationId] = useState<string>('');
  const { consultations, saveConsultation } = useNutritionalPeriodization(selectedClientId);

  const activeClients = (clients || []).filter((c: any) => c.is_active);
  const selectedClient = activeClients.find((c: any) => c.id === selectedClientId);
  const selectedConsultation = consultations.find((c: any) => c.id === selectedConsultationId);

  // Filter clients by search
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return activeClients;
    const q = searchQuery.toLowerCase();
    return activeClients.filter((c: any) => c.name.toLowerCase().includes(q));
  }, [activeClients, searchQuery]);

  // Auto-select latest consultation silently
  useEffect(() => {
    if (consultations.length > 0 && !selectedConsultationId) {
      setSelectedConsultationId(consultations[0].id);
    }
  }, [consultations, selectedConsultationId]);

  // Reset consultation when client changes
  const [initialLoad, setInitialLoad] = useState(true);
  useEffect(() => {
    if (initialLoad) {
      setInitialLoad(false);
      return;
    }
    setSelectedConsultationId('');
  }, [selectedClientId]);

  // Auto-create consultation if none exists for this athlete (needed for other tabs)
  useEffect(() => {
    if (selectedClientId && consultations.length === 0 && !initialLoad) {
      const autoCreate = async () => {
        let profileData: any = {};
        try {
          const { data } = await supabase
            .from('athlete_profiles')
            .select('current_weight, height, target_race, target_deadline')
            .eq('client_id', selectedClientId)
            .maybeSingle();
          if (data) profileData = data;
        } catch (_) {}

        saveConsultation.mutate({
          client_id: selectedClientId,
          consultation_date: new Date().toISOString().split('T')[0],
          weight: profileData.current_weight || null,
          height: profileData.height || null,
          sport_modality: '',
          sport_goal: profileData.target_race || '',
          target_race_date: profileData.target_deadline || null,
          training_type: 'running',
        }, {
          onSuccess: (data: any) => {
            setSelectedConsultationId(data.id);
          }
        });
      };
      autoCreate();
    }
  }, [selectedClientId, consultations.length, initialLoad]);

  const handleSaveConsultation = (data: any) => {
    saveConsultation.mutate(data);
  };

  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    setComboOpen(false);
    setSearchQuery('');
  };

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Periodização Nutricional</h1>
            <p className="text-sm text-muted-foreground">Planejamento nutricional e de treino para atletas de endurance</p>
          </div>
        </div>

        {/* Athlete Selection with Search */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 min-w-[250px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Atleta</label>
                <Popover open={comboOpen} onOpenChange={setComboOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={comboOpen}
                      className="w-full justify-between h-9 text-sm font-normal"
                    >
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
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="h-8 border-0 p-0 focus-visible:ring-0 shadow-none text-sm"
                        />
                      </div>
                    </div>
                    <div className="max-h-[250px] overflow-y-auto p-1">
                      {filteredClients.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Nenhum atleta encontrado</p>
                      ) : (
                        filteredClients.map((c: any) => (
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
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>

        {selectedClientId && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full flex-wrap h-auto gap-1 bg-muted/50 p-1">
              <TabsTrigger value="periodization" className="gap-1 text-xs"><Calendar className="h-3.5 w-3.5" />Periodização</TabsTrigger>
              <TabsTrigger value="patient" className="gap-1 text-xs"><User className="h-3.5 w-3.5" />Dados</TabsTrigger>
              <TabsTrigger value="body" className="gap-1 text-xs"><Heart className="h-3.5 w-3.5" />Composição</TabsTrigger>
              <TabsTrigger value="tmb" className="gap-1 text-xs"><Flame className="h-3.5 w-3.5" />TMB</TabsTrigger>
              <TabsTrigger value="running" className="gap-1 text-xs"><Timer className="h-3.5 w-3.5" />Corrida</TabsTrigger>
              <TabsTrigger value="triathlon" className="gap-1 text-xs"><Bike className="h-3.5 w-3.5" />Triatlo</TabsTrigger>
              <TabsTrigger value="lab" className="gap-1 text-xs"><FlaskConical className="h-3.5 w-3.5" />Exames</TabsTrigger>
              <TabsTrigger value="dashboard" className="gap-1 text-xs"><BarChart3 className="h-3.5 w-3.5" />Dashboard</TabsTrigger>
              <TabsTrigger value="met" className="gap-1 text-xs"><BookOpen className="h-3.5 w-3.5" />Compêndio</TabsTrigger>
            </TabsList>

            <TabsContent value="periodization">
              <NPPeriodizationTab clientId={selectedClientId} client={selectedClient} consultationId={selectedConsultationId} consultation={selectedConsultation} />
            </TabsContent>
            {selectedConsultation && (
              <>
                <TabsContent value="patient">
                  <NPPatientDataTab
                    consultation={selectedConsultation}
                    client={selectedClient}
                    onSave={(data: any) => saveConsultation.mutate({ ...data, id: selectedConsultationId })}
                  />
                </TabsContent>
                <TabsContent value="body">
                  <NPBodyCompositionTab
                    consultationId={selectedConsultationId}
                    clientId={selectedClientId}
                    consultation={selectedConsultation}
                    onSaveConsultation={handleSaveConsultation}
                  />
                </TabsContent>
                <TabsContent value="tmb">
                  <NPTMBTab consultation={selectedConsultation} consultationId={selectedConsultationId} />
                </TabsContent>
                <TabsContent value="running">
                  <NPRunningTab consultation={selectedConsultation} consultationId={selectedConsultationId} />
                </TabsContent>
                <TabsContent value="triathlon">
                  <NPTriathlonTab consultation={selectedConsultation} consultationId={selectedConsultationId} />
                </TabsContent>
              </>
            )}
            <TabsContent value="lab">
              <NPLabExamsTab clientId={selectedClientId} />
            </TabsContent>
            {selectedConsultation && (
              <TabsContent value="dashboard">
                <NPDashboardTab
                  clientId={selectedClientId}
                  consultationId={selectedConsultationId}
                  consultation={selectedConsultation}
                  onSaveConsultation={handleSaveConsultation}
                />
              </TabsContent>
            )}
            <TabsContent value="met">
              <NPMETCompendiumTab />
            </TabsContent>
          </Tabs>
        )}

        {!selectedClientId && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Activity className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground">Selecione um atleta</h3>
              <p className="text-sm text-muted-foreground mt-1">Pesquise e selecione um atleta para acessar sua periodização</p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
