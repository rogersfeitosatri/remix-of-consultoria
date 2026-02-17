import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, FileImage, FileText, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// ─── Phase color palettes (for inline HTML preview + export) ───────────────
const PALETTE: Record<string, { accent: string; light: string; dark: string; label: string }> = {
  Base:       { accent: '#2563eb', light: '#eff6ff', dark: '#1e40af', label: '#fff' },
  Específica: { accent: '#d97706', light: '#fffbeb', dark: '#92400e', label: '#fff' },
  Polimento:  { accent: '#059669', light: '#ecfdf5', dark: '#064e3b', label: '#fff' },
  Transição:  { accent: '#7c3aed', light: '#f5f3ff', dark: '#3b0764', label: '#fff' },
};

const getPalette = (name: string) =>
  Object.entries(PALETTE).find(([k]) => name.includes(k))?.[1] ??
  { accent: '#6b7280', light: '#f9fafb', dark: '#1f2937', label: '#fff' };

// ─── Train-low color ────────────────────────────────────────────────────────
const trainLowColor = (v?: string) => {
  if (!v) return '#6b7280';
  if (v === 'proibido') return '#dc2626';
  if (v === 'reduzido') return '#d97706';
  return '#059669';
};

interface Phase {
  id?: string;
  phase_name: string;
  duration_weeks: number;
  start_date?: string;
  end_date?: string;
  objective?: string;
  cho_range?: string;
  train_low_strategy?: string;
  recovery_strategy?: string;
  body_comp_strategy?: string;
  supplement_base?: string;
  strategic_notes?: string;
}

interface Props {
  phases: Phase[];
  raceName: string;
  raceDate: string;
  startDate: string;
  totalWeeks: number;
  allDynamics?: any[];
  journeyWeeks?: any[];
}

