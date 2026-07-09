import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { adminPath } from '@/lib/adminPaths';
import {
  ArrowRight, Building2, Users, Crown, Star, BadgeCheck, ShieldCheck, Trash2,
  Coins, Gem, DollarSign, UserMinus, Ban, ExternalLink, Pencil, Hash, Calendar,
  Download, TrendingUp, ArrowDownToLine, Gift, Phone, X, Clock, ArrowLeftRight, UserPlus, Search, Mic,
} from 'lucide-react';
import { Loading, Empty, Badge } from '@/components/Common';
import {
  getAgencyFullDetail, getAgencyMembersDetailed, getAgencyEarningsActivity,
  getAgencyWithdrawals, getMemberTransactions,
  getAgencyAdminAnalytics, getAgencyRefundsAdmin,
  setAgencyMemberPearlsEarned, removeAgencyMember, updateAgencyInfo,
  assignAgencyMember, getUserById, resolveUserActiveAgencyId,
  toggleAgencyVerified, deleteAgency, adjustBalance, banUser, logAdminAction,
  setAgencyMaxSeatsCount, AGENCY_SEAT_OPTIONS,
  setAgencyPeriodLevel, clearAgencyPeriodLevelOverride,
  AGENCY_LEVEL_OPTIONS, AGENCY_THRONE_UNLOCK_LEVEL,
  getAgencySeatRequests, reviewAgencySeatRequest,
  formatNumber, timeAgo, exportToCSV,
  type AgencyFullDetail, type AgencyMemberDetailed, type AgencyActivity,
  type AgencyWithdrawal, type AdminTransaction, type AdminUser,
  type AgencyAdminAnalytics, type AgencyRefundAdminRow,
  type AgencyAdminIncomeFilter,   type AdminAgencySeatRequest,
} from '@/services/admin';
import { useAdminAlerts } from '@/contexts/AdminAlertsContext';
import AgencyPartyManager from '@/components/AgencyPartyManager';

const TX_LABEL: Record<string, string> = {
  gift_received: 'هدية مستلمة', gift_sent: 'هدية مُرسلة',
  call_earning: 'أرباح مكالمة', call_spent: 'مكالمة مدفوعة',
  transfer_received: 'تحويل وارد', transfer_sent: 'تحويل صادر',
  treasure_won: 'كنز', seat_fee_received: 'رسوم مقعد',
  lucky_bag_won: 'حقيبة حظ', locked_media_earn: 'وسائط مقفلة',
  recharge: 'شحن', withdraw: 'سحب', purchase: 'شراء', agent_collected: 'تحصيل وكيل',
};
const txLabel = (t: string) => TX_LABEL[t] ?? t;

const ASSIGN_ERRORS: Record<string, string> = {
  USER_NOT_FOUND: 'لم يُعثر على المستخدم — تحقق من المعرّف أو UID',
  AGENCY_NOT_FOUND: 'الوكالة غير موجودة',
  USER_IN_OTHER_AGENCY: 'المستخدم مرتبط بوكالة أخرى — أزلّه منها أولاً',
  USER_IS_AGENCY_OWNER: 'هذا المستخدم هو مالك الوكالة',
};

function assignErrorMessage(code: string): string {
  return ASSIGN_ERRORS[code] ?? code;
}

const WD_STATUS: Record<string, { label: string; variant: string }> = {
  pending: { label: 'قيد المراجعة', variant: 'gold' },
  approved: { label: 'معتمد', variant: 'blue' },
  completed: { label: 'مكتمل', variant: 'green' },
  rejected: { label: 'مرفوض', variant: 'red' },
};

function roleLabel(m: AgencyMemberDetailed): { label: string; variant: string } {
  if (m.role === 'owner') return { label: 'المالك', variant: 'gold' };
  if (m.role === 'agent') return { label: 'وكيل', variant: 'purple' };
  if (m.isFemaleHost) return { label: 'مضيفة موثّقة', variant: 'pink' };
  if (m.role === 'host') return { label: 'مضيف', variant: 'blue' };
  return { label: 'عضو', variant: 'gray' };
}

