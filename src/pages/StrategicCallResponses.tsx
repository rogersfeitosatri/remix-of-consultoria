import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useStrategicCall, useStrategicCallResponses, useStrategicCallQuestions, type StrategicCallResponse } from '@/hooks/useStrategicCalls';
import { ArrowLeft, Loader2, Eye } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useState } from 'react';

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
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => setSelected(r)}>
                            <Eye className="h-4 w-4" />
                          </Button>
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
