import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const COUNTRY_CODES = [
  { code: '+55', country: 'BR', flag: '🇧🇷', name: 'Brasil' },
  { code: '+1', country: 'US', flag: '🇺🇸', name: 'Estados Unidos' },
  { code: '+351', country: 'PT', flag: '🇵🇹', name: 'Portugal' },
  { code: '+34', country: 'ES', flag: '🇪🇸', name: 'Espanha' },
  { code: '+44', country: 'UK', flag: '🇬🇧', name: 'Reino Unido' },
  { code: '+33', country: 'FR', flag: '🇫🇷', name: 'França' },
  { code: '+49', country: 'DE', flag: '🇩🇪', name: 'Alemanha' },
  { code: '+39', country: 'IT', flag: '🇮🇹', name: 'Itália' },
  { code: '+54', country: 'AR', flag: '🇦🇷', name: 'Argentina' },
  { code: '+56', country: 'CL', flag: '🇨🇱', name: 'Chile' },
  { code: '+57', country: 'CO', flag: '🇨🇴', name: 'Colômbia' },
  { code: '+52', country: 'MX', flag: '🇲🇽', name: 'México' },
  { code: '+598', country: 'UY', flag: '🇺🇾', name: 'Uruguai' },
  { code: '+595', country: 'PY', flag: '🇵🇾', name: 'Paraguai' },
];

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  required?: boolean;
  className?: string;
}

// Parse phone to extract country code and number
function parsePhone(phone: string): { countryCode: string; number: string } {
  if (!phone) return { countryCode: '+55', number: '' };
  
  // Check if starts with a known country code
  for (const country of COUNTRY_CODES) {
    if (phone.startsWith(country.code)) {
      return { countryCode: country.code, number: phone.slice(country.code.length).trim() };
    }
  }
  
  // If starts with +, try to extract code
  if (phone.startsWith('+')) {
    const match = phone.match(/^(\+\d{1,4})\s*(.*)$/);
    if (match) {
      const foundCode = COUNTRY_CODES.find(c => c.code === match[1]);
      if (foundCode) {
        return { countryCode: match[1], number: match[2] };
      }
    }
  }
  
  // Default: Brazil and the whole string is the number
  return { countryCode: '+55', number: phone };
}

export function PhoneInput({ value, onChange, placeholder = '(00) 00000-0000', id, required, className }: PhoneInputProps) {
  const parsed = parsePhone(value);
  const [countryCode, setCountryCode] = useState(parsed.countryCode);
  const [phoneNumber, setPhoneNumber] = useState(parsed.number);

  useEffect(() => {
    const parsed = parsePhone(value);
    setCountryCode(parsed.countryCode);
    setPhoneNumber(parsed.number);
  }, [value]);

  const handleCountryChange = (newCode: string) => {
    setCountryCode(newCode);
    onChange(phoneNumber ? `${newCode} ${phoneNumber}` : '');
  };

  const handlePhoneChange = (newNumber: string) => {
    setPhoneNumber(newNumber);
    onChange(newNumber ? `${countryCode} ${newNumber}` : '');
  };

  const selectedCountry = COUNTRY_CODES.find(c => c.code === countryCode) || COUNTRY_CODES[0];

  return (
    <div className={`flex gap-2 ${className || ''}`}>
      <Select value={countryCode} onValueChange={handleCountryChange}>
        <SelectTrigger className="w-[100px] flex-shrink-0">
          <SelectValue>
            <span className="flex items-center gap-1">
              <span>{selectedCountry.flag}</span>
              <span className="text-xs">{selectedCountry.code}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {COUNTRY_CODES.map((country) => (
            <SelectItem key={country.code} value={country.code}>
              <span className="flex items-center gap-2">
                <span>{country.flag}</span>
                <span className="text-xs text-muted-foreground">{country.code}</span>
                <span className="text-sm">{country.name}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={id}
        value={phoneNumber}
        onChange={(e) => handlePhoneChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="flex-1"
      />
    </div>
  );
}
