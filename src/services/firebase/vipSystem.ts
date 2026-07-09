/**
 * نظام VIP — نقاط الشحن، المستويات، والامتيازات
 * مرتبط بـ config/vipSystem في Firestore ولوحة التحكم
 */
import {
  doc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  onSnapshot,
  setDoc,
  runTransaction,
} from 'firebase/firestore';
import { firestore, auth } from './index';
import {
  buildBalanceIncrementPatch,
  statsFromFirestoreDoc,
} from '@/utils/userBalance';

// ==================== TYPES ====================

export type VipMode = 'vip' | 'svip';

export interface VipLevelDef {
  level: number;
  label: string;
  /** سعر ثابت بالكوينز لشراء هذا المستوى */
  priceCoins: number;
  /** نقاط شحن شهرية مطلوبة للحفاظ على المستوى */
  maintainPoints: number;
  mode: VipMode;
  imageUrl?: string;
  /** أيقونة متحركة (GIF) — اختياري */
  imageAnimatedUrl?: string;
  /** خلفية الشاشة (صورة) */
  backgroundImageUrl?: string;
  /** تدرّج الخلفية [top, mid, bottom] */
  bgColors?: [string, string, string];
  accentColor?: string;
  heroSubtitleAr?: string;
  heroSubtitleEn?: string;
  /** امتيازات مخصصة لهذا المستوى — من لوحة التحكم */
  levelPrivileges?: VipPrivilegeDef[];
  /** معرّفات عناصر المتجر (config/store) لهذا المستوى */
  storeItemIds?: string[];
  enabled?: boolean;
  /** @deprecated استخدم priceCoins */
  minPoints?: number;
  maxPoints?: number | null;
}

export interface VipQuickAction {
  id: string;
  labelAr: string;
  labelEn: string;
  route?: string;
  enabled?: boolean;
}

export type VipPrivilegeAsset =
  | 'vipBadge'
  | 'vipSeat'
  | 'entryEffect'
  | 'chatBubble'
  | 'profileCard'
  | 'vipEntry'
  | 'photoFrame'
  | 'honorMedal'
  // — امتيازات SVIP الموسّعة (وظيفية + بصرية) —
  | 'exclusiveGifts'
  | 'visitorsLog'
  | 'flyingMessage'
  | 'upgradeAnnouncement'
  | 'specialSoundEffect'
  | 'specialRoomId'
  | 'specialId'
  | 'roomBackground'
  | 'invisibleVisitor'
  | 'exclusiveSupport'
  | 'hideOnline'
  | 'hideGiftHistory'
  | 'luckyBagMax'
  | 'animatedAvatar'
  | 'hiddenRanking'
  | 'extraRoomAdmins'
  | 'antiMute'
  | 'appWideMessage'
  | 'hiddenPresence'
  | 'hiddenVipIdentity'
  | 'antiKick'
  | 'removeBan'
  | 'comingSoon';

/** الامتيازات الوظيفية (سلوك حقيقي) مقابل البصرية (صورة/فيديو) */
export const VIP_FEATURE_KEYS: ReadonlySet<VipPrivilegeAsset> = new Set([
  'exclusiveGifts', 'visitorsLog', 'flyingMessage', 'upgradeAnnouncement',
  'specialRoomId', 'specialId', 'invisibleVisitor', 'exclusiveSupport',
  'hideOnline', 'hideGiftHistory', 'luckyBagMax', 'animatedAvatar',
  'hiddenRanking', 'extraRoomAdmins', 'antiMute', 'appWideMessage',
  'hiddenPresence', 'hiddenVipIdentity', 'antiKick', 'removeBan',
]);

export interface VipPrivilegeDef {
  id: string;
  assetKey: VipPrivilegeAsset;
  titleKey: string;
  descKey: string;
  unlockLevel: number;
  mode: VipMode;
  order: number;
  title?: string;
  desc?: string;
  imageUrl?: string;
  videoUrl?: string;
  videoUrlMp4?: string;
  /** ملف صوتي (لتأثير الدخول الصوتي specialSoundEffect) */
  soundUrl?: string;
  /** إذا false يُخفى من التطبيق */
  enabled?: boolean;
}

export interface VipSystemConfig {
  levels: VipLevelDef[];
  privileges: VipPrivilegeDef[];
  pointPerCoin: number;
  /** مدة العضوية بالأيام (افتراضي 30) */
  validityDays: number;
  /** المستوى عند فشل الحفاظ الشهري (افتراضي SVIP1) */
  downgradeToLevel: number;
  /** أيام التحذير قبل انتهاء الباقة (افتراضي 5) */
  expiryWarningDays: number;
  screenTitleAr?: string;
  screenTitleEn?: string;
  privilegesSectionAr?: string;
  privilegesSectionEn?: string;
  quickActions?: VipQuickAction[];
  updatedAt?: number;
}

export interface VipUserState {
  vipPoints: number;
  vipPointsMonth: number;
  vipLevel: number;
  isVIP: boolean;
  vipExpiresAt: number | null;
}

// ==================== DEFAULTS ====================

