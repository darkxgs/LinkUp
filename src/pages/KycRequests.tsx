/**
 * Admin — صفحة طلبات التحقق من الهوية (KYC)
 * تعرض طلبات التوثيق اليدوي والآلي مع الصور والبيانات الشخصية
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check, X, Clock, CheckCircle2, XCircle, Eye, ShieldCheck, Sparkles, User, FileText,
  ShieldOff, RotateCcw, ExternalLink,
} from 'lucide-react';
import { Loading, Empty, Badge } from '@/components/Common';
import {
  logAdminAction,
  formatDate,
  getKycRequests,
  approveKycRequest,
  rejectKycRequest,
  revokeKycVerification,
  type AdminKycRequest,
} from '@/services/admin';
import { useAdminProfile } from '@/contexts/AdminProfileContext';
import { adminPath } from '@/lib/adminPaths';

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';
type FilterMethod = 'all' | 'manual' | 'ai';

export default function KycRequestsPage() {
  const { isSuper, profile, can } = useAdminProfile();
  const [items, setItems] = useState<AdminKycRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('pending');
  const [filterMethod, setFilterMethod] = useState<FilterMethod>('all');
  const [processing, setProcessing] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await getKycRequests(200));
    } catch (e) {
      console.error('load KYC requests error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleApprove = async (req: AdminKycRequest) => {
    if (!confirm(`هل أنت متأكد من قبول وتوثيق حساب ${req.displayName}؟`)) return;
    setProcessing(req.uid);
    try {
      await approveKycRequest(req.uid);
      await logAdminAction('قبول طلب التوثيق (KYC)', req.uid, req.displayName);
      await load();
    } catch (e: any) {
      alert('فشل قبول التوثيق: ' + (e?.message ?? 'خطأ'));
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (req: AdminKycRequest) => {
    const reason = prompt('سبب رفض طلب التوثيق (سيظهر للمستخدم):');
    if (reason === null) return; // cancelled
    if (!reason.trim()) {
      alert('يجب إدخال سبب الرفض لتنبيه المستخدم');
      return;
    }
    setProcessing(req.uid);
    try {
      await rejectKycRequest(req.uid, reason.trim());
      await logAdminAction('رفض طلب التوثيق (KYC)', req.uid, reason.trim());
      await load();
    } catch (e: any) {
      alert('فشل رفض التوثيق: ' + (e?.message ?? 'خطأ'));
    } finally {
      setProcessing(null);
    }
  };

  const handleRevoke = async (req: AdminKycRequest) => {
    const reason = prompt(
      `سبب إلغاء توثيق ${req.displayName} (سيُرسل للمستخدم ويُلغى شارة التوثيق):`,
      'تم إلغاء التوثيق من الإدارة',
    );
    if (reason === null) return;
    if (!reason.trim()) {
      alert('يجب إدخال سبب الإلغاء');
      return;
    }
    if (!confirm(`تأكيد إلغاء توثيق ${req.displayName}؟ لن يظهر كحساب موثّق في التطبيق.`)) return;
    setProcessing(req.uid);
    try {
      await revokeKycVerification(req.uid, reason.trim());
      await logAdminAction('إلغاء توثيق المستخدم (KYC)', req.uid, reason.trim());
      await load();
    } catch (e: any) {
      alert('فشل إلغاء التوثيق: ' + (e?.message ?? 'خطأ'));
    } finally {
      setProcessing(null);
    }
  };

  const handleReapprove = async (req: AdminKycRequest) => {
    if (!confirm(`إعادة توثيق حساب ${req.displayName} بناءً على الطلب الحالي؟`)) return;
    setProcessing(req.uid);
    try {
      await approveKycRequest(req.uid);
      await logAdminAction('إعادة توثيق المستخدم (KYC)', req.uid, req.displayName);
      await load();
    } catch (e: any) {
      alert('فشل إعادة التوثيق: ' + (e?.message ?? 'خطأ'));
    } finally {
      setProcessing(null);
    }
  };

  const filtered = items.filter((req) => {
    if (filterStatus !== 'all' && req.status !== filterStatus) return false;
    if (filterMethod !== 'all' && req.method !== filterMethod) return false;
    return true;
  });

  const counts = {
    pending: items.filter((i) => i.status === 'pending').length,
    approved: items.filter((i) => i.status === 'approved').length,
    rejected: items.filter((i) => i.status === 'rejected').length,
    ai: items.filter((i) => i.method === 'ai').length,
    manual: items.filter((i) => i.method === 'manual').length,
  };

  const statusBadge = (req: AdminKycRequest) => {
    if (req.status === 'approved') {
      return <Badge variant="green">مكتمل وموثق</Badge>;
    }
    if (req.status === 'rejected') {
      if (req.revokedAt) {
        return <Badge variant="red">ملغى من الإدارة</Badge>;
      }
      return <Badge variant="red">مرفوض</Badge>;
    }
    if (req.status === 'processing') {
      return <Badge variant="gold">قيد المعالجة</Badge>;
    }
    return <Badge variant="gold">بانتظار المراجعة</Badge>;
  };

  const methodBadge = (m: string) => {
    if (m === 'ai' || m === 'face') {
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px',
          borderRadius: 12, fontSize: 11, fontWeight: 'bold', background: '#FDF2F8', color: '#DB2777',
          border: '1px solid #FBCFE8'
        }}>
          <Sparkles size={12} /> {m === 'face' ? 'تحقق بالوجه (AI)' : 'تلقائي (AI)'}
        </span>
      );
    }
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px',
        borderRadius: 12, fontSize: 11, fontWeight: 'bold', background: '#EFF6FF', color: '#8b0000',
        border: '1px solid #BFDBFE'
      }}>
        <User size={12} /> يدوي (مستندات)
      </span>
    );
  };

  return (
    <div className="page-container">
      {!isSuper && (
        <div className="agency-alert-banner" style={{ marginBottom: 16 }}>
          طلبات التوثيق والإحصائيات هنا تخص دولتك فقط: {(profile?.countries ?? []).join('، ') || '—'}
        </div>
      )}

      {/* Stats Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(245,158,11,0.15)' }}>
            <Clock size={26} color="#F59E0B" />
          </div>
          <div className="stat-card-value">{counts.pending}</div>
          <div className="stat-card-label">طلبات قيد المراجعة</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(16,185,129,0.12)' }}>
            <CheckCircle2 size={26} color="#10B981" />
          </div>
          <div className="stat-card-value">{counts.approved}</div>
          <div className="stat-card-label">الحسابات الموثقة</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(239,68,68,0.12)' }}>
            <XCircle size={26} color="#EF4444" />
          </div>
          <div className="stat-card-value">{counts.rejected}</div>
          <div className="stat-card-label">طلبات مرفوضة</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(219,39,119,0.12)' }}>
            <Sparkles size={26} color="#DB2777" />
          </div>
          <div className="stat-card-value">{counts.ai}</div>
          <div className="stat-card-label">تدقيق ذكاء اصطناعي</div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="tabs" style={{ marginBottom: 0 }}>
          {([
            { id: 'pending', label: `قيد المراجعة (${counts.pending})` },
            { id: 'approved', label: `المقبولة (${counts.approved})` },
            { id: 'rejected', label: `المرفوضة (${counts.rejected})` },
            { id: 'all', label: 'الكل' },
          ] as { id: FilterStatus; label: string }[]).map((t) => (
            <button
              key={t.id}
              className={`tab ${filterStatus === t.id ? 'active' : ''}`}
              onClick={() => setFilterStatus(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <select
          className="filter-select"
          value={filterMethod}
          onChange={(e) => setFilterMethod(e.target.value as FilterMethod)}
          style={{ marginRight: 'auto' }}
        >
          <option value="all">كل طرق التحقق</option>
          <option value="manual">التحقق اليدوي (مستندات)</option>
          <option value="ai">التحقق بالذكاء الاصطناعي (AI)</option>
        </select>

        <button className="btn btn-ghost btn-sm" onClick={load}>تحديث</button>
      </div>

      {/* Data Table */}
      <div className="card">
        {loading ? <Loading /> : filtered.length === 0 ? <Empty text="لا توجد طلبات تحقق حالية" /> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>المضيف</th>
                  <th>طريقة التحقق</th>
                  <th>البيانات الرسمية</th>
                  <th>الوثائق والمستندات المرفقة</th>
                  <th>التاريخ</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((req) => {
                  const verificationImage = req.selfie || req.verificationFrameUrl || '';
                  return (
                  <tr key={req.id}>
                    {/* User profile details */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <img
                          src={req.avatar || '/placeholder.png'}
                          onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.png'; }}
                          style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }}
                          alt="avatar"
                        />
                        <div>
                          <div style={{ fontWeight: 700 }}>{req.displayName}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {req.gender === 'female' ? '👩 مضيفة' : '👨 مضيف'}
                          </div>
                          <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                            {req.uid}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Method Badge */}
                    <td>
                      {methodBadge(req.method)}
                    </td>

                    {/* Personal data details */}
                    <td>
                      {req.method === 'manual' ? (
                        <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                          <div><strong>الاسم الكامل:</strong> {req.fullName || '—'}</div>
                          <div><strong>الميلاد:</strong> {req.birthDate || '—'}</div>
                          <div><strong>الجنسية:</strong> {req.nationality || '—'}</div>
                          <div><strong>الجوال:</strong> {req.phoneNumber || '—'}</div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                          <div><strong>الاسم:</strong> {req.fullName || req.displayName || '—'}</div>
                          {req.method === 'ai' && (
                            <>
                              <div><strong>الميلاد:</strong> {req.birthDate || '—'}</div>
                              <div><strong>الجنسية:</strong> {req.nationality || '—'}</div>
                            </>
                          )}
                          {req.aiGender ? (
                            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                              AI: {req.aiGender === 'female' ? 'أنثى' : req.aiGender === 'male' ? 'ذكر' : 'غير محدد'}
                              {typeof req.aiConfidence === 'number' ? ` (${req.aiConfidence}%)` : ''}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </td>

                    {/* Photo previews */}
                    <td>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {verificationImage ? (
                          <div style={{ textAlign: 'center' }}>
                            <div
                              style={{ position: 'relative', width: 56, height: 56, borderRadius: 6, overflow: 'hidden', border: '1px solid #ddd', cursor: 'pointer' }}
                              onClick={() => setPreviewImage(verificationImage)}
                            >
                              <img src={verificationImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="verification" />
                              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center' }}>
                                <Eye size={10} color="white" />
                              </div>
                            </div>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                              {req.method === 'face' || req.method === 'ai' ? 'صورة التحقق AI' : 'صورة شخصية'}
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                        )}

                        {req.method === 'manual' && req.idFront && (
                          <div style={{ textAlign: 'center' }}>
                            <div
                              style={{ position: 'relative', width: 56, height: 56, borderRadius: 6, overflow: 'hidden', border: '1px solid #ddd', cursor: 'pointer' }}
                              onClick={() => setPreviewImage(req.idFront)}
                            >
                              <img src={req.idFront} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="idFront" />
                              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center' }}>
                                <Eye size={10} color="white" />
                              </div>
                            </div>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>الهوية (أمام)</span>
                          </div>
                        )}

                        {req.method === 'manual' && req.idBack && (
                          <div style={{ textAlign: 'center' }}>
                            <div
                              style={{ position: 'relative', width: 56, height: 56, borderRadius: 6, overflow: 'hidden', border: '1px solid #ddd', cursor: 'pointer' }}
                              onClick={() => setPreviewImage(req.idBack)}
                            >
                              <img src={req.idBack} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="idBack" />
                              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center' }}>
                                <Eye size={10} color="white" />
                              </div>
                            </div>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>الهوية (خلف)</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Date */}
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {formatDate(req.createdAt)}
                    </td>

                    {/* Status details */}
                    <td>
                      {statusBadge(req)}
                      {req.approvedAt && req.status === 'approved' && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                          وُثّق: {formatDate(req.approvedAt)}
                        </div>
                      )}
                      {req.revokedAt && (
                        <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>
                          أُلغي: {formatDate(req.revokedAt)}
                        </div>
                      )}
                      {req.rejectionReason && (
                        <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4, maxWidth: 160 }}>
                          <strong>السبب:</strong> {req.rejectionReason}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td>
                      <div className="action-btns" style={{ flexWrap: 'wrap' }}>
                        <Link
                          to={adminPath(`/users/${req.uid}`)}
                          className="action-icon"
                          title="فتح ملف المستخدم"
                          style={{ textDecoration: 'none' }}
                        >
                          <ExternalLink size={16} />
                        </Link>

                        {req.status === 'pending' && (
                          <>
                            {(isSuper || can('kyc:approve')) && (
                              <button
                                className="action-icon ok"
                                disabled={processing === req.uid}
                                onClick={() => handleApprove(req)}
                                title="قبول وتوثيق"
                              >
                                <Check size={16} />
                              </button>
                            )}
                            {(isSuper || can('kyc:reject')) && (
                              <button
                                className="action-icon ban"
                                disabled={processing === req.uid}
                                onClick={() => handleReject(req)}
                                title="رفض الطلب"
                              >
                                <X size={16} />
                              </button>
                            )}
                          </>
                        )}

                        {(isSuper || can('kyc:reject')) && req.status === 'approved' && (
                          <button
                            className="action-icon ban"
                            disabled={processing === req.uid}
                            onClick={() => handleRevoke(req)}
                            title="إلغاء التوثيق"
                          >
                            <ShieldOff size={16} />
                          </button>
                        )}

                        {(isSuper || can('kyc:approve')) && req.status === 'rejected' && (
                          <button
                            className="action-icon ok"
                            disabled={processing === req.uid}
                            onClick={() => handleReapprove(req)}
                            title="إعادة التوثيق"
                          >
                            <RotateCcw size={16} />
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

      {/* Image Preview Overlay Modal */}
      {previewImage && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex',
            justifyContent: 'center', alignItems: 'center', zIndex: 1000,
          }}
          onClick={() => setPreviewImage(null)}
        >
          <div
            style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }}
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking on image
          >
            <img
              src={previewImage}
              style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
              alt="Preview"
            />
            <button
              style={{
                position: 'absolute', top: -40, right: 0, background: '#EF4444', border: 'none',
                color: 'white', fontSize: 13, cursor: 'pointer', padding: '6px 16px', borderRadius: 20, fontWeight: 'bold'
              }}
              onClick={() => setPreviewImage(null)}
            >
              إغلاق ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
