/**
 * قائمة تشغيل موسيقى الروم — RTDB
 *
 * كل تعديل على القائمة يمر عبر runTransaction — إضافتان متزامنتان من جهازين
 * لا تفقد إحداهما (كانت قراءة-تعديل-كتابة فتضيع الكتابة الأسبق).
 *
 * لا رفع إجباري: مسار local://trackId يدخل القائمة كما هو — جهاز صاحبه
 * يخلطه مباشرة عبر Agora؛ ولغير صاحبه يُعلَّم «غير متاح» ويُتخطى.
 */
import {
  ref,
  get,
  set,
  update,
  onValue,
  off,
  runTransaction,
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

function normalizeQueueItems(raw: unknown): RoomMusicQueueItem[] {
  const val = (raw ?? {}) as { items?: unknown };
  const items = Array.isArray(val.items)
    ? (val.items as RoomMusicQueueItem[])
    : (Object.values(val.items ?? {}) as RoomMusicQueueItem[]);
  return items
    .filter((i) => i && typeof i.url === 'string' && !!i.id)
    .sort((a, b) => (a.addedAt ?? 0) - (b.addedAt ?? 0));
}

/**
 * هل هذا المقطع غير متاح للـDJ الفعّال؟ — ملف محلي على جهاز مستخدم آخر
 * (لا يمكن خلطه إلا من جهاز صاحبه). يُستخدم للعرض وللتخطي عند advance.
 */
export function isQueueItemUnavailableFor(
  item: Pick<RoomMusicQueueItem, 'url' | 'addedBy'>,
  djUid: string | null | undefined,
): boolean {
  return item.url.startsWith('local://') && (!djUid || item.addedBy !== djUid);
}

export function subscribeToRoomMusicQueue(
  roomId: string,
  callback: (items: RoomMusicQueueItem[]) => void,
): () => void {
  const qRef = queueRef(roomId);
  const handler = onValue(qRef, (snap) => {
    callback(normalizeQueueItems(snap.val()));
  });
  return () => off(qRef, 'value', handler);
}

export async function getRoomMusicQueue(roomId: string): Promise<RoomMusicQueueItem[]> {
  const snap = await get(queueRef(roomId));
  if (!snap.exists()) return [];
  return normalizeQueueItems(snap.val());
}

export async function setRoomMusicQueue(
  roomId: string,
  items: RoomMusicQueueItem[],
): Promise<void> {
  await set(queueRef(roomId), { items, updatedAt: Date.now() });
}

function buildQueueItem(
  uid: string,
  track: Pick<UserMusicTrack, 'url' | 'title' | 'fileName'>,
  salt = 0,
): RoomMusicQueueItem {
  const item: RoomMusicQueueItem = {
    id: `${uid}_${Date.now()}_${salt}_${Math.floor(Math.random() * 1e6)}`,
    url: track.url,
    title: track.title,
    addedBy: uid,
    addedByName: auth.currentUser?.displayName ?? 'مستخدم',
    addedAt: Date.now() + salt,
  };
  // RTDB يرفض undefined — الحقل الاختياري يُدرج فقط عند وجوده
  if (track.fileName) item.fileName = track.fileName;
  return item;
}

/** إضافة ذرّية عبر transaction — التكرار بنفس الرابط يُتجاهل بصمت */
export async function appendToRoomMusicQueue(
  roomId: string,
  track: Pick<UserMusicTrack, 'url' | 'title' | 'fileName'>,
): Promise<void> {
  const uid = await assertCanBroadcastRoomMusic(roomId);
  await runTransaction(queueRef(roomId), (raw) => {
    const items = normalizeQueueItems(raw);
    if (items.some((i) => i.url === track.url)) return raw as unknown;
    items.push(buildQueueItem(uid, track));
    return { items, updatedAt: Date.now() };
  });
}

/** إضافة دفعة واحدة ذرّياً — لسحب متعدد الملفات */
export async function appendManyToRoomMusicQueue(
  roomId: string,
  tracks: Pick<UserMusicTrack, 'url' | 'title' | 'fileName'>[],
): Promise<void> {
  if (!tracks.length) return;
  const uid = await assertCanBroadcastRoomMusic(roomId);
  await runTransaction(queueRef(roomId), (raw) => {
    const items = normalizeQueueItems(raw);
    let salt = 0;
    for (const track of tracks) {
      if (items.some((i) => i.url === track.url)) continue;
      items.push(buildQueueItem(uid, track, salt));
      salt += 1;
    }
    return { items, updatedAt: Date.now() };
  });
}

/** حذف ذرّي عبر transaction — حذفان متزامنان لا يعيدان عنصراً محذوفاً */
export async function removeFromRoomMusicQueue(
  roomId: string,
  itemId: string,
): Promise<void> {
  await runTransaction(queueRef(roomId), (raw) => {
    const items = normalizeQueueItems(raw).filter((i) => i.id !== itemId);
    return { items, updatedAt: Date.now() };
  });
}

/** تشغيل مقطع في الروم — يكتب عقدة العرض؛ جهاز الـDJ يبدأ الخلط عبر مراقبه */
export async function playTrackInRoom(
  roomId: string,
  track: Pick<UserMusicTrack, 'url' | 'title' | 'fileName'>,
): Promise<void> {
  await addMusicToRoom(roomId, track.url, track.title, track.fileName);
}

/**
 * «تشغيل الآن» الصريح — يقطع المقطع الحالي عمداً ويشغّل هذا المقطع،
 * ويُزيل نسخته من قائمة الانتظار إن كانت فيها.
 */
export async function playTrackNowInRoom(
  roomId: string,
  track: Pick<UserMusicTrack, 'url' | 'title' | 'fileName'>,
): Promise<void> {
  await playTrackInRoom(roomId, track);
  await runTransaction(queueRef(roomId), (raw) => {
    const items = normalizeQueueItems(raw).filter((i) => i.url !== track.url);
    return { items, updatedAt: Date.now() };
  }).catch(() => {});
}

/** إضافة للقائمة أو تشغيل مباشرة إن لم يكن هناك DJ — الإضافة لا تقطع أبداً */
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
  // القطع المتعمد له زر «تشغيل الآن» الصريح (playTrackNowInRoom)
  await appendToRoomMusicQueue(roomId, track);
  return 'queued';
}

