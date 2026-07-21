// Exporta em PDF os check-ins selecionados de um atleta:
// - As respostas de cada check-in (pergunta → resposta marcada).
// - Os gráficos de evolução (peso e percepções) desenhados no próprio PDF.
// Autossuficiente (jsPDF) — não depende do DOM/telas abertas.
import jsPDF from 'jspdf';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const M = 15;
const PW = 210, PH = 297, W = PW - M * 2;

// Mapeamento de opções → valor numérico (espelha CheckinEvolutionCharts).
const optionToValue: Record<string, number> = {
  'Diminuíram significativamente': 5, 'Diminuíram levemente': 4, 'Se mantiveram': 3,
  'Aumentaram levemente': 2, 'Aumentaram significativamente': 1,
  'Muito baixo – quase não sinto fome': 1, 'Baixo – sinto fome em alguns momentos, mas nada relevante': 2,
  'Médio – sinto fome em alguns momentos, mas consigo lidar bem': 3, 'Alto – sinto fome com frequência': 4,
  'Muito alto – sinto fome o tempo todo e isso tem me incomodado': 5,
  'Muito disposto(a)': 5, 'Geralmente bem disposto(a)': 4, 'Oscilando entre dias bons e cansativos': 2,
  'Muito cansado(a), a maior parte do tempo': 1,
  'Excelente – durmo bem e acordo disposto': 5, 'Boa – durmo bem, mas com alguns despertares': 4,
  'Regular – tenho dificuldade para dormir ou acordo cansado': 2, 'Ruim – sono leve, agitado ou insuficiente': 1,
  'Evacuo todos os dias': 5, 'Evacuo em dias alternados': 3, 'Estou um pouco constipado(a)': 2,
  'Sinto constipação frequente': 1,
  'Me senti muito bem em todos os treinos': 5, 'Me senti bem na maioria, com alguns dias mais difíceis': 4,
  'Tive dificuldades em vários treinos': 2, 'Não consegui realizar os treinos intensos': 1,
  'Não fiz nenhuma': 5, 'Sim, 1': 4, 'Sim, 2': 2, 'Sim, 3 ou mais': 1,
};

const metricDefs: Array<{ key: string; label: string; re: RegExp; numeric?: boolean }> = [
  { key: 'weight', label: 'Peso (kg)', re: /peso.*jejum/i, numeric: true },
  { key: 'perception', label: 'Percepção corporal', re: /mudança.*composição.*corporal/i },
  { key: 'hunger', label: 'Fome/apetite', re: /fome.*apetite/i },
  { key: 'disposition', label: 'Disposição/energia', re: /disposição.*energia/i },
  { key: 'sleep', label: 'Qualidade do sono', re: /qualidade.*sono/i },
  { key: 'intestinal', label: 'Função intestinal', re: /frequência.*evacuação/i },
  { key: 'training', label: 'Treinos', re: /treinos.*intensos/i },
  { key: 'weeklyScore', label: 'Nota da semana', re: /nota.*daria.*semana/i, numeric: true },
];

function rawAnswer(v: any): any {
  if (v && typeof v === 'object' && 'answer' in v) return v.answer;
  return v;
}
export function formatAnswer(v: any): string {
  const a = rawAnswer(v);
  if (a == null || a === '') return '—';
  if (Array.isArray(a)) return a.map(formatAnswer).join(', ');
  if (typeof a === 'object') return Object.values(a).map(formatAnswer).join(' · ');
  return String(a);
}

interface Point { label: string; values: Record<string, number> }
function buildSeries(responses: any[], questions: any[]): { points: Point[]; metrics: typeof metricDefs } {
  const sorted = [...responses].sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime());
  const points: Point[] = sorted.map((r) => {
    const values: Record<string, number> = {};
    for (const q of questions) {
      const ans = rawAnswer(r.responses?.[q.id]);
      if (ans == null || ans === '') continue;
      const def = metricDefs.find((m) => m.re.test(q.question_text || ''));
      if (!def) continue;
      if (def.numeric) {
        const n = parseFloat(String(ans).replace(',', '.').replace(/[^\d.]/g, ''));
        if (!isNaN(n)) values[def.key] = n;
      } else {
        const n = optionToValue[ans];
        if (n != null) values[def.key] = n;
      }
    }
    return { label: format(parseISO(r.submitted_at), 'dd/MM/yy', { locale: ptBR }), values };
  });
  return { points, metrics: metricDefs };
}

class Pdf {
  doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  y = M;
  ensure(h: number) { if (this.y + h > PH - M) { this.doc.addPage(); this.y = M; } }
  h1(t: string) { this.ensure(10); this.doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(0); this.doc.text(t, M, this.y); this.y += 7; }
  h2(t: string) { this.ensure(9); this.doc.setFont('helvetica', 'bold').setFontSize(12); this.doc.text(t, M, this.y); this.y += 6; }
  meta(t: string) { this.ensure(6); this.doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(110); this.doc.text(t, M, this.y); this.doc.setTextColor(0); this.y += 5; }
  qa(q: string, a: string) {
    this.doc.setFont('helvetica', 'normal').setFontSize(9.5);
    const ql = this.doc.splitTextToSize(q, W);
    const al = this.doc.splitTextToSize(`→ ${a}`, W - 4);
    this.ensure(ql.length * 4.5 + al.length * 4.5 + 2);
    this.doc.setTextColor(60);
    for (const l of ql) { this.doc.text(l, M, this.y); this.y += 4.5; }
    this.doc.setFont('helvetica', 'bold').setTextColor(0);
    for (const l of al) { this.doc.text(l, M + 4, this.y); this.y += 4.5; }
    this.y += 1.5;
  }
  gap(h = 3) { this.y += h; }

