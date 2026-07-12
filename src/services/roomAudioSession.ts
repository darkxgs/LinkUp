/**
 * جلسة صوت الغرف المشتركة — تبقى متصلة عند تصغير الروم (PiP)
 *
 * الملف الآن واجهة رفيعة فوق جلسة Agora (rtc/agoraRoomSession) بعد إزالة
 * LiveKit نهائياً من التطبيق (أمر المالك 2026-07-12) — Agora هو المسار
 * الوحيد. الأسماء العامة نفسها (roomAudioSession/prefetchRoomAudio وأنواع
 * RoomAudioSnapshot/RoomParticipant/RoomConnectionState) لم تتغير حرفاً،
 * فالمستهلكون (useRoomAudio، الـHosts، roomLeave، pinnedRoomAudio...)
 * يعملون بلا تعديل.
 */
import { agoraRoomSession, prefetchAgoraRoomAudio } from '@/services/rtc/agoraRoomSession';

export type RoomConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

export interface RoomParticipant {
  identity: string;
  name: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isLocal: boolean;
  audioLevel: number;
}

export interface RoomAudioSnapshot {
  connectionState: RoomConnectionState;
  participants: RoomParticipant[];
  isMuted: boolean;
  error: string | null;
  /** أثر تاريخي من عهد LiveKit — Agora لا يعرض كائن غرفة، فالحقل دائماً null */
  room: null;
  roomName: string;
  canPublish: boolean;
}

/**
 * جلسة صوت الغرف — مدير Agora مباشرة (كان هنا موزّع LiveKit/Agora؛
 * حُذف مع إزالة LiveKit والتفويض الآن مباشر بلا طبقة توجيه).
 */
export const roomAudioSession = agoraRoomSession;

/** تحميل مسبق للتوكن وتهيئة المحرك — يُستدعى عند فتح شاشة الروم */
export function prefetchRoomAudio(
  roomName: string,
  canPublish = false,
  peerUid?: string,
): void {
  prefetchAgoraRoomAudio(roomName, canPublish, peerUid);
}
