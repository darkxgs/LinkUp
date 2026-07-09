/**
 * ألوان شاشة الروم الحي — LinkUp (أحمر/أسود)
 * متوافقة مع TAB_DESIGN (#E11414)
 */
import { TAB_DESIGN } from '@/theme/tab-design';

export const ROOM_DESIGN = {
  ...TAB_DESIGN,
  stageTop: '#141018',
  stageMid: '#241820',
  stageBottom: '#181218',
  /** Main live-room background gradient (top → bottom) */
  stageGradient: ['#4A2830', '#352028', '#241820', '#1A1418'] as const,
  /** Modals / sheets over the room */
  panelGradient: ['#422830', '#2A1C22', '#1E1418'] as const,
  panelGradientShort: ['#422830', '#241820'] as const,
  scrim: 'rgba(24, 18, 24, 0.72)',
  spotlight: 'rgba(255,80,60,0.32)',
  podium: 'rgba(225,20,20,0.52)',
  glass: 'rgba(255,255,255,0.48)',
  glassPurple: 'rgba(225,20,20,0.14)',
  glassBorder: 'rgba(255,255,255,0.78)',
  pillBg: 'rgba(0,0,0,0.28)',
  pillBorder: 'rgba(255,255,255,0.14)',
  inputBg: 'rgba(255,255,255,0.48)',
  inputPurple: 'rgba(225,20,20,0.14)',
  inputBorder: 'rgba(255,255,255,0.78)',
  barBg: 'rgba(255,255,255,0.12)',
  iconBtnBg: 'rgba(255,255,255,0.48)',
  iconBtnPurple: 'rgba(225,20,20,0.22)',
  giftPink: '#FF3B69',
  giftGrad: ['#FF3B69', '#B00E0E'] as const,
  textPrimary: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.72)',
  badgeRed: '#EF4444',
  shellBg: '#141820',
  borderDark: '#241820',
} as const;
