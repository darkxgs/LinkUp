import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { adminPath } from '@/lib/adminPaths';
import {
  Building2, Check, X, Play, ShieldCheck, Users, Eye, RefreshCw,
  PlusCircle, Zap, Search, Smartphone, UserCheck, Rocket, AlertCircle,
  Clock, KeyRound, Copy, Bot, Globe, Globe2, XCircle,
} from 'lucide-react';
import { Loading, Empty, Badge } from '@/components/Common';
import { CountrySelect, formatCountryLabel } from '@/components/CountrySelect';
import {
  getAgencyApplications,
  reviewAgencyApplicationAdmin,
  adminVerifyAgencyHostAdmin,
  activateAgencyApplicationAdmin,
  adminExpressActivateApplication,
  adminCreateAgencyDirect,
  getUserById,
  agencyFemaleHostCount,
  agencyApplicationStatusLabel,
  logAdminAction,
  formatDate,
  getAgencyById,
  getAgencyMembers,
  type AdminAgencyApplication,
  type AgencyDoc,
  type AgencyMember,
} from '@/services/admin';

function formatCallableError(e: unknown): string {
  if (e && typeof e === 'object' && 'code' in e && 'message' in e) {
    const code = String((e as { code: string }).code);
    const message = String((e as { message: string }).message);
    if (code.includes('already-exists')) {
      return message || 'المستخدم أو أحد المضيفات مرتبط بوكالة أخرى بالفعل';
    }
    if (code.includes('permission-denied')) {
      return message || 'ليس لديك صلاحية لهذه العملية أو خارج نطاق دولك';
    }
    if (code.includes('not-found')) {
      return message || 'المستخدم أو الطلب غير موجود';
    }
    if (message) return message;
  }
  return e instanceof Error ? e.message : 'فشلت العملية';
}

type FilterStatus = 'all' | 'pending' | 'awaiting_hosts' | 'ready' | 'active' | 'rejected' | 'expired';
type PageTab = 'requests' | 'create';

const STATUS_BADGE: Record<string, 'warning' | 'info' | 'success' | 'danger' | 'default'> = {
  pending: 'warning',
  awaiting_hosts: 'info',
  ready: 'success',
  active: 'success',
  rejected: 'danger',
  expired: 'default',
};

const WORKFLOW_STEPS = [
  { key: 'pending', label: 'مراجعة الطلب', desc: 'من التطبيق' },
  { key: 'awaiting_hosts', label: 'توثيق المضيفات', desc: '10 مضيفات' },
  { key: 'ready', label: 'جاهز للتفعيل', desc: 'اكتمل الشرط' },
  { key: 'active', label: 'وكالة مفعّلة', desc: 'في التطبيق' },
] as const;

const STAT_FILTERS: { key: FilterStatus; label: string; color: string }[] = [
  { key: 'pending', label: 'قيد المراجعة', color: '#F59E0B' },
  { key: 'awaiting_hosts', label: 'توثيق المضيفات', color: '#06B6D4' },
  { key: 'ready', label: 'جاهز للتفعيل', color: '#10B981' },
  { key: 'active', label: 'مفعّل', color: '#e11212' },
  { key: 'rejected', label: 'مرفوض', color: '#EF4444' },
  { key: 'expired', label: 'منتهي الصلاحية', color: '#9CA3AF' },
];

function workflowStepState(
  stepKey: string,
  status: string,
): 'done' | 'active' | 'idle' {
  const order = ['pending', 'awaiting_hosts', 'ready', 'active'];
  const si = order.indexOf(stepKey);
  const ci = order.indexOf(status);
  if (status === 'rejected') return 'idle';
  if (status === 'active') return si <= 3 ? 'done' : 'idle';
  if (ci > si) return 'done';
  if (ci === si) return 'active';
  return 'idle';
}

