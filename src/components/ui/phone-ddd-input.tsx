import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Widget de WhatsApp/telefone com DDI (código do país) + DDD (código de área) +
// número. Guarda uma string única no formato "+55 (11) 99999-9999" — compatível
// com o restante do sistema, que trata telefone como texto.
const COUNTRY_CODES = [
  { code: '+55', flag: '🇧🇷', name: 'Brasil' },
  { code: '+1', flag: '🇺🇸', name: 'EUA/Canadá' },
  { code: '+351', flag: '🇵🇹', name: 'Portugal' },
  { code: '+34', flag: '🇪🇸', name: 'Espanha' },
  { code: '+44', flag: '🇬🇧', name: 'Reino Unido' },
  { code: '+33', flag: '🇫🇷', name: 'França' },
  { code: '+49', flag: '🇩🇪', name: 'Alemanha' },
  { code: '+39', flag: '🇮🇹', name: 'Itália' },
  { code: '+54', flag: '🇦🇷', name: 'Argentina' },
  { code: '+56', flag: '🇨🇱', name: 'Chile' },
  { code: '+57', flag: '🇨🇴', name: 'Colômbia' },
  { code: '+52', flag: '🇲🇽', name: 'México' },
  { code: '+598', flag: '🇺🇾', name: 'Uruguai' },
  { code: '+595', flag: '🇵🇾', name: 'Paraguai' },
];

interface Parts { ddi: string; ddd: string; number: string }

export function parsePhoneParts(value: string): Parts {
  if (!value || typeof value !== 'string') return { ddi: '+55', ddd: '', number: '' };
  let rest = value.trim();
  let ddi = '+55';
  const known = COUNTRY_CODES.map((c) => c.code).sort((a, b) => b.length - a.length);
  for (const code of known) {
    if (rest.startsWith(code)) { ddi = code; rest = rest.slice(code.length).trim(); break; }
  }
  // DDD entre parênteses "(11)" quando presente.
  const m = rest.match(/\((\d{1,3})\)\s*(.*)$/);
  if (m) return { ddi, ddd: m[1], number: m[2].trim() };
  // Sem parênteses: tenta separar 2 primeiros dígitos como DDD (padrão BR).
  const digits = rest.replace(/\D/g, '');
  if (ddi === '+55' && digits.length >= 10) {
    return { ddi, ddd: digits.slice(0, 2), number: digits.slice(2) };
  }
  return { ddi, ddd: '', number: rest };
}

export function buildPhone({ ddi, ddd, number }: Parts): string {
  const num = (number || '').trim();
  if (!num && !ddd) return '';
  return `${ddi}${ddd ? ` (${ddd})` : ''}${num ? ` ${num}` : ''}`.trim();
}

export { isPhoneComplete } from '@/lib/anamneseValidation';

export function PhoneDddInput({
  value, onChange, disabled, id,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  id?: string;
}) {
  const parsed = parsePhoneParts(value || '');
  const [ddi, setDdi] = useState(parsed.ddi);
  const [ddd, setDdd] = useState(parsed.ddd);
  const [number, setNumber] = useState(parsed.number);

  useEffect(() => {
    const p = parsePhoneParts(value || '');
    setDdi(p.ddi); setDdd(p.ddd); setNumber(p.number);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emit = (next: Partial<Parts>) => {
    const merged = { ddi, ddd, number, ...next };
    onChange(buildPhone(merged));
  };

  const sel = COUNTRY_CODES.find((c) => c.code === ddi) || COUNTRY_CODES[0];

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <div className="w-[112px] flex-shrink-0">
          <Select
            value={ddi}
            onValueChange={(v) => { setDdi(v); emit({ ddi: v }); }}
            disabled={disabled}
          >
            <SelectTrigger aria-label="DDI (país)">
              <SelectValue>
                <span className="flex items-center gap-1">
                  <span>{sel.flag}</span>
                  <span className="text-xs">{sel.code}</span>
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {COUNTRY_CODES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  <span className="flex items-center gap-2">
                    <span>{c.flag}</span>
                    <span className="text-xs text-muted-foreground">{c.code}</span>
                    <span className="text-sm">{c.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input
          aria-label="DDD"
          inputMode="numeric"
          value={ddd}
          disabled={disabled}
          placeholder="DDD"
          onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 3); setDdd(v); emit({ ddd: v }); }}
          className="w-[72px] flex-shrink-0 text-center"
        />
        <Input
          id={id}
          aria-label="Número"
          inputMode="numeric"
          value={number}
          disabled={disabled}
          placeholder="99999-9999"
          onChange={(e) => { setNumber(e.target.value); emit({ number: e.target.value }); }}
          className="flex-1"
        />
      </div>
      <p className="text-[11px] text-muted-foreground">DDI (país) · DDD (área) · número — ex.: 🇧🇷 +55 (11) 99999-9999</p>
    </div>
  );
}
