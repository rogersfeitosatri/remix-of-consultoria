// Exporta em PDF os dados da Interconexão Metabólica:
// - downloadScreeningResponsesPdf: SOMENTE as respostas que o paciente marcou
//   em cada pergunta (por categoria), com a legenda da escala e observações.
// - downloadScreeningAnalysisPdf: a análise gerada pela IA (diagnóstico,
//   desequilíbrios, recomendações, ações prioritárias).
import jsPDF from 'jspdf';
import { metabolicCategories, scoreLabels, getInterpretation } from '@/data/metabolicScreeningQuestions';

const M = 15;         // margem (mm)
const W = 210 - M * 2; // largura útil A4

function fmtDate(d?: string): string {
  if (!d) return '';
  try { return new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR'); } catch { return d; }
}

class PdfWriter {
  pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  y = M;

  ensure(h: number) {
    if (this.y + h > 297 - M) { this.pdf.addPage(); this.y = M; }
  }
  title(text: string) {
    this.ensure(10);
    this.pdf.setFont('helvetica', 'bold').setFontSize(14);
    this.pdf.text(text, M, this.y);
    this.y += 7;
  }
  subtitle(text: string) {
    this.ensure(8);
    this.pdf.setFont('helvetica', 'bold').setFontSize(11);
    this.pdf.text(text, M, this.y);
    this.y += 5.5;
  }
  meta(text: string) {
    this.ensure(6);
    this.pdf.setFont('helvetica', 'normal').setFontSize(9).setTextColor(110);
    this.pdf.text(text, M, this.y);
    this.pdf.setTextColor(0);
    this.y += 5;
  }
  para(text: string, size = 9.5, indent = 0) {
    const lines = this.pdf.setFont('helvetica', 'normal').setFontSize(size).splitTextToSize(text, W - indent);
    for (const line of lines) {
      this.ensure(5);
      this.pdf.text(line, M + indent, this.y);
      this.y += 4.6;
    }
  }
  bullet(text: string) {
    this.para(`• ${text}`, 9.5, 2);
  }
  qa(question: string, answer: string) {
    const qLines = this.pdf.setFont('helvetica', 'normal').setFontSize(9.5).splitTextToSize(question, W - 2);
    this.ensure(qLines.length * 4.6 + 5);
    this.pdf.setFont('helvetica', 'normal').setFontSize(9.5);
    for (const line of qLines) { this.pdf.text(line, M + 2, this.y); this.y += 4.6; }
    this.pdf.setFont('helvetica', 'bold').setFontSize(9.5);
    this.pdf.text(`→ ${answer}`, M + 5, this.y);
    this.y += 6;
  }
  gap(h = 3) { this.y += h; }
  save(name: string) { this.pdf.save(name); }
}

/** PDF apenas com as respostas marcadas pelo paciente. */
export function downloadScreeningResponsesPdf(screening: any, clientName?: string) {
  const w = new PdfWriter();
  const responses: Record<string, number> = screening?.responses || {};

  w.title('Interconexão Metabólica — Respostas do paciente');
  w.meta(`${clientName ? `Atleta: ${clientName} · ` : ''}Data: ${fmtDate(screening?.screening_date)} · Pontuação total: ${screening?.score_total ?? 0}`);
  w.meta(`Escala: ${scoreLabels.map((s) => `${s.value} = ${s.label}`).join(' · ')}`);
  w.gap(2);

  for (const cat of metabolicCategories) {
    const catScore = cat.questions.reduce((s, q) => s + (responses[q.id] || 0), 0);
    w.subtitle(`${cat.label} (${catScore}/${cat.questions.length * 4})`);
    for (const q of cat.questions) {
      const v = responses[q.id];
      const label = v == null ? 'Não respondida' : `${v} — ${scoreLabels.find((s) => s.value === v)?.label ?? v}`;
      w.qa(q.text, label);
    }
    w.gap(2);
  }

  if (screening?.notes) {
    w.subtitle('Observações');
    w.para(String(screening.notes));
  }

  w.save(`respostas-interconexao-metabolica-${screening?.screening_date || 'atleta'}.pdf`);
}

/** PDF com a análise de IA do rastreamento (se existir). */
export function downloadScreeningAnalysisPdf(screening: any, clientName?: string) {
  const a = screening?.ai_analysis as any;
  if (!a) return;
  const w = new PdfWriter();

  const interp = getInterpretation(Number(screening?.score_total) || 0);
  w.title('Interconexão Metabólica — Análise (IA)');
  w.meta(`${clientName ? `Atleta: ${clientName} · ` : ''}Data: ${fmtDate(screening?.screening_date)} · Pontuação total: ${screening?.score_total ?? 0} (${interp.label})`);
  w.gap(2);

  if (a.diagnostic) {
    w.subtitle('Diagnóstico');
    w.para(String(a.diagnostic));
    w.gap(2);
  }

  for (const imb of a.top_imbalances || []) {
    w.subtitle(`${imb.system}${imb.score != null ? ` (${imb.score}/40)` : ''}`);
    if (imb.interpretation) w.para(String(imb.interpretation));
    if (imb.dietary_recommendations?.length) {
      w.para('Alimentação:', 9.5); for (const r of imb.dietary_recommendations) w.bullet(String(r));
    }
    if (imb.supplementation?.length) {
      w.para('Suplementação:', 9.5); for (const s of imb.supplementation) w.bullet(String(s));
    }
    if (imb.clinical_actions?.length) {
      w.para('Ações clínicas:', 9.5); for (const c of imb.clinical_actions) w.bullet(String(c));
    }
    w.gap(2);
  }

  if (a.general_recommendations) {
    w.subtitle('Recomendações gerais');
    w.para(String(a.general_recommendations));
    w.gap(2);
  }
  if (a.evolution_notes) {
    w.subtitle('Notas de evolução');
    w.para(String(a.evolution_notes));
    w.gap(2);
  }
  if (a.priority_actions?.length) {
    w.subtitle('Ações prioritárias');
    for (const p of a.priority_actions) w.bullet(String(p));
    w.gap(2);
  }
  if (a.athlete_feedback) {
    w.subtitle('Mensagem para o atleta');
    w.para(String(a.athlete_feedback));
  }

  w.save(`analise-interconexao-metabolica-${screening?.screening_date || 'atleta'}.pdf`);
}
