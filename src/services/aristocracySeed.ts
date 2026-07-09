/**
 * محتوى تجريبي واقعي للأرستقراطية — صور وأيقونات قابلة للتعديل من لوحة التحكم
 */
import type { ConfigAristocracyLevel, ConfigAristocracyPrivilege } from './admin';

const THEMES: Record<string, { accent: string; bg: [string, string, string] }> = {
  leader: { accent: '#7EB8FF', bg: ['#0F1C3F', '#1A2F5C', '#0A1428'] },
  knight: { accent: '#4FD0FF', bg: ['#0A1E4A', '#123872', '#081530'] },
  minister: { accent: '#5B9BFF', bg: ['#0C2048', '#153D7A', '#0A1838'] },
  prince: { accent: '#FF7AC0', bg: ['#4A0E2E', '#7A1A45', '#2D0818'] },
  noble: { accent: '#C9A0FF', bg: ['#2A1248', '#4A2080', '#1A0B2E'] },
  king: { accent: '#E8B4FF', bg: ['#3D1366', '#5C1F8C', '#2A0F4A'] },
  aristocrat: { accent: '#FFD700', bg: ['#22143D', '#3C1F61', '#130B23'] },
  emperor: { accent: '#FFD700', bg: ['#0A1628', '#142040', '#060D18'] },
  legend: { accent: '#9A93AD', bg: ['#1A1A22', '#2A2A35', '#101018'] },
};

/** أيقونات PNG ثابتة (يمكن استبدالها برفعك من لوحة التحكم) */
export const ARISTOCRACY_SEED_IMAGES = {
  effects: 'https://cdn-icons-png.flaticon.com/512/1828/1828884.png',
  frame: 'https://cdn-icons-png.flaticon.com/512/833/833472.png',
  profileCard: 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png',
  badge: 'https://cdn-icons-png.flaticon.com/512/3147/3147763.png',
  entry: 'https://cdn-icons-png.flaticon.com/512/616/616408.png',
  bubble: 'https://cdn-icons-png.flaticon.com/512/3212/3212567.png',
  sound: 'https://cdn-icons-png.flaticon.com/512/3062/3062633.png',
  voice: 'https://cdn-icons-png.flaticon.com/512/924/924514.png',
  gift: 'https://cdn-icons-png.flaticon.com/512/3081/3081982.png',
  coin: 'https://cdn-icons-png.flaticon.com/512/2582/2582603.png',
  seat: 'https://cdn-icons-png.flaticon.com/512/741/741407.png',
  rocket: 'https://cdn-icons-png.flaticon.com/512/3212/3212567.png',
  emoji: 'https://cdn-icons-png.flaticon.com/512/616/616430.png',
  photo: 'https://cdn-icons-png.flaticon.com/512/3062/3062633.png',
  bag: 'https://cdn-icons-png.flaticon.com/512/924/924514.png',
  dnd: 'https://cdn-icons-png.flaticon.com/512/1828/1828884.png',
  shield: 'https://cdn-icons-png.flaticon.com/512/833/833472.png',
  eye: 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png',
  ticket: 'https://cdn-icons-png.flaticon.com/512/2582/2582603.png',
  crown: 'https://cdn-icons-png.flaticon.com/512/3147/3147763.png',
  wings: 'https://cdn-icons-png.flaticon.com/512/616/616408.png',
} as const;

const BG = (seed: string) => `https://picsum.photos/seed/arist-${seed}/900/520`;

function priv(
  partial: ConfigAristocracyPrivilege & { imageUrl?: string },
): ConfigAristocracyPrivilege {
  return { enabled: true, ...partial };
}

const FIXED_ARISTOCRACY_LEVEL_IDS = ['noble', 'minister', 'prince', 'king', 'aristocrat'] as const;

/** هدايا حصرية لكل مستوى — معرّفات من config/gifts (هدايا تجريبية) */
export const ARISTOCRACY_LEVEL_GIFT_IDS: Record<string, string[]> = {
  noble: ['demo_static_crown', 'demo_anim_diamond'],
  king: ['demo_static_crown', 'demo_static_car', 'demo_anim_diamond', 'demo_sound_yacht'],
  aristocrat: [
    'demo_static_crown',
    'demo_static_car',
    'demo_anim_diamond',
    'demo_anim_fireworks',
    'demo_sound_yacht',
    'demo_sound_magic',
    'demo_anim_confetti',
    'demo_sound_rocket',
  ],
};

