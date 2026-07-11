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
    // ⚡ نعتمد دائماً على onAuthStateChanged كمصدر وحيد للحقيقة — لا نتحقق من
    //    auth.currentUser بشكل متزامن أولاً. الفحص المتزامن كان يتصرّف بشكل
    //    مختلف بين تسجيل الدخول الطازج (currentUser فارغ للحظة قبل أن يستقر
    //    SDK) وإعادة تحميل الصفحة (currentUser جاهز مسبقاً)، ما كان يسبب
    //    شاشة فارغة/عالقة على التحميل بعد كل تسجيل دخول جديد.
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) { finish(); } else if (!done) { setLoading(false); }
    });
    // مهلة احتياطية لو لم تُستعد الجلسة إطلاقاً
    const t = setTimeout(() => { if (!done) { setLoading(false); } }, 5000);
    return () => {
      done = true;
      unsub();
      clearTimeout(t);
      setAdminScope(null);
      setCountryScopeProfile(null);
    };
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
