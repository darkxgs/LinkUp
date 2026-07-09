/**
 * نسخ نText — expo-clipboard مباشرة (بدون dynamic import)
 */
import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';

export async function copyToClipboard(text: string): Promise<boolean> {
  const value = String(text ?? '').trim();
  if (!value) return false;

  if (Platform.OS === 'web') {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch {
      /* fall through */
    }
  }

  try {
    await Clipboard.setStringAsync(value);
    return true;
  } catch (e) {
    console.warn('[copyToClipboard] expo-clipboard:', e);
  }

  try {
    await Share.share(
      Platform.OS === 'ios' ? { message: value } : { message: value, title: value },
    );
    return true;
  } catch {
    return false;
  }
}