// ─── Build a clean HTML string to render inside hidden div ──────────────────
function buildHTML(
  phases: Phase[],
  raceName: string,
  raceDate: string,
  startDate: string,
  totalWeeks: number,
  allDynamics: any[],
  journeyWeeks: any[],
): string {

  const dynSummary = (phase: Phase) => {
    const weekIds = journeyWeeks
      .filter((w: any) => w.journey_phase_id === (phase as any).id)
      .map((w: any) => w.id);
    const days = allDynamics.filter((d: any) => weekIds.includes(d.journey_week_id));
    if (!days.length) return null;
    return {
      low:  days.filter((d: any) => d.cho_classification === 'Low').length,
      high: days.filter((d: any) => d.cho_classification === 'High').length,
      med:  days.filter((d: any) => d.cho_classification === 'Medium').length,
    };
  };

  const phaseBarItems = phases.map(p => {
    const pal = getPalette(p.phase_name);
    const pct = totalWeeks > 0 ? (p.duration_weeks / totalWeeks) * 100 : 100 / phases.length;
    return `
      <div style="width:${pct}%;background:${pal.accent};display:flex;align-items:center;
                  justify-content:center;border-right:1px solid rgba(255,255,255,.25);">
        <span style="font-size:9px;font-weight:700;color:#fff;padding:0 3px;
                     white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${p.phase_name}&nbsp;(${p.duration_weeks}s)
        </span>
      </div>`;
  }).join('');

  const phaseCards = phases.map((phase) => {
    const pal = getPalette(phase.phase_name);
    const dyn = dynSummary(phase);
    const isPolimento = phase.phase_name.includes('Polimento');
    const isTransicao = phase.phase_name.includes('Transição');

    const dynHtml = dyn
      ? `<span style="color:#2563eb">Low: ${dyn.low}d</span>
         <span style="color:#9ca3af;margin:0 4px">·</span>
         <span style="color:#059669">High: ${dyn.high}d</span>
         <span style="color:#9ca3af;margin:0 4px">·</span>
         <span style="color:#d97706">Med: ${dyn.med}d</span>`
      : `<span style="color:#9ca3af;font-style:italic">Não configurada</span>`;

    const details = [
      phase.recovery_strategy && `<div style="grid-column:span 1"><span style="color:#6b7280;font-weight:600">Recuperação</span><br>${phase.recovery_strategy}</div>`,
      phase.body_comp_strategy && `<div style="grid-column:span 1"><span style="color:#6b7280;font-weight:600">Comp. Corporal</span><br>${phase.body_comp_strategy}</div>`,
      phase.supplement_base && `<div style="grid-column:span 2"><span style="color:#6b7280;font-weight:600">Suplementação</span><br>${phase.supplement_base}</div>`,
      phase.strategic_notes && `<div style="grid-column:span 2"><span style="color:#6b7280;font-weight:600">Observações</span><br>${phase.strategic_notes}</div>`,
    ].filter(Boolean).join('');

    const badge = isPolimento
      ? `<span style="background:#ecfdf5;color:#059669;border:1px solid #6ee7b7;font-size:9px;font-weight:700;padding:2px 7px;border-radius:20px;margin-left:8px">🏁 Prova</span>`
      : isTransicao
      ? `<span style="background:#f5f3ff;color:#7c3aed;border:1px solid #c4b5fd;font-size:9px;font-weight:700;padding:2px 7px;border-radius:20px;margin-left:8px">Pós-prova</span>`
      : '';

    return `
      <div style="border:1.5px solid ${pal.accent};border-radius:10px;overflow:hidden;
                  background:#fff;page-break-inside:avoid;break-inside:avoid;margin-bottom:14px;">

        <!-- Phase Header -->
        <div style="background:${pal.light};border-bottom:1.5px solid ${pal.accent};
                    padding:10px 16px;display:flex;justify-content:space-between;align-items:center;">
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:11px;height:11px;border-radius:50%;background:${pal.accent}"></div>
            <span style="font-size:15px;font-weight:800;color:${pal.dark}">${phase.phase_name}</span>
            ${badge}
          </div>
          <div style="display:flex;gap:18px;font-size:11px;color:#6b7280;align-items:center">
            <span style="font-weight:700;color:#374151">${phase.duration_weeks}&nbsp;semanas</span>
            ${phase.start_date && phase.end_date
              ? `<span>${format(parseISO(phase.start_date),'dd/MM/yyyy')}&nbsp;→&nbsp;${format(parseISO(phase.end_date),'dd/MM/yyyy')}</span>`
              : ''}
          </div>
        </div>

        <!-- Phase Body -->
        <div style="padding:14px 16px;display:flex;flex-direction:column;gap:12px">

          ${phase.objective ? `
          <p style="font-size:12px;color:#374151;margin:0;line-height:1.6;
                    padding:8px 12px;background:#f9fafb;border-radius:6px;
                    border-left:3px solid ${pal.accent}">
            <strong>Objetivo:</strong>&nbsp;${phase.objective}
          </p>` : ''}

          <!-- Metric chips -->
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:7px;padding:8px 10px">
              <div style="font-size:8px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.6px;margin-bottom:3px">CHO</div>
              <div style="font-size:15px;font-weight:800;color:#111827">${phase.cho_range ?? '—'}</div>
              <div style="font-size:9px;color:#9ca3af">g / kg / dia</div>
            </div>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:7px;padding:8px 10px">
              <div style="font-size:8px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.6px;margin-bottom:3px">Train-Low</div>
              <div style="font-size:13px;font-weight:800;color:${trainLowColor(phase.train_low_strategy)};text-transform:capitalize">
                ${phase.train_low_strategy ?? '—'}
              </div>
            </div>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:7px;padding:8px 10px">
              <div style="font-size:8px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.6px;margin-bottom:3px">Dinâmica CHO</div>
              <div style="font-size:11px;line-height:1.7">${dynHtml}</div>
            </div>
          </div>

          ${details ? `
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;font-size:11px;color:#374151;line-height:1.6">
            ${details}
          </div>` : ''}
        </div>
      </div>`;
  }).join('');

  return `
    <div style="background:#fff;padding:40px 36px;font-family:'Segoe UI',system-ui,sans-serif;
                min-width:680px;max-width:800px;color:#111827">

      <!-- ── HEADER ───────────────────────────────────────────────── -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;
                  border-bottom:2.5px solid #111827;padding-bottom:18px;margin-bottom:22px">
        <div>
          <div style="font-size:11px;font-weight:700;color:#6b7280;letter-spacing:1.2px;
                      text-transform:uppercase;margin-bottom:4px">Periodização Nutricional</div>
          <h1 style="font-size:24px;font-weight:900;color:#111827;margin:0;line-height:1.1">
            Planejamento Estratégico
          </h1>
          <p style="font-size:12px;color:#6b7280;margin:6px 0 0">por Fases · Endurance</p>
        </div>
        <div style="text-align:right">
          ${raceName ? `<div style="font-size:14px;font-weight:800;color:#111827;margin-bottom:4px">🎯&nbsp;${raceName}</div>` : ''}
          <div style="font-size:12px;color:#374151">
            <span style="font-weight:600">Prova:</span>&nbsp;
            ${raceDate ? format(parseISO(raceDate),'dd/MM/yyyy') : '—'}
          </div>
          <div style="font-size:12px;color:#374151">
            <span style="font-weight:600">Início:</span>&nbsp;
            ${startDate ? format(parseISO(startDate),'dd/MM/yyyy') : '—'}
          </div>
          <div style="font-size:12px;color:#6b7280;margin-top:2px">
            ${totalWeeks}&nbsp;semanas totais
          </div>
        </div>
      </div>

      <!-- ── PHASE BAR ─────────────────────────────────────────────── -->
      <div style="height:30px;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;
                  display:flex;margin-bottom:24px">
        ${phaseBarItems}
      </div>

      <!-- ── PHASE CARDS ───────────────────────────────────────────── -->
      ${phaseCards}

      <!-- ── FOOTER ────────────────────────────────────────────────── -->
      <div style="border-top:1px solid #e5e7eb;padding-top:14px;margin-top:8px;
                  display:flex;justify-content:space-between;align-items:flex-end">
        <p style="font-size:9px;color:#9ca3af;margin:0;max-width:560px;line-height:1.6">
          📚&nbsp;Referências: Vitale &amp; Getzin (2019) · Burke et al. (2011) ·
          Jeukendrup (2017) · Stellingwerff et al. (2019) · Thomas et al. (2016)
        </p>
        <p style="font-size:9px;color:#d1d5db;margin:0;white-space:nowrap;padding-left:16px">
          Gerado em&nbsp;${format(new Date(),'dd/MM/yyyy')}
        </p>
      </div>
    </div>`;
}

