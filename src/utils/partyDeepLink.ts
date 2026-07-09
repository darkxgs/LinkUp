/**
 * Deep Link للحفلات — linkup://party/{partyId} → غرفة الوكالة
 */
import * as Linking from 'expo-linking';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/services/firebase/index';

export function parsePartyIdFromUrl(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = Linking.parse(url);
    const host = parsed.hostname || '';
    const path = (parsed.path || '').replace(/^\/+/, '');
    if (host === 'party' && path) return decodeURIComponent(path.split('/')[0] ?? '');
    if (path.startsWith('party/')) return decodeURIComponent(path.split('/')[1] ?? '');
  } catch {
    return null;
  }
  return null;
}

export async function resolvePartyRoomRoute(partyId: string): Promise<string | null> {
  if (!partyId) return null;
  try {
    const snap = await getDoc(doc(firestore, 'agencyPartyRequests', partyId));
    if (!snap.exists()) return null;
    const data = snap.data() as { roomId?: string; status?: string };
    if (data.status !== 'approved') return null;
    const roomId = String(data.roomId ?? '');
    return roomId ? `/room/${roomId}` : null;
  } catch {
    return null;
  }
}
