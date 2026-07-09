/**
 * أصول وألوان شاشة مستوى الثروة — Line up App Full File / Level Details.png
 */
import type { ImageSourcePropType } from 'react-native';
import { REL_DESIGN } from '@/components/relationships/relationshipDesign';

export const WL_DESIGN = {
  ...REL_DESIGN,
  header: ['#FFFFFF', '#FFFBF2', '#FDF5E6'] as const,
  sheet: '#FFFFFF',
  taskIconBg: '#FFF9E6',
  taskCardBorder: '#E6DAC3',
  privilegeBorder: '#E6DAC3',
  levelUpBg: '#FFF9E6',
  lockedPill: '#222222',
  seeAllBg: '#FDF5E6',
  seeAllText: '#B89A53',
  expPurple: '#E11414',
  gold: '#D4AF37',
  progress: ['#F3D060', '#F0A0A0'] as const,
} as const;

export const WL_ASSETS = {
  /** الوسام الكبير في بطاقة المستوى */
  honorMedal: require('../../../assets/design/png/Level Details screen - Honor Medal.png') as ImageSourcePropType,
  /** أيقونة مزايا — Honor Medal */
  privilegeHonor: require('../../../assets/images/image copy1.png') as ImageSourcePropType,
  /** أيقونة مزايا — Entry Notice (صاروخ) */
  entryNotice: require('../../../assets/images/image copy2.png') as ImageSourcePropType,
  /** أيقونة مزايا — Free Gift (ماسة) */
  freeGift: require('../../../assets/images/image copy.png') as ImageSourcePropType,
} as const;

export type WealthPrivilegeId = 'honorMedal' | 'entryNotice' | 'freeGift';

export const WEALTH_PRIVILEGES: {
  id: WealthPrivilegeId;
  imageKey: 'privilegeHonor' | 'entryNotice' | 'freeGift';
  unlockLevel: number;
  titleKey: string;
}[] = [
    { id: 'honorMedal', imageKey: 'privilegeHonor', unlockLevel: 10, titleKey: 'wealthLevel.text22139' },
    { id: 'entryNotice', imageKey: 'entryNotice', unlockLevel: 10, titleKey: 'wealthLevel.text16956' },
    { id: 'freeGift', imageKey: 'freeGift', unlockLevel: 5, titleKey: 'wealthLevel.freeGift' },
  ];