/** عتبات SVIP الافتراضية — نقاط تراكمية (شحن + تحويل كازينو + أرباح ألعاب كوينز) */
export function buildDefaultSvipLevels(): VipLevelDef[] {
  return [
    { level: 1, label: 'SVIP1', priceCoins: 1_000_000, maintainPoints: 500_000, mode: 'svip' },
    { level: 2, label: 'SVIP2', priceCoins: 2_000_000, maintainPoints: 1_000_000, mode: 'svip' },
    { level: 3, label: 'SVIP3', priceCoins: 4_000_000, maintainPoints: 2_000_000, mode: 'svip' },
    { level: 4, label: 'SVIP4', priceCoins: 6_000_000, maintainPoints: 5_000_000, mode: 'svip' },
    { level: 5, label: 'SVIP5', priceCoins: 10_000_000, maintainPoints: 9_000_000, mode: 'svip' },
    { level: 6, label: 'SVIP6', priceCoins: 15_000_000, maintainPoints: 12_500_000, mode: 'svip' },
    { level: 7, label: 'SVIP7', priceCoins: 20_000_000, maintainPoints: 17_500_000, mode: 'svip' },
    { level: 8, label: 'SVIP8', priceCoins: 25_000_000, maintainPoints: 22_500_000, mode: 'svip' },
    { level: 9, label: 'SVIP9', priceCoins: 50_000_000, maintainPoints: 37_500_000, mode: 'svip' },
    { level: 10, label: 'SVIP10', priceCoins: 100_000_000, maintainPoints: 75_000_000, mode: 'svip' },
    { level: 11, label: 'SVIP11', priceCoins: 150_000_000, maintainPoints: 125_000_000, mode: 'svip' },
    { level: 12, label: 'SVIP12', priceCoins: 200_000_000, maintainPoints: 175_000_000, mode: 'svip' },
  ];
}

