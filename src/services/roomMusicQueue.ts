/**
 * قائمة تشغيل موسيقى الروم — RTDB
 */
import {
  ref,
  get,
  set,
  update,
  onValue,
  off,
} from 'firebase/database';
import { realtimeDb, auth } from './firebase/index';
import { addMusicToRoom, assertCanBroadcastRoomMusic, type RoomMusic } from './roomMusic';
import type { UserMusicTrack } from './roomMusicLibrary';

export interface RoomMusicQueueItem {
  id: string;
  url: string;
  title: string;
  fileName?: string;
  addedBy: string;
  addedByName: string;
  addedAt: number;
}

function queueRef(roomId: string) {
  return ref(realtimeDb, `rooms/${roomId}/musicQueue`);
}

export function subscribeToRoomMusicQueue(
  roomId: string,
  callback: (items: RoomMusicQueueItem[]) => void,
): () => void {
  const qRef = queueRef(roomId);
  const handler = onValue(qRef, (snap) => {
    const val = snap.val();
    if (!val) {
      callback([]);
      return;
    }
    const items = Array.isArray(val.items)
      ? (val.items as RoomMusicQueueItem[])
      : Object.values(val.items ?? {}) as RoomMusicQueueItem[];
    callback(items.sort((a, b) => a.addedAt - b.addedAt));
  });
  return () => off(qRef, 'value', handler);
}

export async function getRoomMusicQueue(roomId: string): Promise<RoomMusicQueueItem[]> {
  const snap = await get(queueRef(roomId));
  if (!snap.exists()) return [];
  const val = snap.val() as { items?: RoomMusicQueueItem[] };
  const items = Array.isArray(val.items) ? val.items : [];
  return items.sort((a, b) => a.addedAt - b.addedAt);
}

export async function setRoomMusicQueue(
  roomId: string,
  items: RoomMusicQueueItem[],
): Promise<void> {
  await set(queueRef(roomId), { items, updatedAt: Date.now() });
}

export async function appendToRoomMusicQueue(
  roomId: string,
  track: Pick<UserMusicTrack, 'url' | 'title' | 'fileName'>,
): Promise<void> {
  const uid = await assertCanBroadcastRoomMusic(roomId);
  const items = await getRoomMusicQueue(roomId);
  if (items.some((i) => i.url === track.url)) return;
  items.push({
    id: `${uid}_${Date.now()}`,
    url: track.url,
    title: track.title,
    fileName: track.fileName,
    addedBy: uid,
    addedByName: auth.currentUser?.displayName ?? 'مستخدم',
    addedAt: Date.now(),
  });
  await setRoomMusicQueue(roomId, items);
}

export async function removeFromRoomMusicQueue(
  roomId: string,
  itemId: string,
): Promise<void> {
  const items = await getRoomMusicQueue(roomId);
  await setRoomMusicQueue(
    roomId,
    items.filter((i) => i.id !== itemId),
  );
}

/** تشغيل مقطع في الروم — يُسمع للجميع عبر RTDB */
export async function playTrackInRoom(
  roomId: string,
  track: Pick<UserMusicTrack, 'url' | 'title' | 'fileName'>,
): Promise<void> {
  const { resolveTrackUrlForBroadcast } = await import('@/services/roomMusicLibrary');
  const broadcastUrl = await resolveTrackUrlForBroadcast(roomId, track.url);
  await addMusicToRoom(roomId, broadcastUrl, track.title, track.fileName);
}

/** إضافة للقائمة أو تشغيل مباشرة إن لم يكن هناك DJ */
export async function playOrQueueTrack(
  roomId: string,
  track: Pick<UserMusicTrack, 'url' | 'title' | 'fileName'>,
  currentMusic: RoomMusic | null,
): Promise<'played' | 'queued'> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');
  await assertCanBroadcastRoomMusic(roomId);

  if (!currentMusic) {
    await playTrackInRoom(roomId, track);
    return 'played';
  }

  // يوجد مقطع شغّال (حتى لو لي) → أضِف للقائمة بدل الاستبدال —
  // الاستبدال الفوري كان يمنع وجود أكثر من أغنية في قائمة التشغيل
  await appendToRoomMusicQueue(roomId, track);
  return 'queued';
}

export async function playAllTracksInRoom(
  roomId: string,
  tracks: Pick<UserMusicTrack, 'url' | 'title' | 'fileName'>[],
  currentMusic: RoomMusic | null,
): Promise<void> {
  if (!tracks.length) return;
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const [first, ...rest] = tracks;
  if (!first) return;

  if (!currentMusic || currentMusic.addedBy === user.uid) {
    await playTrackInRoom(roomId, first);
    const queueItems: RoomMusicQueueItem[] = rest.map((t, idx) => ({
      id: `${user.uid}_${Date.now()}_${idx}`,
      url: t.url,
      title: t.title,
      fileName: t.fileName,
      addedBy: user.uid,
      addedByName: user.displayName ?? 'مستخدم',
      addedAt: Date.now() + idx,
    }));
    await setRoomMusicQueue(roomId, queueItems);
    return;
  }

  for (const t of tracks) {
    await appendToRoomMusicQueue(roomId, t);
  }
}

/** عند انتهاء المقطع — تشغيل التالي تلقائياً */
export async function advanceRoomMusicQueue(roomId: string): Promise<boolean> {
  const items = await getRoomMusicQueue(roomId);
  if (!items.length) return false;
  const [next, ...rest] = items;
  if (!next) return false;
  await playTrackInRoom(roomId, next);
  await setRoomMusicQueue(roomId, rest);
  return true;
}

export async function clearRoomMusicQueue(roomId: string): Promise<void> {
  await update(queueRef(roomId), { items: [], updatedAt: Date.now() });
}
