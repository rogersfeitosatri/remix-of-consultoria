import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { toast } from 'sonner';

interface Question {
  id: string;
  question_text: string;
  section?: string | null;
}

interface CheckinResponse {
  id: string;
  submitted_at: string;
  responses: Record<string, any>;
  clients?: { name?: string | null } | null;
  checkin_forms?: { name?: string | null } | null;
}

interface AthleteProfile {
  target_race?: string | null;
  target_deadline?: string | null;
}

interface Props {
  checkinResponse: CheckinResponse | null | undefined;
  questions: Question[];
  athleteProfile?: AthleteProfile | null;
  targetRaceDays?: number | null;
}

function esc(text: string | null | undefined): string {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

function extractAnswer(raw: any): { answer: string; comment: string | null } {
  let answer: any = raw;
  let comment: string | null = null;

  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    answer = raw.answer ?? raw;
    comment = raw.comment ?? null;
    if (typeof answer === 'object' && answer !== null && !Array.isArray(answer)) {
      answer = answer.answer ?? JSON.stringify(answer);
    }
  }

  const display = Array.isArray(answer)
    ? answer.join(', ')
    : typeof answer === 'string' || typeof answer === 'number'
    ? String(answer)
    : '';

  return { answer: display || 'Não respondido', comment };
}

