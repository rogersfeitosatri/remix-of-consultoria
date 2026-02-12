import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { Client } from '@/hooks/useClients';
import { AthleteWithTargetRaceAlert } from '@/hooks/useTargetRaceAlert';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface ExportClientsButtonProps {
  clients: Client[];
  targetRaceAlerts?: AthleteWithTargetRaceAlert[];
  filename?: string;
}

const SERVICE_LABELS: Record<string, string> = {
  nutrition: 'Nutrição',
  training: 'Treino',
  both: 'Ambos',
};

const PLAN_LABELS: Record<string, string> = {
  consultoria: 'Consultoria',
  premium: 'Premium',
};

const CHECKIN_LABELS: Record<string, string> = {
  daily: 'Diário',
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  monthly: 'Mensal',
  bimonthly: 'Bimestral',
  quarterly: 'Trimestral',
};

export function ExportClientsButton({ clients, targetRaceAlerts = [], filename = 'atletas' }: ExportClientsButtonProps) {
  const [exporting, setExporting] = useState(false);

  const prepareData = () => {
    return clients.map(client => {
      const raceAlert = targetRaceAlerts.find(a => a.clientId === client.id);
      
      return {
        'Nome': client.name,
        'Email': client.email || '',
        'Telefone': client.phone || '',
        'Plano': PLAN_LABELS[client.plan_type] || client.plan_type,
        'Serviço': SERVICE_LABELS[client.service_type] || client.service_type,
        'Valor Mensal': `R$ ${client.monthly_value.toFixed(2)}`,
        'Início': format(new Date(client.start_date), 'dd/MM/yyyy', { locale: ptBR }),
        'Término': format(new Date(client.end_date), 'dd/MM/yyyy', { locale: ptBR }),
        'Check-in': client.has_checkin ? (CHECKIN_LABELS[client.checkin_frequency || ''] || 'Sim') : 'Não',
        'Status': client.is_active ? 'Ativo' : 'Inativo',
        'Prova Alvo': raceAlert?.targetRace || '',
        'Data Prova': raceAlert?.targetDeadline ? format(new Date(raceAlert.targetDeadline), 'dd/MM/yyyy', { locale: ptBR }) : '',
        'Dias até Prova': raceAlert?.daysToRace !== null && raceAlert?.daysToRace !== undefined ? raceAlert.daysToRace : '',
      };
    });
  };

  const exportToExcel = async () => {
    setExporting(true);
    try {
      const data = prepareData();
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Atletas');
      
      // Auto-size columns
      const colWidths = Object.keys(data[0] || {}).map(key => ({
        wch: Math.max(key.length, ...data.map(row => String(row[key as keyof typeof row] || '').length)) + 2
      }));
      worksheet['!cols'] = colWidths;

      const dateStr = format(new Date(), 'yyyy-MM-dd_HH-mm');
      XLSX.writeFile(workbook, `${filename}_${dateStr}.xlsx`);
      toast.success('Exportação concluída!');
    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
      toast.error('Erro ao exportar para Excel');
    } finally {
      setExporting(false);
    }
  };

  const exportToPDF = async () => {
    setExporting(true);
    try {
      const data = prepareData();
      
      // Create a printable HTML table
      const tableRows = data.map(row => `
        <tr>
          <td>${row['Nome']}</td>
          <td>${row['Telefone']}</td>
          <td>${row['Plano']}</td>
          <td>${row['Serviço']}</td>
          <td>${row['Valor Mensal']}</td>
          <td>${row['Término']}</td>
          <td>${row['Status']}</td>
          <td>${row['Prova Alvo']}</td>
          <td>${row['Dias até Prova']}</td>
        </tr>
      `).join('');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Lista de Atletas</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #333; margin-bottom: 5px; }
            .subtitle { color: #666; margin-bottom: 20px; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f4f4f4; font-weight: bold; }
            tr:nth-child(even) { background-color: #fafafa; }
            .footer { margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <h1>Lista de Atletas</h1>
          <p class="subtitle">Exportado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} • ${data.length} atleta(s)</p>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Telefone</th>
                <th>Plano</th>
                <th>Serviço</th>
                <th>Valor</th>
                <th>Término</th>
                <th>Status</th>
                <th>Prova Alvo</th>
                <th>Dias</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          <p class="footer">Rogers Feitosa - Nutrição & Treinamento</p>
        </body>
        </html>
      `;

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.onload = () => {
          printWindow.print();
        };
        toast.success('PDF pronto para impressão!');
      } else {
        toast.error('Popup bloqueado. Permita popups para exportar PDF.');
      }
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast.error('Erro ao exportar para PDF');
    } finally {
      setExporting(false);
    }
  };

  if (clients.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={exporting} className="gap-2">
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportToExcel} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="h-4 w-4 text-primary" />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToPDF} className="gap-2 cursor-pointer">
          <FileText className="h-4 w-4 text-destructive" />
          PDF (Impressão)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