  lineChart(title: string, labels: string[], values: (number | undefined)[]) {
    const pts = values.map((v, i) => ({ v, i })).filter((p) => p.v != null) as { v: number; i: number }[];
    if (pts.length < 2) return;
    const chartH = 42, chartW = W;
    this.ensure(chartH + 12);
    this.doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(0);
    this.doc.text(title, M, this.y); this.y += 4;
    const x0 = M + 12, y0 = this.y, plotW = chartW - 14, plotH = chartH;
    const vals = pts.map((p) => p.v);
    let min = Math.min(...vals), max = Math.max(...vals);
    if (min === max) { min -= 1; max += 1; }
    const nx = labels.length > 1 ? labels.length - 1 : 1;
    const px = (i: number) => x0 + (plotW * i) / nx;
    const py = (v: number) => y0 + plotH - ((v - min) / (max - min)) * plotH;
    // Eixos
    this.doc.setDrawColor(200).setLineWidth(0.2);
    this.doc.line(x0, y0, x0, y0 + plotH);
    this.doc.line(x0, y0 + plotH, x0 + plotW, y0 + plotH);
    this.doc.setFontSize(6.5).setTextColor(130).setFont('helvetica', 'normal');
    this.doc.text(String(Math.round(max * 10) / 10), M, y0 + 2);
    this.doc.text(String(Math.round(min * 10) / 10), M, y0 + plotH);
    // Linha
    this.doc.setDrawColor(37, 99, 235).setLineWidth(0.5);
    for (let k = 1; k < pts.length; k++) {
      this.doc.line(px(pts[k - 1].i), py(pts[k - 1].v), px(pts[k].i), py(pts[k].v));
    }
    this.doc.setFillColor(37, 99, 235);
    for (const p of pts) this.doc.circle(px(p.i), py(p.v), 0.6, 'F');
    // Rótulos do eixo X (datas) — limita para não poluir
    this.doc.setFontSize(6).setTextColor(130);
    const step = Math.ceil(labels.length / 8);
    labels.forEach((lb, i) => { if (i % step === 0) this.doc.text(lb, px(i), y0 + plotH + 3, { align: 'center' }); });
    this.y = y0 + plotH + 7;
  }

  save(name: string) { this.doc.save(name); }
}

export function downloadCheckinsPdf(opts: {
  clientName: string;
  checkins: any[];          // selecionados (cada um com responses, submitted_at, checkin_forms?.title)
  questions: any[];         // perguntas (id, question_text, order_index?)
  includeAnswers?: boolean;
  includeCharts?: boolean;
}) {
  const { clientName, checkins, questions } = opts;
  const includeAnswers = opts.includeAnswers !== false;
  const includeCharts = opts.includeCharts !== false;
  const pdf = new Pdf();

  const sorted = [...checkins].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
  const orderedQuestions = [...questions].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

  pdf.h1('Check-ins — ' + clientName);
  pdf.meta(`${sorted.length} check-in(s) · gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`);
  pdf.gap(2);

  // Gráficos de evolução
  if (includeCharts) {
    const { points } = buildSeries(checkins, questions);
    if (points.length >= 2) {
      pdf.h2('Gráficos de evolução');
      const labels = points.map((p) => p.label);
      for (const def of metricDefs) {
        const series = points.map((p) => p.values[def.key]);
        if (series.filter((v) => v != null).length >= 2) pdf.lineChart(def.label, labels, series);
      }
      pdf.gap(2);
    } else {
      pdf.meta('Gráficos de evolução: são necessários ao menos 2 check-ins.');
      pdf.gap(2);
    }
  }

  // Respostas por check-in
  if (includeAnswers) {
    for (const c of sorted) {
      const title = c.checkin_forms?.title ? `${c.checkin_forms.title} — ` : '';
      pdf.h2(`${title}${format(parseISO(c.submitted_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`);
      const resp = c.responses || {};
      const asked = orderedQuestions.filter((q) => resp[q.id] != null);
      if (asked.length === 0) {
        // Sem match de perguntas conhecidas: imprime pares crus.
        const keys = Object.keys(resp);
        if (!keys.length) { pdf.meta('Sem respostas registradas.'); }
        for (const k of keys) pdf.qa(k, formatAnswer(resp[k]));
      } else {
        for (const q of asked) pdf.qa(q.question_text || q.id, formatAnswer(resp[q.id]));
      }
      pdf.gap(3);
    }
  }

  const safe = clientName.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase();
  pdf.save(`checkins-${safe || 'atleta'}.pdf`);
}
