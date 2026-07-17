/**
 * حضور غرف الوكالات — مقاعد + جمهور مباشر من RTDB
 */
import {
  subscribeToRoom,
  subscribeToAudience,
  subscribeToRoomAudienceUids,
  countFilledSeats,
  derivePresenceCount,
  type Room,
  type RoomAudienceMember,
} from '@/services/firebase/rooms';

export type AgencyPresenceFace = {
  uid: string;
  avatar: string;
  name: string;
  onMic?: boolean;
};

export type AgencyRoomPresenceSnapshot = {
  faces: AgencyPresenceFace[];
  micCount: number;
  audienceCount: number;
  totalCount: number;
};

function isUidOnMic(uid: string, room: Room | null): boolean {
  if (!uid || !room) return false;
  if (room.hostUid === uid) return true;
  return Object.values(room.seats ?? {}).some((s) => s?.uid === uid);
}

export function buildAgencyRoomPresenceFaces(
  room: Room | null,
  audience: RoomAudienceMember[],
  maxVisible = 4,
): AgencyPresenceFace[] {
  const byUid = new Map<string, AgencyPresenceFace>();

  // #15: لا نعرض صورة صاحب الوكالة إلا إذا كان موجوداً فعلاً (مقعد أو جمهور) —
  // كانت تُضاف بلا شرط فتبقى الصورة على البطاقة بعد خروجه كأنه ما زال بالغرفة.
  const hostUid = room?.hostUid;
  const hostOnSeat =
    !!hostUid && Object.values(room?.seats ?? {}).some((s) => s?.uid === hostUid);
  if (hostUid && hostOnSeat) {
    byUid.set(hostUid, {
      uid: hostUid,
      avatar: room?.hostAvatar ?? '',
      name: room?.hostName ?? '',
      onMic: true,
    });
  }

  for (const seat of Object.values(room?.seats ?? {})) {
    const uid = seat?.uid;
    if (!uid) continue;
    byUid.set(uid, {
      uid,
      avatar: seat.avatar ?? '',
      name: seat.displayName ?? '',
      onMic: true,
    });
  }

  const audienceSorted = [...audience].sort(
    (a, b) => (b.joinedAt ?? 0) - (a.joinedAt ?? 0),
  );
  for (const member of audienceSorted) {
    if (!member.uid || byUid.has(member.uid)) continue;
    byUid.set(member.uid, {
      uid: member.uid,
      avatar: member.avatar ?? '',
      name: member.name ?? '',
      onMic: false,
    });
  }

  const micFirst = [...byUid.values()].sort((a, b) => {
    if (a.onMic === b.onMic) return 0;
    return a.onMic ? -1 : 1;
  });

  return micFirst.slice(0, maxVisible);
}

/** مهلة اعتبار مقعد «منقطع الاتصال» شبحاً على البطاقات — أطول من مهلة إعادة
 *  الاتصال العابرة (180ث) بهامش، وأقصر بكثير من الكنّاس الدوري */
const CARD_SEAT_DISCONNECT_GHOST_MS = 4 * 60 * 1000;

/** نسخة من الغرفة تُخفي مقاعد المنقطعين طويلاً — البطاقات لا تعرض أبداً شخصاً
 *  انقطع جهازه منذ دقائق حتى لو كانت عقدة الشبح بانتظار الكنّاس (طلب المالك:
 *  «متصل» حيّ وصادق، لا وهمي ولا متأخر). لا يغيّر منطق الغرفة الداخلي شيئاً. */
function sanitizeRoomForCard(room: Room | null): Room | null {
  if (!room?.seats) return room;
  const now = Date.now();
  let changed = false;
  const seats: NonNullable<Room['seats']> = {};
  for (const [key, seat] of Object.entries(room.seats)) {
    const disconnectedAt =
      typeof (seat as { disconnectedAt?: number })?.disconnectedAt === 'number'
        ? Number((seat as { disconnectedAt?: number }).disconnectedAt)
        : 0;
    if (seat?.uid && disconnectedAt > 0 && now - disconnectedAt > CARD_SEAT_DISCONNECT_GHOST_MS) {
      seats[key] = { ...seat, uid: '' };
      changed = true;
    } else {
      seats[key] = seat;
    }
  }
  return changed ? { ...room, seats } : room;
}

function buildPresenceSnapshot(
  room: Room | null,
  audience: RoomAudienceMember[],
  audienceUids: Set<string>,
): AgencyRoomPresenceSnapshot {
  const cardRoom = sanitizeRoomForCard(room);
  const micCount = cardRoom ? countFilledSeats(cardRoom) : 0;
  const totalCount = derivePresenceCount(cardRoom, audience, audienceUids);
  return {
    faces: buildAgencyRoomPresenceFaces(cardRoom, audience, 4),
    micCount,
    audienceCount: Math.max(0, totalCount - micCount),
    totalCount,
  };
}

export function subscribeToAgencyRoomLivePresence(
  roomId: string,
  callback: (snapshot: AgencyRoomPresenceSnapshot) => void,
): () => void {
  let room: Room | null = null;
  let audience: RoomAudienceMember[] = [];
  let audienceUids = new Set<string>();

  const emit = () => {
    callback(buildPresenceSnapshot(room, audience, audienceUids));
  };

  const unsubRoom = subscribeToRoom(roomId, (data) => {
    room = data;
    emit();
  });
  // sideEffects=false: البطاقات تراقب فقط ولا تكتب audienceCount ولا تنظّف مقاعد
  // (شاشة الغرفة هي المُصالِح المُخوَّل) — يقطع حلقة التغذية الراجعة على كل الأجهزة
  const unsubAudience = subscribeToAudience(
    roomId,
    (list) => {
      audience = list;
      emit();
    },
    { sideEffects: false },
  );
  const unsubUids = subscribeToRoomAudienceUids(
    roomId,
    (uids) => {
      audienceUids = uids;
      emit();
    },
    { sideEffects: false },
  );

  return () => {
    unsubRoom();
    unsubAudience();
    unsubUids();
  };
}
