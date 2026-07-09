import { Platform, PermissionsAndroid, Alert, Linking, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PermissionType = 'audio' | 'video' | 'both';

export type AppPermissionsSummary = {
  microphone: boolean;
  camera: boolean;
  mediaLibrary: boolean;
  notifications: boolean;
  overlay: boolean;
  location: boolean;
};

const PERMISSIONS_PROMPT_KEY = '@linkup:app-permissions-prompted';

const pauseBetweenPrompts = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, Platform.OS === 'ios' ? 350 : 0);
  });

const openSettingsAlert = (title: string, message: string) => {
  Alert.alert(title, message, [
    { text: 'إلغاء', style: 'cancel' },
    { text: 'فتح الإعدادات', onPress: () => Linking.openSettings() },
  ]);
};

/** طلب صلاحيات الميكروفون والكاميرا على iOS (كان يُرجع true دون طلب) */
async function requestIOSCallPermissions(type: PermissionType): Promise<boolean> {
  const needMic = type === 'audio' || type === 'both';
  const needCam = type === 'video' || type === 'both';

  if (needMic) {
    const { Audio } = await import('expo-av');
    const mic = await Audio.requestPermissionsAsync();
    if (!mic.granted) {
      if (!mic.canAskAgain) {
        openSettingsAlert(
          'صلاحية الميكروفون مرفوضة',
          'فعّل الميكروفون من إعدادات التطبيق لإجراء المكالمات.',
        );
      }
      return false;
    }
  }

  if (needCam) {
    const ImagePicker = await import('expo-image-picker');
    const cam = await ImagePicker.requestCameraPermissionsAsync();
    if (!cam.granted) {
      if (!cam.canAskAgain) {
        openSettingsAlert(
          'صلاحية الكاميرا مرفوضة',
          'فعّل الكاميرا من إعدادات التطبيق لمكالمات الفيديو.',
        );
      }
      return false;
    }
  }

  return true;
}

export const requestCallPermissions = async (type: PermissionType): Promise<boolean> => {
  if (Platform.OS === 'ios') {
    return requestIOSCallPermissions(type);
  }

  if (Platform.OS === 'android') {
    try {
      const needed: string[] = [];

      if (type === 'audio' || type === 'both') {
        needed.push(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO!);
      }
      if (type === 'video' || type === 'both') {
        needed.push(PermissionsAndroid.PERMISSIONS.CAMERA!);
      }
      if (
        (type === 'audio' || type === 'both') &&
        typeof Platform.Version === 'number' &&
        Platform.Version >= 31
      ) {
        needed.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT!);
      }

      const checks = await Promise.all(needed.map((p) => PermissionsAndroid.check(p as any)));
      const missing = needed.filter((_, i) => !checks[i]);
      if (missing.length === 0) return true;

      const results = (await PermissionsAndroid.requestMultiple(missing as any)) as Record<string, string>;

      const blocked = needed.some(
        (p) => results[p] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
      );
      const allGranted = needed.every(
        (p) => results[p] === PermissionsAndroid.RESULTS.GRANTED,
      );

      if (!allGranted && blocked) {
        const needsCam = type === 'video' || type === 'both';
        openSettingsAlert(
          needsCam ? 'صلاحيات المكالمة مرفوضة' : 'صلاحية الميكروفون مرفوضة',
          needsCam
            ? 'فعّل الميكروفون والكاميرا من إعدادات التطبيق.'
            : 'فعّل الميكروفون من إعدادات التطبيق.',
        );
      }

      return allGranted;
    } catch (e) {
      console.error('requestCallPermissions:', e);
      return false;
    }
  }

  return true;
};

