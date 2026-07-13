import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { adminPath } from '@/lib/adminPaths';
import { Crown, LogOut } from 'lucide-react';
import { useAdminProfile } from '@/contexts/AdminProfileContext';
import { useAdminAlerts } from '@/contexts/AdminAlertsContext';
import { BrandLogo } from '@/components/BrandLogo';
import { NAV_SECTIONS, navItemPerm } from '@/lib/navConfig';

interface Props {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
}

export default function Sidebar({ open, onClose, onLogout }: Props) {
  const { profile, isSuper, can } = useAdminProfile();
  const { partyPendingCount } = useAdminAlerts();

  // ⚡ تثبيت حساب أقسام القائمة (114 عنصراً) — كان يُعاد حسابه كل render، وبالأخص
  //    عند تحديث التنبيهات كل 60ث فيتقطّع التنقّل. الآن فقط عند تغيّر الصلاحيات.
  const visibleSections = useMemo(
    () =>
      NAV_SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          if (item.superOnly) return isSuper;
          const perm = navItemPerm(item);
          if (isSuper || !perm) return true;
          return can(`${perm}:sidebar`) || can(perm);
        }),
      })).filter((section) => section.items.length > 0),
    [isSuper, can],
  );

  return (
    <>
      <div
        className={`sidebar-backdrop ${open ? 'show' : ''}`}
        onClick={onClose}
      />
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <BrandLogo size={48} className="sidebar-brand-logo" />
          <div className="sidebar-logo-text">
            <h1>LinkUp</h1>
            <span>لوحة التحكم</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {visibleSections.map((section) => (
            <div key={section.title}>
              <div className="nav-section-title">{section.title}</div>
              {section.items.map((item) => {
                const Icon = item.icon;
                const dynamicBadge =
                  item.to === adminPath('/agencies') && partyPendingCount > 0
                    ? String(partyPendingCount > 9 ? '9+' : partyPendingCount)
                    : item.badge;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    onClick={onClose}
                  >
                    <Icon size={20} strokeWidth={2.2} />
                    <span>{item.label}</span>
                    {dynamicBadge && (
                      <span className="nav-badge">{dynamicBadge}</span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-logo-icon" style={{ width: 38, height: 38 }}>
              <Crown size={20} color="#fff" />
            </div>
            <div className="sidebar-user-info">
              <p>{profile?.name ?? 'مدير النظام'}</p>
              <span>{isSuper ? 'مدير النظام' : `مشرف: ${(profile?.countries ?? []).join('، ') || '—'}`}</span>
            </div>
            <button className="topbar-icon-btn" style={{ width: 34, height: 34, background: 'rgba(255,255,255,0.1)', color: '#fff' }} onClick={onLogout}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