/** امتيازات العرض — أيقونات دائرية (ترتيب مطابق للمنافس) */
function showIcons(fromLevel: number): ConfigAristocracyPrivilege[] {
  const all: ConfigAristocracyPrivilege[] = [
    priv({ id: 'aristocracy-seat', titleAr: 'مقعد الأرستقراطية', titleEn: 'Aristocracy Seat', descAr: 'مقعد مميز في الغرف الصوتية', descEn: 'Premium seat in voice rooms', assetKey: 'frame', layout: 'icon', order: 20, imageUrl: ARISTOCRACY_SEED_IMAGES.seat }),
    priv({ id: 'coin-return', titleAr: 'إرجاع الكوينز', titleEn: 'Coins Return', descAr: 'استرداد نسبة من مشترياتك', descEn: 'Get coins back on purchases', assetKey: 'badge', layout: 'icon', order: 21, imageUrl: ARISTOCRACY_SEED_IMAGES.coin }),
    priv({ id: 'exclusive-gifts', titleAr: 'هدايا حصرية', titleEn: 'Exclusive Gifts', descAr: 'هدايا لا يراها غير الأرستقراطيين', descEn: 'Gifts only aristocrats can send', assetKey: 'entry', layout: 'icon', order: 22, imageUrl: ARISTOCRACY_SEED_IMAGES.gift }),
    priv({ id: 'fast-upgrade', titleAr: 'ترقية سريعة', titleEn: 'Fast Upgrade', descAr: 'تسريع ترقية مستوى الثروة', descEn: 'Faster wealth level upgrades', assetKey: 'effects', layout: 'icon', order: 23, imageUrl: ARISTOCRACY_SEED_IMAGES.rocket }),
    priv({ id: 'flying-msgs', titleAr: 'رسائل طائرة', titleEn: 'Flying Messages', descAr: 'رسائل متحركة فوق الغرفة', descEn: 'Animated flying chat messages', assetKey: 'bubble', layout: 'icon', order: 24, imageUrl: ARISTOCRACY_SEED_IMAGES.bubble }),
    priv({ id: 'exclusive-emoji', titleAr: 'رموز تعبيرية حصرية', titleEn: 'Exclusive Emojis', descAr: 'إيموجي خاص بالأرستقراطية', descEn: 'Aristocracy-only emojis', assetKey: 'profileCard', layout: 'icon', order: 25, imageUrl: ARISTOCRACY_SEED_IMAGES.emoji }),
    priv({ id: 'send-photos', titleAr: 'إرسال الصور', titleEn: 'Send Photos', descAr: 'إرسال صور في المحادثات', descEn: 'Send photos in chats', assetKey: 'entry', layout: 'icon', order: 26, imageUrl: ARISTOCRACY_SEED_IMAGES.photo }),
    priv({ id: 'lucky-bag-max', titleAr: 'الحد الأقصى لعدد حقيبة الحظ', titleEn: 'Lucky Bag Limit', descAr: 'حد أعلى لإرسال حقائب الحظ', descEn: 'Higher lucky bag send limit', assetKey: 'badge', layout: 'icon', order: 27, imageUrl: ARISTOCRACY_SEED_IMAGES.bag }),
    priv({ id: 'dnd', titleAr: 'وضع عدم الإزعاج', titleEn: 'Do Not Disturb', descAr: 'إخفاء الإشعارات المزعجة', descEn: 'Mute distracting notifications', assetKey: 'bubble', layout: 'icon', order: 28, imageUrl: ARISTOCRACY_SEED_IMAGES.dnd }),
    priv({ id: 'no-follow', titleAr: 'لا يمكن متابعتك', titleEn: 'Cannot Follow You', descAr: 'منع المتابعة غير المرغوبة', descEn: 'Block unwanted follows', assetKey: 'profileCard', layout: 'icon', order: 29, imageUrl: ARISTOCRACY_SEED_IMAGES.shield }),
    priv({ id: 'eyes-on-you', titleAr: 'أنظار الجميع عليك', titleEn: 'Eyes On You', descAr: 'ظهور بارز عند دخول الغرف', descEn: 'Stand out when entering rooms', assetKey: 'effects', layout: 'icon', order: 30, imageUrl: ARISTOCRACY_SEED_IMAGES.eye }),
    priv({ id: 'trial-card', titleAr: 'إرسال بطاقة تجربة', titleEn: 'Send Trial Card', descAr: 'أهدِ تجربة أرستقراطية لصديق', descEn: 'Gift a trial card to friends', assetKey: 'entry', layout: 'icon', order: 31, imageUrl: ARISTOCRACY_SEED_IMAGES.ticket }),
  ];
  if (fromLevel >= 5) return all;
  if (fromLevel >= 4) return all.slice(0, 8);
  if (fromLevel >= 3) return all.slice(0, 5);
  return all.slice(0, 3);
}

