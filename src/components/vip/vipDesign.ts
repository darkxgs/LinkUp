/**
 * هوية شاشة VIP — LinkUp (فاتح + أصول PNG/SVG من حزمة التصميم)
 */
import type { ImageSourcePropType } from 'react-native';
import type { VipPrivilegeAsset } from '@/services/firebase/vipSystem';
import { levelCardImage } from '@/components/relationships/relationshipDesign';

export const VIP_DESIGN = {
  header: ['#FEE2E2', '#FCD5D5', '#FFF1F1'] as const,
  sheet: '#FFFFFF',
  purple: '#E11414',
  purpleMid: '#E11414',
  purpleSoft: '#FEE2E2',
  pink: '#E11414',
  gold: '#FFC53D',
  goldDark: '#B8860B',
  ink: '#1B1B22',
  ink2: '#5E5E68',
  muted: '#9A9AA5',
  line: '#FEE2E2',
  cardBorder: '#FBEAEA',
  taskIconBg: '#FEE2E2',
  progress: ['#EF5F5F', '#EC3E3E'] as const,
  upgrade: ['#FF3340', '#E11414', '#B00E0E'] as const,
  modeTabBg: 'rgba(255,255,255,0.88)',
  lockedPill: '#8B93A7',
  reachedPill: '#E11414',
} as const;

/** أيقونات الامتيازات — PNG أصلية للامتيازات البصرية الأساسية.
 *  الامتيازات الموسّعة بلا PNG تعتمد على PrivilegeVectorIcon. */
export const VIP_ASSETS: Partial<Record<VipPrivilegeAsset, ImageSourcePropType>> = {
  vipBadge: require('../../../assets/design/png/Profile - VIP.png'),
  vipSeat: require('../../../assets/design/profile/card-vip.png'),
  entryEffect: require('../../../assets/design/png/Level - Rocket.png'),
  chatBubble: require('../../../assets/design/png/Profile - Pearls.png'),
  profileCard: require('../../../assets/design/profile/bg-vip.png'),
  vipEntry: require('../../../assets/design/png/Level - Spacecraft.png'),
  photoFrame: require('../../../assets/design/png/Level - Crystal Wing.png'),
  honorMedal: require('../../../assets/design/png/Level Details screen - Honor Medal.png'),
};

export const VIP_EMBLEM = require('../../../assets/design/png/Profile - VIP.png') as ImageSourcePropType;

/** وسام المستوى المعروض — بطاقة مستوى حقيقية لكل VIP/SVIP */
export function vipLevelEmblem(level: number): ImageSourcePropType {
  return levelCardImage(Math.min(Math.max(level, 1), 12));
}
