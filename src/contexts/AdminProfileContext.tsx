import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import { getV2Token } from '@/lib/v2Api';
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
    // ⚡ التوكن حاضر لحظةَ التحميل (localStorage متزامن) — لا انتظار لأي SDK،
    //    فلم يبقَ الفرق الذي كان يعلّق الشاشة بين «دخول طازج» و«إعادة تحميل».
    if (!getV2Token()) {
      setLoading(false);
      return;
    }
    void reload().finally(() => {
      if (!done) setLoading(false);
    });
    return () => {
      done = true;
      setAdminScope(null);
      setCountryScopeProfile(null);
    };
  }, [reload]);

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
