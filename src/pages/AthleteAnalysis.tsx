import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, Brain, Flame, Scale, Utensils, AlertTriangle, RefreshCw, User, Target, Activity } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Json } from '@/integrations/supabase/types';

interface EnergyExpenditure {
  bmr: number;
  tdee: number;
  training_expenditure: number;
  formula_used: string;
}

interface CaloricDeficit {
  recommended_deficit: number;
  target_calories: number;
  deficit_percentage: number;
  timeline_weeks: number;
}

interface Macronutrients {
  protein_g_kg: number;
  carbs_g_kg: number;
  fat_g_kg: number;
  protein_total: number;
  carbs_total: number;
  fat_total: number;
}

interface AIAnalysis {
  id: string;
  client_id: string;
  athlete_profile_id: string | null;
  diagnosis: string;
  energy_expenditure: EnergyExpenditure;
  caloric_deficit: CaloricDeficit;
  macronutrients: Macronutrients;
  alerts: string[];
  model_used: string;
  created_at: string;
  updated_at: string;
}

interface AthleteProfile {
  id: string;
  client_id: string;
  full_name: string | null;
  gender: string | null;
  birth_date: string | null;
  current_weight: number | null;
  height: number | null;
  ideal_weight: number | null;
  main_goal: string | null;
  secondary_goal: string | null;
  practices_running: string | null;
  weekly_frequency: string | null;
  weekly_volume_km: number | null;
  anamnese_submitted_at: string | null;
}

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  athlete_status: string | null;
}

// Helper function to safely parse JSON fields
function parseJsonField<T>(field: Json | null | undefined, defaultValue: T): T {
  if (!field) return defaultValue;
  if (typeof field === 'object' && field !== null) {
    return field as unknown as T;
  }
  return defaultValue;
}