export const DEFAULT_VIP_SYSTEM: VipSystemConfig = {
  pointPerCoin: 1,
  validityDays: 30,
  downgradeToLevel: 1,
  expiryWarningDays: 5,
  levels: buildDefaultSvipLevels(),
  privileges: [
    { id: 'vip-badge', assetKey: 'vipBadge', titleKey: 'vipHub.privilegeBadge', descKey: 'vipHub.privilegeBadgeDesc', unlockLevel: 1, mode: 'svip', order: 1, title: 'علامة VIP', desc: 'شعار SVIP حصري يظهر على صورتك الشخصية وفي غرف الدردشة لتتميز بين الجميع.' },
    { id: 'exclusive-gifts', assetKey: 'exclusiveGifts', titleKey: 'vipHub.privExclusiveGifts', descKey: 'vipHub.privExclusiveGiftsDesc', unlockLevel: 1, mode: 'svip', order: 2, title: 'هدايا حصرية', desc: 'باقة هدايا فاخرة لا تتوفّر إلا لأعضاء SVIP.' },
    { id: 'visitors-log', assetKey: 'visitorsLog', titleKey: 'vipHub.privVisitorsLog', descKey: 'vipHub.privVisitorsLogDesc', unlockLevel: 1, mode: 'svip', order: 3, title: 'سجل الزوار', desc: 'اطّلع على قائمة كاملة بمن زار ملفك الشخصي.' },
    { id: 'vip-seat', assetKey: 'vipSeat', titleKey: 'vipHub.privilegeSeat', descKey: 'vipHub.privilegeSeatDesc', unlockLevel: 2, mode: 'svip', order: 4, title: 'مقعد VIP', desc: 'تصميم مقعد مذهل وخاص عند صعودك على المنصة في الغرف.' },
    { id: 'flying-message', assetKey: 'flyingMessage', titleKey: 'vipHub.privFlyingMessage', descKey: 'vipHub.privFlyingMessageDesc', unlockLevel: 3, mode: 'svip', order: 5, title: 'رسائل طائرة', desc: 'أرسل رسالة متحركة تعبر شاشة الغرفة ليراها الجميع.' },
    { id: 'entry-effect', assetKey: 'entryEffect', titleKey: 'vipHub.privilegeEntry', descKey: 'vipHub.privilegeEntryDesc', unlockLevel: 4, mode: 'svip', order: 6, title: 'تأثير الدخول الحصري', desc: 'تأثير دخول متحرك وجذاب عند دخولك أي غرفة دردشة ليلاحظك الجميع.' },
    { id: 'upgrade-announcement', assetKey: 'upgradeAnnouncement', titleKey: 'vipHub.privUpgradeAnnouncement', descKey: 'vipHub.privUpgradeAnnouncementDesc', unlockLevel: 5, mode: 'svip', order: 7, title: 'إعلان الترقية', desc: 'إعلان احتفالي يظهر للجميع عند ترقية مستواك.' },
    { id: 'chat-bubble', assetKey: 'chatBubble', titleKey: 'vipHub.privilegeBubble', descKey: 'vipHub.privilegeBubbleDesc', unlockLevel: 6, mode: 'svip', order: 8, title: 'فقاعة الكتابة', desc: 'لون وتصميم خاص لفقاعة رسائلك داخل غرف الدردشة.' },
    { id: 'photo-frame', assetKey: 'photoFrame', titleKey: 'vipHub.privilegeFrame', descKey: 'vipHub.privilegeFrameDesc', unlockLevel: 6, mode: 'svip', order: 9, title: 'إطار الصورة', desc: 'إطار ذهبي وفخم يحيط بصورتك الشخصية أينما ظهرت.' },
    { id: 'vip-entry', assetKey: 'vipEntry', titleKey: 'vipHub.privilegeVipEntry', descKey: 'vipHub.privilegeVipEntryDesc', unlockLevel: 6, mode: 'svip', order: 10, title: 'دخولية VIP', desc: 'مركبة فاخرة متحركة ترافق دخولك للغرفة.' },
    { id: 'profile-card', assetKey: 'profileCard', titleKey: 'vipHub.privilegeCard', descKey: 'vipHub.privilegeCardDesc', unlockLevel: 6, mode: 'svip', order: 11, title: 'بطاقة الملف الشخصي', desc: 'خلفية وتأثيرات ساحرة لبطاقة ملفك الشخصي تبرز فخامتك.' },
    { id: 'special-sound-effect', assetKey: 'specialSoundEffect', titleKey: 'vipHub.privSpecialSound', descKey: 'vipHub.privSpecialSoundDesc', unlockLevel: 7, mode: 'svip', order: 12, title: 'تأثير صوتي مميز', desc: 'مؤثر صوتي خاص يصدح عند دخولك الغرفة.' },
    { id: 'special-room-id', assetKey: 'specialRoomId', titleKey: 'vipHub.privSpecialRoomId', descKey: 'vipHub.privSpecialRoomIdDesc', unlockLevel: 8, mode: 'svip', order: 13, title: 'أيدي غرفة مميز', desc: 'معرّف غرفة مميز يسهل تذكّره ويبرز غرفتك.' },
    { id: 'special-id', assetKey: 'specialId', titleKey: 'vipHub.privSpecialId', descKey: 'vipHub.privSpecialIdDesc', unlockLevel: 8, mode: 'svip', order: 14, title: 'أيدي مميز', desc: 'معرّف حساب مميز قصير يميّزك عن الآخرين.' },
    { id: 'room-background', assetKey: 'roomBackground', titleKey: 'vipHub.privRoomBackground', descKey: 'vipHub.privRoomBackgroundDesc', unlockLevel: 8, mode: 'svip', order: 15, title: 'خلفية الغرفة', desc: 'خلفيات حصرية لتزيين غرفتك الصوتية.' },
    { id: 'invisible-visitor', assetKey: 'invisibleVisitor', titleKey: 'vipHub.privInvisibleVisitor', descKey: 'vipHub.privInvisibleVisitorDesc', unlockLevel: 9, mode: 'svip', order: 16, title: 'زائر خفي', desc: 'تصفّح ملفات الآخرين دون أن يظهر اسمك في سجل الزوار.' },
    { id: 'exclusive-support', assetKey: 'exclusiveSupport', titleKey: 'vipHub.privExclusiveSupport', descKey: 'vipHub.privExclusiveSupportDesc', unlockLevel: 9, mode: 'svip', order: 17, title: 'خدمة عملاء حصرية', desc: 'دعم فني مميز وذو أولوية على مدار الساعة.' },
    { id: 'hide-online', assetKey: 'hideOnline', titleKey: 'vipHub.privHideOnline', descKey: 'vipHub.privHideOnlineDesc', unlockLevel: 10, mode: 'svip', order: 18, title: 'إخفاء حالة Online', desc: 'أخفِ حالة اتصالك فلا يعرف أحد متى تكون متصلاً.' },
    { id: 'hide-gift-history', assetKey: 'hideGiftHistory', titleKey: 'vipHub.privHideGiftHistory', descKey: 'vipHub.privHideGiftHistoryDesc', unlockLevel: 10, mode: 'svip', order: 19, title: 'إخفاء سجل الهدايا', desc: 'أخفِ سجل الهدايا المستلمة عن الآخرين.' },
    { id: 'lucky-bag-max', assetKey: 'luckyBagMax', titleKey: 'vipHub.privLuckyBagMax', descKey: 'vipHub.privLuckyBagMaxDesc', unlockLevel: 10, mode: 'svip', order: 20, title: 'زيادة الحد الأقصى لحقيبة الحظ', desc: 'ارفع الحد الأقصى لعدد فاتحي حقيبة الحظ.' },
    { id: 'animated-avatar', assetKey: 'animatedAvatar', titleKey: 'vipHub.privAnimatedAvatar', descKey: 'vipHub.privAnimatedAvatarDesc', unlockLevel: 11, mode: 'svip', order: 21, title: 'صورة متحركة', desc: 'استخدم صورة شخصية متحركة (GIF) تلفت الأنظار.' },
    { id: 'hidden-ranking', assetKey: 'hiddenRanking', titleKey: 'vipHub.privHiddenRanking', descKey: 'vipHub.privHiddenRankingDesc', unlockLevel: 11, mode: 'svip', order: 22, title: 'ترتيب خفي', desc: 'اختفِ من قوائم المتصدّرين والترتيب العام.' },
    { id: 'extra-room-admins', assetKey: 'extraRoomAdmins', titleKey: 'vipHub.privExtraRoomAdmins', descKey: 'vipHub.privExtraRoomAdminsDesc', unlockLevel: 11, mode: 'svip', order: 23, title: 'زيادة عدد مشرفين الغرفة', desc: 'عيّن عدداً أكبر من المشرفين في غرفتك.' },
    { id: 'anti-mute', assetKey: 'antiMute', titleKey: 'vipHub.privAntiMute', descKey: 'vipHub.privAntiMuteDesc', unlockLevel: 12, mode: 'svip', order: 24, title: 'ضد التصميت', desc: 'لا يستطيع أحد كتم صوتك داخل الغرف.' },
    { id: 'app-wide-message', assetKey: 'appWideMessage', titleKey: 'vipHub.privAppWideMessage', descKey: 'vipHub.privAppWideMessageDesc', unlockLevel: 12, mode: 'svip', order: 25, title: 'رسائل على مستوى التطبيق', desc: 'أرسل رسالة تظهر لكل مستخدمي التطبيق.' },
    { id: 'hidden-presence', assetKey: 'hiddenPresence', titleKey: 'vipHub.privHiddenPresence', descKey: 'vipHub.privHiddenPresenceDesc', unlockLevel: 12, mode: 'svip', order: 26, title: 'تواجد خفي', desc: 'ادخل الغرف دون أن يظهر اسمك في قائمة الحضور.' },
    { id: 'hidden-vip-identity', assetKey: 'hiddenVipIdentity', titleKey: 'vipHub.privHiddenVipIdentity', descKey: 'vipHub.privHiddenVipIdentityDesc', unlockLevel: 12, mode: 'svip', order: 27, title: 'هوية VIP مخفية', desc: 'أخفِ شارة الـ VIP وتنقّل بهوية عادية متى شئت.' },
    { id: 'anti-kick', assetKey: 'antiKick', titleKey: 'vipHub.privAntiKick', descKey: 'vipHub.privAntiKickDesc', unlockLevel: 12, mode: 'svip', order: 28, title: 'ضد الطرد', desc: 'لا يستطيع أحد طردك من الغرف.' },
    { id: 'remove-ban', assetKey: 'removeBan', titleKey: 'vipHub.privRemoveBan', descKey: 'vipHub.privRemoveBanDesc', unlockLevel: 12, mode: 'svip', order: 29, title: 'إلغاء الحظر', desc: 'تجاوز الحظر وادخل الغرف التي حُظرت منها.' },
    { id: 'coming-soon', assetKey: 'comingSoon', titleKey: 'vipHub.privComingSoon', descKey: 'vipHub.privComingSoonDesc', unlockLevel: 12, mode: 'svip', order: 30, title: 'قريباً', desc: 'امتياز حصري جديد يُكشف عنه قريباً.' },
  ],
  screenTitleAr: 'SVIP',
  screenTitleEn: 'SVIP',
  privilegesSectionAr: 'امتيازات',
  privilegesSectionEn: 'Privileges',
  quickActions: [
    { id: 'perks', labelAr: 'إمتياز', labelEn: 'Perks', route: '/vip', enabled: true },
    { id: 'tasks', labelAr: 'مهمة', labelEn: 'Tasks', route: '/wealth-level', enabled: true },
    { id: 'honor', labelAr: 'تشريف', labelEn: 'Honor', route: '/vip/rules', enabled: true },
  ],
};