export const hasCallPermissions = async (type: PermissionType): Promise<boolean> => {
  if (Platform.OS === 'ios') {
    const needMic = type === 'audio' || type === 'both';
    const needCam = type === 'video' || type === 'both';
    if (needMic) {
      const { Audio } = await import('expo-av');
      const mic = await Audio.getPermissionsAsync();
      if (!mic.granted) return false;
    }
    if (needCam) {
      const ImagePicker = await import('expo-image-picker');
      const cam = await ImagePicker.getCameraPermissionsAsync();
      if (!cam.granted) return false;
    }
    return true;
  }

  if (Platform.OS !== 'android') return true;
  try {
    const checks: boolean[] = [];
    if (type === 'audio' || type === 'both') {
      checks.push(await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO!));
    }
    if (type === 'video' || type === 'both') {
      checks.push(await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA!));
    }
    return checks.every(Boolean);
  } catch {
    return false;
  }
};

export async function hasPromptedAppPermissions(uid: string): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(`${PERMISSIONS_PROMPT_KEY}:${uid}`);
    return value === '1';
  } catch {
    return false;
  }
}

export async function markAppPermissionsPrompted(uid: string): Promise<void> {
  try {
    await AsyncStorage.setItem(`${PERMISSIONS_PROMPT_KEY}:${uid}`, '1');
  } catch {
    /* ignore */
  }
}

async function requestAndroidStoragePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  try {
    const version = typeof Platform.Version === 'number' ? Platform.Version : 0;
    const permission =
      version >= 33
        ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES!
        : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE!;

    const granted = await PermissionsAndroid.check(permission);
    if (granted) return true;

    const result = await PermissionsAndroid.request(permission);
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

async function requestAndroidNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  try {
    const version = typeof Platform.Version === 'number' ? Platform.Version : 0;
    if (version < 33) return true;

    const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS!;
    const granted = await PermissionsAndroid.check(permission);
    if (granted) return true;

    const result = await PermissionsAndroid.request(permission);
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

/** طلب جميع صلاحيات التطبيق دفعة واحدة بعد تسجيل الدخول */
export async function requestAllAppPermissions(): Promise<AppPermissionsSummary> {
  const summary: AppPermissionsSummary = {
    microphone: false,
    camera: false,
    mediaLibrary: false,
    notifications: false,
    overlay: false,
    location: false,
  };

  if (Platform.OS === 'web') {
    return { microphone: true, camera: true, mediaLibrary: true, notifications: true, overlay: true, location: true };
  }

  try {
    const { Audio } = await import('expo-av');
    const mic = await Audio.requestPermissionsAsync();
    summary.microphone = mic.granted;
  } catch {
    /* ignore */
  }

  await pauseBetweenPrompts();

  try {
    const ImagePicker = await import('expo-image-picker');
    const cam = await ImagePicker.requestCameraPermissionsAsync();
    summary.camera = cam.granted;
  } catch {
    /* ignore */
  }

  await pauseBetweenPrompts();

  if (Platform.OS === 'android') {
    try {
      const needed: string[] = [
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO!,
        PermissionsAndroid.PERMISSIONS.CAMERA!,
      ];
      const version = typeof Platform.Version === 'number' ? Platform.Version : 0;
      if (version >= 31) {
        needed.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT!);
      }

      const checks = await Promise.all(needed.map((p) => PermissionsAndroid.check(p as never)));
      const missing = needed.filter((_, i) => !checks[i]);
      if (missing.length > 0) {
        const results = (await PermissionsAndroid.requestMultiple(missing as never)) as Record<string, string>;
        summary.microphone =
          results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO!] === PermissionsAndroid.RESULTS.GRANTED;
        summary.camera =
          results[PermissionsAndroid.PERMISSIONS.CAMERA!] === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        summary.microphone = true;
        summary.camera = true;
      }
    } catch {
      /* ignore */
    }
  }

  try {
    const ImagePicker = await import('expo-image-picker');
    const library = await ImagePicker.requestMediaLibraryPermissionsAsync();
    summary.mediaLibrary = library.granted;
  } catch {
    /* ignore */
  }

  await pauseBetweenPrompts();

  if (Platform.OS === 'android') {
    const storageOk = await requestAndroidStoragePermission();
    summary.mediaLibrary = summary.mediaLibrary || storageOk;
  }

  try {
    const Notifications = await import('expo-notifications');
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (existing.status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      status = requested.status;
    }
    summary.notifications = status === 'granted';
  } catch {
    /* ignore */
  }

  if (Platform.OS === 'android') {
    const androidNotif = await requestAndroidNotificationPermission();
    summary.notifications = summary.notifications || androidNotif;
  }

  if (Platform.OS === 'android') {
    summary.overlay = await requestOverlayPermission();
  } else {
    summary.overlay = true;
  }

  await pauseBetweenPrompts();

  try {
    const Location = await import('expo-location');
    const existing = await Location.getForegroundPermissionsAsync();
    let status = existing.status;
    if (existing.status !== 'granted') {
      const requested = await Location.requestForegroundPermissionsAsync();
      status = requested.status;
    }
    summary.location = status === 'granted';
  } catch {
    /* ignore */
  }

  return summary;
}

