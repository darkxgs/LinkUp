import { COIN_CURRENCY_ICON, PEARL_CURRENCY_ICON } from '@/constants/brandAssets';

/** أصول كاردات البروفايل — PNG من حزمة التصميم (Line up App Full File) */

// نسبتان مختلفتان كما في التصميم:
//  - كروت المحفظة (الكوين/الماسة): 90/170
//  - كروت الترقية (Aristocracy/VIP): 76/170 (الشكل المخصّر)
export const WALLET_CARD_ASPECT = 90 / 170;
export const PROMO_CARD_ASPECT = 76 / 170;
// توافق خلفي
export const PROFILE_CARD_ASPECT = WALLET_CARD_ASPECT;

/** خلفيات الكروت — الأشعة (sunburst) للمحفظة، والشكل المخصّر للترقية */
export const PROFILE_CARD_IMAGES = {
  coins: require('../../../assets/design/profile/bg-coins.png'),
  pearls: require('../../../assets/design/profile/bg-pearls.png'),
  aristocracy: require('../../../assets/design/profile/bg-aristocracy.png'),
  vip: require('../../../assets/design/profile/bg-vip.png'),
} as const;

/** أيقونات العملات — من assets/images */
export const PROFILE_CARD_FOREGROUND = {
  coins: COIN_CURRENCY_ICON,
  pearls: PEARL_CURRENCY_ICON,
  aristocracy: require('../../../assets/design/profile/fg-aristocracy.png'),
  vip: require('../../../assets/design/profile/fg-vip.png'),
} as const;

export type ProfileCardImageVariant = keyof typeof PROFILE_CARD_IMAGES;

/** نِسب العناصر الأمامية (عرض/ارتفاع) لضبط الحجم دون تشويه */
export const PROFILE_FOREGROUND_RATIO: Record<ProfileCardImageVariant, number> = {
  coins: 1,
  pearls: 1,
  aristocracy: 54 / 50,
  vip: 51 / 50,
};

/** شعار SID السداسي الفضّي */
export const PROFILE_SID_LOGO = require('../../../assets/design/profile/sid-logo.png');

export const PROFILE_TOOL_PILL_IMAGE = require('../../../assets/design/profile/tool-pill.png');

export const PROFILE_HEADER_IMAGE = require('../../../assets/design/profile/profile-header.png');
export const PROFILE_HEADER_ASPECT = 195 / 393;
