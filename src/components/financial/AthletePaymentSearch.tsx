import { useState, useMemo } from 'react';
import { Search, X, User, Calendar, DollarSign, Pencil, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Payment, useUpdatePayment, useDeletePayment } from '@/hooks/useClients';
import { toast } from 'sonner';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface AthletePaymentSearchProps {
  payments: (Payment & { client_name?: string })[];
}

export function AthletePaymentSearch({ payments }: AthletePaymentSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Edit state
  const [editingPayment, setEditingPayment] = useState<(Payment & { client_name?: string }) | null>(null);
  const [editForm, setEditForm] = useState({
    amount: '',
    status: 'pending' as 'pending' | 'paid' | 'overdue',
    due_date: '',
    paid_at: '',
    payment_method: '',
    plan_start_date: '',
    plan_end_date: '',
    notes: '',
  });
  
  // Delete state
  const [deletingPayment, setDeletingPayment] = useState<(Payment & { client_name?: string }) | null>(null);
  
  const updatePayment = useUpdatePayment();
  const deletePayment = useDeletePayment();

  const filteredPayments = useMemo(() => {
    if (!searchTerm.trim()) return [];
    
    const term = searchTerm.toLowerCase().trim();
    return payments.filter(payment => 
      payment.client_name?.toLowerCase().includes(term)
    ).sort((a, b) => {
      return new Date(b.due_date).getTime() - new Date(a.due_date).getTime();
    });
  }, [payments, searchTerm]);

  const totalAmount = useMemo(() => {
    return filteredPayments
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + p.amount, 0);
  }, [filteredPayments]);

  const handleClear = () => {
    setSearchTerm('');
    setIsExpanded(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-success/10 text-success border-success/20">Pago</Badge>;
      case 'overdue':
        return <Badge variant="destructive">Vencido</Badge>;
      default:
        return <Badge variant="secondary">Pendente</Badge>;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return '-';
    }
  };

  const formatDateForInput = (dateStr: string | null) => {
    if (!dateStr) return '';
    try {
      return format(parseISO(dateStr), "yyyy-MM-dd");
    } catch {
      return '';
    }
  };

  const handleEditClick = (payment: Payment & { client_name?: string }) => {
    setEditingPayment(payment);
    setEditForm({
      amount: payment.amount.toString(),
      status: payment.status as 'pending' | 'paid' | 'overdue',
      due_date: formatDateForInput(payment.due_date),
      paid_at: formatDateForInput(payment.paid_at),
      payment_method: payment.payment_method || '',
      plan_start_date: formatDateForInput(payment.plan_start_date),
      plan_end_date: formatDateForInput(payment.plan_end_date),
      notes: payment.notes || '',
    });
  };

  const handleEditSave = async () => {
    if (!editingPayment) return;

    try {
      await updatePayment.mutateAsync({
        id: editingPayment.id,
        amount: parseFloat(editForm.amount),
        status: editForm.status,
        due_date: editForm.due_date,
        paid_at: editForm.paid_at || null,
        payment_method: editForm.payment_method || null,
        plan_start_date: editForm.plan_start_date || null,
        plan_end_date: editForm.plan_end_date || null,
        notes: editForm.notes || null,
      });
      toast.success('Entrada atualizada com sucesso!');
      setEditingPayment(null);
    } catch (error) {
      console.error('Erro ao atualizar entrada:', error);
      toast.error('Erro ao atualizar entrada');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingPayment) return;

    try {
      await deletePayment.mutateAsync(deletingPayment.id);
      toast.success('Entrada excluída com sucesso!');
      setDeletingPayment(null);
    } catch (error) {
      console.error('Erro ao excluir entrada:', error);
      toast.error('Erro ao excluir entrada');
    }
  };

  return (
    <>
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            Buscar Entradas por Atleta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Campo de busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Digite o nome do atleta..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (e.target.value.trim()) {
                  setIsExpanded(true);
                }
              }}
              className="pl-9 pr-9"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                onClick={handleClear}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Resultados */}
          {isExpanded && searchTerm.trim() && (
            <div className="space-y-3">
              {filteredPayments.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Nenhuma entrada encontrada para "{searchTerm}"
                </div>
              ) : (
                <>
                  {/* Resumo */}
                  <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{filteredPayments.length} entradas encontradas</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-success" />
                      <span className="font-semibold text-success">
                        R$ {totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-xs text-muted-foreground">pagos</span>
                    </div>
                  </div>

                  {/* Tabela de resultados */}
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="max-h-[400px] overflow-y-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                          <TableRow>
                            <TableHead>Atleta</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Vencimento</TableHead>
                            <TableHead>Pagamento</TableHead>
                            <TableHead>Período do Plano</TableHead>
                            <TableHead className="w-[80px]">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredPayments.map((payment) => (
                            <TableRow key={payment.id}>
                              <TableCell className="font-medium">
                                {payment.client_name || 'Cliente'}
                              </TableCell>
                              <TableCell>
                                <span className="font-semibold">
                                  R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              </TableCell>
                              <TableCell>{getStatusBadge(payment.status)}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {formatDate(payment.due_date)}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {formatDate(payment.paid_at)}
                              </TableCell>
                              <TableCell>
                                {payment.plan_start_date && payment.plan_end_date ? (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Calendar className="h-3 w-3" />
                                    {formatDate(payment.plan_start_date)} - {formatDate(payment.plan_end_date)}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleEditClick(payment)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => setDeletingPayment(payment)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Edição */}
      <Dialog open={!!editingPayment} onOpenChange={(open) => !open && setEditingPayment(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Entrada</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Atleta</Label>
              <Input value={editingPayment?.client_name || ''} disabled />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editForm.amount}
                  onChange={(e) => setEditForm(prev => ({ ...prev, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(value: 'pending' | 'paid' | 'overdue') => 
                    setEditForm(prev => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                    <SelectItem value="overdue">Vencido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data de Vencimento</Label>
                <Input
                  type="date"
                  value={editForm.due_date}
                  onChange={(e) => setEditForm(prev => ({ ...prev, due_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Data de Pagamento</Label>
                <Input
                  type="date"
                  value={editForm.paid_at}
                  onChange={(e) => setEditForm(prev => ({ ...prev, paid_at: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Método de Pagamento</Label>
              <Select
                value={editForm.payment_method}
                onValueChange={(value) => setEditForm(prev => ({ ...prev, payment_method: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                  <SelectItem value="debit_card">Cartão de Débito</SelectItem>
                  <SelectItem value="bank_transfer">Transferência</SelectItem>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Início do Plano</Label>
                <Input
                  type="date"
                  value={editForm.plan_start_date}
                  onChange={(e) => setEditForm(prev => ({ ...prev, plan_start_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Fim do Plano</Label>
                <Input
                  type="date"
                  value={editForm.plan_end_date}
                  onChange={(e) => setEditForm(prev => ({ ...prev, plan_end_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Observações sobre o pagamento..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPayment(null)}>
              Cancelar
            </Button>
            <Button onClick={handleEditSave} disabled={updatePayment.isPending}>
              {updatePayment.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={!!deletingPayment} onOpenChange={(open) => !open && setDeletingPayment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Entrada</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta entrada de{' '}
              <span className="font-semibold">{deletingPayment?.client_name}</span> no valor de{' '}
              <span className="font-semibold">
                R$ {deletingPayment?.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>?
              <br />
              <span className="text-destructive">Esta ação não pode ser desfeita.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePayment.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
