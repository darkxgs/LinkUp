import i18n from '@/localization/i18n';

export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return i18n.t('common.justNow');
  const min = Math.floor(sec / 60);
  if (min < 60) return i18n.t('common.minutesAgo', { count: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return i18n.t('common.hoursAgo', { count: hr });
  const days = Math.floor(hr / 24);
  return i18n.t('common.daysAgo', { count: days });
}
