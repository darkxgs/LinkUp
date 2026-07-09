import { useState } from 'react';
import {
  Bell, Shield, Ban, CheckCircle, Wallet, RotateCcw, AlertTriangle, Info, X,
} from 'lucide-react';
import {
  sendUserNotification,
  logAdminAction,
  type AdminNotifyScenario,
  type AdminUser,
} from '@/services/admin';

const USER_SCENARIOS: {
  id: AdminNotifyScenario;
  label: string;
  icon: typeof Shield;
  color: string;
  defaultTitle: string;
  defaultMessage: string;
  hasAction: boolean;
}[] = [
  {
    id: 'account_warning',
    label: 'إنذار',
    icon: AlertTriangle,
    color: '#F59E0B',
    defaultTitle: 'تنبيه من الإدارة',
    defaultMessage: 'تم إنذارك بسبب مخالفة قواعد المنصة.',
    hasAction: true,
  },
  {
    id: 'account_banned',
    label: 'حظر الحساب',
    icon: Ban,
    color: '#EF4444',
    defaultTitle: 'تم حظر حسابك',
    defaultMessage: 'تم حظر حسابك. لا يمكنك استخدام التطبيق حتى رفع الحظر.',
    hasAction: true,
  },
  {
    id: 'account_unbanned',
    label: 'رفع الحظر',
    icon: CheckCircle,
    color: '#10B981',
    defaultTitle: 'تم رفع الحظر',
    defaultMessage: 'تم إعادة تفعيل حسابك.',
    hasAction: true,
  },
  {
    id: 'withdrawal_blocked',
    label: 'منع السحب',
    icon: Wallet,
    color: '#DC2626',
    defaultTitle: 'منع عمليات السحب',
    defaultMessage: 'تم تعليق عمليات السحب على حسابك مؤقتاً.',
    hasAction: true,
  },
  {
    id: 'withdrawal_unblocked',
    label: 'تفعيل السحب',
    icon: RotateCcw,
    color: '#b00814',
    defaultTitle: 'تفعيل السحب',
    defaultMessage: 'يمكنك الآن تقديم طلبات السحب.',
    hasAction: true,
  },
  {
    id: 'verification_required',
    label: 'طلب تحقق',
    icon: Shield,
    color: '#e11212',
    defaultTitle: 'التحقق مطلوب',
    defaultMessage: 'يرجى إكمال التحقق من الهوية.',
    hasAction: false,
  },
  {
    id: 'content_removed',
    label: 'إزالة محتوى',
    icon: Info,
    color: '#6B7280',
    defaultTitle: 'إزالة محتوى',
    defaultMessage: 'تم إزالة محتوى مخالف من حسابك.',
    hasAction: false,
  },
  {
    id: 'custom',
    label: 'نص مخصص',
    icon: Bell,
    color: '#f05a5a',
    defaultTitle: 'إشعار من الإدارة',
    defaultMessage: '',
    hasAction: false,
  },
];

type Props = {
  user: Pick<AdminUser, 'uid' | 'displayName' | 'publicAccountId' | 'avatar'>;
  onClose: () => void;
  onSent?: () => void;
};

export function NotifyUserModal({ user, onClose, onSent }: Props) {
  const [scenario, setScenario] = useState<AdminNotifyScenario>('custom');
  const [title, setTitle] = useState('إشعار من الإدارة');
  const [message, setMessage] = useState('');
  const [applyAction, setApplyAction] = useState(false);
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState('');

  const selectScenario = (id: AdminNotifyScenario) => {
    setScenario(id);
    const preset = USER_SCENARIOS.find((s) => s.id === id);
    if (preset) {
      setTitle(preset.defaultTitle);
      setMessage(preset.defaultMessage);
      setApplyAction(preset.hasAction);
    }
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      setResult('العنوان والنص مطلوبان');
      return;
    }
    setSending(true);
    setResult('');
    try {
      const res = await sendUserNotification({
        identifier: user.publicAccountId || user.uid,
        scenario,
        title: title.trim(),
        message: message.trim(),
        applyAction,
        reason: reason.trim() || undefined,
      });
      await logAdminAction('إشعار مستخدم', res.displayName, `${scenario} → ${res.targetUid}`);
      setResult(`✓ أُرسل إلى ${res.displayName}`);
      onSent?.();
    } catch (e: unknown) {
      setResult('فشل الإرسال: ' + (e instanceof Error ? e.message : ''));
    } finally {
      setSending(false);
    }
  };

  const active = USER_SCENARIOS.find((s) => s.id === scenario);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bell size={18} color="#e11212" />
            إشعار — {user.displayName}
          </h3>
          <button type="button" className="action-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <img
              src={user.avatar || `https://i.pravatar.cc/80?u=${user.uid}`}
              alt=""
              style={{ width: 48, height: 48, borderRadius: '50%' }}
            />
            <div>
              <p style={{ margin: 0, fontWeight: 700 }}>{user.displayName}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                {user.publicAccountId || user.uid}
              </p>
            </div>
          </div>

          <label className="form-label">سيناريو الإشعار</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {USER_SCENARIOS.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`btn btn-sm ${scenario === s.id ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => selectScenario(s.id)}
                >
                  <Icon size={14} /> {s.label}
                </button>
              );
            })}
          </div>

          <label className="form-label">العنوان</label>
          <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} />

          <label className="form-label" style={{ marginTop: 12 }}>النص</label>
          <textarea
            className="form-input"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="نص الإشعار الذي يظهر في التطبيق..."
          />

          {active?.hasAction ? (
            <>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13 }}>
                <input type="checkbox" checked={applyAction} onChange={(e) => setApplyAction(e.target.checked)} />
                تطبيق الإجراء على الحساب (حظر / رفع حظر / منع سحب...)
              </label>
              <label className="form-label" style={{ marginTop: 8 }}>سبب (اختياري)</label>
              <input className="form-input" value={reason} onChange={(e) => setReason(e.target.value)} />
            </>
          ) : null}

          {result ? (
            <p style={{
              marginTop: 12,
              fontSize: 13,
              color: result.startsWith('✓') ? 'var(--success)' : 'var(--danger)',
            }}>
              {result}
            </p>
          ) : null}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-primary" onClick={handleSend} disabled={sending}>
            {sending ? 'جاري الإرسال...' : 'إرسال الإشعار'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>إغلاق</button>
        </div>
      </div>
    </div>
  );
}
