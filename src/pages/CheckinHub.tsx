import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Layout } from '@/components/layout/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PendingReviewsList } from '@/components/forms/PendingReviewsList';
import { ScheduledCheckinsSection } from '@/components/forms/ScheduledCheckinsSection';
import { CheckinAuditTab } from '@/components/forms/CheckinAuditTab';
import { CheckinAlertsBanner } from '@/components/checkin/CheckinAlertsBanner';
import { CheckinScheduleAuditBanner } from '@/components/checkin/CheckinScheduleAuditBanner';
import { CheckinDispatchOverview } from '@/components/checkin/CheckinDispatchOverview';
import { CheckinHistoryList } from '@/components/checkin/CheckinHistoryList';

const TABS = ['pendentes', 'envios', 'agendados', 'historico', 'conferencia'];
export default function CheckinHub() {
  const [params, setParams] = useSearchParams();
  const activeTab = TABS.includes(params.get('tab') || '') ? params.get('tab')! : 'pendentes';
  const clientId = params.get('client') || undefined;
  const changeTab = (tab: string) => { const next = new URLSearchParams(params); next.set('tab', tab); setParams(next); };
  if (params.get('response')) return <Navigate to={`/checkin-review/${encodeURIComponent(params.get('response')!)}`} replace />;
  return <Layout><div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold">Check-ins</h1><p className="mt-1 text-sm text-muted-foreground">Leia a resposta, prepare o feedback e confira a entrega.</p></div>
      <Button variant="outline" onClick={() => changeTab('agendados')}>Programar check-in</Button>
    </header>
    {clientId && <div className="flex flex-wrap items-center gap-3 text-sm"><Link to={`/clients/${clientId}`} className="underline">Voltar ao atleta</Link><Button variant="ghost" size="sm" onClick={() => { const next = new URLSearchParams(params); next.delete('client'); setParams(next); }}>Ver todos os atletas</Button></div>}
    <Tabs value={activeTab} onValueChange={changeTab}>
      <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:max-w-2xl sm:grid-cols-4">
        <TabsTrigger value="pendentes" className="min-h-11">Para analisar</TabsTrigger>
        <TabsTrigger value="envios" className="min-h-11">Envios</TabsTrigger>
        <TabsTrigger value="agendados" className="min-h-11">Programação</TabsTrigger>
        <TabsTrigger value="historico" className="min-h-11">Histórico</TabsTrigger>
      </TabsList>
      <TabsContent value="pendentes" className="mt-5"><PendingReviewsList /></TabsContent>
      <TabsContent value="envios" className="mt-5 space-y-4"><CheckinAlertsBanner /><CheckinDispatchOverview /></TabsContent>
      <TabsContent value="agendados" className="mt-5"><ScheduledCheckinsSection /></TabsContent>
      <TabsContent value="historico" className="mt-5"><CheckinHistoryList clientId={clientId} /></TabsContent>
      <TabsContent value="conferencia" className="mt-5 space-y-4"><h2 className="text-lg font-semibold">Diagnóstico dos check-ins</h2><CheckinScheduleAuditBanner /><CheckinAuditTab /></TabsContent>
    </Tabs>
    <details className="rounded-lg border border-border px-4">
      <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring">Mais opções</summary>
      <div className="flex flex-wrap gap-2 pb-4"><Button asChild variant="outline"><Link to="/adjustments">Revisões do acompanhamento</Link></Button><Button asChild variant="outline"><Link to="/forms">Modelos de formulário</Link></Button><Button variant="outline" onClick={() => changeTab('conferencia')}>Conferir programação e falhas</Button></div>
    </details>
  </div></Layout>;
}
