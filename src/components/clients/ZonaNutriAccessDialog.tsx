import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ZonaNutriAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessUrl: string;
  athleteName: string;
}

export function ZonaNutriAccessDialog({
  open,
  onOpenChange,
  accessUrl,
  athleteName,
}: ZonaNutriAccessDialogProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(accessUrl);
      setCopied(true);
      toast({
        title: 'Link copiado!',
        description: 'O link de acesso foi copiado para a área de transferência.',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: 'Erro ao copiar',
        description: 'Não foi possível copiar o link.',
        variant: 'destructive',
      });
    }
  };

  const handleOpenLink = () => {
    window.open(accessUrl, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Link de Acesso Gerado</DialogTitle>
          <DialogDescription>
            Link de acesso ao Zona Nutri para <strong>{athleteName}</strong>. 
            Copie e envie para o atleta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={accessUrl}
              readOnly
              className="font-mono text-sm"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopy}
              className="shrink-0"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleCopy} className="flex-1 gap-2">
              <Copy className="h-4 w-4" />
              Copiar Link
            </Button>
            <Button
              variant="outline"
              onClick={handleOpenLink}
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Este link é válido por 30 dias
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
