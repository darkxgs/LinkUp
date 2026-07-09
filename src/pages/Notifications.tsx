import { useEffect, useState } from 'react';
import {
  Send, Bell, Megaphone, Gift, AlertTriangle, Info, Users, Crown, Wifi, Eye,
  User, Shield, Ban, RotateCcw, Wallet, Search, CheckCircle,
} from 'lucide-react';
import { Loading, Empty, Badge } from '@/components/Common';
import {
  sendBroadcast,
  sendUserNotification,
  lookupUserByIdentifier,
  subscribeBroadcasts,
  logAdminAction,
  timeAgo,
  type BroadcastNotification,
  type AdminNotifyScenario,
} from '@/services/admin';

const BROADCAST_TYPES = [
  { id: 'info', label: 'معلومة', icon: Info, color: '#b00814' },
  { id: 'promo', label: 'عرض ترويجي', icon: Megaphone, color: '#d21e2a' },
  { id: 'reward', label: 'مكافأة', icon: Gift, color: '#10B981' },
  { id: 'warning', label: 'تحذير', icon: AlertTriangle, color: '#EF4444' },
];

const TARGETS = [
  { id: 'all', label: 'كل المستخدمين', icon: Users },
  { id: 'vip', label: 'أعضاء VIP فقط', icon: Crown },
  { id: 'active', label: 'النشطون (آخر أسبوع)', icon: Wifi },
];

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

type PageMode = 'broadcast' | 'user';

