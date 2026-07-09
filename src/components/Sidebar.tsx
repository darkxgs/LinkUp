import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { ADMIN_BASE, adminPath } from '@/lib/adminPaths';
import {
  LayoutDashboard,
  Users,
  Radio,
  Building2,
  Wallet,
  Gift,
  Crown,
  Award,
  Coins,
  Gamepad2,
  Heart,
  FileText,
  TrendingUp,
  Settings,
  Sparkles,
  LogOut,
  Bell,
  History,
  ArrowUpFromLine,
  Package,
  ShoppingBag,
  Headphones,
  Phone,
  ShieldCheck,
  Flag,
  Frame,
  Layers,
  Clock,
  Smartphone,
  UserCog,
  Smile,
  Bot,
} from 'lucide-react';
import { useAdminProfile } from '@/contexts/AdminProfileContext';
import { useAdminAlerts } from '@/contexts/AdminAlertsContext';
import { BrandLogo } from '@/components/BrandLogo';
import type { PermissionKey } from '@/services/admin';

const NAV_SECTIONS = [
  {
    title: 'عام',
    items: [
      { to: ADMIN_BASE, label: 'لوحة المعلومات', icon: LayoutDashboard, end: true },
      { to: adminPath('/analytics'), label: 'الإحصائيات والأرباح', icon: TrendingUp, perm: 'analytics' },
      { to: adminPath('/call-usage'), label: 'استهلاك دقائق المزوّد', icon: Clock, perm: 'analytics' },
    ],
  },
  {
    title: 'الإدارة',
    items: [
      { to: adminPath('/users'), label: 'المستخدمون', icon: Users, perm: 'users' },
      { to: adminPath('/staff'), label: 'موظفو التطبيق', icon: UserCog, perm: 'users' },
      { to: adminPath('/kyc-requests'), label: 'طلبات التحقق من الهوية', icon: ShieldCheck, perm: 'users' },
    ],
  },
  {
    title: 'الغرف الصوتية المباشرة',
    items: [
      { to: adminPath('/rooms'), label: 'الغرف الصوتية', icon: Radio, perm: 'rooms' },
      { to: adminPath('/room-decor'), label: 'تخصيص الروم (إطارات/خلفيات)', icon: Frame, perm: 'rooms' },
      { to: adminPath('/room-reactions'), label: 'رموز الروم (GIF/صور)', icon: Smile, perm: 'rooms' },
    ],
  },
  {
    title: 'الوكالات',
    items: [
      { to: adminPath('/agencies'), label: 'الوكالات', icon: Building2, perm: 'agencies' },
      { to: adminPath('/agency-levels'), label: 'مستويات الوكالة', icon: TrendingUp, perm: 'agencies' },
      { to: adminPath('/agency-prince'), label: 'أمير الوكلاء', icon: Crown, perm: 'agencies' },
      { to: adminPath('/agency-applications'), label: 'طلبات فتح الوكالة', icon: FileText, perm: 'applications' },
    ],
  },
  {
    title: 'المالية',
    items: [
      { to: adminPath('/wallet'), label: 'الشحن والسحب', icon: Wallet, badge: '!', perm: 'wallet' },
      { to: adminPath('/withdrawals'), label: 'طلبات السحب', icon: ArrowUpFromLine, perm: 'withdrawals' },
      { to: adminPath('/bot'), label: 'بوت تيليغرام (شحن)', icon: Bot, perm: 'bot' },
      { to: adminPath('/packages'), label: 'باقات الشحن', icon: Coins, perm: 'gifts' },
      { to: adminPath('/gifts'), label: 'الهدايا', icon: Gift, perm: 'gifts' },
      { to: adminPath('/store'), label: 'متجر التطبيق', icon: ShoppingBag, perm: 'gifts' },
      { to: adminPath('/lucky-bag'), label: 'حقيبة الحظ', icon: Package, perm: 'gifts' },
      { to: adminPath('/room-throne'), label: 'عرش الغرفة', icon: Crown, perm: 'gifts' },
      { to: adminPath('/vip'), label: 'العضويات VIP', icon: Crown, perm: 'gifts' },
      { to: adminPath('/aristocracy'), label: 'الأرستقراطية', icon: Crown, perm: 'gifts' },
      { to: adminPath('/rewards-center'), label: 'مركز المكافآت', icon: Gift, perm: 'gifts' },
      { to: adminPath('/host-tasks'), label: 'مهام المضيفة', icon: Award, perm: 'gifts' },
      { to: adminPath('/titles'), label: 'الألقاب (لقبي)', icon: Award, perm: 'gifts' },
      { to: adminPath('/gift-privileges'), label: 'منح الامتيازات', icon: Sparkles, perm: 'gifts' },
      { to: adminPath('/privacy'), label: 'الخصوصية', icon: ShieldCheck, perm: 'gifts' },
      { to: adminPath('/call-pricing'), label: 'تسعير المكالمات والمطابقة', icon: Phone, perm: 'wallet' },
    ],
  },
  {
    title: 'المحتوى',
    items: [
      { to: adminPath('/posts'), label: 'المنشورات / اللحظات', icon: FileText, perm: 'posts' },
      { to: adminPath('/games'), label: 'الألعاب', icon: Gamepad2, perm: 'posts' },
      { to: adminPath('/relationships'), label: 'العلاقات', icon: Heart, perm: 'posts' },
      { to: adminPath('/chat-backgrounds'), label: 'خلفيات المحادثة', icon: Layers, perm: 'posts' },
      { to: adminPath('/notifications'), label: 'إشعارات المستخدمين', icon: Bell, perm: 'notifications' },
      { to: adminPath('/about-pages'), label: 'حول التطبيق', icon: FileText, perm: 'posts' },
      { to: adminPath('/support'), label: 'مركز الدعم', icon: Headphones, perm: 'support' },
      { to: adminPath('/reports'), label: 'البلاغات', icon: Flag, perm: 'support' },
    ],
  },
  {
    title: 'النظام',
    items: [
      { to: adminPath('/admins'), label: 'المشرفون والصلاحيات', icon: ShieldCheck, superOnly: true },
      { to: adminPath('/logs'), label: 'سجل النشاط', icon: History, superOnly: true },
      { to: adminPath('/settings'), label: 'الإعدادات', icon: Settings, perm: 'settings' },
      { to: adminPath('/app-release'), label: 'إصدار التطبيق (APK)', icon: Smartphone, perm: 'settings' },
    ],
  },
];

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
          if ((item as any).superOnly) return isSuper;
          const perm = (item as any).perm as PermissionKey | undefined;
          return isSuper || !perm || can(perm);
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
                    : (item as { badge?: string }).badge;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={(item as { end?: boolean }).end}
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
