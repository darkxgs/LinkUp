/**
 * LinkUp — جدار الألقاب
 */
export const TITLES_DESIGN = {
  bg: ['#1A0A0C', '#100406', '#0A0405'] as const,
  card: 'rgba(255,255,255,0.06)',
  cardBorder: 'rgba(255,255,255,0.1)',
  ink: '#FFFFFF',
  ink2: 'rgba(255,255,255,0.65)',
  muted: 'rgba(255,255,255,0.4)',
  gold: '#FFD700',
  gold2: '#FFC53D',
  slotEmpty: 'rgba(255,255,255,0.08)',
  slotLocked: 'rgba(0,0,0,0.35)',
  accent: '#E11414',
} as const;

export const TITLE_RARITY_COLORS: Record<string, [string, string]> = {
  common: ['#5E5E68', '#9A9AA5'],
  rare: ['#FCA5A5', '#F26161'],
  epic: ['#FF3340', '#B00E0E'],
  legendary: ['#FFD700', '#FF9A2E'],
};
