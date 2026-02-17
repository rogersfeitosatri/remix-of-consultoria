import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Download, FileImage, FileText, Loader2, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const PHASE_COLORS: Record<string, { bg: string; border: string; text: string; light: string }> = {
  'Base': { bg: '#3b82f6', border: '#2563eb', text: '#1d4ed8', light: '#eff6ff' },
  'Específica': { bg: '#f59e0b', border: '#d97706', text: '#92400e', light: '#fffbeb' },
  'Polimento': { bg: '#10b981', border: '#059669', text: '#065f46', light: '#ecfdf5' },
  'Transição': { bg: '#8b5cf6', border: '#7c3aed', text: '#4c1d95', light: '#f5f3ff' },
};

const getPhaseColor = (name: string) =>
  Object.entries(PHASE_COLORS).find(([k]) => name.includes(k))?.[1] ||
  { bg: '#6b7280', border: '#4b5563', text: '#1f2937', light: '#f9fafb' };

interface Phase {
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

export function PeriodizationExportButton({
  phases, raceName, raceDate, startDate, totalWeeks, allDynamics = [], journeyWeeks = []
}: Props) {
  const [open, setOpen] = useState(false);
  const [format_, setFormat] = useState<'pdf' | 'jpeg'>('pdf');
  const [exporting, setExporting] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const handleExport = async () => {
    if (!previewRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      if (format_ === 'jpeg') {
        const link = document.createElement('a');
        link.download = `periodizacao-${raceName || 'atleta'}.jpg`;
        link.href = canvas.toDataURL('image/jpeg', 0.92);
        link.click();
      } else {
        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const ratio = canvas.width / canvas.height;
        const imgW = pageW - 20;
        const imgH = imgW / ratio;

        if (imgH <= pageH - 20) {
          pdf.addImage(imgData, 'JPEG', 10, 10, imgW, imgH);
        } else {
          // Multi-page if content is tall
          let yOffset = 0;
          const pageImgH = pageH - 20;
          while (yOffset < imgH) {
            if (yOffset > 0) pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 10, 10 - yOffset, imgW, imgH);
            yOffset += pageImgH;
          }
        }
        pdf.save(`periodizacao-${raceName || 'atleta'}.pdf`);
      }
      setOpen(false);
    } catch (e) {
      console.error('Export error', e);
    }
    setExporting(false);
  };

  const getDynamicSummary = (phase: Phase) => {
    const weekIds = journeyWeeks.filter((w: any) => w.journey_phase_id === (phases as any[]).find((p: any) => p.phase_name === phase.phase_name)?.id).map((w: any) => w.id);
    const dynamics = allDynamics.filter((d: any) => weekIds.includes(d.journey_week_id));
    if (dynamics.length === 0) return null;
    const low = dynamics.filter((d: any) => d.cho_classification === 'Low').length;
    const high = dynamics.filter((d: any) => d.cho_classification === 'High').length;
    const med = dynamics.filter((d: any) => d.cho_classification === 'Medium').length;
    return { low, high, med, total: dynamics.length };
  };

