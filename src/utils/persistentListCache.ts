/**
 * كاش قرصي خفيف لقوائم البيانات (وكالات/غرف/مستخدمين) عبر AsyncStorage.
 *
 * الهدف: عرض فوري لآخر نتيجة معروفة عند الفتح البارد للتطبيق — دون انتظار الشبكة —
 * ثم تحديثها بالخلفية من onSnapshot/getDocs. Firebase JS SDK على Expo لا يوفّر
 * تخزيناً قرصياً دائماً (persistentLocalCache يعتمد IndexedDB غير المتاح في RN)،
 * لذا نتكفّل بذلك يدوياً هنا.
 *
 * المفتاح يبدأ بـ `cache_` كي يُمسح ضمن clearAppCache().
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'cache_list_';
// نحدّ حجم ما نخزّنه قرصياً كي لا ننفخ AsyncStorage
const MAX_ITEMS = 60;

/** يقرأ قائمة مخزّنة قرصياً (أو null إن لم توجد/تلفت). */
export async function readListCache<T>(key: string): Promise<T[] | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

/** يكتب القائمة قرصياً (fire-and-forget — لا يحجب واجهة المستخدم). */
export function writeListCache<T>(key: string, list: T[]): void {
  if (!Array.isArray(list)) return;
  const slice = list.length > MAX_ITEMS ? list.slice(0, MAX_ITEMS) : list;
  AsyncStorage.setItem(PREFIX + key, JSON.stringify(slice)).catch(() => {});
}
