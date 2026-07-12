/**
 * حالة جلسة الروم — تصغير (PiP) مع بقاء الاتصال الصوتي
 */
import { create } from 'zustand';

export interface MinimizedRoomInfo {
  roomId: string;
  roomName: string;
  roomBanner?: string;
  /** متحدث (مضيف/مقعد) أم مستمع فقط */
  canPublish: boolean;
  /** آخر مقعد معروف — لاستعادته بعد انقطاع RTDB العابر */
  micSeatIndex?: number | null;
}

interface RoomSessionState {
  isMinimized: boolean;
  audioPinned: boolean;
  roomId: string | null;
  roomName: string;
  roomBanner?: string;
  canPublish: boolean;
  /** آخر مقعد معروف للمستخدم — يُحدَّث من شاشة الروم */
  micSeatIndex: number | null;
  /** كتم سماع صوت الغرفة — يُحفظ عند التصغير (PiP) */
  listenMuted: boolean;
  minimize: (info: MinimizedRoomInfo) => void;
  /** إبقاء العضوية (مايك/حضور) دون تصغير — تنقّل داخل التطبيق أو خلفية */
  pinMembership: (info: MinimizedRoomInfo) => void;
  expand: () => void;
  clear: () => void;
  setListenMuted: (muted: boolean) => void;
  setMicSeatIndex: (idx: number | null) => void;
}

export const useRoomSessionStore = create<RoomSessionState>((set) => ({
  isMinimized: false,
  audioPinned: false,
  roomId: null,
  roomName: '',
  roomBanner: undefined,
  canPublish: false,
  micSeatIndex: null,
  listenMuted: false,
  setListenMuted: (muted) => set({ listenMuted: muted }),
  setMicSeatIndex: (idx) => set({ micSeatIndex: idx }),
  minimize: (info) =>
    set({
      isMinimized: true,
      audioPinned: true,
      roomId: info.roomId,
      roomName: info.roomName,
      roomBanner: info.roomBanner,
      canPublish: info.canPublish,
      micSeatIndex: info.micSeatIndex ?? null,
    }),
  pinMembership: (info) =>
    set({
      isMinimized: false,
      audioPinned: true,
      roomId: info.roomId,
      roomName: info.roomName,
      roomBanner: info.roomBanner,
      canPublish: info.canPublish,
      micSeatIndex: info.micSeatIndex ?? null,
    }),
  /** عودة لشاشة الروم — إيقاف وضع التصغير فقط (الإبقاء على المقعد/المايك يبقى مفعّلاً) */
  expand: () => set({ isMinimized: false }),
  clear: () =>
    set({
      isMinimized: false,
      audioPinned: false,
      roomId: null,
      roomName: '',
      roomBanner: undefined,
      canPublish: false,
      micSeatIndex: null,
      listenMuted: false,
    }),
}));

/** هل الجلسة مثبتة — الصوت والمايك يبقيان حتى الخروج الصريح أو إغلاق التطبيق */
export const isRoomSessionPinned = (roomId: string): boolean => {
  const s = useRoomSessionStore.getState();
  return s.audioPinned && s.roomId === roomId;
};

/** اسم قناة الصوت للغرفة — الاسم تاريخي من عهد LiveKit والقيمة نفسها تُستخدم مع Agora */
export const getLiveKitRoomName = (roomId: string) => `room_${roomId}`;