// ─── PDF renderer using jsPDF ────────────────────────────────────────────────
async function exportPDF(
  container: HTMLElement,
  filename: string,
): Promise<void> {
  const canvas = await html2canvas(container, {
    scale: 2.5,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    windowWidth: 840,
  });

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PAGE_W = pdf.internal.pageSize.getWidth();   // 210 mm
  const PAGE_H = pdf.internal.pageSize.getHeight();  // 297 mm
  const MARGIN = 10;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  // We'll tile the canvas vertically across pages
  const canvasW = canvas.width;
  const canvasH = canvas.height;
  const mmPerPx  = CONTENT_W / canvasW;          // mm width of one canvas pixel
  const pageHeightPx = (PAGE_H - MARGIN * 2) / mmPerPx; // canvas pixels per page

  let remainingPx = canvasH;
  let srcY = 0;

  while (remainingPx > 0) {
    if (srcY > 0) pdf.addPage();

    const sliceH = Math.min(pageHeightPx, remainingPx);

    // Create a slice canvas
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width  = canvasW;
    sliceCanvas.height = sliceH;
    const ctx = sliceCanvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, sliceH);
    ctx.drawImage(canvas, 0, srcY, canvasW, sliceH, 0, 0, canvasW, sliceH);

    const imgData = sliceCanvas.toDataURL('image/jpeg', 0.95);
    const sliceHmm = sliceH * mmPerPx;
    pdf.addImage(imgData, 'JPEG', MARGIN, MARGIN, CONTENT_W, sliceHmm);

    srcY        += sliceH;
    remainingPx -= sliceH;
  }

  pdf.save(filename);
}

// ─── JPEG renderer ───────────────────────────────────────────────────────────
async function exportJPEG(container: HTMLElement, filename: string): Promise<void> {
  const canvas = await html2canvas(container, {
    scale: 2.5,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    windowWidth: 840,
  });
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/jpeg', 0.95);
  link.click();
}

// ─── Component ───────────────────────────────────────────────────────────────
export function PeriodizationExportButton({
  phases, raceName, raceDate, startDate, totalWeeks, allDynamics = [], journeyWeeks = []
}: Props) {
  const [open, setOpen]           = useState(false);
  const [fmt, setFmt]             = useState<'pdf' | 'jpeg'>('pdf');
  const [exporting, setExporting] = useState(false);
  const containerRef              = useRef<HTMLDivElement>(null);

  const htmlContent = buildHTML(phases, raceName, raceDate, startDate, totalWeeks, allDynamics, journeyWeeks);
  const filename = `periodizacao${raceName ? `-${raceName.replace(/\s+/g, '-').toLowerCase()}` : ''}`;

  const handleExport = async () => {
    if (!containerRef.current) return;
    setExporting(true);
    try {
      if (fmt === 'pdf') {
        await exportPDF(containerRef.current, `${filename}.pdf`);
      } else {
        await exportJPEG(containerRef.current, `${filename}.jpg`);
      }
      setOpen(false);
    } catch (e) {
      console.error('Export error', e);
    }
    setExporting(false);
  };

  if (phases.length === 0) return null;

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={() => setOpen(true)}>
        <Download className="h-3.5 w-3.5" />
        Exportar Visão Geral
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <DialogTitle className="text-sm font-semibold">Exportar Periodização</DialogTitle>
              <div className="flex items-center gap-2">
                {/* Format selector */}
                <button
                  onClick={() => setFmt('pdf')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all ${
                    fmt === 'pdf' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" /> PDF
                </button>
                <button
                  onClick={() => setFmt('jpeg')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all ${
                    fmt === 'jpeg' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                  }`}
                >
                  <FileImage className="h-3.5 w-3.5" /> JPEG
                </button>
                <Button size="sm" onClick={handleExport} disabled={exporting} className="gap-1.5 text-xs h-8">
                  {exporting
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Download className="h-3.5 w-3.5" />}
                  {exporting ? 'Gerando…' : `Baixar ${fmt.toUpperCase()}`}
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* ── Live preview ── */}
          <div className="rounded-lg border border-border overflow-hidden bg-white">
            <div
              ref={containerRef}
              dangerouslySetInnerHTML={{ __html: htmlContent }}
              style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}
            />
          </div>

          <p className="text-[10px] text-muted-foreground text-center">
            Esta pré-visualização é idêntica ao arquivo exportado.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
