import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { adminPath } from '@/lib/adminPaths';
import {
  Search, Ban, CheckCircle, BadgeCheck, Coins, X, Download,
  Plus, Trash2, UserX, Users, RefreshCw, Pencil, Hash, Bell,
} from 'lucide-react';
import { Loading, Empty, Badge } from '@/components/Common';
import { CopyableId } from '@/components/CopyableId';
import { CountrySelect, CountryBadge, getCountryName } from '@/components/CountrySelect';
import { NotifyUserModal } from '@/components/NotifyUserModal';
import { useAdminProfile } from '@/contexts/AdminProfileContext';
import {
  getUsers, banUser,
  logAdminAction, exportToCSV, adminCreateAppUser, adminDeleteAppUsers,
  backfillPublicAccountIds,
  formatNumber, formatDate, timeAgo,
  type AdminUser, type AdminCreateAppUserInput,
} from '@/services/admin';
import { AVATAR_FALLBACK } from '@/utils/avatarFallback';

const ACTIVE_MS = 7 * 24 * 60 * 60 * 1000;

function joinDaysSince(createdAt: number): number {
  if (!createdAt) return 0;
  return Math.max(1, Math.floor((Date.now() - createdAt) / 86400000));
}

function isUserActive(u: AdminUser): boolean {
  return (u.lastSeen ?? u.createdAt) >= Date.now() - ACTIVE_MS;
}

type FilterKey = 'all' | 'active' | 'inactive' | 'vip' | 'banned' | 'verified' | 'male' | 'female';

function genderLabel(g?: string): string {
  if (g === 'female') return 'أنثى';
  if (g === 'male') return 'ذكر';
  return '—';
}