export default function NotificationsPage() {
  const [mode, setMode] = useState<PageMode>('user');

  // ——— Broadcast ———
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<BroadcastNotification['type']>('info');
  const [target, setTarget] = useState<BroadcastNotification['target']>('all');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState('');

  // ——— User targeted ———
  const [identifier, setIdentifier] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [resolvedUser, setResolvedUser] = useState<{
    uid: string;
    displayName: string;
    publicAccountId: string;
    isBanned?: boolean;
    withdrawalBlocked?: boolean;
  } | null>(null);
  const [scenario, setScenario] = useState<AdminNotifyScenario>('account_warning');
  const [userTitle, setUserTitle] = useState(USER_SCENARIOS[0].defaultTitle);
  const [userMessage, setUserMessage] = useState(USER_SCENARIOS[0].defaultMessage);
  const [reason, setReason] = useState('');
  const [applyAction, setApplyAction] = useState(true);
  const [userResult, setUserResult] = useState('');

  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    setLoadingHistory(true);
    const unsub = subscribeBroadcasts((b) => {
      setHistory(b);
      setLoadingHistory(false);
    });
    return unsub;
  }, []);

  const selectScenario = (id: AdminNotifyScenario) => {
    setScenario(id);
    const preset = USER_SCENARIOS.find((s) => s.id === id);
    if (preset) {
      setUserTitle(preset.defaultTitle);
      setUserMessage(preset.defaultMessage);
      setApplyAction(preset.hasAction);
    }
  };

  const handleLookup = async () => {
    if (!identifier.trim()) return;
    setLookupLoading(true);
    setResolvedUser(null);
    setUserResult('');
    try {
      const u = await lookupUserByIdentifier(identifier.trim());
      setResolvedUser(u);
    } catch (e: any) {
      setUserResult('لم يُعثر على المستخدم: ' + (e.message ?? ''));
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSendUser = async () => {
    if (!identifier.trim()) {
      setUserResult('أدخل معرّف المستخدم أو UID');
      return;
    }
    if (!userTitle.trim() || !userMessage.trim()) {
      setUserResult('العنوان والنص مطلوبان');
      return;
    }
    setSending(true);
    setUserResult('');
    try {
      const res = await sendUserNotification({
        identifier: identifier.trim(),
        scenario,
        title: userTitle.trim(),
        message: userMessage.trim(),
        applyAction,
        reason: reason.trim() || undefined,
      });
      await logAdminAction(
        'إشعار مستخدم',
        res.displayName,
        `${scenario} → ${res.targetUid}`,
      );
      setUserResult(
        `✓ أُرسل إلى ${res.displayName} (${res.publicAccountId || res.targetUid})`,
      );
      setResolvedUser({
        uid: res.targetUid,
        displayName: res.displayName,
        publicAccountId: res.publicAccountId,
      });
    } catch (e: any) {
      setUserResult('فشل الإرسال: ' + (e.message ?? ''));
    } finally {
      setSending(false);
    }
  };

  const handleSendBroadcast = async () => {
    if (!title.trim() || !body.trim()) {
      setResult('الرجاء إدخال العنوان والنص');
      return;
    }
    setSending(true);
    setResult('');
    try {
      const { sent } = await sendBroadcast({ title, body, type, target });
      await logAdminAction('إرسال إشعار جماعي', TARGETS.find((t) => t.id === target)?.label ?? target, title);
      setResult(
        `✓ أُرسل الإشعار إلى ${sent} مستخدم. عدد المشاهدات يظهر في السجل عند فتحهم الإشعار في التطبيق.`,
      );
      setTitle('');
      setBody('');
    } catch (e: any) {
      setResult('فشل الإرسال: ' + e.message);
    } finally {
      setSending(false);
    }
  };

  const activeScenario = USER_SCENARIOS.find((s) => s.id === scenario);

  return (
    <div className="page-container">
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button
          type="button"
          className={mode === 'user' ? 'btn btn-primary' : 'btn btn-ghost'}
          onClick={() => setMode('user')}
        >
          <User size={16} /> إشعار مستخدم (UID / معرّف)
        </button>
        <button
          type="button"
          className={mode === 'broadcast' ? 'btn btn-primary' : 'btn btn-ghost'}
          onClick={() => setMode('broadcast')}
        >
          <Megaphone size={16} /> إشعار جماعي
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }} className="notif-grid">
        {mode === 'user' ? (
          <div className="card">
            <div className="card-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={18} color="#e11212" /> إشعار لمستخدم محدد
              </h3>
            </div>
            <div className="card-body">
              <label className="form-label">معرّف المستخدم</label>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                Firebase UID كامل أو المعرف العام (8 أرقام)
              </p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <input
                  className="form-input"
                  style={{ flex: 1 }}
                  placeholder="مثال: 12345678 أو UID..."
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
                <button type="button" className="btn btn-ghost" onClick={handleLookup} disabled={lookupLoading}>
                  <Search size={16} /> {lookupLoading ? '...' : 'تحقق'}
                </button>
              </div>

              {resolvedUser && (
                <div
                  style={{
                    padding: 12,
                    marginBottom: 16,
                    borderRadius: 'var(--r-md)',
                    background: 'var(--bg-app)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <p style={{ fontWeight: 700 }}>{resolvedUser.displayName}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    UID: {resolvedUser.uid}
                    {resolvedUser.publicAccountId ? ` · معرّف: ${resolvedUser.publicAccountId}` : ''}
                  </p>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    {resolvedUser.isBanned && <Badge variant="danger">محظور</Badge>}
                    {resolvedUser.withdrawalBlocked && <Badge variant="warning">سحب موقوف</Badge>}
                    {!resolvedUser.isBanned && !resolvedUser.withdrawalBlocked && (
                      <Badge variant="success">نشط</Badge>
                    )}
                  </div>
                </div>
              )}

              <label className="form-label">السيناريو</label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                {USER_SCENARIOS.map((s) => {
                  const Icon = s.icon;
                  const active = scenario === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => selectScenario(s.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 12px',
                        borderRadius: 'var(--r-md)',
                        border: `1.5px solid ${active ? s.color : 'var(--border)'}`,
                        background: active ? `${s.color}10` : '#fff',
                        textAlign: 'right',
                        fontWeight: 600,
                        fontSize: 13,
                      }}
                    >
                      <Icon size={16} color={s.color} />
                      {s.label}
                    </button>
                  );
                })}
              </div>

              <div className="form-group">
                <label className="form-label">عنوان الإشعار</label>
                <input
                  className="form-input"
                  value={userTitle}
                  onChange={(e) => setUserTitle(e.target.value)}
                  maxLength={80}
                />
              </div>
              <div className="form-group">
                <label className="form-label">نص الإشعار (يظهر في التطبيق)</label>
                <textarea
                  className="form-input"
                  rows={4}
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  maxLength={400}
                />
              </div>
              <div className="form-group">
                <label className="form-label">سبب (اختياري — يُحفظ مع الحظر)</label>
                <input
                  className="form-input"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="مثال: مخالفة سياسة المحتوى"
                />
              </div>

              {activeScenario?.hasAction && (
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 14,
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={applyAction}
                    onChange={(e) => setApplyAction(e.target.checked)}
                  />
                  تطبيق الإجراء على الحساب (حظر / منع سحب / إلخ)
                </label>
              )}

              {userResult && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--r-md)',
                    marginBottom: 14,
                    fontSize: 13,
                    fontWeight: 600,
                    background: userResult.startsWith('✓')
                      ? 'rgba(16,185,129,0.1)'
                      : 'rgba(239,68,68,0.1)',
                    color: userResult.startsWith('✓') ? 'var(--success)' : 'var(--danger)',
                  }}
                >
                  {userResult}
                </div>
              )}

              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleSendUser}
                disabled={sending}
              >
                <Send size={16} /> {sending ? 'جارٍ الإرسال...' : 'إرسال للمستخدم'}
              </button>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Send size={18} color="#e11212" /> إنشاء إشعار جماعي
              </h3>
            </div>
            <div className="card-body">
              <label className="form-label">نوع الإشعار</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
                {BROADCAST_TYPES.map((t) => {
                  const Icon = t.icon;
                  const active = type === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setType(t.id as BroadcastNotification['type'])}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 14px',
                        borderRadius: 'var(--r-md)',
                        border: `1.5px solid ${active ? t.color : 'var(--border)'}`,
                        background: active ? `${t.color}12` : '#fff',
                        color: active ? t.color : 'var(--text-secondary)',
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      <Icon size={15} /> {t.label}
                    </button>
                  );
                })}
              </div>

              <label className="form-label">الفئة المستهدفة</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                {TARGETS.map((t) => {
                  const Icon = t.icon;
                  const active = target === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTarget(t.id as BroadcastNotification['target'])}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '12px 14px',
                        borderRadius: 'var(--r-md)',
                        border: `1.5px solid ${active ? 'var(--brand-primary)' : 'var(--border)'}`,
                        background: active ? 'rgba(225,18,18,0.06)' : '#fff',
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                    >
                      <Icon size={18} /> {t.label}
                    </button>
                  );
                })}
              </div>

              <div className="form-group">
                <label className="form-label">العنوان</label>
                <input
                  className="form-input"
                  placeholder="مثال: عرض خاص اليوم!"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={60}
                />
              </div>
              <div className="form-group">
                <label className="form-label">النص</label>
                <textarea
                  className="form-input"
                  rows={4}
                  placeholder="اكتب نص الإشعار..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={200}
                />
              </div>

              {result && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--r-md)',
                    marginBottom: 14,
                    fontSize: 13,
                    fontWeight: 600,
                    background: result.startsWith('✓') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    color: result.startsWith('✓') ? 'var(--success)' : 'var(--danger)',
                  }}
                >
                  {result}
                </div>
              )}

              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleSendBroadcast}
                disabled={sending}
              >
                <Send size={16} /> {sending ? 'جارٍ الإرسال...' : 'إرسال الإشعار الجماعي'}
              </button>
            </div>
          </div>
        )}

        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <h3>معاينة (كما في التطبيق)</h3>
            </div>
            <div className="card-body">
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  padding: 14,
                  background: 'var(--bg-app)',
                  borderRadius: 'var(--r-md)',
                  borderRight: `4px solid ${
                    mode === 'user'
                      ? activeScenario?.color ?? '#e11212'
                      : BROADCAST_TYPES.find((t) => t.id === type)?.color
                  }`,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    flexShrink: 0,
                    background: 'rgba(225,18,18,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {mode === 'user' ? (
                    activeScenario ? (
                      <activeScenario.icon size={22} color={activeScenario.color} />
                    ) : (
                      <Bell size={22} color="#e11212" />
                    )
                  ) : (
                    <Bell size={22} color={BROADCAST_TYPES.find((t) => t.id === type)?.color} />
                  )}
                </div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 15 }}>
                    {mode === 'user' ? userTitle || 'عنوان الإشعار' : title || 'عنوان الإشعار'}
                  </p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>
                    {mode === 'user'
                      ? userMessage || 'نص الإشعار...'
                      : body || 'نص الإشعار...'}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                    من: إدارة LinkUp
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>سجل البث الجماعي</h3>
            </div>
            {loadingHistory ? (
              <Loading />
            ) : history.length === 0 ? (
              <Empty text="لم تُرسل إشعارات جماعية بعد" />
            ) : (
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {history.slice(0, 8).map((h) => (
                  <div
                    key={h.id}
                    style={{
                      padding: 12,
                      background: 'var(--bg-app)',
                      borderRadius: 'var(--r-md)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 700, fontSize: 14 }}>{h.title}</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        {timeAgo(h.createdAt)} · أُرسل لـ {h.sentCount ?? 0}
                      </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                      <Badge variant="green">
                        <Eye size={11} /> شاهدوه {h.viewCount ?? 0}
                      </Badge>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {h.sentCount
                          ? `${Math.round(((h.viewCount ?? 0) / h.sentCount) * 100)}% من المُرسَل`
                          : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
