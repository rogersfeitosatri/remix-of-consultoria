import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** ISO yyyy-mm-dd → dd/mm/yyyy */
export function toBR(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
}

/** dd/mm/yyyy → ISO yyyy-mm-dd (or '' if invalid/incomplete) */
export function fromBR(br: string): string {
  const digits = br.replace(/\D/g, '').slice(0, 8);
  if (digits.length !== 8) return '';
  const d = digits.slice(0, 2);
  const m = digits.slice(2, 4);
  const y = digits.slice(4, 8);
  const dn = Number(d), mn = Number(m), yn = Number(y);
  if (mn < 1 || mn > 12 || dn < 1 || dn > 31 || yn < 1900) return '';
  return `${y}-${m}-${d}`;
}

export function maskBR(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 8);
  if (digits.length > 4) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

interface DateInputBRProps {
  /** ISO yyyy-mm-dd value (or '') */
  value: string;
  /** Receives ISO yyyy-mm-dd (or '' while user is still typing) */
  onChange: (iso: string) => void;
  id?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

/** Masked dd/mm/aaaa text input that stores ISO yyyy-mm-dd. */
export function DateInputBR({
  value,
  onChange,
  id,
  className,
  required,
  disabled,
  placeholder = 'dd/mm/yyyy',
}: DateInputBRProps) {
  const [text, setText] = useState(toBR(value));
  useEffect(() => { setText(toBR(value)); }, [value]);
  return (
    <Input
      id={id}
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      value={text}
      required={required}
      disabled={disabled}
      className={cn(className)}
      onChange={(e) => {
        const masked = maskBR(e.target.value);
        setText(masked);
        const iso = fromBR(masked);
        if (iso) onChange(iso);
        else if (masked === '') onChange('');
      }}
    />
  );
}
