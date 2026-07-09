/**
 * أدوات شارة أمير الوكلاء — بدون استيراد Firebase (تجنّب التبعيات الدائرية)
 */
import type { AgencyPrinceConfig, UserAgencyPrince } from './agencyPrinceTypes';

export function currentMonthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function readUserAgencyPrince(raw: unknown): UserAgencyPrince | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.active !== true) return null;
  const monthKey = String(o.monthKey ?? '');
  if (monthKey && monthKey !== currentMonthKey()) return null;
  return {
    active: true,
    monthKey,
    agencyId: String(o.agencyId ?? ''),
    agencyName: String(o.agencyName ?? ''),
    badgeImageUrl: o.badgeImageUrl ? String(o.badgeImageUrl) : null,
    entryImageUrl: o.entryImageUrl ? String(o.entryImageUrl) : null,
    entryAnimationUrl: o.entryAnimationUrl ? String(o.entryAnimationUrl) : null,
    entryVideoUrl: o.entryVideoUrl ? String(o.entryVideoUrl) : null,
    entryVideoUrlMp4: o.entryVideoUrlMp4 ? String(o.entryVideoUrlMp4) : null,
    frameImageUrl: o.frameImageUrl ? String(o.frameImageUrl) : null,
    bubbleImageUrl: o.bubbleImageUrl ? String(o.bubbleImageUrl) : null,
    grantedAt: Number(o.grantedAt ?? 0),
  };
}

export function isAgencyPrinceUser(
  uid: string | undefined | null,
  config: AgencyPrinceConfig,
  userPrince?: UserAgencyPrince | null,
): boolean {
  if (!uid || !config.enabled) return false;
  if (userPrince?.active && userPrince.monthKey === currentMonthKey()) return true;
  const holder = config.currentHolder;
  return Boolean(holder && holder.uid === uid && holder.monthKey === currentMonthKey());
}

/** شارة «الشارة» من config/agencyPrince — المصدر المعتمد للصورة المرفوعة */
export function resolveAgencyPrinceBadgeUrl(
  config: AgencyPrinceConfig,
  userPrince?: UserAgencyPrince | null,
): string | undefined {
  const fromConfig = config.badgeImageUrl?.trim();
  if (fromConfig) return fromConfig;
  const fromUser = userPrince?.badgeImageUrl?.trim();
  return fromUser || undefined;
}

export function resolveAgencyPrinceBadgeForUser(
  uid: string | undefined | null,
  config: AgencyPrinceConfig,
  userPrinceRaw?: unknown,
): string | undefined {
  const userPrince = readUserAgencyPrince(userPrinceRaw ?? null);
  if (!isAgencyPrinceUser(uid, config, userPrince)) return undefined;
  return resolveAgencyPrinceBadgeUrl(config, userPrince);
}
