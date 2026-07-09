import i18n from '@/localization/i18n';

export function getCasinoLocale(): 'ar' | 'en' {
  return i18n.language?.startsWith('en') ? 'en' : 'ar';
}

export function getCasinoGameLabel(gameId: string): string {
  return i18n.t(`casino.games.${gameId}.name`, { defaultValue: gameId });
}

export function getCasinoGameDesc(gameId: string): string {
  return i18n.t(`casino.games.${gameId}.desc`, { defaultValue: '' });
}
