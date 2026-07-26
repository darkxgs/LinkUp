import { useEffect, useRef, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Menu, Search } from 'lucide-react';
import Sidebar from './Sidebar';
import AdminAlertsBell from './AdminAlertsBell';
import { AdminProfileProvider, useAdminProfile } from '@/contexts/AdminProfileContext';
import { AdminAlertsProvider } from '@/contexts/AdminAlertsContext';
import {
  clearAdminSessionLocal,
  endAdminLoginSession,
  heartbeatAdminSession,
  watchCurrentAdminSession,
} from '@/services/adminSession';

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { profile, isSuper } = useAdminProfile();
  return (
    <header className="topbar">
      <button className="topbar-icon-btn menu-toggle" onClick={onMenuClick}>
        <Menu size={22} />
      </button>
      <div className="topbar-title">
        <h2>مرحباً، {profile?.name ?? 'مدير النظام'} 👋</h2>
        <p>
          {isSuper
            ? 'صلاحية كاملة على كل الدول'
            : `نطاقك: ${(profile?.countries ?? []).join('، ') || '—'} — تُعرض بيانات هذه الدول فقط`}
        </p>
      </div>
      <div className="topbar-search">
        <Search size={18} color="var(--text-muted)" />
        <input placeholder="ابحث عن مستخدم، غرفة..." />
      </div>
      <AdminAlertsBell />
    </header>
  );
}

function LayoutInner() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { loading } = useAdminProfile();
  const kickedRef = useRef(false);

  const forceLocalLogout = (message?: string) => {
    if (kickedRef.current) return;
    kickedRef.current = true;
    clearAdminSessionLocal();
    if (message) {
      try {
        sessionStorage.setItem('admin_kick_msg', message);
      } catch {
        // ignore
      }
    }
    navigate('/login', { replace: true });
  };

  const handleLogout = () => {
    void endAdminLoginSession().finally(() => {
      clearAdminSessionLocal();
      navigate('/login');
    });
  };

  // مراقبة الجلسة + نبضة حياة — لإخراج الحساب عند إجبار الخروج من لوحة التتبع
  useEffect(() => {
    if (loading) return;

    const unsub = watchCurrentAdminSession((reason) => {
      const msg =
        reason === 'disabled'
          ? 'تم تعطيل حسابك'
          : reason === 'session_version' || reason === 'forced_all' || reason === 'forced_by_super'
            ? 'تم تسجيل خروجك من لوحة التحكم بواسطة مدير النظام'
            : 'تم إنهاء جلستك — سجّل الدخول مجدداً';
      forceLocalLogout(msg);
    });

    const tick = () => {
      void heartbeatAdminSession().then((res) => {
        if (res.revoked) {
          forceLocalLogout('تم إنهاء جلستك — سجّل الدخول مجدداً');
        }
      });
    };
    tick();
    const interval = window.setInterval(tick, 45_000);

    return () => {
      unsub();
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="admin-layout">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={handleLogout}
      />
      <div className="main-content">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <Outlet />
      </div>
    </div>
  );
}

export default function Layout() {
  return (
    <AdminProfileProvider>
      <AdminAlertsProvider>
        <LayoutInner />
      </AdminAlertsProvider>
    </AdminProfileProvider>
  );
}
