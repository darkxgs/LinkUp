/**
 * LinkUp — تصميم شاشة SVIP (داكن — مطابق للمنافس)
 */
import type { VipLevelDef } from '@/services/firebase/vipSystem';

export type SvipLevelTheme = {
  bg: readonly [string, string, string];
  accent: string;
};

export const SVIP_DESIGN = {
  screenBg: '#0F0A0A',
  ink: '#FFFFFF',
  inkMuted: 'rgba(255,255,255,0.55)',
  gold: '#F5C842',
  goldDark: '#B8860B',
  goldBar: ['#3D2A0A', '#6B4A12', '#3D2A0A'] as const,
  tabActive: '#FF8C42',
  tabInactive: 'rgba(255,255,255,0.45)',
  pillBg: 'rgba(255,255,255,0.08)',
  pillBorder: 'rgba(255,255,255,0.12)',
  cardBg: 'rgba(28, 18, 18, 0.92)',
  cardBorder: 'rgba(255,255,255,0.08)',
  maintainBtn: ['#8A0E0E', '#B00E0E'] as const,
  lockedTag: '#6B7280',
  unlockedTag: '#22C55E',
  progressGem: '#34D399',
} as const;

const DEFAULT_THEMES: Record<number, SvipLevelTheme> = {
  1: { bg: ['#1A0E08', '#2D1810', '#0F0806'], accent: '#C0C0C0' },
  2: { bg: ['#3A0A0A', '#661515', '#300808'], accent: '#F06A6A' },
  3: { bg: ['#1A0A0C', '#3A0A0A', '#100406'], accent: '#FCA5A5' },
  4: { bg: ['#2A1A08', '#4A3010', '#1A1006'], accent: '#F5C842' },
  5: { bg: ['#1A0A0C', '#3A0A0A', '#180606'], accent: '#F26161' },
  6: { bg: ['#280A0A', '#401414', '#0A0405'], accent: '#FFD700' },
};

export function resolveSvipLevelTheme(levelDef: VipLevelDef | undefined): SvipLevelTheme {
  if (levelDef?.bgColors?.length === 3) {
    return {
      bg: [levelDef.bgColors[0]!, levelDef.bgColors[1]!, levelDef.bgColors[2]!],
      accent: levelDef.accentColor ?? SVIP_DESIGN.gold,
    };
  }
  const lv = levelDef?.level ?? 1;
  return DEFAULT_THEMES[lv] ?? DEFAULT_THEMES[1]!;
}
