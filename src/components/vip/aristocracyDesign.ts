/**
 * LinkUp — تصميم الأرستقراطية
 */
import type { ImageSourcePropType } from 'react-native';

export type AristocracyAssetKey =
  | 'emblem'
  | 'entry'
  | 'frame'
  | 'profileCard'
  | 'badge'
  | 'effects'
  | 'bubble';

export const ARISTOCRACY_ASSETS: Record<AristocracyAssetKey, ImageSourcePropType> = {
  emblem: require('../../../assets/design/profile/fg-aristocracy.png'),
  entry: require('../../../assets/design/png/Level Details screen - Entry Notice.png'),
  frame: require('../../../assets/design/png/Level - Crystal Wing.png'),
  profileCard: require('../../../assets/design/png/Profile - Aristocracy.png'),
  badge: require('../../../assets/design/png/Level Details screen - Honor Medal.png'),
  effects: require('../../../assets/design/png/Level - Rocket.png'),
  bubble: require('../../../assets/design/png/Profile - Pearls.png'),
};

export type LevelTheme = { bg: readonly [string, string, string]; accent: string };

export const LEVEL_THEMES: Record<string, LevelTheme> = {
  leader: { bg: ['#3F0F0F', '#5C1A1A', '#280A0A'], accent: '#F38A8A' },
  knight: { bg: ['#4A0A0A', '#721212', '#300808'], accent: '#EF5F5F' },
  minister: { bg: ['#480C0C', '#7A1515', '#380A0A'], accent: '#F06A6A' },
  prince: { bg: ['#4A0A12', '#7A1A1A', '#2D0808'], accent: '#FF7A8A' },
  noble: { bg: ['#3A0A0A', '#7A0A0A', '#1A0A0C'], accent: '#FCA5A5' },
  king: { bg: ['#3A1316', '#7A0A0A', '#3A1316'], accent: '#FCA5A5' },
  emperor: { bg: ['#280A0A', '#401414', '#0A0405'], accent: '#FFD700' },
  legend: { bg: ['#1A1A22', '#2A2A35', '#0E0E11'], accent: '#9A9AA5' },
};

export function resolveAristocracyLevelTheme(level: {
  themeKey: string;
  bgColors?: string[];
  accentColor?: string;
}): LevelTheme {
  if (level.bgColors?.length === 3) {
    return {
      bg: [level.bgColors[0]!, level.bgColors[1]!, level.bgColors[2]!],
      accent: level.accentColor ?? '#FFD700',
    };
  }
  return LEVEL_THEMES[level.themeKey] ?? LEVEL_THEMES.emperor!;
}
