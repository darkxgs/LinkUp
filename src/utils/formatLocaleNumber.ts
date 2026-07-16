/**
 * Consistent number formatting — matches app language (Arabic vs English digits).
 */
import i18n from 'i18next';

export function getAppNumberLocale(): string {
  return i18n.language?.startsWith('ar') ? 'ar-EG' : 'en-US';
}

export function formatAppNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  if (!Number.isFinite(value)) return '0';
  return value.toLocaleString(getAppNumberLocale(), options);
}
