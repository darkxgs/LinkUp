import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import {
  loadCurrentAdminProfile, setAdminScope, type AdminProfile, type PermissionKey,
} from '@/services/admin';
import { setCountryScopeProfile } from '@/services/countryScope';

interface Ctx {
  profile: AdminProfile | null;
  loading: boolean;
  isSuper: boolean;
  can: (key: PermissionKey) => boolean;
  reload: () => Promise<void>;
}

const AdminProfileContext = createContext<Ctx>({
  profile: null, loading: true, isSuper: false, can: () => false, reload: async () => {},
});

export function AdminProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const p = await loadCurrentAdminProfile();
    setProfile(p);
  }, []);

  useEffect(() => {
    let done = false;
    const finish = async () => {
      await reload();
      if (!done) setLoading(false);
    };
    // انتظر جاهزية المصادقة (استعادة الجلسة) ثم حمّل الملف
    if (auth.currentUser) {
      finish();
    } else {
      const unsub = onAuthStateChanged(auth, (u) => {
        if (u) { unsub(); finish(); }
      });
      // مهلة احتياطية لو لم تُستعد الجلسة
      const t = setTimeout(() => { if (!done) { setLoading(false); } }, 5000);
      return () => {
        done = true;
        unsub();
        clearTimeout(t);
        setAdminScope(null);
        setCountryScopeProfile(null);
      };
    }
    return () => { done = true; };
  }, []);

  const isSuper = !profile || profile.role === 'super';
  const can = useCallback(
    (key: PermissionKey) => isSuper || profile?.permissions?.[key] === true,
    [isSuper, profile],
  );

  // ⚡ تثبيت قيمة الـProvider — بدونها كان كل مستهلكي السياق (Sidebar/Topbar/الصفحات)
  //    يُعاد رسمهم عند أي تحديث (مثلاً تحديث التنبيهات كل 60ث). الآن فقط عند تغيّر فعلي.
  const value = useMemo<Ctx>(
    () => ({ profile, loading, isSuper, can, reload }),
    [profile, loading, isSuper, can, reload],
  );

  return (
    <AdminProfileContext.Provider value={value}>
      {children}
    </AdminProfileContext.Provider>
  );
}

export const useAdminProfile = () => useContext(AdminProfileContext);
