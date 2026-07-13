/**
 * Admin — صفحة طلبات السحب
 * تعرض كل طلبات السحب (self + via_agent) مع فلاتر + إجراءات
 */

import { useEffect, useState } from 'react';
import {
  Check, X, Clock, CheckCircle2, XCircle,
  ArrowUpFromLine, Wallet, Users,
} from 'lucide-react';
import { Loading, Empty, Badge } from '@/components/Common';
import {
  logAdminAction,
  formatNumber,
  formatDate,
  getWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  type AdminWithdrawal,
} from '@/services/admin';
import { useAdminProfile } from '@/contexts/AdminProfileContext';

type FilterType = 'all' | 'self' | 'via_agent';
type FilterStatus = 'all' | 'pending' | 'completed' | 'rejected';

const METHOD_LABEL: Record<string, string> = {
  bank: 'بنك', usdt: 'USDT-TRC20', paypal: 'PayPal', email: 'بريد إلكتروني',
};

export default function WithdrawalsPage() {
  const { isSuper, can, profile } = useAdminProfile();
  const [items, setItems] = useState<AdminWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('pending');
  const [processing, setProcessing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await getWithdrawals(200));
    } catch (e) {
      console.error('load withdrawals', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = items.filter((w) => {
    if (filterType !== 'all' && w.type !== filterType) return false;
    if (filterStatus !== 'all' && w.status !== filterStatus) return false;
    return true;
  });

  const approveSelf = async (w: AdminWithdrawal) => {
    if (!confirm(`اعتماد طلب السحب الذاتي: ${formatNumber(w.amount)} ماسة من ${w.uidName}؟`)) return;
    setProcessing(w.id);
    try {
      await approveWithdrawal(w.id);
      await logAdminAction('اعتماد سحب ذاتي', w.id.slice(0, 12), `${w.amount} ماسة`);
      await load();
    } catch (e: any) {
      alert('فشل: ' + (e?.message ?? 'خطأ'));
    } finally {
      setProcessing(null);
    }
  };

  const rejectAny = async (w: AdminWithdrawal) => {
    const reason = prompt('سبب الرفض:');
    if (!reason) return;
    setProcessing(w.id);
    try {
      await rejectWithdrawal(w.id, reason);
      await logAdminAction('رفض سحب', w.id.slice(0, 12), reason);
      await load();
    } catch (e: any) {
      alert('فشل: ' + (e?.message ?? 'خطأ'));
    } finally {
      setProcessing(null);
    }
  };

  const counts = {
    pending: items.filter((i) => i.status === 'pending').length,
    completed: items.filter((i) => i.status === 'completed').length,
    rejected: items.filter((i) => i.status === 'rejected').length,
  };
  const totalPearls = filtered.reduce((sum, i) => sum + i.amount, 0);
  const totalFiat = filtered.reduce((sum, i) => sum + (i.fiatValue ?? 0), 0);

  const statusBadge = (s: string) => {
    if (s === 'completed') return <Badge variant="green">مكتمل</Badge>;
    if (s === 'rejected') return <Badge variant="red">مرفوض</Badge>;
    if (s === 'approved') return <Badge variant="blue">مُعتمد</Badge>;
    return <Badge variant="gold">قيد المراجعة</Badge>;
  };

  return (
    <div className="page-container">
      {!isSuper && (
        <div className="agency-alert-banner" style={{ marginBottom: 16 }}>
          طلبات السحب والإحصائيات هنا تخص دولتك فقط: {(profile?.countries ?? []).join('، ') || '—'}
        </div>
      )}
      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(245,158,11,0.15)' }}>
            <Clock size={26} color="#F59E0B" />
          </div>
          <div className="stat-card-value">{counts.pending}</div>
          <div className="stat-card-label">طلبات معلّقة</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(16,185,129,0.12)' }}>
            <CheckCircle2 size={26} color="#10B981" />
          </div>
          <div className="stat-card-value">{counts.completed}</div>
          <div className="stat-card-label">مكتملة</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(239,68,68,0.12)' }}>
            <XCircle size={26} color="#EF4444" />
          </div>
          <div className="stat-card-value">{counts.rejected}</div>
          <div className="stat-card-label">مرفوضة</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(155,43,240,0.12)' }}>
            <Wallet size={26} color="#c21520" />
          </div>
          <div className="stat-card-value">{formatNumber(totalPearls)}</div>
          <div className="stat-card-label">إجمالي الماسة</div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="tabs" style={{ marginBottom: 0 }}>
          {([
            { id: 'pending', label: `المعلّقة (${counts.pending})` },
            { id: 'completed', label: 'المكتملة' },
            { id: 'rejected', label: 'المرفوضة' },
            { id: 'all', label: 'الكل' },
          ] as { id: FilterStatus; label: string }[]).map((t) => (
            <button key={t.id} className={`tab ${filterStatus === t.id ? 'active' : ''}`}
              onClick={() => setFilterStatus(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        <select className="filter-select" value={filterType}
          onChange={(e) => setFilterType(e.target.value as FilterType)}
          style={{ marginRight: 'auto' }}>
          <option value="all">كل الأنواع</option>
          <option value="self">سحب ذاتي</option>
          <option value="via_agent">عبر وكيل</option>
        </select>

        <button className="btn btn-ghost btn-sm" onClick={load}>تحديث</button>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? <Loading /> : filtered.length === 0 ? <Empty text="لا توجد طلبات سحب" /> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>المستخدم</th>
                  <th>النوع</th>
                  <th>المبلغ</th>
                  <th>الطريقة</th>
                  <th>الوكيل</th>
                  <th>التاريخ</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((w) => (
                  <tr key={w.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{w.uidName}</div>
                      <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                        {w.uid?.slice(0, 10)}...
                      </div>
                    </td>
                    <td>
                      {w.type === 'self'
                        ? <Badge variant="blue">ذاتي</Badge>
                        : <Badge variant="purple">عبر وكيل</Badge>}
                    </td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{formatNumber(w.amount)} ماسة</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        صافي ${(w.fiatValue ?? (w.netAmount ?? 0) / 1000).toFixed(2)}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 13 }}>{METHOD_LABEL[w.method] ?? w.method}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {w.accountInfo?.iban || w.accountInfo?.address || w.accountInfo?.email || w.accountInfo?.label || '-'}
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {w.agentName || '-'}
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{formatDate(w.createdAt)}</td>
                    <td>
                      {statusBadge(w.status)}
                      {w.rejectionReason && (
                        <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{w.rejectionReason}</div>
                      )}
                    </td>
                    <td>
                      {w.status === 'pending' && w.type === 'self' ? (
                        <div className="action-btns">
                          {(isSuper || can('withdraw:approve')) && (
                            <button className="action-icon ok" disabled={processing === w.id}
                              onClick={() => approveSelf(w)} title="اعتماد">
                              <Check size={16} />
                            </button>
                          )}
                          {(isSuper || can('withdraw:reject')) && (
                            <button className="action-icon ban" disabled={processing === w.id}
                              onClick={() => rejectAny(w)} title="رفض">
                              <X size={16} />
                            </button>
                          )}
                        </div>
                      ) : w.status === 'pending' && w.type === 'via_agent' ? (
                        <span style={{ fontSize: 12, color: 'var(--gold-dark)' }}>بانتظار الوكيل</span>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <div style={{ textAlign: 'left', marginTop: 12, color: 'var(--text-secondary)', fontSize: 13 }}>
          {filtered.length} طلب • إجمالي ${totalFiat.toFixed(2)}
        </div>
      )}
    </div>
  );
}