export function normalizeVipPrivilegeDef(raw: VipPrivilegeDef): VipPrivilegeDef {
  return {
    ...raw,
    title: raw.title?.trim() || undefined,
    desc: raw.desc?.trim() || undefined,
    imageUrl: raw.imageUrl?.trim() || undefined,
    videoUrl: raw.videoUrl?.trim() || undefined,
    videoUrlMp4: raw.videoUrlMp4?.trim() || undefined,
    enabled: raw.enabled !== false,
  };
}

export function normalizeVipLevelDef(raw: VipLevelDef): VipLevelDef {
  const priceCoins = raw.priceCoins ?? raw.minPoints ?? 0;
  const bg = raw.bgColors;
  const bgColors =
    Array.isArray(bg) && bg.length >= 3
      ? ([String(bg[0]), String(bg[1]), String(bg[2])] as [string, string, string])
      : undefined;
  return {
    level: raw.level,
    label: raw.label,
    priceCoins,
    maintainPoints: raw.maintainPoints ?? 0,
    mode: raw.mode ?? 'svip',
    imageUrl: raw.imageUrl?.trim() || undefined,
    imageAnimatedUrl: raw.imageAnimatedUrl?.trim() || undefined,
    backgroundImageUrl: raw.backgroundImageUrl?.trim() || undefined,
    bgColors,
    accentColor: raw.accentColor?.trim() || undefined,
    heroSubtitleAr: raw.heroSubtitleAr?.trim() || undefined,
    heroSubtitleEn: raw.heroSubtitleEn?.trim() || undefined,
    levelPrivileges: raw.levelPrivileges?.length
      ? raw.levelPrivileges.map(normalizeVipPrivilegeDef)
      : undefined,
    storeItemIds: raw.storeItemIds?.filter(Boolean),
    enabled: raw.enabled !== false,
  };
}

export function normalizeVipSystemConfig(raw: Partial<VipSystemConfig>): VipSystemConfig {
  const levels = (raw.levels?.length ? raw.levels : DEFAULT_VIP_SYSTEM.levels).map(normalizeVipLevelDef);
  return {
    pointPerCoin: raw.pointPerCoin ?? 1,
    validityDays: raw.validityDays ?? 30,
    downgradeToLevel: raw.downgradeToLevel ?? 1,
    expiryWarningDays: raw.expiryWarningDays ?? 5,
    levels,
    privileges: raw.privileges?.length
      ? raw.privileges.map(normalizeVipPrivilegeDef)
      : DEFAULT_VIP_SYSTEM.privileges,
    screenTitleAr: raw.screenTitleAr?.trim() || 'SVIP',
    screenTitleEn: raw.screenTitleEn?.trim() || 'SVIP',
    privilegesSectionAr: raw.privilegesSectionAr?.trim() || 'امتيازات',
    privilegesSectionEn: raw.privilegesSectionEn?.trim() || 'Privileges',
    quickActions: raw.quickActions?.length ? raw.quickActions : DEFAULT_VIP_SYSTEM.quickActions,
    updatedAt: raw.updatedAt,
  };
}

// ==================== HELPERS ====================

export function resolveVipLevel(points: number, levels: VipLevelDef[]): number {
  const normalized = levels.map(normalizeVipLevelDef);
  let resolved = 0;
  for (const lv of normalized) {
    if (points >= lv.priceCoins) resolved = lv.level;
  }
  return resolved;
}

export function levelDefFor(
  level: number,
  levels: VipLevelDef[],
): VipLevelDef | undefined {
  return levels.find((l) => l.level === level);
}

export function levelsForMode(mode: VipMode, levels: VipLevelDef[]): VipLevelDef[] {
  return levels;
}

export function privilegesForMode(
  mode: VipMode,
  privileges: VipPrivilegeDef[],
): VipPrivilegeDef[] {
  return [...privileges]
    .filter((p) => p.enabled !== false)
    .sort((a, b) => a.order - b.order);
}

/** امتيازات المعروضة لتبويب مستوى معيّن */
export function privilegesForLevelTab(
  displayLevel: number,
  levelDef: VipLevelDef | undefined,
  globalPrivileges: VipPrivilegeDef[],
): VipPrivilegeDef[] {
  if (levelDef?.levelPrivileges?.length) {
    return levelDef.levelPrivileges.filter((p) => p.enabled !== false).sort((a, b) => a.order - b.order);
  }
  return privilegesForMode('svip', globalPrivileges).filter((p) => p.unlockLevel <= displayLevel);
}

