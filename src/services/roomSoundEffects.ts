/**
 * Room Sound Effects — بث متزامن عبر RTDB + تشغيل من ملفات محلية
 */
import {
  ref,
  set,
  remove,
  onChildAdded,
  onValue,
  query,
  limitToLast,
  type DataSnapshot,
} from 'firebase/database';
import { realtimeDb, auth } from './firebase/index';
import {
  ROOM_SOUND_EFFECTS,
  getSoundEffectById,
  type SoundEffectDef,
  type SoundEffectId,
} from '@/constants/roomSoundEffectsCatalog';
import {
  playRoomSoundSource,
  warmRoomSoundEffectsCatalog,
} from '@/utils/playRoomSound';

export type { SoundEffectDef, SoundEffectDef as SoundEffect, SoundEffectId };
export { ROOM_SOUND_EFFECTS, getSoundEffectById };

/** @deprecated استخدم ROOM_SOUND_EFFECTS من الكتالوج */
export const SOUND_EFFECTS = ROOM_SOUND_EFFECTS;

export interface SoundEffectEvent {
  effectId: string;
  triggeredBy: string;
  triggeredByName: string;
  ts: number;
}

const EVENT_TTL_MS = 30_000;

/** تحميل مسبق لكل المؤثرات عند دخول الروم */
export async function warmRoomSoundEffects(): Promise<void> {
  await warmRoomSoundEffectsCatalog(ROOM_SOUND_EFFECTS);
}

export async function triggerSoundEffect(
  roomId: string,
  effectId: SoundEffectId,
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const effect = getSoundEffectById(effectId);
  if (!effect) throw new Error('مؤثر غير معروف');

  let displayName = user.displayName ?? 'مستخدم';
  try {
    const { getUser } = await import('./firebase/users');
    const u = await getUser(user.uid);
    if (u?.displayName) displayName = u.displayName;
  } catch {
    // ignore
  }

  const payload: SoundEffectEvent = {
    effectId,
    triggeredBy: user.uid,
    triggeredByName: displayName,
    ts: Date.now(),
  };

  // push — كل مستمع يستقبل حدثاً جديداً بشكل موثوق
  // عقدة واحدة تُستبدل بدل push — عقدة الأحداث كانت تكبر للأبد فتُغرق كل مشترك
  // جديد بآلاف الأحداث التاريخية (سبب «التهنيج» الدائم حتى بعد إعادة فتح التطبيق).
  // تنظيف الركام القديم في الخلفية:
  remove(ref(realtimeDb, `rooms/${roomId}/soundEffectEvents`)).catch(() => {});

  // توافق مع المشتركين القدامى
  await set(ref(realtimeDb, `rooms/${roomId}/soundEffect`), payload);
}

function isFreshSoundEffectEvent(event: SoundEffectEvent, subscribedAt: number): boolean {
  const ts = Number(event?.ts) || 0;
  if (!event?.effectId || !ts) return false;
  if (ts < subscribedAt - 800) return false;
  if (Date.now() - ts > EVENT_TTL_MS) return false;
  return true;
}

function handleSoundEffectSnapshot(
  event: SoundEffectEvent,
  subscribedAt: number,
  seenKeys: Set<string>,
  eventKey: string,
  callback: (event: SoundEffectEvent) => void,
): void {
  if (!isFreshSoundEffectEvent(event, subscribedAt)) return;
  if (seenKeys.has(eventKey)) return;
  seenKeys.add(eventKey);
  callback(event);
}

export const subscribeToSoundEffects = (
  roomId: string,
  callback: (event: SoundEffectEvent) => void,
): (() => void) => {
  const subscribedAt = Date.now();
  const seenKeys = new Set<string>();
  const eventsRef = ref(realtimeDb, `rooms/${roomId}/soundEffectEvents`);
  const legacyRef = ref(realtimeDb, `rooms/${roomId}/soundEffect`);

  const onNewEvent = (snap: DataSnapshot) => {
    if (!snap.exists()) return;
    handleSoundEffectSnapshot(
      snap.val() as SoundEffectEvent,
      subscribedAt,
      seenKeys,
      snap.key ?? String(snap.val()?.ts ?? ''),
      callback,
    );
  };

  // limitToLast: نسخ التطبيق القديمة ما زالت ترسل push هنا — نستمع لآخر حدثين فقط
  // بدل تنزيل كامل التاريخ (كان يجمّد الروم لثوانٍ عند الدخول)
  const unsubChild = onChildAdded(query(eventsRef, limitToLast(2)), onNewEvent);

  let legacyInitialized = false;
  let legacyLastTs = 0;
  const unsubLegacy = onValue(legacyRef, (snap) => {
    if (!snap.exists()) return;
    const event = snap.val() as SoundEffectEvent;
    if (!legacyInitialized) {
      legacyInitialized = true;
      legacyLastTs = Number(event.ts) || 0;
      return;
    }
    const ts = Number(event.ts) || 0;
    if (ts <= legacyLastTs) return;
    legacyLastTs = ts;
    handleSoundEffectSnapshot(event, subscribedAt, seenKeys, `legacy:${ts}`, callback);
  });

  return () => {
    unsubChild();
    unsubLegacy();
  };
};

export const getSoundEffect = (effectId: string): SoundEffectDef | undefined =>
  getSoundEffectById(effectId);

/** تشغيل فوري على جهازك (قبل/مع البث) */
export const playSoundEffectLocal = async (
  effectId: SoundEffectId,
  volume = 0.9,
): Promise<void> => {
  const effect = getSoundEffectById(effectId);
  if (!effect) return;
  await playRoomSoundSource(effect.source, volume, effect.id);
};
