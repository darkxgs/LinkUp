import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminPath } from '@/lib/adminPaths';
import {
  Building2, Users, Star, BadgeCheck, DollarSign, ShieldCheck, Trash2, FileText, Eye,
  PartyPopper, AlertCircle, RefreshCw,
} from 'lucide-react';
import { Loading, Empty, Badge } from '@/components/Common';
import {
  getAgencies, toggleAgencyVerified, deleteAgency, deleteAllAgencies, logAdminAction,
  reviewAgencyPartyRequest, formatNumber, timeAgo,
  type AdminAgency, type AdminAgencyPartyRequest,
} from '@/services/admin';
import { useAdminAlerts } from '@/contexts/AdminAlertsContext';
import { useAdminProfile } from '@/contexts/AdminProfileContext';

export default function AgenciesPage() {
  const navigate = useNavigate();
  const { partyPending, partyPendingCount, refresh: refreshAlerts } = useAdminAlerts();
  const { isSuper } = useAdminProfile();
  const [agencies, setAgencies] = useState<AdminAgency[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const pendingByAgency = useMemo(() => {
    const map = new Map<string, number>();
    partyPending.forEach((r) => {
      map.set(r.agencyId, (map.get(r.agencyId) ?? 0) + 1);
    });
    return map;
  }, [partyPending]);

  const load = () => {
    setLoading(true);
    Promise.all([
      getAgencies().then((a) => { setAgencies(a); }),
      refreshAlerts(),
    ]).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleVerify = async (a: AdminAgency) => {
    setBusy(a.id);
    try {
      await toggleAgencyVerified(a.id, !a.isVerified);
      await logAdminAction(a.isVerified ? 'إلغاء توثيق وكالة' : 'توثيق وكالة', a.name, a.id);
      load();
    } catch (e: any) {
      alert('فشل: ' + (e?.message ?? 'خطأ'));
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (a: AdminAgency) => {
    if (!confirm(`حذف وكالة "${a.name}" نهائياً؟ هذا الإجراء لا يمكن التراجع عنه.`)) return;
    setBusy(a.id);
    try {
      await deleteAgency(a.id);
      await logAdminAction('حذف وكالة', a.name, a.id);
      load();
    } catch (e: any) {
      alert('فشل: ' + (e?.message ?? 'خطأ'));
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteAll = async () => {
    if (!isSuper) {
      alert('حذف كل الوكالات لمدير النظام فقط');
      return;
    }
    if (
      !confirm(
        'تحذير: سيتم حذف كل الوكالات نهائياً مع الأعضاء والغرف والدعوات والطلبات. لا يمكن التراجع.',
      )
    ) {
      return;
    }
    const confirmPhrase =
      prompt('اكتب DELETE_ALL_AGENCIES للتأكيد النهائي:') ?? '';
    if (confirmPhrase !== 'DELETE_ALL_AGENCIES') return;

    setBulkBusy(true);
    try {
      const res = await deleteAllAgencies(confirmPhrase);
      await logAdminAction(
        'حذف كل الوكالات',
        `محذوف: ${res.deleted}, فشل: ${res.failed}, يتيم: ${res.orphansCleared}, غرف: ${res.orphanRoomsCleared}`,
      );
      alert(
        `تم الحذف.\nوكالات: ${res.deleted}\nفشل: ${res.failed}\nسجلات يتيمة: ${res.orphansCleared}\nغرف RTDB: ${res.orphanRoomsCleared}${
          res.errors?.length ? `\n\nأخطاء:\n${res.errors.slice(0, 5).join('\n')}` : ''
        }`,
      );
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'فشل الحذف');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleReviewParty = async (
    req: AdminAgencyPartyRequest,
    action: 'approve' | 'reject',
  ) => {
    if (action === 'approve') {
      if (!confirm(`الموافقة على حفلة "${req.description.slice(0, 50)}"؟`)) return;
    } else {
      const reason = prompt('سبب الرفض (اختياري):') ?? 'مرفوض';
      if (reason === null) return;
      setBusy(`party-${req.id}`);
      try {
        await reviewAgencyPartyRequest(req.id, 'reject', { rejectionReason: reason });
        await logAdminAction('رفض طلب حفلة', req.description.slice(0, 40), req.agencyId);
        load();
      } catch (e: any) {
        alert('فشل: ' + (e?.message ?? 'خطأ'));
      } finally {
        setBusy(null);
      }
      return;
    }
    setBusy(`party-${req.id}`);
    try {
      await reviewAgencyPartyRequest(req.id, 'approve');
      await logAdminAction('الموافقة على طلب حفلة', req.description.slice(0, 40), req.agencyId);
      load();
      alert('تمت الموافقة — ستظهر الحفلة في برنامج الحفل.');
    } catch (e: any) {
      alert('فشل: ' + (e?.message ?? 'خطأ'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="page-container">
      <div style={{ marginBottom: 14, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <Building2 size={22} color="#e11212" /> الوكالات
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            منظمات تضم وكلاء ومضيفات (Firestore) — اضغط على أي وكالة لعرض كل التفاصيل والتحكّم بها.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn-secondary" onClick={load} disabled={loading || bulkBusy}>
            <RefreshCw size={16} /> تحديث
          </button>
          {isSuper && (
            <button
              type="button"
              className="btn-danger"
              onClick={() => void handleDeleteAll()}
              disabled={loading || bulkBusy || agencies.length === 0}
            >
              <Trash2 size={16} />
              {bulkBusy ? 'جاري الحذف...' : 'حذف كل الوكالات'}
            </button>
          )}
        </div>
      </div>

      {partyPendingCount > 0 && (
        <div className="agency-alert-banner" style={{ marginBottom: 16 }}>
          <AlertCircle size={18} />
          {partyPendingCount} طلب حفلة/فعالية بانتظار موافقتك — راجعها أدناه أو من جرس التنبيهات
        </div>
      )}

      <Link
        to={adminPath('/agency-applications')}
        className="btn-primary"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
          textDecoration: 'none',
        }}
      >
        <FileText size={18} />
        طلبات فتح الوكالات (موافقة وتفعيل)
      </Link>

      {partyPendingCount > 0 && (
        <div className="card" style={{ marginBottom: 16, padding: 16 }}>
          <h3 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <PartyPopper size={18} color="#d21e2a" />
            طلبات الحفلات / الفعاليات المعلّقة
            <Badge variant="gold">{partyPendingCount}</Badge>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {partyPending.map((req) => (
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
                  background: 'rgba(236, 72, 153, 0.08)',
                  border: '1px solid rgba(236, 72, 153, 0.2)',
                }}
              >
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 700 }}>
                    {req.agencyName || agencies.find((a) => a.id === req.agencyId)?.name || 'وكالة'}
                    {' · '}
                    {req.requesterName}
                  </div>
                  <div style={{ marginTop: 4 }}>{req.description}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 6 }}>
                    {new Date(req.startAt).toLocaleString('ar')} · {req.durationMinutes} د · {req.eventType}
                    {req.allowPublicPromotion ? ' · ترويج عام' : ''} · {timeAgo(req.createdAt)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busy === `party-${req.id}`}
                    onClick={() => void handleReviewParty(req, 'approve')}
                  >
                    موافقة
                  </button>
                  <button
                    type="button"
                    className="btn-danger"
                    disabled={busy === `party-${req.id}`}
                    onClick={() => void handleReviewParty(req, 'reject')}
                  >
                    رفض
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => navigate(adminPath(`/agencies/${req.agencyId}`))}
                  >
                    تفاصيل الوكالة
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(225,18,18,0.12)' }}>
            <Building2 size={26} color="#e11212" />
          </div>
          <div className="stat-card-value">{agencies.length}</div>
          <div className="stat-card-label">الوكالات</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(210,30,42,0.12)' }}>
            <PartyPopper size={26} color="#d21e2a" />
          </div>
          <div className="stat-card-value">{partyPendingCount}</div>
          <div className="stat-card-label">طلبات حفلات معلّقة</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(16,185,129,0.12)' }}>
            <DollarSign size={26} color="#10B981" />
          </div>
          <div className="stat-card-value">{formatNumber(agencies.reduce((s, a) => s + (a.earnings ?? 0), 0))}</div>
          <div className="stat-card-label">إجمالي الأرباح</div>
        </div>
      </div>

      <div className="card">
        {loading ? <Loading /> : agencies.length === 0 ? <Empty text="لا توجد وكالات" /> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>الوكالة</th><th>المالك</th><th>الدولة</th><th>الأعضاء</th><th>طلبات</th><th>الأرباح</th><th>التقييم</th><th>إجراءات</th></tr>
              </thead>
              <tbody>
                {agencies.map((a) => {
                  const pendingCount = pendingByAgency.get(a.id) ?? 0;
                  return (
                  <tr key={a.id} style={{ cursor: 'pointer' }} onClick={() => navigate(adminPath(`/agencies/${a.id}`))}>
                    <td>
                      <div className="table-user">
                        <div className="stat-card-icon" style={{ width: 38, height: 38, margin: 0, background: 'rgba(225,18,18,0.12)' }}>
                          <Building2 size={18} color="#e11212" />
                        </div>
                        <div className="table-user-info">
                          <p>{a.name} {a.isVerified && <BadgeCheck size={13} color="#b00814" style={{ display: 'inline' }} />}</p>
                          <span>{a.id?.slice(0, 10)}</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 13 }}>{a.ownerName}</td>
                    <td>{a.country}</td>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={14} />{a.members ?? 0}</div></td>
                    <td>
                      {pendingCount > 0 ? (
                        <Badge variant="gold">
                          <PartyPopper size={12} style={{ display: 'inline', marginLeft: 4 }} />
                          {pendingCount} حفلة
                        </Badge>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--success)' }}>{formatNumber(a.earnings ?? 0)}</td>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Star size={14} color="#FCD34D" fill="#FCD34D" />{a.rating ?? 0}</div></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="action-icon view"
                          onClick={() => navigate(adminPath(`/agencies/${a.id}`))}
                          title="عرض التفاصيل والتحكّم"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          className="action-icon"
                          onClick={() => handleVerify(a)}
                          disabled={busy === a.id}
                          title={a.isVerified ? 'إلغاء التوثيق' : 'توثيق'}
                          style={{ color: a.isVerified ? '#b00814' : '#9CA3AF' }}
                        >
                          <ShieldCheck size={15} />
                        </button>
                        <button
                          className="action-icon delete"
                          onClick={() => handleDelete(a)}
                          disabled={busy === a.id}
                          title="حذف"
                        >
                          <Trash2 size={15} />
                        </button>
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
    </div>
  );
}