function ApplicationWorkflowBar({ status }: { status: string }) {
  const isTerminal = status === 'rejected' || status === 'expired';
  return (
    <div className="agency-workflow">
      {WORKFLOW_STEPS.map((s, i) => {
        const state = workflowStepState(s.key, status);
        return (
          <div
            key={s.key}
            className={`agency-workflow-step ${state}`}
            title={s.desc}
          >
            <div className="agency-workflow-dot">{state === 'done' ? <Check size={10} /> : i + 1}</div>
            <div className="agency-workflow-label">{s.label}</div>
          </div>
        );
      })}
      {isTerminal && (
        <div
          className="agency-workflow-step active"
          style={{ opacity: 1 }}
        >
          <div
            className="agency-workflow-dot"
            style={{
              background: status === 'rejected' ? '#EF4444' : '#9CA3AF',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {status === 'rejected' ? <X size={10} /> : <XCircle size={10} />}
          </div>
          <div className="agency-workflow-label" style={{ color: status === 'rejected' ? '#EF4444' : '#9CA3AF' }}>
            {status === 'rejected' ? 'مرفوض' : 'منتهي الصلاحية'}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AgencyApplicationsPage() {
  const [tab, setTab] = useState<PageTab>('requests');
  const [items, setItems] = useState<AdminAgencyApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('pending');
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminAgencyApplication | null>(null);
  const [selectedAgency, setSelectedAgency] = useState<AgencyDoc | null>(null);
  const [agencyMembers, setAgencyMembers] = useState<AgencyMember[]>([]);

  const [teamFilter, setTeamFilter] = useState<'all' | 'gcc' | 'global'>('all');

  const [ownerUid, setOwnerUid] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [countryCode, setCountryCode] = useState('PS');
  const [hostsText, setHostsText] = useState('');
  const [ownerPreview, setOwnerPreview] = useState<{ name: string; uid: string } | null>(null);

  const isSlaOverdue = (a: AdminAgencyApplication) =>
    a.status === 'pending' && (a.reviewDeadline ?? 0) > 0 && Date.now() > a.reviewDeadline!;

  const load = () => {
    setLoading(true);
    getAgencyApplications().then((list) => {
      setItems(list);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const s of STAT_FILTERS) {
      c[s.key] = items.filter((a) => a.status === s.key).length;
    }
    return c;
  }, [items]);

  const filtered = items.filter(
    (a) =>
      (filter === 'all' || a.status === filter) &&
      (teamFilter === 'all' || a.assignedTeam === teamFilter),
  );
  const pendingCount = counts.pending ?? 0;
  const overdueCount = items.filter(isSlaOverdue).length;

  const selectApplication = async (app: AdminAgencyApplication | null) => {
    setSelected(app);
    setSelectedAgency(null);
    setAgencyMembers([]);
    if (app?.agencyId) {
      const [agency, members] = await Promise.all([
        getAgencyById(app.agencyId),
        getAgencyMembers(app.agencyId),
      ]);
      setSelectedAgency(agency);
      setAgencyMembers(members);
    }
  };

  const run = async (key: string, fn: () => Promise<unknown>, log: string) => {
    setBusy(key);
    try {
      const res = await fn();
      await logAdminAction(log, selected?.agencyName ?? agencyName ?? '', selected?.id ?? ownerUid);
      load();
      if (selected) {
        const updated = (await getAgencyApplications()).find((x) => x.id === selected.id);
        await selectApplication(updated ?? null);
      }
      return res;
    } catch (e: unknown) {
      const msg = formatCallableError(e);
      alert(msg);
      return null;
    } finally {
      setBusy(null);
    }
  };

  const lookupOwner = async () => {
    if (!ownerUid.trim()) return;
    const u = await getUserById(ownerUid.trim());
    if (!u) {
      setOwnerPreview(null);
      alert('المستخدم غير موجود — تأكد من UID من Firebase');
      return;
    }
    setOwnerPreview({ name: u.displayName, uid: u.uid });
    if (!agencyName) setAgencyName(`وكالة ${u.displayName}`);
  };

  const handleDirectCreate = async () => {
    const hostUids = hostsText.split(/[\n,\s]+/).map((s) => s.trim()).filter(Boolean);
    const res = await run(
      'direct-create',
      () =>
        adminCreateAgencyDirect({
          ownerUid: ownerUid.trim(),
          agencyName: agencyName.trim(),
          countryCode: countryCode.trim(),
          hostUids,
        }),
      'إنشاء وكالة مباشرة من اللوحة',
    );
    if (res) {
      const data = (res as { data?: { agencyId?: string; inviteCode?: string } }).data;
      alert(
        `تم إنشاء الوكالة بنجاح\n\nمعرّف الوكالة: ${data?.agencyId ?? '—'}\nكود الدعوة: ${data?.inviteCode ?? '—'}`,
      );
      setOwnerUid('');
      setAgencyName('');
      setHostsText('');
      setOwnerPreview(null);
    }
  };

  const openCreateFromRequest = (a: AdminAgencyApplication) => {
    setOwnerUid(a.applicantUid);
    setAgencyName(a.agencyName);
    setCountryCode(a.countryCode);
    setHostsText((a.proposedHostUids ?? []).join('\n'));
    setOwnerPreview({ name: a.applicantName, uid: a.applicantUid });
    setTab('create');
    setSelected(null);
    setSelectedAgency(null);
    setAgencyMembers([]);
  };

  return (
    <div className="page-container">
      {/* رأس الصفحة */}
      <div className="agency-page-header">
        <div>
          <h1>طلبات فتح الوكالة</h1>
          <p>مراجعة طلبات التطبيق أو إنشاء وكالة مباشرة من هنا.</p>
        </div>
        <button className="btn-secondary" onClick={load} type="button">
          <RefreshCw size={16} /> تحديث
        </button>
      </div>

      {pendingCount > 0 && tab === 'requests' && (
        <div className="agency-alert-banner">
          <AlertCircle size={18} />
          {pendingCount} طلب جديد بانتظار مراجعتك — اضغط على الصف لعرض التفاصيل واتخاذ إجراء
        </div>
      )}
      {overdueCount > 0 && tab === 'requests' && (
        <div className="agency-alert-banner" style={{ background: '#FEE2E2', borderColor: '#EF4444', color: '#DC2626' }}>
          <AlertCircle size={18} />
          {overdueCount} طلب تجاوز مهلة المراجعة (12 ساعة) — يجب المعالجة فوراً
        </div>
      )}

      {/* مسار العمل — يوضّح سيناريو طلبات التطبيق */}
      {tab === 'requests' && selected && (
        <div style={{ marginBottom: 8 }}>
          <ApplicationWorkflowBar status={selected.status} />
        </div>
      )}

      {/* إحصائيات سريعة */}
      <div className="agency-stats-row">
        {STAT_FILTERS.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`agency-stat-pill ${tab === 'requests' && filter === s.key ? 'selected' : ''}`}
            onClick={() => {
              setTab('requests');
              setFilter(s.key);
            }}
          >
            <div className="count" style={{ color: s.color }}>
              {counts[s.key] ?? 0}
            </div>
            <div className="label">{s.label}</div>
          </button>
        ))}
      </div>

      {/* تبويبات رئيسية */}
      <div className="agency-toolbar">
        <div className="agency-segmented">
          <button
            type="button"
            className={tab === 'requests' ? 'active' : ''}
            onClick={() => setTab('requests')}
          >
            <Smartphone size={16} />
            طلبات التطبيق
            <span style={{ opacity: 0.85 }}>({items.length})</span>
          </button>
          <button
            type="button"
            className={tab === 'create' ? 'active' : ''}
            onClick={() => setTab('create')}
          >
            <PlusCircle size={16} />
            إنشاء وكالة مباشرة
          </button>
        </div>

        {/* A-1: فلتر الفريق */}
        {tab === 'requests' && (
          <div className="agency-segmented" style={{ marginInlineStart: 8 }}>
            {(['all', 'gcc', 'global'] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={teamFilter === t ? 'active' : ''}
                onClick={() => setTeamFilter(t)}
                title={t === 'gcc' ? 'فريق الخليج' : t === 'global' ? 'الإدارة العامة' : 'الكل'}
              >
                {t === 'all' ? 'كل الفرق' : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {t === 'gcc' ? <Globe size={12} /> : <Globe2 size={12} />}
                    {t === 'gcc' ? 'خليج' : 'عام'}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        <Link to={adminPath('/agencies')} className="btn-secondary" style={{ textDecoration: 'none', marginInlineStart: 'auto' }}>
          <Building2 size={16} /> الوكالات المفعّلة
        </Link>
      </div>

      {/* ——— إنشاء مباشر ——— */}
      {tab === 'create' && (
        <div className="agency-form-panel" style={{ maxWidth: 720 }}>
            <div className="agency-form-panel-header">
              <h2>إنشاء وكالة مباشرة</h2>
              <p>تفعيل فوري لمركز الوكالة وصلاحيات الوكيل</p>
            </div>

            <div className="agency-form-steps">
              <section className="agency-form-step">
                <div className="agency-form-step-head">
                  <span className="agency-form-step-num">1</span>
                  <div>
                    <h4>تحديد الوكيل (مالك الوكالة)</h4>
                    <p>UID من Firebase أو ID المنسوخ من ملف المستخدم (8 أرقام)</p>
                  </div>
                </div>
                <label className="form-label">معرّف الوكيل (UID أو ID 8 أرقام) *</label>
                <div className="agency-uid-row">
                  <input
                    className="form-input"
                    value={ownerUid}
                    onChange={(e) => {
                      setOwnerUid(e.target.value);
                      setOwnerPreview(null);
                    }}
                    placeholder="مثال: xK9mP2..."
                    dir="ltr"
                  />
                  <button type="button" className="btn-secondary" onClick={lookupOwner}>
                    <Search size={16} /> تحقق
                  </button>
                </div>
                {ownerPreview && (
                  <div className="agency-owner-preview">
                    <UserCheck size={14} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 6 }} />
                    {ownerPreview.name} — {ownerPreview.uid}
                  </div>
                )}
              </section>

              <section className="agency-form-step">
                <div className="agency-form-step-head">
                  <span className="agency-form-step-num">2</span>
                  <div>
                    <h4>بيانات الوكالة</h4>
                    <p>الاسم والدولة كما تظهر في التطبيق والتقارير</p>
                  </div>
                </div>
                <label className="form-label">اسم الوكالة *</label>
                <input
                  className="form-input"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  placeholder="مثال: وكالة النجوم"
                  style={{ marginBottom: 14 }}
                />
                <CountrySelect
                  label="دولة الوكالة"
                  value={countryCode}
                  onChange={setCountryCode}
                  required
                />
              </section>

              <section className="agency-form-step">
                <div className="agency-form-step-head">
                  <span className="agency-form-step-num">3</span>
                  <div>
                    <h4>مضيفات أولية (اختياري)</h4>
                    <p>سطر لكل مضيفة — ID من الملف (8 أرقام) أو UID</p>
                  </div>
                </div>
                <textarea
                  className="form-input"
                  rows={4}
                  value={hostsText}
                  onChange={(e) => setHostsText(e.target.value)}
                  placeholder={'uid_mhost_1\nuid_mhost_2'}
                  style={{ width: '100%', resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
                  dir="ltr"
                />
              </section>
            </div>

            <div className="agency-form-footer">
              <p className="hint">
                بعد الإنشاء يظهر للوكيل «مركز الوكالة» في التطبيق مع كود دعوة للمضيفات الجديدات.
              </p>
              <button
                type="button"
                className="btn-primary"
                disabled={!!busy || !ownerUid.trim() || !agencyName.trim()}
                onClick={handleDirectCreate}
              >
                <Rocket size={18} /> إنشاء وتفعيل الوكالة
              </button>
            </div>
        </div>
      )}

      {/* ——— طلبات التطبيق ——— */}
      {tab === 'requests' && (
        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: 0 }}>طلبات من التطبيق</h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                طلبات المستخدمين من التطبيق
              </p>
            </div>
            {filter !== 'all' && (
              <button type="button" className="btn-secondary" style={{ fontSize: 12 }} onClick={() => setFilter('all')}>
                عرض الكل
              </button>
            )}
          </div>

          {loading ? (
            <Loading />
          ) : filtered.length === 0 ? (
            <Empty text={`لا توجد طلبات — ${agencyApplicationStatusLabel(filter)}`} />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>الوكالة</th>
                    <th>مقدّم الطلب</th>
                    <th>تواصل</th>
                    <th>المضيفات</th>
                    <th>المرحلة</th>
                    <th>التاريخ</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => {
                    const verified = agencyFemaleHostCount(a);
                    const min = a.minHostsRequired ?? 10;
                    const pct = Math.min(100, Math.round((verified / min) * 100));
                    const overdue = isSlaOverdue(a);
                    return (
                      <tr
                        key={a.id}
                        style={{ cursor: 'pointer', background: overdue ? '#FFF5F5' : undefined }}
                        onClick={() => selectApplication(a)}
                      >
                        <td style={{ fontWeight: 700 }}>{a.agencyName}</td>
                        <td>
                          <div>{a.applicantName}</div>
                          <code style={{ fontSize: 10, color: 'var(--text-muted)' }}>{a.applicantUid.slice(0, 12)}…</code>
                        </td>
                        <td style={{ fontSize: 12 }}>
                          <div>{a.whatsappNumber ?? a.applicantPhone}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                            {formatCountryLabel(a.countryCode)}
                          </div>
                          {/* A-2: badge الفريق */}
                          {a.assignedTeam && (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              marginTop: 3,
                              fontSize: 10,
                              padding: '1px 6px',
                              borderRadius: 99,
                              background: a.assignedTeam === 'gcc' ? '#FEF3C7' : '#DBEAFE',
                              color: a.assignedTeam === 'gcc' ? '#D97706' : '#8b0000',
                              fontWeight: 700,
                            }}>
                              {a.assignedTeam === 'gcc' ? <Globe size={10} /> : <Globe2 size={10} />}
                              {a.assignedTeam === 'gcc' ? 'خليج' : 'عام'}
                            </span>
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: verified >= min ? 'var(--success)' : undefined }}>
                            {verified} / {min}
                          </div>
                          <div className="agency-progress-bar" style={{ width: 80, marginTop: 4 }}>
                            <span className="agency-progress-fill" style={{ width: `${pct}%` }} />
                          </div>
                        </td>
                        <td>
                          <Badge variant={STATUS_BADGE[a.status] ?? 'default'}>
                            {agencyApplicationStatusLabel(a.status)}
                          </Badge>
                          {/* A-3: تنبيه SLA */}
                          {overdue && (
                            <div style={{ marginTop: 3, fontSize: 10, color: '#DC2626', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
                              <Clock size={10} /> تأخّر SLA
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{formatDate(a.createdAt)}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '6px 12px', fontSize: 12 }}
                            onClick={() => selectApplication(a)}
                          >
                            <Eye size={14} /> مراجعة
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ——— نافذة تفاصيل الطلب ——— */}
      {selected && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => selectApplication(null)}
        >
          <div className="card agency-modal" onClick={(e) => e.stopPropagation()}>
            <div className="agency-modal-header">
              <div>
                <h2 style={{ margin: 0, fontSize: 20 }}>{selected.agencyName}</h2>
                <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  {selected.applicantName} · {selected.whatsappNumber ?? selected.applicantPhone} · {formatCountryLabel(selected.countryCode)}
                  {selected.applicantPublicAccountId && (
                    <> · ID: {selected.applicantPublicAccountId}</>
                  )}
                </p>
                {/* A-6: مصدر الطلب */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  {selected.source && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 99,
                      background: selected.source === 'support_bot' ? '#FEF3C7' : '#DBEAFE',
                      color: selected.source === 'support_bot' ? '#D97706' : '#8b0000',
                      fontWeight: 700,
                    }}>
                      {selected.source === 'support_bot' ? <Bot size={11} /> : <Smartphone size={11} />}
                      {selected.source === 'support_bot' ? 'Support Bot' : 'App'}
                    </span>
                  )}
                  {selected.assignedTeam && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 99,
                      background: selected.assignedTeam === 'gcc' ? '#FEF9C3' : '#EFF6FF',
                      color: selected.assignedTeam === 'gcc' ? '#CA8A04' : '#8b0000',
                      fontWeight: 700,
                    }}>
                      {selected.assignedTeam === 'gcc' ? <Globe size={11} /> : <Globe2 size={11} />}
                      {selected.assignedTeam === 'gcc' ? 'فريق الخليج' : 'الإدارة العامة'}
                    </span>
                  )}
                </div>
                {(selected.reviewDeadline ?? 0) > 0 && selected.status === 'pending' && (
                  <p style={{ margin: '4px 0 0', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, color: isSlaOverdue(selected) ? '#DC2626' : 'var(--text-muted)', fontWeight: isSlaOverdue(selected) ? 700 : undefined }}>
                    {isSlaOverdue(selected) && <AlertCircle size={12} color="#DC2626" />}
                    {isSlaOverdue(selected) ? 'تجاوز مهلة المراجعة — ' : 'مراجعة قبل: '}
                    {new Date(selected.reviewDeadline!).toLocaleString('ar')}
                  </p>
                )}
                <code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{selected.applicantUid}</code>
              </div>
              <button type="button" className="action-icon" onClick={() => selectApplication(null)} aria-label="إغلاق">
                <X size={20} />
              </button>
            </div>

            <div className="agency-modal-body">
              <ApplicationWorkflowBar status={selected.status} />

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <Badge variant={STATUS_BADGE[selected.status] ?? 'default'}>
                  {agencyApplicationStatusLabel(selected.status)}
                </Badge>
                {selected.agencyId && (
                  <span style={{ fontSize: 12 }}>
                    معرّف الوكالة: <code>{selected.agencyId}</code>
                  </span>
                )}
              </div>

              {selected.status !== 'active' && selected.status !== 'rejected' && (
                <>
                  {(() => {
                    const femaleCount = agencyFemaleHostCount(selected, selectedAgency);
                    const min = selectedAgency?.minHostsRequired ?? selected.minHostsRequired ?? 10;
                    const pct = Math.min(100, Math.round((femaleCount / min) * 100));
                    const deadline = selectedAgency?.hostsDeadline ?? (selected as any).hostsDeadline ?? 0;
                    const now = Date.now();
                    const daysLeft = deadline ? Math.max(0, Math.ceil((deadline - now) / (1000 * 60 * 60 * 24))) : null;
                    const isOverdue = deadline > 0 && now > deadline;
                    return (
                      <div className="agency-modal-section">
                        {/* شريط تقدم المضيفات الإناث */}
                        <div className="agency-progress-label">
                          <span>مضيفات إناث موثّقات</span>
                          <span style={{ fontWeight: 700, color: femaleCount >= min ? 'var(--success)' : undefined }}>
                            {femaleCount} / {min}
                          </span>
                        </div>
                        <div className="agency-progress-bar">
                          <span className="agency-progress-fill" style={{ width: `${pct}%` }} />
                        </div>

                        {/* كود الدعوة */}
                        {(selected as any).inviteCode && (
                          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1.5px solid var(--primary)' }}>
                            <KeyRound size={14} color="var(--primary)" />
                            <span style={{ fontWeight: 800, letterSpacing: 3, fontSize: 18, color: 'var(--primary)' }}>
                              {(selected as any).inviteCode}
                            </span>
                            <button
                              type="button"
                              className="action-icon"
                              title="نسخ الكود"
                              onClick={() => navigator.clipboard.writeText((selected as any).inviteCode)}
                            >
                              <Copy size={13} />
                            </button>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 'auto' }}>كود الدعوة</span>
                          </div>
                        )}

                        {/* المهلة المتبقية */}
                        {deadline > 0 && (
                          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                            <Clock size={13} color={isOverdue ? 'var(--danger)' : daysLeft !== null && daysLeft <= 2 ? '#F59E0B' : 'var(--text-muted)'} />
                            <span style={{ color: isOverdue ? 'var(--danger)' : daysLeft !== null && daysLeft <= 2 ? '#F59E0B' : 'var(--text-muted)', fontWeight: 600 }}>
                              {isOverdue
                                ? 'انتهت مهلة 7 أيام'
                                : `متبقّي ${daysLeft} يوم من أصل 7`}
                            </span>
                            <span style={{ color: 'var(--text-muted)', marginRight: 'auto' }}>
                              {new Date(deadline).toLocaleDateString('ar')}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}

              {/* إجراءات حسب المرحلة */}
              <div className="agency-modal-section">
                <div className="agency-modal-section-title">
                  <Zap size={14} /> إجراءات
                </div>

                {selected.status === 'pending' && (
                  <div className="agency-action-box primary">
                    <div className="actions">
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={!!busy}
                        onClick={() =>
                          run('approve', () => reviewAgencyApplicationAdmin(selected.id, 'approve'), 'موافقة مبدئية')
                        }
                      >
                        <Check size={16} /> موافقة وإرسال للمضيفات
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                        disabled={!!busy}
                        onClick={() => {
                          const reason = prompt('سبب الرفض (يظهر للمستخدم):');
                          if (!reason?.trim()) return;
                          run('reject', () => reviewAgencyApplicationAdmin(selected.id, 'reject', reason), 'رفض طلب');
                        }}
                      >
                        <X size={16} /> رفض الطلب
                      </button>
                    </div>
                  </div>
                )}

                {['pending', 'awaiting_hosts', 'ready'].includes(selected.status) && (
                  <div className="agency-action-box">
                    <div className="actions">
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ background: 'linear-gradient(135deg,#e11212,#d21e2a)' }}
                        disabled={!!busy}
                        onClick={() =>
                          run('express', () => adminExpressActivateApplication(selected.id), 'تفعيل سريع')
                        }
                      >
                        <Zap size={16} /> تفعيل فوري
                      </button>
                    </div>
                  </div>
                )}

                {selected.status === 'ready' && (
                  <div className="agency-action-box">
                    <div className="actions">
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={
                          !!busy ||
                          agencyFemaleHostCount(selected, selectedAgency) < (selected.minHostsRequired ?? 10)
                        }
                        onClick={() =>
                          run('activate', () => activateAgencyApplicationAdmin(selected.id), 'تفعيل وكالة')
                        }
                      >
                        <Play size={16} /> تفعيل الوكالة
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="agency-modal-section">
                <div className="agency-modal-section-title">
                  <Users size={14} />
                  {agencyMembers.length > 0
                    ? `أعضاء الوكالة (${agencyMembers.length})`
                    : 'المضيفات المقترَحات (قبل الانضمام)'}
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>الاسم</th>
                        <th>UID</th>
                        <th>الدور</th>
                        <th>الجنس</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {agencyMembers.length > 0
                        ? agencyMembers.map((m) => (
                            <tr key={m.uid}>
                              <td>{m.uidName}</td>
                              <td><code style={{ fontSize: 10 }}>{m.uid}</code></td>
                              <td>{m.role}</td>
                              {/* A-8: تمييز الجنس */}
                              <td>
                                {m.isFemaleHost
                                  ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--success)', fontWeight: 600 }}>
                                      أنثى{m.hostVerified ? <Check size={11} color="var(--success)" /> : null}
                                    </span>
                                  : <span style={{ color: 'var(--text-muted)' }}>ذكر</span>
                                }
                              </td>
                              {/* A-9: إخفاء توثيق للذكر */}
                              <td>
                                {m.isFemaleHost && !m.hostVerified && ['awaiting_hosts', 'ready'].includes(selected.status) && (
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    style={{ padding: '4px 10px', fontSize: 11 }}
                                    disabled={!!busy}
                                    onClick={() =>
                                      run(`verify-${m.uid}`, () => adminVerifyAgencyHostAdmin(selected.id, m.uid), 'توثيق يدوي')
                                    }
                                  >
                                    <ShieldCheck size={12} /> توثيق
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        : (selected.proposedHosts ?? []).map((h) => (
                            <tr key={h.uid}>
                              <td>{h.displayName}</td>
                              <td><code style={{ fontSize: 10 }}>{h.uid}</code></td>
                              <td>—</td>
                              <td>{h.genderVerified ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--success)', fontWeight: 600 }}><Check size={11} /> نعم</span> : '—'}</td>
                              <td />
                            </tr>
                          ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {selected.status !== 'active' && selected.status !== 'rejected' && (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!!busy}
                  onClick={() => openCreateFromRequest(selected)}
                  style={{ width: '100%', marginTop: 8 }}
                >
                  إنشاء يدوي بنفس البيانات
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
