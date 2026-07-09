import i18n from '@/localization/i18n';
import type { ChallengeGameId } from '@/services/firebase/challenges';

const GAME_I18N_KEY: Record<ChallengeGameId, string> = {
  penalty: 'penalty',
  'coin-flip': 'coinFlip',
  billiards: 'billiards',
};

export function challengeGameI18nKey(gameId: string): string {
  return GAME_I18N_KEY[gameId as ChallengeGameId] ?? gameId;
}

export function getChallengeGameLabel(gameId: ChallengeGameId): string {
  const key = challengeGameI18nKey(gameId);
  return i18n.t(`challenges.games.${key}.name`, { defaultValue: gameId });
}

export function getChallengeGameDesc(gameId: ChallengeGameId): string {
  const key = challengeGameI18nKey(gameId);
  return i18n.t(`challenges.games.${key}.desc`, { defaultValue: '' });
}

export function getChallengeLocale(): 'ar' | 'en' {
  return i18n.language?.startsWith('en') ? 'en' : 'ar';
}
