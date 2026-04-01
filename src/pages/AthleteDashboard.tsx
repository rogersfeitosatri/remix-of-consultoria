import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole, useAthleteClient, useCheckinResponses, useCheckinQuestions, useAthleteProfile } from '@/hooks/useUserRole';
import { useAthleteSupportMaterials, useAthleteDietAppConfig } from '@/hooks/useSupportMaterials';
import { useIsClientContinuation } from '@/hooks/useAthleteFirstConsult';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Home, LogOut, ArrowLeft, Eye, ClipboardCheck, Utensils, FileText, User } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckinEvolutionCharts } from '@/components/checkin/CheckinEvolutionCharts';
import { AthleteSidebar } from '@/components/athlete/AthleteSidebar';
import { FirstConsultCard } from '@/components/athlete/FirstConsultCard';
import { NextConsultCard } from '@/components/athlete/NextConsultCard';
import { NextConsultBanner } from '@/components/athlete/NextConsultBanner';
import { NextConsultInfo } from '@/components/athlete/NextConsultInfo';
import { MaterialPost } from '@/components/athlete/MaterialPost';
import { AthleteProfileSection } from '@/components/athlete/AthleteProfileSection';
import { AnamnesePendingBanner } from '@/components/athlete/AnamnesePendingBanner';
import { LinkifiedText } from '@/lib/linkify';
import rogersProfile from '@/assets/rogers-profile.jpg';

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
  const { data: continuationStatus } = useIsClientContinuation(client?.id);
  const { data: athleteProfile } = useAthleteProfile(client?.id);
  const { data: checkinResponses = [], isLoading: responsesLoading } = useCheckinResponses(client?.id);
  const firstFormId = checkinResponses[0]?.form_id;
  const { data: checkinQuestions = [] } = useCheckinQuestions(firstFormId);
  const { data: dietConfig } = useAthleteDietAppConfig();
  const { data: inicioMaterials = [] } = useAthleteSupportMaterials('inicio');
  const { data: onboardingMaterials = [] } = useAthleteSupportMaterials('onboarding');
  const { data: supportMaterials = [] } = useAthleteSupportMaterials('materiais');
  const { data: materialSuporte = [] } = useAthleteSupportMaterials('material_suporte');
  
  // Combine old and new category names for backwards compatibility
  const allInicioMaterials = [...inicioMaterials, ...onboardingMaterials];
  const allSupportMaterials = [...supportMaterials, ...materialSuporte];
  
  const [activeTab, setActiveTab] = useState('inicio');
  
  // Check if anamnese is completed
  const anamneseCompleted = athleteProfile?.anamnese_completed === true || athleteProfile?.anamnese_submitted_at != null;

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      // Clear all local storage to ensure clean session
      localStorage.clear();
      sessionStorage.clear();
      // Always navigate to auth, even if signOut fails
      navigate('/auth', { replace: true });
    }
  };
  const handleBackToAdmin = () => { navigate('/admin'); };
  const handleFillAnamnese = () => { navigate('/athlete/anamnese'); };
  const handleContactSupport = () => { window.open('https://wa.me/5511999999999?text=Olá! Preciso de ajuda com a área do atleta.', '_blank'); };

  if (authLoading || clientLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[hsl(43,74%,49%)]"></div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  const serviceTypeLabel = { nutrition: 'Nutrição', training: 'Treinamento', both: 'Nutrição + Treinamento' }[client?.service_type || 'both'];

  // Admin preview mode - show the same content as athletes
  if (isAdmin && !client) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="bg-[hsl(43,74%,49%)] text-primary-foreground py-2 px-4 flex items-center justify-center gap-2">
          <Eye className="h-4 w-4" />
          <span className="text-sm font-medium">Modo Visualização</span>
          <Button variant="secondary" size="sm" className="ml-4 h-7 bg-black text-white hover:bg-gray-800" onClick={handleBackToAdmin}>
            <ArrowLeft className="h-3 w-3 mr-1" />Voltar
          </Button>
        </div>
        <header className="border-b border-gray-800 bg-black">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full overflow-hidden border border-[hsl(43,74%,49%)]">
                <img src={rogersProfile} alt="Rogers Feitosa" className="w-full h-[200%] object-cover object-[center_15%]" />
              </div>
              <div className="flex items-center gap-2">
                <div>
                  <h1 className="text-lg font-bold text-[hsl(43,74%,49%)]">ROGERS FEITOSA</h1>
                  <p className="text-xs text-gray-400">Nutrição e Treinamento</p>
                </div>
                <Badge 
                  variant="outline" 
                  className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50 text-[10px] font-bold px-1.5 py-0"
                >
                  BETA
                </Badge>
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-6">
          <div className="mb-6"><h2 className="text-2xl font-bold text-white mb-1">Prévia da Área do Atleta</h2><p className="text-gray-400">Visualize como o atleta verá o conteúdo configurado</p></div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-5 bg-gray-900 border border-gray-800 p-1">
              <TabsTrigger value="inicio" className="gap-1 data-[state=active]:bg-[hsl(43,74%,49%)] data-[state=active]:text-primary-foreground text-white text-xs"><Home className="h-4 w-4" /><span className="hidden lg:inline">Início</span></TabsTrigger>
              <TabsTrigger value="dieta" className="gap-1 data-[state=active]:bg-[hsl(43,74%,49%)] data-[state=active]:text-primary-foreground text-white text-xs"><Utensils className="h-4 w-4" /><span className="hidden lg:inline">Dieta</span></TabsTrigger>
              <TabsTrigger value="historico" className="gap-1 data-[state=active]:bg-[hsl(43,74%,49%)] data-[state=active]:text-primary-foreground text-white text-xs"><ClipboardCheck className="h-4 w-4" /><span className="hidden lg:inline">Histórico</span></TabsTrigger>
              <TabsTrigger value="materiais" className="gap-1 data-[state=active]:bg-[hsl(43,74%,49%)] data-[state=active]:text-primary-foreground text-white text-xs"><FileText className="h-4 w-4" /><span className="hidden lg:inline">Materiais</span></TabsTrigger>
              <TabsTrigger value="perfil" className="gap-1 data-[state=active]:bg-[hsl(43,74%,49%)] data-[state=active]:text-primary-foreground text-white text-xs"><User className="h-4 w-4" /><span className="hidden lg:inline">Perfil</span></TabsTrigger>
            </TabsList>

            <TabsContent value="inicio">
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader><CardTitle className="text-white">Bem-vindo ao seu painel</CardTitle></CardHeader>
                <CardContent>
                  {allInicioMaterials.length === 0 ? <p className="text-gray-400 text-center py-8">Nenhum conteúdo de boas-vindas configurado. Configure na aba "Conteúdo" → "Início".</p> : (
                    <div className="space-y-4">{allInicioMaterials.map((m) => (
                      <div key={m.id} className="p-4 rounded-lg bg-gray-800/50 border border-gray-700">
                        <h4 className="font-medium text-white mb-2">{m.title}</h4>
                        {m.content_type === 'text' ? <div className="text-gray-300 text-sm whitespace-pre-wrap"><LinkifiedText text={m.content || ''} /></div> : <div className="aspect-video rounded-lg overflow-hidden"><iframe src={getYouTubeEmbedUrl(m.youtube_url || '') || ''} className="w-full h-full" allowFullScreen /></div>}
                      </div>
                    ))}</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="dieta">
              <Card className="bg-gray-900 border-gray-800"><CardHeader><CardTitle className="text-white">Acesso à Dieta</CardTitle></CardHeader><CardContent>{dietConfig?.app_download_instructions ? <div className="text-gray-300 whitespace-pre-wrap"><LinkifiedText text={dietConfig.app_download_instructions} /></div> : <p className="text-gray-400 text-center py-8">Configure as instruções de acesso à dieta na aba "Conteúdo" → "Acesso à Dieta".</p>}</CardContent></Card>
              {dietConfig?.app_code && <Card className="bg-gray-900 border-gray-800 border-[hsl(43,74%,49%)]/30 mt-4"><CardContent className="py-6 text-center"><p className="text-sm text-gray-400 mb-2">Código do App</p><p className="text-3xl font-bold text-[hsl(43,74%,49%)] font-mono">{dietConfig.app_code}</p></CardContent></Card>}
            </TabsContent>

            <TabsContent value="historico">
              <Card className="bg-gray-900 border-gray-800"><CardHeader><CardTitle className="text-white">Histórico de Check-ins</CardTitle></CardHeader><CardContent>
                <p className="text-gray-400 text-center py-8">Prévia - Check-ins dos atletas aparecerão aqui</p>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="materiais">
              {allSupportMaterials.length === 0 ? (
                <Card className="bg-gray-900 border-gray-800">
                  <CardContent className="py-12 text-center">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-gray-600" />
                    <p className="text-gray-400">Nenhum material configurado. Adicione na aba "Conteúdo" → "Materiais de Suporte".</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {allSupportMaterials.map((m) => (
                    <MaterialPost
                      key={m.id}
                      id={m.id}
                      title={m.title || 'Sem título'}
                      content={m.content}
                      contentType={m.content_type as 'text' | 'youtube_video'}
                      youtubeUrl={m.youtube_url}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="perfil">
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader><CardTitle className="text-white">Perfil</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-gray-400 text-center py-8">Prévia - Área de perfil do atleta</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <Home className="h-16 w-16 text-gray-400 mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Conta não vinculada</h1>
        <p className="text-gray-400 text-center mb-6">Seu email não está vinculado a nenhum atleta. Entre em contato com seu assessor.</p>
        <Button onClick={handleSignOut} variant="outline" className="border-gray-700 text-white hover:bg-gray-800">Sair</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-gray-800 bg-black sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AthleteSidebar activeTab={activeTab} onTabChange={setActiveTab} clientName={client.name} userEmail={user.email || ''} onSignOut={handleSignOut} />
            <div className="h-10 w-10 rounded-full overflow-hidden border border-[hsl(43,74%,49%)]"><img src={rogersProfile} alt="Rogers Feitosa" className="w-full h-[200%] object-cover object-[center_15%]" /></div>
            <div className="flex items-center gap-2">
              <div>
                <h1 className="text-lg font-bold text-[hsl(43,74%,49%)]">ROGERS FEITOSA</h1>
                <p className="text-xs text-gray-400">Nutrição e Treinamento</p>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge 
                      variant="outline" 
                      className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50 text-[10px] font-bold px-1.5 py-0 cursor-help"
                    >
                      BETA
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px] text-center">
                    <p className="text-xs">Versão beta do sistema. Se precisar de ajuda, entre em contato com o suporte!</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-4">
            <div className="text-right"><p className="text-sm font-medium text-white">{client.name}</p><p className="text-xs text-gray-400">{user.email}</p></div>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-white hover:bg-gray-800"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <div className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3"><span className="text-sm text-gray-400">Plano:</span><span className="text-sm font-medium text-white">{serviceTypeLabel}</span></div>
          <Badge className={`${client.is_active ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>{client.is_active ? 'Ativo' : 'Inativo'}</Badge>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6"><h2 className="text-2xl font-bold text-white mb-1">Olá, {client.name.split(' ')[0]}!</h2><p className="text-gray-400">Bem-vindo à sua área de membros</p></div>

        {/* Banner de anamnese pendente ou concluída */}
        <AnamnesePendingBanner anamneseCompleted={anamneseCompleted} />

        {/* Banner de próxima consulta - unificado para todos os atletas premium */}
        <NextConsultBanner clientId={client.id} />

        {/* Card de detalhes de consultas restantes - apenas para continuação */}
        {continuationStatus?.isContinuation && continuationStatus?.hasConsultations && (
          <NextConsultCard clientId={client.id} />
        )}

        {/* Card de 1ª consulta - apenas para novos clientes sem schedule E com anamnese concluída */}
        {!continuationStatus?.isContinuation && anamneseCompleted && (
          <FirstConsultCard clientId={client.id} />
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-gray-900 border border-gray-800 p-1">
            <TabsTrigger value="inicio" className="gap-1 data-[state=active]:bg-[hsl(43,74%,49%)] data-[state=active]:text-primary-foreground text-white text-xs"><Home className="h-4 w-4" /><span className="hidden lg:inline">Início</span></TabsTrigger>
            <TabsTrigger value="dieta" className="gap-1 data-[state=active]:bg-[hsl(43,74%,49%)] data-[state=active]:text-primary-foreground text-white text-xs"><Utensils className="h-4 w-4" /><span className="hidden lg:inline">Dieta</span></TabsTrigger>
            <TabsTrigger value="historico" className="gap-1 data-[state=active]:bg-[hsl(43,74%,49%)] data-[state=active]:text-primary-foreground text-white text-xs"><ClipboardCheck className="h-4 w-4" /><span className="hidden lg:inline">Histórico</span></TabsTrigger>
            <TabsTrigger value="materiais" className="gap-1 data-[state=active]:bg-[hsl(43,74%,49%)] data-[state=active]:text-primary-foreground text-white text-xs"><FileText className="h-4 w-4" /><span className="hidden lg:inline">Materiais</span></TabsTrigger>
            <TabsTrigger value="perfil" className="gap-1 data-[state=active]:bg-[hsl(43,74%,49%)] data-[state=active]:text-primary-foreground text-white text-xs"><User className="h-4 w-4" /><span className="hidden lg:inline">Perfil</span></TabsTrigger>
          </TabsList>

          <TabsContent value="inicio">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader><CardTitle className="text-white">Bem-vindo ao seu painel</CardTitle></CardHeader>
              <CardContent>
                {/* Aviso informativo de próxima consulta */}
                <NextConsultInfo clientId={client.id} />
                
                {allInicioMaterials.length === 0 ? <p className="text-gray-400 text-center py-8">Conteúdo de boas-vindas em breve...</p> : (
                  <div className="space-y-4">{allInicioMaterials.map((m) => (
                    <div key={m.id} className="p-4 rounded-lg bg-gray-800/50 border border-gray-700">
                      <h4 className="font-medium text-white mb-2">{m.title}</h4>
                      {m.content_type === 'text' ? <p className="text-gray-300 text-sm whitespace-pre-wrap"><LinkifiedText text={m.content || ''} /></p> : <div className="aspect-video rounded-lg overflow-hidden"><iframe src={getYouTubeEmbedUrl(m.youtube_url || '') || ''} className="w-full h-full" allowFullScreen /></div>}
                    </div>
                  ))}</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dieta">
            <Card className="bg-gray-900 border-gray-800"><CardHeader><CardTitle className="text-white">Acesso à Dieta</CardTitle></CardHeader><CardContent>{dietConfig?.app_download_instructions ? <p className="text-gray-300 whitespace-pre-wrap"><LinkifiedText text={dietConfig.app_download_instructions} /></p> : <p className="text-gray-400 text-center py-8">Instruções em breve...</p>}</CardContent></Card>
            {dietConfig?.app_code && <Card className="bg-gray-900 border-gray-800 border-[hsl(43,74%,49%)]/30 mt-4"><CardContent className="py-6 text-center"><p className="text-sm text-gray-400 mb-2">Seu código</p><p className="text-3xl font-bold text-[hsl(43,74%,49%)] font-mono">{dietConfig.app_code}</p></CardContent></Card>}
          </TabsContent>

          <TabsContent value="historico">
            <Card className="bg-gray-900 border-gray-800"><CardHeader><CardTitle className="text-white">Histórico de Check-ins</CardTitle></CardHeader><CardContent>
              {checkinResponses.length === 0 ? <p className="text-gray-400 text-center py-8">Nenhum check-in realizado</p> : (
                <div className="space-y-3">{checkinResponses.map((r: any) => (
                  <div key={r.id} className="p-4 rounded-lg bg-gray-800/50 border border-gray-700">
                    <span className="text-sm text-white">{format(parseISO(r.submitted_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                    {r.responses?.peso && <p className="text-sm text-gray-400 mt-1">Peso: {r.responses.peso} kg</p>}
                  </div>
                ))}</div>
              )}
            </CardContent></Card>
            {checkinResponses.length > 0 && (
              <div className="mt-4">
                <CheckinEvolutionCharts responses={checkinResponses} questions={checkinQuestions} clientName={client?.name} clientId={client?.id} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="materiais">
            {allSupportMaterials.length === 0 ? (
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-gray-600" />
                  <p className="text-gray-400">Materiais em breve</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {allSupportMaterials.map((m) => (
                  <MaterialPost
                    key={m.id}
                    id={m.id}
                    title={m.title || 'Sem título'}
                    content={m.content}
                    contentType={m.content_type as 'text' | 'youtube_video'}
                    youtubeUrl={m.youtube_url}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="perfil">
            <AthleteProfileSection clientId={client.id} clientName={client.name} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
