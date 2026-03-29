import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  useWhatsAppTemplates, 
  useInitializeWhatsAppTemplates, 
  useWhatsAppMessageLogs,
  useScheduledMessages,
} from '@/hooks/useWhatsAppTemplates';
import { WhatsAppTemplatesTab } from './WhatsAppTemplatesTab';
import { WhatsAppLogsTab } from './WhatsAppLogsTab';
import { WhatsAppScheduledTab } from './WhatsAppScheduledTab';
import { BroadcastComposeDialog, type BroadcastPrefill } from './BroadcastComposeDialog';
import { BroadcastsListTab } from './BroadcastsListTab';
import { ContactsTab } from './ContactsTab';
import { MessageSquare, History, Clock, Loader2, Send, Users, Radio, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function WhatsAppControlCenter() {
  const { data: templates, isLoading: templatesLoading } = useWhatsAppTemplates();
  const { data: logs, isLoading: logsLoading } = useWhatsAppMessageLogs(100);
  const { data: scheduledMessages, isLoading: scheduledLoading } = useScheduledMessages();
  const initializeTemplates = useInitializeWhatsAppTemplates();
  const [initialized, setInitialized] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [composePrefill, setComposePrefill] = useState<BroadcastPrefill | undefined>();

  const handleNewFromBroadcast = (prefill: BroadcastPrefill) => {
    setComposePrefill(prefill);
    setShowCompose(true);
  };

  const handleComposeClose = (open: boolean) => {
    setShowCompose(open);
    if (!open) setComposePrefill(undefined);
  };

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

  // Stats
  const totalSent = logs?.filter(l => l.status === 'success').length || 0;
  const totalFailed = logs?.filter(l => l.status === 'failed').length || 0;
  const pendingScheduled = scheduledMessages?.filter(m => m.status === 'scheduled').length || 0;
  const pendingMeet = scheduledMessages?.filter(m => m.status === 'pending_meet').length || 0;

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-emerald-500/10 border-emerald-500/20">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Enviadas</p>
              <p className="text-lg font-bold text-emerald-500">{totalSent}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/20">
              <XCircle className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Falhas</p>
              <p className="text-lg font-bold text-destructive">{totalFailed}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/10 border-blue-500/20">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Clock className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Programadas</p>
              <p className="text-lg font-bold text-blue-500">{pendingScheduled}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/10 border-amber-500/20">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sem Meet</p>
              <p className="text-lg font-bold text-amber-500">{pendingMeet}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="h-5 w-5 text-emerald-500" />
              Central de Mensagens
            </CardTitle>
            <Button onClick={() => setShowCompose(true)} size="sm" className="gap-2">
              <Send className="h-4 w-4" />
              Nova Mensagem
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Tabs defaultValue="broadcasts" className="w-full">
            <TabsList className="w-full flex overflow-x-auto">
              <TabsTrigger value="broadcasts" className="flex-1 min-w-0 flex items-center gap-1.5 text-xs">
                <Radio className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Envios</span>
              </TabsTrigger>
              <TabsTrigger value="templates" className="flex-1 min-w-0 flex items-center gap-1.5 text-xs">
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Templates</span>
              </TabsTrigger>
              <TabsTrigger value="contacts" className="flex-1 min-w-0 flex items-center gap-1.5 text-xs">
                <Users className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Contatos</span>
              </TabsTrigger>
              <TabsTrigger value="scheduled" className="flex-1 min-w-0 flex items-center gap-1.5 text-xs relative">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Programadas</span>
                {pendingScheduled > 0 && (
                  <Badge variant="default" className="ml-1 h-4 min-w-[16px] px-1 text-[10px] leading-none">
                    {pendingScheduled}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="logs" className="flex-1 min-w-0 flex items-center gap-1.5 text-xs">
                <History className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Histórico</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="broadcasts" className="mt-4">
              <BroadcastsListTab onResend={handleNewFromBroadcast} />
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
      </Card>

      <BroadcastComposeDialog open={showCompose} onOpenChange={handleComposeClose} prefill={composePrefill} />
    </div>
  );
}
