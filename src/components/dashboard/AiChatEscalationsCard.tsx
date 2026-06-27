import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, Check } from 'lucide-react';
import { useAiChatEscalations, useResolveEscalation } from '@/hooks/useAiChat';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function AiChatEscalationsCard() {
  const { data: items = [], isLoading } = useAiChatEscalations();
  const resolve = useResolveEscalation();
  if (isLoading || items.length === 0) return null;
  return (
    <Card className="border-orange-500/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="h-4 w-4 text-orange-500" />
          IA WhatsApp — pendente de revisão
          <Badge variant="destructive">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((e: any) => (
          <div key={e.id} className="flex items-start justify-between gap-3 p-3 rounded-md border bg-muted/30">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{e.clients?.name}</div>
              <div className="text-xs text-muted-foreground">
                Gatilho: <span className="font-mono">{e.trigger}</span> · {format(new Date(e.created_at), "dd/MM HH:mm", { locale: ptBR })}
              </div>
              <div className="text-sm mt-1 italic">"{e.excerpt}"</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => resolve.mutate(e.id)} disabled={resolve.isPending}>
              <Check className="h-4 w-4 mr-1" /> Resolver
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
