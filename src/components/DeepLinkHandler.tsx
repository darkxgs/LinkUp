/**
 * يفتح الغرفة/البروفايل/المنشور عند استقبال linkup:// أو رابط linkuplivechat.com/r/{code}
 */

import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { resolveShareLink, SHARE_LINK_HOSTS } from '@/services/firebase/shareLinks';
import { getChallengeAppRoute, parseChallengeIdFromUrl } from '@/utils/challengeDeepLink';
import { parsePartyIdFromUrl, resolvePartyRoomRoute } from '@/utils/partyDeepLink';

function routeFromCustomScheme(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = Linking.parse(url);
    const path = (parsed.path || '').replace(/^\/+/, '');
    const host = parsed.hostname || '';

    if (host === 'room' && path) return `/room/${path.split('/')[0]}`;
    if (host === 'profile' && path) return `/profile/${path.split('/')[0]}`;
    if (host === 'post' && path) return `/post/${path.split('/')[0]}`;
    if (host === 'challenge' && path) {
      const id = decodeURIComponent(path.split('/')[0] ?? '');
      return id ? getChallengeAppRoute(id) : null;
    }
    if (path.startsWith('room/')) return `/room/${path.split('/')[1]}`;
    if (path.startsWith('profile/')) return `/profile/${path.split('/')[1]}`;
    if (path.startsWith('post/')) return `/post/${path.split('/')[1]}`;
    if (host === 'party' && path) {
      const id = decodeURIComponent(path.split('/')[0] ?? '');
      return id ? `party:${id}` : null;
    }
    if (path.startsWith('party/')) {
      const id = decodeURIComponent(path.split('/')[1] ?? '');
      return id ? `party:${id}` : null;
    }
    if (path.startsWith('challenge/')) {
      const id = decodeURIComponent(path.split('/')[1] ?? '');
      return id ? getChallengeAppRoute(id) : null;
    }
  } catch {
    return null;
  }
  return null;
}

function extractShareCode(url: string): string | null {
  try {
    const parsed = Linking.parse(url);
    const host = (parsed.hostname || '').toLowerCase();
    const path = (parsed.path || '').replace(/^\/+/, '');

    const isShareHost =
      SHARE_LINK_HOSTS.includes(host) || host.endsWith('.web.app');
    if (!isShareHost) return null;

    const match = path.match(/^r\/([a-z0-9]{5,12})/i);
    return match ? match[1]!.toLowerCase() : null;
  } catch {
    return null;
  }
}

async function routeFromUrl(url: string): Promise<string | null> {
  const challengeId = parseChallengeIdFromUrl(url);
  if (challengeId) return getChallengeAppRoute(challengeId);

  const partyId = parsePartyIdFromUrl(url);
  if (partyId) {
    const partyRoute = await resolvePartyRoomRoute(partyId);
    if (partyRoute) return partyRoute;
  }

  const schemeRoute = routeFromCustomScheme(url);
  if (schemeRoute?.startsWith('party:')) {
    const id = schemeRoute.slice('party:'.length);
    return resolvePartyRoomRoute(id);
  }
  if (schemeRoute) return schemeRoute;

  const code = extractShareCode(url);
  if (!code) return null;

  try {
    const resolved = await resolveShareLink(code);
    return resolved.route;
  } catch {
    return null;
  }
}

export function DeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    const go = async (url: string | null) => {
      if (!url) return;
      const route = await routeFromUrl(url);
      if (route) router.push(route as any);
    };

    Linking.getInitialURL().then(go);
    const sub = Linking.addEventListener('url', ({ url }) => {
      void go(url);
    });
    return () => sub.remove();
  }, [router]);

  return null;
}
