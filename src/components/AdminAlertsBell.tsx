import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, PartyPopper, Check, X } from 'lucide-react';
import { adminPath } from '@/lib/adminPaths';
import { useAdminAlerts } from '@/contexts/AdminAlertsContext';
import { reviewAgencyPartyRequest, timeAgo } from '@/services/admin';

export default function AdminAlertsBell() {
  const navigate = useNavigate();
  const { partyPending, partyPendingCount, refresh } = useAdminAlerts();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const handleReview = async (
    reqId: string,
    action: 'approve' | 'reject',
    description: string,
  ) => {
    if (action === 'approve') {
      if (!confirm(`الموافقة على حفلة "${description.slice(0, 50)}"؟`)) return;
    } else {
      const reason = prompt('سبب الرفض (اختياري):') ?? 'مرفوض';
      if (reason === null) return;
      setBusy(reqId);
      try {
        await reviewAgencyPartyRequest(reqId, 'reject', { rejectionReason: reason });
        await refresh();
      } catch (e: unknown) {
        alert('فشل: ' + ((e as Error)?.message ?? 'خطأ'));
      } finally {
        setBusy(null);
      }
      return;
    }
    setBusy(reqId);
    try {
      await reviewAgencyPartyRequest(reqId, 'approve');
      await refresh();
    } catch (e: unknown) {
      alert('فشل: ' + ((e as Error)?.message ?? 'خطأ'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="admin-alerts-bell" ref={rootRef}>
      <button
        type="button"
        className="topbar-icon-btn"
        onClick={() => setOpen((v) => !v)}
        title="تنبيهات الإدارة"
        aria-label="تنبيهات الإدارة"
      >
        <Bell size={20} />
        {partyPendingCount > 0 && (
          <span className="topbar-icon-badge topbar-icon-badge-count">
            {partyPendingCount > 9 ? '9+' : partyPendingCount}
          </span>
        )}
      </button>

      {open && (
        <div className="admin-alerts-panel">
          <div className="admin-alerts-panel-header">
            <strong>تنبيهات الإدارة</strong>
            {partyPendingCount > 0 && (
              <span className="admin-alerts-panel-count">{partyPendingCount} جديد</span>
            )}
          </div>

          {partyPendingCount === 0 ? (
            <div className="admin-alerts-empty">لا توجد طلبات حفلات معلّقة</div>
          ) : (
            <div className="admin-alerts-list">
              {partyPending.slice(0, 8).map((req) => (
                <div key={req.id} className="admin-alerts-item">
                  <div className="admin-alerts-item-icon">
                    <PartyPopper size={16} color="#d21e2a" />
                  </div>
                  <div className="admin-alerts-item-body">
                    <div className="admin-alerts-item-title">
                      {req.agencyName || 'وكالة'} · {req.requesterName}
                    </div>
                    <div className="admin-alerts-item-desc">{req.description}</div>
                    <div className="admin-alerts-item-meta">
                      {new Date(req.startAt).toLocaleString('ar')} · {timeAgo(req.createdAt)}
                    </div>
                    <div className="admin-alerts-item-actions">
                      <button
                        type="button"
                        className="btn-primary btn-sm"
                        disabled={busy === req.id}
                        onClick={() => void handleReview(req.id, 'approve', req.description)}
                      >
                        <Check size={14} /> موافقة
                      </button>
                      <button
                        type="button"
                        className="btn-danger btn-sm"
                        disabled={busy === req.id}
                        onClick={() => void handleReview(req.id, 'reject', req.description)}
                      >
                        <X size={14} /> رفض
                      </button>
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => {
                          setOpen(false);
                          navigate(adminPath(`/agencies/${req.agencyId}`));
                        }}
                      >
                        الوكالة
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="admin-alerts-panel-footer">
            <Link to={adminPath('/agencies')} className="admin-alerts-footer-link" onClick={() => setOpen(false)}>
              عرض في الوكالات
            </Link>
            <Link to={adminPath('/notifications')} className="admin-alerts-footer-link muted" onClick={() => setOpen(false)}>
              إرسال إشعار لمستخدم
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
