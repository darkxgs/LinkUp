import { LucideIcon, TrendingUp, TrendingDown, Inbox } from 'lucide-react';

// ==================== Stat Card ====================
interface StatCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  color: string;
  bg?: string;
  trend?: { value: string; up: boolean };
}

export function StatCard({ icon: Icon, value, label, color, bg, trend }: StatCardProps) {
  const iconBg = bg || (color.startsWith('#') && color.length === 7 ? `${color}1a` : 'rgba(128, 128, 128, 0.08)');
  return (
    <div className="stat-card">
      <div className="stat-card-icon" style={{ background: iconBg }}>
        <Icon size={26} color={color} strokeWidth={2.3} />
      </div>
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-label">{label}</div>
      {trend && (
        <div className={`stat-card-trend ${trend.up ? 'up' : 'down'}`}>
          {trend.up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {trend.value}
        </div>
      )}
    </div>
  );
}

// ==================== Loading ====================
export function Loading({ text = 'جارٍ التحميل...' }: { text?: string }) {
  return (
    <div className="loading-state">
      <div className="spinner" />
      <p>{text}</p>
    </div>
  );
}

// ==================== Empty ====================
export function Empty({ text = 'لا توجد بيانات' }: { text?: string }) {
  return (
    <div className="empty-state">
      <Inbox size={48} color="var(--border)" strokeWidth={1.5} />
      <p>{text}</p>
    </div>
  );
}

// ==================== Badge ====================
export function Badge({ children, variant = 'gray' }: { children: React.ReactNode; variant?: string }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}