export function countUnlockedForLevel(
  userLevel: number,
  privileges: VipPrivilegeDef[],
): number {
  return privileges.filter((p) => userLevel >= p.unlockLevel).length;
}

export function progressInLevel(
  monthPoints: number,
  level: number,
  levels: VipLevelDef[],
): { current: number; total: number; pct: number; toNext: number } {
  const def = levelDefFor(level, levels);
  if (!def) return { current: monthPoints, total: 10_000, pct: 0, toNext: 10_000 };
  const required = def.maintainPoints || 1;
  const current = Math.max(0, monthPoints);
  return {
    current,
    total: required,
    pct: Math.min(100, (current / required) * 100),
    toNext: Math.max(0, required - current),
  };
}

export function countUnlockedPrivileges(
  userLevel: number,
  privileges: VipPrivilegeDef[],
): number {
  return privileges.filter((p) => userLevel >= p.unlockLevel).length;
}

/** كوينز مطلوبة لشراء مستوى معيّن — سعر ثابت */
export function coinsNeededForLevel(
  targetLevel: number,
  _currentPoints: number,
  levels: VipLevelDef[],
): number {
  const def = levelDefFor(targetLevel, levels);
  if (!def) return 0;
  return Math.max(0, def.priceCoins);
}

export function progressTowardThreshold(
  lifetimePoints: number,
  targetLevel: number,
  levels: VipLevelDef[],
): { current: number; total: number; pct: number; remaining: number } {
  const def = levelDefFor(targetLevel, levels);
  if (!def) {
    return { current: lifetimePoints, total: 1, pct: 100, remaining: 0 };
  }
  const total = def.priceCoins;
  const current = Math.min(lifetimePoints, total);
  return {
    current,
    total,
    pct: total > 0 ? Math.min(100, (current / total) * 100) : 0,
    remaining: Math.max(0, total - lifetimePoints),
  };
}

export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function effectiveMonthPoints(
  monthPoints: number,
  monthKey: string | undefined,
): number {
  return monthKey === currentMonthKey() ? monthPoints : 0;
}

export function pointsToMaintain(
  level: number,
  monthPoints: number,
  levels: VipLevelDef[],
  monthKey?: string,
): { required: number; remaining: number; canMaintain: boolean } {
  const def = levelDefFor(level, levels);
  if (!def) return { required: 0, remaining: 0, canMaintain: false };
  const effective = effectiveMonthPoints(monthPoints, monthKey);
  const required = def.maintainPoints;
  const remaining = Math.max(0, required - effective);
  return { required, remaining, canMaintain: effective >= required };
}

export function formatVipExpiryDate(ts: number | null | undefined): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

export function unlockedPrivilegesForUser(
  userLevel: number,
  privileges: VipPrivilegeDef[],
): VipPrivilegeDef[] {
  return [...privileges]
    .filter((p) => p.enabled !== false && userLevel >= p.unlockLevel)
    .sort((a, b) => a.order - b.order);
}

export function vipValidityMs(config: VipSystemConfig): number {
  const days = config.validityDays ?? 30;
  return days * 24 * 60 * 60 * 1000;
}

function defaultVipExpiry(config: VipSystemConfig): number {
  return Date.now() + vipValidityMs(config);
}

export function readVipUserState(data: Record<string, unknown>): VipUserState {
  const vipPoints = Number(data.vipPoints ?? 0);
  const vipLevel = Number(data.vipLevel ?? 0);
  return {
    vipPoints,
    vipPointsMonth: Number(data.vipPointsMonth ?? vipPoints),
    vipLevel,
    isVIP: data.isVIP === true || vipLevel >= 1,
    vipExpiresAt: data.vipExpiresAt != null ? Number(data.vipExpiresAt) : null,
  };
}

// ==================== CONFIG ====================

export const subscribeToVipSystem = (
  cb: (config: VipSystemConfig) => void,
): (() => void) => {
  const ref = doc(firestore, 'config', 'vipSystem');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        cb(normalizeVipSystemConfig(snap.data() as Partial<VipSystemConfig>));
      } else {
        cb(DEFAULT_VIP_SYSTEM);
      }
    },
    () => cb(DEFAULT_VIP_SYSTEM),
  );
};

export const getVipSystemOnce = async (): Promise<VipSystemConfig> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'vipSystem'));
    if (snap.exists()) {
      return normalizeVipSystemConfig(snap.data() as Partial<VipSystemConfig>);
    }
  } catch {}
  return DEFAULT_VIP_SYSTEM;
};

export const saveVipSystemConfig = async (config: VipSystemConfig): Promise<void> => {
  await setDoc(
    doc(firestore, 'config', 'vipSystem'),
    { ...config, updatedAt: Date.now() },
    { merge: true },
  );
};

// ذاكرة مؤقتة لإعداد VIP — تقلّل قراءات Firestore عند فحوص الامتيازات المتكررة
let _vipCfgCache: { cfg: VipSystemConfig; at: number } | null = null;
export async function getVipSystemCached(maxAgeMs = 60_000): Promise<VipSystemConfig> {
  const now = Date.now();
  if (_vipCfgCache && now - _vipCfgCache.at < maxAgeMs) return _vipCfgCache.cfg;
  const cfg = await getVipSystemOnce();
  _vipCfgCache = { cfg, at: now };
  return cfg;
}

/**
 * فحص امتياز SVIP وظيفي لمستخدم (يجلب بياناته + إعداد VIP المخزّن مؤقتاً).
 * يُستخدم لفرض ميزات الإشراف على مستخدمين آخرين داخل الغرف.
 */
