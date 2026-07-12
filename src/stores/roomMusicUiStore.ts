/**
 * واجهة الموسيقى العائمة — أي روم فيه موسيقى نشطة
 */
import { create } from 'zustand';

interface RoomMusicUiState {
  activeRoomId: string | null;
  localDismissed: boolean;
  djPanelExpanded: boolean;
  /**
   * خافض «صوت الـDJ» المحلي للمستمعين (0–1) — يخفض كلام الـDJ وموسيقاه
   * معاً (ستريم واحد عبر Agora)؛ لا يؤثر على بقية أعضاء الغرفة.
   * خاص بالجلسة لا بالمستخدم: يُعاد لـ1 عند انتهاء جلسة الـDJ (مدير
   * الخلط) وعند مسح حالة الروم (clear/clearIfRoom) — بقاؤه 0 عبر
   * الجلسات كان يُبقي كلام أي DJ لاحق مكتوماً دون علم المستمع.
   */
  localListenerVolume: number;
  /** «سماعي أنا» — playout موسيقى الـDJ محلياً (0–1)، مستقل عن صوت الجمهور */
  djPlayoutVolume: number;
  /** ربط قناتَي الـDJ (صوت الجمهور + سماعي أنا) بشريط واحد — الافتراضي معاً */
  djVolumesLinked: boolean;
  setActive: (roomId: string) => void;
  clearIfRoom: (roomId: string) => void;
  clear: () => void;
  dismissLocally: () => void;
  resetDismiss: () => void;
  openDjPanel: () => void;
  closeDjPanel: () => void;
  toggleDjPanel: () => void;
  setLocalListenerVolume: (volume: number) => void;
  setDjPlayoutVolume: (volume: number) => void;
  setDjVolumesLinked: (linked: boolean) => void;
}

export const useRoomMusicUiStore = create<RoomMusicUiState>((set, get) => ({
  activeRoomId: null,
  localDismissed: false,
  djPanelExpanded: false,
  localListenerVolume: 1,
  djPlayoutVolume: 1,
  djVolumesLinked: true,
  setActive: (roomId) =>
    set({
      activeRoomId: roomId,
      localDismissed: false,
    }),
  clearIfRoom: (roomId) => {
    if (get().activeRoomId === roomId) {
      set({
        activeRoomId: null,
        localDismissed: false,
        djPanelExpanded: false,
        localListenerVolume: 1,
      });
    }
  },
  clear: () =>
    set({
      activeRoomId: null,
      localDismissed: false,
      djPanelExpanded: false,
      localListenerVolume: 1,
    }),
  dismissLocally: () => set({ localDismissed: true, djPanelExpanded: false }),
  resetDismiss: () => set({ localDismissed: false }),
  openDjPanel: () => set({ djPanelExpanded: true, localDismissed: false }),
  closeDjPanel: () => set({ djPanelExpanded: false }),
  toggleDjPanel: () => set((s) => ({ djPanelExpanded: !s.djPanelExpanded })),
  setLocalListenerVolume: (volume) =>
    set({ localListenerVolume: Math.max(0, Math.min(1, volume)) }),
  setDjPlayoutVolume: (volume) =>
    set({ djPlayoutVolume: Math.max(0, Math.min(1, volume)) }),
  setDjVolumesLinked: (linked) => set({ djVolumesLinked: linked }),
}));
