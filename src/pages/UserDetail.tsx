import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { adminPath } from '@/lib/adminPaths';
import {
  ArrowRight, Coins, Gem, Crown, BadgeCheck, Ban, Pencil, Trash2,
  Gift, ArrowDownToLine, Gamepad2, Award, Bell, User, Calendar, X,
  Lock, Eye, EyeOff, Copy, RefreshCw, Smartphone, MapPin, Globe2,
  AlertTriangle, Wifi,
} from 'lucide-react';
import { subscribeToUserPresence, isPresenceOnline } from '@/lib/presence';
import { Loading, Empty, Badge } from '@/components/Common';
import { CopyableId } from '@/components/CopyableId';
import { CountryBadge, CountrySelect } from '@/components/CountrySelect';
import { NotifyUserModal } from '@/components/NotifyUserModal';
import { SuspendUserModal } from '@/components/SuspendUserModal';
import { useToast } from '@/components/Toast';
import { useConfirmDialog } from '@/components/ConfirmDialog';
import { useAdminProfile } from '@/contexts/AdminProfileContext';
import {
  getUserFullProfile,
  getMemberTransactions,
  getUserWithdrawals,
  getUserGameTransactions,
  getUserLoginSessions,
  getTitlesConfig,
  adminUpdateAppUser,
  adminSetAppUserPassword,
  adminDeleteAppUsers,
  addUserBalance,
  banUser,
  unsuspendUser,
  logAdminAction,
  formatNumber,
  formatDate,
  timeAgo,
  txTypeLabel,
  type AdminUserFull,
  type AdminTransaction,
  type AdminUserWithdrawal,
  type AdminGameTx,
  type AdminLoginSession,
  type AdminRegisteredDevice,
  type AdminUpdateAppUserPatch,
  type ConfigTitles,
} from '@/services/admin';

const ACTIVE_MS = 7 * 24 * 60 * 60 * 1000;

function genderLabel(g?: string): string {
  if (g === 'female') return 'أنثى';
  if (g === 'male') return 'ذكر';
  return '—';
}

function joinDaysSince(createdAt: number): number {
  if (!createdAt) return 0;
  return Math.max(1, Math.floor((Date.now() - createdAt) / 86400000));
}

const WD_STATUS: Record<string, { label: string; variant: string }> = {
  pending: { label: 'قيد المراجعة', variant: 'gold' },
  approved: { label: 'معتمد', variant: 'blue' },
  completed: { label: 'مكتمل', variant: 'green' },
  rejected: { label: 'مرفوض', variant: 'red' },
};

function formatLocation(loc?: { latitude?: number; longitude?: number; city?: string; region?: string; country?: string } | null): string {
  if (!loc) return '—';
  const parts = [loc.city, loc.region, loc.country].filter(Boolean);
  const label = parts.length ? parts.join('، ') : '';
  if (loc.latitude != null && loc.longitude != null) {
    const coords = `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`;
    return label ? `${label} (${coords})` : coords;
  }
  return label || '—';
}

function loginMethodLabel(method?: string): string {
  switch (method) {
    case 'email': return 'بريد';
    case 'accountId': return 'معرّف الحساب';
    case 'register': return 'تسجيل جديد';
    case 'google': return 'Google';
    case 'facebook': return 'Facebook';
    case 'phone': return 'هاتف';
    default: return method || '—';
  }
}

type Tab = 'overview' | 'edit' | 'sessions' | 'transactions' | 'withdrawals' | 'gifts' | 'titles';