export async function checkUserHasVipFeature(
  uid: string | null | undefined,
  featureKey: VipPrivilegeAsset,
): Promise<boolean> {
  if (!uid) return false;
  try {
    const [userSnap, cfg] = await Promise.all([
      getDoc(doc(firestore, 'users', uid)),
      getVipSystemCached(),
    ]);
    if (!userSnap.exists()) return false;
    return userHasVipFeature(userSnap.data() as Record<string, unknown>, featureKey, cfg);
  } catch {
    return false;
  }
}

// ==================== USER OPS ====================

/**
 * فحص الحفاظ الشهري — عند بداية شهر جديد:
 * إذا لم تُحقَّق نقاط الحفاظ للمستوى الحالي يُخفَّض إلى downgradeToLevel (افتراضي SVIP1)
 */
export const syncVipMaintenanceForUser = async (uid: string): Promise<VipUserState | null> => {
  const config = await getVipSystemOnce();
  const userRef = doc(firestore, 'users', uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return null;

  const data = snap.data() as Record<string, unknown>;
  const currentLevel = Number(data.vipLevel ?? 0);
  const monthKey = currentMonthKey();
  const prevMonthKey = data.vipMonthKey as string | undefined;
  const patch: Record<string, unknown> = {};
  let newLevel = currentLevel;

  if (currentLevel >= 1 && prevMonthKey && prevMonthKey !== monthKey) {
    const def = levelDefFor(currentLevel, config.levels);
    const monthPts = Number(data.vipPointsMonth ?? 0);
    if (def && monthPts < def.maintainPoints) {
      if (currentLevel <= 1) {
        newLevel = 0;
        patch.isVIP = false;
      } else {
        newLevel = currentLevel - 1;
        patch.isVIP = true;
      }
      patch.vipLevel = newLevel;
    }
    patch.vipPointsMonth = 0;
    patch.vipMonthKey = monthKey;
  } else if (!prevMonthKey) {
    patch.vipMonthKey = monthKey;
  }

  const expires = data.vipExpiresAt != null ? Number(data.vipExpiresAt) : null;
  const downgradeLevel = config.downgradeToLevel ?? 1;
  if (
    expires && expires < Date.now()
    && currentLevel > downgradeLevel
    && !patch.vipLevel
  ) {
    newLevel = downgradeLevel;
    patch.vipLevel = newLevel;
    patch.isVIP = newLevel >= 1;
  }

  if (Object.keys(patch).length) {
    patch.updatedAt = Date.now();
    await updateDoc(userRef, patch as any);
    return readVipUserState({ ...data, ...patch });
  }
  return readVipUserState(data);
};

/** يُستدعى عند الشحن — 1 عملة = 1 نقطة VIP (قابل للتعديل من الإعدادات) */
export const addVipPoints = async (uid: string, coinsAdded: number): Promise<void> => {
  if (coinsAdded <= 0) return;
  await syncVipMaintenanceForUser(uid);

  const config = await getVipSystemOnce();
  const points = Math.floor(coinsAdded * config.pointPerCoin);

  const userRef = doc(firestore, 'users', uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;

  const data = snap.data() as Record<string, unknown>;
  const newPoints = Number(data.vipPoints ?? 0) + points;
  const monthKey = currentMonthKey();
  const prevMonthKey = data.vipMonthKey as string | undefined;
  const baseMonth = prevMonthKey === monthKey ? Number(data.vipPointsMonth ?? 0) : 0;
  const newMonth = baseMonth + points;
  const currentLevel = Number(data.vipLevel ?? 0);

  const patch: Record<string, unknown> = {
    vipPoints: newPoints,
    vipPointsMonth: newMonth,
    vipMonthKey: monthKey,
    updatedAt: Date.now(),
  };

  const earnedLevel = resolveVipLevel(newPoints, config.levels);
  const newLevel = Math.max(currentLevel, earnedLevel);
  patch.vipLevel = newLevel;
  patch.isVIP = newLevel >= 1;

  if (newLevel >= 1) {
    const levelDef = levelDefFor(newLevel, config.levels);
    if (levelDef && newMonth >= levelDef.maintainPoints) {
      patch.vipExpiresAt = defaultVipExpiry(config);
    } else if (!data.vipExpiresAt) {
      patch.vipExpiresAt = defaultVipExpiry(config);
    }
  }

  if (newLevel > currentLevel) {
    try {
      const { announceVipUpgrade } = await import('./svipPerks');
      const def = levelDefFor(newLevel, config.levels);
      await announceVipUpgrade(def?.label ?? `SVIP${newLevel}`);
    } catch { /* non-blocking */ }
  } else if (currentLevel >= 1 && coinsAdded > 0) {
    try {
      const { notifyVipRechargeSuccess } = await import('./vipNotifications');
      const def = levelDefFor(currentLevel, config.levels);
      await notifyVipRechargeSuccess(uid, def?.label ?? `SVIP${currentLevel}`);
    } catch { /* non-blocking */ }
  }

  await updateDoc(userRef, patch as any);
};

/** مزامنة المستوى من النقاط الحالية */
export const syncUserVipLevel = async (uid: string): Promise<VipUserState> => {
  const config = await getVipSystemOnce();
  const snap = await getDoc(doc(firestore, 'users', uid));
  if (!snap.exists()) throw new Error('المستخدم غير موجود');

  const data = snap.data() as Record<string, unknown>;
  const points = Number(data.vipPoints ?? 0);
  const newLevel = resolveVipLevel(points, config.levels);

  await updateDoc(doc(firestore, 'users', uid), {
    vipLevel: newLevel,
    isVIP: newLevel >= 1,
    updatedAt: Date.now(),
  });

  return {
    vipPoints: points,
    vipPointsMonth: Number(data.vipPointsMonth ?? 0),
    vipLevel: newLevel,
    isVIP: newLevel >= 1,
    vipExpiresAt: data.vipExpiresAt != null ? Number(data.vipExpiresAt) : null,
  };
};

/** الحفاظ على المستوى — يتحقق من نقاط الشهر */
export const maintainVipLevel = async (uid: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user || user.uid !== uid) throw new Error('يجب تسجيل الدخول');

  const config = await getVipSystemOnce();
  const snap = await getDoc(doc(firestore, 'users', uid));
  if (!snap.exists()) throw new Error('المستخدم غير موجود');

  const data = snap.data() as Record<string, unknown>;
  const level = Number(data.vipLevel ?? 0);
  if (level < 1) throw new Error('لست VIP بعد');

  const def = levelDefFor(level, config.levels);
  if (!def) throw new Error('مستوى غير معروف');

  const monthPts = effectiveMonthPoints(
    Number(data.vipPointsMonth ?? 0),
    data.vipMonthKey as string | undefined,
  );
  if (monthPts < def.maintainPoints) {
    throw new Error(
      `تحتاج ${def.maintainPoints.toLocaleString('en-US')} نقطة هذا الشهر للحفاظ على ${def.label}`,
    );
  }

  const expires = defaultVipExpiry(config);
  await updateDoc(doc(firestore, 'users', uid), {
    vipExpiresAt: expires,
    updatedAt: Date.now(),
  });

  await addDoc(collection(firestore, 'transactions'), {
    uid,
    type: 'subscription',
    amount: 0,
    currency: 'vip',
    itemName: `Maintain ${def.label}`,
    status: 'completed',
    createdAt: Date.now(),
  });

  try {
    const { notifyVipRechargeSuccess } = await import('./vipNotifications');
    await notifyVipRechargeSuccess(uid, def.label);
  } catch { /* non-blocking */ }
};

/** ترقية مباشرة بخصم الكوينز — بدون الذهاب لشاشة الشحن */
export const upgradeVipLevelWithCoins = async (
  targetLevel: number,
): Promise<VipUserState> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const config = await getVipSystemOnce();
  const def = levelDefFor(targetLevel, config.levels);
  if (!def) throw new Error('مستوى غير معروف');
  if (targetLevel < 1) throw new Error('مستوى غير صالح');

  const userRef = doc(firestore, 'users', user.uid);

  const result = await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error('المستخدم غير موجود');

    const data = snap.data() as Record<string, unknown>;
    const stats = statsFromFirestoreDoc(data);
    const currentPoints = Number(data.vipPoints ?? 0);
    const currentLevel = Number(data.vipLevel ?? 0);

    if (targetLevel <= currentLevel) {
      throw new Error('لديك هذا المستوى أو أعلى بالفعل');
    }

    const coinsNeeded = def.priceCoins;
    if (stats.coins < coinsNeeded) {
      throw new Error(
        `رصيدك ${stats.coins.toLocaleString('en-US')} كوين — تحتاج ${coinsNeeded.toLocaleString('en-US')} كوين`,
      );
    }

    const newLevel = targetLevel;
    const monthKey = currentMonthKey();
    const prevMonthKey = data.vipMonthKey as string | undefined;
    const baseMonth = prevMonthKey === monthKey ? Number(data.vipPointsMonth ?? 0) : 0;
    const newMonth = baseMonth + coinsNeeded;
    const newPoints = Math.max(currentPoints, def.priceCoins);

    tx.update(userRef, {
      ...buildBalanceIncrementPatch('coins', -coinsNeeded),
      vipPoints: newPoints,
      vipPointsMonth: newMonth,
      vipMonthKey: monthKey,
      vipLevel: newLevel,
      isVIP: true,
      vipExpiresAt: defaultVipExpiry(config),
      updatedAt: Date.now(),
    });

    return {
      coinsSpent: coinsNeeded,
      newLevel,
      newPoints,
      label: def.label,
    };
  });

  await addDoc(collection(firestore, 'transactions'), {
    uid: user.uid,
    type: 'subscription',
    amount: -result.coinsSpent,
    currency: 'coins',
    itemName: `ترقية ${result.label}`,
    status: 'completed',
    createdAt: Date.now(),
  });

  try {
    const { notifyVipRechargeSuccess } = await import('./vipNotifications');
    await notifyVipRechargeSuccess(user.uid, result.label);
  } catch { /* non-blocking */ }

  // امتياز SVIP «إعلان الترقية» — يُنشئ إشعار/بثّ احتفالي عند رفع المستوى
  try {
    const { announceVipUpgrade } = await import('./svipPerks');
    await announceVipUpgrade(result.label);
  } catch { /* non-blocking */ }

  return {
    vipPoints: result.newPoints,
    vipPointsMonth: result.newPoints,
    vipLevel: result.newLevel,
    isVIP: true,
    vipExpiresAt: defaultVipExpiry(config),
  };
};

