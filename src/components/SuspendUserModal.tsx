import { useState } from 'react';
import { Lock, X } from 'lucide-react';
import { suspendUser, logAdminAction, type AdminUser } from '@/services/admin';

type Props = {
  user: Pick<AdminUser, 'uid' | 'displayName' | 'publicAccountId' | 'avatar'>;
  onClose: () => void;
  onSaved: () => void;
};

const QUICK_DAYS = [1, 3, 7, 14, 30];

export function SuspendUserModal({ user, onClose, onSaved }: Props) {
  const [days, setDays] = useState(7);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSuspend = async () => {
    if (!Number.isFinite(days) || days <= 0) {
      setError('أدخل عدد أيام صحيح');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await suspendUser(user.uid, days, reason.trim() || undefined);
      await logAdminAction('تعليق مستخدم', user.displayName, `${days} يوم${reason.trim() ? ` — ${reason.trim()}` : ''}`);
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'فشل التعليق');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lock size={18} color="#F59E0B" />
            تعليق حساب — {user.displayName}
          </h3>
          <button type="button" className="action-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <label className="form-label">مدة التعليق (بالأيام)</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {QUICK_DAYS.map((d) => (
              <button
                key={d}
                type="button"
                className={`btn btn-sm ${days === d ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setDays(d)}
              >
                {d} يوم
              </button>
            ))}
          </div>
          <input
            className="form-input"
            type="number"
            min={1}
            value={days}
            onChange={(e) => setDays(Number(e.target.value) || 0)}
          />

          <label className="form-label" style={{ marginTop: 14 }}>سبب التعليق (اختياري)</label>
          <textarea
            className="form-input"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="مثال: مخالفة قواعد الدردشة..."
          />

          <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            سيُحجب المستخدم فوراً من التطبيق (نفس آلية الحظر) حتى انتهاء المدة أو رفع التعليق يدوياً.
          </p>

          {error ? <p style={{ marginTop: 8, fontSize: 13, color: 'var(--danger)' }}>{error}</p> : null}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-primary" onClick={() => void handleSuspend()} disabled={saving}>
            {saving ? 'جارٍ التعليق...' : 'تعليق الحساب'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </div>
  );
}
