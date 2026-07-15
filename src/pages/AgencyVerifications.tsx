/**
 * Admin — صفحة «تحقق الوكالات»
 * تعرض طلبات توثيق الوكالات المُراجَعة آلياً بالذكاء الاصطناعي (Gemini):
 * الشعار/الخلفية/مستند هوية الوكيل، قرار الـ AI وثقته وسبب الرفض، وتتيح
 * تجاوزاً يدوياً (قبول/رفض) للطلبات التي تعذّر حسمها آلياً وبقيت قيد المراجعة.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, Sparkles, CheckCircle2, XCircle, Clock, Eye, Check, X, ExternalLink,
} from 'lucide-react';
import { Loading, Empty, Badge } from '@/components/Common';
import {
  getAgencyVerifications,
  reviewAgencyApplicationAdmin,
  agencyApplicationStatusLabel,
  logAdminAction,
  formatDate,
  type AdminAgencyApplication,
} from '@/services/admin';
import { useAdminProfile } from '@/contexts/AdminProfileContext';
import { adminPath } from '@/lib/adminPaths';

type DecisionFilter = 'all' | 'approve' | 'reject' | 'uncertain';

const CHECK_LABELS: Record<string, string> = {
  name: 'اسم الوكالة',
  logo: 'الشعار',
  background: 'صورة الخلفية',
  id_document: 'مستند الهوية',
};

function decisionBadge(decision?: string) {
  if (decision === 'approve') return <Badge variant="green">قبول آلي</Badge>;
  if (decision === 'reject') return <Badge variant="red">رفض آلي</Badge>;
  return <Badge variant="gold">مراجعة يدوية</Badge>;
}

export default function AgencyVerificationsPage() {
  const { isSuper, profile } = useAdminProfile();
  const [items, setItems] = useState<AdminAgencyApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<DecisionFilter>('all');
  const [processing, setProcessing] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; label: string } | null>(null);
  const [detail, setDetail] = useState<AdminAgencyApplication | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await getAgencyVerifications());
    } catch (e) {
      console.error('load agency verifications error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(
    () => ({
      total: items.length,
      approve: items.filter((i) => i.aiDecision === 'approve').length,
      reject: items.filter((i) => i.aiDecision === 'reject').length,
      uncertain: items.filter((i) => i.aiDecision === 'uncertain' || i.status === 'pending').length,
    }),
    [items],
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'uncertain') {
      return items.filter((i) => i.aiDecision === 'uncertain' || i.status === 'pending');
    }
    return items.filter((i) => i.aiDecision === filter);
  }, [items, filter]);

  const runReview = async (
    app: AdminAgencyApplication,
    action: 'approve' | 'reject',
  ) => {
    let reason = '';
    if (action === 'reject') {
      reason = window.prompt('سبب الرفض (يظهر للوكيل):', app.aiReason || '') || '';
      if (!reason.trim()) return;
    } else if (!window.confirm(`تأكيد الموافقة اليدوية على وكالة "${app.agencyName}"؟`)) {
      return;
    }
    setProcessing(app.id);
    try {
      await reviewAgencyApplicationAdmin(app.id, action, reason.trim() || undefined);
      await logAdminAction(
        action === 'approve' ? 'موافقة يدوية على توثيق وكالة' : 'رفض يدوي لتوثيق وكالة',
        app.id,
        app.agencyName,
      );
      setDetail(null);
      await load();
    } catch (e: any) {
      alert('فشلت العملية: ' + (e?.message ?? 'خطأ'));
    } finally {
      setProcessing(null);
    }
  };

  const thumb = (url: string | undefined, label: string) =>
    url ? (
      <button
        type="button"
        className="btn-thumb"
        onClick={() => setPreview({ url, label })}
        title={label}
        style={{
          padding: 0, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden',
          width: 46, height: 46, cursor: 'pointer', background: '#f5f5f5',
        }}
      >
        <img src={url} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </button>
    ) : (
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
    );

  return (
    <div className="page-container">
      {!isSuper && (
        <div className="agency-alert-banner" style={{ marginBottom: 16 }}>
          طلبات توثيق الوكالات هنا تخص دولتك فقط: {(profile?.countries ?? []).join('، ') || '—'}
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(219,39,119,0.12)' }}>
            <Sparkles size={26} color="#DB2777" />
          </div>
          <div className="stat-card-value">{counts.total}</div>
          <div className="stat-card-label">إجمالي طلبات التوثيق</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(16,185,129,0.12)' }}>
            <CheckCircle2 size={26} color="#10B981" />
          </div>
          <div className="stat-card-value">{counts.approve}</div>
          <div className="stat-card-label">قُبلت آلياً</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(239,68,68,0.12)' }}>
            <XCircle size={26} color="#EF4444" />
          </div>
          <div className="stat-card-value">{counts.reject}</div>
          <div className="stat-card-label">رُفضت آلياً</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(245,158,11,0.15)' }}>
            <Clock size={26} color="#F59E0B" />
          </div>
          <div className="stat-card-value">{counts.uncertain}</div>
          <div className="stat-card-label">بانتظار مراجعة يدوية</div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="tabs" style={{ marginBottom: 0 }}>
          {([
            { id: 'all', label: `الكل (${counts.total})` },
            { id: 'approve', label: `مقبولة (${counts.approve})` },
            { id: 'reject', label: `مرفوضة (${counts.reject})` },
            { id: 'uncertain', label: `مراجعة يدوية (${counts.uncertain})` },
          ] as { id: DecisionFilter; label: string }[]).map((t) => (
            <button
              key={t.id}
              className={`tab ${filter === t.id ? 'active' : ''}`}
              onClick={() => setFilter(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm" style={{ marginRight: 'auto' }} onClick={load}>
          تحديث
        </button>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <Empty text="لا توجد طلبات توثيق وكالات" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>الوكالة</th>
                  <th>الصور</th>
                  <th>قرار الذكاء الاصطناعي</th>
                  <th>السبب / الملاحظات</th>
                  <th>التاريخ</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((app) => {
                  const isPending = app.status === 'pending' || app.aiDecision === 'uncertain';
                  return (
                    <tr key={app.id}>
                      {/* Agency */}
                      <td>
                        <div style={{ fontWeight: 700 }}>{app.agencyName}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {app.ownerName || app.applicantName} · {app.countryCode}
                        </div>
                        {app.applicantUid && (
                          <Link
                            to={adminPath(`/users/${app.applicantUid}`)}
                            style={{ fontSize: 11, color: 'var(--brand)', display: 'inline-flex', gap: 3, alignItems: 'center' }}
                          >
                            الوكيل <ExternalLink size={11} />
                          </Link>
                        )}
                      </td>

                      {/* Images */}
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {thumb(app.logoUrl, 'الشعار')}
                          {thumb(app.backgroundUrl, 'الخلفية')}
                          {thumb(app.idDocumentUrl, 'مستند الهوية')}
                        </div>
                      </td>

                      {/* AI decision */}
                      <td>
                        {decisionBadge(app.aiDecision)}
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                          الثقة: {app.aiConfidence ?? 0}%
                          {app.aiProvider ? ` · ${app.aiProvider === 'gemini' ? 'Gemini' : 'يدوي'}` : ''}
                        </div>
                      </td>

                      {/* Reason / checks */}
                      <td style={{ maxWidth: 260 }}>
                        <div style={{ fontSize: 13, lineHeight: 1.5 }}>{app.aiReason || '—'}</div>
                        {Array.isArray(app.aiChecks) && app.aiChecks.length > 0 && (
                          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {app.aiChecks.map((c, i) => (
                              <span
                                key={i}
                                title={c.note}
                                style={{
                                  fontSize: 10, padding: '1px 6px', borderRadius: 10,
                                  background: c.pass === true ? '#ECFDF5' : c.pass === false ? '#FEF2F2' : '#F3F4F6',
                                  color: c.pass === true ? '#059669' : c.pass === false ? '#DC2626' : '#6B7280',
                                }}
                              >
                                {c.pass === true ? '✓' : c.pass === false ? '✕' : '•'} {CHECK_LABELS[c.key] ?? c.key}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Date */}
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {formatDate(app.aiReviewedAt || app.createdAt)}
                      </td>

                      {/* Status */}
                      <td>
                        <Badge variant={app.status === 'rejected' ? 'red' : app.status === 'pending' ? 'gold' : 'green'}>
                          {agencyApplicationStatusLabel(app.status)}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setDetail(app)}>
                            <Eye size={14} /> عرض
                          </button>
                          {isPending && (
                            <>
                              <button
                                className="btn btn-sm"
                                style={{ background: '#10B981', color: '#fff' }}
                                disabled={processing === app.id}
                                onClick={() => runReview(app, 'approve')}
                              >
                                <Check size={14} /> قبول
                              </button>
                              <button
                                className="btn btn-sm"
                                style={{ background: '#EF4444', color: '#fff' }}
                                disabled={processing === app.id}
                                onClick={() => runReview(app, 'reject')}
                              >
                                <X size={14} /> رفض
                              </button>
                            </>
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

      {/* Image preview modal */}
      {preview && (
        <div
          className="modal-overlay"
          onClick={() => setPreview(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', textAlign: 'center' }}>
            <div style={{ color: '#fff', marginBottom: 8, fontWeight: 700 }}>{preview.label}</div>
            <img src={preview.url} alt={preview.label} style={{ maxWidth: '90vw', maxHeight: '80vh', borderRadius: 10 }} />
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {detail && (
        <div
          className="modal-overlay"
          onClick={() => setDetail(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <ShieldCheck size={20} color="#DB2777" />
              <h3 style={{ margin: 0 }}>{detail.agencyName}</h3>
              {decisionBadge(detail.aiDecision)}
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              {([
                ['logoUrl', 'الشعار'],
                ['backgroundUrl', 'الخلفية'],
                ['idDocumentUrl', 'مستند الهوية'],
              ] as const).map(([key, label]) => {
                const url = detail[key];
                return url ? (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPreview({ url, label })}
                    style={{ padding: 0, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', cursor: 'pointer' }}
                  >
                    <img src={url} alt={label} style={{ width: 96, height: 96, objectFit: 'cover', display: 'block' }} />
                    <div style={{ fontSize: 11, padding: '2px 0', textAlign: 'center' }}>{label}</div>
                  </button>
                ) : null;
              })}
            </div>

            <div style={{ fontSize: 13, lineHeight: 1.8 }}>
              <div><strong>الوكيل:</strong> {detail.ownerName || detail.applicantName}</div>
              <div><strong>الدولة:</strong> {detail.countryCode}</div>
              <div><strong>واتساب:</strong> {detail.whatsappNumber || detail.applicantPhone || '—'}</div>
              <div><strong>الثقة:</strong> {detail.aiConfidence ?? 0}%</div>
              <div><strong>القرار:</strong> {detail.aiReason || '—'}</div>
              <div><strong>الحالة:</strong> {agencyApplicationStatusLabel(detail.status)}</div>
            </div>

            {Array.isArray(detail.aiChecks) && detail.aiChecks.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13 }}>فحوصات الذكاء الاصطناعي</div>
                {detail.aiChecks.map((c, i) => (
                  <div key={i} style={{ fontSize: 12, marginBottom: 3 }}>
                    <span style={{ color: c.pass === true ? '#059669' : c.pass === false ? '#DC2626' : '#6B7280' }}>
                      {c.pass === true ? '✓' : c.pass === false ? '✕' : '•'}
                    </span>{' '}
                    <strong>{CHECK_LABELS[c.key] ?? c.key}:</strong> {c.note || '—'}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              {(detail.status === 'pending' || detail.aiDecision === 'uncertain') && (
                <>
                  <button
                    className="btn"
                    style={{ background: '#10B981', color: '#fff', flex: 1 }}
                    disabled={processing === detail.id}
                    onClick={() => runReview(detail, 'approve')}
                  >
                    <Check size={16} /> موافقة يدوية
                  </button>
                  <button
                    className="btn"
                    style={{ background: '#EF4444', color: '#fff', flex: 1 }}
                    disabled={processing === detail.id}
                    onClick={() => runReview(detail, 'reject')}
                  >
                    <X size={16} /> رفض
                  </button>
                </>
              )}
              <button className="btn btn-ghost" onClick={() => setDetail(null)}>إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
