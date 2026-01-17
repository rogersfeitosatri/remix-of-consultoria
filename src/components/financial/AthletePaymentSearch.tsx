import { useState, useMemo } from 'react';
import { Search, X, User, Calendar, CreditCard, DollarSign } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Payment } from '@/hooks/useClients';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface AthletePaymentSearchProps {
  payments: (Payment & { client_name?: string })[];
}

export function AthletePaymentSearch({ payments }: AthletePaymentSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const filteredPayments = useMemo(() => {
    if (!searchTerm.trim()) return [];
    
    const term = searchTerm.toLowerCase().trim();
    return payments.filter(payment => 
      payment.client_name?.toLowerCase().includes(term)
    ).sort((a, b) => {
      // Ordenar por data de vencimento (mais recente primeiro)
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

  return (
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
  );
}
