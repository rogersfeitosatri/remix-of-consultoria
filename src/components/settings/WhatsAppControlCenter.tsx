import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  useWhatsAppTemplates, 
  useInitializeWhatsAppTemplates, 
  useWhatsAppMessageLogs,
  useScheduledMessages,
} from '@/hooks/useWhatsAppTemplates';
import { WhatsAppTemplatesTab } from './WhatsAppTemplatesTab';
import { WhatsAppLogsTab } from './WhatsAppLogsTab';
import { WhatsAppScheduledTab } from './WhatsAppScheduledTab';
import { MessageSquare, History, Clock, Loader2 } from 'lucide-react';

export function WhatsAppControlCenter() {
  const { data: templates, isLoading: templatesLoading } = useWhatsAppTemplates();
  const { data: logs, isLoading: logsLoading } = useWhatsAppMessageLogs(100);
  const { data: scheduledMessages, isLoading: scheduledLoading } = useScheduledMessages();
  const initializeTemplates = useInitializeWhatsAppTemplates();
  const [initialized, setInitialized] = useState(false);

  // Initialize default templates if none exist
  useEffect(() => {
    if (!templatesLoading && templates && templates.length === 0 && !initialized) {
      setInitialized(true);
      initializeTemplates.mutate();
    }
  }, [templates, templatesLoading, initialized, initializeTemplates]);

  if (templatesLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Central de Mensagens WhatsApp
        </CardTitle>
        <CardDescription>
          Gerencie templates, visualize mensagens programadas e acompanhe o histórico de envios
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="templates" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Programadas
              {scheduledMessages && scheduledMessages.filter(m => m.status === 'scheduled').length > 0 && (
                <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                  {scheduledMessages.filter(m => m.status === 'scheduled').length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="templates" className="mt-4">
            <WhatsAppTemplatesTab templates={templates || []} />
          </TabsContent>
          
          <TabsContent value="scheduled" className="mt-4">
            <WhatsAppScheduledTab 
              messages={scheduledMessages || []} 
              isLoading={scheduledLoading} 
            />
          </TabsContent>
          
          <TabsContent value="logs" className="mt-4">
            <WhatsAppLogsTab logs={logs || []} isLoading={logsLoading} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
