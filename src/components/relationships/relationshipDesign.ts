/**
 * أصول وألوان شاشة العلاقة — Line up App Full File / Level-1.png
 */
import type { ImageSourcePropType } from 'react-native';

/** ألوان مستخرجة من Level Tag.svg و Level-1.png */
export const REL_DESIGN = {
  // غلاف التصميم: وردي/لافندر (أعلى) → أزرق فاتح (مطابق Relation.png)
  bg: ['#FEE2E2', '#FCD5D5', '#FFF1F1'] as const,
  purple: '#E11414',
  purpleMid: '#E11414',
  purpleSoft: '#FEE2E2',
  pinkSoft: '#FECACA',
  heartRed: '#F70000',
  ink: '#1B1B22',
  ink2: '#5E5E68',
  muted: '#9A9AA5',
  line: '#FEE2E2',
  card: '#FFFFFF',
  cardTint: '#FEF2F2',
  progress: ['#EF5F5F', '#EC3E3E'] as const,
  upgrade: ['#FF3340', '#B00E0E'] as const,
  statusLockedBg: '#F1F3F6',
  statusLockedText: '#8B93A7',
  statusReachedBg: '#FEE2E2',
  statusReachedText: '#E11414',
  whiteGlass: 'rgba(255,255,255,0.92)',
} as const;

export const REL_ASSETS = {
  heart3d: require('../../../assets/design/png/Level - level heart.png') as ImageSourcePropType,
  honorMedal: require('../../../assets/design/png/Level Details screen - Honor Medal.png') as ImageSourcePropType,
} as const;

/** صورة بطاقة كل مستوى — من حزمة التصميم */
export const LEVEL_CARD_IMAGES: Record<number, ImageSourcePropType> = {
  1: require('../../../assets/design/png/Level - First Sight level card.png'),
  2: require('../../../assets/design/png/Level -  Classic.png'),
  3: require('../../../assets/design/png/Level - Golden Ma...png'),
  4: require('../../../assets/design/png/Level - level heart.png'),
  5: require('../../../assets/design/png/Level - Crystal Wing.png'),
  6: require('../../../assets/design/png/Level - Rocket.png'),
  7: require('../../../assets/design/png/Level - Spacecraft.png'),
  8: require('../../../assets/design/png/Level -  Angel.png'),
  9: require('../../../assets/design/png/Level - Lamborghini.png'),
  10: require('../../../assets/design/png/Level -  Classic.png'),
  11: require('../../../assets/design/png/Level - Golden Ma...png'),
  12: require('../../../assets/design/png/Level - Crystal Wing.png'),
  13: require('../../../assets/design/png/Level - Rocket.png'),
  14: require('../../../assets/design/png/Level - Spacecraft.png'),
  15: require('../../../assets/design/png/Level -  Angel.png'),
};

export function levelCardImage(level: number): ImageSourcePropType {
  return LEVEL_CARD_IMAGES[level] ?? LEVEL_CARD_IMAGES[1]!;
}