/**
 * تشغيل مجموعة: لا استبدال للطابور بعد اليوم — إن لم يكن هناك موسيقى
 * تُشغَّل الأولى وتُلحق البقية، وإلا تُلحق كلها (append-only).
 */
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

  if (!currentMusic) {
    await playTrackInRoom(roomId, first);
    if (rest.length) await appendManyToRoomMusicQueue(roomId, rest);
    return;
  }

  await appendManyToRoomMusicQueue(roomId, tracks);
}

/**
 * عند انتهاء المقطع (أو «متابعة الطابور» بعد نزول الـDJ) — يسحب ذرّياً أول
 * مقطع يستطيع *المستدعي* تشغيله ويشغّله؛ المقاطع المحلية لأجهزة الآخرين
 * تبقى في القائمة معلَّمة «غير متاحة» (قد يعود صاحبها فيتابعها).
 */
export async function advanceRoomMusicQueue(roomId: string): Promise<boolean> {
  const uid = auth.currentUser?.uid;
  if (!uid) return false;

  let popped: RoomMusicQueueItem | null = null;
  const result = await runTransaction(queueRef(roomId), (raw) => {
    popped = null;
    const items = normalizeQueueItems(raw);
    const idx = items.findIndex((i) => !isQueueItemUnavailableFor(i, uid));
    if (idx < 0) return raw as unknown; // لا شيء قابل للتشغيل — بلا تغيير
    popped = items[idx]!;
    items.splice(idx, 1);
    return { items, updatedAt: Date.now() };
  }).catch(() => null);

  if (!result || !popped) return false;
  const next = popped as RoomMusicQueueItem;
  await playTrackInRoom(roomId, {
    url: next.url,
    title: next.title,
    fileName: next.fileName,
  });
  return true;
}

export async function clearRoomMusicQueue(roomId: string): Promise<void> {
  await update(queueRef(roomId), { items: [], updatedAt: Date.now() });
}
