/**
 * LinkUp — مركز المكافآت (هوية بصرية)
 */
import type { ImageSourcePropType } from 'react-native';

import { COIN_CURRENCY_ICON, PEARL_CURRENCY_ICON } from '@/constants/brandAssets';

export const REWARDS_DESIGN = {
  header: ['#FFFFFF', '#FFFBF2', '#FDF5E6'] as const,
  headerSoft: ['#FFFFFF', '#FFFBF2', '#FDF5E6'] as const,
  premium: ['#EBE0C5', '#D4AF37', '#C59A28'] as const,
  card: '#FFFFFF',
  ink: '#4B3621',
  ink2: '#8B7355',
  muted: '#A69B8D',
  line: '#E6DAC3',
  gold: '#D4AF37',
  gold2: '#B8860B',
  pink: '#E11414',
  mint: '#5E5E66', // Used for 'New' badge (now dark indigo)
  dayBg: '#FFFFFF',
  dayClaimed: '#FDF5E6',
  taskBtn: ['#FDF5E6', '#FFFBF2'] as const,
  upgradeBtn: '#FFFFFF',
} as const;

export const REWARDS_ASSETS = {
  coin: COIN_CURRENCY_ICON as ImageSourcePropType,
  pearl: PEARL_CURRENCY_ICON as ImageSourcePropType,
  ticket: require('../../../assets/design/png/Level Details screen - Entry Notice.png') as ImageSourcePropType,
  frame: require('../../../assets/design/png/Level -  Classic.png') as ImageSourcePropType,
  gift: require('../../../assets/design/png/Level - level heart.png') as ImageSourcePropType,
} as const;
