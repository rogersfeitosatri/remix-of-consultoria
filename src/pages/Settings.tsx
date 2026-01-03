import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useClients, usePayments } from '@/hooks/useClients';
import { Settings as SettingsIcon, Download, FileSpreadsheet, Loader2, CheckCircle, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import * as XLSX from 'xlsx';

const CHECKIN_LABELS: Record<string, string> = {
  daily: 'Diário',
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  monthly: 'Mensal',
  bimonthly: 'Bimestral',
  quarterly: 'Trimestral',
};

const PLAN_DURATION_LABELS: Record<string, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
};

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  pix: 'PIX',
  card: 'Cartão de Crédito',
};

export default function Settings() {
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: payments = [], isLoading: paymentsLoading } = usePayments();
  const [isExporting, setIsExporting] = useState(false);

  const isLoading = clientsLoading || paymentsLoading;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return format(parseISO(dateString), 'dd/MM/yyyy');
  };

  const getLastPaymentForClient = (clientId: string) => {
    const clientPayments = payments
      .filter(p => p.client_id === clientId && p.status === 'paid')
      .sort((a, b) => new Date(b.paid_at || b.due_date).getTime() - new Date(a.paid_at || a.due_date).getTime());
    
    return clientPayments[0] || null;
  };

  const handleExportCSV = () => {
    setIsExporting(true);
    
    try {
      const exportData = clients.map(client => {
        const lastPayment = getLastPaymentForClient(client.id);
        
        return {
          'Nome Completo': client.name,
          'E-mail': client.email || '-',
          'Telefone': client.phone || '-',
          'Último Valor Pago': lastPayment ? `R$ ${lastPayment.amount.toFixed(2)}` : '-',
          'Tipo de Pagamento': PAYMENT_TYPE_LABELS[client.payment_type] || client.payment_type || '-',
          'Data do Último Pagamento': lastPayment?.paid_at ? formatDate(lastPayment.paid_at) : '-',
          'Tipo de Plano': PLAN_DURATION_LABELS[client.plan_duration] || client.plan_duration || '-',
          'Data de Início': formatDate(client.start_date),
          'Data de Término': formatDate(client.end_date),
          'Frequência de Check-in': client.has_checkin && client.checkin_frequency 
            ? CHECKIN_LABELS[client.checkin_frequency] 
            : '-',
        };
      });

      // Create CSV content
      const headers = Object.keys(exportData[0] || {});
      const csvContent = [
        headers.join(','),
        ...exportData.map(row => 
          headers.map(header => {
            const value = row[header as keyof typeof row] || '';
            // Escape commas and quotes in CSV
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ].join('\n');

      // Download file
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `atletas_export_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();

      toast.success('Dados exportados com sucesso!');
    } catch (error) {
      toast.error('Erro ao exportar dados');
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportXLSX = () => {
    setIsExporting(true);
    
    try {
      const exportData = clients.map(client => {
        const lastPayment = getLastPaymentForClient(client.id);
        
        return {
          'Nome Completo': client.name,
          'E-mail': client.email || '-',
          'Telefone': client.phone || '-',
          'Último Valor Pago': lastPayment ? lastPayment.amount : '-',
          'Tipo de Pagamento': PAYMENT_TYPE_LABELS[client.payment_type] || client.payment_type || '-',
          'Data do Último Pagamento': lastPayment?.paid_at ? formatDate(lastPayment.paid_at) : '-',
          'Tipo de Plano': PLAN_DURATION_LABELS[client.plan_duration] || client.plan_duration || '-',
          'Data de Início': formatDate(client.start_date),
          'Data de Término': formatDate(client.end_date),
          'Frequência de Check-in': client.has_checkin && client.checkin_frequency 
            ? CHECKIN_LABELS[client.checkin_frequency] 
            : '-',
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Atletas');
      
      // Auto-size columns
      const maxWidth = 30;
      const colWidths = Object.keys(exportData[0] || {}).map(key => ({
        wch: Math.min(maxWidth, Math.max(key.length, ...exportData.map(row => 
          String(row[key as keyof typeof row] || '').length
        )))
      }));
      worksheet['!cols'] = colWidths;

      XLSX.writeFile(workbook, `atletas_export_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);

      toast.success('Dados exportados com sucesso!');
    } catch (error) {
      toast.error('Erro ao exportar dados');
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    try {
      // Template with all fields from the athlete registration form
      const templateData = [
        {
          'Nome Completo': 'João Silva (exemplo)',
          'E-mail': 'joao@email.com',
          'Telefone': '(11) 99999-9999',
          'Valor Pago (R$)': 500,
          'Tipo de Pagamento': 'pix ou card',
          'Data de Pagamento': '15/01/2026',
          'Tipo de Serviço': 'nutrition, training ou both',
          'Tipo de Plano': 'consultoria ou premium',
          'Duração do Plano': 'monthly, quarterly, semiannual ou annual',
          'Possui Check-in': 'sim ou não',
          'Frequência Check-in': 'daily, weekly, biweekly, monthly, bimonthly ou quarterly',
          'Data de Início': '01/01/2026',
          'Data de Término': '01/02/2026',
          'Possui Consultas': 'sim ou não',
          'Quantidade de Consultas': 1,
          'Periodicidade Consultas': 'once, monthly ou six_weeks',
          'Data da 1ª Consulta': '10/01/2026',
          'Atleta Ativo': 'sim ou não',
          'Observações': 'Notas adicionais sobre o atleta',
        }
      ];

      const worksheet = XLSX.utils.json_to_sheet(templateData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Modelo Importação');
      
      // Auto-size columns
      const headers = Object.keys(templateData[0]);
      const colWidths = headers.map(key => ({
        wch: Math.max(key.length + 2, String(templateData[0][key as keyof typeof templateData[0]]).length + 2)
      }));
      worksheet['!cols'] = colWidths;

      // Add instructions sheet
      const instructions = [
        { 'Instruções de Preenchimento': 'IMPORTANTE: Leia antes de preencher' },
        { 'Instruções de Preenchimento': '' },
        { 'Instruções de Preenchimento': 'CAMPOS OBRIGATÓRIOS:' },
        { 'Instruções de Preenchimento': '- Nome Completo' },
        { 'Instruções de Preenchimento': '- Valor Pago (R$)' },
        { 'Instruções de Preenchimento': '- Data de Início' },
        { 'Instruções de Preenchimento': '- Data de Término' },
        { 'Instruções de Preenchimento': '' },
        { 'Instruções de Preenchimento': 'OPÇÕES VÁLIDAS:' },
        { 'Instruções de Preenchimento': '' },
        { 'Instruções de Preenchimento': 'Tipo de Pagamento: pix, card' },
        { 'Instruções de Preenchimento': 'Tipo de Serviço: nutrition (Nutrição), training (Treino), both (Combo)' },
        { 'Instruções de Preenchimento': 'Tipo de Plano: consultoria (sem consultas), premium (com consultas)' },
        { 'Instruções de Preenchimento': 'Duração do Plano: monthly (Mensal), quarterly (Trimestral), semiannual (Semestral), annual (Anual)' },
        { 'Instruções de Preenchimento': 'Frequência Check-in: daily (Diário), weekly (Semanal), biweekly (Quinzenal), monthly (Mensal), bimonthly (Bimestral), quarterly (Trimestral)' },
        { 'Instruções de Preenchimento': 'Periodicidade Consultas: once (1 consulta apenas), monthly (1 a cada mês), six_weeks (1 a cada 6 semanas)' },
        { 'Instruções de Preenchimento': '' },
        { 'Instruções de Preenchimento': 'FORMATO DE DATAS: dd/mm/aaaa (ex: 15/01/2026)' },
        { 'Instruções de Preenchimento': 'CAMPOS SIM/NÃO: Use "sim" ou "não"' },
      ];
      
      const instructionsSheet = XLSX.utils.json_to_sheet(instructions);
      instructionsSheet['!cols'] = [{ wch: 100 }];
      XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instruções');

      XLSX.writeFile(workbook, 'modelo_importacao_atletas.xlsx');

      toast.success('Planilha modelo baixada com sucesso!');
    } catch (error) {
      toast.error('Erro ao baixar planilha modelo');
      console.error('Template download error:', error);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
            <SettingsIcon className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            Configurações
          </h1>
          <p className="mt-1 text-sm sm:text-base text-muted-foreground">
            Gerencie as configurações do sistema
          </p>
        </div>

        {/* Export Card */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Exportar Dados do CRM
            </CardTitle>
            <CardDescription>
              Exporte uma lista completa de todos os atletas cadastrados com suas informações
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-4">
              <h4 className="font-medium text-foreground mb-2">Campos incluídos na exportação:</h4>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  Nome Completo do Atleta
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  E-mail
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  Telefone
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  Último Valor Pago
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  Tipo de Pagamento
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  Data do Último Pagamento
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  Tipo de Plano
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  Data de Início do Plano
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  Data de Término do Plano
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  Frequência de Check-in
                </li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={handleExportCSV} 
                disabled={isExporting || clients.length === 0}
                className="gap-2"
                variant="outline"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Exportar CSV
              </Button>
              <Button 
                onClick={handleExportXLSX} 
                disabled={isExporting || clients.length === 0}
                className="gap-2"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" />
                )}
                Exportar Excel (.xlsx)
              </Button>
            </div>

            {clients.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum atleta cadastrado para exportar.
              </p>
            )}

            {clients.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Total de {clients.length} atleta{clients.length !== 1 ? 's' : ''} será{clients.length !== 1 ? 'ão' : ''} exportado{clients.length !== 1 ? 's' : ''}.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Template Download Card */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileDown className="h-5 w-5 text-primary" />
              Planilha Modelo para Importação
            </CardTitle>
            <CardDescription>
              Baixe uma planilha modelo Excel para preencher e importar dados de atletas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-4">
              <h4 className="font-medium text-foreground mb-2">Campos incluídos no modelo:</h4>
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  Nome Completo
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  E-mail
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  Telefone
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  Valor Pago (R$)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  Tipo de Pagamento
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  Data de Pagamento
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  Tipo de Serviço
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  Tipo de Plano
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  Duração do Plano
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  Possui Check-in
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  Frequência Check-in
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  Data de Início
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  Data de Término
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  Possui Consultas
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  Qtd. de Consultas
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  Periodicidade Consultas
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  Data da 1ª Consulta
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  Atleta Ativo
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  Observações
                </li>
              </ul>
            </div>

            <Button 
              onClick={handleDownloadTemplate} 
              className="gap-2"
              variant="outline"
            >
              <FileDown className="h-4 w-4" />
              Baixar Planilha Modelo (.xlsx)
            </Button>

            <p className="text-sm text-muted-foreground">
              A planilha inclui uma aba com instruções detalhadas de preenchimento.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
