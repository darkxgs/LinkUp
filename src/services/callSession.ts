/**
 * جلسة مكالمة 1-to-1 — تبقى متصلة عند تصغير الشاشة
 *
 * الملف الآن واجهة رفيعة فوق جلسة Agora (rtc/agoraCallSession) بعد إزالة
 * LiveKit نهائياً من التطبيق (أمر المالك 2026-07-12) — Agora هو المسار
 * الوحيد. الأسماء العامة نفسها (callSession وأنواع CallState/
 * CallSessionSnapshot/CallVideoTrackLike) لم تتغير حرفاً، فـuseCall
 * وشاشات المكالمة والفقاعة العائمة تعمل بلا تعديل.
 *
 * (الغرف الصوتية many-to-many تبقى على roomAudioSession.ts منفصل.)
 */
import { agoraCallSession, type AgoraCallVideoRef } from '@/services/rtc/agoraCallSession';

export type CallState = 'idle' | 'connecting' | 'connected' | 'ended' | 'error';

/**
 * مرجع فيديو المكالمة في الـsnapshot — كان اتحاداً بين VideoTrack (LiveKit)
 * وAgoraCallVideoRef؛ بعد إزالة LiveKit تبسّط إلى مرجع Agora وحده.
 * الشاشات تفحصه بالصحة المنطقية وتمرره لـ CallVideoView كما هي.
 */
export type CallVideoTrackLike = AgoraCallVideoRef;

export interface CallSessionSnapshot {
  callState: CallState;
  isMuted: boolean;
  isRemoteMuted: boolean;
  isVideoEnabled: boolean;
  isSpeakerOn: boolean;
  remoteJoined: boolean;
  localVideoTrack: CallVideoTrackLike | undefined;
  remoteVideoTrack: CallVideoTrackLike | undefined;
  /** حقلا Agora الصريحان — localVideoOn يعكس الكاميرا وremoteVideoUid هوية الطرف الآخر الرقمية */
  localVideoOn: boolean;
  remoteVideoUid: number | null;
  error: string | null;
  channelName: string;
  isVideo: boolean;
  duration: number;
  /** المكالمة تحاول إعادة الاتصال بعد رعشة شبكة (SDK يعيد المحاولة تلقائياً) */
  isReconnecting: boolean;
}

/**
 * جلسة المكالمات — مدير Agora مباشرة (كان هنا موزّع LiveKit/Agora؛
 * حُذف مع إزالة LiveKit والتفويض الآن مباشر بلا طبقة توجيه).
 */
export const callSession = agoraCallSession;
