import { ALL_COUNTRIES } from '@/data/countries';

/** توحيد رمز الدولة (ISO) للمقارنة والاستعلام */
export function normalizeCountryCode(code?: string | null): string | undefined {
  if (!code || typeof code !== 'string') return undefined;
  const c = code.trim().toUpperCase();
  if (!c || c === 'WW' || c === 'GLOBAL') return undefined;
  return c;
}

const LEGACY_COUNTRY_ALIASES: ReadonlyArray<readonly [string, string]> = [
  ['syria', 'SY'],
  ['سوريا', 'SY'],
  ['saudi', 'SA'],
  ['السعودية', 'SA'],
  ['سعودي', 'SA'],
  ['egypt', 'EG'],
  ['مصر', 'EG'],
  ['iraq', 'IQ'],
  ['العراق', 'IQ'],
  ['yemen', 'YE'],
  ['اليمن', 'YE'],
  ['jordan', 'JO'],
  ['الأردن', 'JO'],
  ['palestine', 'PS'],
  ['فلسطين', 'PS'],
];

/** يحوّل قيمة الدولة المخزّنة (رمز ISO أو اسم) إلى رمز ISO للعلم */
export function resolveCountryCodeFromValue(value?: string | null): string | undefined {
  const direct = normalizeCountryCode(value);
  if (direct) return direct;

  const raw = value?.trim();
  if (!raw) return undefined;

  const lower = raw.toLowerCase();
  for (const [needle, code] of LEGACY_COUNTRY_ALIASES) {
    if (lower.includes(needle)) return code;
  }

  const exact = ALL_COUNTRIES.find((c) => c.name === raw || c.code === raw.toUpperCase());
  return exact?.code;
}

export function isSameCountry(
  userCountry?: string | null,
  myCountry?: string | null,
): boolean {
  const mine = normalizeCountryCode(myCountry);
  const theirs = normalizeCountryCode(userCountry);
  if (!mine || !theirs) return false;
  return mine === theirs;
}
