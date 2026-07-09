/**
 * مكتبة موسيقى الجلسة — في الذاكرة فقط، خاصة بكل مستخدم داخل الروم الحالي.
 * لا تُحفظ بين الجلسات ولا تُشارك مع الآخرين.
 */
import { ROOM_MUSIC_MAX_LIBRARY_TRACKS } from '@/constants/roomMusic';
import type { UserMusicTrack } from './roomMusicLibrary';

type Listener = (tracks: UserMusicTrack[]) => void;

const libraries = new Map<string, UserMusicTrack[]>();
const listeners = new Map<string, Set<Listener>>();

function sessionKey(roomId: string, uid: string): string {
  return `${roomId}:${uid}`;
}

function notify(key: string): void {
  const tracks = libraries.get(key) ?? [];
  const list = [...tracks];
  listeners.get(key)?.forEach((cb) => cb(list));
}

export function getSessionMusicLibrary(roomId: string, uid: string): UserMusicTrack[] {
  if (!roomId || !uid) return [];
  return [...(libraries.get(sessionKey(roomId, uid)) ?? [])];
}

export function addSessionMusicTrack(
  roomId: string,
  uid: string,
  track: UserMusicTrack,
): void {
  if (!roomId || !uid) return;
  const key = sessionKey(roomId, uid);
  const existing = libraries.get(key) ?? [];
  const without = existing.filter((t) => t.id !== track.id && t.url !== track.url);
  libraries.set(
    key,
    [{ ...track, addedByUid: track.addedByUid ?? uid }, ...without].slice(
      0,
      ROOM_MUSIC_MAX_LIBRARY_TRACKS,
    ),
  );
  notify(key);
}

export function removeSessionMusicTrack(roomId: string, uid: string, trackId: string): void {
  if (!roomId || !uid) return;
  const key = sessionKey(roomId, uid);
  const existing = libraries.get(key) ?? [];
  libraries.set(
    key,
    existing.filter((t) => t.id !== trackId),
  );
  notify(key);
}

export function clearSessionMusicLibrary(roomId: string, uid?: string): void {
  if (!roomId) return;
  if (uid) {
    const key = sessionKey(roomId, uid);
    libraries.delete(key);
    notify(key);
    return;
  }
  for (const key of [...libraries.keys()]) {
    if (key.startsWith(`${roomId}:`)) {
      libraries.delete(key);
      notify(key);
    }
  }
}

export function subscribeSessionMusicLibrary(
  roomId: string,
  uid: string,
  callback: Listener,
): () => void {
  const key = sessionKey(roomId, uid);
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(callback);
  callback(getSessionMusicLibrary(roomId, uid));
  return () => {
    listeners.get(key)?.delete(callback);
  };
}