export default function UsersPage() {
  const { isSuper, can } = useAdminProfile();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [notifyUser, setNotifyUser] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    getUsers(500).then((u) => {
      setUsers(u);
      setChecked(new Set());
      setLoading(false);
    }).catch((e) => {
      console.error('load users', e);
      setError(e instanceof Error ? e.message : 'تعذّر تحميل المستخدمين');
      setLoading(false);
    });
  };

  useEffect(load, []);

  const filtered = useMemo(() => users.filter((u) => {
    const q = search.toLowerCase().trim();
    const digits = search.replace(/\D/g, '');
    const countryName = getCountryName(u.country).toLowerCase();
    const matchSearch = !q ||
      u.displayName.toLowerCase().includes(q) ||
      u.uid.toLowerCase().includes(q) ||
      u.publicAccountId.includes(digits) ||
      (u.email ?? '').toLowerCase().includes(q) ||
      u.country.toLowerCase().includes(q) ||
      countryName.includes(q);
    const active = isUserActive(u);
    const matchFilter =
      filter === 'all' ? true :
      filter === 'active' ? active && !u.isBanned :
      filter === 'inactive' ? !active && !u.isBanned :
      filter === 'vip' ? !!u.isVIP :
      filter === 'banned' ? !!u.isBanned :
      filter === 'verified' ? !!u.isVerified :
      filter === 'male' ? u.gender === 'male' :
      filter === 'female' ? u.gender === 'female' : true;
    return matchSearch && matchFilter;
  }), [users, search, filter]);

  // ⚡ ترقيم الصفحات — نرسم 30 صفّاً فقط بدل حتى 500 دفعة واحدة (تمرير/تصفّح أسرع).
  const PAGE_SIZE = 30;
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [search, filter]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const allFilteredChecked = filtered.length > 0 && filtered.every((u) => checked.has(u.uid));

  const toggleCheck = (uid: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const toggleCheckAll = () => {
    if (allFilteredChecked) {
      setChecked((prev) => {
        const next = new Set(prev);
        filtered.forEach((u) => next.delete(u.uid));
        return next;
      });
    } else {
      setChecked((prev) => {
        const next = new Set(prev);
        filtered.forEach((u) => next.add(u.uid));
        return next;
      });
    }
  };

  const handleBan = async (u: AdminUser) => {
    if (!confirm(`${u.isBanned ? 'إلغاء حظر' : 'حظر'} ${u.displayName}؟`)) return;
    await banUser(u.uid, !u.isBanned);
    await logAdminAction(u.isBanned ? 'إلغاء حظر' : 'حظر مستخدم', u.displayName, u.uid);
    load();
  };

  const runBulkDelete = async (
    mode: 'selected' | 'active' | 'inactive' | 'all',
    label: string,
  ) => {
    if (!can('users')) return alert('لا تملك صلاحية المستخدمين');
    let confirmPhrase: string | undefined;
    let msg = label;
    if (mode === 'all') {
      if (!isSuper) return alert('حذف الكل لمدير النظام فقط');
      confirmPhrase = prompt(
        'تحذير: سيُحذف حتى 500 مستخدم. اكتب DELETE_ALL_USERS للتأكيد:',
      ) ?? '';
      if (confirmPhrase !== 'DELETE_ALL_USERS') return;
      msg = 'حذف الكل (حتى 500)';
    } else if (!confirm(msg)) return;

    setBulkBusy(true);
    try {
      const res = await adminDeleteAppUsers({
        mode,
        uids: mode === 'selected' ? [...checked] : undefined,
        confirmPhrase,
      });
      await logAdminAction('حذف مستخدمين', msg, `محذوف: ${res.deleted}, فشل: ${res.failed}`);
      alert(`تم الحذف: ${res.deleted}${res.failed ? ` — فشل: ${res.failed}` : ''}`);
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'فشل الحذف');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleExport = () => {
    exportToCSV(
      filtered.map((u) => ({
        معرّف_الحساب: u.publicAccountId,
        UID: u.uid,
        الاسم: u.displayName,
        الجنس: genderLabel(u.gender),
        الدولة: getCountryName(u.country),
        رمز_الدولة: u.country,
        تاريخ_الانضمام: formatDate(u.createdAt),
        أيام_منذ_الانضمام: joinDaysSince(u.createdAt),
        العملات: u.coins,
        الماسات: u.pearls,
        متفاعل: isUserActive(u) ? 'نعم' : 'لا',
        VIP: u.isVIP ? 'نعم' : 'لا',
        محظور: u.isBanned ? 'نعم' : 'لا',
      })),
      'المستخدمون',
    );
  };

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter((u) => isUserActive(u) && !u.isBanned).length,
    inactive: users.filter((u) => !isUserActive(u) && !u.isBanned).length,
  }), [users]);

  return (
    <div className="page-container">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={22} color="#e11212" /> إدارة المستخدمين
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
            إنشاء، تعديل شامل، وحذف فردي أو جماعي (متفاعل / غير متفاعل / الكل)
          </p>
        </div>
        <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
            <RefreshCw size={16} /> تحديث
          </button>
          {can('users') && (
            <button
              className="btn btn-ghost btn-sm"
              disabled={syncing}
              title="يجعل الحسابات القديمة قابلة للبحث في دعوة الوكالة"
              onClick={async () => {
                if (!confirm('مزامنة معرّفات كل المستخدمين (يشمل القدامى)؟ قد تستغرق دقيقة.')) return;
                setSyncing(true);
                try {
                  const r = await backfillPublicAccountIds();
                  await logAdminAction('مزامنة المعرّفات', 'كل المستخدمين', `معالج: ${r.processed}, محفوظ: ${r.stored}`);
                  alert(`تمت المزامنة — المستخدمون: ${r.processed}\nمعرّفات جديدة محفوظة: ${r.stored}\nفهرسة: ${r.indexed}`);
                } catch (e: unknown) {
                  alert(e instanceof Error ? e.message : 'فشلت المزامنة');
                } finally {
                  setSyncing(false);
                }
              }}
            >
              <Hash size={16} /> {syncing ? 'جارٍ المزامنة...' : 'مزامنة المعرّفات'}
            </button>
          )}
          {can('users') && (
            <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
              <Plus size={16} /> مستخدم جديد
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <StatChip label="المحمّلون" value={stats.total} />
        <StatChip label="متفاعلون (7 أيام)" value={stats.active} color="#10B981" />
        <StatChip label="غير متفاعلين" value={stats.inactive} color="#F59E0B" />
        <StatChip label="المحددون" value={checked.size} color="#e11212" />
      </div>

      {can('users') && (
        <div className="card" style={{ padding: 12, marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>حذف جماعي:</span>
          <button
            className="btn btn-ghost btn-sm"
            disabled={bulkBusy || checked.size === 0}
            onClick={() => runBulkDelete('selected', `حذف ${checked.size} مستخدم محدد؟`)}
          >
            <Trash2 size={14} /> المحدد ({checked.size})
          </button>
          <button
            className="btn btn-ghost btn-sm"
            disabled={bulkBusy}
            onClick={() => runBulkDelete('active', 'حذف المتفاعلين (آخر 7 أيام)؟')}
          >
            <UserX size={14} /> المتفاعلون
          </button>
          <button
            className="btn btn-ghost btn-sm"
            disabled={bulkBusy}
            onClick={() => runBulkDelete('inactive', 'حذف غير المتفاعلين؟')}
          >
            <UserX size={14} /> غير المتفاعلين
          </button>
          {isSuper && (
            <button
              className="btn btn-sm"
              style={{ background: '#FEE2E2', color: '#B91C1C' }}
              disabled={bulkBusy}
              onClick={() => runBulkDelete('all', '')}
            >
              <Trash2 size={14} /> حذف الكل (500 كحد أقصى)
            </button>
          )}
        </div>
      )}

      <div className="filters-bar">
        <div className="search-box">
          <Search size={18} color="var(--text-muted)" />
          <input
            placeholder="ابحث بالاسم، المعرّف، الدولة، UID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="filter-select" value={filter} onChange={(e) => setFilter(e.target.value as FilterKey)}>
          <option value="all">كل المستخدمين</option>
          <option value="active">متفاعلون (7 أيام)</option>
          <option value="inactive">غير متفاعلين</option>
          <option value="vip">VIP فقط</option>
          <option value="verified">موثّقون</option>
          <option value="banned">محظورون</option>
          <option value="male">ذكور</option>
          <option value="female">إناث</option>
        </select>
        <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 14, fontWeight: 600 }}>
            {filtered.length} مستخدم
          </span>
          <button className="btn btn-ghost btn-sm" onClick={handleExport}>
            <Download size={16} /> تصدير CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ padding: 14, marginBottom: 12, color: 'var(--danger, #EF4444)', fontWeight: 600 }}>
          {error}
        </div>
      )}

      <div className="card">
        {loading ? <Loading /> : filtered.length === 0 ? <Empty /> : (
          <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input type="checkbox" checked={allFilteredChecked} onChange={toggleCheckAll} />
                  </th>
                  <th>المستخدم</th>
                  <th>معرّف الحساب</th>
                  <th>الجنس</th>
                  <th>الدولة</th>
                  <th>تاريخ الانضمام</th>
                  <th>العملات</th>
                  <th>الحالة</th>
                  <th>آخر ظهور</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((u) => (
                  <tr key={u.uid}>
                    <td>
                      <input
                        type="checkbox"
                        checked={checked.has(u.uid)}
                        onChange={() => toggleCheck(u.uid)}
                      />
                    </td>
                    <td>
                      <div className="table-user">
                        <img src={u.avatar || AVATAR_FALLBACK} alt="" loading="lazy" />
                        <div className="table-user-info">
                          <p>
                            {u.displayName}
                            {u.isVerified && <BadgeCheck size={14} color="#b00814" style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />}
                          </p>
                          <span className="table-user-sub">
                            <CountryBadge code={u.country} size="sm" />
                            <span className="table-user-sub-text">{u.email || `${u.uid.slice(0, 10)}…`}</span>
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="table-account-id">
                        <CountryBadge code={u.country} size="sm" />
                        <CopyableId id={u.publicAccountId} />
                      </div>
                    </td>
                    <td>
                      <Badge variant={u.gender === 'female' ? 'pink' : 'blue'}>
                        {genderLabel(u.gender)}
                      </Badge>
                    </td>
                    <td><CountryBadge code={u.country} showCode /></td>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{formatDate(u.createdAt)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {joinDaysSince(u.createdAt)} يوم
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                        <Coins size={14} color="#F59E0B" />
                        {formatNumber(u.coins)}
                      </div>
                    </td>
                    <td>
                      {u.isBanned ? (
                        <Badge variant="red">محظور</Badge>
                      ) : isUserActive(u) ? (
                        <Badge variant="green">متفاعل</Badge>
                      ) : (
                        <Badge variant="blue">غير متفاعل</Badge>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{timeAgo(u.lastSeen ?? u.createdAt)}</td>
                    <td>
                      <div className="action-btns">
                        <button className="action-icon view" onClick={() => navigate(adminPath(`/users/${u.uid}`))} title="تفاصيل وتعديل">
                          <Pencil size={16} />
                        </button>
                        <button className="action-icon edit" onClick={() => setNotifyUser(u)} title="إرسال إشعار">
                          <Bell size={16} />
                        </button>
                        <button
                          className={`action-icon ${u.isBanned ? 'ok' : 'ban'}`}
                          onClick={() => handleBan(u)}
                          title={u.isBanned ? 'إلغاء الحظر' : 'حظر'}
                        >
                          {u.isBanned ? <CheckCircle size={16} /> : <Ban size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pageCount > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '14px 0 2px' }}>
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage <= 0}
                style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', cursor: safePage <= 0 ? 'default' : 'pointer', opacity: safePage <= 0 ? 0.5 : 1 }}
              >
                السابق
              </button>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                صفحة {safePage + 1} من {pageCount} · {filtered.length} مستخدم
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={safePage >= pageCount - 1}
                style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', cursor: safePage >= pageCount - 1 ? 'default' : 'pointer', opacity: safePage >= pageCount - 1 ? 0.5 : 1 }}
              >
                التالي
              </button>
            </div>
          )}
          </>
        )}
      </div>

      {notifyUser && (
        <NotifyUserModal user={notifyUser} onClose={() => setNotifyUser(null)} />
      )}

      {creating && (
        <CreateUserModal
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); load(); }}
        />
      )}
    </div>
  );
}

