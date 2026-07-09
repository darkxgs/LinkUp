import { useEffect, useState } from 'react';
import {
  History, Ban, Crown, BadgeCheck, Coins, Send, Shield, CheckCircle, Download,
} from 'lucide-react';
import { Loading, Empty } from '@/components/Common';
import { getAdminLogs, exportToCSV, timeAgo, formatDate, type AdminLog } from '@/services/admin';

// أيقونة لكل نوع إجراء
function actionIcon(action: string) {
  if (action.includes('حظر')) return { Icon: Ban, color: '#EF4444' };
  if (action.includes('VIP')) return { Icon: Crown, color: '#F59E0B' };
  if (action.includes('توثيق')) return { Icon: BadgeCheck, color: '#b00814' };
  if (action.includes('رصيد')) return { Icon: Coins, color: '#FCD34D' };
  if (action.includes('إشعار')) return { Icon: Send, color: '#e11212' };
  if (action.includes('موافقة')) return { Icon: CheckCircle, color: '#10B981' };
  return { Icon: Shield, color: '#6B7280' };
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminLogs().then((l) => { setLogs(l); setLoading(false); });
  }, []);

  const handleExport = () => {
    exportToCSV(
      logs.map((l) => ({
        الإجراء: l.action,
        الهدف: l.target,
        التفاصيل: l.details ?? '',
        المسؤول: l.adminName,
        التاريخ: formatDate(l.createdAt),
      })),
      'سجل_النشاط',
    );
  };

  return (
    <div className="page-container">
      <div className="filters-bar">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18 }}>
          <History size={20} color="#e11212" /> سجل نشاط المسؤولين
        </h3>
        <button className="btn btn-ghost btn-sm" style={{ marginRight: 'auto' }} onClick={handleExport}>
          <Download size={16} /> تصدير
        </button>
      </div>

      <div className="card">
        {loading ? <Loading /> : logs.length === 0 ? <Empty text="لا يوجد نشاط مسجّل بعد" /> : (
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {logs.map((log, i) => {
              const { Icon, color } = actionIcon(log.action);
              return (
                <div key={log.id ?? i} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 4px',
                  borderBottom: i < logs.length - 1 ? '1px solid var(--border-light)' : 'none',
                }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                    background: `${color}1A`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={20} color={color} strokeWidth={2.3} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 14 }}>
                      {log.action} — <span style={{ color: 'var(--brand-primary)' }}>{log.target}</span>
                    </p>
                    {log.details && (
                      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>{log.details}</p>
                    )}
                  </div>
                  <div style={{ textAlign: 'left', flexShrink: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{log.adminName}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{timeAgo(log.createdAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
