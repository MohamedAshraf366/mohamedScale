import * as React from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// Country codes with flags
export const COUNTRY_CODES = [
  { code: '966', country: 'SA', flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: '971', country: 'AE', flag: '🇦🇪', name: 'UAE' },
  { code: '965', country: 'KW', flag: '🇰🇼', name: 'Kuwait' },
  { code: '974', country: 'QA', flag: '🇶🇦', name: 'Qatar' },
  { code: '973', country: 'BH', flag: '🇧🇭', name: 'Bahrain' },
  { code: '968', country: 'OM', flag: '🇴🇲', name: 'Oman' },
  { code: '20', country: 'EG', flag: '🇪🇬', name: 'Egypt' },
  { code: '962', country: 'JO', flag: '🇯🇴', name: 'Jordan' },
  { code: '961', country: 'LB', flag: '🇱🇧', name: 'Lebanon' },
  { code: '963', country: 'SY', flag: '🇸🇾', name: 'Syria' },
  { code: '964', country: 'IQ', flag: '🇮🇶', name: 'Iraq' },
  { code: '970', country: 'PS', flag: '🇵🇸', name: 'Palestine' },
  { code: '967', country: 'YE', flag: '🇾🇪', name: 'Yemen' },
  { code: '212', country: 'MA', flag: '🇲🇦', name: 'Morocco' },
  { code: '216', country: 'TN', flag: '🇹🇳', name: 'Tunisia' },
  { code: '213', country: 'DZ', flag: '🇩🇿', name: 'Algeria' },
  { code: '218', country: 'LY', flag: '🇱🇾', name: 'Libya' },
  { code: '249', country: 'SD', flag: '🇸🇩', name: 'Sudan' },
  { code: '1', country: 'US', flag: '🇺🇸', name: 'USA' },
  { code: '44', country: 'GB', flag: '🇬🇧', name: 'UK' },
  { code: '49', country: 'DE', flag: '🇩🇪', name: 'Germany' },
  { code: '33', country: 'FR', flag: '🇫🇷', name: 'France' },
  { code: '39', country: 'IT', flag: '🇮🇹', name: 'Italy' },
  { code: '34', country: 'ES', flag: '🇪🇸', name: 'Spain' },
  { code: '91', country: 'IN', flag: '🇮🇳', name: 'India' },
  { code: '92', country: 'PK', flag: '🇵🇰', name: 'Pakistan' },
  { code: '90', country: 'TR', flag: '🇹🇷', name: 'Turkey' },
] as const;

export type CountryCode = (typeof COUNTRY_CODES)[number];

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  defaultCountry?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Normalizes phone number: removes + prefix and spaces
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/^\+/, '').replace(/[\s-]/g, '');
}

/**
 * Parses a phone number to extract country code and national number
 */
export function parsePhone(phone: string): { countryCode: string; nationalNumber: string } {
  const normalized = normalizePhone(phone);
  
  // Try to match country codes (longest match first)
  const sortedCodes = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
  
  for (const cc of sortedCodes) {
    if (normalized.startsWith(cc.code)) {
      return {
        countryCode: cc.code,
        nationalNumber: normalized.slice(cc.code.length),
      };
    }
  }
  
  // Default to Saudi Arabia if no match
  return { countryCode: '966', nationalNumber: normalized };
}

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, placeholder = 'Phone number', defaultCountry = '966', disabled, className }, ref) => {
    const { countryCode, nationalNumber } = parsePhone(value || '');
    const [selectedCode, setSelectedCode] = React.useState(countryCode || defaultCountry);
    const [localNumber, setLocalNumber] = React.useState(nationalNumber);

    // Sync local state when value changes externally
    React.useEffect(() => {
      if (value) {
        const parsed = parsePhone(value);
        setSelectedCode(parsed.countryCode);
        setLocalNumber(parsed.nationalNumber);
      }
    }, [value]);

    const handleCodeChange = (code: string) => {
      setSelectedCode(code);
      // Update parent with normalized phone (no + prefix)
      const newValue = code + localNumber;
      onChange(normalizePhone(newValue));
    };

    const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Only allow digits, spaces, and dashes for input
      const input = e.target.value.replace(/[^\d\s-]/g, '');
      setLocalNumber(input);
      // Store normalized (just digits)
      const normalized = input.replace(/[\s-]/g, '');
      onChange(selectedCode + normalized);
    };

    const selectedCountry = COUNTRY_CODES.find((c) => c.code === selectedCode) || COUNTRY_CODES[0];

    return (
      <div className={cn('flex gap-2', className)}>
        <Select value={selectedCode} onValueChange={handleCodeChange} disabled={disabled}>
          <SelectTrigger className="w-[100px] shrink-0">
            <SelectValue>
              <span className="flex items-center gap-1.5">
                <span>{selectedCountry.flag}</span>
                <span className="text-muted-foreground">+{selectedCode}</span>
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {COUNTRY_CODES.map((country) => (
              <SelectItem key={country.code} value={country.code}>
                <span className="flex items-center gap-2">
                  <span>{country.flag}</span>
                  <span>{country.name}</span>
                  <span className="text-muted-foreground">+{country.code}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          ref={ref}
          type="tel"
          value={localNumber}
          onChange={handleNumberChange}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1"
        />
      </div>
    );
  }
);

PhoneInput.displayName = 'PhoneInput';
