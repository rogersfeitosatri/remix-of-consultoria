// Gera um PDF do Plano Alimentar no estilo "Dietitian" (design de referência):
// header minimalista, cabeçalho com dados do paciente, seção "Todos os dias"
// em roxo, cards de refeição em cinza claro, itens substituíveis com um ícone
// roxo antes da linha, badges de "Opção" em verde, e rodapé com assinatura.
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const PURPLE = '#8B5CF6';
const PURPLE_DARK = '#6D28D9';
const GREEN = '#10B981';
const GREY = '#6B7280';
const GREY_BG = '#F3F4F6';
const TEXT = '#111827';
const TEXT_MUTED = '#4B5563';

export interface MealPlanPdfInput {
  clientName: string;
  startDate?: string;         // "14/01/2026"
  dietType?: string;          // "Progress High Carb"
  period?: string;            // "Todos os dias da semana"
  objective?: string;         // "MARATONA DE POA"
  meals: Array<{
    time?: string;            // "08:00"
    name: string;             // "Café da manhã"
    kcal?: number | string;   // for header "(200kcal)"
    options?: Array<{
      label?: string;         // "Opção 1"
      lines: Array<{ text: string; substitutable?: boolean }>;
    }>;
    // simple mode when no options split — just lines
    lines?: Array<{ text: string; substitutable?: boolean }>;
  }>;
  shoppingList?: string[];
  signatureName?: string;     // "Rogers Feitosa"
  crn?: string;               // "CRN 14885"
}

function esc(s: any): string {
  if (s === null || s === undefined) return '';
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

// Ícone SVG de substituição (setas circulares roxas)
const SWAP_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${PURPLE}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-2px;margin-right:8px;flex-shrink:0"><path d="M3 7h13l-3-3"/><path d="M21 17H8l3 3"/></svg>`;

function renderLine(line: { text: string; substitutable?: boolean }): string {
  const icon = line.substitutable ? SWAP_ICON : '';
  const indent = line.substitutable ? '' : 'padding-left:22px;';
  return `<div style="display:flex;align-items:flex-start;padding:4px 0;font-size:13px;color:${TEXT};line-height:1.55;${indent}">${icon}<span style="flex:1">${esc(line.text)}</span></div>`;
}

function renderMeal(m: MealPlanPdfInput['meals'][number]): string {
  const timeAndName = [m.time, m.name].filter(Boolean).join(' - ');
  const kcalSuffix = m.kcal ? ` <span style="color:${TEXT_MUTED};font-weight:500">( ${esc(m.kcal)}kcal )</span>` : '';

  if (m.options && m.options.length) {
    // Um único card cinza contendo todas as opções empilhadas
    return `
      <div style="background:${GREY_BG};border-radius:10px;padding:18px 20px;margin:14px 0;page-break-inside:avoid;break-inside:avoid">
        ${m.options.map((op, i) => `
          <div style="${i > 0 ? `border-top:1px solid #E5E7EB;margin-top:14px;padding-top:14px;` : ''}">
            <div style="font-size:15px;font-weight:700;color:${TEXT};margin-bottom:8px">${esc(timeAndName)}${kcalSuffix}</div>
            ${op.label ? `<div style="display:inline-block;background:${GREEN};color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;margin-bottom:8px">${esc(op.label)}</div>` : ''}
            <div>${op.lines.map(renderLine).join('')}</div>
          </div>
        `).join('')}
      </div>`;
  }

  const lines = m.lines || [];
  return `
    <div style="background:${GREY_BG};border-radius:10px;padding:18px 20px;margin:14px 0;page-break-inside:avoid;break-inside:avoid">
      <div style="font-size:15px;font-weight:700;color:${TEXT};margin-bottom:10px">${esc(timeAndName)}${kcalSuffix}</div>
      <div>${lines.map(renderLine).join('')}</div>
    </div>`;
}

function buildHTML(d: MealPlanPdfInput): string {
  const headerFields = [
    { label: 'Paciente', value: d.clientName },
    { label: 'Data de início', value: d.startDate || new Date().toLocaleDateString('pt-BR') },
    { label: 'Tipo de Dieta', value: d.dietType || 'Plano Alimentar' },
    { label: 'Período', value: d.period || 'Todos os dias da semana' },
  ];

  const shoppingHtml = d.shoppingList && d.shoppingList.length
    ? `
      <div style="page-break-before:always;padding-top:8px">
        <div style="font-size:11px;color:${GREY};letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">Plano Alimentar</div>
        <h1 style="font-size:26px;font-weight:800;color:${TEXT};margin:0 0 24px;letter-spacing:-.5px">Lista de Compras</h1>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px 24px">
          ${d.shoppingList.map(item => `<div style="font-size:13px;color:${TEXT};padding:6px 0;border-bottom:1px solid #E5E7EB">${esc(item)}</div>`).join('')}
        </div>
      </div>`
    : '';

  return `
    <div style="background:#fff;padding:40px 44px 60px;font-family:'Helvetica Neue',Arial,sans-serif;
                width:800px;color:${TEXT};box-sizing:border-box">
      <!-- Cabeçalho -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px">
        <div>
          <div style="font-size:11px;color:${GREY};margin-bottom:2px">Plano Alimentar</div>
          <h1 style="font-size:32px;font-weight:800;color:${TEXT};margin:0;letter-spacing:-.8px;line-height:1.1">DIÁRIO ALIMENTAR</h1>
        </div>
        <div style="font-size:22px;font-weight:800;color:${PURPLE};letter-spacing:-.5px">Nutrição</div>
      </div>

      <!-- Dados do paciente -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px">
        ${headerFields.map(f => `
          <div>
            <div style="font-size:11px;color:${GREY};margin-bottom:2px">${esc(f.label)}</div>
            <div style="font-size:13px;font-weight:600;color:${TEXT}">${esc(f.value || '—')}</div>
          </div>
        `).join('')}
      </div>
      ${d.objective ? `
        <div style="margin-bottom:8px">
          <div style="font-size:11px;color:${GREY};margin-bottom:2px">Objetivo</div>
          <div style="font-size:13px;font-weight:700;color:${TEXT};text-transform:uppercase;letter-spacing:.3px">${esc(d.objective)}</div>
        </div>` : ''}

      <!-- Seção Todos os dias -->
      <h2 style="font-size:19px;font-weight:700;color:${PURPLE};margin:28px 0 4px;letter-spacing:-.3px">Todos os dias</h2>

      <div>
        ${d.meals.map(renderMeal).join('')}
      </div>

      ${shoppingHtml}

      <!-- Rodapé -->
      <div style="margin-top:40px;padding-top:14px;border-top:1px solid #E5E7EB;
                  display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:18px;font-weight:800;color:${PURPLE};letter-spacing:-.4px">Nutrição</div>
        <div style="text-align:center;font-size:11px;color:${GREY}">
          ${d.signatureName ? `<div>Nutricionista <strong style="color:${TEXT}">${esc(d.signatureName)}</strong>${d.crn ? ` — ${esc(d.crn)}` : ''}</div>` : ''}
        </div>
        <div style="font-size:11px;color:${GREY}">Página 1</div>
      </div>
    </div>`;
}

async function htmlToPdf(html: string, filename: string) {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-10000px';
  container.style.left = '0';
  container.style.zIndex = '-1';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const inner = container.firstElementChild as HTMLElement;
    const canvas = await html2canvas(inner, {
      scale: 2.2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 820,
    });

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const PAGE_W = pdf.internal.pageSize.getWidth();
    const PAGE_H = pdf.internal.pageSize.getHeight();
    const MARGIN = 0; // design já tem padding interno
    const CONTENT_W = PAGE_W - MARGIN * 2;
    const canvasW = canvas.width;
    const canvasH = canvas.height;
    const mmPerPx = CONTENT_W / canvasW;
    const pageHeightPx = (PAGE_H - MARGIN * 2) / mmPerPx;

    let srcY = 0;
    let remaining = canvasH;
    while (remaining > 0) {
      if (srcY > 0) pdf.addPage();
      const sliceH = Math.min(pageHeightPx, remaining);
      const slice = document.createElement('canvas');
      slice.width = canvasW;
      slice.height = sliceH;
      const ctx = slice.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasW, sliceH);
      ctx.drawImage(canvas, 0, srcY, canvasW, sliceH, 0, 0, canvasW, sliceH);
      pdf.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', MARGIN, MARGIN, CONTENT_W, sliceH * mmPerPx);
      srcY += sliceH;
      remaining -= sliceH;
    }
    pdf.save(filename);
  } finally {
    document.body.removeChild(container);
  }
}

