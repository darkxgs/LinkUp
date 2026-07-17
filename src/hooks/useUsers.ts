/**
 * LinkUp App — useUsers Hook
 */

import { useEffect, useState } from 'react';
import {
  getLeaderboard,
  subscribeToDiscoverUsers,
  UserDoc,
} from '@/services/firebase/users';
import { useAuth } from '@/hooks/useAuth';
import { readListCache, writeListCache } from '@/utils/persistentListCache';

/**
 * cache على مستوى الموديول لقائمة الاكتشاف — يسمح بعرض فوري عند العودة للشاشة
 * دون انتظار الشبكة (يُحدَّث لحظياً من onSnapshot).
 */
const discoverCache = new Map<string, UserDoc[]>();
const cacheKey = (f: { country?: string; gender?: string; pageSize?: number }) =>
  `${f.country ?? ''}|${f.gender ?? ''}|${f.pageSize ?? 20}`;
const diskKey = (key: string) => `discover_${key}`;

export const useDiscoverUsers = (
  filters: { country?: string; gender?: 'male' | 'female'; pageSize?: number } = {},
) => {
  const { user, isLoading: authLoading } = useAuth();
  const key = cacheKey(filters);
  // اعرض المخزّن فوراً (إن وُجد) بدل سبينر حاجب
  const [users, setUsers] = useState<UserDoc[]>(() => discoverCache.get(key) ?? []);
  const [loading, setLoading] = useState(() => !discoverCache.has(key));

  useEffect(() => {
    let mounted = true;

    if (authLoading) return;

    if (!user?.uid) {
      setUsers([]);
      setLoading(false);
      return;
    }

    const cached = discoverCache.get(key);
    if (cached) {
      setUsers(cached);
      setLoading(false);
    } else {
      setLoading(true);
      // فتح بارد: اعرض آخر قائمة مخزّنة قرصياً فوراً ريثما تصل الشبكة
      readListCache<UserDoc>(diskKey(key)).then((disk) => {
        if (mounted && disk?.length && !discoverCache.has(key)) {
          discoverCache.set(key, disk);
          setUsers(disk);
          setLoading(false);
        }
      });
    }

    const unsub = subscribeToDiscoverUsers(
      { ...filters, excludeUid: user.uid },
      filters.pageSize ?? 20,
      (data) => {
        discoverCache.set(key, data);
        writeListCache(diskKey(key), data);
        if (mounted) {
          setUsers(data);
          setLoading(false);
        }
      },
    );

    // أُزيل الزرع التجريبي نهائياً (2026-07-17) — جلسات التطوير على مشروع الإنتاج

    return () => {
      mounted = false;
      unsub();
    };
  }, [filters.country, filters.gender, filters.pageSize, user?.uid, authLoading, key]);

  // مع الاشتراك الحي تتحدّث القائمة تلقائياً؛ نُبقي refresh للتوافق فقط
  const refresh = async () => {};

  return { users, loading, refresh };
};

export const useLeaderboard = (
  category: 'coins' | 'gifts' | 'followers' | 'level' = 'coins',
  period: 'daily' | 'weekly' | 'monthly' | 'all' = 'all',
) => {
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const data = await getLeaderboard(category, period);
        if (mounted) {
          setUsers(data);
          setLoading(false);
        }
      } catch (e) {
        console.error('useLeaderboard:', e);
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [category, period]);

  return { users, loading };
};
