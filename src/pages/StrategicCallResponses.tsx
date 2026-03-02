import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useStrategicCall, useStrategicCallResponses, useStrategicCallQuestions, type StrategicCallResponse } from '@/hooks/useStrategicCalls';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Loader2, Eye, Send, Upload, Trash2 } from 'lucide-react';
import ImportResponsesDialog from '@/components/strategic/ImportResponsesDialog';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useState } from 'react';
import { toast } from 'sonner';

const classColors: Record<string, string> = {
  high: 'default',
  medium: 'secondary',
  low: 'outline',
};
const classLabels: Record<string, string> = {
  high: 'Alto potencial',
  medium: 'Médio potencial',
  low: 'Baixo potencial',
};

export default function StrategicCallResponses() {
  const { callId } = useParams<{ callId: string }>();
  const navigate = useNavigate();
  const { data: call } = useStrategicCall(callId);
  const { data: responses = [], isLoading } = useStrategicCallResponses(callId);
  const { data: questions = [] } = useStrategicCallQuestions(callId);
  const [selected, setSelected] = useState<StrategicCallResponse | null>(null);
  const [sendingLinkTo, setSendingLinkTo] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeleteResponse = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase
        .from('strategic_call_responses')
        .delete()
        .eq('id', id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['strategic-call-responses', callId] });
      toast.success('Resposta excluída com sucesso!');
      if (selected?.id === id) setSelected(null);
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  // Fetch scheduling link associated with this strategic call
  const { data: schedulingLink } = useQuery({
    queryKey: ['scheduling-link-for-call', callId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_scheduling_links')
        .select('id, slug, title')
        .eq('strategic_call_id', callId!)
        .eq('status', 'active')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!callId,
  });

  const handleSendSchedulingLink = async (r: StrategicCallResponse) => {
    const contact = getContactFromAnswers(r);
    const phone = contact.phone;
    if (!phone) {
      toast.error('Telefone não encontrado para este respondente.');
      return;
    }
    if (!schedulingLink) {
      toast.error('Nenhum link de agendamento vinculado a esta call.');
      return;
    }

    setSendingLinkTo(r.id);
    try {
      const bookingUrl = `https://rogersfeitosa.com.br/agendar-call/${schedulingLink.slug}`;
      const message = `Olá${contact.name ? `, ${contact.name}` : ''}! 🎉\n\nSua aplicação foi aprovada! Agende sua call estratégica no link abaixo:\n\n👉 ${bookingUrl}\n\nAté breve!`;

      let formattedPhone = phone.replace(/\D/g, '');
      if (formattedPhone.startsWith('0')) formattedPhone = formattedPhone.substring(1);
      if (!formattedPhone.startsWith('55')) formattedPhone = '55' + formattedPhone;

      await supabase.functions.invoke('send-strategic-call-whatsapp', {
        body: { phone: formattedPhone, message, respondentName: contact.name, callId, skipAdminNotification: true },
      });

      toast.success('Link de agendamento enviado via WhatsApp!');
    } catch (err: any) {
      toast.error('Erro ao enviar: ' + err.message);
    } finally {
      setSendingLinkTo(null);
    }
  };

  // Extract contact info from answers as fallback when respondent fields are empty
  const getContactFromAnswers = (r: StrategicCallResponse) => {
    const answers = r.answers as Record<string, any> | null;
    let name = r.respondent_name || '';
    let email = r.respondent_email || '';
    let phone = r.respondent_phone || '';

    if ((!name || !phone) && answers && questions.length > 0) {
      for (const q of questions) {
        const val = answers[q.id];
        if (!val) continue;
        if (!name && q.question_type === 'short_text' && !q.field_name) {
          // First short_text is likely the name
          if (!name) name = val;
        }
        if (!email && q.question_type === 'email') email = val;
        if (!phone && q.question_type === 'phone') phone = val;
        if (q.field_name === 'nome' || q.field_name === 'name') name = val;
        if (q.field_name === 'email') email = val;
        if (q.field_name === 'telefone' || q.field_name === 'phone' || q.field_name === 'whatsapp') phone = val;
      }
    }
    return { name, email, phone };
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
        <div className="flex items-center gap-4 flex-1">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/calls/${callId}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Respostas: {call?.name}</h1>
            <p className="text-sm text-muted-foreground">{responses.length} aplicações recebidas</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Importar do Google Forms
        </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : responses.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma aplicação recebida ainda.</CardContent></Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Pontuação</TableHead>
                    <TableHead>Classificação</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {responses.map(r => {
                    const contact = getContactFromAnswers(r);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{contact.name || '-'}</TableCell>
                        <TableCell>{contact.email || '-'}</TableCell>
                        <TableCell>{contact.phone || '-'}</TableCell>
                        <TableCell>{r.total_score}</TableCell>
                        <TableCell>
                          <Badge variant={classColors[r.classification] as any || 'secondary'}>
                            {classLabels[r.classification] || r.classification}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(new Date(r.submitted_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                        <TableCell>
                          <Badge variant={r.whatsapp_sent ? 'default' : 'outline'}>
                            {r.whatsapp_sent ? 'Enviado' : 'Pendente'}
                          </Badge>
                        </TableCell>
                        <TableCell className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setSelected(r)} title="Ver respostas">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {schedulingLink && contact.phone && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleSendSchedulingLink(r)}
                              disabled={sendingLinkTo === r.id}
                              title="Enviar link de agendamento via WhatsApp"
                            >
                              {sendingLinkTo === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 text-green-600" />}
                            </Button>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" title="Excluir resposta" disabled={deletingId === r.id}>
                                {deletingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir resposta?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita. A resposta de {contact.name || 'este respondente'} será removida permanentemente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteResponse(r.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aplicação de {selected?.respondent_name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div><span className="text-muted-foreground">Email:</span> {selected.respondent_email}</div>
                <div><span className="text-muted-foreground">Telefone:</span> {selected.respondent_phone}</div>
                <div><span className="text-muted-foreground">Pontuação:</span> {selected.total_score}</div>
              </div>
              {schedulingLink && getContactFromAnswers(selected).phone && (
                <Button
                  onClick={() => handleSendSchedulingLink(selected)}
                  disabled={sendingLinkTo === selected.id}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  {sendingLinkTo === selected.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  Enviar link de agendamento via WhatsApp
                </Button>
              )}
              <div className="space-y-3">
                {(() => {
                  const answers = selected.answers as Record<string, any> | null;
                  if (!answers) return <p className="text-sm text-muted-foreground">(sem respostas)</p>;

                  // Check if answers are keyed by question IDs or by column names
                  const hasQuestionIdKeys = questions.length > 0 && questions.some(q => answers[q.id] !== undefined);

                  if (hasQuestionIdKeys) {
                    return questions.map(q => {
                      const answer = answers[q.id];
                      return (
                        <div key={q.id} className="border-b border-border pb-3">
                          <p className="text-sm font-medium text-foreground">{q.question_text}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {Array.isArray(answer) ? answer.join(', ') : answer || '(sem resposta)'}
                          </p>
                        </div>
                      );
                    });
                  }

                  // Imported responses: answers keyed by column name
                  return Object.entries(answers).map(([col, val]) => (
                    <div key={col} className="border-b border-border pb-3">
                      <p className="text-sm font-medium text-foreground">{col}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {Array.isArray(val) ? val.join(', ') : String(val || '(sem resposta)')}
                      </p>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ImportResponsesDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        callId={callId!}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['strategic-call-responses', callId] })}
      />
    </Layout>
  );
}
