/**
 * حالة جلسة المكالمة 1-to-1 — تصغير مع بقاء الاتصال
 */
import { create } from 'zustand';

export interface MinimizedCallInfo {
  peerUid: string;
  peerName: string;
  peerAvatar?: string;
  channelName: string;
  isVideo: boolean;
  billingSessionId?: string;
  source?: 'chat' | 'match';
}

interface CallSessionState {
  isMinimized: boolean;
  sessionPinned: boolean;
  peerUid: string | null;
  peerName: string;
  peerAvatar?: string;
  channelName: string | null;
  isVideo: boolean;
  billingSessionId?: string;
  source?: 'chat' | 'match';
  minimize: (info: MinimizedCallInfo) => void;
  expand: () => void;
  clear: () => void;
}

export const useCallSessionStore = create<CallSessionState>((set) => ({
  isMinimized: false,
  sessionPinned: false,
  peerUid: null,
  peerName: '',
  peerAvatar: undefined,
  channelName: null,
  isVideo: false,
  billingSessionId: undefined,
  source: 'chat',
  minimize: (info) =>
    set({
      isMinimized: true,
      sessionPinned: true,
      peerUid: info.peerUid,
      peerName: info.peerName,
      peerAvatar: info.peerAvatar,
      channelName: info.channelName,
      isVideo: info.isVideo,
      billingSessionId: info.billingSessionId,
      source: info.source ?? 'chat',
    }),
  expand: () => set({ isMinimized: false }),
  clear: () =>
    set({
      isMinimized: false,
      sessionPinned: false,
      peerUid: null,
      peerName: '',
      peerAvatar: undefined,
      channelName: null,
      isVideo: false,
      billingSessionId: undefined,
      source: 'chat',
    }),
}));

export const isCallSessionPinned = (channelName: string): boolean => {
  const s = useCallSessionStore.getState();
  return s.sessionPinned && s.channelName === channelName;
};
