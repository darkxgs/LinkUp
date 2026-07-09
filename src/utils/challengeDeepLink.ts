/**
 * Deep links لدعوات التحدي — linkup://challenge/{challengeId}
 */
import * as Linking from 'expo-linking';

export function getChallengeDeepLink(challengeId: string): string {
  return `linkup://challenge/${encodeURIComponent(challengeId)}`;
}

export function getChallengeAppRoute(challengeId: string): string {
  return `/games/challenges/active?challengeId=${encodeURIComponent(challengeId)}`;
}

/** استخراج معرّف التحدي من رابط التطبيق أو الويب */
export function parseChallengeIdFromUrl(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = Linking.parse(url);
    const host = (parsed.hostname || '').toLowerCase();
    const path = (parsed.path || '').replace(/^\/+/, '');

    if (host === 'challenge' && path) {
      return decodeURIComponent(path.split('/')[0] ?? '');
    }
    if (path.startsWith('challenge/')) {
      return decodeURIComponent(path.split('/')[1] ?? '');
    }

    const q = parsed.queryParams?.challengeId;
    if (typeof q === 'string' && q.trim()) return q.trim();
    if (Array.isArray(q) && typeof q[0] === 'string' && q[0].trim()) return q[0].trim();

    const incoming = parsed.queryParams?.incoming;
    if (typeof incoming === 'string' && incoming.trim()) return incoming.trim();
  } catch {
    return null;
  }
  return null;
}
