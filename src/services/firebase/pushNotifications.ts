import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { doc, updateDoc } from 'firebase/firestore';
import { firestore } from './index';
import { shouldShowPushBanner } from '@/utils/pushNotificationPolicy';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const raw = notification.request.content.data as Record<string, unknown>;
    const type = String(raw?.type ?? raw?.notifType ?? '');
    if (!shouldShowPushBanner(type, raw)) {
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    }
    const isCall = type === 'incoming_call';
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      priority: isCall
        ? Notifications.AndroidNotificationPriority.MAX
        : Notifications.AndroidNotificationPriority.HIGH,
    };
  },
});

async function ensureNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#E11414',
  });

  await Notifications.setNotificationChannelAsync('incoming_calls', {
    name: 'Incoming Calls',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 1000, 500, 1000, 500, 1000],
    lightColor: '#FCD34D',
    sound: 'default',
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export async function registerFcmToken(uid: string): Promise<void> {
  if (!Device.isDevice) return;

  await ensureNotificationChannels();

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  const { data: fcmToken } = await Notifications.getDevicePushTokenAsync();
  if (!fcmToken) return;

  await updateDoc(doc(firestore, 'users', uid), { fcmToken });
}

export async function clearFcmToken(uid: string): Promise<void> {
  try {
    await updateDoc(doc(firestore, 'users', uid), { fcmToken: null });
  } catch {}
}

/** تفعيل/إيقاف إشعارات الدفع — يحدّث التوكن على السيرفر */
export async function setPushNotificationsEnabled(uid: string, enabled: boolean): Promise<void> {
  if (enabled) {
    await registerFcmToken(uid);
  } else {
    await clearFcmToken(uid);
  }
}
