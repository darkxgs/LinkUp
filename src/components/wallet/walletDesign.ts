/**
 * هوية شاشات المحفظة والشحن — LinkUp
 */
import type { ImageSourcePropType } from 'react-native';

import { COIN_CURRENCY_ICON, CASINO_CURRENCY_ICON, PEARL_CURRENCY_ICON } from '@/constants/brandAssets';

export const WALLET_DESIGN = {
  rechargeHeader: ['#FFC53D', '#FF9A2E', '#E11414'] as const,
  rechargeHeaderSoft: ['#FFE08A', '#FFB347', '#FF7A8A'] as const,
  card: '#FFFFFF',
  ink: '#1A0A0C',
  ink2: '#5E5E68',
  muted: '#9A9AA5',
  line: '#FEE2E2',
  purple: '#E11414',
  purpleDark: '#E11414',
  pink: '#E11414',
  gold: '#FFC53D',
  gold2: '#FF9A2E',
  mint: '#2BD9A8',
  vipBanner: ['#1A0A0C', '#3A0A0A', '#E11414'] as const,
  selectedBorder: '#E11414',
  botBadge: '#EC3E3E',
} as const;

export const WALLET_ASSETS = {
  coin: COIN_CURRENCY_ICON as ImageSourcePropType,
  coinBg: require('../../../assets/design/png/Profile - coin Bg.png') as ImageSourcePropType,
  pearls: PEARL_CURRENCY_ICON as ImageSourcePropType,
  pearlsBg: require('../../../assets/design/png/Profile - Pearls BG.png') as ImageSourcePropType,
  casino: CASINO_CURRENCY_ICON as ImageSourcePropType,
} as const;
