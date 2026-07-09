/**
 * رسالة الترحيب الثابتة لغرف الوكالات — بديل عن تثبيت رسائل مخصصة
 */
import i18n from '@/localization/i18n';

export function getAgencyRoomWelcomeTitle(agencyName: string): string {
  const name = agencyName.trim() || 'LinkUp';
  return i18n.t('room.agencyWelcomeTitle', { name });
}

export function getAgencyRoomWelcomeBody(): string {
  return i18n.t('room.agencyWelcomeBody');
}

/** نص كامل للشريط المثبّت أو رأس الشات */
export function getAgencyRoomWelcomeText(agencyName: string): string {
  return `${getAgencyRoomWelcomeTitle(agencyName)}\n\n${getAgencyRoomWelcomeBody()}`;
}