/** ترقية يدوية من الأدمن أو بعد شحن */
export const setVipLevelAdmin = async (
  uid: string,
  level: number,
  points?: number,
): Promise<void> => {
  const config = await getVipSystemOnce();
  const def = levelDefFor(level, config.levels);
  const patch: Record<string, unknown> = {
    vipLevel: level,
    isVIP: level >= 1,
    updatedAt: Date.now(),
  };
  if (points != null) patch.vipPoints = points;
  else if (def) patch.vipPoints = def.priceCoins;
  if (level >= 1) {
    patch.vipExpiresAt = defaultVipExpiry(config);
    patch.vipMonthKey = currentMonthKey();
  }

  await updateDoc(doc(firestore, 'users', uid), patch as any);
};

export function isUserVipActive(user: any): boolean {
  if (!user) return false;
  const vipLevel = getEffectiveVipLevel(user);
  const isVIP = user.isVIP === true || vipLevel >= 1;
  const expiresAt = user.vipExpiresAt != null ? Number(user.vipExpiresAt) : null;
  const aristoExpiry = Number(
    (user.aristocracy as { expiresAt?: number } | undefined)?.expiresAt
      ?? user.aristocracyExpiresAt
      ?? 0
  );
  const hasAristocracyVip = vipLevel >= 1 && aristoExpiry > Date.now();
  return hasAristocracyVip || (isVIP && (expiresAt === null || expiresAt > Date.now()));
}

