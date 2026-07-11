import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import PublicLayout from '@/landing/PublicLayout';
import { ADMIN_BASE } from '@/lib/adminPaths';
import { Loading } from '@/components/Common';
import { PermissionRoute } from '@/components/PermissionRoute';
import { PAGE_PERMISSIONS } from '@/lib/navConfig';

const SiteLanding = lazy(() => import('@/landing/pages/Landing'));
const SiteAbout = lazy(() => import('@/landing/pages/About'));
const SiteContact = lazy(() => import('@/landing/pages/Contact'));
const SitePrivacy = lazy(() => import('@/landing/pages/Privacy'));
const SiteDeleteAccount = lazy(() => import('@/landing/pages/DeleteAccount'));
const AppDownload = lazy(() => import('@/pages/AppDownload'));

const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Analytics = lazy(() => import('@/pages/Analytics'));
const Users = lazy(() => import('@/pages/Users'));
const UserDetail = lazy(() => import('@/pages/UserDetail'));
const Rooms = lazy(() => import('@/pages/Rooms'));
const RoomDecor = lazy(() => import('@/pages/RoomDecor'));
const Agencies = lazy(() => import('@/pages/Agencies'));
const AgencyDetail = lazy(() => import('@/pages/AgencyDetail'));
const AgencyApplications = lazy(() => import('@/pages/AgencyApplications'));
const Admins = lazy(() => import('@/pages/Admins'));
const Staff = lazy(() => import('@/pages/Staff'));
const Wallet = lazy(() => import('@/pages/Wallet'));
const Withdrawals = lazy(() => import('@/pages/Withdrawals'));
const RechargePackages = lazy(() => import('@/pages/RechargePackages'));
const Gifts = lazy(() => import('@/pages/Gifts'));
const Stickers = lazy(() => import('@/pages/Stickers'));
const Store = lazy(() => import('@/pages/Store'));
const LuckyBag = lazy(() => import('@/pages/LuckyBag'));
const RoomThrone = lazy(() => import('@/pages/RoomThrone'));
const RoomReactions = lazy(() => import('@/pages/RoomReactions'));
const Vip = lazy(() => import('@/pages/Vip'));
const AgencyLevels = lazy(() => import('@/pages/AgencyLevels'));
const AgencyPrince = lazy(() => import('@/pages/AgencyPrince'));
const RewardsCenter = lazy(() => import('@/pages/RewardsCenter'));
const HostTasks = lazy(() => import('@/pages/HostTasks'));
const Aristocracy = lazy(() => import('@/pages/Aristocracy'));
const Titles = lazy(() => import('@/pages/Titles'));
const GiftPrivileges = lazy(() => import('@/pages/GiftPrivileges'));
const Privacy = lazy(() => import('@/pages/Privacy'));
const AboutPages = lazy(() => import('@/pages/AboutPages'));
const Games = lazy(() => import('@/pages/Games'));
const CallPricing = lazy(() => import('@/pages/CallPricing'));
const CallUsage = lazy(() => import('@/pages/CallUsage'));
const ChatBackgrounds = lazy(() => import('@/pages/ChatBackgrounds'));
const Relationships = lazy(() => import('@/pages/Relationships'));
const Posts = lazy(() => import('@/pages/Posts'));
const Notifications = lazy(() => import('@/pages/Notifications'));
const AdminLogs = lazy(() => import('@/pages/AdminLogs'));
const Settings = lazy(() => import('@/pages/Settings'));
const Support = lazy(() => import('@/pages/Support'));
const Reports = lazy(() => import('@/pages/Reports'));
const KycRequests = lazy(() => import('@/pages/KycRequests'));
const AppRelease = lazy(() => import('@/pages/AppRelease'));
const BotAdmin = lazy(() => import('@/pages/BotAdmin'));

