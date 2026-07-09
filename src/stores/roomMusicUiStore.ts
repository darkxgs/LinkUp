/**
 * واجهة الموسيقى العائمة — أي روم فيه موسيقى نشطة
 */
import { create } from 'zustand';

interface RoomMusicUiState {
  activeRoomId: string | null;
  showSharePicker: boolean;
  localDismissed: boolean;
  djPanelExpanded: boolean;
  /** مستوى الاستماع المحلي للمستمعين (0–1) — لا يؤثر على البث */
  localListenerVolume: number;
  setActive: (roomId: string) => void;
  clearIfRoom: (roomId: string) => void;
  clear: () => void;
  openSharePicker: () => void;
  closeSharePicker: () => void;
  dismissLocally: () => void;
  resetDismiss: () => void;
  openDjPanel: () => void;
  closeDjPanel: () => void;
  toggleDjPanel: () => void;
  setLocalListenerVolume: (volume: number) => void;
}

export const useRoomMusicUiStore = create<RoomMusicUiState>((set, get) => ({
  activeRoomId: null,
  showSharePicker: false,
  localDismissed: false,
  djPanelExpanded: false,
  localListenerVolume: 1,
  setActive: (roomId) =>
    set({
      activeRoomId: roomId,
      localDismissed: false,
    }),
  clearIfRoom: (roomId) => {
    if (get().activeRoomId === roomId) {
      set({
        activeRoomId: null,
        showSharePicker: false,
        localDismissed: false,
        djPanelExpanded: false,
      });
    }
  },
  clear: () =>
    set({
      activeRoomId: null,
      showSharePicker: false,
      localDismissed: false,
      djPanelExpanded: false,
    }),
  openSharePicker: () => set({ showSharePicker: true, localDismissed: false }),
  closeSharePicker: () => set({ showSharePicker: false }),
  dismissLocally: () => set({ localDismissed: true, djPanelExpanded: false }),
  resetDismiss: () => set({ localDismissed: false }),
  openDjPanel: () => set({ djPanelExpanded: true, localDismissed: false }),
  closeDjPanel: () => set({ djPanelExpanded: false }),
  toggleDjPanel: () => set((s) => ({ djPanelExpanded: !s.djPanelExpanded })),
  setLocalListenerVolume: (volume) =>
    set({ localListenerVolume: Math.max(0, Math.min(1, volume)) }),
}));