/** بطاقات المعاينة — wide / half */
function previewCards(level: number): ConfigAristocracyPrivilege[] {
  const cards: ConfigAristocracyPrivilege[] = [
    priv({ id: 'effects', titleAr: 'تفعيل التأثيرات', titleEn: 'Activate Effects', descAr: 'تأثيرات بصرية حول ملفك ودخولك', descEn: 'Visual effects on profile and entry', assetKey: 'effects', layout: 'half', order: 1, imageUrl: ARISTOCRACY_SEED_IMAGES.effects }),
    priv({ id: 'frame', titleAr: 'إطار', titleEn: 'Frame', descAr: 'إطار ذهبي متحرك حول صورتك', descEn: 'Animated golden avatar frame', assetKey: 'frame', layout: 'half', order: 2, imageUrl: ARISTOCRACY_SEED_IMAGES.frame }),
    priv({ id: 'colored-name', titleAr: 'إسم ملون', titleEn: 'Colored Name', descAr: 'اسمك بألوان متدرجة مميزة', descEn: 'Gradient colored display name', assetKey: 'profileCard', layout: 'half', order: 3, imageUrl: ARISTOCRACY_SEED_IMAGES.profileCard }),
    priv({ id: 'badge', titleAr: 'وسام الهوية', titleEn: 'Identity Badge', descAr: 'وسام أرستقراطي بجانب اسمك', descEn: 'Aristocracy badge next to your name', assetKey: 'badge', layout: 'half', order: 4, imageUrl: ARISTOCRACY_SEED_IMAGES.badge }),
    priv({ id: 'app-notify', titleAr: 'إشعار على مستوى التطبيق', titleEn: 'App-wide Notice', descAr: 'إعلان دخولك يظهر للجميع', descEn: 'Entry announcement app-wide', assetKey: 'entry', layout: 'half', order: 5, imageUrl: ARISTOCRACY_SEED_IMAGES.entry }),
    priv({ id: 'bubble', titleAr: 'إطار كتابة', titleEn: 'Chat Frame', descAr: 'فقاعة دردشة فاخرة لرسائلك', descEn: 'Luxury chat bubble for messages', assetKey: 'bubble', layout: 'half', order: 6, imageUrl: ARISTOCRACY_SEED_IMAGES.bubble }),
    priv({ id: 'sound-effect', titleAr: 'تأثير صوتي', titleEn: 'Sound Effect', descAr: 'مؤثر صوتي عند إرسال الهدايا', descEn: 'Sound effect when sending gifts', assetKey: 'effects', layout: 'half', order: 7, imageUrl: ARISTOCRACY_SEED_IMAGES.sound }),
    priv({ id: 'voice-wave', titleAr: 'موجه صوتية', titleEn: 'Voice Wave', descAr: 'موجة صوتية مضيئة على المايك', descEn: 'Glowing voice wave on mic', assetKey: 'entry', layout: 'half', order: 8, imageUrl: ARISTOCRACY_SEED_IMAGES.voice }),
  ];
  if (level >= 5) return cards;
  if (level >= 4) return cards.slice(0, 6);
  if (level >= 3) return cards.slice(0, 4);
  return cards.slice(0, 2);
}

/** امتيازات غنية لكل مستوى — صور + نصوص */
export function buildRichAristocracyPrivileges(level: number): ConfigAristocracyPrivilege[] {
  return [...previewCards(level), ...showIcons(level)];
}

function themeFor(key: string) {
  return THEMES[key] ?? THEMES.emperor!;
}

function levelSeed(
  base: Omit<ConfigAristocracyLevel, 'privileges' | 'accentColor' | 'bgColors'> & {
    themeKey: string;
    exclusiveGiftIds?: string[];
    privileges?: ConfigAristocracyPrivilege[];
  },
): ConfigAristocracyLevel {
  const theme = themeFor(base.themeKey);
  return {
    ...base,
    accentColor: theme.accent,
    bgColors: [...theme.bg],
    imageUrl: base.imageUrl ?? ARISTOCRACY_SEED_IMAGES.crown,
    backgroundImageUrl: base.backgroundImageUrl ?? BG(base.id),
    exclusiveGiftIds: base.exclusiveGiftIds ?? ARISTOCRACY_LEVEL_GIFT_IDS[base.id] ?? [],
    privileges: base.privileges ?? buildRichAristocracyPrivileges(base.level),
  };
}

