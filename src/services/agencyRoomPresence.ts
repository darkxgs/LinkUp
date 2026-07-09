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

function buildPresenceSnapshot(
  room: Room | null,
  audience: RoomAudienceMember[],
  audienceUids: Set<string>,
): AgencyRoomPresenceSnapshot {
  const micCount = room ? countFilledSeats(room) : 0;
  const totalCount = derivePresenceCount(room, audience, audienceUids);
  const audienceOnly = audience.filter((a) => !isUidOnMic(a.uid, room));
  return {
    faces: buildAgencyRoomPresenceFaces(room, audience, 4),
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
  const unsubAudience = subscribeToAudience(roomId, (list) => {
    audience = list;
    emit();
  });
  const unsubUids = subscribeToRoomAudienceUids(roomId, (uids) => {
    audienceUids = uids;
    emit();
  });

  return () => {
    unsubRoom();
    unsubAudience();
    unsubUids();
  };
}
