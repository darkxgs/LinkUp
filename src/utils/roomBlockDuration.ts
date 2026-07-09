export type RoomBlockDurationUnit = 'hour' | 'day' | 'week' | 'month';

export interface RoomBlockDuration {
  amount: number;
  unit: RoomBlockDurationUnit;
}

const UNIT_MS: Record<RoomBlockDurationUnit, number> = {
  hour: 3_600_000,
  day: 86_400_000,
  week: 7 * 86_400_000,
  month: 30 * 86_400_000,
};

export function computeBlockedUntil(duration: RoomBlockDuration): number {
  return Date.now() + duration.amount * UNIT_MS[duration.unit];
}

export function isRoomBlockActive(blockedUntil?: number | null): boolean {
  if (blockedUntil == null) return true;
  return blockedUntil > Date.now();
}

export function formatBlockRemaining(blockedUntil: number | null | undefined, locale = 'ar'): string {
  if (blockedUntil == null) {
    return locale.startsWith('ar') ? 'دائم' : 'Permanent';
  }
  const ms = blockedUntil - Date.now();
  if (ms <= 0) return locale.startsWith('ar') ? 'انتهى' : 'Expired';

  const hour = 3_600_000;
  const day = 86_400_000;
  if (ms < hour) {
    const m = Math.ceil(ms / 60_000);
    return locale.startsWith('ar') ? `${m} دقيقة` : `${m}m`;
  }
  if (ms < day) {
    const h = Math.ceil(ms / hour);
    return locale.startsWith('ar') ? `${h} ساعة` : `${h}h`;
  }
  if (ms < 7 * day) {
    const d = Math.ceil(ms / day);
    return locale.startsWith('ar') ? `${d} يوم` : `${d}d`;
  }
  if (ms < 30 * day) {
    const w = Math.ceil(ms / (7 * day));
    return locale.startsWith('ar') ? `${w} أسبوع` : `${w}w`;
  }
  const mo = Math.ceil(ms / (30 * day));
  return locale.startsWith('ar') ? `${mo} شهر` : `${mo}mo`;
}

export const BLOCK_DURATION_PRESETS: { labelAr: string; labelEn: string; duration: RoomBlockDuration }[] = [
  { labelAr: 'ساعة', labelEn: '1 hour', duration: { amount: 1, unit: 'hour' } },
  { labelAr: '6 ساعات', labelEn: '6 hours', duration: { amount: 6, unit: 'hour' } },
  { labelAr: 'يوم', labelEn: '1 day', duration: { amount: 1, unit: 'day' } },
  { labelAr: '3 أيام', labelEn: '3 days', duration: { amount: 3, unit: 'day' } },
  { labelAr: 'أسبوع', labelEn: '1 week', duration: { amount: 1, unit: 'week' } },
  { labelAr: 'شهر', labelEn: '1 month', duration: { amount: 1, unit: 'month' } },
];