/** مستويات كاملة بمحتوى واقعي — جاهزة للنشر */
export const SAMPLE_ARISTOCRACY_LEVELS: ConfigAristocracyLevel[] = [
  levelSeed({
    id: 'noble', level: 1, nameAr: 'النبيل', nameEn: 'Noble',
    enabled: true, comingSoon: false,
    activationCoins: 800_000, renewalCoins: 640_000, validityDays: 30,
    allowRenewal: true, coinReturnPercent: 80, coinReturnCoins: 0, grantedVipLevel: 10, honorPointsRequired: 300_000, requiredVipLevel: 0,
    themeKey: 'noble',
    heroSubtitleAr: 'هوية النبيل — امتيازات SVIP10',
    heroSubtitleEn: 'Noble identity — SVIP10 privileges',
  }),
  levelSeed({
    id: 'minister', level: 2, nameAr: 'الوزير', nameEn: 'Minister',
    enabled: true, comingSoon: false,
    activationCoins: 100_000, renewalCoins: 60_000, validityDays: 30,
    allowRenewal: true, coinReturnPercent: 100, coinReturnCoins: 0, grantedVipLevel: 11, honorPointsRequired: 0, requiredVipLevel: 0,
    themeKey: 'minister',
    heroSubtitleAr: 'الوزير — امتيازات SVIP11',
    heroSubtitleEn: 'Minister — SVIP11 privileges',
  }),
  levelSeed({
    id: 'prince', level: 3, nameAr: 'الأمير', nameEn: 'Prince',
    enabled: true, comingSoon: false,
    activationCoins: 300_000, renewalCoins: 180_000, validityDays: 30,
    allowRenewal: true, coinReturnPercent: 100, coinReturnCoins: 0, grantedVipLevel: 11, honorPointsRequired: 0, requiredVipLevel: 0,
    themeKey: 'prince',
    heroSubtitleAr: 'الأمير — امتيازات SVIP11',
    heroSubtitleEn: 'Prince — SVIP11 privileges',
  }),
  levelSeed({
    id: 'king', level: 4, nameAr: 'الملك', nameEn: 'King',
    enabled: true, comingSoon: false,
    activationCoins: 80_000_000, renewalCoins: 80_000_000, validityDays: 30,
    allowRenewal: true, coinReturnPercent: 80, coinReturnCoins: 0, grantedVipLevel: 12, honorPointsRequired: 600_000, requiredVipLevel: 0,
    themeKey: 'king',
    heroSubtitleAr: 'الملك — امتيازات SVIP12',
    heroSubtitleEn: 'King — SVIP12 privileges',
    backgroundImageUrl: BG('king'),
  }),
  levelSeed({
    id: 'aristocrat', level: 5, nameAr: 'الأرستقراطي', nameEn: 'Aristocrat',
    enabled: true, comingSoon: false,
    activationCoins: 100_000, renewalCoins: 0, validityDays: 30,
    allowRenewal: false, coinReturnPercent: 0, coinReturnCoins: 0, grantedVipLevel: 12, honorPointsRequired: 0, requiredVipLevel: 0,
    themeKey: 'aristocrat',
    heroSubtitleAr: 'امتيازات SVIP12 بدون تجديد باقة',
    heroSubtitleEn: 'SVIP12 privileges with no renewal package',
    imageUrl: 'https://cdn-icons-png.flaticon.com/512/2582/2582603.png',
    backgroundImageUrl: BG('aristocrat'),
  }),
];

/** دمج المحتوى التجريبي مع الإعدادات الحالية (يحافظ على الأسعار إن وُجدت) */
export function mergeSampleAristocracyLevels(
  current: ConfigAristocracyLevel[],
): ConfigAristocracyLevel[] {
  return SAMPLE_ARISTOCRACY_LEVELS.map((sample) => {
    const existing = current.find((l) => l.id === sample.id);
    if (!existing) return sample;
    return {
      ...sample,
      activationCoins: existing.activationCoins,
      renewalCoins: existing.renewalCoins,
      allowRenewal: existing.allowRenewal ?? sample.allowRenewal,
      validityDays: existing.validityDays,
      coinReturnPercent: existing.coinReturnPercent,
      coinReturnCoins: existing.coinReturnCoins ?? sample.coinReturnCoins,
      grantedVipLevel: existing.grantedVipLevel ?? sample.grantedVipLevel,
      honorPointsRequired: existing.honorPointsRequired,
      requiredVipLevel: existing.requiredVipLevel,
      enabled: existing.enabled,
      comingSoon: existing.comingSoon,
      nameAr: existing.nameAr || sample.nameAr,
      nameEn: existing.nameEn || sample.nameEn,
      exclusiveGiftIds: existing.exclusiveGiftIds?.length
        ? existing.exclusiveGiftIds
        : (sample.exclusiveGiftIds?.length ? sample.exclusiveGiftIds : ARISTOCRACY_LEVEL_GIFT_IDS[sample.id] ?? []),
    };
  }).filter((lv) => FIXED_ARISTOCRACY_LEVEL_IDS.includes(lv.id as typeof FIXED_ARISTOCRACY_LEVEL_IDS[number]));
}
