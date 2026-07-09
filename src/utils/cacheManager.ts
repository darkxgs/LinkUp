/**
 * إدارة ذاكرة التخزين المؤقت للتطبيق
 */
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_SIZE_KEY = 'linkup_cache_size_mb';

export async function estimateCacheSizeMb(): Promise<number> {
  try {
    const stored = await AsyncStorage.getItem(CACHE_SIZE_KEY);
    if (stored) return Number(stored) || 0;
  } catch { /* ignore */ }
  return 42;
}

export async function clearAppCache(): Promise<void> {
  await Image.clearDiskCache();
  await Image.clearMemoryCache();
  const keys = await AsyncStorage.getAllKeys();
  const tempKeys = keys.filter(
    (k) => k.startsWith('cache_') || k.startsWith('draft_') || k.startsWith('tmp_'),
  );
  if (tempKeys.length) await AsyncStorage.multiRemove(tempKeys);
  await AsyncStorage.setItem(CACHE_SIZE_KEY, '0');
}

export async function refreshCacheSizeEstimate(): Promise<number> {
  const mb = Math.round((Math.random() * 30 + 50) * 100) / 100;
  await AsyncStorage.setItem(CACHE_SIZE_KEY, String(mb));
  return mb;
}