function StatChip({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: 10,
      padding: '8px 14px',
      border: '1px solid var(--border)',
    }}>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 800, margin: 0, color: color ?? 'var(--text)' }}>{value}</p>
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<AdminCreateAppUserInput>({
    email: '',
    password: '',
    displayName: '',
    gender: 'female',
    country: 'PS',
    coins: 1000,
    pearls: 0,
    casinoCoins: 0,
    isVIP: false,
    isVerified: false,
    isBanned: false,
  });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!form.email.trim() || !form.password || form.password.length < 6) {
      return alert('بريد وكلمة مرور (6+ أحرف)');
    }
    if (!form.displayName.trim()) return alert('الاسم مطلوب');
    setBusy(true);
    try {
      const res = await adminCreateAppUser(form);
      await logAdminAction('إنشاء مستخدم', res.displayName, res.publicAccountId);
      alert(`تم الإنشاء — المعرّف: ${res.publicAccountId}`);
      onCreated();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'فشل الإنشاء');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>مستخدم جديد</h3>
          <button className="action-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field label="البريد" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <Field label="كلمة المرور" value={form.password} onChange={(v) => setForm({ ...form, password: v })} type="password" />
          <Field label="الاسم" value={form.displayName} onChange={(v) => setForm({ ...form, displayName: v })} />
          <label className="form-label">الجنس</label>
          <select
            className="form-input"
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value as 'male' | 'female' })}
          >
            <option value="female">أنثى</option>
            <option value="male">ذكر</option>
          </select>
          <label className="form-label">الدولة</label>
          <CountrySelect value={form.country ?? 'PS'} onChange={(c) => setForm({ ...form, country: c })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <NumField label="عملات" value={form.coins} onChange={(v) => setForm({ ...form, coins: v })} />
            <NumField label="ماسات" value={form.pearls} onChange={(v) => setForm({ ...form, pearls: v })} />
            <NumField label="كازينو" value={form.casinoCoins} onChange={(v) => setForm({ ...form, casinoCoins: v })} />
          </div>
          <FlagsRow
            flags={[
              { key: 'isVIP', label: 'VIP', checked: !!form.isVIP },
              { key: 'isVerified', label: 'موثّق', checked: !!form.isVerified },
              { key: 'isBanned', label: 'محظور', checked: !!form.isBanned },
            ]}
            onToggle={(key, checked) => setForm({ ...form, [key]: checked })}
          />
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'جارٍ الإنشاء...' : 'إنشاء'}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <>
      <label className="form-label">{label}</label>
      <input className="form-input" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </>
  );
}

function NumField({ label, value, onChange }: {
  label: string; value?: number; onChange: (v: number) => void;
}) {
  return (
    <>
      <label className="form-label">{label}</label>
      <input
        className="form-input"
        type="number"
        value={value ?? 0}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </>
  );
}

function FlagsRow({
  flags,
  onToggle,
}: {
  flags: { key: string; label: string; checked: boolean }[];
  onToggle: (key: string, checked: boolean) => void;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
      {flags.map((f) => (
        <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={f.checked} onChange={(e) => onToggle(f.key, e.target.checked)} />
          {f.label}
        </label>
      ))}
    </div>
  );
}
