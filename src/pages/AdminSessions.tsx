/**
 * تتبع جلسات دخول الأدمن والمشرفين — IP، الموقع، الجهاز، إجبار الخروج
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Monitor, MapPin, LogOut, RefreshCw, Shield, Globe2, Laptop, Clock,
} from 'lucide-react';
import { Loading, Empty, Badge } from '@/components/Common';
import { useAdminProfile } from '@/contexts/AdminProfileContext';
import { formatDate, timeAgo, logAdminAction } from '@/services/admin';
import {
  listAdminSessions,
  forceLogoutAdminSessions,
  formatAdminSessionLocation,
  type AdminPanelSession,
} from '@/services/adminSession';

type FilterStatus = 'active' | 'all' | 'ended' | 'revoked';

function statusBadge(status: AdminPanelSession['status']) {
  if (status === 'active') return <Badge variant="green">نشط الآن</Badge>;
  if (status === 'revoked') return <Badge variant="red">أُخرج قسراً</Badge>;
  return <Badge variant="gold">خرج</Badge>;
}

export default function AdminSessionsPage() {
  const { isSuper } = useAdminProfile();
  const [items, setItems] = useState<AdminPanelSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('active');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listAdminSessions({ status: filter === 'all' ? 'all' : filter, limitCount: 200 }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const active = items.filter((i) => i.status === 'active').length;
    const uniqueAdmins = new Set(items.filter((i) => i.status === 'active').map((i) => i.adminUid)).size;
    return { active, uniqueAdmins, total: items.length };
  }, [items]);

  if (!isSuper) {
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <Shield size={40} color="var(--text-muted)" />
          <h3 style={{ marginTop: 12 }}>غير مصرّح</h3>
          <p style={{ color: 'var(--text-muted)' }}>تتبع جلسات المشرفين متاح لمدير النظام فقط.</p>
        </div>
      </div>
    );
  }

  const kickSession = async (s: AdminPanelSession) => {
    if (!confirm(`تسجيل خروج قسري لهذه الجلسة؟\n${s.adminName} · ${s.ip}`)) return;
    setBusy(s.id);
    try {
      await forceLogoutAdminSessions({ sessionId: s.id, reason: 'forced_single' });
      await logAdminAction('إجبار خروج جلسة مشرف', s.adminName, `${s.ip} · ${s.browser}`);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'فشل إجبار الخروج');
    } finally {
      setBusy(null);
    }
  };

  const kickAll = async (s: AdminPanelSession) => {
    if (!confirm(`تسجيل خروج من كل الأجهزة لحساب "${s.adminName}"؟\nسيُغلق كل المتصفحات ويتوجب تسجيل الدخول من جديد.`)) return;
    setBusy(`all_${s.adminUid}`);
    try {
      await forceLogoutAdminSessions({ targetUid: s.adminUid, revokeAll: true, reason: 'forced_all' });
      await logAdminAction('إجبار خروج كل جلسات مشرف', s.adminName, s.adminEmail);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'فشل إجبار الخروج');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <Monitor size={22} color="#e11212" /> تتبع جلسات الأدمن
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            شاهد من أين يفتح المشرفون لوحة التحكم (IP والموقع والجهاز) وأخرجهم عن بُعد.
          </p>
        </div>
        <button className="btn-secondary" onClick={() => load()} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <RefreshCw size={16} /> تحديث
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div className="card" style={{ padding: 16 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>جلسات نشطة</p>
          <p style={{ fontSize: 28, fontWeight: 800, margin: '4px 0 0', color: '#10B981' }}>{stats.active}</p>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>مشرفون متصلون</p>
          <p style={{ fontSize: 28, fontWeight: 800, margin: '4px 0 0' }}>{stats.uniqueAdmins}</p>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>سجل معروض</p>
          <p style={{ fontSize: 28, fontWeight: 800, margin: '4px 0 0' }}>{stats.total}</p>
        </div>
      </div>

      <div className="filters-bar" style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {([
          ['active', 'نشط الآن'],
          ['all', 'الكل'],
          ['ended', 'خرج'],
          ['revoked', 'أُخرج قسراً'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            className={filter === key ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 14px', fontSize: 13 }}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? <Loading /> : items.length === 0 ? (
          <Empty text="لا توجد جلسات — ستظهر عند أول تسجيل دخول بعد نشر التحديث" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>المشرف</th>
                  <th>الحالة</th>
                  <th>IP</th>
                  <th>الموقع</th>
                  <th>الجهاز / المتصفح</th>
                  <th>الدخول</th>
                  <th>آخر ظهور</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="table-user-info">
                        <p>{s.adminName || '—'}</p>
                        <span>{s.adminEmail}</span>
                        <span style={{ display: 'block', fontSize: 11, marginTop: 2 }}>
                          {s.adminRole === 'super' ? 'مدير نظام' : 'مشرف دول'}
                        </span>
                      </div>
                    </td>
                    <td>{statusBadge(s.status)}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700 }}>
                      {s.ip || '—'}
                    </td>
                    <td style={{ fontSize: 13, maxWidth: 220 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                        <MapPin size={14} style={{ marginTop: 2, flexShrink: 0, color: '#e11212' }} />
                        <span>{formatAdminSessionLocation(s.location)}</span>
                      </div>
                      {s.location?.latitude != null && s.location?.longitude != null && (
                        <a
                          href={`https://www.google.com/maps?q=${s.location.latitude},${s.location.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: 11, color: 'var(--brand-primary)' }}
                        >
                          فتح على الخريطة
                        </a>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                        <Laptop size={14} /> {s.platform || 'Web'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {s.browser}
                        {s.screen ? ` · ${s.screen}` : ''}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace', maxWidth: 180, wordBreak: 'break-all' }}>
                        {s.deviceId.slice(0, 24)}…
                      </div>
                    </td>
                    <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={13} /> {formatDate(s.createdAt)}
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {s.status === 'active' ? timeAgo(s.lastSeenAt) : (s.endedAt ? formatDate(s.endedAt) : '—')}
                      {s.endedReason && s.status !== 'active' && (
                        <div style={{ fontSize: 11 }}>{s.endedReason}</div>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {s.status === 'active' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <button
                            className="btn-secondary"
                            style={{ padding: '6px 10px', fontSize: 12, display: 'inline-flex', gap: 4, alignItems: 'center', color: '#DC2626' }}
                            disabled={busy === s.id}
                            onClick={() => void kickSession(s)}
                            title="خروج هذه الجلسة فقط"
                          >
                            <LogOut size={13} /> خروج الجلسة
                          </button>
                          <button
                            className="btn-secondary"
                            style={{ padding: '6px 10px', fontSize: 12, display: 'inline-flex', gap: 4, alignItems: 'center' }}
                            disabled={busy === `all_${s.adminUid}`}
                            onClick={() => void kickAll(s)}
                            title="خروج من كل الأجهزة"
                          >
                            <Globe2 size={13} /> كل الأجهزة
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
