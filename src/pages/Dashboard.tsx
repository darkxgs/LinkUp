import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminPath } from '@/lib/adminPaths';
import {
  Users, Crown, Radio, DollarSign, Coins, UserPlus, Clock, Wifi, Building2, Flag,
  PhoneCall, ArrowUpRight, Sparkles,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar,
} from 'recharts';
import { StatCard, Loading } from '@/components/Common';
import {
  getDashboardStats, getUsers, getWeeklyActivity, checkIsAdmin, selfRegisterFirstAdmin,
  formatNumber, timeAgo, getAgencyApplicationStats,
  type DashboardStats, type AdminUser, type WeeklyActivityPoint,
} from '@/services/admin';
import { useAdminProfile } from '@/contexts/AdminProfileContext';
import { useAdminAlerts } from '@/contexts/AdminAlertsContext';
import { AVATAR_FALLBACK } from '@/utils/avatarFallback';

const PIE_COLORS = ['#e11212', '#FCD34D', '#d21e2a', '#10B981'];

/** نسبة التغيّر بين قيمتين كنص قابل للعرض في مؤشر الاتجاه */
function trendOf(today: number, prev: number): { value: string; up: boolean } {
  if (prev <= 0) {
    return today > 0
      ? { value: `+${formatNumber(today)} اليوم`, up: true }
      : { value: 'لا تغيّر', up: true };
  }
  const pct = Math.round(((today - prev) / prev) * 100);
  return { value: `${pct >= 0 ? '+' : ''}${pct}% عن أمس`, up: pct >= 0 };
}

