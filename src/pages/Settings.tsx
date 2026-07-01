import { useState, useRef } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useClients, usePayments, useAddClient, Client } from '@/hooks/useClients';
import { Settings as SettingsIcon, Download, FileSpreadsheet, Loader2, CheckCircle, FileDown, Upload, AlertCircle, Users, Lock, ExternalLink, Palette, Flag, PhoneCall, Link as LinkIcon, Activity, Network, CalendarPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { format, parseISO, parse, isValid, addMonths } from 'date-fns';
import * as XLSX from 'xlsx';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAdminSettings, useSaveAdminSettings } from '@/hooks/useAdminSettings';
import { ChangePasswordForm } from '@/components/athlete/ChangePasswordForm';
import { MessageTemplatesSection } from '@/components/settings/MessageTemplatesSection';
import { LandingPageSettingsSection } from '@/components/settings/LandingPageSettingsSection';
import { LayoutCustomizationSection } from '@/components/settings/LayoutCustomizationSection';
import { ScanAnamneseTargetRaces } from '@/components/admin/ScanAnamneseTargetRaces';
import { PlanTemplatesSection } from '@/components/settings/PlanTemplatesSection';
import { OnboardingSettingsSection } from '@/components/settings/OnboardingSettingsSection';
import { AiWhatsAppAssistantSection } from '@/components/settings/AiWhatsAppAssistantSection';
import { NotificationsSettingsSection } from '@/components/settings/NotificationsSettingsSection';
import { Bell } from 'lucide-react';
import { Bot } from 'lucide-react';

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
  const navigate = useNavigate();
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: payments = [], isLoading: paymentsLoading } = usePayments();
  const { data: adminSettings } = useAdminSettings();
  const saveAdminSettings = useSaveAdminSettings();
  const addClient = useAddClient();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLoading = clientsLoading || paymentsLoading;

  const handleToggleContinuationMode = async (enabled: boolean) => {
    try {
      await saveAdminSettings.mutateAsync({ enable_continuation_mode: enabled });
      toast.success(enabled ? 'Modo de continuação ativado' : 'Modo de continuação desativado');
    } catch (error) {
      toast.error('Erro ao salvar configuração');
    }
  };

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
        { 'Instruções de Preenchimento': 'FORMATO DE DATAS: dd/mm/yyyy (ex: 15/01/2026)' },
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

  // Parse date from dd/mm/yyyy format
  const parseDateBR = (dateStr: string | number | null | undefined): string | null => {
    if (!dateStr) return null;
    
    // If it's an Excel serial date number
    if (typeof dateStr === 'number') {
      // Excel serial date to JS Date
      const excelDate = new Date((dateStr - 25569) * 86400 * 1000);
      if (isValid(excelDate)) {
        return format(excelDate, 'yyyy-MM-dd');
      }
      return null;
    }
    
    const str = String(dateStr).trim();
    if (!str) return null;
    
    // Try dd/mm/yyyy format
    const parsed = parse(str, 'dd/MM/yyyy', new Date());
    if (isValid(parsed)) {
      return format(parsed, 'yyyy-MM-dd');
    }
    
    // Try yyyy-mm-dd format
    const parsedISO = parseISO(str);
    if (isValid(parsedISO)) {
      return format(parsedISO, 'yyyy-MM-dd');
    }
    
    return null;
  };

  // Calculate end date based on start date and plan duration
  const calculateEndDate = (startDate: string, planDuration: string): string => {
    const start = parseISO(startDate);
    const monthsToAdd = {
      monthly: 1,
      quarterly: 3,
      semiannual: 6,
      annual: 12,
    }[planDuration] || 1;
    
    return format(addMonths(start, monthsToAdd), 'yyyy-MM-dd');
  };

  // Parse boolean values from sim/não
  const parseBoolean = (value: string | number | null | undefined): boolean => {
    if (!value) return false;
    const str = String(value).toLowerCase().trim();
    return str === 'sim' || str === 'true' || str === '1' || str === 'yes';
  };

  // Validate and parse a single row
  const parseRow = (row: Record<string, unknown>, rowIndex: number): { data: Omit<Client, 'id' | 'user_id' | 'created_at' | 'updated_at'> | null; errors: string[] } => {
    const errors: string[] = [];
    const rowNum = rowIndex + 2; // +2 because Excel starts at 1 and has header

    // Required fields
    const name = String(row['Nome Completo'] || '').trim();
    if (!name || name === '(exemplo)' || name.includes('(exemplo)')) {
      errors.push(`Linha ${rowNum}: Nome é obrigatório`);
    }

    const monthlyValue = Number(row['Valor Pago (R$)']) || 0;
    if (monthlyValue <= 0) {
      errors.push(`Linha ${rowNum}: Valor Pago deve ser maior que zero`);
    }

    const startDate = parseDateBR(row['Data de Início'] as string | number);
    if (!startDate) {
      errors.push(`Linha ${rowNum}: Data de Início inválida ou não informada`);
    }

    // Optional: end date - if not provided, calculate from plan duration
    let endDate = parseDateBR(row['Data de Término'] as string | number);

    // Service type mapping
    const serviceTypeRaw = String(row['Tipo de Serviço'] || 'both').toLowerCase().trim();
    const serviceTypeMap: Record<string, 'nutrition' | 'training' | 'both'> = {
      'nutrition': 'nutrition',
      'nutrição': 'nutrition',
      'training': 'training',
      'treino': 'training',
      'both': 'both',
      'combo': 'both',
    };
    const serviceType = serviceTypeMap[serviceTypeRaw] || 'both';

    // Plan type mapping
    const planTypeRaw = String(row['Tipo de Plano'] || 'consultoria').toLowerCase().trim();
    const planTypeMap: Record<string, 'consultoria' | 'premium'> = {
      'consultoria': 'consultoria',
      'premium': 'premium',
    };
    const planType = planTypeMap[planTypeRaw] || 'consultoria';

    // Plan duration mapping
    const planDurationRaw = String(row['Duração do Plano'] || 'monthly').toLowerCase().trim();
    const planDurationMap: Record<string, 'monthly' | 'quarterly' | 'semiannual' | 'annual'> = {
      'monthly': 'monthly',
      'mensal': 'monthly',
      'quarterly': 'quarterly',
      'trimestral': 'quarterly',
      'semiannual': 'semiannual',
      'semestral': 'semiannual',
      'annual': 'annual',
      'anual': 'annual',
    };
    const planDuration = planDurationMap[planDurationRaw] || 'monthly';

    // Calculate end date if not provided
    if (!endDate && startDate) {
      endDate = calculateEndDate(startDate, planDuration);
    }

    // Payment type mapping
    const paymentTypeRaw = String(row['Tipo de Pagamento'] || 'pix').toLowerCase().trim();
    const paymentTypeMap: Record<string, 'pix' | 'card'> = {
      'pix': 'pix',
      'card': 'card',
      'cartão': 'card',
      'cartao': 'card',
      'cartão de crédito': 'card',
      'cartao de credito': 'card',
    };
    const paymentType = paymentTypeMap[paymentTypeRaw] || 'pix';

    // Check-in frequency mapping
    const hasCheckin = parseBoolean(row['Possui Check-in'] as string | number | null | undefined);
    const checkinFrequencyRaw = String(row['Frequência Check-in'] || '').toLowerCase().trim();
    const checkinFrequencyMap: Record<string, 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'quarterly'> = {
      'daily': 'daily',
      'diário': 'daily',
      'diario': 'daily',
      'weekly': 'weekly',
      'semanal': 'weekly',
      'biweekly': 'biweekly',
      'quinzenal': 'biweekly',
      'monthly': 'monthly',
      'mensal': 'monthly',
      'bimonthly': 'bimonthly',
      'bimestral': 'bimonthly',
      'quarterly': 'quarterly',
      'trimestral': 'quarterly',
    };
    const checkinFrequency = hasCheckin ? (checkinFrequencyMap[checkinFrequencyRaw] || 'weekly') : null;

    // Consultation frequency mapping
    const hasConsultations = parseBoolean(row['Possui Consultas'] as string | number | null | undefined);
    const consultationFrequencyRaw = String(row['Periodicidade Consultas'] || '').toLowerCase().trim();
    const consultationFrequencyMap: Record<string, 'once' | 'monthly' | 'six_weeks'> = {
      'once': 'once',
      'única': 'once',
      'unica': 'once',
      'monthly': 'monthly',
      'mensal': 'monthly',
      'six_weeks': 'six_weeks',
      '6 semanas': 'six_weeks',
    };
    const consultationFrequency = hasConsultations ? (consultationFrequencyMap[consultationFrequencyRaw] || 'monthly') : null;

    const consultationCount = Number(row['Quantidade de Consultas']) || (hasConsultations ? 1 : 0);
    const firstConsultationDate = hasConsultations ? parseDateBR(row['Data da 1ª Consulta'] as string | number | null | undefined) : null;
    const paymentDate = parseDateBR(row['Data de Pagamento'] as string | number | null | undefined);

    if (errors.length > 0) {
      return { data: null, errors };
    }

    return {
      data: {
        name,
        email: String(row['E-mail'] || '').trim() || null,
        phone: String(row['Telefone'] || '').trim() || null,
        monthly_value: monthlyValue,
        payment_type: paymentType,
        payment_date: paymentDate,
        service_type: serviceType,
        plan_type: planType,
        plan_duration: planDuration,
        has_checkin: hasCheckin,
        checkin_frequency: checkinFrequency,
        start_date: startDate!,
        end_date: endDate!,
        has_consultations: hasConsultations,
        consultation_count: consultationCount,
        consultation_frequency: consultationFrequency,
        first_consultation_date: firstConsultationDate,
        is_active: parseBoolean(row['Atleta Ativo'] as string | number | null | undefined) !== false,
        notes: String(row['Observações'] || '').trim() || null,
        athlete_status: 'active' as const,
        registration_source: 'manual' as const,
        has_agenda_access: planType === 'premium',
        // Migration fields (default to new for imports)
        onboarding_type: 'new' as const,
        remaining_consultations: null,
        last_consultation_at: null,
        last_consultation_index: null,
        athlete_user_id: null,
        is_frozen: false,
        frozen_at: null,
        total_frozen_days: 0,
      },
      errors: [],
    };
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportErrors([]);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      
      // Get the first sheet (ignore instructions sheet)
      const sheetName = workbook.SheetNames.find(name => 
        !name.toLowerCase().includes('instrução') && 
        !name.toLowerCase().includes('instrucao') &&
        !name.toLowerCase().includes('instruções') &&
        !name.toLowerCase().includes('instrucoes')
      ) || workbook.SheetNames[0];
      
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

      if (jsonData.length === 0) {
        toast.error('A planilha está vazia');
        setIsImporting(false);
        return;
      }

      const allErrors: string[] = [];
      const validClients: Omit<Client, 'id' | 'user_id' | 'created_at' | 'updated_at'>[] = [];

      // Parse all rows
      jsonData.forEach((row, index) => {
        // Skip example row
        const nameValue = String(row['Nome Completo'] || '');
        if (nameValue.includes('exemplo') || nameValue.includes('(exemplo)')) {
          return;
        }

        const { data, errors } = parseRow(row, index);
        if (errors.length > 0) {
          allErrors.push(...errors);
        } else if (data) {
          validClients.push(data);
        }
      });

      if (allErrors.length > 0) {
        setImportErrors(allErrors);
        toast.error(`Foram encontrados ${allErrors.length} erro(s) na planilha`);
        setIsImporting(false);
        return;
      }

      if (validClients.length === 0) {
        toast.error('Nenhum atleta válido encontrado na planilha');
        setIsImporting(false);
        return;
      }

      // Import all valid clients
      let successCount = 0;
      const importErrors: string[] = [];

      for (const clientData of validClients) {
        try {
          await addClient.mutateAsync(clientData);
          successCount++;
        } catch (error) {
          importErrors.push(`Erro ao importar ${clientData.name}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        }
      }

      if (importErrors.length > 0) {
        setImportErrors(importErrors);
      }

      if (successCount > 0) {
        toast.success(`${successCount} atleta(s) importado(s) com sucesso!`);
      }

    } catch (error) {
      console.error('Import error:', error);
      toast.error('Erro ao processar a planilha');
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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

        {/* Accordion for all sections */}
        <Accordion type="single" collapsible className="space-y-4">
          {/* Layout Customization - First item */}
          <AccordionItem value="layout" className="border border-border rounded-lg bg-card px-4">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2 text-left">
                <Palette className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <div className="font-semibold">Personalização do Layout</div>
                  <div className="text-sm text-muted-foreground font-normal">
                    Reordene o menu, oculte abas, renomeie títulos e altere logo/avatar
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <LayoutCustomizationSection />
            </AccordionContent>
          </AccordionItem>

          {/* Notificações */}
          <AccordionItem value="notifications" className="border border-border rounded-lg bg-card px-4">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2 text-left">
                <Bell className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <div className="font-semibold">Notificações</div>
                  <div className="text-sm text-muted-foreground font-normal">
                    Escolha quais eventos você quer receber (anamnese, check-in, ajustes do mês…)
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <NotificationsSettingsSection />
            </AccordionContent>
          </AccordionItem>

          {/* IA WhatsApp Assistente */}
          <AccordionItem value="ai-whatsapp" className="border border-border rounded-lg bg-card px-4">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2 text-left">
                <Bot className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <div className="font-semibold">IA Assistente WhatsApp</div>
                  <div className="text-sm text-muted-foreground font-normal">
                    Atendimento automático aos atletas via WhatsApp com base no plano deles
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <AiWhatsAppAssistantSection />
            </AccordionContent>
          </AccordionItem>

          {/* Export Card */}
          <AccordionItem value="export" className="border border-border rounded-lg bg-card px-4">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2 text-left">
                <FileSpreadsheet className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <div className="font-semibold">Exportar Dados do CRM</div>
                  <div className="text-sm text-muted-foreground font-normal">
                    Exporte uma lista completa de todos os atletas cadastrados
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="space-y-4">
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
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Template Download */}
          <AccordionItem value="template" className="border border-border rounded-lg bg-card px-4">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2 text-left">
                <FileDown className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <div className="font-semibold">Planilha Modelo para Importação</div>
                  <div className="text-sm text-muted-foreground font-normal">
                    Baixe uma planilha modelo Excel para preencher e importar dados de atletas
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="space-y-4">
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
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Import Athletes */}
          <AccordionItem value="import" className="border border-border rounded-lg bg-card px-4">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2 text-left">
                <Upload className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <div className="font-semibold">Importar Atletas</div>
                  <div className="text-sm text-muted-foreground font-normal">
                    Importe atletas em massa usando a planilha modelo preenchida
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="space-y-4">
                <div className="rounded-lg bg-muted/50 p-4">
                  <h4 className="font-medium text-foreground mb-2">Como importar:</h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Baixe a planilha modelo acima</li>
                    <li>Preencha os dados dos atletas seguindo as instruções</li>
                    <li>Salve o arquivo e faça o upload abaixo</li>
                  </ol>
                </div>

                {importErrors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="font-medium mb-2">Erros encontrados na planilha:</div>
                      <ul className="list-disc list-inside space-y-1 text-sm max-h-40 overflow-y-auto">
                        {importErrors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImportFile}
                  accept=".xlsx,.xls"
                  className="hidden"
                />

                <Button 
                  onClick={() => fileInputRef.current?.click()} 
                  disabled={isImporting}
                  className="gap-2"
                >
                  {isImporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {isImporting ? 'Importando...' : 'Selecionar Planilha para Importar'}
                </Button>

                <p className="text-sm text-muted-foreground">
                  Formatos aceitos: .xlsx, .xls
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Scan Anamnese Target Races */}
          <AccordionItem value="scan-races" className="border border-border rounded-lg bg-card px-4">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2 text-left">
                <Flag className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <div className="font-semibold">Varredura de Provas Alvo</div>
                  <div className="text-sm text-muted-foreground font-normal">
                    Escaneia anamneses preenchidas e preenche automaticamente a prova alvo dos atletas
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <ScanAnamneseTargetRaces />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="backup" className="border border-primary/30 rounded-lg bg-card px-4">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2 text-left">
                <FileDown className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <div className="font-semibold">Backup Completo do Sistema</div>
                  <div className="text-sm text-muted-foreground font-normal">
                    Exporte todos os dados do sistema para backup
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="space-y-4">
                <div className="rounded-lg bg-muted/50 p-4">
                  <h4 className="font-medium text-foreground mb-2">Dados incluídos no backup:</h4>
                  <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      Atletas
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      Pagamentos
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      Perfis de Atleta
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      Check-ins
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      Anamneses
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      Agendamentos
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      Consultas
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      Materiais de Suporte
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      Contas a Pagar
                    </li>
                  </ul>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button 
                    onClick={async () => {
                      try {
                        const { exportFullBackup } = await import('@/hooks/useBackup');
                        await exportFullBackup();
                        toast.success('Backup exportado com sucesso!');
                      } catch (error) {
                        toast.error('Erro ao exportar backup');
                        console.error(error);
                      }
                    }}
                    className="gap-2"
                  >
                    <FileDown className="h-4 w-4" />
                    Baixar Backup Completo
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Migration Mode Toggle */}
          <AccordionItem value="migration" className="border border-border rounded-lg bg-card px-4">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2 text-left">
                <Users className="h-5 w-5 text-amber-500 shrink-0" />
                <div>
                  <div className="font-semibold">Modo de Migração</div>
                  <div className="text-sm text-muted-foreground font-normal">
                    Configuração temporária para atletas em continuação
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="space-y-4">
                <Alert className="border-amber-500/30 bg-amber-500/5">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <AlertDescription>
                    <strong>Funcionalidade temporária:</strong> Use para migrar atletas que já estavam em acompanhamento. 
                    Quando desativado, a opção "Continuação" não aparece mais no cadastro.
                  </AlertDescription>
                </Alert>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label htmlFor="continuationMode" className="font-medium">
                      Habilitar modo de continuação
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Permite cadastrar atletas como "Continuação (migração)" no formulário
                    </p>
                  </div>
                  <Switch
                    id="continuationMode"
                    checked={adminSettings?.enable_continuation_mode ?? true}
                    onCheckedChange={handleToggleContinuationMode}
                    disabled={saveAdminSettings.isPending}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Restore Backup Card */}
          <AccordionItem value="restore" className="border border-border rounded-lg bg-card px-4">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2 text-left">
                <Upload className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <div className="font-semibold">Restaurar Backup</div>
                  <div className="text-sm text-muted-foreground font-normal">
                    Restaure dados a partir de um arquivo de backup (.xlsx)
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Atenção:</strong> Esta função irá adicionar novos registros ao sistema. 
                    Dados existentes não serão sobrescritos. Use com cuidado.
                  </AlertDescription>
                </Alert>

                <input
                  type="file"
                  id="backup-file-input"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    
                    try {
                      const { importFullBackup } = await import('@/hooks/useBackup');
                      const results = await importFullBackup(file);
                      const totalImported = results.reduce((sum, r) => sum + r.count, 0);
                      toast.success(`Backup restaurado! ${totalImported} registros importados.`);
                    } catch (error) {
                      toast.error('Erro ao restaurar backup');
                      console.error(error);
                    } finally {
                      e.target.value = '';
                    }
                  }}
                  accept=".xlsx"
                  className="hidden"
                />

                <Button 
                  variant="outline"
                  onClick={() => document.getElementById('backup-file-input')?.click()}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Selecionar Arquivo de Backup
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>


          {/* Landing Page Plans */}
          <AccordionItem value="landing-plans" className="border border-border rounded-lg bg-card px-4">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2 text-left">
                <ExternalLink className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <div className="font-semibold">Landing Page - Plans</div>
                  <div className="text-sm text-muted-foreground font-normal">
                    Configure os links dos botões de WhatsApp da página /plans
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <LandingPageSettingsSection />
            </AccordionContent>
          </AccordionItem>

          {/* Onboarding · Mercado Pago */}
          <AccordionItem value="onboarding-mp" className="border border-border rounded-lg bg-card px-4">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2 text-left">
                <SettingsIcon className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <div className="font-semibold">Onboarding · Mercado Pago</div>
                  <div className="text-sm text-muted-foreground font-normal">
                    Planos, links de pagamento e configurações do novo fluxo de novos atletas
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <OnboardingSettingsSection />
            </AccordionContent>
          </AccordionItem>

          {/* Change Password */}
          <AccordionItem value="password" className="border border-border rounded-lg bg-card px-4">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2 text-left">
                <Lock className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <div className="font-semibold">Alterar Senha</div>
                  <div className="text-sm text-muted-foreground font-normal">
                    Atualize sua senha de acesso ao sistema
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <ChangePasswordForm />
            </AccordionContent>
          </AccordionItem>
          {/* Strategic Calls */}
          <AccordionItem value="calls" className="border border-border rounded-lg bg-card px-4">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2 text-left">
                <PhoneCall className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <div className="font-semibold">Calls Estratégicas</div>
                  <div className="text-sm text-muted-foreground font-normal">
                    Gerencie formulários de call e links de agendamento
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => navigate('/calls')} variant="outline" className="gap-2">
                  <PhoneCall className="h-4 w-4" />
                  Formulários de Call
                </Button>
                <Button onClick={() => navigate('/scheduling-links')} variant="outline" className="gap-2">
                  <CalendarPlus className="h-4 w-4" />
                  Agendamento de Call
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Link da Bio */}
          <AccordionItem value="link-bio" className="border border-border rounded-lg bg-card px-4">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2 text-left">
                <LinkIcon className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <div className="font-semibold">Link da Bio</div>
                  <div className="text-sm text-muted-foreground font-normal">
                    Configure sua página de links públicos
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <Button onClick={() => navigate('/link-bio')} variant="outline" className="gap-2">
                <LinkIcon className="h-4 w-4" />
                Gerenciar Link da Bio
              </Button>
            </AccordionContent>
          </AccordionItem>

          {/* Periodização */}
          <AccordionItem value="periodization" className="border border-border rounded-lg bg-card px-4">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2 text-left">
                <Activity className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <div className="font-semibold">Periodização Nutricional</div>
                  <div className="text-sm text-muted-foreground font-normal">
                    Planejamento e controle de periodização dos atletas
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <Button onClick={() => navigate('/periodization')} variant="outline" className="gap-2">
                <Activity className="h-4 w-4" />
                Acessar Periodização
              </Button>
            </AccordionContent>
          </AccordionItem>

          {/* Interconexão Metabólica */}
          <AccordionItem value="metabolic" className="border border-border rounded-lg bg-card px-4">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2 text-left">
                <Network className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <div className="font-semibold">Interconexão Metabólica</div>
                  <div className="text-sm text-muted-foreground font-normal">
                    Análise de interconexão metabólica dos atletas
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <Button onClick={() => navigate('/metabolic-web')} variant="outline" className="gap-2">
                <Network className="h-4 w-4" />
                Acessar Interconexão Metabólica
              </Button>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </Layout>
  );
}
