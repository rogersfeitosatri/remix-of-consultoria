import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Activity, User, Heart, Flame, BookOpen, Timer, Bike, Calendar, FlaskConical, BarChart3 } from 'lucide-react';
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

export default function NutritionalPeriodization() {
  const { data: clients } = useClients();
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedConsultationId, setSelectedConsultationId] = useState<string>('');
  const { consultations, loadingConsultations, saveConsultation } = useNutritionalPeriodization(selectedClientId);

  const activeClients = (clients || []).filter((c: any) => c.is_active);
  const selectedClient = activeClients.find((c: any) => c.id === selectedClientId);
  const selectedConsultation = consultations.find((c: any) => c.id === selectedConsultationId);

  useEffect(() => {
    if (consultations.length > 0 && !selectedConsultationId) {
      setSelectedConsultationId(consultations[0].id);
    }
  }, [consultations]);

  useEffect(() => {
    setSelectedConsultationId('');
  }, [selectedClientId]);

  const handleNewConsultation = () => {
    if (!selectedClientId) return;
    const client = activeClients.find((c: any) => c.id === selectedClientId);
    saveConsultation.mutate({
      client_id: selectedClientId,
      consultation_date: new Date().toISOString().split('T')[0],
      weight: null,
      height: null,
      sport_modality: '',
      sport_goal: '',
      training_type: 'running',
    }, {
      onSuccess: (data: any) => {
        setSelectedConsultationId(data.id);
      }
    });
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

        {/* Client & Consultation Selection */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Atleta</label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger><SelectValue placeholder="Selecione um atleta" /></SelectTrigger>
                  <SelectContent>
                    {activeClients.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedClientId && (
                <>
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Consulta</label>
                    <Select value={selectedConsultationId} onValueChange={setSelectedConsultationId}>
                      <SelectTrigger><SelectValue placeholder="Selecione uma consulta" /></SelectTrigger>
                      <SelectContent>
                        {consultations.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>
                            {new Date(c.consultation_date).toLocaleDateString('pt-BR')} — {c.sport_modality || 'Sem modalidade'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleNewConsultation} size="sm" className="gap-1">
                    <Plus className="h-4 w-4" /> Nova Consulta
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {selectedClientId && selectedConsultationId && selectedConsultation && (
          <Tabs defaultValue="patient" className="w-full">
            <TabsList className="w-full flex-wrap h-auto gap-1 bg-muted/50 p-1">
              <TabsTrigger value="patient" className="gap-1 text-xs"><User className="h-3.5 w-3.5" />Dados</TabsTrigger>
              <TabsTrigger value="body" className="gap-1 text-xs"><Heart className="h-3.5 w-3.5" />Composição</TabsTrigger>
              <TabsTrigger value="tmb" className="gap-1 text-xs"><Flame className="h-3.5 w-3.5" />TMB</TabsTrigger>
              <TabsTrigger value="met" className="gap-1 text-xs"><BookOpen className="h-3.5 w-3.5" />Compêndio</TabsTrigger>
              <TabsTrigger value="running" className="gap-1 text-xs"><Timer className="h-3.5 w-3.5" />Corrida</TabsTrigger>
              <TabsTrigger value="triathlon" className="gap-1 text-xs"><Bike className="h-3.5 w-3.5" />Triatlo</TabsTrigger>
              <TabsTrigger value="periodization" className="gap-1 text-xs"><Calendar className="h-3.5 w-3.5" />Periodização</TabsTrigger>
              <TabsTrigger value="lab" className="gap-1 text-xs"><FlaskConical className="h-3.5 w-3.5" />Exames</TabsTrigger>
              <TabsTrigger value="dashboard" className="gap-1 text-xs"><BarChart3 className="h-3.5 w-3.5" />Dashboard</TabsTrigger>
            </TabsList>

            <TabsContent value="patient">
              <NPPatientDataTab
                consultation={selectedConsultation}
                client={selectedClient}
                onSave={(data: any) => saveConsultation.mutate({ ...data, id: selectedConsultationId })}
              />
            </TabsContent>
            <TabsContent value="body">
              <NPBodyCompositionTab consultationId={selectedConsultationId} clientId={selectedClientId} />
            </TabsContent>
            <TabsContent value="tmb">
              <NPTMBTab consultation={selectedConsultation} consultationId={selectedConsultationId} />
            </TabsContent>
            <TabsContent value="met">
              <NPMETCompendiumTab />
            </TabsContent>
            <TabsContent value="running">
              <NPRunningTab consultation={selectedConsultation} consultationId={selectedConsultationId} />
            </TabsContent>
            <TabsContent value="triathlon">
              <NPTriathlonTab consultation={selectedConsultation} consultationId={selectedConsultationId} />
            </TabsContent>
            <TabsContent value="periodization">
              <NPPeriodizationTab clientId={selectedClientId} />
            </TabsContent>
            <TabsContent value="lab">
              <NPLabExamsTab clientId={selectedClientId} />
            </TabsContent>
            <TabsContent value="dashboard">
              <NPDashboardTab clientId={selectedClientId} consultationId={selectedConsultationId} consultation={selectedConsultation} />
            </TabsContent>
          </Tabs>
        )}

        {!selectedClientId && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Activity className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground">Selecione um atleta</h3>
              <p className="text-sm text-muted-foreground mt-1">Escolha um atleta cadastrado para acessar a periodização nutricional</p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
