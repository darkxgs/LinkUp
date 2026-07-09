/**
 * جلسات ألعاب الروم المجانية — Firebase RTDB
 */
import { ref, push, set, update, onValue, off, get, type DataSnapshot } from 'firebase/database';
import { realtimeDb, auth } from './index';
import type { RoomFreeGameId } from '@/constants/roomFreeGames';

export interface RoomGameSession {
  id: string;
  gameId: RoomFreeGameId;
  roomId: string;
  hostUid: string;
  hostName: string;
  joinCode: string;
  status: 'waiting' | 'active' | 'ended';
  maxPlayers: number;
  createdAt: number;
  playerUids: Record<string, true>;
}

function randomCode(len = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export async function createRoomGameSession(input: {
  gameId: RoomFreeGameId;
  roomId: string;
  hostName: string;
  maxPlayers: number;
}): Promise<RoomGameSession> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const sessionsRef = ref(realtimeDb, 'roomGameSessions');
  const newRef = push(sessionsRef);
  const id = newRef.key!;
  const joinCode = randomCode(input.gameId === 'mask-chat' ? 6 : 6);

  const session: RoomGameSession = {
    id,
    gameId: input.gameId,
    roomId: input.roomId,
    hostUid: user.uid,
    hostName: input.hostName,
    joinCode,
    status: 'waiting',
    maxPlayers: input.maxPlayers,
    createdAt: Date.now(),
    playerUids: { [user.uid]: true },
  };

  await set(newRef, session);
  return session;
}

export async function joinRoomGameSession(sessionId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');
  await update(ref(realtimeDb, `roomGameSessions/${sessionId}`), {
    [`playerUids/${user.uid}`]: true,
    status: 'active',
  });
}

export function subscribeRoomGameSession(
  sessionId: string,
  cb: (session: RoomGameSession | null) => void,
): () => void {
  const r = ref(realtimeDb, `roomGameSessions/${sessionId}`);
  const handler = (snap: DataSnapshot) => {
    cb(snap.exists() ? (snap.val() as RoomGameSession) : null);
  };
  onValue(r, handler);
  return () => off(r, 'value', handler);
}

export async function getRoomGameSession(sessionId: string): Promise<RoomGameSession | null> {
  const snap = await get(ref(realtimeDb, `roomGameSessions/${sessionId}`));
  return snap.exists() ? (snap.val() as RoomGameSession) : null;
}