export default function AthleteAnalysis() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch client data
  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();
      if (error) throw error;
      return data as Client;
    },
    enabled: !!clientId,
  });

  // Fetch athlete profile
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['athlete_profile', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('athlete_profiles')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle();
      if (error) throw error;
      return data as AthleteProfile | null;
    },
    enabled: !!clientId,
  });

  // Fetch AI analysis
  const { data: analysis, isLoading: analysisLoading, refetch: refetchAnalysis } = useQuery({
    queryKey: ['ai_analysis', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_analyses')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      
      // Parse JSON fields
      return {
        ...data,
        energy_expenditure: parseJsonField<EnergyExpenditure>(data.energy_expenditure, { bmr: 0, tdee: 0, training_expenditure: 0, formula_used: '' }),
        caloric_deficit: parseJsonField<CaloricDeficit>(data.caloric_deficit, { recommended_deficit: 0, target_calories: 0, deficit_percentage: 0, timeline_weeks: 0 }),
        macronutrients: parseJsonField<Macronutrients>(data.macronutrients, { protein_g_kg: 0, carbs_g_kg: 0, fat_g_kg: 0, protein_total: 0, carbs_total: 0, fat_total: 0 }),
      } as AIAnalysis;
    },
    enabled: !!clientId,
  });

  // Mutation to trigger AI analysis
  const analyzeAthleteMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('analyze-athlete', {
        body: { clientId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Análise concluída!',
        description: 'A análise por IA foi gerada com sucesso.',
      });
      queryClient.invalidateQueries({ queryKey: ['ai_analysis', clientId] });
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      refetchAnalysis();
    },
    onError: (error: any) => {
      toast({
        title: 'Erro na análise',
        description: error.message || 'Ocorreu um erro ao gerar a análise.',
        variant: 'destructive',
      });
    },
  });

  const isLoading = clientLoading || profileLoading || analysisLoading;

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!client) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Cliente não encontrado.</p>
          <Button onClick={() => navigate('/clients')} className="mt-4">
            Voltar para Clientes
          </Button>
        </div>
      </Layout>
    );
  }

  const hasAnamnese = profile?.anamnese_submitted_at;
  const canAnalyze = hasAnamnese && client.athlete_status === 'ready_for_ai_analysis';

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/clients')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{client.name}</h1>
              <p className="text-muted-foreground">Análise por IA</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={analysis ? 'default' : 'secondary'}>
              {analysis ? 'Análise disponível' : 'Sem análise'}
            </Badge>
            {(canAnalyze || analysis) && (
              <Button
                onClick={() => analyzeAthleteMutation.mutate()}
                disabled={analyzeAthleteMutation.isPending}
              >
                {analyzeAthleteMutation.isPending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Analisando...
                  </>
                ) : (
                  <>
                    <Brain className="mr-2 h-4 w-4" />
                    {analysis ? 'Reanalisar' : 'Gerar Análise IA'}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {!hasAnamnese && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Anamnese pendente</AlertTitle>
            <AlertDescription>
              O atleta ainda não preencheu a anamnese. A análise por IA só pode ser gerada após o preenchimento.
            </AlertDescription>
          </Alert>
        )}

        {/* Profile Summary */}
        {profile && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Resumo do Atleta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <p className="text-sm text-muted-foreground">Peso Atual</p>
                  <p className="text-lg font-semibold">{profile.current_weight || '-'} kg</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Altura</p>
                  <p className="text-lg font-semibold">{profile.height || '-'} cm</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Objetivo Principal</p>
                  <p className="text-lg font-semibold">{profile.main_goal || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Volume Semanal</p>
                  <p className="text-lg font-semibold">{profile.weekly_volume_km || '-'} km</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Analysis Results */}
        {analysis ? (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Diagnosis */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Diagnóstico
                </CardTitle>
                <CardDescription>
                  Análise da situação atual do atleta
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{analysis.diagnosis}</p>
              </CardContent>
            </Card>

            {/* Energy Expenditure */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flame className="h-5 w-5 text-orange-500" />
                  Gasto Energético
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">TMB (Basal)</p>
                    <p className="text-2xl font-bold">{analysis.energy_expenditure.bmr?.toLocaleString() || '-'}</p>
                    <p className="text-xs text-muted-foreground">kcal/dia</p>
                  </div>
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">GET (Total)</p>
                    <p className="text-2xl font-bold">{analysis.energy_expenditure.tdee?.toLocaleString() || '-'}</p>
                    <p className="text-xs text-muted-foreground">kcal/dia</p>
                  </div>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">Gasto com Treinos</p>
                  <p className="text-xl font-bold">{analysis.energy_expenditure.training_expenditure?.toLocaleString() || '-'} kcal/sessão</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Fórmula: {analysis.energy_expenditure.formula_used || 'N/I'}
                </p>
              </CardContent>
            </Card>

            {/* Caloric Deficit */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-5 w-5 text-blue-500" />
                  Déficit Calórico
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Déficit Recomendado</p>
                    <p className="text-2xl font-bold">{analysis.caloric_deficit.recommended_deficit || '-'}</p>
                    <p className="text-xs text-muted-foreground">kcal/dia</p>
                  </div>
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Calorias Alvo</p>
                    <p className="text-2xl font-bold">{analysis.caloric_deficit.target_calories?.toLocaleString() || '-'}</p>
                    <p className="text-xs text-muted-foreground">kcal/dia</p>
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Déficit: {analysis.caloric_deficit.deficit_percentage || '-'}%</span>
                  <span>Prazo: {analysis.caloric_deficit.timeline_weeks || '-'} semanas</span>
                </div>
              </CardContent>
            </Card>

            {/* Macronutrients */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Utensils className="h-5 w-5 text-green-500" />
                  Macronutrientes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                    <div>
                      <p className="font-medium">Proteína</p>
                      <p className="text-sm text-muted-foreground">{analysis.macronutrients.protein_g_kg} g/kg</p>
                    </div>
                    <p className="text-xl font-bold">{analysis.macronutrients.protein_total}g</p>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                    <div>
                      <p className="font-medium">Carboidratos</p>
                      <p className="text-sm text-muted-foreground">{analysis.macronutrients.carbs_g_kg} g/kg</p>
                    </div>
                    <p className="text-xl font-bold">{analysis.macronutrients.carbs_total}g</p>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <div>
                      <p className="font-medium">Gorduras</p>
                      <p className="text-sm text-muted-foreground">{analysis.macronutrients.fat_g_kg} g/kg</p>
                    </div>
                    <p className="text-xl font-bold">{analysis.macronutrients.fat_total}g</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Alerts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Alertas e Recomendações
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analysis.alerts && analysis.alerts.length > 0 ? (
                  <ul className="space-y-2">
                    {analysis.alerts.map((alert, index) => (
                      <li key={index} className="flex items-start gap-2 p-2 bg-muted rounded-lg">
                        <Activity className="h-4 w-4 mt-0.5 text-yellow-500 flex-shrink-0" />
                        <span className="text-sm">{alert}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-sm">Nenhum alerta específico.</p>
                )}
              </CardContent>
            </Card>
          </div>
        ) : hasAnamnese ? (
          <Card className="text-center py-12">
            <CardContent>
              <Brain className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Análise por IA não gerada</h3>
              <p className="text-muted-foreground mb-4">
                Clique no botão acima para gerar a análise com ChatGPT.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {/* Metadata */}
        {analysis && (
          <p className="text-xs text-muted-foreground text-right">
            Modelo: {analysis.model_used} | Última atualização: {new Date(analysis.updated_at).toLocaleString('pt-BR')}
          </p>
        )}
      </div>
    </Layout>
  );
}
