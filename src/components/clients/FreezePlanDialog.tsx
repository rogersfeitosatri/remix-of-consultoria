import { useState } from 'react';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Snowflake, CalendarIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Client } from '@/hooks/useClients';

interface FreezePlanDialogProps {
  client: Client;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (freezeDate: string, reason: string) => void;
  isPending: boolean;
}

export function FreezePlanDialog({ client, open, onOpenChange, onConfirm, isPending }: FreezePlanDialogProps) {
  const [freezeDate, setFreezeDate] = useState<Date>(new Date());
  const [reason, setReason] = useState('');

  const daysRemaining = differenceInCalendarDays(parseISO(client.end_date), freezeDate);

  const handleConfirm = () => {
    onConfirm(freezeDate.toISOString(), reason.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Snowflake className="h-5 w-5 text-blue-500" />
            Congelar Plano — {client.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Freeze date */}
          <div className="space-y-2">
            <Label>Data de início do congelamento</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !freezeDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {freezeDate ? format(freezeDate, "dd/MM/yyyy", { locale: ptBR }) : 'Selecione a data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={freezeDate}
                  onSelect={(d) => d && setFreezeDate(d)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Days remaining info */}
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Término do plano:</span>
              <span className="font-medium">{format(parseISO(client.end_date), 'dd/MM/yyyy', { locale: ptBR })}</span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-muted-foreground">Dias restantes até o fim:</span>
              <span className="font-bold text-blue-600">{daysRemaining > 0 ? daysRemaining : 0} dias</span>
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label>Motivo / Observações</Label>
            <Textarea
              placeholder="Ex: Viagem, lesão, motivos pessoais..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
          >
            <Snowflake className="h-4 w-4" />
            {isPending ? 'Congelando...' : 'Confirmar Congelamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
