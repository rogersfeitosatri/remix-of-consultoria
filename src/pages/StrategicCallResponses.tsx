import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useStrategicCall, useStrategicCallResponses, useStrategicCallQuestions, type StrategicCallResponse } from '@/hooks/useStrategicCalls';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Loader2, Eye, Send } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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

      await supabase.functions.invoke('send-whatsapp', {
        body: { phone: formattedPhone, message },
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
          <Button variant="ghost" size="icon" onClick={() => navigate(`/calls/${callId}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Respostas: {call?.name}</h1>
            <p className="text-sm text-muted-foreground">{responses.length} aplicações recebidas</p>
          </div>
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
                {questions.map(q => {
                  const answer = (selected.answers as Record<string, any>)?.[q.id];
                  return (
                    <div key={q.id} className="border-b border-border pb-3">
                      <p className="text-sm font-medium text-foreground">{q.question_text}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {Array.isArray(answer) ? answer.join(', ') : answer || '(sem resposta)'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