/** إذن المعرض — iOS + Android 13+ (READ_MEDIA_IMAGES) */
export async function requestMediaLibraryAccess(): Promise<boolean> {
  if (Platform.OS === 'web') return true;

  let granted = false;
  try {
    const ImagePicker = await import('expo-image-picker');
    const library = await ImagePicker.requestMediaLibraryPermissionsAsync();
    granted = library.granted;
    if (!granted && !library.canAskAgain) {
      openSettingsAlert(
        'صلاحية المعرض مرفوضة',
        'فعّل الوصول للصور من إعدادات التطبيق لرفع الصورة الشخصية والمحتوى.',
      );
      return false;
    }
  } catch {
    /* ignore */
  }

  if (Platform.OS === 'android') {
    const androidOk = await requestAndroidStoragePermission();
    granted = granted || androidOk;
  }

  return granted;
}

/** إذن الكاميرا — لالتقاط صورة الملف أو المنشورات */
export async function requestCameraAccess(): Promise<boolean> {
  if (Platform.OS === 'web') return true;

  try {
    const ImagePicker = await import('expo-image-picker');
    const cam = await ImagePicker.requestCameraPermissionsAsync();
    if (!cam.granted) {
      if (!cam.canAskAgain) {
        openSettingsAlert(
          'صلاحية الكاميرا مرفوضة',
          'فعّل الكاميرا من إعدادات التطبيق لالتقاط الصور.',
        );
      }
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * فحص وطلب إذن "الظهور فوق التطبيقات" (SYSTEM_ALERT_WINDOW) — أندرويد فقط.
 * هذا الإذن خاص ولا يُطلب عبر PermissionsAndroid.request —
 * يجب فتح صفحة الإعدادات الخاصة به.
 */
export async function checkOverlayPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const { OverlayPermissionModule } = NativeModules;
    if (OverlayPermissionModule?.isGranted) {
      return await OverlayPermissionModule.isGranted();
    }
    return true;
  } catch {
    return true;
  }
}

export async function requestOverlayPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const granted = await checkOverlayPermission();
    if (granted) return true;

    return new Promise((resolve) => {
      Alert.alert(
        'إذن الظهور فوق التطبيقات',
        'يحتاج التطبيق لإذن الظهور فوق التطبيقات لعرض فقاعة الروم العائمة. سيتم توجيهك للإعدادات.',
        [
          { text: 'لاحقاً', style: 'cancel', onPress: () => resolve(false) },
          {
            text: 'فتح الإعدادات',
            onPress: () => {
              try {
                const { OverlayPermissionModule } = NativeModules;
                if (OverlayPermissionModule?.requestPermission) {
                  OverlayPermissionModule.requestPermission();
                } else {
                  Linking.openSettings();
                }
              } catch {
                Linking.openSettings();
              }
              resolve(false);
            },
          },
        ],
      );
    });
  } catch {
    return false;
  }
}
