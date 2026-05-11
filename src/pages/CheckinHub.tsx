import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClipboardCheck, CalendarCheck, History, Send } from 'lucide-react';
import { PendingReviewsList } from '@/components/forms/PendingReviewsList';
import { ScheduledCheckinsSection } from '@/components/forms/ScheduledCheckinsSection';
import { CheckinAuditTab } from '@/components/forms/CheckinAuditTab';
import { CheckinAlertsBanner } from '@/components/checkin/CheckinAlertsBanner';
import { CheckinScheduleAuditBanner } from '@/components/checkin/CheckinScheduleAuditBanner';
import { CheckinDispatchOverview } from '@/components/checkin/CheckinDispatchOverview';

export default function CheckinHub() {
  const [activeTab, setActiveTab] = useState('pendentes');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fromPeriodization = searchParams.get('from') === 'periodization';
  const clientParam = searchParams.get('client');

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          {fromPeriodization && clientParam && (
            <Button variant="ghost" size="sm" onClick={() => navigate(`/nutritional-periodization?client=${clientParam}`)} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold">Check-ins</h1>
            <p className="text-muted-foreground">
              Controle total dos check-ins dos seus atletas
            </p>
          </div>
        </div>

        <CheckinAlertsBanner />
        <CheckinScheduleAuditBanner />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 max-w-3xl">
            <TabsTrigger value="pendentes" className="gap-2">
              <ClipboardCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Pendentes</span>
            </TabsTrigger>
            <TabsTrigger value="agendados" className="gap-2">
              <CalendarCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Agendados</span>
            </TabsTrigger>
            <TabsTrigger value="envios" className="gap-2">
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Envios</span>
            </TabsTrigger>
            <TabsTrigger value="conferencia" className="gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Conferência</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pendentes" className="space-y-6 mt-6">
            <PendingReviewsList />
          </TabsContent>

          <TabsContent value="agendados" className="space-y-6 mt-6">
            <ScheduledCheckinsSection />
          </TabsContent>

          <TabsContent value="envios" className="space-y-6 mt-6">
            <CheckinDispatchOverview />
          </TabsContent>

          <TabsContent value="conferencia" className="space-y-6 mt-6">
            <CheckinAuditTab />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
