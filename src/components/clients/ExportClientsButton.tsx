import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, FileSpreadsheet, FileText, Loader2, Search, CheckSquare, Square } from 'lucide-react';
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
  const [showSelector, setShowSelector] = useState(false);
  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf'>('excel');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectorSearch, setSelectorSearch] = useState('');

  const filteredSelectorClients = clients.filter(c =>
    c.name.toLowerCase().includes(selectorSearch.toLowerCase()) ||
    c.email?.toLowerCase().includes(selectorSearch.toLowerCase())
  );

  const toggleAll = () => {
    if (selectedIds.size === filteredSelectorClients.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSelectorClients.map(c => c.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const openSelector = (fmt: 'excel' | 'pdf') => {
    setExportFormat(fmt);
    setSelectedIds(new Set(clients.map(c => c.id)));
    setSelectorSearch('');
    setShowSelector(true);
  };

  const prepareData = (list: Client[]) => {
    return list.map(client => {
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

  const handleExport = async () => {
    const selected = clients.filter(c => selectedIds.has(c.id));
    if (selected.length === 0) {
      toast.error('Selecione ao menos um atleta');
      return;
    }
    setShowSelector(false);
    setExporting(true);
    try {
      if (exportFormat === 'excel') {
        await doExportExcel(selected);
      } else {
        await doExportPDF(selected);
      }
    } finally {
      setExporting(false);
    }
  };

  const doExportExcel = async (list: Client[]) => {
    try {
      const data = prepareData(list);
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Atletas');
      const colWidths = Object.keys(data[0] || {}).map(key => ({
        wch: Math.max(key.length, ...data.map(row => String(row[key as keyof typeof row] || '').length)) + 2
      }));
      worksheet['!cols'] = colWidths;
      const dateStr = format(new Date(), 'yyyy-MM-dd_HH-mm');
      XLSX.writeFile(workbook, `${filename}_${dateStr}.xlsx`);
      toast.success(`${list.length} atleta(s) exportado(s)!`);
    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
      toast.error('Erro ao exportar para Excel');
    }
  };

  const doExportPDF = async (list: Client[]) => {
    try {
      const data = prepareData(list);
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
                <th>Nome</th><th>Telefone</th><th>Plano</th><th>Serviço</th>
                <th>Valor</th><th>Término</th><th>Status</th><th>Prova Alvo</th><th>Dias</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
          <p class="footer">Rogers Feitosa - Nutrição & Treinamento</p>
        </body>
        </html>
      `;
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.onload = () => printWindow.print();
        toast.success('PDF pronto para impressão!');
      } else {
        toast.error('Popup bloqueado. Permita popups para exportar PDF.');
      }
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast.error('Erro ao exportar para PDF');
    }
  };

  if (clients.length === 0) return null;

  const allSelected = filteredSelectorClients.length > 0 && selectedIds.size === filteredSelectorClients.length;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={exporting} className="gap-2">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Exportar
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => openSelector('excel')} className="gap-2 cursor-pointer">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
            Excel (.xlsx)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openSelector('pdf')} className="gap-2 cursor-pointer">
            <FileText className="h-4 w-4 text-destructive" />
            PDF (Impressão)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showSelector} onOpenChange={setShowSelector}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              Selecionar atletas para exportar
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar atleta..."
                value={selectorSearch}
                onChange={e => setSelectorSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            <div className="flex items-center justify-between px-1">
              <button
                onClick={toggleAll}
                className="text-xs text-primary hover:underline flex items-center gap-1.5"
              >
                {allSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
              <span className="text-xs text-muted-foreground">
                {selectedIds.size} de {clients.length}
              </span>
            </div>

            <ScrollArea className="h-[280px] rounded-md border">
              <div className="p-2 space-y-0.5">
                {filteredSelectorClients.map(c => (
                  <label
                    key={c.id}
                    className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-accent/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selectedIds.has(c.id)}
                      onCheckedChange={() => toggleOne(c.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {PLAN_LABELS[c.plan_type] || c.plan_type} • {SERVICE_LABELS[c.service_type] || c.service_type}
                      </p>
                    </div>
                  </label>
                ))}
                {filteredSelectorClients.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum atleta encontrado</p>
                )}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" size="sm" onClick={() => setShowSelector(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleExport} disabled={selectedIds.size === 0} className="gap-2">
              {exportFormat === 'excel' ? <FileSpreadsheet className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
              Exportar {selectedIds.size} atleta(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
