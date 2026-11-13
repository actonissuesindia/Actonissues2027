// A curated, not-exhaustive list of country calling codes — common enough
// to cover the vast majority of visitors without turning this into a
// 195-country picker. India is listed first since it's the default.
export const COUNTRY_CODES = [
  { code: '+91', flag: '🇮🇳', name: 'India' },
  { code: '+1', flag: '🇺🇸', name: 'US / Canada' },
  { code: '+44', flag: '🇬🇧', name: 'United Kingdom' },
  { code: '+61', flag: '🇦🇺', name: 'Australia' },
  { code: '+971', flag: '🇦🇪', name: 'UAE' },
  { code: '+966', flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: '+65', flag: '🇸🇬', name: 'Singapore' },
  { code: '+92', flag: '🇵🇰', name: 'Pakistan' },
  { code: '+880', flag: '🇧🇩', name: 'Bangladesh' },
  { code: '+94', flag: '🇱🇰', name: 'Sri Lanka' },
  { code: '+977', flag: '🇳🇵', name: 'Nepal' },
  { code: '+60', flag: '🇲🇾', name: 'Malaysia' },
  { code: '+86', flag: '🇨🇳', name: 'China' },
  { code: '+81', flag: '🇯🇵', name: 'Japan' },
  { code: '+82', flag: '🇰🇷', name: 'South Korea' },
  { code: '+49', flag: '🇩🇪', name: 'Germany' },
  { code: '+33', flag: '🇫🇷', name: 'France' },
  { code: '+39', flag: '🇮🇹', name: 'Italy' },
  { code: '+34', flag: '🇪🇸', name: 'Spain' },
  { code: '+7', flag: '🇷🇺', name: 'Russia' },
  { code: '+27', flag: '🇿🇦', name: 'South Africa' },
  { code: '+55', flag: '🇧🇷', name: 'Brazil' },
  { code: '+52', flag: '🇲🇽', name: 'Mexico' },
  { code: '+63', flag: '🇵🇭', name: 'Philippines' },
  { code: '+62', flag: '🇮🇩', name: 'Indonesia' },
  { code: '+66', flag: '🇹🇭', name: 'Thailand' },
  { code: '+84', flag: '🇻🇳', name: 'Vietnam' },
  { code: '+90', flag: '🇹🇷', name: 'Turkey' },
  { code: '+20', flag: '🇪🇬', name: 'Egypt' },
  { code: '+234', flag: '🇳🇬', name: 'Nigeria' },
  { code: '+254', flag: '🇰🇪', name: 'Kenya' },
  { code: '+64', flag: '🇳🇿', name: 'New Zealand' },
  { code: '+972', flag: '🇮🇱', name: 'Israel' },
  { code: '+31', flag: '🇳🇱', name: 'Netherlands' },
  { code: '+41', flag: '🇨🇭', name: 'Switzerland' },
  { code: '+46', flag: '🇸🇪', name: 'Sweden' },
  { code: '+353', flag: '🇮🇪', name: 'Ireland' }
];

export const DEFAULT_COUNTRY_CODE = '+91';

// A country-code dropdown + local-number field that together produce an
// E.164 phone number (e.g. "+919876543210") for Firebase phone auth.
// `number` is kept as digits-only local-app state; the caller combines
// `countryCode + number` when it actually needs the full E.164 string.
export default function PhoneNumberInput({ countryCode, onCountryCodeChange, number, onNumberChange, disabled, required = true }) {
  return (
    <div className="d-flex gap-2">
      <select
        className="form-select"
        style={{ maxWidth: 110, flexShrink: 0 }}
        value={countryCode}
        onChange={e => onCountryCodeChange(e.target.value)}
        disabled={disabled}
        aria-label="Country code"
      >
        {COUNTRY_CODES.map(c => (
          <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
        ))}
      </select>
      <input
        className="form-control"
        value={number}
        onChange={e => onNumberChange(e.target.value.replace(/\D/g, ''))}
        disabled={disabled}
        required={required}
        inputMode="numeric"
        placeholder="9876543210"
      />
    </div>
  );
}
