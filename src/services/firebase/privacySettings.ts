/**
 * إعدادات الخصوصية المتقدمة — مرتبطة بـ VIP / أرستقراطية
 * Firestore: config/privacy
 */
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { firestore } from './index';

export interface PrivacySettings {
  visitAnonymously: boolean;
  hideGiftHistory: boolean;
  hideFromRanking: boolean;
  hideInRoom: boolean;
  hideSvipIdentity: boolean;
  profileUnsearchable: boolean;
  hideWealthLevel: boolean;
  hideOnline: boolean;
  hideVisitors: boolean;
}

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  visitAnonymously: false,
  hideGiftHistory: false,
  hideFromRanking: false,
  hideInRoom: false,
  hideSvipIdentity: false,
  profileUnsearchable: false,
  hideWealthLevel: false,
  hideOnline: false,
  hideVisitors: false,
};

export type PrivacyFeatureKey = keyof Omit<PrivacySettings, 'hideVisitors'>;

export interface PrivacyFeatureDef {
  key: PrivacyFeatureKey;
  labelKey: string;
  labelAr?: string;
  labelEn?: string;
  lockLabelAr?: string;
  lockLabelEn?: string;
  /** vipLevel مطلوب (9 = SVIP1 في التطبيق) */
  requiredVipLevel?: number;
  /** مستوى أرستقراطية مطلوب */
  requiredAristocracyLevel?: number;
  /** نص القفل المخصص */
  lockLabelKey?: string;
}

export const PRIVACY_FEATURES: PrivacyFeatureDef[] = [
  { key: 'visitAnonymously', labelKey: 'privacy.visitAnonymously', requiredVipLevel: 9, lockLabelKey: 'privacy.lockSvip9' },
  { key: 'hideGiftHistory', labelKey: 'privacy.hideGiftHistory', requiredVipLevel: 10, lockLabelKey: 'privacy.lockSvip10' },
  { key: 'hideFromRanking', labelKey: 'privacy.hideFromRanking', requiredVipLevel: 11, lockLabelKey: 'privacy.lockSvip11' },
  { key: 'hideInRoom', labelKey: 'privacy.hideInRoom', requiredVipLevel: 12, lockLabelKey: 'privacy.lockSvip12' },
  { key: 'hideSvipIdentity', labelKey: 'privacy.hideSvipIdentity', requiredVipLevel: 12, lockLabelKey: 'privacy.lockSvip13' },
  { key: 'hideOnline', labelKey: 'privacy.hideOnline', labelAr: 'إخفاء حالة الاتصال (Online)', requiredVipLevel: 10, lockLabelKey: 'privacy.lockSvip10' },
  { key: 'profileUnsearchable', labelKey: 'privacy.profileUnsearchable', requiredAristocracyLevel: 8, lockLabelKey: 'privacy.lockLegend' },
  { key: 'hideWealthLevel', labelKey: 'privacy.hideWealthLevel', requiredVipLevel: 5, lockLabelKey: 'privacy.lockWealth' },
];

// ─── Admin config (config/privacy) ─────────────────────────────

export interface PrivacyFeatureConfig {
  key: PrivacyFeatureKey;
  labelAr: string;
  labelEn: string;
  lockLabelAr: string;
  lockLabelEn: string;
  requiredVipLevel?: number;
  requiredAristocracyLevel?: number;
  enabled: boolean;
  order: number;
}

export interface PrivacySystemConfig {
  enabled: boolean;
  titleAr: string;
  titleEn: string;
  introAr: string[];
  introEn: string[];
  features: PrivacyFeatureConfig[];
}

export const DEFAULT_PRIVACY_SYSTEM_CONFIG: PrivacySystemConfig = {
  enabled: true,
  titleAr: 'إعدادات الخصوصية',
  titleEn: 'Privacy Settings',
  introAr: [
    'بعض الخيارات تتطلب مستوى VIP أو أرستقراطية.',
    'عند التفعيل، يُطبَّق الإخفاء فوراً في الغرف والترتيب والبروفايل.',
  ],
  introEn: [],
  features: PRIVACY_FEATURES.map((f, i) => ({
    key: f.key,
    labelAr: '',
    labelEn: '',
    lockLabelAr: '',
    lockLabelEn: '',
    requiredVipLevel: f.requiredVipLevel,
    requiredAristocracyLevel: f.requiredAristocracyLevel,
    enabled: true,
    order: i + 1,
  })),
};

function sanitizePrivacyConfig(raw: Partial<PrivacySystemConfig>): PrivacySystemConfig {
  const merged = { ...DEFAULT_PRIVACY_SYSTEM_CONFIG, ...raw };
  return {
    ...merged,
    features: (merged.features ?? [])
      .filter((f) => f.key !== 'mysteriousPerson' as PrivacyFeatureKey)
      .filter((f) => PRIVACY_FEATURES.some((d) => d.key === f.key))
      .sort((a, b) => a.order - b.order),
  };
}

