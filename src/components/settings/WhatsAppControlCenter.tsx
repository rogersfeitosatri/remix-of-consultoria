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
import { BroadcastComposeDialog } from './BroadcastComposeDialog';
import { BroadcastsListTab } from './BroadcastsListTab';
import { ContactsTab } from './ContactsTab';
import { MessageSquare, History, Clock, Loader2, Send, Users, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function WhatsAppControlCenter() {
  const { data: templates, isLoading: templatesLoading } = useWhatsAppTemplates();
  const { data: logs, isLoading: logsLoading } = useWhatsAppMessageLogs(100);
  const { data: scheduledMessages, isLoading: scheduledLoading } = useScheduledMessages();
  const initializeTemplates = useInitializeWhatsAppTemplates();
  const [initialized, setInitialized] = useState(false);
  const [showCompose, setShowCompose] = useState(false);

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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Central de Mensagens WhatsApp
            </CardTitle>
            <CardDescription>
              Envie mensagens em massa, gerencie templates, contatos e acompanhe históricos
            </CardDescription>
          </div>
          <Button onClick={() => setShowCompose(true)} className="gap-2">
            <Send className="h-4 w-4" />
            Nova Mensagem
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="broadcasts" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="broadcasts" className="flex items-center gap-1 text-xs">
              <Radio className="h-3.5 w-3.5" />
              Envios
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-1 text-xs">
              <MessageSquare className="h-3.5 w-3.5" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="contacts" className="flex items-center gap-1 text-xs">
              <Users className="h-3.5 w-3.5" />
              Contatos
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="flex items-center gap-1 text-xs">
              <Clock className="h-3.5 w-3.5" />
              Programadas
              {scheduledMessages && scheduledMessages.filter(m => m.status === 'scheduled').length > 0 && (
                <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
                  {scheduledMessages.filter(m => m.status === 'scheduled').length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-1 text-xs">
              <History className="h-3.5 w-3.5" />
              Histórico
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="broadcasts" className="mt-4">
            <BroadcastsListTab />
          </TabsContent>

          <TabsContent value="templates" className="mt-4">
            <WhatsAppTemplatesTab templates={templates || []} />
          </TabsContent>

          <TabsContent value="contacts" className="mt-4">
            <ContactsTab />
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

      <BroadcastComposeDialog open={showCompose} onOpenChange={setShowCompose} />
    </Card>
  );
}
