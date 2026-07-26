import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getV2Token, setV2UnauthorizedHandler } from '@/lib/v2Api';
import { checkIsAdmin } from '@/services/admin';
import { clearAdminSessionLocal } from '@/services/adminSession';
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
const AgencyVerifications = lazy(() => import('@/pages/AgencyVerifications'));
const Admins = lazy(() => import('@/pages/Admins'));
const Staff = lazy(() => import('@/pages/Staff'));
const Wallet = lazy(() => import('@/pages/Wallet'));
const Withdrawals = lazy(() => import('@/pages/Withdrawals'));
const RechargePackages = lazy(() => import('@/pages/RechargePackages'));
const Gifts = lazy(() => import('@/pages/Gifts'));
const Store = lazy(() => import('@/pages/Store'));
const LuckyBag = lazy(() => import('@/pages/LuckyBag'));
const RoomThrone = lazy(() => import('@/pages/RoomThrone'));
const RoomReactions = lazy(() => import('@/pages/RoomReactions'));
const Vip = lazy(() => import('@/pages/Vip'));
const AgencyLevels = lazy(() => import('@/pages/AgencyLevels'));
const AgencyPolicies = lazy(() => import('@/pages/AgencyPolicies'));
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
const AdminSessions = lazy(() => import('@/pages/AdminSessions'));
const Settings = lazy(() => import('@/pages/Settings'));
const Support = lazy(() => import('@/pages/Support'));
const Reports = lazy(() => import('@/pages/Reports'));
const KycRequests = lazy(() => import('@/pages/KycRequests'));
const AppRelease = lazy(() => import('@/pages/AppRelease'));
const BotAdmin = lazy(() => import('@/pages/BotAdmin'));

/**
 * يسأل السيرفر عن الجلسة بدل الاعتماد على علم في localStorage.
 *
 * A stored flag alone would keep showing the panel after a page refresh even
 * when the real session is over (signed out elsewhere, token expired, admin
 * demoted). `checkIsAdmin()` hits `/admin/me` behind the guard, which re-reads
 * the account on every request — so a revoked admin lands on /login at once.
 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'authed' | 'guest'>('checking');

  useEffect(() => {
    let alive = true;
    // No token at all ⇒ guest, without a round trip.
    if (!getV2Token()) {
      clearAdminSessionLocal();
      setStatus('guest');
      return;
    }
    void checkIsAdmin().then((ok) => {
      if (!alive) return;
      if (ok) {
        localStorage.setItem('admin_auth', 'true');
        setStatus('authed');
      } else {
        clearAdminSessionLocal();
        setStatus('guest');
      }
    });
    return () => {
      alive = false;
    };
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
  // A 401 anywhere in the panel means the token is gone or expired. Drop the
  // session once, centrally, so a stale tab cannot keep hammering the API with a
  // dead token — and so the user lands on the login screen instead of watching
  // every widget fail one by one.
  useEffect(() => {
    setV2UnauthorizedHandler(() => {
      if (!getV2Token()) return; // already cleared by another failed request
      clearAdminSessionLocal();
      try {
        sessionStorage.setItem('admin_kick_msg', 'انتهت الجلسة، سجّل الدخول من جديد');
      } catch {
        // ignore
      }
      window.location.assign('/login');
    });
    return () => setV2UnauthorizedHandler(null);
  }, []);

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
            <Route path="analytics" element={<Analytics />} />
            <Route path="users" element={<Users />} />
            <Route path="users/:uid" element={<UserDetail />} />
            <Route path="rooms" element={<Rooms />} />
            <Route path="room-decor" element={<RoomDecor />} />
            <Route path="agencies" element={<Agencies />} />
            <Route path="agencies/:id" element={<AgencyDetail />} />
            <Route path="agency-prince" element={<AgencyPrince />} />
            <Route path="agency-levels" element={<AgencyLevels />} />
            <Route path="agency-applications" element={<AgencyApplications />} />
            <Route path="agency-policies" element={guard('agency-policies', <AgencyPolicies />)} />
            <Route path="agency-verifications" element={guard('agency-verifications', <AgencyVerifications />)} />
            <Route path="wallet" element={<Wallet />} />
            <Route path="withdrawals" element={<Withdrawals />} />
            <Route path="bot" element={<BotAdmin />} />
            <Route path="packages" element={<RechargePackages />} />
            <Route path="gifts" element={<Gifts />} />
            <Route path="store" element={<Store />} />
            <Route path="lucky-bag" element={<LuckyBag />} />
            <Route path="room-throne" element={<RoomThrone />} />
            <Route path="room-reactions" element={<RoomReactions />} />
            <Route path="vip" element={<Vip />} />
            <Route path="rewards-center" element={<RewardsCenter />} />
            <Route path="host-tasks" element={<HostTasks />} />
            <Route path="aristocracy" element={<Aristocracy />} />
            <Route path="titles" element={<Titles />} />
            <Route path="gift-privileges" element={<GiftPrivileges />} />
            <Route path="privacy" element={<Privacy />} />
            <Route path="about-pages" element={<AboutPages />} />
            <Route path="games" element={<Games />} />
            <Route path="call-pricing" element={<CallPricing />} />
            <Route path="call-usage" element={<CallUsage />} />
            <Route path="relationships" element={<Relationships />} />
            <Route path="chat-backgrounds" element={<ChatBackgrounds />} />
            <Route path="posts" element={<Posts />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="support" element={<Support />} />
            <Route path="reports" element={<Reports />} />
            <Route path="kyc-requests" element={<KycRequests />} />
            <Route path="admins" element={<Admins />} />
            <Route path="staff" element={<Staff />} />
            <Route path="sessions" element={<AdminSessions />} />
            <Route path="logs" element={<AdminLogs />} />
            <Route path="settings" element={<Settings />} />
            <Route path="app-release" element={<AppRelease />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
