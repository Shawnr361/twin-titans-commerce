/**
 * The countries the store delivers to, in one list.
 *
 * The store ships wherever its supplier delivers. Checkout used to offer 14
 * countries and supplier placement could map 12, so a shopper in Japan could
 * not order at all and a Portuguese order would have refused to place. The
 * checkout dropdown, supplier placement (ISO code and dialling code) and the
 * delivery rate now all read this one list, so they cannot disagree.
 *
 * The set mirrors the countries Google Merchant Center offers this account
 * (September 2026), plus a few West African neighbours. Adding a country here
 * makes it orderable everywhere at once — add the dialling code with it, or
 * supplier placement will reject the phone number.
 *
 * No imports: the browser bundle uses this.
 */
export interface Country {
  name: string;
  iso: string;
  dial: string;
}

export const COUNTRIES: Country[] = [
  { name: 'Nigeria', iso: 'NG', dial: '234' },
  { name: 'United Kingdom', iso: 'GB', dial: '44' },
  { name: 'United States', iso: 'US', dial: '1' },
  { name: 'Algeria', iso: 'DZ', dial: '213' },
  { name: 'Angola', iso: 'AO', dial: '244' },
  { name: 'Argentina', iso: 'AR', dial: '54' },
  { name: 'Australia', iso: 'AU', dial: '61' },
  { name: 'Austria', iso: 'AT', dial: '43' },
  { name: 'Bahrain', iso: 'BH', dial: '973' },
  { name: 'Bangladesh', iso: 'BD', dial: '880' },
  { name: 'Belarus', iso: 'BY', dial: '375' },
  { name: 'Belgium', iso: 'BE', dial: '32' },
  { name: 'Benin', iso: 'BJ', dial: '229' },
  { name: 'Brazil', iso: 'BR', dial: '55' },
  { name: 'Bulgaria', iso: 'BG', dial: '359' },
  { name: 'Cambodia', iso: 'KH', dial: '855' },
  { name: 'Cameroon', iso: 'CM', dial: '237' },
  { name: 'Canada', iso: 'CA', dial: '1' },
  { name: 'Chile', iso: 'CL', dial: '56' },
  { name: 'Colombia', iso: 'CO', dial: '57' },
  { name: 'Costa Rica', iso: 'CR', dial: '506' },
  { name: 'Côte d’Ivoire', iso: 'CI', dial: '225' },
  { name: 'Croatia', iso: 'HR', dial: '385' },
  { name: 'Cyprus', iso: 'CY', dial: '357' },
  { name: 'Czechia', iso: 'CZ', dial: '420' },
  { name: 'Denmark', iso: 'DK', dial: '45' },
  { name: 'Dominican Republic', iso: 'DO', dial: '1' },
  { name: 'Ecuador', iso: 'EC', dial: '593' },
  { name: 'Egypt', iso: 'EG', dial: '20' },
  { name: 'El Salvador', iso: 'SV', dial: '503' },
  { name: 'Estonia', iso: 'EE', dial: '372' },
  { name: 'Ethiopia', iso: 'ET', dial: '251' },
  { name: 'Finland', iso: 'FI', dial: '358' },
  { name: 'France', iso: 'FR', dial: '33' },
  { name: 'Georgia', iso: 'GE', dial: '995' },
  { name: 'Germany', iso: 'DE', dial: '49' },
  { name: 'Ghana', iso: 'GH', dial: '233' },
  { name: 'Greece', iso: 'GR', dial: '30' },
  { name: 'Guatemala', iso: 'GT', dial: '502' },
  { name: 'Hong Kong', iso: 'HK', dial: '852' },
  { name: 'Hungary', iso: 'HU', dial: '36' },
  { name: 'India', iso: 'IN', dial: '91' },
  { name: 'Indonesia', iso: 'ID', dial: '62' },
  { name: 'Ireland', iso: 'IE', dial: '353' },
  { name: 'Israel', iso: 'IL', dial: '972' },
  { name: 'Italy', iso: 'IT', dial: '39' },
  { name: 'Japan', iso: 'JP', dial: '81' },
  { name: 'Jordan', iso: 'JO', dial: '962' },
  { name: 'Kazakhstan', iso: 'KZ', dial: '7' },
  { name: 'Kenya', iso: 'KE', dial: '254' },
  { name: 'Kuwait', iso: 'KW', dial: '965' },
  { name: 'Latvia', iso: 'LV', dial: '371' },
  { name: 'Lebanon', iso: 'LB', dial: '961' },
  { name: 'Liechtenstein', iso: 'LI', dial: '423' },
  { name: 'Lithuania', iso: 'LT', dial: '370' },
  { name: 'Luxembourg', iso: 'LU', dial: '352' },
  { name: 'Madagascar', iso: 'MG', dial: '261' },
  { name: 'Malaysia', iso: 'MY', dial: '60' },
  { name: 'Malta', iso: 'MT', dial: '356' },
  { name: 'Mauritius', iso: 'MU', dial: '230' },
  { name: 'Mexico', iso: 'MX', dial: '52' },
  { name: 'Morocco', iso: 'MA', dial: '212' },
  { name: 'Mozambique', iso: 'MZ', dial: '258' },
  { name: 'Myanmar (Burma)', iso: 'MM', dial: '95' },
  { name: 'Nepal', iso: 'NP', dial: '977' },
  { name: 'Netherlands', iso: 'NL', dial: '31' },
  { name: 'New Zealand', iso: 'NZ', dial: '64' },
  { name: 'Nicaragua', iso: 'NI', dial: '505' },
  { name: 'Norway', iso: 'NO', dial: '47' },
  { name: 'Oman', iso: 'OM', dial: '968' },
  { name: 'Pakistan', iso: 'PK', dial: '92' },
  { name: 'Panama', iso: 'PA', dial: '507' },
  { name: 'Paraguay', iso: 'PY', dial: '595' },
  { name: 'Peru', iso: 'PE', dial: '51' },
  { name: 'Philippines', iso: 'PH', dial: '63' },
  { name: 'Poland', iso: 'PL', dial: '48' },
  { name: 'Portugal', iso: 'PT', dial: '351' },
  { name: 'Puerto Rico', iso: 'PR', dial: '1' },
  { name: 'Qatar', iso: 'QA', dial: '974' },
  { name: 'Romania', iso: 'RO', dial: '40' },
  { name: 'Russia', iso: 'RU', dial: '7' },
  { name: 'Rwanda', iso: 'RW', dial: '250' },
  { name: 'Saudi Arabia', iso: 'SA', dial: '966' },
  { name: 'Senegal', iso: 'SN', dial: '221' },
  { name: 'Singapore', iso: 'SG', dial: '65' },
  { name: 'Slovakia', iso: 'SK', dial: '421' },
  { name: 'Slovenia', iso: 'SI', dial: '386' },
  { name: 'South Africa', iso: 'ZA', dial: '27' },
  { name: 'South Korea', iso: 'KR', dial: '82' },
  { name: 'Spain', iso: 'ES', dial: '34' },
  { name: 'Sri Lanka', iso: 'LK', dial: '94' },
  { name: 'Sweden', iso: 'SE', dial: '46' },
  { name: 'Switzerland', iso: 'CH', dial: '41' },
  { name: 'Taiwan', iso: 'TW', dial: '886' },
  { name: 'Tanzania', iso: 'TZ', dial: '255' },
  { name: 'Thailand', iso: 'TH', dial: '66' },
  { name: 'Togo', iso: 'TG', dial: '228' },
  { name: 'Tunisia', iso: 'TN', dial: '216' },
  { name: 'Türkiye', iso: 'TR', dial: '90' },
  { name: 'Uganda', iso: 'UG', dial: '256' },
  { name: 'Ukraine', iso: 'UA', dial: '380' },
  { name: 'United Arab Emirates', iso: 'AE', dial: '971' },
  { name: 'Uruguay', iso: 'UY', dial: '598' },
  { name: 'Uzbekistan', iso: 'UZ', dial: '998' },
  { name: 'Venezuela', iso: 'VE', dial: '58' },
  { name: 'Vietnam', iso: 'VN', dial: '84' },
  { name: 'Zambia', iso: 'ZM', dial: '260' },
  { name: 'Zimbabwe', iso: 'ZW', dial: '263' },
];

/** Names older orders were saved with, before this list existed. */
const ALIASES: Record<string, string> = {
  usa: 'US',
  'united states of america': 'US',
  uk: 'GB',
  'great britain': 'GB',
  england: 'GB',
  turkey: 'TR',
  "cote d'ivoire": 'CI',
  'ivory coast': 'CI',
  myanmar: 'MM',
  'czech republic': 'CZ',
  uae: 'AE',
};

/** A country by name, alias or two-letter code; null when unknown. */
export function countryByName(value: string | null | undefined): Country | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  // Aliases first: "UK" is two letters but not an ISO code (Britain is GB).
  const iso = ALIASES[lower] ?? (/^[a-z]{2}$/i.test(raw) ? raw.toUpperCase() : undefined);
  return (
    COUNTRIES.find((c) => (iso ? c.iso === iso : c.name.toLowerCase() === lower)) ?? null
  );
}
