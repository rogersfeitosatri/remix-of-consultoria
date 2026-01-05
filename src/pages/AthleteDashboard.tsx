import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAthleteClient, useCheckinResponses } from '@/hooks/useUserRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PersonStanding, LogOut, User, Calendar, FileText, ClipboardList } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AthleteDashboard() {
  const navigate = useNavigate();
  const { user, signOut, loading: authLoading } = useAuth();
  const { data: client, isLoading: clientLoading } = useAthleteClient();
  const { data: checkinResponses = [], isLoading: responsesLoading } = useCheckinResponses(client?.id);

  const [activeTab, setActiveTab] = useState('plan');

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (authLoading || clientLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <PersonStanding className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Conta não vinculada</h1>
        <p className="text-muted-foreground text-center mb-6">
          Seu email não está vinculado a nenhum atleta cadastrado. Entre em contato com seu assessor.
        </p>
        <Button onClick={handleSignOut} variant="outline">
          Sair
        </Button>
      </div>
    );
  }

  const daysRemaining = differenceInDays(parseISO(client.end_date), new Date());

  const planDurationLabel = {
    monthly: 'Mensal',
    quarterly: 'Trimestral',
    semiannual: 'Semestral',
    annual: 'Anual',
  }[client.plan_duration || 'monthly'];

  const serviceTypeLabel = {
    nutrition: 'Nutrição',
    training: 'Treinamento',
    both: 'Nutrição + Treinamento',
  }[client.service_type || 'both'];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <PersonStanding className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold">RF Assessoria</h1>
              <p className="text-xs text-muted-foreground">Esportiva</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{client.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-1">Olá, {client.name.split(' ')[0]}!</h2>
          <p className="text-muted-foreground">Bem-vindo à sua área de atleta</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="plan" className="gap-2">
              <User className="h-4 w-4" />
              Meu Plano
            </TabsTrigger>
            <TabsTrigger value="checkins" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Histórico de Checkins
            </TabsTrigger>
          </TabsList>

          <TabsContent value="plan" className="space-y-6">
            {/* Status Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Status do Plano</CardTitle>
                  <Badge variant={client.is_active ? 'default' : 'destructive'}>
                    {client.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Tipo de Plano</p>
                    <p className="font-medium capitalize">{client.plan_type}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Duração</p>
                    <p className="font-medium">{planDurationLabel}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Tipo de Serviço</p>
                    <p className="font-medium">{serviceTypeLabel}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Dias Restantes</p>
                    <p className={`font-medium ${daysRemaining < 30 ? 'text-amber-500' : ''}`}>
                      {daysRemaining > 0 ? `${daysRemaining} dias` : 'Expirado'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Plan Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Período do Plano
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Data de Início</p>
                    <p className="font-medium">
                      {format(parseISO(client.start_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Data de Término</p>
                    <p className="font-medium">
                      {format(parseISO(client.end_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Checkin Info */}
            {client.has_checkin && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Checkin
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Frequência</p>
                    <p className="font-medium capitalize">
                      {{
                        daily: 'Diário',
                        weekly: 'Semanal',
                        biweekly: 'Quinzenal',
                        monthly: 'Mensal',
                        bimonthly: 'Bimestral',
                        quarterly: 'Trimestral',
                      }[client.checkin_frequency || 'weekly']}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Consultations Info */}
            {client.has_consultations && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Consultas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Total de Consultas</p>
                      <p className="font-medium">{client.consultation_count || 0}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Frequência</p>
                      <p className="font-medium capitalize">
                        {{
                          once: 'Única',
                          monthly: 'Mensal',
                          six_weeks: 'A cada 6 semanas',
                        }[client.consultation_frequency || 'monthly']}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="checkins" className="space-y-4">
            {responsesLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : checkinResponses.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum checkin realizado</h3>
                  <p className="text-muted-foreground">
                    Quando você preencher formulários de checkin, eles aparecerão aqui
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {checkinResponses.map((response: any) => (
                  <Card key={response.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                          {response.checkin_forms?.title || 'Checkin'}
                        </CardTitle>
                        <Badge variant="outline">
                          {format(new Date(response.submitted_at), "dd/MM/yyyy", { locale: ptBR })}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Enviado às {format(new Date(response.submitted_at), "HH:mm", { locale: ptBR })}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
