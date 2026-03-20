import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Activity, User, Calendar, Search, ChevronsUpDown, Check, ClipboardCheck, Utensils, ExternalLink, AlertTriangle, Clock } from 'lucide-react';
import { useClients } from '@/hooks/useClients';
import { useNutritionalPeriodization } from '@/hooks/useNutritionalPeriodization';
import { NPPatientDataTab } from '@/components/periodization/NPPatientDataTab';
import { NPPeriodizationTab } from '@/components/periodization/NPPeriodizationTab';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { differenceInDays, parseISO, format } from 'date-fns';

export default function NutritionalPeriodization() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const initialClient = searchParams.get('client') || '';
  const initialTab = searchParams.get('tab') || 'periodization';
  const { data: clients } = useClients();
  const [selectedClientId, setSelectedClientId] = useState<string>(initialClient);
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [comboOpen, setComboOpen] = useState(false);

  const [selectedConsultationId, setSelectedConsultationId] = useState<string>('');
  const { consultations, saveConsultation } = useNutritionalPeriodization(selectedClientId);

  const activeClients = (clients || []).filter((c: any) => c.is_active);
  const selectedClient = activeClients.find((c: any) => c.id === selectedClientId);
  const selectedConsultation = consultations.find((c: any) => c.id === selectedConsultationId);

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return activeClients;
    const q = searchQuery.toLowerCase();
    return activeClients.filter((c: any) => c.name.toLowerCase().includes(q));
  }, [activeClients, searchQuery]);

  useEffect(() => {
    if (consultations.length > 0 && !selectedConsultationId) {
      setSelectedConsultationId(consultations[0].id);
    }
  }, [consultations, selectedConsultationId]);

  const [initialLoad, setInitialLoad] = useState(true);
  useEffect(() => {
    if (initialLoad) { setInitialLoad(false); return; }
    setSelectedConsultationId('');
  }, [selectedClientId]);

  useEffect(() => {
    if (selectedClientId && consultations.length === 0 && !initialLoad) {
      const autoCreate = async () => {
        let profileData: any = {};
        try {
          const { data } = await supabase.from('athlete_profiles')
            .select('current_weight, height, target_race, target_deadline')
            .eq('client_id', selectedClientId).maybeSingle();
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
          onSuccess: (data: any) => setSelectedConsultationId(data.id),
        });
      };
      autoCreate();
    }
  }, [selectedClientId, consultations.length, initialLoad]);

  // Fetch athlete context data for sidebar
  const { data: athleteContext } = useQuery({
    queryKey: ['periodization-athlete-context', selectedClientId],
    queryFn: async () => {
      const [profileRes, checkinsRes, dietAdjRes] = await Promise.all([
        supabase.from('athlete_profiles')
          .select('target_race, target_deadline, current_weight, height, main_goal')
          .eq('client_id', selectedClientId).maybeSingle(),
        supabase.from('checkin_responses')
          .select('id, submitted_at, checkin_form_id')
          .eq('client_id', selectedClientId)
          .order('submitted_at', { ascending: false })
          .limit(3),
        supabase.from('diet_adjustment_alerts')
          .select('id, alert_type, created_at, status')
          .eq('client_id', selectedClientId)
          .order('created_at', { ascending: false })
          .limit(3),
      ]);
      return {
        profile: profileRes.data,
        recentCheckins: checkinsRes.data || [],
        dietAlerts: dietAdjRes.data || [],
      };
    },
    enabled: !!selectedClientId,
  });

  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    setComboOpen(false);
    setSearchQuery('');
  };

  return (
    <Layout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Periodização Nutricional</h1>
          <p className="text-sm text-muted-foreground">Planejamento e acompanhamento do ciclo nutricional do atleta</p>
        </div>

        {/* Athlete Selection */}
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
                        <Input placeholder="Buscar por nome..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-8 border-0 p-0 focus-visible:ring-0 shadow-none text-sm" />
                      </div>
                    </div>
                    <div className="max-h-[250px] overflow-y-auto p-1">
                      {filteredClients.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Nenhum atleta encontrado</p>
                      ) : filteredClients.map((c: any) => (
                        <button key={c.id} onClick={() => handleSelectClient(c.id)} className={cn("w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors text-left", selectedClientId === c.id && "bg-accent")}>
                          <Check className={cn("h-3.5 w-3.5 shrink-0", selectedClientId === c.id ? "opacity-100 text-primary" : "opacity-0")} />
                          <span className="truncate">{c.name}</span>
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Quick context badges when athlete selected */}
              {selectedClientId && athleteContext?.profile && (
                <div className="flex flex-wrap gap-2 items-center">
                  {athleteContext.profile.target_race && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Activity className="h-3 w-3" />
                      {athleteContext.profile.target_race}
                    </Badge>
                  )}
                  {athleteContext.profile.target_deadline && (
                    <Badge variant="outline" className={cn("text-[10px] gap-1",
                      differenceInDays(parseISO(athleteContext.profile.target_deadline), new Date()) <= 30 ? "border-destructive/50 text-destructive" : ""
                    )}>
                      <Clock className="h-3 w-3" />
                      {format(parseISO(athleteContext.profile.target_deadline), 'dd/MM/yy')}
                    </Badge>
                  )}
                  {athleteContext.recentCheckins.length > 0 && (
                    <Badge variant="outline" className="text-[10px] gap-1 cursor-pointer hover:bg-accent" onClick={() => navigate(`/checkin-hub`)}>
                      <ClipboardCheck className="h-3 w-3" />
                      {athleteContext.recentCheckins.length} check-ins
                    </Badge>
                  )}
                  {athleteContext.dietAlerts.filter((a: any) => a.status === 'pending').length > 0 && (
                    <Badge className="text-[10px] gap-1 bg-amber-500/20 text-amber-400 border-amber-500/30">
                      <AlertTriangle className="h-3 w-3" />
                      {athleteContext.dietAlerts.filter((a: any) => a.status === 'pending').length} ajuste(s)
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {selectedClientId && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
            {/* Main content */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full grid grid-cols-2 h-auto gap-1 bg-muted/50 p-1">
                <TabsTrigger value="periodization" className="gap-1.5 text-xs">
                  <Calendar className="h-3.5 w-3.5" />Periodização
                </TabsTrigger>
                <TabsTrigger value="patient" className="gap-1.5 text-xs">
                  <User className="h-3.5 w-3.5" />Dados do Atleta
                </TabsTrigger>
              </TabsList>

              <TabsContent value="periodization" className="mt-3">
                <NPPeriodizationTab clientId={selectedClientId} client={selectedClient} consultationId={selectedConsultationId} consultation={selectedConsultation} />
              </TabsContent>
              <TabsContent value="patient" className="mt-3" forceMount={activeTab === 'patient' ? true : undefined}>
                <NPPatientDataTab consultation={selectedConsultation || {}} client={selectedClient} onSave={(data: any) => {
                  if (selectedConsultationId) {
                    saveConsultation.mutate({ ...data, id: selectedConsultationId });
                  } else {
                    saveConsultation.mutate({ ...data, client_id: selectedClientId }, {
                      onSuccess: (res: any) => setSelectedConsultationId(res.id),
                    });
                  }
                }} />
              </TabsContent>
            </Tabs>

            {/* Integration sidebar */}
            <div className="space-y-3 hidden lg:block">
              {/* Quick links */}
              <Card>
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ações Rápidas</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 space-y-1.5">
                  <Button variant="ghost" size="sm" className="w-full justify-start text-xs gap-2 h-8" onClick={() => navigate(`/clients/${selectedClientId}`)}>
                    <User className="h-3.5 w-3.5" /> Perfil do Atleta
                    <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full justify-start text-xs gap-2 h-8" onClick={() => navigate(`/checkin-hub?client=${selectedClientId}`)}>
                    <ClipboardCheck className="h-3.5 w-3.5" /> Check-ins
                    <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full justify-start text-xs gap-2 h-8" onClick={() => navigate(`/athlete-history/${selectedClientId}`)}>
                    <Calendar className="h-3.5 w-3.5" /> Histórico
                    <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
                  </Button>
                </CardContent>
              </Card>

              {/* Recent checkins */}
              {athleteContext && athleteContext.recentCheckins.length > 0 && (
                <Card>
                  <CardHeader className="pb-2 pt-3 px-3">
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Últimos Check-ins</CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 space-y-1">
                    {athleteContext.recentCheckins.map((c: any) => (
                      <div key={c.id} className="flex items-center justify-between py-1 text-xs">
                        <span className="text-muted-foreground">{format(parseISO(c.submitted_at), 'dd/MM/yy')}</span>
                        <Badge variant="outline" className="text-[9px]">Respondido</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Diet adjustment alerts */}
              {athleteContext && athleteContext.dietAlerts.length > 0 && (
                <Card>
                  <CardHeader className="pb-2 pt-3 px-3">
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <Utensils className="h-3.5 w-3.5" /> Ajustes de Dieta
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 space-y-1">
                    {athleteContext.dietAlerts.map((a: any) => (
                      <div key={a.id} className="flex items-center justify-between py-1 text-xs">
                        <span className="text-muted-foreground">{format(parseISO(a.created_at), 'dd/MM/yy')}</span>
                        <Badge variant={a.status === 'pending' ? 'default' : 'outline'} className={cn("text-[9px]", a.status === 'pending' && "bg-amber-500/20 text-amber-400 border-amber-500/30")}>
                          {a.status === 'pending' ? 'Pendente' : a.status === 'done' ? 'Concluído' : a.status}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Athlete info summary */}
              {athleteContext?.profile && (
                <Card>
                  <CardHeader className="pb-2 pt-3 px-3">
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Info Rápida</CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 space-y-1.5 text-xs">
                    {athleteContext.profile.current_weight && (
                      <div className="flex justify-between"><span className="text-muted-foreground">Peso</span><span className="font-medium">{athleteContext.profile.current_weight} kg</span></div>
                    )}
                    {athleteContext.profile.height && (
                      <div className="flex justify-between"><span className="text-muted-foreground">Altura</span><span className="font-medium">{athleteContext.profile.height} cm</span></div>
                    )}
                    {athleteContext.profile.main_goal && (
                      <div className="flex justify-between"><span className="text-muted-foreground">Objetivo</span><span className="font-medium truncate max-w-[140px]">{athleteContext.profile.main_goal}</span></div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
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
