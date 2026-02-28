import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClipboardCheck, CalendarCheck, AlertCircle, History } from 'lucide-react';
import { PendingReviewsList } from '@/components/forms/PendingReviewsList';
import { ScheduledCheckinsSection } from '@/components/forms/ScheduledCheckinsSection';
import { CheckinAuditTab } from '@/components/forms/CheckinAuditTab';
import { UnresponsiveAthletesAlert } from '@/components/checkin/UnresponsiveAthletesAlert';

export default function CheckinHub() {
  const [activeTab, setActiveTab] = useState('pendentes');

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Check-ins</h1>
          <p className="text-muted-foreground">
            Controle total dos check-ins dos seus atletas
          </p>
        </div>

        {/* Alert for unresponsive athletes */}
        <UnresponsiveAthletesAlert />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 max-w-2xl">
            <TabsTrigger value="pendentes" className="gap-2">
              <ClipboardCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Pendentes</span>
            </TabsTrigger>
            <TabsTrigger value="agendados" className="gap-2">
              <CalendarCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Agendados</span>
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

          <TabsContent value="conferencia" className="space-y-6 mt-6">
            <CheckinAuditTab />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