function buildHTML(
  checkinResponse: CheckinResponse,
  questions: Question[],
  athleteProfile: AthleteProfile | null | undefined,
  targetRaceDays: number | null | undefined,
): string {
  const athleteName = checkinResponse.clients?.name || 'Atleta';
  const submittedDate = format(parseISO(checkinResponse.submitted_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const formName = checkinResponse.checkin_forms?.name || 'Check-in';

  const targetRaceHtml = athleteProfile?.target_race
    ? `
      <div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;
                  padding:10px 14px;margin-bottom:18px;display:flex;align-items:center;
                  justify-content:space-between;gap:12px">
        <div>
          <div style="font-size:10px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:.6px;margin-bottom:2px">🎯 Prova Alvo</div>
          <div style="font-size:13px;font-weight:700;color:#78350f">${esc(athleteProfile.target_race)}</div>
          ${athleteProfile.target_deadline ? `<div style="font-size:11px;color:#92400e">${format(parseISO(athleteProfile.target_deadline), 'dd/MM/yyyy')}</div>` : ''}
        </div>
        ${typeof targetRaceDays === 'number' ? `
          <div style="background:#92400e;color:#fff;padding:5px 11px;border-radius:14px;font-size:11px;font-weight:700;white-space:nowrap">
            ${targetRaceDays > 0 ? `${targetRaceDays} dias` : targetRaceDays === 0 ? 'Hoje!' : 'Encerrada'}
          </div>` : ''}
      </div>`
    : '';

  const qaHtml = questions
    .map((q, i) => {
      const { answer, comment } = extractAnswer(checkinResponse.responses?.[q.id]);
      return `
        <div style="border-bottom:1px solid #e5e7eb;padding:10px 0;page-break-inside:avoid;break-inside:avoid">
          <p style="font-size:11px;color:#6b7280;margin:0 0 4px;font-weight:600;line-height:1.45">
            ${i + 1}. ${esc(q.question_text)}
          </p>
          <p style="font-size:12px;color:#111827;margin:0;line-height:1.5;white-space:pre-wrap">
            ${esc(answer)}
          </p>
          ${comment ? `<p style="font-size:11px;color:#6b7280;margin:4px 0 0;font-style:italic;line-height:1.5">"${esc(comment)}"</p>` : ''}
        </div>`;
    })
    .join('');

  return `
    <div style="background:#fff;padding:36px 32px;font-family:'Segoe UI',system-ui,sans-serif;
                min-width:680px;max-width:760px;color:#111827">
      <!-- Header -->
      <div style="border-bottom:2.5px solid #111827;padding-bottom:14px;margin-bottom:18px">
        <div style="font-size:10px;font-weight:700;color:#6b7280;letter-spacing:1.2px;
                    text-transform:uppercase;margin-bottom:4px">Revisão de Check-in</div>
        <h1 style="font-size:22px;font-weight:900;color:#111827;margin:0 0 6px;line-height:1.15">
          ${esc(athleteName)}
        </h1>
        <p style="font-size:12px;color:#374151;margin:0">
          <strong>Data:</strong> ${esc(submittedDate)}
          &nbsp;·&nbsp;
          <strong>Formulário:</strong> ${esc(formName)}
        </p>
      </div>

      ${targetRaceHtml}

      <!-- Q&A -->
      <div style="margin-top:4px">
        <h2 style="font-size:13px;font-weight:800;color:#111827;margin:0 0 8px;
                   text-transform:uppercase;letter-spacing:.8px">
          Perguntas &amp; Respostas
        </h2>
        ${qaHtml || '<p style="font-size:12px;color:#9ca3af;font-style:italic">Nenhuma resposta registrada.</p>'}
      </div>

      <!-- Footer -->
      <div style="border-top:1px solid #e5e7eb;padding-top:12px;margin-top:22px;
                  display:flex;justify-content:space-between;align-items:flex-end">
        <p style="font-size:9px;color:#9ca3af;margin:0">Gerado por Zona Nutri</p>
        <p style="font-size:9px;color:#d1d5db;margin:0">${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</p>
      </div>
    </div>`;
}

async function exportPDF(container: HTMLElement, filename: string): Promise<void> {
  const canvas = await html2canvas(container, {
    scale: 2.5,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    windowWidth: 800,
  });

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PAGE_W = pdf.internal.pageSize.getWidth();
  const PAGE_H = pdf.internal.pageSize.getHeight();
  const MARGIN = 10;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  const canvasW = canvas.width;
  const canvasH = canvas.height;
  const mmPerPx = CONTENT_W / canvasW;
  const pageHeightPx = (PAGE_H - MARGIN * 2) / mmPerPx;

  let remainingPx = canvasH;
  let srcY = 0;

  while (remainingPx > 0) {
    if (srcY > 0) pdf.addPage();
    const sliceH = Math.min(pageHeightPx, remainingPx);

    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvasW;
    sliceCanvas.height = sliceH;
    const ctx = sliceCanvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, sliceH);
    ctx.drawImage(canvas, 0, srcY, canvasW, sliceH, 0, 0, canvasW, sliceH);

    const imgData = sliceCanvas.toDataURL('image/jpeg', 0.95);
    const sliceHmm = sliceH * mmPerPx;
    pdf.addImage(imgData, 'JPEG', MARGIN, MARGIN, CONTENT_W, sliceHmm);

    srcY += sliceH;
    remainingPx -= sliceH;
  }

  pdf.save(filename);
}

export function CheckinReviewPdfButton({ checkinResponse, questions, athleteProfile, targetRaceDays }: Props) {
  const [exporting, setExporting] = useState(false);
  const hiddenRef = useRef<HTMLDivElement>(null);

  const handleExport = async () => {
    if (!checkinResponse) {
      toast.error('Check-in não carregado');
      return;
    }
    setExporting(true);
    try {
      const html = buildHTML(checkinResponse, questions, athleteProfile, targetRaceDays);

      // Off-screen container
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.top = '-10000px';
      container.style.left = '0';
      container.style.zIndex = '-1';
      container.innerHTML = html;
      document.body.appendChild(container);

      try {
        const inner = container.firstElementChild as HTMLElement;
        const athleteSlug = slugify(checkinResponse.clients?.name || 'atleta');
        const dateStr = format(parseISO(checkinResponse.submitted_at), 'yyyy-MM-dd');
        await exportPDF(inner || container, `checkin-${athleteSlug}-${dateStr}.pdf`);
        toast.success('PDF gerado com sucesso');
      } finally {
        document.body.removeChild(container);
      }
    } catch (e) {
      console.error('Erro ao gerar PDF', e);
      toast.error('Erro ao gerar PDF');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={exporting || !checkinResponse}
      className="gap-2"
    >
      {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      <span className="hidden sm:inline">{exporting ? 'Gerando…' : 'Baixar PDF'}</span>
    </Button>
  );
}
