import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ExternalLink, Loader2, MessageSquare, Bot } from 'lucide-react';
import { useAiChatSettings, useSaveAiChatSettings, useAiChatConversations, useAiChatMessages } from '@/hooks/useAiChat';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const MODELS = [
  { value: 'gpt-5.6-luna', label: 'GPT-5.6 Luna (padrão do sistema)' },
  { value: 'gpt-5.6-terra', label: 'GPT-5.6 Terra (mais capacidade)' },
  { value: 'gpt-5-mini', label: 'GPT-5 mini' },
  { value: 'gpt-4o-mini', label: 'GPT-4o mini (barato)' },
];

const PROJECT_ID = 'vhzxnatgwravidvbehwi';
const WEBHOOK_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/whatsapp-webhook`;

export function AiWhatsAppAssistantSection() {
  const { data: settings, isLoading } = useAiChatSettings();
  const save = useSaveAiChatSettings();
  const { data: conversations = [] } = useAiChatConversations();
  const [openConv, setOpenConv] = useState<string | null>(null);
  const { data: messages = [] } = useAiChatMessages(openConv);

  const [enabled, setEnabled] = useState(false);
  const [model, setModel] = useState('openai/gpt-5.6-luna');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [keywordsText, setKeywordsText] = useState('');

  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setModel(settings.model);
      setSystemPrompt(settings.system_prompt);
      setKeywordsText((settings.escalation_keywords || []).join(', '));
    }
  }, [settings]);

  const handleSave = () => {
    save.mutate({
      enabled,
      model,
      system_prompt: systemPrompt,
      escalation_keywords: keywordsText.split(',').map(s => s.trim()).filter(Boolean),
    });
  };

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;

  return (
    <div className="space-y-6">
      <Alert>
        <AlertDescription className="space-y-2">
          <div className="font-semibold flex items-center gap-2">
            <Bot className="h-4 w-4" /> Como ativar
          </div>
          <ol className="list-decimal pl-5 space-y-1 text-sm">
            <li>Crie um app em <a href="https://developers.facebook.com" target="_blank" className="underline">developers.facebook.com</a> → adicione o produto WhatsApp.</li>
            <li>Adicione os secrets no projeto: <code>WHATSAPP_PHONE_NUMBER_ID</code>, <code>WHATSAPP_ACCESS_TOKEN</code>, <code>WHATSAPP_VERIFY_TOKEN</code>, <code>WHATSAPP_APP_SECRET</code>.</li>
            <li>No painel Meta → Webhooks → cole a URL abaixo e use o mesmo <code>WHATSAPP_VERIFY_TOKEN</code>:</li>
          </ol>
          <div className="flex gap-2 items-center mt-2">
            <Input readOnly value={WEBHOOK_URL} className="font-mono text-xs" />
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(WEBHOOK_URL); }}>Copiar</Button>
          </div>
          <p className="text-xs text-muted-foreground">Inscreva o webhook nos eventos <code>messages</code>. Em cada atleta, ative o toggle "IA WhatsApp" na ficha para liberar o atendimento.</p>
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">IA WhatsApp ativa (global)</Label>
              <p className="text-sm text-muted-foreground">Liga/desliga o atendimento da IA para todos os atletas habilitados.</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div>
            <Label>Modelo</Label>
            <select value={model} onChange={e => setModel(e.target.value)} className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm">
              {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          <div>
            <Label>System prompt (tom, escopo, regras)</Label>
            <Textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} rows={8} className="font-mono text-xs" />
          </div>

          <div>
            <Label>Palavras-gatilho de escalonamento (separe por vírgula)</Label>
            <Textarea value={keywordsText} onChange={e => setKeywordsText(e.target.value)} rows={3} />
            <p className="text-xs text-muted-foreground mt-1">Quando alguma dessas palavras aparecer na mensagem do atleta, a conversa é registrada no Centro de Ações e você recebe notificação no WhatsApp.</p>
          </div>

          <Button onClick={handleSave} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar configurações
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="h-5 w-5" />
            <h3 className="font-semibold">Conversas recentes</h3>
          </div>
          {conversations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma conversa ainda.</p>
          ) : (
            <div className="space-y-2">
              {conversations.map((c: any) => (
                <button key={c.id} onClick={() => setOpenConv(c.id)} className="w-full text-left p-3 rounded-md border hover:bg-accent transition">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">{c.clients?.name}</div>
                      <div className="text-xs text-muted-foreground">{c.clients?.phone} · {c.message_count} mensagens</div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.last_message_at && format(new Date(c.last_message_at), "dd/MM HH:mm", { locale: ptBR })}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!openConv} onOpenChange={(o) => !o && setOpenConv(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Histórico da conversa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {messages.map((m: any) => (
              <div key={m.id} className={`p-3 rounded-lg ${m.role === 'user' ? 'bg-muted' : 'bg-primary/10'}`}>
                <div className="flex justify-between text-xs mb-1">
                  <Badge variant={m.role === 'user' ? 'secondary' : 'default'}>
                    {m.role === 'user' ? 'Atleta' : 'IA'}
                  </Badge>
                  <span className="text-muted-foreground">{format(new Date(m.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                </div>
                <div className="text-sm whitespace-pre-wrap">{m.content}</div>
                {m.escalated && <Badge variant="destructive" className="mt-2">Escalonada</Badge>}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
