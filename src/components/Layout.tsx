import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Menu, Search } from 'lucide-react';
import Sidebar from './Sidebar';
import AdminAlertsBell from './AdminAlertsBell';
import { AdminProfileProvider, useAdminProfile } from '@/contexts/AdminProfileContext';
import { AdminAlertsProvider } from '@/contexts/AdminAlertsContext';

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

  const handleLogout = () => {
    void signOut(auth);
    localStorage.removeItem('admin_auth');
    localStorage.removeItem('admin_uid');
    localStorage.removeItem('admin_email');
    navigate('/login');
  };

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
