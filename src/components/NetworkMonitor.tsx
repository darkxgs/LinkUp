/**
 * مراقبة حالة الشبكة — يحدّث networkStore تلقائياً
 */
import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

import { probeInternetReachable } from '@/services/networkReachability';
import { useNetworkStore } from '@/stores/networkStore';

export function NetworkMonitor() {
  const applyNetInfo = useNetworkStore((s) => s.applyNetInfo);
  const setReachability = useNetworkStore((s) => s.setReachability);

  useEffect(() => {
    let probeVersion = 0;

    const runProbe = async (connected: boolean) => {
      if (!connected) return;
      const version = ++probeVersion;
      const ok = await probeInternetReachable();
      if (version !== probeVersion) return;
      setReachability(ok);
    };

    const handleState = (state: Awaited<ReturnType<typeof NetInfo.fetch>>) => {
      applyNetInfo(state);
      if (state.isConnected && state.isInternetReachable == null) {
        void runProbe(true);
      }
    };

    const unsub = NetInfo.addEventListener(handleState);
    void NetInfo.fetch().then(handleState);

    return () => {
      probeVersion += 1;
      unsub();
    };
  }, [applyNetInfo, setReachability]);

  return null;
}
