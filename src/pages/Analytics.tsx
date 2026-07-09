import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts';
import {
  DollarSign, TrendingUp, Coins, Users, UserCheck, Repeat, Crown, Gamepad2, Trophy,
  Calendar, Filter,
} from 'lucide-react';
import { StatCard, Loading } from '@/components/Common';
import {
  getTransactions,
  getAdvancedAnalytics,
  formatNumber,
  getAnalyticsPresetRange,
  startOfDayMs,
  endOfDayMs,
  type AdminTransaction,
  type AdvancedAnalytics,
  type AnalyticsDateRange,
} from '@/services/admin';
import { useAdminProfile } from '@/contexts/AdminProfileContext';

type DatePreset = 'today' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'all' | 'custom';

const PRESET_LABELS: Record<Exclude<DatePreset, 'custom'>, string> = {
  today: 'اليوم',
  last7: '7 أيام',
  last30: '30 يوماً',
  thisMonth: 'هذا الشهر',
  lastMonth: 'الشهر الماضي',
  all: 'الكل',
};

function toInputDate(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function rangeFromInputs(from: string, to: string): AnalyticsDateRange | undefined {
  if (!from || !to) return undefined;
  const fromMs = startOfDayMs(new Date(`${from}T00:00:00`));
  const toMs = endOfDayMs(new Date(`${to}T00:00:00`));
  if (fromMs > toMs) return undefined;
  return { fromMs, toMs };
}

function formatRangeLabel(range?: AnalyticsDateRange): string {
  if (!range) return 'كل الفترات';
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  return `${new Date(range.fromMs).toLocaleDateString('ar', opts)} — ${new Date(range.toMs).toLocaleDateString('ar', opts)}`;
}

function buildDailySeries(
  txs: AdminTransaction[],
  range?: AnalyticsDateRange,
): { day: string; revenue: number; spending: number }[] {
  const end = range ? new Date(range.toMs) : new Date();
  const start = range
    ? new Date(range.fromMs)
    : (() => {
        const d = new Date();
        d.setDate(d.getDate() - 13);
        return d;
      })();

  const days: { day: string; revenue: number; spending: number; startMs: number }[] = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);

  while (cursor.getTime() <= endDay.getTime() && days.length < 62) {
    const dayStart = cursor.getTime();
    const dayEnd = dayStart + 86400000;
    const dayTxs = txs.filter(
      (t) => (t.createdAt ?? 0) >= dayStart && (t.createdAt ?? 0) < dayEnd,
    );
    const revenue = dayTxs
      .filter((t) => t.type === 'recharge' && t.status === 'completed')
      .reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);
    const spending = dayTxs
      .filter((t) => t.type === 'gift' || t.type === 'game')
      .reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);
    days.push({
      day: cursor.toLocaleDateString('ar', { day: 'numeric', month: 'numeric' }),
      revenue,
      spending,
      startMs: dayStart,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export default function Analytics() {
  const { isSuper, profile } = useAdminProfile();
  const defaultRange = getAnalyticsPresetRange('last30');
  const [preset, setPreset] = useState<DatePreset>('last30');
  const [fromDate, setFromDate] = useState(toInputDate(defaultRange.fromMs));
  const [toDate, setToDate] = useState(toInputDate(defaultRange.toMs));
  const [appliedRange, setAppliedRange] = useState<AnalyticsDateRange | undefined>(defaultRange);

  const [txs, setTxs] = useState<AdminTransaction[]>([]);
  const [adv, setAdv] = useState<AdvancedAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (range?: AnalyticsDateRange) => {
    setLoading(true);
    const [t, a] = await Promise.all([
      getTransactions(3000, range),
      getAdvancedAnalytics(range),
    ]);
    setTxs(t);
    setAdv(a);
    setLoading(false);
  }, []);

  useEffect(() => {
    load(appliedRange);
  }, [appliedRange, load]);

  const applyPreset = (p: Exclude<DatePreset, 'custom'>) => {
    setPreset(p);
    if (p === 'all') {
      setAppliedRange(undefined);
      return;
    }
    const range = getAnalyticsPresetRange(p);
    setFromDate(toInputDate(range.fromMs));
    setToDate(toInputDate(range.toMs));
    setAppliedRange(range);
  };

  const applyCustomRange = () => {
    const range = rangeFromInputs(fromDate, toDate);
    if (!range) {
      alert('تحقق من التواريخ — «من» يجب أن يكون قبل «إلى»');
      return;
    }
    setPreset('custom');
    setAppliedRange(range);
  };

  const daily = useMemo(
    () => buildDailySeries(txs, appliedRange),
    [txs, appliedRange],
  );

  if (loading || !adv) return <div className="page-container"><Loading /></div>;

  const activityCards = adv.rangeFiltered
    ? [
        { icon: Users, label: 'نشطون في الفترة', value: formatNumber(adv.dau), color: '#b00814' },
        { icon: UserCheck, label: 'مستخدمون جدد', value: formatNumber(adv.newUsersInPeriod), color: '#f05a5a' },
        { icon: UserCheck, label: 'إجمالي المستخدمين', value: formatNumber(adv.mau), color: '#06B6D4' },
        { icon: DollarSign, label: 'إجمالي الشحن', value: formatNumber(adv.totalRevenue), color: '#10B981' },
      ]
    : [
        { icon: Users, label: 'نشطون اليوم (DAU)', value: formatNumber(adv.dau), color: '#b00814' },
        { icon: UserCheck, label: 'نشطون الأسبوع (WAU)', value: formatNumber(adv.wau), color: '#f05a5a' },
        { icon: UserCheck, label: 'نشطون الشهر (MAU)', value: formatNumber(adv.mau), color: '#06B6D4' },
        { icon: Repeat, label: 'معدّل الاحتفاظ', value: `${adv.retentionRate}%`, color: '#10B981' },
      ];

  return (
    <div className="page-container">
      {!isSuper && (
        <div className="agency-alert-banner" style={{ marginBottom: 16 }}>
          الإحصائيات والأرباح محسوبة لمستخدمي دولتك فقط: {(profile?.countries ?? []).join('، ') || '—'}
        </div>
      )}

      <div className="analytics-date-filter card" style={{ marginBottom: 24 }}>
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <Calendar size={18} color="var(--brand-primary)" />
            فلتر التاريخ
          </h3>
          <span className="badge badge-purple">{formatRangeLabel(appliedRange)}</span>
        </div>
        <div className="card-body">
          <div className="analytics-presets">
            {(Object.keys(PRESET_LABELS) as Exclude<DatePreset, 'custom'>[]).map((p) => (
              <button
                key={p}
                type="button"
                className={`btn btn-sm ${preset === p ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => applyPreset(p)}
              >
                {PRESET_LABELS[p]}
              </button>
            ))}
          </div>
          <div className="analytics-custom-range">
            <label className="form-field">
              <span>من تاريخ</span>
              <input
                type="date"
                className="form-input"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </label>
            <label className="form-field">
              <span>إلى تاريخ</span>
              <input
                type="date"
                className="form-input"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </label>
            <button type="button" className="btn btn-primary" onClick={applyCustomRange}>
              <Filter size={16} />
              تطبيق
            </button>
          </div>
        </div>
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
        {adv.rangeFiltered ? 'نشاط الفترة' : 'نشاط المستخدمين'}
      </h3>
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        {activityCards.map((c) => (
          <StatCard key={c.label} icon={c.icon} label={c.label} value={c.value} color={c.color} />
        ))}
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>مؤشرات الإيرادات</h3>
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <StatCard icon={DollarSign} label="إجمالي الشحن" value={formatNumber(adv.totalRevenue)} color="#10B981" />
        <StatCard icon={DollarSign} label="ARPU (لكل مستخدم)" value={formatNumber(adv.arpu)} color="#059669" />
        <StatCard icon={Crown} label="ARPPU (لكل دافع)" value={formatNumber(adv.arppu)} color="#F59E0B" />
        <StatCard icon={Users} label="عدد الدافعين" value={formatNumber(adv.payingUsers)} color="#d21e2a" />
        <StatCard icon={TrendingUp} label="معدّل التحويل" value={`${adv.conversionRate}%`} color="#e11212" />
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>أرباح الألعاب</h3>
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <StatCard icon={Gamepad2} label="إجمالي الرهانات" value={formatNumber(adv.gameTotalBets)} color="#e11212" />
        <StatCard icon={Coins} label="إجمالي الجوائز" value={formatNumber(adv.gameTotalWins)} color="#F59E0B" />
        <StatCard
          icon={TrendingUp}
          label="صافي ربح المنصة"
          value={formatNumber(adv.gameHouseProfit)}
          color={adv.gameHouseProfit >= 0 ? '#10B981' : '#EF4444'}
        />
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h3>الإيرادات والإنفاق {appliedRange ? 'حسب الفترة' : '(آخر 14 يوم)'}</h3>
        </div>
        <div className="card-body">
          {daily.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>لا توجد معاملات في هذه الفترة</p>
          ) : daily.length <= 14 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" name="إيرادات" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="spending" name="إنفاق" stroke="#d21e2a" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="revenue" name="إيرادات" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="spending" name="إنفاق" fill="#d21e2a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Trophy size={18} color="#F59E0B" />
            أكثر 10 منفقين {appliedRange ? 'في الفترة' : ''}
          </h3>
        </div>
        {adv.topSpenders.length === 0 ? (
          <div className="card-body"><p style={{ color: 'var(--text-muted)' }}>لا توجد بيانات شحن في هذه الفترة</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>#</th><th>المستخدم</th><th>إجمالي الإنفاق</th></tr>
            </thead>
            <tbody>
              {adv.topSpenders.map((s, i) => (
                <tr key={s.uid}>
                  <td style={{ fontWeight: 700, color: i < 3 ? '#F59E0B' : 'var(--text-muted)' }}>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td style={{ fontWeight: 700, color: 'var(--success)' }}>{formatNumber(s.spent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