  if (phases.length === 0) return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs h-8"
        onClick={() => setOpen(true)}
      >
        <Download className="h-3.5 w-3.5" />
        Exportar Visão Geral
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-sm">Exportar Periodização</DialogTitle>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFormat('pdf')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border transition-all ${format_ === 'pdf' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
                >
                  <FileText className="h-3.5 w-3.5" /> PDF
                </button>
                <button
                  onClick={() => setFormat('jpeg')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border transition-all ${format_ === 'jpeg' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
                >
                  <FileImage className="h-3.5 w-3.5" /> JPEG
                </button>
                <Button size="sm" onClick={handleExport} disabled={exporting} className="gap-1.5 text-xs h-8">
                  {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  {exporting ? 'Gerando...' : `Baixar ${format_.toUpperCase()}`}
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Preview area — this is what gets captured */}
          <div ref={previewRef} style={{ background: '#ffffff', padding: '32px', fontFamily: 'system-ui, sans-serif', minWidth: 700 }}>
            {/* Header */}
            <div style={{ borderBottom: '2px solid #e5e7eb', paddingBottom: 20, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: 0 }}>
                    Periodização Nutricional
                  </h1>
                  <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                    Planejamento estratégico por fases
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {raceName && (
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>🎯 {raceName}</div>
                  )}
                  {raceDate && (
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                      Prova: {format(parseISO(raceDate), 'dd/MM/yyyy')}
                    </div>
                  )}
                  {startDate && (
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      Início: {format(parseISO(startDate), 'dd/MM/yyyy')}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{totalWeeks} semanas totais</div>
                </div>
              </div>
            </div>

            {/* Phase Bar */}
            <div style={{ display: 'flex', height: 32, borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb', marginBottom: 24 }}>
              {phases.map((p, i) => {
                const color = getPhaseColor(p.phase_name);
                const pct = totalWeeks > 0 ? (p.duration_weeks / totalWeeks) * 100 : 25;
                return (
                  <div
                    key={i}
                    style={{
                      width: `${pct}%`,
                      background: color.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRight: i < phases.length - 1 ? '1px solid rgba(255,255,255,0.3)' : 'none',
                    }}
                  >
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 4px' }}>
                      {p.phase_name}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Phases */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {phases.map((phase, idx) => {
                const color = getPhaseColor(phase.phase_name);
                const dynSum = getDynamicSummary(phase);

                return (
                  <div key={idx} style={{
                    border: `1.5px solid ${color.border}`,
                    borderRadius: 10,
                    overflow: 'hidden',
                    background: '#fff',
                  }}>
                    {/* Phase header */}
                    <div style={{
                      background: color.light,
                      borderBottom: `1.5px solid ${color.border}`,
                      padding: '10px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: color.bg }} />
                        <span style={{ fontSize: 15, fontWeight: 800, color: color.text }}>{phase.phase_name}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#6b7280' }}>
                        <span style={{ fontWeight: 600 }}>{phase.duration_weeks} semanas</span>
                        {phase.start_date && phase.end_date && (
                          <span>
                            {format(parseISO(phase.start_date), 'dd/MM/yyyy')} → {format(parseISO(phase.end_date), 'dd/MM/yyyy')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Phase body */}
                    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {/* Objective */}
                      {phase.objective && (
                        <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.5 }}>
                          <strong>Objetivo:</strong> {phase.objective}
                        </p>
                      )}

                      {/* Key metrics row */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px' }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 2 }}>CHO</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>{phase.cho_range || '—'} g/kg</div>
                        </div>
                        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px' }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 2 }}>Train-Low</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: phase.train_low_strategy === 'proibido' ? '#dc2626' : phase.train_low_strategy === 'reduzido' ? '#d97706' : '#059669' }}>
                            {phase.train_low_strategy || '—'}
                          </div>
                        </div>
                        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px' }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 2 }}>Dinâmica CHO</div>
                          {dynSum ? (
                            <div style={{ fontSize: 10, color: '#374151' }}>
                              <span style={{ color: '#3b82f6' }}>Low: {dynSum.low}d</span>
                              {' · '}
                              <span style={{ color: '#10b981' }}>High: {dynSum.high}d</span>
                              {' · '}
                              <span style={{ color: '#f59e0b' }}>Med: {dynSum.med}d</span>
                            </div>
                          ) : (
                            <div style={{ fontSize: 10, color: '#9ca3af' }}>Não configurada</div>
                          )}
                        </div>
                      </div>

                      {/* Details row */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                        {phase.recovery_strategy && (
                          <div style={{ fontSize: 11, color: '#374151' }}>
                            <strong style={{ color: '#6b7280' }}>Recuperação:</strong> {phase.recovery_strategy}
                          </div>
                        )}
                        {phase.body_comp_strategy && (
                          <div style={{ fontSize: 11, color: '#374151' }}>
                            <strong style={{ color: '#6b7280' }}>Comp. Corporal:</strong> {phase.body_comp_strategy}
                          </div>
                        )}
                        {phase.supplement_base && (
                          <div style={{ fontSize: 11, color: '#374151' }}>
                            <strong style={{ color: '#6b7280' }}>Suplementação:</strong> {phase.supplement_base}
                          </div>
                        )}
                        {phase.strategic_notes && (
                          <div style={{ fontSize: 11, color: '#374151' }}>
                            <strong style={{ color: '#6b7280' }}>Obs.:</strong> {phase.strategic_notes}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{ marginTop: 24, borderTop: '1px solid #e5e7eb', paddingTop: 12, textAlign: 'center' }}>
              <p style={{ fontSize: 9, color: '#9ca3af', margin: 0 }}>
                📚 Baseado em: Vitale & Getzin (2019) · Burke et al. (2011) · Jeukendrup (2017) · Stellingwerff et al. (2019)
              </p>
              <p style={{ fontSize: 9, color: '#d1d5db', marginTop: 4 }}>
                Gerado em {format(new Date(), 'dd/MM/yyyy')}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
