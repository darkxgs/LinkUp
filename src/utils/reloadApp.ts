/**
 * إعادة تحميل التطبيق — مطلوبة بعد تغيير RTL/LTR
 * expo-updates لا يعمل في Expo Go؛ DevSettings.reload يعمل في التطوير
 */
import { DevSettings } from 'react-native';
import * as Updates from 'expo-updates';

export async function reloadApp(): Promise<void> {
  if (__DEV__ && typeof DevSettings.reload === 'function') {
    DevSettings.reload();
    return;
  }

  try {
    if (Updates.reloadAsync) {
      await Updates.reloadAsync();
      return;
    }
  } catch (e) {
    console.warn('Updates.reloadAsync failed:', e);
  }

  if (typeof DevSettings.reload === 'function') {
    DevSettings.reload();
  }
}
