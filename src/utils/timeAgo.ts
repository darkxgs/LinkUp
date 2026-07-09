/**
 * وقت نسبي مختصر («منذ 5 د») متوافق مع لغة التطبيق — يستخدم قسم time في الترجمة.
 * بديل موحّد عن النسخ المحلية المكتوبة عربيّاً فقط داخل المكوّنات.
 */
import i18n from '@/localization/i18n';

export function formatTimeAgo(ts: number): string {
  if (!ts) return '';
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return i18n.t('time.now');
  if (mins < 60) return i18n.t('time.minutesAgo', { count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return i18n.t('time.hoursAgo', { count: hrs });
  const days = Math.floor(hrs / 24);
  if (days < 7) return i18n.t('time.daysAgo', { count: days });
  const weeks = Math.floor(days / 7);
  return i18n.t('time.weeksAgo', { count: weeks });
}
