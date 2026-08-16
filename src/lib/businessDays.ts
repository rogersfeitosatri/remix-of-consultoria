/**
 * ETAPA 1 — Cálculo canônico de dias úteis (frontend).
 * Espelha `public.is_business_day` / `public.add_business_days`.
 * Sábado, domingo e feriados cadastrados nunca contam como dia útil.
 */

export type HolidaySet = Set<string>; // 'YYYY-MM-DD'

function key(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function toHolidaySet(dates: Array<string | { holiday_date: string }>): HolidaySet {
  return new Set(
    (dates || []).map((d) => (typeof d === 'string' ? d : d.holiday_date)).map((s) => s.slice(0, 10)),
  );
}

export function isBusinessDay(date: Date, holidays: HolidaySet = new Set()): boolean {
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return false;
  return !holidays.has(key(date));
}

export function addBusinessDays(from: Date, days: number, holidays: HolidaySet = new Set()): Date {
  const d = new Date(from.getTime());
  let remaining = Math.max(0, Math.floor(days || 0));
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    if (isBusinessDay(d, holidays)) remaining -= 1;
  }
  return d;
}

export function businessDaysBetween(from: Date, to: Date, holidays: HolidaySet = new Set()): number {
  if (to <= from) return 0;
  const d = new Date(from.getTime());
  let count = 0;
  while (d < to) {
    d.setDate(d.getDate() + 1);
    if (d <= to && isBusinessDay(d, holidays)) count += 1;
  }
  return count;
}

/** Próximo dia útil (o próprio dia, se já for útil). */
export function nextBusinessDay(from: Date, holidays: HolidaySet = new Set()): Date {
  const d = new Date(from.getTime());
  while (!isBusinessDay(d, holidays)) d.setDate(d.getDate() + 1);
  return d;
}
