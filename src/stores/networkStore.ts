import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { create } from 'zustand';

import { probeInternetReachable } from '@/services/networkReachability';

type NetworkStore = {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  isOffline: boolean;
  checking: boolean;
  applyNetInfo: (state: NetInfoState, reachableOverride?: boolean | null) => void;
  setReachability: (reachable: boolean) => void;
  refresh: () => Promise<boolean>;
};

function deriveOffline(connected: boolean, reachable: boolean | null): boolean {
  if (!connected) return true;
  if (reachable === false) return true;
  return false;
}

export const useNetworkStore = create<NetworkStore>((set, get) => ({
  isConnected: true,
  isInternetReachable: null,
  isOffline: false,
  checking: false,

  applyNetInfo: (state, reachableOverride) => {
    const connected = Boolean(state.isConnected);
    const reachable = reachableOverride ?? state.isInternetReachable ?? null;
    set({
      isConnected: connected,
      isInternetReachable: reachable,
      isOffline: deriveOffline(connected, reachable),
    });
  },

  setReachability: (reachable) => {
    const { isConnected } = get();
    set({
      isInternetReachable: reachable,
      isOffline: deriveOffline(isConnected, reachable),
    });
  },

  refresh: async () => {
    if (get().checking) return !get().isOffline;
    set({ checking: true });
    try {
      const state = await NetInfo.refresh();
      let reachable = state.isInternetReachable ?? null;
      if (state.isConnected && reachable !== false) {
        reachable = await probeInternetReachable();
      }
      get().applyNetInfo(state, reachable);
      return !deriveOffline(Boolean(state.isConnected), reachable);
    } catch {
      set({ isOffline: true, checking: false });
      return false;
    } finally {
      set({ checking: false });
    }
  },
}));
