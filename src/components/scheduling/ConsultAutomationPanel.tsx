import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  useConsultAutomationSettings,
  useSaveConsultAutomationSettings,
  usePremiumClients,
  useBookingLinks,
  useCreateBookingLink,
  useSendBookingInvite,
  useUpsertConsultationRule,
} from '@/hooks/useConsultations';
import { Loader2, Settings2, Send, Link, Plus, Copy, Check, Users, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const WEEK_DAYS = [
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
  { value: 7, label: 'Domingo' },
];

const TIME_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const hour = i.toString().padStart(2, '0');
  return `${hour}:00`;
});

interface ConsultAutomationPanelProps {
  showClients?: boolean;
}

export function ConsultAutomationPanel({ showClients = true }: ConsultAutomationPanelProps) {
  const { data: settings, isLoading: settingsLoading } = useConsultAutomationSettings();
  const saveSettings = useSaveConsultAutomationSettings();
  const { data: premiumClients = [], isLoading: clientsLoading } = usePremiumClients();
  const createBookingLink = useCreateBookingLink();
  const sendInvite = useSendBookingInvite();
  const upsertRule = useUpsertConsultationRule();

  const [isEnabled, setIsEnabled] = useState(true);
  const [sendDayOfWeek, setSendDayOfWeek] = useState(1);
  const [sendTime, setSendTime] = useState('07:00');
  const [messageTemplateBooking, setMessageTemplateBooking] = useState('');
  const [messageTemplateConfirmation, setMessageTemplateConfirmation] = useState('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [editCadence, setEditCadence] = useState(4);

  useEffect(() => {
    if (settings) {
      setIsEnabled(settings.is_enabled);
      setSendDayOfWeek(settings.send_day_of_week);
      setSendTime(settings.send_time?.substring(0, 5) || '07:00');
      setMessageTemplateBooking(settings.message_template_booking || '');
      setMessageTemplateConfirmation(settings.message_template_confirmation || '');
    }
  }, [settings]);

  const handleSaveSettings = async () => {
    try {
      await saveSettings.mutateAsync({
        is_enabled: isEnabled,
        send_day_of_week: sendDayOfWeek,
        send_time: sendTime + ':00',
        message_template_booking: messageTemplateBooking,
        message_template_confirmation: messageTemplateConfirmation,
      });
      toast.success('Configurações salvas!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar');
    }
  };

  const handleCreateBookingLink = async (clientId: string) => {
    try {
      await createBookingLink.mutateAsync(clientId);
      toast.success('Link de agendamento criado!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar link');
    }
  };

  const handleSendInvite = async (clientId: string, token: string) => {
    try {
      await sendInvite.mutateAsync({ clientId, bookingToken: token });
      toast.success('Convite enviado por WhatsApp!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar convite');
    }
  };

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/booking/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    toast.success('Link copiado!');
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleUpdateCadence = async () => {
    if (!editingClient) return;
    try {
      await upsertRule.mutateAsync({
        client_id: editingClient.id,
        cadence_weeks: editCadence,
        is_enabled: true,
      });
      toast.success('Cadência atualizada!');
      setEditingClient(null);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao atualizar');
    }
  };

  if (settingsLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Automation Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Automação de Consultas
              </CardTitle>
              <CardDescription>
                Configure o envio automático de links de agendamento
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="automation-enabled" className="text-sm">Ativo</Label>
              <Switch
                id="automation-enabled"
                checked={isEnabled}
                onCheckedChange={setIsEnabled}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Dia do envio automático</Label>
              <Select value={sendDayOfWeek.toString()} onValueChange={(v) => setSendDayOfWeek(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEK_DAYS.map(day => (
                    <SelectItem key={day.value} value={day.value.toString()}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Horário do envio</Label>
              <Select value={sendTime} onValueChange={setSendTime}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map(time => (
                    <SelectItem key={time} value={time}>{time}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Template da mensagem de convite</Label>
            <Textarea
              value={messageTemplateBooking}
              onChange={(e) => setMessageTemplateBooking(e.target.value)}
              placeholder="Olá {nome}! Hora de agendar sua consulta. Escolha seu melhor horário aqui: {booking_link}"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Variáveis: {'{nome}'}, {'{booking_link}'}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Template da mensagem de confirmação</Label>
            <Textarea
              value={messageTemplateConfirmation}
              onChange={(e) => setMessageTemplateConfirmation(e.target.value)}
              placeholder="Consulta confirmada para {data} às {hora}. Link da videochamada: {meet_link}"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Variáveis: {'{nome}'}, {'{data}'}, {'{hora}'}, {'{meet_link}'}
            </p>
          </div>

          <Button onClick={handleSaveSettings} disabled={saveSettings.isPending}>
            {saveSettings.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Configurações'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Premium Clients List */}
      {showClients && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Atletas Premium com Consultas
            </CardTitle>
            <CardDescription>
              Gerencie links de agendamento e periodicidade
            </CardDescription>
          </CardHeader>
          <CardContent>
            {clientsLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : premiumClients.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum atleta premium com acesso a consultas</p>
                <p className="text-sm">Ative o campo "Acesso à Agenda" no cadastro do atleta</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Atleta</TableHead>
                      <TableHead>Cadência</TableHead>
                      <TableHead>Próximo Convite</TableHead>
                      <TableHead>Último Envio</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {premiumClients.map((client: any) => {
                      const bookingLink = client.booking_link?.[0];
                      const rule = client.consultation_rule?.[0];
                      
                      return (
                        <TableRow key={client.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{client.name}</p>
                              <p className="text-sm text-muted-foreground">{client.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {rule?.cadence_weeks || 4} semanas
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {rule?.next_invite_date ? (
                              format(new Date(rule.next_invite_date), 'dd/MM/yyyy')
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {bookingLink?.last_sent_at ? (
                              format(new Date(bookingLink.last_sent_at), 'dd/MM HH:mm')
                            ) : (
                              <span className="text-muted-foreground">Nunca</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {!bookingLink ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCreateBookingLink(client.id)}
                                  disabled={createBookingLink.isPending}
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  Criar Link
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleCopyLink(bookingLink.token)}
                                  >
                                    {copiedToken === bookingLink.token ? (
                                      <Check className="h-4 w-4" />
                                    ) : (
                                      <Copy className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleSendInvite(client.id, bookingLink.token)}
                                    disabled={sendInvite.isPending}
                                  >
                                    <Send className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setEditingClient(client);
                                      setEditCadence(rule?.cadence_weeks || 4);
                                    }}
                                  >
                                    <Calendar className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Configurar Periodicidade</DialogTitle>
                                    <DialogDescription>
                                      Defina a cadência de consultas para {client.name}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                      <Label>Cadência (semanas)</Label>
                                      <Select
                                        value={editCadence.toString()}
                                        onValueChange={(v) => setEditCadence(Number(v))}
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="4">A cada 4 semanas</SelectItem>
                                          <SelectItem value="6">A cada 6 semanas</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                  <DialogFooter>
                                    <Button onClick={handleUpdateCadence} disabled={upsertRule.isPending}>
                                      {upsertRule.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        'Salvar'
                                      )}
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
