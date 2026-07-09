import { useEffect, useState } from 'react';
import {
  Check, X, Clock, ArrowDownToLine, ArrowUpFromLine, CheckCircle2, XCircle, Download, Coins, Zap,
} from 'lucide-react';
import { Loading, Empty, Badge } from '@/components/Common';
import { CopyableId } from '@/components/CopyableId';
import {
  getTransactions, updateTransactionStatus, logAdminAction, exportToCSV,
  grantCoinsByAccountId, formatNumber, formatDate,
  lookupUserByIdentifier,
  type AdminTransaction,
} from '@/services/admin';
import { useAdminProfile } from '@/contexts/AdminProfileContext';

export default function WalletPage() {
  const { isSuper, profile } = useAdminProfile();
  const [txs, setTxs] = useState<AdminTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'recharge' | 'withdraw' | 'pending'>('pending');

  const [accountId, setAccountId] = useState('');
  const [grantAmount, setGrantAmount] = useState('');
  const [grantNote, setGrantNote] = useState('');
  const [granting, setGranting] = useState(false);
  const [grantMsg, setGrantMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [lookupPreview, setLookupPreview] = useState<{
    displayName: string;
    publicAccountId: string;
    coins: number;
  } | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  const load = () => {
    setLoading(true);
    getTransactions(200).then((t) => {
      setTxs(t);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const handleLookup = async () => {
    const id = accountId.trim();
    if (!id) {
      setLookupPreview(null);
      return;
    }
    setLookupLoading(true);
    try {
      const u = await lookupUserByIdentifier(id);
      if (!u) {
        setLookupPreview(null);
        setGrantMsg({ ok: false, text: 'لم يُعثر على حساب بهذا المعرّف' });
      } else {
        setLookupPreview({
          displayName: u.displayName,
          publicAccountId: u.publicAccountId,
          coins: u.coins ?? 0,
        });
        setGrantMsg(null);
      }
    } catch {
      setLookupPreview(null);
    } finally {
      setLookupLoading(false);
    }
  };

  const filtered = txs.filter((t) => {
    if (tab === 'all') return true;
    if (tab === 'pending') return t.status === 'pending';
    if (tab === 'recharge') return t.type === 'recharge';
    if (tab === 'withdraw') return t.type === 'withdraw';
    return true;
  });

  const handleStatus = async (id: string, status: string) => {
    try {
      await updateTransactionStatus(id, status);
      await logAdminAction(
        status === 'completed' ? 'موافقة على معاملة (شحن فعلي)' : 'رفض معاملة',
        id.slice(0, 12),
        status,
      );
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'فشل تحديث المعاملة');
    }
  };

  const handleGrant = async () => {
    const amount = Math.floor(Number(grantAmount) || 0);
    if (!accountId.trim()) {
      setGrantMsg({ ok: false, text: 'أدخل معرّف الحساب (8 أرقام)' });
      return;
    }
    if (amount <= 0) {
      setGrantMsg({ ok: false, text: 'أدخل عدد عملات أكبر من صفر' });
      return;
    }
    if (!confirm(`شحن ${formatNumber(amount)} عملة للحساب ${accountId.trim()}؟`)) return;

    setGranting(true);
    setGrantMsg(null);
    try {
      const res = await grantCoinsByAccountId(
        accountId.trim(),
        amount,
        grantNote.trim() || undefined,
      );
      await logAdminAction(
        'شحن عملات بالمعرّف',
        res.displayName,
        `${res.publicAccountId}: +${amount} (${res.previousBalance} → ${res.newBalance})`,
      );
      setGrantMsg({
        ok: true,
        text:
          `تم الشحن لـ ${res.displayName} (معرّف ${res.publicAccountId}): +${formatNumber(amount)} عملة` +
          (res.firstRechargeBonus
            ? ` + ${formatNumber(res.firstRechargeBonus)} هدية أول شحن`
            : '') +
          ` — الرصيد الآن ${formatNumber(res.newBalance)}`,
      });
      setGrantAmount('');
      setLookupPreview({
        displayName: res.displayName,
        publicAccountId: res.publicAccountId,
        coins: res.newBalance,
      });
      load();
    } catch (e: unknown) {
      setGrantMsg({
        ok: false,
        text: e instanceof Error ? e.message : 'فشل الشحن',
      });
    } finally {
      setGranting(false);
    }
  };

  const handleExport = () => {
    exportToCSV(
      filtered.map((t) => ({
        المعرّف: t.id,
        المستخدم: t.uid,
        النوع: t.type,
        المبلغ: Math.abs(t.amount),
        الوصف: t.itemName ?? '',
        الحالة: t.status,
        التاريخ: formatDate(t.createdAt),
      })),
      'المعاملات',
    );
  };

  const pendingCount = txs.filter((t) => t.status === 'pending').length;
  const totalRecharge = txs.filter((t) => t.type === 'recharge' && t.status === 'completed')
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalWithdraw = txs.filter((t) => t.type === 'withdraw' && t.status === 'completed')
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <div className="page-container">
      {!isSuper && (
        <div className="agency-alert-banner" style={{ marginBottom: 16 }}>
          المعاملات والشحن هنا لمستخدمي دولتك فقط: {(profile?.countries ?? []).join('، ') || '—'}
        </div>
      )}
      <div className="grant-card">
        <h3><Zap size={20} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 6 }} /> شحن سريع بالمعرّف</h3>
        <p>
          أدخل معرّف الحساب (8 أرقام من التطبيق) أو Firebase UID. يُضاف الرصيد مباشرة في Firestore
          ويظهر فوراً في تطبيق المستخدم.
        </p>
        <div className="grant-form">
          <div>
            <label className="form-label">معرّف الحساب</label>
            <input
              className="form-input"
              placeholder="مثال: 92397968"
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value);
                setLookupPreview(null);
              }}
              onBlur={handleLookup}
              inputMode="numeric"
            />
            {lookupLoading ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>جاري البحث...</p>
            ) : lookupPreview ? (
              <div style={{ marginTop: 8, padding: 10, background: 'var(--bg-secondary)', borderRadius: 10, fontSize: 13 }}>
                <strong>{lookupPreview.displayName}</strong>
                <span style={{ color: 'var(--text-muted)', marginInlineStart: 8 }}>
                  معرّف {lookupPreview.publicAccountId} — رصيد {formatNumber(lookupPreview.coins)}
                </span>
              </div>
            ) : null}
          </div>
          <div>
            <label className="form-label">عدد العملات</label>
            <input
              className="form-input"
              type="number"
              min={1}
              placeholder="10000"
              value={grantAmount}
              onChange={(e) => setGrantAmount(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn-gold"
            onClick={handleGrant}
            disabled={granting}
          >
            <Coins size={18} />
            {granting ? 'جاري الشحن...' : 'شحن الآن'}
          </button>
        </div>
        <div style={{ marginTop: 10 }}>
          <label className="form-label">ملاحظة (اختياري)</label>
          <input
            className="form-input"
            placeholder="هدية / تعويض / عرض..."
            value={grantNote}
            onChange={(e) => setGrantNote(e.target.value)}
          />
        </div>
        {grantMsg ? (
          <div className={`grant-result ${grantMsg.ok ? '' : 'error'}`}>{grantMsg.text}</div>
        ) : null}
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(16,185,129,0.12)' }}>
            <ArrowDownToLine size={26} color="#10B981" />
          </div>
          <div className="stat-card-value">{formatNumber(totalRecharge)}</div>
          <div className="stat-card-label">إجمالي الشحن</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(239,68,68,0.12)' }}>
            <ArrowUpFromLine size={26} color="#EF4444" />
          </div>
          <div className="stat-card-value">{formatNumber(totalWithdraw)}</div>
          <div className="stat-card-label">إجمالي السحب</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(245,158,11,0.15)' }}>
            <Clock size={26} color="#F59E0B" />
          </div>
          <div className="stat-card-value">{pendingCount}</div>
          <div className="stat-card-label">طلبات معلّقة</div>
        </div>
      </div>

      {pendingCount > 0 && tab !== 'pending' ? (
        <p style={{ fontSize: 13, color: 'var(--warning)', marginBottom: 12 }}>
          يوجد {pendingCount} معاملة معلّقة — عند الموافقة على «شحن» يُضاف الرصيد تلقائياً للمستخدم.
        </p>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          {[
            { id: 'pending', label: `المعلّقة (${pendingCount})` },
            { id: 'recharge', label: 'الشحن' },
            { id: 'withdraw', label: 'السحب' },
            { id: 'all', label: 'الكل' },
          ].map((t) => (
            <button
              key={t.id}
              className={`tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id as typeof tab)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm" style={{ marginRight: 'auto' }} onClick={handleExport}>
          <Download size={16} /> تصدير
        </button>
      </div>

      <div className="card">
        {loading ? <Loading /> : filtered.length === 0 ? <Empty text="لا توجد معاملات" /> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>النوع</th>
                  <th>المستخدم</th>
                  <th>المبلغ</th>
                  <th>الوصف</th>
                  <th>التاريخ</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id}>
                    <td>
                      {t.type === 'recharge' ? (
                        <Badge variant="green"><ArrowDownToLine size={12} /> شحن</Badge>
                      ) : t.type === 'withdraw' ? (
                        <Badge variant="red"><ArrowUpFromLine size={12} /> سحب</Badge>
                      ) : t.type === 'admin_grant' ? (
                        <Badge variant="purple"><Coins size={12} /> إدارة</Badge>
                      ) : (
                        <Badge variant="purple">{t.type}</Badge>
                      )}
                    </td>
                    <td style={{ fontSize: 13, fontFamily: 'monospace' }}>{t.uid?.slice(0, 12)}...</td>
                    <td style={{ fontWeight: 700 }}>{formatNumber(Math.abs(t.amount))}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{t.itemName || '-'}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{formatDate(t.createdAt)}</td>
                    <td>
                      {t.status === 'completed' ? <Badge variant="green">مكتمل</Badge> :
                       t.status === 'pending' ? <Badge variant="gold">معلّق</Badge> :
                       t.status === 'rejected' ? <Badge variant="red">مرفوض</Badge> :
                       <Badge variant="gray">{t.status}</Badge>}
                    </td>
                    <td>
                      {t.status === 'pending' ? (
                        <div className="action-btns">
                          <button
                            className="action-icon ok"
                            onClick={() => handleStatus(t.id, 'completed')}
                            title="موافقة وإضافة الرصيد"
                          >
                            <Check size={16} />
                          </button>
                          <button className="action-icon ban" onClick={() => handleStatus(t.id, 'rejected')} title="رفض">
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
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