/** Transforma o `structured_analysis.meal_plan` em input do PDF */
export function structuredAnalysisToPdfInput(
  sa: any,
  clientName: string,
  extra: Partial<MealPlanPdfInput> = {},
): MealPlanPdfInput {
  const meals: MealPlanPdfInput['meals'] = [];
  const src = sa?.meal_plan?.meals || [];

  for (const meal of src) {
    // Se a refeição tem `options` (multi-cardápio), monta com badges Opção 1/2/...
    const options = Array.isArray((meal as any).options) && (meal as any).options.length
      ? (meal as any).options.map((op: any, i: number) => ({
          label: op.label || `Opção ${i + 1}`,
          lines: (op.food_groups || op.foods || []).map((fg: any) => ({
            text: `${fg.group ? fg.group + ' - ' : ''}${fg.options || fg.text || ''}`.trim(),
            substitutable: /\sou\s/i.test(String(fg.options || fg.text || '')),
          })),
        }))
      : undefined;

    const lines = !options
      ? (meal.food_groups || []).map((fg: any) => ({
          text: `${fg.options || ''}`.trim() || `${fg.group}`,
          substitutable: /\sou\s/i.test(String(fg.options || '')),
        }))
      : undefined;

    // Detecta kcal se vier no meal_macros ("~200 kcal ...")
    let kcal: string | undefined;
    if (meal.meal_macros) {
      const m = String(meal.meal_macros).match(/(\d{2,4})\s*kcal/i);
      if (m) kcal = m[1];
    }

    meals.push({
      time: meal.timing_note || meal.horario || undefined,
      name: meal.meal_name || 'Refeição',
      kcal,
      options,
      lines,
    });
  }

  return {
    clientName,
    dietType: sa?.carb_progression?.classification ? `Progressão CHO — ${sa.carb_progression.classification}` : 'Plano Alimentar',
    period: 'Todos os dias da semana',
    objective: sa?.strategic_orientations?.race_context || undefined,
    meals,
    ...extra,
  };
}

export async function downloadMealPlanPdf(input: MealPlanPdfInput, safeName: string) {
  const html = buildHTML(input);
  await htmlToPdf(html, `plano_alimentar_${safeName}.pdf`);
}