/**
 * يعتمد على حالة Firebase Auth الفعلية (onAuthStateChanged) وليس فقط localStorage —
 * كان الاعتماد على العلم المحفوظ فقط يسمح بعرض اللوحة بعد تحديث الصفحة حتى لو
 * انتهت الجلسة الحقيقية فعلاً (تسجيل خروج من جهاز آخر، انتهاء صلاحية التوكن، ...).
 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'authed' | 'guest'>('checking');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        localStorage.setItem('admin_auth', 'true');
        setStatus('authed');
      } else {
        localStorage.removeItem('admin_auth');
        localStorage.removeItem('admin_uid');
        localStorage.removeItem('admin_email');
        setStatus('guest');
      }
    });
    return unsub;
  }, []);

  if (status === 'checking') return <div className="page-container"><Loading /></div>;
  return status === 'authed' ? <>{children}</> : <Navigate to="/login" replace />;
}

/** يحرس صفحة بالصلاحية المطابقة لها في NAV_SECTIONS (routePath) — مصدر واحد للحقيقة مع الشريط الجانبي. */
function guard(routePath: string, children: React.ReactNode) {
  const { perm, superOnly } = PAGE_PERMISSIONS[routePath] ?? {};
  return (
    <PermissionRoute perm={perm} superOnly={superOnly}>
      {children}
    </PermissionRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="page-container"><Loading /></div>}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<SiteLanding />} />
            <Route path="/about" element={<SiteAbout />} />
            <Route path="/contact" element={<SiteContact />} />
            <Route path="/privacy" element={<SitePrivacy />} />
            <Route path="/delete-account" element={<SiteDeleteAccount />} />
            <Route path="/download" element={<AppDownload />} />
            <Route path="/landing" element={<Navigate to="/download" replace />} />
          </Route>

          <Route path="/login" element={<Login />} />

          <Route
            path={ADMIN_BASE}
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="analytics" element={guard('analytics', <Analytics />)} />
            <Route path="users" element={guard('users', <Users />)} />
            <Route path="users/:uid" element={guard('users', <UserDetail />)} />
            <Route path="rooms" element={guard('rooms', <Rooms />)} />
            <Route path="room-decor" element={guard('room-decor', <RoomDecor />)} />
            <Route path="agencies" element={guard('agencies', <Agencies />)} />
            <Route path="agencies/:id" element={guard('agencies', <AgencyDetail />)} />
            <Route path="agency-prince" element={guard('agency-prince', <AgencyPrince />)} />
            <Route path="agency-levels" element={guard('agency-levels', <AgencyLevels />)} />
            <Route path="agency-applications" element={guard('agency-applications', <AgencyApplications />)} />
            <Route path="wallet" element={guard('wallet', <Wallet />)} />
            <Route path="withdrawals" element={guard('withdrawals', <Withdrawals />)} />
            <Route path="bot" element={guard('bot', <BotAdmin />)} />
            <Route path="packages" element={guard('packages', <RechargePackages />)} />
            <Route path="gifts" element={guard('gifts', <Gifts />)} />
            <Route path="stickers" element={guard('stickers', <Stickers />)} />
            <Route path="store" element={guard('store', <Store />)} />
            <Route path="lucky-bag" element={guard('lucky-bag', <LuckyBag />)} />
            <Route path="room-throne" element={guard('room-throne', <RoomThrone />)} />
            <Route path="room-reactions" element={guard('room-reactions', <RoomReactions />)} />
            <Route path="vip" element={guard('vip', <Vip />)} />
            <Route path="rewards-center" element={guard('rewards-center', <RewardsCenter />)} />
            <Route path="host-tasks" element={guard('host-tasks', <HostTasks />)} />
            <Route path="aristocracy" element={guard('aristocracy', <Aristocracy />)} />
            <Route path="titles" element={guard('titles', <Titles />)} />
            <Route path="gift-privileges" element={guard('gift-privileges', <GiftPrivileges />)} />
            <Route path="privacy" element={guard('privacy', <Privacy />)} />
            <Route path="about-pages" element={guard('about-pages', <AboutPages />)} />
            <Route path="games" element={guard('games', <Games />)} />
            <Route path="call-pricing" element={guard('call-pricing', <CallPricing />)} />
            <Route path="call-usage" element={guard('call-usage', <CallUsage />)} />
            <Route path="relationships" element={guard('relationships', <Relationships />)} />
            <Route path="chat-backgrounds" element={guard('chat-backgrounds', <ChatBackgrounds />)} />
            <Route path="posts" element={guard('posts', <Posts />)} />
            <Route path="notifications" element={guard('notifications', <Notifications />)} />
            <Route path="support" element={guard('support', <Support />)} />
            <Route path="reports" element={guard('reports', <Reports />)} />
            <Route path="kyc-requests" element={guard('kyc-requests', <KycRequests />)} />
            <Route path="admins" element={guard('admins', <Admins />)} />
            <Route path="staff" element={guard('staff', <Staff />)} />
            <Route path="logs" element={guard('logs', <AdminLogs />)} />
            <Route path="settings" element={guard('settings', <Settings />)} />
            <Route path="app-release" element={guard('app-release', <AppRelease />)} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
