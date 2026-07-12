/**
 * خدمة أمامية على أندرويد — تبقي اتصال صوت الروم (Agora) أثناء الخلفية
 */
import { Platform } from 'react-native';

const NOTIFICATION_ID = 73421;
let registered = false;
let running = false;

type ForegroundServiceModule = {
  register: (opts: {
    config: { alert: boolean; onServiceErrorCallBack: () => void };
  }) => void;
  start: (opts: Record<string, unknown>) => Promise<void>;
  stop: () => Promise<void>;
};

function getModule(): ForegroundServiceModule | null {
  if (Platform.OS !== 'android') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@supersami/rn-foreground-service').default;
  } catch {
    return null;
  }
}

/** يجب استدعاؤها عند إقلاع التطبيق (module level) قبل start */
export function setupRoomForegroundService(): void {
  if (Platform.OS !== 'android' || registered) return;
  const mod = getModule();
  if (!mod) return;
  registered = true;
  mod.register({
    config: {
      alert: false,
      onServiceErrorCallBack: () => {
        console.warn('[roomForeground] service error');
      },
    },
  });
}

export async function startRoomForegroundService(title: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  setupRoomForegroundService();
  const mod = getModule();
  if (!mod) return;

  try {
    await mod.start({
      id: NOTIFICATION_ID,
      title: title || 'LinkUp',
      message: 'الروم يعمل في الخلفية — اضغط للعودة',
      importance: 'low',
      vibration: false,
      icon: 'ic_launcher',
      ServiceType: 'microphone',
    });
    running = true;
  } catch (e) {
    console.warn('[roomForeground] start failed:', e);
  }
}

export async function stopRoomForegroundService(): Promise<void> {
  if (Platform.OS !== 'android' || !running) return;
  const mod = getModule();
  if (!mod) return;

  try {
    await mod.stop();
  } catch {
    // ignore
  } finally {
    running = false;
  }
}

setupRoomForegroundService();
