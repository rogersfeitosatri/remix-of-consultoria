import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Check, ChevronsUpDown, Calendar, User, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Client } from '@/hooks/useClients';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: 'PIX',
  card: 'Cartão',
  transfer: 'Transferência',
  cash: 'Dinheiro',
};

interface AddPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  onSubmit: (data: {
    client_id: string;
    amount: number;
    payment_method: string;
    payment_date: string;
    notes?: string;
    plan_start_date?: string;
    plan_end_date?: string;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

export function AddPaymentDialog({
  open,
  onOpenChange,
  clients,
  onSubmit,
  isSubmitting = false,
}: AddPaymentDialogProps) {
  const [clientOpen, setClientOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedClient(null);
      setAmount('');
      setPaymentMethod('pix');
      setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
      setNotes('');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !amount) return;

    await onSubmit({
      client_id: selectedClient.id,
      amount: parseFloat(amount),
      payment_method: paymentMethod,
      payment_date: paymentDate,
      notes: notes || undefined,
      plan_start_date: selectedClient.start_date,
      plan_end_date: selectedClient.end_date,
    });

    onOpenChange(false);
  };

  // Sort clients by name
  const sortedClients = [...clients].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Registrar Entrada</DialogTitle>
          <DialogDescription>
            Registre um novo pagamento recebido de um atleta.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Client Selection */}
          <div className="space-y-2">
            <Label>Atleta *</Label>
            <Popover open={clientOpen} onOpenChange={setClientOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={clientOpen}
                  className="w-full justify-between"
                >
                  {selectedClient ? (
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {selectedClient.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Selecionar atleta...</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0">
                <Command>
                  <CommandInput placeholder="Buscar atleta..." />
                  <CommandList>
                    <CommandEmpty>Nenhum atleta encontrado.</CommandEmpty>
                    <CommandGroup>
                      {sortedClients.map((client) => (
                        <CommandItem
                          key={client.id}
                          value={`${client.name} ${client.email || ''}`}
                          onSelect={() => {
                            setSelectedClient(client);
                            setClientOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              selectedClient?.id === client.id ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{client.name}</span>
                            {client.email && (
                              <span className="text-xs text-muted-foreground">{client.email}</span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Plan info (read-only reference) */}
          {selectedClient && (
            <div className="p-3 bg-muted/50 rounded-lg space-y-1 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Período do plano:</span>
              </div>
              <p className="font-medium text-foreground">
                {format(parseISO(selectedClient.start_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} - {format(parseISO(selectedClient.end_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
          )}

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Valor (R$) *</Label>
            <Input
              id="amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              required
            />
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label>Forma de Pagamento *</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment Date */}
          <div className="space-y-2">
            <Label htmlFor="paymentDate">Data do Pagamento *</Label>
            <Input
              id="paymentDate"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações sobre o pagamento..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!selectedClient || !amount || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Registrar Entrada'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