export default function AgencyDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { refresh: refreshAlerts } = useAdminAlerts();
  const [agency, setAgency] = useState<AgencyFullDetail | null>(null);
  const [members, setMembers] = useState<AgencyMemberDetailed[]>([]);
  const [activity, setActivity] = useState<AgencyActivity | null>(null);
  const [withdrawals, setWithdrawals] = useState<AgencyWithdrawal[]>([]);
  const [adminAnalytics, setAdminAnalytics] = useState<AgencyAdminAnalytics | null>(null);
  const [refunds, setRefunds] = useState<AgencyRefundAdminRow[]>([]);
  const [incomeFilter, setIncomeFilter] = useState<AgencyAdminIncomeFilter>('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<AgencyMemberDetailed | null>(null);
  const [showAssignHost, setShowAssignHost] = useState(false);
  const [seatRequests, setSeatRequests] = useState<AdminAgencySeatRequest[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [a, m] = await Promise.all([
      getAgencyFullDetail(id),
      getAgencyMembersDetailed(id),
    ]);
    setAgency(a);
    setMembers(m);
    const [act, wd, analytics, refundList, pendingSeatRequests] = await Promise.all([
      getAgencyEarningsActivity(m.map((x) => ({ uid: x.uid, displayName: x.displayName }))),
      getAgencyWithdrawals(id),
      getAgencyAdminAnalytics(id, 'week', incomeFilter).catch(() => null),
      getAgencyRefundsAdmin(id).catch(() => []),
      getAgencySeatRequests(id, 'pending').catch(() => []),
    ]);
    setActivity(act);
    setWithdrawals(wd);
    setAdminAnalytics(analytics);
    setRefunds(refundList);
    setSeatRequests(pendingSeatRequests);
    setLoading(false);
  }, [id, incomeFilter]);

  useEffect(() => { load(); }, [load]);

  // ===== إجماليات =====
  const totalEarned = members.reduce((s, m) => s + m.pearlsEarned, 0);
  const totalTransferred = members.reduce((s, m) => s + m.pearlsTransferredToAgent, 0);
  const totalAvailable = members.reduce((s, m) => s + m.availablePearls, 0);
  const totalCoins = members.reduce((s, m) => s + m.coins, 0);
  const totalPearls = members.reduce((s, m) => s + m.pearls, 0);
  const femaleHosts = members.filter((m) => m.isFemaleHost).length;
  const agents = members.filter((m) => m.role === 'agent' || m.role === 'owner').length;
  const wdCompleted = withdrawals.filter((w) => w.status === 'completed').reduce((s, w) => s + w.amount, 0);
  const wdPending = withdrawals.filter((w) => w.status === 'pending').length;

  // ===== تحكّم على الوكالة =====
  const handleVerify = async () => {
    if (!agency) return;
    setBusy('agency');
    try {
      await toggleAgencyVerified(agency.id, !agency.isVerified);
      await logAdminAction(agency.isVerified ? 'إلغاء توثيق وكالة' : 'توثيق وكالة', agency.name, agency.id);
      await load();
    } finally { setBusy(null); }
  };

  const handleEditInfo = async () => {
    if (!agency) return;
    const name = prompt('اسم الوكالة:', agency.name);
    if (name === null) return;
    const minStr = prompt('الحد الأدنى للمضيفات المطلوب:', String(agency.minHostsRequired));
    if (minStr === null) return;
    setBusy('agency');
    try {
      await updateAgencyInfo(agency.id, { name, minHostsRequired: Number(minStr) || 0 });
      await logAdminAction('تعديل بيانات وكالة', name, agency.id);
      await load();
    } finally { setBusy(null); }
  };

  const handleSetMaxSeats = async (maxSeatsCount: typeof AGENCY_SEAT_OPTIONS[number]) => {
    if (!agency) return;
    const applyNow =
      maxSeatsCount > (agency.maxSeatsCount ?? 9) &&
      confirm(`تفعيل ${maxSeatsCount} مايك للوكالة "${agency.name}"؟\n\nاضغط OK لتطبيق العدد مباشرة على غرفة الوكالة، أو Cancel لرفع الحد فقط (يختار الوكيل العدد من التطبيق).`);
    setBusy('seats');
    try {
      await setAgencyMaxSeatsCount(
        agency.id,
        maxSeatsCount,
        applyNow ? { applySeatsToLiveRoom: maxSeatsCount } : undefined,
      );
      await logAdminAction(
        applyNow ? 'تفعيل وتطبيق عدد المايكات' : 'رفع حد عدد المايكات',
        `${agency.name} → ${maxSeatsCount}`,
        agency.id,
      );
      await load();
      alert(applyNow
        ? `تم تفعيل ${maxSeatsCount} مايك وتطبيقها على غرفة الوكالة.`
        : `تم رفع الحد إلى ${maxSeatsCount} مايك — يمكن للوكيل اختيار العدد من إعدادات الغرفة.`);
    } catch (e: any) {
      alert('فشل: ' + (e?.message ?? 'خطأ'));
    } finally { setBusy(null); }
  };

  const handleSetPeriodLevel = async (level: number) => {
    if (!agency) return;
    if (
      !confirm(
        `تعيين مستوى الوكالة "${agency.name}" إلى L${level}؟\n\n` +
          (level >= AGENCY_THRONE_UNLOCK_LEVEL
            ? 'المستوى 15 يفتح كرسي العرش في الغرفة.'
            : 'المستويات أقل من 15 تُعطّل العرش إن كان مفعّلاً.'),
      )
    ) {
      return;
    }
    setBusy('level');
    try {
      await setAgencyPeriodLevel(agency.id, level);
      await load();
      alert(`تم تعيين المستوى إلى L${level}.`);
    } catch (e: any) {
      alert('فشل: ' + (e?.message ?? 'خطأ'));
    } finally { setBusy(null); }
  };

  const handleClearPeriodLevelOverride = async () => {
    if (!agency) return;
    if (!confirm('إلغاء التعديل اليدوي والعودة للحساب التلقائي من أرباح الأسبوع؟')) return;
    setBusy('level');
    try {
      await clearAgencyPeriodLevelOverride(agency.id);
      await load();
      alert('تم إلغاء التعديل اليدوي — سيُحدَّث المستوى تلقائياً عند دخول الغرفة.');
    } catch (e: any) {
      alert('فشل: ' + (e?.message ?? 'خطأ'));
    } finally { setBusy(null); }
  };

  const handleReviewSeatRequest = async (
    req: AdminAgencySeatRequest,
    action: 'approve' | 'reject',
  ) => {
    if (action === 'approve') {
      const applyNow = confirm(
        `الموافقة على طلب ${req.requestedSeatsCount} مايك من "${req.requesterName}"؟\n\nOK = رفع الحد وتطبيق العدد على الغرفة\nCancel = رفع الحد فقط`,
      );
      setBusy(`seat-req-${req.id}`);
      try {
        await reviewAgencySeatRequest(req.id, 'approve', { applyToRoom: applyNow });
        await load();
        alert(applyNow
          ? `تمت الموافقة وتطبيق ${req.requestedSeatsCount} مايك على الغرفة.`
          : `تمت الموافقة — الحد الآن ${req.requestedSeatsCount} مايك.`);
      } catch (e: any) {
        alert('فشل: ' + (e?.message ?? 'خطأ'));
      } finally { setBusy(null); }
      return;
    }
    const reason = prompt('سبب الرفض (اختياري):') ?? '';
    setBusy(`seat-req-${req.id}`);
    try {
      await reviewAgencySeatRequest(req.id, 'reject', { rejectionReason: reason });
      await load();
    } catch (e: any) {
      alert('فشل: ' + (e?.message ?? 'خطأ'));
    } finally { setBusy(null); }
  };

  const handleDeleteAgency = async () => {
    if (!agency) return;
    if (!confirm(`حذف وكالة "${agency.name}" نهائياً؟ لا يمكن التراجع.`)) return;
    setBusy('agency');
    try {
      await deleteAgency(agency.id);
      await logAdminAction('حذف وكالة', agency.name, agency.id);
      navigate(adminPath('/agencies'));
    } finally { setBusy(null); }
  };

  // ===== تحكّم على الأعضاء =====
  const editCoins = async (m: AgencyMemberDetailed) => {
    const v = prompt(`رصيد عملات "${m.displayName}":`, String(m.coins));
    if (v === null) return;
    const n = Number(v);
    if (Number.isNaN(n) || n < 0) return alert('قيمة غير صالحة');
    setBusy(m.id);
    try {
      await adjustBalance(m.uid, 'coins', n);
      await logAdminAction('تعديل عملات عضو وكالة', m.displayName, `${m.coins} ← ${n}`);
      await load();
    } finally { setBusy(null); }
  };

  const editPearls = async (m: AgencyMemberDetailed) => {
    const v = prompt(`رصيد ماسة المحفظة "${m.displayName}":`, String(m.pearls));
    if (v === null) return;
    const n = Number(v);
    if (Number.isNaN(n) || n < 0) return alert('قيمة غير صالحة');
    setBusy(m.id);
    try {
      await adjustBalance(m.uid, 'pearls', n);
      await logAdminAction('تعديل ماسة عضو وكالة', m.displayName, `${m.pearls} ← ${n}`);
      await load();
    } finally { setBusy(null); }
  };

  const editEarnings = async (m: AgencyMemberDetailed) => {
    const v = prompt(`الأرباح المستلمة (الراتب) لـ "${m.displayName}":`, String(m.pearlsEarned));
    if (v === null) return;
    const n = Number(v);
    if (Number.isNaN(n) || n < 0) return alert('قيمة غير صالحة');
    setBusy(m.id);
    try {
      await setAgencyMemberPearlsEarned(m.id, n, id);
      await logAdminAction('تعديل أرباح عضو وكالة', m.displayName, `${m.pearlsEarned} ← ${n}`);
      await load();
    } finally { setBusy(null); }
  };

  const handleBan = async (m: AgencyMemberDetailed) => {
    if (!confirm(`${m.isBanned ? 'فك حظر' : 'حظر'} "${m.displayName}"؟`)) return;
    setBusy(m.id);
    try {
      await banUser(m.uid, !m.isBanned);
      await logAdminAction(m.isBanned ? 'فك حظر عضو' : 'حظر عضو', m.displayName, m.uid);
      await load();
    } finally { setBusy(null); }
  };

  const handleRemove = async (m: AgencyMemberDetailed) => {
    if (!agency) return;
    if (m.role === 'owner') return alert('لا يمكن إزالة مالك الوكالة من هنا — احذف الوكالة بدلاً من ذلك.');
    if (!confirm(`إزالة "${m.displayName}" من الوكالة؟ سيُفكّ ارتباطه بالوكالة.`)) return;
    setBusy(m.id);
    try {
      await removeAgencyMember(m.id, m.uid, agency.id, m.isFemaleHost);
      await logAdminAction('إزالة عضو من وكالة', m.displayName, `${agency.name}`);
      await load();
    } finally { setBusy(null); }
  };

  const exportMembers = () => {
    exportToCSV(
      members.map((m) => ({
        المعرف: m.uid, الاسم: m.displayName, الدور: roleLabel(m).label,
        عملات: m.coins, ماسة_المحفظة: m.pearls, الأرباح: m.pearlsEarned,
        محوّل_للوكيل: m.pearlsTransferredToAgent, متاح_للسحب: m.availablePearls,
        الدولة: m.country, المستوى: m.level, محظور: m.isBanned ? 'نعم' : 'لا',
        تاريخ_الانضمام: m.joinedAt ? new Date(m.joinedAt).toLocaleDateString('ar') : '',
      })),
      `agency_${agency?.name ?? id}_members`,
    );
  };

  if (loading) return <div className="page-container"><Loading /></div>;
  if (!agency) return (
    <div className="page-container">
      <Link to={adminPath('/agencies')} className="btn-secondary" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', marginBottom: 16, textDecoration: 'none' }}>
        <ArrowRight size={18} /> رجوع للوكالات
      </Link>
      <Empty text="الوكالة غير موجودة" />
    </div>
  );

  const maxWeekly = Math.max(1, ...(activity?.weekly.map((w) => w.total) ?? [1]));

  return (
    <div className="page-container">
      <Link to={adminPath('/agencies')} className="btn-secondary" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', marginBottom: 16, textDecoration: 'none' }}>
        <ArrowRight size={18} /> رجوع للوكالات
      </Link>

      {/* ===== رأس الوكالة ===== */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div className="stat-card-icon" style={{ width: 56, height: 56, margin: 0, background: 'rgba(225,18,18,0.12)' }}>
            <Building2 size={28} color="#e11212" />
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              {agency.name}
              {agency.isVerified && <BadgeCheck size={20} color="#b00814" />}
              <Badge variant={agency.status === 'active' ? 'green' : 'gray'}>{agency.status}</Badge>
            </h2>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8, color: 'var(--text-muted)', fontSize: 13 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Crown size={14} /> {agency.ownerName}</span>
              <span>🌍 {agency.country}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Hash size={13} /> {agency.inviteCode || '—'}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Star size={13} color="#FCD34D" fill="#FCD34D" /> {agency.rating}</span>
              <span>المطلوب: {agency.femaleHostCount}/{agency.minHostsRequired} مضيفة</span>
              {agency.createdAt > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Calendar size={13} /> {new Date(agency.createdAt).toLocaleDateString('ar')}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn-secondary" onClick={handleEditInfo} disabled={busy === 'agency'} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <Pencil size={16} /> تعديل
            </button>
            <button className="btn-secondary" onClick={handleVerify} disabled={busy === 'agency'} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', color: agency.isVerified ? '#b00814' : undefined }}>
              <ShieldCheck size={16} /> {agency.isVerified ? 'إلغاء التوثيق' : 'توثيق'}
            </button>
            <button className="btn btn-danger" onClick={handleDeleteAgency} disabled={busy === 'agency'} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <Trash2 size={16} /> حذف
            </button>
          </div>
        </div>
      </div>

      {/* ===== عدد المايكات ===== */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Mic size={18} color="#e11212" /> عدد المايكات في غرفة الوكالة
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 0, marginBottom: 12 }}>
          الحد الحالي: <strong>{agency.maxSeatsCount ?? 9}</strong> مايك
          {agency.liveRoomId ? ` — غرفة: ${agency.liveRoomId.slice(0, 8)}…` : ' — لا توجد غرفة مباشرة بعد'}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[...AGENCY_SEAT_OPTIONS].reverse().map((n) => {
            const active = (agency.maxSeatsCount ?? 9) === n;
            return (
              <button
                key={n}
                type="button"
                className={active ? 'btn-primary' : 'btn-secondary'}
                disabled={busy === 'seats'}
                onClick={() => void handleSetMaxSeats(n)}
                style={{ minWidth: 52 }}
              >
                {n}
              </button>
            );
          })}
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 0, marginTop: 10 }}>
          عند رفع العدد يمكنك تطبيقه مباشرة على الغرفة أو ترك الوكيل يختار من إعدادات التطبيق ثم «حفظ».
        </p>
      </div>

      {/* ===== مستوى الوكالة ===== */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={18} color="#059669" /> مستوى الوكالة (فترة الأسبوع)
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 0, marginBottom: 12 }}>
          المستوى الحالي:{' '}
          <strong>L{agency.periodLevel ?? agency.appliedPeriodLevel ?? '—'}</strong>
          {agency.periodLevelManual ? (
            <span style={{ marginInlineStart: 8 }}>
              <Badge variant="gold">تعديل يدوي</Badge>
            </span>
          ) : null}
          {agency.appliedPeriodLevel != null && agency.liveRoomId ? (
            <span style={{ marginInlineStart: 8 }}>
              — مطبّق على الغرفة: L{agency.appliedPeriodLevel}
            </span>
          ) : null}
          {!agency.liveRoomId ? ' — لا توجد غرفة مباشرة بعد' : null}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {AGENCY_LEVEL_OPTIONS.map((n) => {
            const current = agency.periodLevel ?? agency.appliedPeriodLevel ?? 0;
            const active = current === n;
            return (
              <button
                key={n}
                type="button"
                className={active ? 'btn-primary' : 'btn-secondary'}
                disabled={busy === 'level'}
                onClick={() => void handleSetPeriodLevel(n)}
                style={{ minWidth: 44 }}
              >
                {n}
              </button>
            );
          })}
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 0, marginTop: 10 }}>
          المستوى {AGENCY_THRONE_UNLOCK_LEVEL} يفتح كرسي العرش في غرفة الوكالة.
          {agency.periodLevelManual ? (
            <>
              {' '}
              <button
                type="button"
                disabled={busy === 'level'}
                onClick={() => void handleClearPeriodLevelOverride()}
                style={{
                  padding: 0,
                  fontSize: 12,
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                إلغاء التعديل اليدوي
              </button>
            </>
          ) : null}
        </p>
      </div>

      {seatRequests.length > 0 ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={18} color="#F59E0B" /> طلبات زيادة المايكات
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {seatRequests.map((req) => (
              <div
                key={req.id}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: 12,
                  borderRadius: 12,
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {req.requesterName} — طلب {req.requestedSeatsCount} مايك
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                    الحالي: {req.currentSeatsCount} مايك · الحد: {req.currentMaxSeats} · {timeAgo(req.createdAt)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busy === `seat-req-${req.id}`}
                    onClick={() => void handleReviewSeatRequest(req, 'approve')}
                  >
                    موافقة
                  </button>
                  <button
                    type="button"
                    className="btn-danger"
                    disabled={busy === `seat-req-${req.id}`}
                    onClick={() => void handleReviewSeatRequest(req, 'reject')}
                  >
                    رفض
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <AgencyPartyManager
        agencyId={agency.id}
        liveRoomId={agency.liveRoomId}
        onChanged={() => { void refreshAlerts(); }}
      />

      {/* ===== الإجماليات المالية الموسّعة ===== */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <StatMini icon={<Users size={22} color="#b00814" />} bg="rgba(176,8,20,0.12)" value={`${members.length}`} label={`الأعضاء (${femaleHosts} مضيفة · ${agents} وكيل)`} />
        <StatMini icon={<DollarSign size={22} color="#10B981" />} bg="rgba(16,185,129,0.12)" value={formatNumber(totalEarned)} label="إجمالي الأرباح/الهدايا" />
        <StatMini icon={<ArrowLeftRight size={22} color="#F59E0B" />} bg="rgba(245,158,11,0.12)" value={formatNumber(totalTransferred)} label="محوّل للوكيل" />
        <StatMini icon={<Gem size={22} color="#e11212" />} bg="rgba(225,18,18,0.12)" value={formatNumber(totalAvailable)} label="ماسة متاح للسحب" />
        <StatMini icon={<Coins size={22} color="#F59E0B" />} bg="rgba(252,211,77,0.18)" value={formatNumber(totalCoins)} label="إجمالي عملات المحافظ" />
        <StatMini icon={<Gem size={22} color="#d21e2a" />} bg="rgba(210,30,42,0.12)" value={formatNumber(totalPearls)} label="إجمالي ماسة المحافظ" />
        <StatMini icon={<ArrowDownToLine size={22} color="#10B981" />} bg="rgba(16,185,129,0.12)" value={formatNumber(wdCompleted)} label="سحوبات مكتملة" />
        <StatMini icon={<Clock size={22} color="#EF4444" />} bg="rgba(239,68,68,0.12)" value={`${wdPending}`} label="سحوبات معلّقة" />
      </div>

      {/* ===== رسم الأرباح الأسبوعي ===== */}
      {activity && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={18} /> أرباح آخر 7 أيام
            <span style={{ marginInlineStart: 'auto', color: 'var(--success)', fontSize: 15 }}>{formatNumber(activity.totalLast7d)} ماسة</span>
          </h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 140, paddingTop: 16 }}>
            {activity.weekly.map((w, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>{w.total > 0 ? formatNumber(w.total) : ''}</span>
                <div style={{
                  width: '70%', borderRadius: '6px 6px 0 0',
                  height: `${Math.max(2, (w.total / maxWeekly) * 100)}%`,
                  background: 'linear-gradient(180deg, #e11212, #d21e2a)',
                }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{w.day}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {adminAnalytics && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={18} /> خط بيانات المضيفين (من السيرفر)
            <span style={{ marginInlineStart: 'auto', color: 'var(--success)', fontSize: 15 }}>
              {formatNumber(adminAnalytics.total)} ماسة
            </span>
          </h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {(['all', 'chat', 'gifts', 'calls', 'refund', 'other'] as AgencyAdminIncomeFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                className={incomeFilter === f ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '4px 10px', fontSize: 12 }}
                onClick={() => setIncomeFilter(f)}
              >
                {{ all: 'الكل', chat: 'دردشة', gifts: 'هدايا', calls: 'مكالمات', refund: 'استرداد', other: 'أخرى' }[f]}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 140, paddingTop: 8 }}>
            {adminAnalytics.series.map((w, i) => {
              const max = Math.max(1, ...adminAnalytics.series.map((x) => x.value));
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>{w.value > 0 ? formatNumber(w.value) : ''}</span>
                  <div style={{
                    width: '70%', borderRadius: '6px 6px 0 0',
                    height: `${Math.max(2, (w.value / max) * 100)}%`,
                    background: 'linear-gradient(180deg, #e11e2a, #FFB4D0)',
                  }} />
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{w.label}</span>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
            اليوم: {formatNumber(adminAnalytics.todayTotal)} ماسة — أعلى المضيفين في الفترة:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            {adminAnalytics.hosts.slice(0, 6).map((h) => (
              <span key={h.uid} className="badge" style={{ background: 'rgba(225,18,18,0.1)', color: '#e11212', fontSize: 12 }}>
                {h.name}: {formatNumber(h.earnings)}
              </span>
            ))}
          </div>
        </div>
      )}

      {refunds.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Gift size={18} /> استردادات الوكيل للداعمين ({refunds.length})
          </h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>المضيف</th><th>الداعم</th><th>المبلغ</th><th>السبب</th><th>التاريخ</th></tr>
              </thead>
              <tbody>
                {refunds.slice(0, 20).map((r) => (
                  <tr key={r.id}>
                    <td>{r.hostName}</td>
                    <td>{r.supporterName}</td>
                    <td><Gem size={13} color="#e11212" style={{ display: 'inline', verticalAlign: 'middle' }} /> {formatNumber(r.amount)}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.reason || '—'}</td>
                    <td style={{ fontSize: 12 }}>{r.createdAt ? timeAgo(r.createdAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== جدول الأعضاء ===== */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <Users size={18} /> أعضاء الوكالة ({members.length})
          </h3>
          <button
            className="btn-primary"
            onClick={() => setShowAssignHost(true)}
            style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}
          >
            <UserPlus size={15} /> ربط مضيف
          </button>
          <button className="btn-secondary" onClick={exportMembers} style={{ marginInlineStart: 'auto', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <Download size={15} /> تصدير CSV
          </button>
        </div>
        {members.length === 0 ? <Empty text="لا يوجد أعضاء" /> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>العضو</th><th>الدور</th><th>عملات</th><th>ماسة المحفظة</th>
                  <th>الأرباح</th><th>محوّل</th><th>متاح</th><th>آخر ظهور</th><th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const r = roleLabel(m);
                  return (
                    <tr key={m.id} style={{ cursor: 'pointer', ...(m.isBanned ? { opacity: 0.55 } : {}) }} onClick={() => setSelected(m)}>
                      <td>
                        <div className="table-user">
                          <img src={m.avatar || `https://i.pravatar.cc/80?u=${m.uid}`} alt="" style={{ borderRadius: '50%' }} />
                          <div className="table-user-info">
                            <p>{m.displayName} {m.isBanned && <Ban size={12} color="#EF4444" style={{ display: 'inline' }} />}</p>
                            <span>{m.uid.slice(0, 12)}</span>
                          </div>
                        </div>
                      </td>
                      <td><Badge variant={r.variant}>{r.label}</Badge></td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button className="link-btn" onClick={() => editCoins(m)} disabled={busy === m.id} title="تعديل العملات">
                          <Coins size={13} color="#F59E0B" /> {formatNumber(m.coins)}
                        </button>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button className="link-btn" onClick={() => editPearls(m)} disabled={busy === m.id} title="تعديل ماسة المحفظة">
                          <Gem size={13} color="#e11212" /> {formatNumber(m.pearls)}
                        </button>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button className="link-btn" onClick={() => editEarnings(m)} disabled={busy === m.id} title="تعديل الأرباح" style={{ fontWeight: 700 }}>
                          <DollarSign size={13} color="#10B981" /> {formatNumber(m.pearlsEarned)}
                        </button>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{formatNumber(m.pearlsTransferredToAgent)}</td>
                      <td style={{ fontWeight: 700 }}>{formatNumber(m.availablePearls)}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{m.lastSeen ? timeAgo(m.lastSeen) : '—'}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Link className="action-icon" to={`/users?q=${m.uid}`} title="فتح الملف">
                            <ExternalLink size={15} />
                          </Link>
                          <button className="action-icon" onClick={() => handleBan(m)} disabled={busy === m.id} title={m.isBanned ? 'فك الحظر' : 'حظر'} style={{ color: m.isBanned ? '#10B981' : '#F59E0B' }}>
                            <Ban size={15} />
                          </button>
                          {m.role !== 'owner' && (
                            <button className="action-icon delete" onClick={() => handleRemove(m)} disabled={busy === m.id} title="إزالة من الوكالة">
                              <UserMinus size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* ===== سجل النشاط (هدايا/أرباح) ===== */}
        <div className="card">
          <h3 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Gift size={18} /> آخر الهدايا والأرباح
          </h3>
          {!activity || activity.recent.length === 0 ? <Empty text="لا يوجد نشاط" /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 420, overflowY: 'auto' }}>
              {activity.recent.map((tx) => (
                <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 6px', borderBottom: '1px solid var(--border, #eee)' }}>
                  <div className="stat-card-icon" style={{ width: 32, height: 32, margin: 0, background: tx.type === 'call_earning' ? 'rgba(176,8,20,0.12)' : 'rgba(210,30,42,0.12)' }}>
                    {tx.type === 'call_earning' ? <Phone size={15} color="#b00814" /> : <Gift size={15} color="#d21e2a" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{tx.memberName}</p>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{txLabel(tx.type)}{tx.callType ? ` · ${tx.callType === 'video' ? 'فيديو' : 'صوت'}` : ''} · {timeAgo(tx.createdAt)}</span>
                  </div>
                  <span style={{ fontWeight: 700, color: 'var(--success)' }}>+{formatNumber(tx.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ===== سحوبات الوكالة ===== */}
        <div className="card">
          <h3 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ArrowDownToLine size={18} /> سحوبات الوكالة ({withdrawals.length})
          </h3>
          {withdrawals.length === 0 ? <Empty text="لا توجد سحوبات" /> : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>العضو</th><th>المبلغ</th><th>النوع</th><th>الحالة</th><th>التاريخ</th></tr></thead>
                <tbody>
                  {withdrawals.map((w) => {
                    const s = WD_STATUS[w.status] ?? { label: w.status, variant: 'gray' };
                    return (
                      <tr key={w.id}>
                        <td style={{ fontSize: 13 }}>{w.uidName}</td>
                        <td style={{ fontWeight: 700 }}>{formatNumber(w.amount)}</td>
                        <td style={{ fontSize: 12 }}>{w.type === 'self' ? 'ذاتي' : 'عبر وكيل'}</td>
                        <td><Badge variant={s.variant}>{s.label}</Badge></td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{w.createdAt ? timeAgo(w.createdAt) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selected && <MemberModal member={selected} onClose={() => setSelected(null)} />}

      {showAssignHost && agency && (
        <AssignHostModal
          agencyId={agency.id}
          agencyName={agency.name}
          onClose={() => setShowAssignHost(false)}
          onSuccess={async (result) => {
            await logAdminAction(
              result.alreadyMember ? 'ترقية عضو وكالة لمضيفة' : 'ربط مضيف بوكالة',
              result.displayName,
              `${agency.name} · ID ${result.publicAccountId}`,
            );
            setShowAssignHost(false);
            await load();
          }}
        />
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

// ===== نافذة تفاصيل العضو (آخر معاملاته) =====
function MemberModal({ member, onClose }: { member: AgencyMemberDetailed; onClose: () => void }) {
  const [tx, setTx] = useState<AdminTransaction[] | null>(null);
  useEffect(() => {
    getMemberTransactions(member.uid, 30).then(setTx);
  }, [member.uid]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h3>تفاصيل العضو</h3>
          <button className="action-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <img src={member.avatar || `https://i.pravatar.cc/120?u=${member.uid}`} alt="" style={{ width: 60, height: 60, borderRadius: '50%' }} />
            <div>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                {member.displayName}
                <Badge variant={roleLabel(member).variant}>{roleLabel(member).label}</Badge>
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '4px 0 0' }}>{member.uid}</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 18 }}>
            <MiniBox label="عملات" value={formatNumber(member.coins)} />
            <MiniBox label="ماسة المحفظة" value={formatNumber(member.pearls)} />
            <MiniBox label="الأرباح" value={formatNumber(member.pearlsEarned)} />
            <MiniBox label="محوّل للوكيل" value={formatNumber(member.pearlsTransferredToAgent)} />
            <MiniBox label="متاح للسحب" value={formatNumber(member.availablePearls)} />
            <MiniBox label="الدولة / المستوى" value={`${member.country} · L${member.level}`} />
          </div>
          {member.joinedAt > 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
              انضم: {new Date(member.joinedAt).toLocaleString('ar')}
              {member.verifiedAt ? ` · موثّقة: ${new Date(member.verifiedAt).toLocaleDateString('ar')}` : ''}
            </p>
          )}

          <h4 style={{ margin: '6px 0 8px' }}>آخر المعاملات</h4>
          {tx === null ? <Loading /> : tx.length === 0 ? <Empty text="لا توجد معاملات" /> : (
            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 280, overflowY: 'auto' }}>
              {tx.map((t) => {
                const pos = (t.amount ?? 0) >= 0;
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderBottom: '1px solid var(--border, #eee)' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 13 }}>{txLabel(t.type)}</p>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.createdAt ? timeAgo(t.createdAt) : ''} · {t.currency ?? ''}</span>
                    </div>
                    <span style={{ fontWeight: 700, color: pos ? 'var(--success)' : 'var(--danger)' }}>
                      {pos ? '+' : ''}{formatNumber(t.amount ?? 0)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--bg-app)', borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 14 }}>{value}</div>
    </div>
  );
}

function AssignHostModal({
  agencyId,
  agencyName,
  onClose,
  onSuccess,
}: {
  agencyId: string;
  agencyName: string;
  onClose: () => void;
  onSuccess: (result: Awaited<ReturnType<typeof assignAgencyMember>>) => void | Promise<void>;
}) {
  const [identifier, setIdentifier] = useState('');
  const [preview, setPreview] = useState<AdminUser | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [assignError, setAssignError] = useState('');
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSearch = async () => {
    const raw = identifier.trim();
    if (!raw) return;
    setSearching(true);
    setPreview(null);
    setPreviewError('');
    setAssignError('');
    try {
      const user = await getUserById(raw);
      if (!user) {
        setPreviewError('لم يُعثر على مستخدم بهذا المعرّف');
        return;
      }
      const activeAgencyId = await resolveUserActiveAgencyId(user.uid);
      if (activeAgencyId && activeAgencyId !== agencyId) {
        setPreviewError('المستخدم مرتبط بوكالة أخرى — أزلّه منها أولاً');
      }
      setPreview(user);
    } finally {
      setSearching(false);
    }
  };

  const handleAssign = async () => {
    const raw = identifier.trim();
    if (!raw) return;
    setSubmitting(true);
    setAssignError('');
    try {
      const result = await assignAgencyMember(agencyId, raw);
      const roleNote = result.isFemaleHost
        ? 'مضيفة موثّقة'
        : 'عضو (ذكر — بدون مزايا مضيفة)';
      const msg = result.alreadyMember
        ? `تم تحديث "${result.displayName}" — ${roleNote}`
        : `تم ربط "${result.displayName}" بوكالة "${agencyName}" — ${roleNote}`;
      alert(msg);
      await onSuccess(result);
    } catch (e: any) {
      setAssignError(assignErrorMessage(String(e?.message ?? 'خطأ')));
    } finally {
      setSubmitting(false);
    }
  };

  const genderLabel = preview?.gender === 'female' ? 'أنثى → مضيفة موثّقة' : preview?.gender === 'male' ? 'ذكر → عضو عادي' : '—';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserPlus size={20} /> ربط مضيف بالوكالة
          </h3>
          <button className="action-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 0, lineHeight: 1.6 }}>
            أدخل <strong>معرّف الحساب (8 أرقام)</strong> أو <strong>Firebase UID</strong>.
            الإناث تُربط كمضيفات موثّقة؛ الذكور كأعضاء عاديين.
          </p>

          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
            معرّف المستخدم
          </label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              className="form-input"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                setPreview(null);
                setPreviewError('');
                setAssignError('');
              }}
              placeholder="12345678 أو UID"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              style={{ flex: 1 }}
            />
            <button
              className="btn-secondary"
              onClick={handleSearch}
              disabled={searching || !identifier.trim()}
              style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}
            >
              <Search size={16} /> {searching ? '...' : 'بحث'}
            </button>
          </div>

          {previewError && (
            <p style={{ color: 'var(--danger)', fontSize: 13, margin: '0 0 12px' }}>{previewError}</p>
          )}

          {preview && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 12,
              borderRadius: 12,
              background: 'var(--bg-app)',
              border: '1px solid var(--border, #eee)',
              marginBottom: 12,
            }}>
              <img
                src={preview.avatar || `https://i.pravatar.cc/80?u=${preview.uid}`}
                alt=""
                style={{ width: 48, height: 48, borderRadius: '50%' }}
              />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 700 }}>{preview.displayName}</p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                  ID: {preview.publicAccountId} · {genderLabel}
                </p>
                {preview.agencyId === agencyId && (
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#e11212' }}>
                    عضو بالفعل في هذه الوكالة — يمكن ترقيتها إن كانت أنثى
                  </p>
                )}
              </div>
            </div>
          )}

          {assignError && (
            <p style={{ color: 'var(--danger)', fontSize: 13, margin: '0 0 12px' }}>{assignError}</p>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="btn-secondary" onClick={onClose} disabled={submitting}>إلغاء</button>
            <button
              className="btn-primary"
              onClick={handleAssign}
              disabled={submitting || !identifier.trim()}
              style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}
            >
              <UserPlus size={16} />
              {submitting ? 'جاري الربط...' : 'ربط بالوكالة'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