export default function UserDetailPage() {
  const { uid = '' } = useParams();
  const navigate = useNavigate();
  const { isSuper, can } = useAdminProfile();
  const [user, setUser] = useState<AdminUserFull | null>(null);
  const [txs, setTxs] = useState<AdminTransaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<AdminUserWithdrawal[]>([]);
  const [gameTxs, setGameTxs] = useState<AdminGameTx[]>([]);
  const [loginSessions, setLoginSessions] = useState<AdminLoginSession[]>([]);
  const [titlesConfig, setTitlesConfig] = useState<ConfigTitles | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [lastPingAt, setLastPingAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    const [u, t, w, g, ls, tc] = await Promise.all([
      getUserFullProfile(uid),
      getMemberTransactions(uid, 80),
      getUserWithdrawals(uid),
      getUserGameTransactions(uid),
      getUserLoginSessions(uid, 60),
      getTitlesConfig(),
    ]);
    setUser(u);
    setTxs(t);
    setWithdrawals(w);
    setGameTxs(g);
    setLoginSessions(ls);
    setTitlesConfig(tc);
    setLoading(false);
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!uid) return;
    return subscribeToUserPresence(uid, setLastPingAt);
  }, [uid]);

  const giftTxs = useMemo(
    () => txs.filter((t) => String(t.type).includes('gift')),
    [txs],
  );

  const summary = useMemo(() => {
    const recharge = txs.filter((t) => t.type === 'recharge' && t.status === 'completed')
      .reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);
    const sent = txs.filter((t) => t.type === 'gift_sent')
      .reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);
    const received = txs.filter((t) => t.type === 'gift_received')
      .reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);
    const earned = txs.filter((t) => (t.amount ?? 0) > 0 && t.type !== 'recharge')
      .reduce((s, t) => s + (t.amount ?? 0), 0);
    const wdTotal = withdrawals.filter((w) => w.status === 'completed')
      .reduce((s, w) => s + w.amount, 0);
    const gameBets = gameTxs.reduce((s, g) => s + g.stake, 0);
    const gameWins = gameTxs.reduce((s, g) => s + g.winAmount, 0);
    return { recharge, sent, received, earned, wdTotal, gameBets, gameWins };
  }, [txs, withdrawals, gameTxs]);

  if (loading) return <div className="page-container"><Loading /></div>;
  if (!user) {
    return (
      <div className="page-container">
        <Empty text="المستخدم غير موجود أو خارج نطاق صلاحيتك" />
        <Link to={adminPath('/users')} className="btn btn-ghost" style={{ marginTop: 16 }}>العودة للمستخدمين</Link>
      </div>
    );
  }

  const isActive = (user.lastSeen ?? user.createdAt) >= Date.now() - ACTIVE_MS;

  const titleName = (id: string) => {
    const t = titlesConfig?.titles?.find((x) => x.id === id);
    return t?.nameAr ?? id;
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'نظرة عامة' },
    { id: 'sessions', label: 'الأجهزة والدخول' },
    { id: 'edit', label: 'تعديل' },
    { id: 'transactions', label: 'المعاملات' },
    { id: 'withdrawals', label: 'السحوبات' },
    { id: 'gifts', label: 'الهدايا' },
    { id: 'titles', label: 'الألقاب' },
  ];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 20 }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(adminPath('/users'))}>
          <ArrowRight size={16} /> المستخدمون
        </button>
        <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(isSuper || can('users:notify')) && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setNotifyOpen(true)}>
              <Bell size={16} /> إرسال إشعار
            </button>
          )}
          {(isSuper || can('users:edit')) && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTab('edit')}>
              <Pencil size={16} /> تعديل
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
          <img
            src={user.avatar || `https://i.pravatar.cc/120?u=${user.uid}`}
            alt=""
            style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover' }}
          />
          <div style={{ flex: 1, minWidth: 220 }}>
            <h1 style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {user.displayName}
              {user.isVerified && <BadgeCheck size={20} color="#b00814" />}
              {user.isVIP && <Badge variant="gold">VIP{user.vipLevel ? ` ${user.vipLevel}` : ''}</Badge>}
              {user.isSuspended ? (
                <Badge variant="gold">
                  معلّق مؤقتاً{user.suspendedUntil ? ` — حتى ${formatDate(user.suspendedUntil)}` : ''}
                </Badge>
              ) : user.isBanned ? (
                <Badge variant="red">محظور دائماً</Badge>
              ) : user.accountStatus === 'pending_deletion' ? (
                <Badge variant="gray">بانتظار الحذف</Badge>
              ) : (
                <Badge variant="green">نشط</Badge>
              )}
              <Badge variant={isPresenceOnline(lastPingAt) ? 'green' : 'gray'}>
                {isPresenceOnline(lastPingAt) ? '● متصل الآن' : '○ غير متصل'}
              </Badge>
            </h1>
            <CopyableId id={user.publicAccountId} label="معرّف" />
            <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', margin: '6px 0' }}>
              UID: {user.uid}
            </p>
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <CountryBadge code={user.country} showCode />
              <Badge variant={user.gender === 'female' ? 'pink' : 'blue'}>
                {genderLabel(user.gender)}
              </Badge>
              {user.birthYear ? (
                <Badge variant="gray">{user.birthYear}</Badge>
              ) : null}
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Badge variant={isActive ? 'green' : 'blue'}>
                {isActive ? 'متفاعل' : 'غير متفاعل'}
              </Badge>
              <Badge variant="purple">المستوى LV{user.level}</Badge>
              {user.agencyName ? <Badge variant="pink">{user.agencyName}</Badge> : null}
            </div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={14} />
              انضم: {formatDate(user.createdAt)} ({joinDaysSince(user.createdAt)} يوم)
            </div>
            <div>آخر ظهور: {timeAgo(user.lastSeen ?? user.createdAt)}</div>
            {user.email ? <div>{user.email}</div> : null}
          </div>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <StatMini icon={<Coins size={22} color="#F59E0B" />} bg="rgba(252,211,77,0.18)" value={formatNumber(user.coins)} label="كوينز" />
        <StatMini icon={<Gem size={22} color="#f05a5a" />} bg="rgba(240,90,90,0.12)" value={formatNumber(user.pearls)} label="ماسة" />
        <StatMini icon={<Gamepad2 size={22} color="#e11212" />} bg="rgba(225,18,18,0.12)" value={formatNumber(user.casinoCoins)} label="كازينو" />
        <StatMini icon={<Crown size={22} color="#e11212" />} bg="rgba(225,18,18,0.12)" value={`LV${user.level}`} label={`XP ${formatNumber(user.xp)}`} />
        <StatMini icon={<Gift size={22} color="#d21e2a" />} bg="rgba(210,30,42,0.12)" value={formatNumber(summary.received)} label="هدايا مستلمة" />
        <StatMini icon={<ArrowDownToLine size={22} color="#10B981" />} bg="rgba(16,185,129,0.12)" value={formatNumber(summary.wdTotal)} label="سحوبات مكتملة" />
        <StatMini icon={<Coins size={22} color="#059669" />} bg="rgba(5,150,105,0.12)" value={formatNumber(summary.recharge)} label="إجمالي الشحن" />
        <StatMini icon={<User size={22} color="#b00814" />} bg="rgba(176,8,20,0.12)" value={formatNumber(user.followers)} label="متابعون" />
      </div>

      <div className="tabs" style={{ width: '100%', marginBottom: 16 }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="card">
          <div className="card-header"><h3>ملخص مالي ونشاط</h3></div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              <InfoBox label="شحن (كوينز)" value={formatNumber(summary.recharge)} />
              <InfoBox label="هدايا أُرسلت" value={formatNumber(summary.sent)} />
              <InfoBox label="هدايا مُستلمة" value={formatNumber(summary.received)} />
              <InfoBox label="أرباح/وارد (+)" value={formatNumber(summary.earned)} />
              <InfoBox label="سحوبات مكتملة (ماسة)" value={formatNumber(summary.wdTotal)} />
              <InfoBox label="رهانات ألعاب" value={formatNumber(summary.gameBets)} />
              <InfoBox label="جوائز ألعاب" value={formatNumber(summary.gameWins)} />
              <InfoBox label="صافي ألعاب" value={formatNumber(summary.gameBets - summary.gameWins)} />
              <InfoBox label="نقاط VIP" value={formatNumber(user.vipPoints)} />
              {/* إصلاح #17 — عرض كلا مصدري الزوار للتشخيص */}
              <InfoBox label="زوار البروفايل (MAX)" value={formatNumber(user.visitors)} />
              {(user.visitorsStats !== undefined || user.visitorsDirect !== undefined) && (
                <div style={{ padding: '10px 14px', background: 'var(--bg-app)', borderRadius: 10, gridColumn: 'span 2' }}>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>تفاصيل عداد الزوار (للتشخيص)</p>
                  <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 13 }}>
                    <span>stats.visitors: <strong>{formatNumber(user.visitorsStats ?? 0)}</strong></span>
                    <span>data.visitors: <strong>{formatNumber(user.visitorsDirect ?? 0)}</strong></span>
                  </div>
                </div>
              )}
              <InfoBox label="آخر دخول" value={user.lastLoginAt ? formatDate(user.lastLoginAt) : '—'} />
              <InfoBox label="IP آخر دخول" value={user.lastLoginIp || '—'} />
            </div>
            {user.bio ? (
              <p style={{ marginTop: 16, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {user.bio}
              </p>
            ) : null}
          </div>
        </div>
      )}

      {tab === 'sessions' && (
        <UserSessionsPanel user={user} sessions={loginSessions} />
      )}

      {tab === 'edit' && (
        <UserEditPanel user={user} canEdit={can('users:edit')} onSaved={load} onDeleted={() => navigate(adminPath('/users'))} />
      )}

      {tab === 'transactions' && (
        <TxTable rows={txs} empty="لا توجد معاملات" />
      )}

      {tab === 'withdrawals' && (
        <div className="card">
          {withdrawals.length === 0 ? <Empty text="لا توجد طلبات سحب" /> : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>النوع</th><th>المبلغ</th><th>صافي</th><th>الحالة</th><th>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((w) => {
                  const st = WD_STATUS[w.status] ?? { label: w.status, variant: 'gray' };
                  return (
                    <tr key={w.id}>
                      <td>{w.type === 'self' ? 'ذاتي' : w.type === 'agent' ? 'عبر وكيل' : w.type}</td>
                      <td style={{ fontWeight: 700 }}>{formatNumber(w.amount)}</td>
                      <td>{formatNumber(w.netAmount)}</td>
                      <td><Badge variant={st.variant as 'green'}>{st.label}</Badge></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{formatDate(w.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'gifts' && (
        <>
          <TxTable rows={giftTxs} empty="لا توجد هدايا مسجّلة" />
          {gameTxs.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-header"><h3>معاملات الألعاب</h3></div>
              <table className="data-table">
                <thead>
                  <tr><th>اللعبة</th><th>رهان</th><th>جائزة</th><th>التاريخ</th></tr>
                </thead>
                <tbody>
                  {gameTxs.map((g) => (
                    <tr key={g.id}>
                      <td>{g.gameId ?? '—'}</td>
                      <td style={{ color: 'var(--danger)' }}>{formatNumber(g.stake)}</td>
                      <td style={{ color: 'var(--success)' }}>{formatNumber(g.winAmount)}</td>
                      <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{timeAgo(g.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'titles' && (
        <div className="card">
          <div className="card-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Award size={18} /> الألقاب والأوسمة
            </h3>
          </div>
          <div className="card-body">
            {!user.userTitles?.owned?.length ? (
              <Empty text="لا يملك ألقاباً" />
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>اللقب</th><th>مُفعّل</th><th>تاريخ الحصول</th><th>ينتهي</th></tr>
                </thead>
                <tbody>
                  {user.userTitles.owned.map((o) => (
                    <tr key={o.titleId}>
                      <td style={{ fontWeight: 700 }}>{titleName(o.titleId)}</td>
                      <td>
                        {user.userTitles?.equipped?.includes(o.titleId)
                          ? <Badge variant="green">نعم</Badge>
                          : <Badge variant="gray">لا</Badge>}
                      </td>
                      <td>{formatDate(o.obtainedAt)}</td>
                      <td>{o.expiresAt ? formatDate(o.expiresAt) : 'دائم'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {notifyOpen && (
        <NotifyUserModal user={user} onClose={() => setNotifyOpen(false)} onSent={load} />
      )}
    </div>
  );
}

function StatMini({ icon, bg, value, label }: { icon: React.ReactNode; bg: string; value: string; label: string }) {
  return (
    <div className="stat-card">
      <div className="stat-card-icon" style={{ background: bg }}>{icon}</div>
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-label">{label}</div>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '12px 14px', background: 'var(--bg-app)', borderRadius: 10 }}>
      <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>{label}</p>
      <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 800 }}>{value}</p>
    </div>
  );
}

function TxTable({ rows, empty }: { rows: AdminTransaction[]; empty: string }) {
  if (rows.length === 0) return <div className="card"><Empty text={empty} /></div>;
  return (
    <div className="card table-wrap">
      <table className="data-table">
        <thead>
          <tr><th>النوع</th><th>المبلغ</th><th>العملة</th><th>الحالة</th><th>التاريخ</th></tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const pos = (t.amount ?? 0) >= 0;
            return (
              <tr key={t.id}>
                <td>
                  <p style={{ margin: 0, fontWeight: 600 }}>{txTypeLabel(t.type)}</p>
                  {t.itemName ? <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.itemName}</span> : null}
                </td>
                <td style={{ fontWeight: 700, color: pos ? 'var(--success)' : 'var(--danger)' }}>
                  {pos ? '+' : ''}{formatNumber(t.amount ?? 0)}
                </td>
                <td>{t.currency ?? '—'}</td>
                <td><Badge variant={t.status === 'completed' ? 'green' : 'gray'}>{t.status}</Badge></td>
                <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{timeAgo(t.createdAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function UserEditPanel({
  user, canEdit, onSaved, onDeleted,
}: {
  user: AdminUserFull;
  canEdit: boolean;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const { isSuper, can } = useAdminProfile();
  const [patch, setPatch] = useState<AdminUpdateAppUserPatch>({
    displayName: user.displayName,
    email: user.email ?? '',
    bio: user.bio ?? '',
    gender: (user.gender as 'male' | 'female') || 'female',
    country: user.country,
    birthYear: user.birthYear ?? 2000,
    coins: user.coins,
    pearls: user.pearls,
    casinoCoins: user.casinoCoins,
    level: user.level,
    followers: user.followers,
    following: user.following,
    isVIP: !!user.isVIP,
    isVerified: !!user.isVerified,
    isBanned: !!user.isBanned,
    withdrawalBlocked: !!user.withdrawalBlocked,
    vipLevel: user.vipLevel ?? 0,
    vipPoints: user.vipPoints ?? 0,
    vipPointsMonth: user.vipPointsMonth ?? 0,
  });
  const [addCoins, setAddCoins] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [managedPassword, setManagedPassword] = useState(user.adminManagedPassword ?? '');
  const [saving, setSaving] = useState(false);
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const { showSuccess, showError, ToastPortal } = useToast();
  const { confirmAsync, ConfirmPortal } = useConfirmDialog();

  useEffect(() => {
    setManagedPassword(user.adminManagedPassword ?? '');
  }, [user.adminManagedPassword, user.uid]);

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await adminUpdateAppUser(user.uid, patch);
      await logAdminAction('تعديل مستخدم', user.displayName, user.uid);
      onSaved();
      showSuccess('تم حفظ التعديلات');
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'فشل الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleAddCoins = async () => {
    const delta = Math.floor(Number(addCoins) || 0);
    if (delta <= 0) return showError('أدخل مبلغاً');
    if (!(await confirmAsync(`إضافة ${formatNumber(delta)} عملة؟`))) return;
    setSaving(true);
    try {
      const { newBalance } = await addUserBalance(user.uid, 'coins', delta);
      setPatch((p) => ({ ...p, coins: newBalance }));
      await logAdminAction('شحن عملات', user.displayName, `+${delta}`);
      onSaved();
      showSuccess(`تمت إضافة ${formatNumber(delta)} عملة`);
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'فشل');
    } finally {
      setSaving(false);
    }
  };

  const handleBan = async () => {
    if (!(await confirmAsync(`${user.isBanned ? 'إلغاء حظر' : 'حظر'} ${user.displayName}؟`))) return;
    try {
      await banUser(user.uid, !user.isBanned);
      await logAdminAction(user.isBanned ? 'إلغاء حظر' : 'حظر مستخدم', user.displayName, user.uid);
      onSaved();
      showSuccess(user.isBanned ? 'تم رفع الحظر' : 'تم حظر المستخدم');
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'فشل تنفيذ الإجراء');
    }
  };

  const handleUnsuspend = async () => {
    if (!(await confirmAsync(`رفع تعليق حساب ${user.displayName}؟`))) return;
    try {
      await unsuspendUser(user.uid);
    } catch (e) {
      showError('فشل رفع التعليق: ' + (e instanceof Error ? e.message : String(e)));
      return;
    }
    await logAdminAction('رفع تعليق مستخدم', user.displayName, user.uid);
    onSaved();
    showSuccess('تم رفع التعليق المؤقت');
  };

  const handleDelete = async () => {
    if (!(await confirmAsync(`حذف "${user.displayName}" نهائياً؟`))) return;
    setSaving(true);
    try {
      await adminDeleteAppUsers({ mode: 'selected', uids: [user.uid] });
      await logAdminAction('حذف مستخدم', user.displayName, user.uid);
      onDeleted();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'فشل الحذف');
    } finally {
      setSaving(false);
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let value = '';
    for (let i = 0; i < 8; i += 1) {
      value += chars[Math.floor(Math.random() * chars.length)];
    }
    setNewPassword(value);
    setShowNewPassword(true);
  };

  const handleSetPassword = async () => {
    const pwd = newPassword.trim();
    if (pwd.length < 6) {
      showError('كلمة المرور 6 أحرف على الأقل');
      return;
    }
    if (!(await confirmAsync('تعيين كلمة المرور الجديدة للمستخدم؟'))) return;
    setSaving(true);
    try {
      await adminSetAppUserPassword(user.uid, pwd);
      setManagedPassword(pwd);
      setNewPassword('');
      await logAdminAction('تعيين كلمة مرور مستخدم', user.displayName, user.uid);
      onSaved();
      showSuccess('تم تعيين كلمة المرور');
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'فشل تعيين كلمة المرور');
    } finally {
      setSaving(false);
    }
  };

  const copyPassword = async (value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      showSuccess('تم النسخ');
    } catch {
      showError('تعذّر النسخ');
    }
  };

  if (!canEdit) return <div className="card card-body"><p>لا تملك صلاحية التعديل</p></div>;

  return (
    <div className="card">
      {ToastPortal}
      {ConfirmPortal}
      <div className="card-body">
        <div
          style={{
            marginBottom: 20,
            padding: 16,
            borderRadius: 12,
            background: 'var(--bg-app)',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Lock size={18} color="var(--brand-primary)" />
            <h3 style={{ margin: 0, fontSize: 16 }}>كلمة المرور</h3>
          </div>

          {managedPassword ? (
            <div style={{ marginBottom: 14 }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text-muted)' }}>
                كلمة المرور المحفوظة من لوحة التحكم
                {user.adminPasswordUpdatedAt
                  ? ` · ${formatDate(user.adminPasswordUpdatedAt)}`
                  : ''}
              </p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  className="form-input"
                  style={{ maxWidth: 280, fontFamily: 'monospace' }}
                  type={showPassword ? 'text' : 'password'}
                  value={managedPassword}
                  readOnly
                />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPassword((v) => !v)}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void copyPassword(managedPassword)}>
                  <Copy size={16} />
                </button>
              </div>
            </div>
          ) : (
            <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-muted)' }}>
              لا توجد كلمة مرور محفوظة. إذا سجّل المستخدم بنفسه، لا يمكن عرض كلمة مروره — يمكنك تعيين كلمة جديدة أدناه.
            </p>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              className="form-input"
              style={{ maxWidth: 280 }}
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="كلمة مرور جديدة (6+ أحرف)"
            />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowNewPassword((v) => !v)}>
              {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={generatePassword}>
              <RefreshCw size={16} /> توليد
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void handleSetPassword()} disabled={saving}>
              تعيين كلمة المرور
            </button>
          </div>
        </div>

        <div className="form-grid">
          <label className="form-field">
            <span>الاسم</span>
            <input value={patch.displayName ?? ''} onChange={(e) => setPatch({ ...patch, displayName: e.target.value })} />
          </label>
          <label className="form-field">
            <span>البريد</span>
            <input value={patch.email ?? ''} onChange={(e) => setPatch({ ...patch, email: e.target.value })} />
          </label>
          <label className="form-field" style={{ gridColumn: '1 / -1' }}>
            <span>نبذة</span>
            <input value={patch.bio ?? ''} onChange={(e) => setPatch({ ...patch, bio: e.target.value })} />
          </label>
          <label className="form-field">
            <span>الجنس</span>
            <select
              className="form-input"
              value={patch.gender ?? 'male'}
              onChange={(e) => setPatch({ ...patch, gender: e.target.value as 'male' | 'female' })}
            >
              <option value="female">أنثى</option>
              <option value="male">ذكر</option>
            </select>
          </label>
          <label className="form-field">
            <span>سنة الميلاد</span>
            <input
              type="number"
              min={1950}
              max={new Date().getFullYear()}
              value={patch.birthYear ?? 2000}
              onChange={(e) => setPatch({ ...patch, birthYear: Number(e.target.value) })}
            />
          </label>
          <div className="form-field">
            <span>الدولة</span>
            <CountrySelect
              value={patch.country ?? 'PS'}
              onChange={(c) => setPatch({ ...patch, country: c })}
              label=""
            />
          </div>
          <label className="form-field">
            <span>عملات</span>
            <input type="number" value={patch.coins ?? 0} onChange={(e) => setPatch({ ...patch, coins: Number(e.target.value) })} />
          </label>
          <label className="form-field">
            <span>ماسات</span>
            <input type="number" value={patch.pearls ?? 0} onChange={(e) => setPatch({ ...patch, pearls: Number(e.target.value) })} />
          </label>
          <label className="form-field">
            <span>كازينو</span>
            <input type="number" value={patch.casinoCoins ?? 0} onChange={(e) => setPatch({ ...patch, casinoCoins: Number(e.target.value) })} />
          </label>
          <label className="form-field">
            <span>المستوى</span>
            <input type="number" value={patch.level ?? 1} onChange={(e) => setPatch({ ...patch, level: Number(e.target.value) })} />
          </label>
          <label className="form-field">
            <span>VIP level</span>
            <input type="number" value={patch.vipLevel ?? 0} onChange={(e) => setPatch({ ...patch, vipLevel: Number(e.target.value), isVIP: Number(e.target.value) >= 1 })} />
          </label>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 14 }}>
          {[
            { key: 'isVIP', label: 'VIP' },
            { key: 'isVerified', label: 'موثّق' },
            { key: 'isBanned', label: 'محظور' },
            { key: 'withdrawalBlocked', label: 'حظر سحب' },
          ].map((f) => (
            <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={!!(patch as Record<string, boolean>)[f.key]}
                onChange={(e) => setPatch({ ...patch, [f.key]: e.target.checked })}
              />
              {f.label}
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          <input className="form-input" type="number" style={{ maxWidth: 160 }} value={addCoins} onChange={(e) => setAddCoins(e.target.value)} placeholder="إضافة كوينز" />
          <button type="button" className="btn btn-gold" onClick={handleAddCoins} disabled={saving}>
            <Coins size={16} /> إضافة سريعة
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
          {(isSuper || canEdit) && (
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? '...' : 'حفظ التعديلات'}
            </button>
          )}
          {(isSuper || can('users:ban')) && (
            <button type="button" className="btn btn-ghost" onClick={handleBan}>
              <Ban size={16} /> {user.isBanned ? 'رفع الحظر الدائم' : 'حظر دائم'}
            </button>
          )}
          {(isSuper || can('users:ban')) && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => (user.isSuspended ? void handleUnsuspend() : setSuspendModalOpen(true))}
            >
              <Lock size={16} /> {user.isSuspended ? 'رفع التعليق المؤقت' : 'تعليق مؤقت'}
            </button>
          )}
          {(isSuper || can('users:delete')) && (
            <button type="button" className="btn" style={{ background: '#FEE2E2', color: '#B91C1C' }} onClick={handleDelete} disabled={saving}>
              <Trash2 size={16} /> حذف نهائي
            </button>
          )}
        </div>
      </div>

      {suspendModalOpen && (
        <SuspendUserModal
          user={user}
          onClose={() => setSuspendModalOpen(false)}
          onSaved={() => { setSuspendModalOpen(false); onSaved(); }}
        />
      )}
    </div>
  );
}

function UserSessionsPanel({
  user,
  sessions,
}: {
  user: AdminUserFull;
  sessions: AdminLoginSession[];
}) {
  const devices = user.registeredDevices ?? [];
  const suspiciousCount = sessions.filter((s) => s.flaggedSuspicious).length;
  const totalLogins = devices.reduce((n, d) => n + (d.loginCount ?? 0), 0);

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Globe2 size={18} color="var(--brand-primary)" />
            <span style={{ fontSize: 14 }}>استُخدم الحساب على <strong>{devices.length}</strong> جهاز{devices.length === 1 ? '' : 'ة'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Smartphone size={18} color="var(--brand-primary)" />
            <span style={{ fontSize: 14 }}>إجمالي مرات الدخول: <strong>{totalLogins || '—'}</strong></span>
          </div>
          {suspiciousCount > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={16} color="#EF4444" />
              <Badge variant="red">{suspiciousCount} تسجيل دخول مشبوه</Badge>
            </div>
          ) : null}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Smartphone size={18} /> آخر تسجيل دخول
          </h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <InfoBox label="التاريخ" value={user.lastLoginAt ? formatDate(user.lastLoginAt) : '—'} />
            <InfoBox label="طريقة الدخول" value={loginMethodLabel(user.lastLoginMethod)} />
            <InfoBox label="عنوان IP" value={user.lastLoginIp || '—'} />
            <InfoBox label="موقع الدخول" value={formatLocation(user.lastLoginLocation)} />
            <InfoBox label="الموقع المحفوظ (GPS)" value={formatLocation(user.location)} />
            <InfoBox label="الهاتف" value={user.phoneNumber || '—'} />
            <InfoBox label="البريد" value={user.email || '—'} />
          </div>
          <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            ملاحظة: iOS وAndroid لا يسمحان للتطبيق بقراءة IMEI الحقيقي. يُعرض «معرّف الجهاز» (Installation ID) كبديل تقني.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Globe2 size={18} /> الأجهزة المسجّلة ({devices.length})
          </h3>
        </div>
        {devices.length === 0 ? (
          <Empty text="لا توجد أجهزة مسجّلة بعد — سيظهر بعد أول تسجيل دخول بعد التحديث" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>الجهاز</th>
                  <th>النظام</th>
                  <th>معرّف الجهاز</th>
                  <th>آخر IP</th>
                  <th>الاتصال</th>
                  <th>الموقع</th>
                  <th>مرات الدخول</th>
                  <th>آخر نشاط</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d: AdminRegisteredDevice) => {
                  const isCurrent = !!user.lastLoginDeviceId && d.id === user.lastLoginDeviceId;
                  return (
                  <tr key={d.id} style={isCurrent ? { background: 'rgba(16,185,129,0.06)' } : undefined}>
                    <td>
                      <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {d.name || '—'}
                        {isCurrent ? <Badge variant="green">الجهاز الحالي</Badge> : null}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {d.brand} {d.model}
                      </div>
                    </td>
                    <td>{d.platform} {d.osVersion ? `(${d.osVersion})` : ''}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, maxWidth: 180, wordBreak: 'break-all' }}>
                      {d.deviceIdentifier || d.id}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{d.lastIp || '—'}</td>
                    <td>
                      {d.connectionType ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                          <Wifi size={13} /> {d.connectionType}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ fontSize: 12, maxWidth: 200 }}>{formatLocation(d.lastLocation)}</td>
                    <td>{d.loginCount ?? '—'}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{timeAgo(d.lastActiveAt)}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={18} /> سجل جلسات الدخول ({sessions.length})
          </h3>
        </div>
        {sessions.length === 0 ? (
          <Empty text="لا يوجد سجل دخول — سيُسجَّل تلقائياً عند تسجيل الدخول القادم" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>الطريقة</th>
                  <th>IP</th>
                  <th>الجهاز</th>
                  <th>معرّف الجهاز</th>
                  <th>الموقع</th>
                  <th>إصدار التطبيق</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} style={s.flaggedSuspicious ? { background: 'rgba(239,68,68,0.06)' } : undefined}>
                    <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{formatDate(s.createdAt)}</td>
                    <td>{loginMethodLabel(s.method)}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{s.ip || '—'}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.deviceName || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {s.brand} {s.model} · {s.platform} {s.osVersion}
                        {s.connectionType ? ` · ${s.connectionType}` : ''}
                      </div>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, maxWidth: 160, wordBreak: 'break-all' }}>
                      {s.deviceIdentifier || s.deviceId}
                    </td>
                    <td style={{ fontSize: 12, maxWidth: 200 }}>{formatLocation(s.location)}</td>
                    <td style={{ fontSize: 12 }}>{s.appVersion || '—'}</td>
                    <td>
                      {s.flaggedSuspicious ? (
                        <Badge variant="red">
                          <AlertTriangle size={11} style={{ display: 'inline', marginInlineEnd: 3 }} />
                          مشبوه
                        </Badge>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