function todayLabel(): string {
  return new Date().toLocaleDateString('ar-EG', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

export default function Dashboard() {
  const { profile } = useAdminProfile();
  const { partyPendingCount } = useAdminAlerts();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [weekly, setWeekly] = useState<WeeklyActivityPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [notAdmin, setNotAdmin] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [agencyStats, setAgencyStats] = useState({ pending: 0, awaiting_hosts: 0, ready: 0, total: 0 });

  const handleSelfRegister = async () => {
    setRegistering(true);
    const res = await selfRegisterFirstAdmin();
    alert(res.message);
    if (res.ok) {
      setNotAdmin(false);
      window.location.reload();
    }
    setRegistering(false);
  };

  useEffect(() => {
    checkIsAdmin().then((ok) => setNotAdmin(!ok));
    Promise.all([
      getDashboardStats(),
      getUsers(50),
      getAgencyApplicationStats(),
      getWeeklyActivity(7),
    ]).then(([s, u, ag, wk]) => {
      setStats(s);
      setUsers(u);
      setAgencyStats(ag);
      setWeekly(wk);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="page-container"><Loading /></div>;

  const recentUsers = users.slice(0, 6);
  const distribution = [
    { name: 'عاديون', value: Math.max(0, (stats?.totalUsers ?? 0) - (stats?.totalVIP ?? 0)) },
    { name: 'VIP', value: stats?.totalVIP ?? 0 },
  ];

  // اتجاهات حقيقية من سلسلة الأسبوع (اليوم مقابل أمس)
  const last = weekly[weekly.length - 1];
  const prev = weekly[weekly.length - 2];
  const usersTrend = trendOf(last?.users ?? 0, prev?.users ?? 0);
  const revenueTrend = trendOf(last?.revenue ?? 0, prev?.revenue ?? 0);

  const weekRevenue = weekly.reduce((a, p) => a + p.revenue, 0);
  const weekMinutes = weekly.reduce((a, p) => a + p.minutes, 0);
  const weekUsers = weekly.reduce((a, p) => a + p.users, 0);

  return (
    <div className="page-container">
      {/* ترحيب + ملخّص اليوم */}
      <div
        style={{
          background: 'linear-gradient(135deg, #e11212 0%, #c21520 55%, #d21e2a 100%)',
          borderRadius: 'var(--r-lg, 20px)',
          padding: '22px 24px',
          marginBottom: 22,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          boxShadow: '0 10px 30px rgba(225,18,18,0.25)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.9, fontSize: 13, marginBottom: 6 }}>
            <Sparkles size={16} />
            {todayLabel()}
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>
            مرحباً، {profile?.name ?? 'مدير النظام'} 👋
          </h1>
          <p style={{ margin: '6px 0 0', opacity: 0.92, fontSize: 14 }}>
            إليك نظرة حيّة على نشاط LinkUp — كل الأرقام محسوبة من بيانات فعلية.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
          <HeroStat label="مستخدمون جدد اليوم" value={formatNumber(last?.users ?? stats?.newUsersToday ?? 0)} />
          <HeroStat label="إيراد اليوم" value={formatNumber(last?.revenue ?? 0)} suffix="عملة" />
          <HeroStat label="غرف نشطة الآن" value={formatNumber(stats?.activeRooms ?? 0)} />
        </div>
      </div>

      {notAdmin && (
        <div style={{
          background: 'rgba(245,158,11,0.12)',
          border: '1px solid var(--warning)',
          borderRadius: 'var(--r-md)',
          padding: '14px 18px',
          marginBottom: 20,
          color: 'var(--gold-dark)',
          fontWeight: 600,
          fontSize: 14,
          lineHeight: 1.7,
        }}>
          ⚠️ حسابك غير مُضاف لقائمة المسؤولين، لذلك قد لا تظهر البيانات أو تُرفض التعديلات.
          <br />
          أضف حسابك في collection <code style={{ background: 'rgba(0,0,0,0.06)', padding: '2px 6px', borderRadius: 4 }}>admins</code> في Firestore — راجع ملف <strong>SETUP_ADMIN.md</strong>.
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={handleSelfRegister} disabled={registering}>
              {registering ? 'جارٍ...' : 'سجّلني كأدمن تلقائياً (إن سمحت القواعد)'}
            </button>
          </div>
        </div>
      )}

      {/* تنبيهات تحتاج إجراء */}
      {(stats?.pendingReports ?? 0) > 0 && (
        <ActionBanner
          to={adminPath('/reports')}
          color="var(--danger, #EF4444)"
          text={`لديك ${stats?.pendingReports} بلاغ بانتظار المراجعة`}
          cta="فتح البلاغات"
        />
      )}
      {agencyStats.pending > 0 && (
        <ActionBanner
          to={adminPath('/agency-applications')}
          color="var(--warning)"
          text={`لديك ${agencyStats.pending} طلب وكالة بانتظار المراجعة`}
          cta="مراجعة الطلبات"
        />
      )}
      {partyPendingCount > 0 && (
        <ActionBanner
          to={adminPath('/agencies')}
          color="#d21e2a"
          text={`لديك ${partyPendingCount} طلب حفلة/فعالية بانتظار الموافقة`}
          cta="مراجعة في الوكالات"
        />
      )}

      {/* القسم: نظرة عامة */}
      <SectionTitle>نظرة عامة</SectionTitle>
      <div className="stats-grid">
        <StatCard
          icon={Users}
          value={formatNumber(stats?.totalUsers ?? 0)}
          label="إجمالي المستخدمين"
          color="#e11212"
          bg="rgba(225,18,18,0.12)"
          trend={usersTrend}
        />
        <StatCard
          icon={DollarSign}
          value={formatNumber(stats?.totalRevenue ?? 0)}
          label="إجمالي الإيرادات (عملات)"
          color="#10B981"
          bg="rgba(16,185,129,0.12)"
          trend={revenueTrend}
        />
        <StatCard
          icon={Crown}
          value={formatNumber(stats?.totalVIP ?? 0)}
          label="أعضاء VIP"
          color="#F59E0B"
          bg="rgba(252,211,77,0.18)"
        />
        <StatCard
          icon={Radio}
          value={formatNumber(stats?.totalRooms ?? 0)}
          label="الغرف"
          color="#d21e2a"
          bg="rgba(210,30,42,0.12)"
          trend={{ value: `${stats?.activeRooms ?? 0} نشطة`, up: true }}
        />
        <Link to={adminPath('/agency-applications')} style={{ textDecoration: 'none' }}>
          <StatCard
            icon={Building2}
            value={agencyStats.pending}
            label="طلبات فتح الوكالة"
            color="#f05a5a"
            bg="rgba(240,90,90,0.12)"
            trend={{ value: `${agencyStats.ready} جاهز • ${agencyStats.total} إجمالي`, up: agencyStats.pending === 0 }}
          />
        </Link>
        <Link to={adminPath('/reports')} style={{ textDecoration: 'none' }}>
          <StatCard
            icon={Flag}
            value={stats?.pendingReports ?? 0}
            label="بلاغات قيد الانتظار"
            color="#EF4444"
            bg="rgba(239,68,68,0.12)"
            trend={{ value: (stats?.pendingReports ?? 0) > 0 ? 'تحتاج مراجعة' : 'لا بلاغات جديدة', up: (stats?.pendingReports ?? 0) === 0 }}
          />
        </Link>
      </div>

      {/* القسم: نشاط آخر 7 أيام */}
      <SectionTitle hint={`${formatNumber(weekUsers)} مستخدم • ${formatNumber(weekRevenue)} عملة • ${formatNumber(weekMinutes)} دقيقة`}>
        نشاط آخر ٧ أيام
      </SectionTitle>
      <div className="charts-grid">
        <div className="card">
          <div className="card-header">
            <h3>المستخدمون الجدد والإيرادات</h3>
            <span className="badge badge-purple">بيانات فعلية</span>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={weekly}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e11212" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#e11212" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="day" tick={{ fontFamily: 'Cairo', fontSize: 12 }} stroke="#9CA3AF" />
                <YAxis yAxisId="left" tick={{ fontFamily: 'Cairo', fontSize: 12 }} stroke="#9CA3AF" />
                <YAxis yAxisId="right" orientation="left" tick={{ fontFamily: 'Cairo', fontSize: 12 }} stroke="#9CA3AF" hide />
                <Tooltip
                  contentStyle={{ fontFamily: 'Cairo', borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  labelStyle={{ fontWeight: 700 }}
                />
                <Area yAxisId="left" type="monotone" dataKey="users" name="مستخدمون جدد" stroke="#e11212" strokeWidth={2.5} fill="url(#colorUsers)" />
                <Area yAxisId="right" type="monotone" dataKey="revenue" name="إيرادات (عملة)" stroke="#10B981" strokeWidth={2.5} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>توزيع المستخدمين</h3>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={distribution} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={4} dataKey="value">
                  {distribution.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontFamily: 'Cairo', borderRadius: 12, border: 'none' }} />
                <Legend wrapperStyle={{ fontFamily: 'Cairo', fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* دقائق المكالمات اليومية (مزوّد Agora) */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3>
            <PhoneCall size={18} style={{ verticalAlign: 'middle', marginLeft: 6, color: '#8b0000' }} />
            دقائق المكالمات المستهلكة يومياً
          </h3>
          <Link to={adminPath('/call-usage')} className="badge badge-purple" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            التفاصيل <ArrowUpRight size={13} />
          </Link>
        </div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weekly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="day" tick={{ fontFamily: 'Cairo', fontSize: 12 }} stroke="#9CA3AF" />
              <YAxis tick={{ fontFamily: 'Cairo', fontSize: 12 }} stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{ fontFamily: 'Cairo', borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                labelStyle={{ fontWeight: 700 }}
                formatter={(v: number) => [`${formatNumber(v)} دقيقة`, 'دقائق']}
              />
              <Bar dataKey="minutes" name="دقائق" fill="#8b0000" radius={[6, 6, 0, 0]} maxBarSize={42} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* القسم: المالية والتشغيل */}
      <SectionTitle>المالية والتشغيل</SectionTitle>
      <div className="stats-grid">
        <StatCard icon={Coins} value={formatNumber(stats?.totalCoinsInCirculation ?? 0)} label="العملات المتداولة" color="#FCD34D" bg="rgba(252,211,77,0.18)" />
        <StatCard icon={UserPlus} value={formatNumber(stats?.newUsersToday ?? 0)} label="مستخدمون جدد اليوم" color="#06B6D4" bg="rgba(6,182,212,0.12)" />
        <StatCard icon={Clock} value={formatNumber(stats?.pendingWithdrawals ?? 0)} label="سحوبات معلّقة" color="#EF4444" bg="rgba(239,68,68,0.12)" />
        <StatCard icon={Wifi} value={formatNumber(stats?.activeRooms ?? 0)} label="غرف نشطة الآن" color="#10B981" bg="rgba(16,185,129,0.12)" />
      </div>

      {/* القسم: أحدث المستخدمين */}
      <SectionTitle>
        أحدث المستخدمين
      </SectionTitle>
      <div className="card">
        <div className="card-header">
          <h3>آخر من انضمّ للمنصّة</h3>
          <Link to={adminPath('/users')} className="badge badge-purple" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            كل المستخدمين <ArrowUpRight size={13} />
          </Link>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>المستخدم</th>
                <th>الدولة</th>
                <th>المستوى</th>
                <th>العملات</th>
                <th>انضم</th>
              </tr>
            </thead>
            <tbody>
              {recentUsers.map((u) => (
                <tr key={u.uid}>
                  <td>
                    <Link to={`/users/${u.uid}`} className="table-user" style={{ textDecoration: 'none', color: 'inherit' }}>
                      <img src={u.avatar || AVATAR_FALLBACK} alt="" loading="lazy" />
                      <div className="table-user-info">
                        <p>{u.displayName}</p>
                        <span>{u.isVIP ? '⭐ VIP' : 'عضو'}</span>
                      </div>
                    </Link>
                  </td>
                  <td>{u.country}</td>
                  <td><span className="badge badge-purple">LV{u.level}</span></td>
                  <td>{formatNumber(u.coins)}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{timeAgo(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function HeroStat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 92 }}>
      <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1 }}>
        {value}
        {suffix && <span style={{ fontSize: 12, opacity: 0.85, marginRight: 4 }}>{suffix}</span>}
      </div>
      <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '8px 2px 14px', gap: 12, flexWrap: 'wrap' }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--text, #111827)' }}>{children}</h2>
      {hint && <span style={{ fontSize: 12.5, color: 'var(--text-muted, #9CA3AF)', fontWeight: 600 }}>{hint}</span>}
    </div>
  );
}

function ActionBanner({ to, color, text, cta }: { to: string; color: string; text: string; cta: string }) {
  return (
    <div
      className="card"
      style={{
        marginBottom: 14,
        padding: 14,
        borderColor: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
      }}
    >
      <span style={{ fontWeight: 600 }}>{text}</span>
      <Link to={to} className="btn-primary" style={{ textDecoration: 'none' }}>{cta}</Link>
    </div>
  );
}
