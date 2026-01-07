import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole, useAthleteClient, useCheckinResponses } from '@/hooks/useUserRole';
import { useAthleteSupportMaterials, useAthleteDietAppConfig } from '@/hooks/useSupportMaterials';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PersonStanding, LogOut, ArrowLeft, Eye, Lock, ClipboardCheck, Settings, BookOpen, Utensils, TrendingUp, FileText, Youtube } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { EvolutionCharts } from '@/components/athlete/EvolutionCharts';
import { ChangePasswordForm } from '@/components/athlete/ChangePasswordForm';

// YouTube embed helper
function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    let videoId = urlObj.searchParams.get('v');
    if (!videoId && urlObj.hostname === 'youtu.be') {
      videoId = urlObj.pathname.slice(1);
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  } catch {
    return null;
  }
}

export default function AthleteDashboard() {
  const navigate = useNavigate();
  const { user, signOut, loading: authLoading } = useAuth();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const { data: client, isLoading: clientLoading } = useAthleteClient();
  const { data: checkinResponses = [], isLoading: responsesLoading } = useCheckinResponses(client?.id);
  const { data: dietConfig } = useAthleteDietAppConfig();
  const { data: onboardingMaterials = [] } = useAthleteSupportMaterials('onboarding');
  const { data: supportMaterials = [] } = useAthleteSupportMaterials('material_suporte');
  
  const [showCharts, setShowCharts] = useState(false);
  const [activeTab, setActiveTab] = useState('onboarding');

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleBackToAdmin = () => {
    navigate('/admin');
  };

  const handleFillAnamnese = () => {
    navigate('/athlete/anamnese');
  };

  // Check if anamnese is pending
  const isPendingAnamnese = client?.athlete_status === 'pending_anamnese';

  if (authLoading || clientLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[hsl(43,74%,49%)]"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const serviceTypeLabel = {
    nutrition: 'Nutrição',
    training: 'Treinamento',
    both: 'Nutrição + Treinamento',
  }[client?.service_type || 'both'];

  // Admin preview mode
  if (isAdmin && !client) {
    return (
      <div className="min-h-screen bg-black text-white">
        {/* Admin Preview Banner */}
        <div className="bg-[hsl(43,74%,49%)] text-black py-2 px-4 flex items-center justify-center gap-2">
          <Eye className="h-4 w-4" />
          <span className="text-sm font-medium">Modo Visualização - Esta é uma prévia da área do atleta</span>
          <Button 
            variant="secondary" 
            size="sm" 
            className="ml-4 h-7 bg-black text-white hover:bg-gray-800"
            onClick={handleBackToAdmin}
          >
            <ArrowLeft className="h-3 w-3 mr-1" />
            Voltar ao painel
          </Button>
        </div>
        
        {/* Header */}
        <header className="border-b border-gray-800 bg-black">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(43,74%,49%)]">
                <PersonStanding className="h-5 w-5 text-black" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-[hsl(43,74%,49%)]">RF Assessoria</h1>
                <p className="text-xs text-gray-400">Esportiva</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-white">Atleta Demo</p>
                <p className="text-xs text-gray-400">atleta@exemplo.com</p>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-1">Olá, Atleta!</h2>
            <p className="text-gray-400">Bem-vindo à sua área de membros</p>
          </div>
          
          <p className="text-gray-400 text-center py-12">Prévia do dashboard do atleta</p>
        </main>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <PersonStanding className="h-16 w-16 text-gray-400 mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Conta não vinculada</h1>
        <p className="text-gray-400 text-center mb-6">
          Seu email não está vinculado a nenhum atleta cadastrado. Entre em contato com seu assessor.
        </p>
        <Button onClick={handleSignOut} variant="outline" className="border-gray-700 text-white hover:bg-gray-800">
          Sair
        </Button>
      </div>
    );
  }

  // Show blocked content if anamnese is pending
  if (isPendingAnamnese) {
    return (
      <div className="min-h-screen bg-black text-white">
        {/* Header */}
        <header className="border-b border-gray-800 bg-black">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(43,74%,49%)]">
                <PersonStanding className="h-5 w-5 text-black" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-[hsl(43,74%,49%)]">RF Assessoria</h1>
                <p className="text-xs text-gray-400">Esportiva</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-white">{client.name}</p>
                <p className="text-xs text-gray-400">{user?.email}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-white hover:bg-gray-800">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* Blocked Content */}
        <main className="max-w-2xl mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[hsl(43,74%,49%)]/10 border-2 border-[hsl(43,74%,49%)]/30">
                  <Lock className="h-12 w-12 text-[hsl(43,74%,49%)]" />
                </div>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Área Bloqueada</h2>
            <p className="text-gray-400 max-w-md mx-auto">
              Para liberar o acesso completo à sua área de atleta e iniciar seu acompanhamento, 
              você precisa preencher a anamnese inicial obrigatória.
            </p>
          </div>

          <Alert className="mb-8 border-[hsl(43,74%,49%)]/50 bg-[hsl(43,74%,49%)]/10">
            <ClipboardCheck className="h-4 w-4 text-[hsl(43,74%,49%)]" />
            <AlertTitle className="text-[hsl(43,74%,49%)]">Anamnese Obrigatória</AlertTitle>
            <AlertDescription className="text-gray-300">
              A anamnese é fundamental para conhecermos seu perfil, histórico e objetivos. 
              Com base nas suas respostas, montaremos um plano personalizado para você.
            </AlertDescription>
          </Alert>

          <Card className="border-[hsl(43,74%,49%)]/30 bg-gray-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <ClipboardCheck className="h-5 w-5 text-[hsl(43,74%,49%)]" />
                O que você vai preencher:
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex items-center gap-2">
                  <span className="text-[hsl(43,74%,49%)]">✓</span> Dados pessoais e rotina
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[hsl(43,74%,49%)]">✓</span> Histórico de corrida e objetivos
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[hsl(43,74%,49%)]">✓</span> Peso, altura e medidas
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[hsl(43,74%,49%)]">✓</span> Sono, estresse e histórico de dietas
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[hsl(43,74%,49%)]">✓</span> Suplementação e sensibilidade intestinal
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[hsl(43,74%,49%)]">✓</span> Restrições alimentares
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[hsl(43,74%,49%)]">✓</span> Rotina alimentar detalhada por refeição
                </li>
              </ul>
              <p className="text-xs text-gray-400 mt-4">
                ⏱️ Tempo estimado: 15-20 minutos
              </p>
            </CardContent>
          </Card>

          <div className="mt-8 flex justify-center">
            <Button size="lg" onClick={handleFillAnamnese} className="gap-2 text-lg px-8 py-6 bg-[hsl(43,74%,49%)] hover:bg-[hsl(43,74%,40%)] text-black font-bold">
              <ClipboardCheck className="h-5 w-5" />
              Preencher Anamnese Inicial
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-black sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(43,74%,49%)]">
              <PersonStanding className="h-5 w-5 text-black" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[hsl(43,74%,49%)]">RF Assessoria</h1>
              <p className="text-xs text-gray-400">Esportiva</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-white">{client.name}</p>
              <p className="text-xs text-gray-400">{user.email}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-white hover:bg-gray-800">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Status Badge */}
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">Plano:</span>
            <span className="text-sm font-medium text-white">{serviceTypeLabel}</span>
          </div>
          <Badge className={`${client.is_active ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
            {client.is_active ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-1">Olá, {client.name.split(' ')[0]}!</h2>
          <p className="text-gray-400">Bem-vindo à sua área de membros</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-gray-900 border border-gray-800 p-1">
            <TabsTrigger value="onboarding" className="gap-1 data-[state=active]:bg-[hsl(43,74%,49%)] data-[state=active]:text-black text-white text-xs sm:text-sm">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Onboarding</span>
            </TabsTrigger>
            <TabsTrigger value="dieta" className="gap-1 data-[state=active]:bg-[hsl(43,74%,49%)] data-[state=active]:text-black text-white text-xs sm:text-sm">
              <Utensils className="h-4 w-4" />
              <span className="hidden sm:inline">Dieta</span>
            </TabsTrigger>
            <TabsTrigger value="evolucao" className="gap-1 data-[state=active]:bg-[hsl(43,74%,49%)] data-[state=active]:text-black text-white text-xs sm:text-sm">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Evolução</span>
            </TabsTrigger>
            <TabsTrigger value="material" className="gap-1 data-[state=active]:bg-[hsl(43,74%,49%)] data-[state=active]:text-black text-white text-xs sm:text-sm">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Material</span>
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-1 data-[state=active]:bg-[hsl(43,74%,49%)] data-[state=active]:text-black text-white text-xs sm:text-sm">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Config</span>
            </TabsTrigger>
          </TabsList>

          {/* Onboarding Tab */}
          <TabsContent value="onboarding" className="space-y-4">
            {onboardingMaterials.length === 0 ? (
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="py-12 text-center">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-600" />
                  <p className="text-gray-400">Conteúdo de onboarding em breve...</p>
                </CardContent>
              </Card>
            ) : (
              onboardingMaterials.map((material) => (
                <Card key={material.id} className="bg-gray-900 border-gray-800">
                  <CardHeader>
                    <CardTitle className="text-white">{material.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {material.content_type === 'text' ? (
                      <p className="text-gray-300 whitespace-pre-wrap">{material.content}</p>
                    ) : (
                      <div className="aspect-video rounded-lg overflow-hidden">
                        <iframe
                          src={getYouTubeEmbedUrl(material.youtube_url || '') || ''}
                          className="w-full h-full"
                          allowFullScreen
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Dieta Tab */}
          <TabsContent value="dieta" className="space-y-4">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Utensils className="h-5 w-5 text-[hsl(43,74%,49%)]" />
                  Como baixar o app
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300 whitespace-pre-wrap">
                  {dietConfig?.app_download_instructions || 'Instruções em breve...'}
                </p>
              </CardContent>
            </Card>

            {dietConfig?.app_code && (
              <Card className="bg-gray-900 border-gray-800 border-[hsl(43,74%,49%)]/30">
                <CardContent className="py-6 text-center">
                  <p className="text-sm text-gray-400 mb-2">Seu código de acesso</p>
                  <p className="text-3xl font-bold text-[hsl(43,74%,49%)] font-mono tracking-wider">
                    {dietConfig.app_code}
                  </p>
                </CardContent>
              </Card>
            )}

            {dietConfig?.support_instructions && (
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white">Suporte com o Nutri</CardTitle>
                  <CardDescription className="text-gray-400">Como usar o Daily do app</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-300 whitespace-pre-wrap">{dietConfig.support_instructions}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Evolução Tab */}
          <TabsContent value="evolucao" className="space-y-6">
            {/* Charts Section */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white">Gráficos de Evolução</CardTitle>
                    <CardDescription className="text-gray-400">Acompanhe seu progresso ao longo do tempo</CardDescription>
                  </div>
                  <Button 
                    onClick={() => setShowCharts(!showCharts)}
                    className="bg-[hsl(43,74%,49%)] hover:bg-[hsl(43,74%,40%)] text-black font-semibold"
                  >
                    {showCharts ? 'Ocultar Gráficos' : 'Gerar Gráficos'}
                  </Button>
                </div>
              </CardHeader>
              {showCharts && (
                <CardContent>
                  <EvolutionCharts checkinResponses={checkinResponses} />
                </CardContent>
              )}
            </Card>

            {/* Checkin History */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Histórico de Check-ins</CardTitle>
                <CardDescription className="text-gray-400">Seus formulários preenchidos e feedback do nutricionista</CardDescription>
              </CardHeader>
              <CardContent>
                {responsesLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[hsl(43,74%,49%)]"></div>
                  </div>
                ) : checkinResponses.length === 0 ? (
                  <div className="text-center py-8">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-600" />
                    <p className="text-gray-400">Nenhum check-in realizado ainda.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {checkinResponses.map((response: any) => (
                      <div key={response.id} className="p-4 rounded-lg bg-gray-800/50 border border-gray-700">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-white">
                            Check-in de {format(parseISO(response.submitted_at), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                            Enviado
                          </Badge>
                        </div>
                        {response.responses?.peso && (
                          <p className="text-sm text-gray-400">
                            Peso registrado: <span className="text-white font-medium">{response.responses.peso} kg</span>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

          </TabsContent>

          {/* Material Tab */}
          <TabsContent value="material" className="space-y-4">
            {supportMaterials.length === 0 ? (
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-gray-600" />
                  <p className="text-gray-400">Material de suporte em breve...</p>
                </CardContent>
              </Card>
            ) : (
              supportMaterials.map((material) => (
                <Card key={material.id} className="bg-gray-900 border-gray-800">
                  <CardHeader>
                    <CardTitle className="text-white">{material.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {material.content_type === 'text' ? (
                      <p className="text-gray-300 whitespace-pre-wrap">{material.content}</p>
                    ) : (
                      <div className="aspect-video rounded-lg overflow-hidden">
                        <iframe
                          src={getYouTubeEmbedUrl(material.youtube_url || '') || ''}
                          className="w-full h-full"
                          allowFullScreen
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Config Tab */}
          <TabsContent value="config" className="space-y-4">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Alterar Senha</CardTitle>
                <CardDescription className="text-gray-400">Crie uma nova senha para sua conta</CardDescription>
              </CardHeader>
              <CardContent>
                <ChangePasswordForm />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