export function resolvePrivacyFeatures(config: PrivacySystemConfig): PrivacyFeatureDef[] {
  const sorted = [...config.features]
    .filter((f) => f.enabled && f.key !== ('mysteriousPerson' as PrivacyFeatureKey))
    .sort((a, b) => a.order - b.order);

  return sorted.map((f) => {
    const fallback = PRIVACY_FEATURES.find((d) => d.key === f.key);
    return {
      key: f.key,
      labelKey: fallback?.labelKey ?? `privacy.${f.key}`,
      labelAr: f.labelAr || undefined,
      labelEn: f.labelEn || undefined,
      lockLabelAr: f.lockLabelAr || undefined,
      lockLabelEn: f.lockLabelEn || undefined,
      requiredVipLevel: f.requiredVipLevel ?? fallback?.requiredVipLevel,
      requiredAristocracyLevel: f.requiredAristocracyLevel ?? fallback?.requiredAristocracyLevel,
      lockLabelKey: fallback?.lockLabelKey,
    };
  });
}

export type PrivacyFeatureDefResolved = PrivacyFeatureDef & {
  labelAr?: string;
  labelEn?: string;
  lockLabelAr?: string;
  lockLabelEn?: string;
};

export const subscribeToPrivacyConfig = (
  cb: (config: PrivacySystemConfig) => void,
): (() => void) => {
  const ref = doc(firestore, 'config', 'privacy');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        cb(sanitizePrivacyConfig(snap.data() as Partial<PrivacySystemConfig>));
      } else {
        cb(DEFAULT_PRIVACY_SYSTEM_CONFIG);
      }
    },
    () => cb(DEFAULT_PRIVACY_SYSTEM_CONFIG),
  );
};

export const getPrivacyConfigOnce = async (): Promise<PrivacySystemConfig> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'privacy'));
    return snap.exists()
      ? sanitizePrivacyConfig(snap.data() as Partial<PrivacySystemConfig>)
      : DEFAULT_PRIVACY_SYSTEM_CONFIG;
  } catch {
    return DEFAULT_PRIVACY_SYSTEM_CONFIG;
  }
};

export function mergePrivacySettings(raw?: Partial<PrivacySettings> | null): PrivacySettings {
  const { mysteriousPerson: _removed, ...rest } = (raw ?? {}) as Partial<PrivacySettings> & { mysteriousPerson?: boolean };
  return { ...DEFAULT_PRIVACY_SETTINGS, ...rest };
}

export function readPrivacyFromUser(data: Record<string, unknown> | null | undefined): PrivacySettings {
  const nested = data?.privacySettings as Partial<PrivacySettings> | null | undefined;
  const merged = mergePrivacySettings(nested);
  if (typeof data?.privacyHideOnline === 'boolean') merged.hideOnline = data.privacyHideOnline;
  if (typeof data?.privacyHideVisitors === 'boolean') merged.hideVisitors = data.privacyHideVisitors;
  return merged;
}

export function canUsePrivacyFeature(
  feature: PrivacyFeatureDef,
  ctx: {
    vipLevel: number;
    aristocracyLevel: number;
  },
): boolean {
  if (feature.requiredAristocracyLevel && ctx.aristocracyLevel < feature.requiredAristocracyLevel) return false;
  if (feature.requiredVipLevel && ctx.vipLevel < feature.requiredVipLevel) return false;
  return true;
}

export async function getPrivacySettings(uid: string): Promise<PrivacySettings> {
  const snap = await getDoc(doc(firestore, 'users', uid));
  if (!snap.exists()) return { ...DEFAULT_PRIVACY_SETTINGS };
  return readPrivacyFromUser(snap.data());
}

export async function updatePrivacySettings(
  uid: string,
  patch: Partial<PrivacySettings>,
): Promise<void> {
  // تحديث الحقول المتغيّرة فقط بمسارات نقطية — القراءة ثم إعادة كتابة الخريطة كاملة
  // كانت تُرجِع التبديلات السريعة المتتالية لقيم قديمة (سباق read-modify-write)
  const updatePayload: Record<string, boolean | number> = { updatedAt: Date.now() };
  for (const [key, value] of Object.entries(patch)) {
    if (typeof value !== 'boolean') continue;
    if (key === 'hideOnline') updatePayload.privacyHideOnline = value;
    else if (key === 'hideVisitors') updatePayload.privacyHideVisitors = value;
    else updatePayload[`privacySettings.${key}`] = value;
  }
  await updateDoc(doc(firestore, 'users', uid), updatePayload);
}

export function subscribePrivacySettings(
  uid: string,
  cb: (s: PrivacySettings) => void,
): () => void {
  return onSnapshot(
    doc(firestore, 'users', uid),
    (snap) => cb(readPrivacyFromUser(snap.data())),
    () => cb({ ...DEFAULT_PRIVACY_SETTINGS }),
  );
}
