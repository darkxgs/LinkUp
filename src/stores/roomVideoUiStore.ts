/**
 * فيديو الروم أثناء «احتفظ» — يبقى عائماً مع الصوت
 */
import { create } from 'zustand';

interface RoomVideoUiState {
  pinnedRoomId: string | null;
  /** صوت الفيديو محلياً — true = مكتوم */
  localMuted: boolean;
  setPinned: (roomId: string, opts?: { unmuted?: boolean }) => void;
  clearPinned: (roomId?: string) => void;
}

export const useRoomVideoUiStore = create<RoomVideoUiState>((set, get) => ({
  pinnedRoomId: null,
  localMuted: true,
  setPinned: (roomId, opts) =>
    set({
      pinnedRoomId: roomId,
      localMuted: opts?.unmuted === true ? false : get().localMuted,
    }),
  clearPinned: (roomId) => {
    const cur = get().pinnedRoomId;
    if (!roomId || cur === roomId) {
      set({ pinnedRoomId: null, localMuted: true });
    }
  },
}));
