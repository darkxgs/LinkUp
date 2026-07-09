/**
 * ألوان شاشة الروم الحي — LinkUp (أحمر/أسود)
 * متوافقة مع TAB_DESIGN (#E11414)
 */
import { TAB_DESIGN } from '@/theme/tab-design';

export const ROOM_DESIGN = {
  ...TAB_DESIGN,
  stageTop: '#0A0405',
  stageMid: '#1A0A0C',
  stageBottom: '#100406',
  spotlight: 'rgba(255,60,40,0.30)',
  podium: 'rgba(225,20,20,0.5)',
  glass: 'rgba(255,255,255,0.42)',
  glassPurple: 'rgba(225,20,20,0.12)',
  glassBorder: 'rgba(255,255,255,0.75)',
  pillBg: 'rgba(0,0,0,0.38)',
  pillBorder: 'rgba(255,255,255,0.1)',
  inputBg: 'rgba(255,255,255,0.42)',
  inputPurple: 'rgba(225,20,20,0.12)',
  inputBorder: 'rgba(255,255,255,0.75)',
  barBg: 'rgba(255,255,255,0.08)',
  iconBtnBg: 'rgba(255,255,255,0.42)',
  iconBtnPurple: 'rgba(225,20,20,0.2)',
  giftPink: '#FF3B69',
  giftGrad: ['#FF3B69', '#B00E0E'] as const,
  textPrimary: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.65)',
  badgeRed: '#EF4444',
} as const;
