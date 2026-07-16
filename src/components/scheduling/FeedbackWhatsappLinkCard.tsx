import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Copy, ExternalLink, MessageSquare, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_PHONE = '+5517201401 54'.replace(/\s+/g, '');

const DEFAULT_MESSAGE = `*OLÁ, SEGUE O MEU FEEDBACK SEMANAL — ZONA NUTRI*

*1. De 0 a 10, quanto você conseguiu seguir o plano nesta semana?*
Resposta:

*2. O que mais facilitou e o que mais atrapalhou você a seguir o plano?*
Resposta:

*3. Como ficou sua fome durante o dia? Em algum horário sentiu muita fome, pouca saciedade ou vontade frequente de comer fora do plano?*
Resposta:

*4. Como ficaram sua energia e disposição ao longo do dia? Teve fraqueza, tontura, dor de cabeça, irritação ou cansaço acima do normal?*
Resposta:

*5. Como você se sentiu nos treinos desta semana? Teve energia suficiente, queda de rendimento, fadiga precoce ou dificuldade para completar algum treino?*
Resposta:

*6. Como você se sentiu antes, durante e depois dos treinos? Comente sobre fome, digestão, hidratação e recuperação.*
Resposta:

*7. Teve algum desconforto gastrointestinal, como estufamento, gases, refluxo, azia, náusea, dor abdominal, diarreia ou intestino preso? Em qual refeição ou situação aconteceu?*
Resposta:

*8. Como ficaram seu sono e sua recuperação? Dormiu bem? Sentiu dores musculares persistentes, cansaço acumulado ou dificuldade para se recuperar entre os treinos?*
Resposta:

*9. Alguma refeição, quantidade, horário ou alimento foi difícil de manter na sua rotina? Precisa de alguma substituição ou de uma opção mais prática?*
Resposta:

*10. Pensando na próxima semana, o que você acredita que precisa melhorar ou ser ajustado para conseguir seguir o plano e treinar melhor?*
Resposta:`;

function normalizePhone(raw: string): string {
  return raw.replace(/\D+/g, '');
}

export function FeedbackWhatsappLinkCard() {
  const [phone, setPhone] = useState<string>(DEFAULT_PHONE);
  const [message, setMessage] = useState<string>(DEFAULT_MESSAGE);

  const waLink = useMemo(() => {
    const digits = normalizePhone(phone);
    if (!digits) return '';
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  }, [phone, message]);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado!`);
    } catch {
      toast.error('Falha ao copiar');
    }
  };

  const resetMessage = () => {
    setMessage(DEFAULT_MESSAGE);
    toast.success('Mensagem restaurada');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5 text-emerald-500" />
          Link de Feedback Semanal (WhatsApp)
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Compartilhe este link com o atleta. Ao clicar, o WhatsApp abrirá com o número e a mensagem já preenchidos — o envio continua manual.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="fb-phone">Contato (WhatsApp)</Label>
          <Input
            id="fb-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+55 17 2014 0154"
          />
          <p className="text-xs text-muted-foreground">
            Formato internacional. Caracteres não numéricos são ignorados. Ex.: +55 17 2014 0154
          </p>
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="fb-msg">Mensagem</Label>
            <Button type="button" variant="ghost" size="sm" onClick={resetMessage} className="gap-1.5 h-7">
              <RotateCcw className="h-3.5 w-3.5" />
              Restaurar padrão
            </Button>
          </div>
          <Textarea
            id="fb-msg"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={12}
            className="font-mono text-xs"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="fb-link">Link para compartilhar</Label>
          <div className="flex gap-2">
            <Input id="fb-link" value={waLink} readOnly className="font-mono text-xs" />
            <Button type="button" variant="outline" size="icon" onClick={() => copy(waLink, 'Link')} title="Copiar link">
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              onClick={() => waLink && window.open(waLink, '_blank', 'noopener,noreferrer')}
              title="Abrir no WhatsApp"
              disabled={!waLink}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Envie este link ao atleta. Ao clicar, o WhatsApp abre a conversa com o número informado e a mensagem já digitada, pronta para revisar e enviar.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