/**
 * قائمة امتيازات SVIP المسموح ظهورها لمستخدم حصل على المستوى عبر الأرستقراطية.
 * تُقرأ من user.aristocracy.svipPrivilegeKeys (snapshot وقت الشراء/المنح).
 * null = لا قيود (كل امتيازات المستوى الممنوح).
 */
export function getAristocracyGrantedVipAllowlist(user: any): string[] | null {
  if (!user) return null;
  const aristo = (user.aristocracy as { svipPrivilegeKeys?: unknown; expiresAt?: number } | undefined) ?? {};
  const aristoExpiry = Number(aristo.expiresAt ?? user.aristocracyExpiresAt ?? 0);
  if (aristoExpiry <= Date.now()) return null;
  const raw = aristo.svipPrivilegeKeys ?? (user.aristocracySvipPrivilegeKeys as unknown);
  if (!Array.isArray(raw)) return null;
  return raw.map(String);
}

/**
 * هل امتياز SVIP (بمفتاح معيّن ومستوى فتح معيّن) مرئي للمستخدم؟
 * - إذا كان مكتسباً عبر SVIP الحقيقي (vipLevel الأساسي) → يظهر دائماً.
 * - إذا كان مكتسباً فقط عبر الأرستقراطية → يظهر فقط إن كان ضمن القائمة المحددة (أو لا قيود).
 */
export function isVipPrivilegeVisibleForUser(
  user: any,
  assetKey: VipPrivilegeAsset | string,
  unlockLevel: number,
): boolean {
  const baseVip = Number(user?.vipLevel ?? 0);
  if (baseVip >= unlockLevel) return true;
  const allow = getAristocracyGrantedVipAllowlist(user);
  if (allow == null) return true;
  return allow.includes(String(assetKey));
}

export function hasVipPrivilege(
  user: any,
  assetKey: VipPrivilegeAsset,
  privileges: VipPrivilegeDef[],
): boolean {
  if (!user) return false;
  const vipLevel = getEffectiveVipLevel(user);
  if (!isUserVipActive(user)) return false;

  return privileges.some(
    (p) =>
      p.assetKey === assetKey &&
      p.enabled !== false &&
      vipLevel >= p.unlockLevel &&
      isVipPrivilegeVisibleForUser(user, assetKey, p.unlockLevel)
  );
}

export function getEffectiveVipLevel(user: any): number {
  if (!user) return 0;
  const baseVip = Number(user.vipLevel ?? 0);
  const aristo = (user.aristocracy as { grantedVipLevel?: number; expiresAt?: number } | undefined) ?? {};
  const aristoExpiry = Number(aristo.expiresAt ?? user.aristocracyExpiresAt ?? 0);
  if (aristoExpiry <= Date.now()) return baseVip;
  const aristoVip = Number(aristo.grantedVipLevel ?? user.aristocracyGrantedVipLevel ?? 0);
  return Math.max(baseVip, aristoVip);
}

/**
 * بوّابة عامة لميزات SVIP الوظيفية — مصدر الحقيقة الوحيد للتحقق.
 * تقرأ مستوى الفتح والتفعيل من إعداد الأدمن (vipSystem.privileges)،
 * فيتحكّم الأدمن بكل ميزة لكل مستوى دون تعديل الكود.
 */
export function userHasVipFeature(
  user: any,
  featureKey: VipPrivilegeAsset,
  vipSystem: Pick<VipSystemConfig, 'privileges'> | undefined | null,
): boolean {
  const privileges = vipSystem?.privileges;
  if (!privileges || !privileges.length) return false;
  return hasVipPrivilege(user, featureKey, privileges);
}

/** يفضّل PNG/WebP الثابتة للعرض الصغير — GIF فقط عند الطلب صراحة */
export function resolveLevelBadgeUrl(
  levelDef: Pick<VipLevelDef, 'imageUrl' | 'imageAnimatedUrl'> | undefined | null,
  preferAnimated = false,
): string | undefined {
  if (!levelDef) return undefined;
  const staticUrl = levelDef.imageUrl?.trim();
  const animatedUrl = levelDef.imageAnimatedUrl?.trim();
  if (preferAnimated && animatedUrl) return animatedUrl;
  return staticUrl || animatedUrl;
}

export function resolveVipPrivilegeAsset(
  vipLevel: number,
  assetKey: VipPrivilegeAsset,
  vipSystem: VipSystemConfig,
): VipPrivilegeDef | undefined {
  if (!vipSystem) return undefined;
  
  // 1. Search level-specific privileges from user's level downwards
  for (let lv = vipLevel; lv >= 1; lv--) {
    const levelDef = vipSystem.levels?.find((l) => l.level === lv);
    if (levelDef?.levelPrivileges?.length) {
      const match = levelDef.levelPrivileges.find(
        (p) =>
          p.assetKey === assetKey &&
          p.enabled !== false &&
          (p.imageUrl || p.videoUrl || p.videoUrlMp4 || p.soundUrl)
      );
      if (match) return match;
    }
  }

  // 2. Fall back to global privileges
  return vipSystem.privileges?.find(
    (p) => p.assetKey === assetKey && p.enabled !== false && vipLevel >= p.unlockLevel
  );
}
