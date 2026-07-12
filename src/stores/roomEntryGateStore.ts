import { create } from 'zustand';

import type { Room } from '@/services/firebase/rooms';
import {
  markRoomPasswordVerified,
  verifyRoomPassword,
} from '@/services/roomEntryGate';

type Resolver = (allowed: boolean) => void;

interface RoomEntryGateState {
  visible: boolean;
  room: Room | null;
  passwordError: string;
  resolver: Resolver | null;
  prompt: (room: Room) => Promise<boolean>;
  submitPassword: (password: string) => void;
  cancel: () => void;
}

export const useRoomEntryGateStore = create<RoomEntryGateState>((set, get) => ({
  visible: false,
  room: null,
  passwordError: '',
  resolver: null,

  prompt: (room) =>
    new Promise<boolean>((resolve) => {
      const prev = get().resolver;
      if (prev) prev(false);
      set({
        visible: true,
        room,
        passwordError: '',
        resolver: resolve,
      });
    }),

  submitPassword: (password) => {
    const { room, resolver } = get();
    if (!room || !resolver) return;
    if (!verifyRoomPassword(room, password)) {
      set({ passwordError: 'room.lockedRoomWrongPassword' });
      return;
    }
    markRoomPasswordVerified(room.id, room.password ?? '');
    resolver(true);
    set({ visible: false, room: null, passwordError: '', resolver: null });
  },

  cancel: () => {
    const { resolver } = get();
    resolver?.(false);
    set({ visible: false, room: null, passwordError: '', resolver: null });
  },
}));
