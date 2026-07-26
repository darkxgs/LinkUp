import { useEffect, useState } from 'react';
import {
  Clock,
  Phone,
  Video,
  Mic,
  Users,
  Coins,
  Gem,
  RefreshCw,
  Info,
  Cloud,
  Radio,
  Server,
  AlertTriangle,
  DollarSign,
  Save,
} from 'lucide-react';
import { StatCard, Loading } from '@/components/Common';
import { DEFAULT_PROVIDER_COSTS, type ProviderCosts } from '@/constants/providerCosts';
import {
  getCallUsageStats,
  getLiveKitUsage,
  getProviderCosts,
  saveProviderCosts,
  getRooms,
  logAdminAction,
  formatNumber,
  type CallUsageRange,
  type CallUsageStats,
  type CallUsageCell,
  type LiveKitUsageStats,
  type AdminRoom,
} from '@/services/admin';

const RANGES: { key: CallUsageRange; label: string }[] = [
  { key: '1', label: 'اليوم' },
  { key: '7', label: '٧ أيام' },
  { key: '30', label: '٣٠ يوم' },
  { key: '90', label: '٩٠ يوم' },
  { key: 'all', label: 'الكل' },
];


/** يحوّل عدد الدقائق إلى صيغة ساعات:دقائق للقراءة السريعة */
function formatMinutes(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${formatNumber(m)} د`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${formatNumber(h)} س ${rem} د` : `${formatNumber(h)} س`;
}

function formatCost(v: number, currency: string): string {
  const n = Number.isFinite(v) ? v : 0;
  return `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

const GRID_ROWS: {
  key: keyof CallUsageStats['grid'];
  label: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  { key: 'chatVoice', label: 'مكالمة شات — صوت', icon: <Mic size={16} />, color: '#e11212' },
  { key: 'chatVideo', label: 'مكالمة شات — فيديو', icon: <Video size={16} />, color: '#8b0000' },
  { key: 'matchVoice', label: 'مطابقة — صوت', icon: <Mic size={16} />, color: '#d21e2a' },
  { key: 'matchVideo', label: 'مطابقة — فيديو', icon: <Video size={16} />, color: '#F59E0B' },
];

export default function CallUsagePage() {
  const [range, setRange] = useState<CallUsageRange>('30');
  const [stats, setStats] = useState<CallUsageStats | null>(null);
  const [lk, setLk] = useState<LiveKitUsageStats | null>(null);
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [costs, setCosts] = useState<ProviderCosts>(DEFAULT_PROVIDER_COSTS);
  const [loading, setLoading] = useState(true);
  const [savingCosts, setSavingCosts] = useState(false);
  const [savedCosts, setSavedCosts] = useState(false);

  const load = async (r: CallUsageRange) => {
    setLoading(true);
    try {
      const [s, lku, rs, c] = await Promise.all([
        getCallUsageStats(r),
        getLiveKitUsage(r),
        getRooms(),
        getProviderCosts(),
      ]);
      setStats(s);
      setLk(lku);
      setRooms(rs);
      setCosts(c);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const handleSaveCosts = async () => {
    setSavingCosts(true);
    try {
      await saveProviderCosts(costs);
      await logAdminAction('تعديل أسعار تكلفة المزوّدين', 'providerCosts',
        `Agora صوت ${costs.agoraVoicePerMin} | فيديو ${costs.agoraVideoPerMin} ${costs.currency}`);
      setSavedCosts(true);
      setTimeout(() => setSavedCosts(false), 2000);
    } finally {
      setSavingCosts(false);
    }
  };

  const liveRoomsNow = rooms.filter((r) => r.isActive).length;
  const liveParticipantsNow = rooms.filter((r) => r.isActive).reduce((a, r) => a + (r.memberCount || 0), 0);

  // تكلفة تقديرية
  const agoraVoiceCost = (stats?.byType.voice ?? 0) * costs.agoraVoicePerMin;
  const agoraVideoCost = (stats?.byType.video ?? 0) * costs.agoraVideoPerMin;
  const agoraCost = agoraVoiceCost + agoraVideoCost;
  const livekitCost = (lk?.minutes ?? 0) * costs.livekitPerMin;
  const totalCost = agoraCost + livekitCost;

  return (
    <div className="page-container">
      <div className="agency-page-header">
        <div>
          <h1>
            <Clock size={26} style={{ verticalAlign: 'middle', marginLeft: 8, color: 'var(--brand-primary)' }} />
            استهلاك وتكلفة المزوّدين
          </h1>
          <p>
            دقائق الاستهلاك الفعلية على Agora (المكالمات والمطابقة والغرف) مع تكلفة تقديرية.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="seg-range" style={{ display: 'flex', gap: 4, background: 'var(--surface-2, #F3F4F6)', padding: 4, borderRadius: 12 }}>
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={range === r.key ? 'btn btn-primary' : 'btn'}
                style={{
                  padding: '6px 14px',
                  fontSize: 13,
                  borderRadius: 9,
                  ...(range === r.key ? {} : { background: 'transparent', boxShadow: 'none' }),
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button className="btn" onClick={() => load(range)} disabled={loading} title="تحديث">
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {loading || !stats || !lk ? (
        <Loading />
      ) : (
        <>
          {/* ملخّص التكلفة */}
          <div
            style={{
              background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
              borderRadius: 16,
              padding: '20px 24px',
              marginBottom: 22,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 18,
            }}
          >
            <div>
              <div style={{ fontSize: 13, opacity: 0.8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <DollarSign size={15} /> التكلفة التقديرية للمزوّدين — {RANGES.find((r) => r.key === range)?.label}
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, marginTop: 6 }}>{formatCost(totalCost, costs.currency)}</div>
            </div>
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
              <CostChip label="Agora" value={formatCost(agoraCost, costs.currency)} color="#f2a0a0" />
            </div>
          </div>

          {/* المزوّدون الفعّالون */}
          <div className="section-h">
            <Server size={18} color="var(--brand-primary)" /> المزوّدون الفعّالون
          </div>
          <div className="charts-grid" style={{ marginBottom: 22 }}>
            <ProviderCard
              name="Agora"
              role="مكالمات الصوت والفيديو 1:1 + المطابقة"
              icon={<Phone size={20} />}
              color="#e11212"
              active
              primaryValue={formatMinutes(stats.totalRealMinutes)}
              primaryLabel="دقيقة فعلية"
              meta={[
                { label: 'جلسات', value: formatNumber(stats.totalSessions) },
                { label: 'صوت', value: formatMinutes(stats.byType.voice) },
                { label: 'فيديو', value: formatMinutes(stats.byType.video) },
              ]}
              note={`الدقائق الفعلية من مدّة المكالمة (durationSeconds). للمقارنة: المفوتر ${formatMinutes(stats.totalMinutes)}. ملاحظة: Agora يفوتر لكل مشارك — لمكالمة 1:1 اضرب التكلفة ×2.`}
              tracked
            />
            <ProviderCard
              name="Agora — الغرف"
              role="الغرف الصوتية الجماعية (many-to-many)"
              icon={<Radio size={20} />}
              color="#d21e2a"
              active
              primaryValue={formatNumber(liveRoomsNow)}
              primaryLabel="غرفة نشطة الآن"
              meta={[
                { label: 'مشاركون الآن', value: formatNumber(liveParticipantsNow) },
                { label: 'إجمالي الغرف', value: formatNumber(rooms.length) },
              ]}
              note="الغرف تعمل على Agora مثل المكالمات — LiveKit حُذف من المنتج نهائياً. دقائق الغرف لكل مشارك غير مسجّلة على السيرفر بعد، فلا نعرض رقماً لها."
              tracked={false}
            />
          </div>

          {/* أسعار التكلفة */}
          <div className="section-h">
            <DollarSign size={18} color="var(--brand-primary)" /> أسعار تكلفة الدقيقة (للتحليل)
          </div>
          <div className="card" style={{ marginBottom: 22 }}>
            <div className="card-body">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
                <CostInput label="Agora — صوت / دقيقة" value={costs.agoraVoicePerMin} onChange={(v) => setCosts({ ...costs, agoraVoicePerMin: v })} suffix={costs.currency} />
                <CostInput label="Agora — فيديو / دقيقة" value={costs.agoraVideoPerMin} onChange={(v) => setCosts({ ...costs, agoraVideoPerMin: v })} suffix={costs.currency} />
                <div style={{ minWidth: 110 }}>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted, #6B7280)' }}>العملة</label>
                  <input
                    value={costs.currency}
                    onChange={(e) => setCosts({ ...costs, currency: e.target.value.slice(0, 6) })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border)', fontFamily: 'inherit' }}
                  />
                </div>
                <button className="btn btn-primary" onClick={handleSaveCosts} disabled={savingCosts} style={{ height: 40 }}>
                  <Save size={16} />
                  {savedCosts ? '✓ تم الحفظ' : savingCosts ? 'جاري الحفظ...' : 'حفظ الأسعار'}
                </button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted, #9CA3AF)', marginTop: 12 }}>
                التكلفة = الدقائق الفعلية × سعر الدقيقة. القيم الافتراضية تقريبية — عدّلها لتطابق عقدك مع كل مزوّد.
              </div>
            </div>
          </div>

          {/* تفصيل Agora */}
          <div className="section-h">
            <Phone size={18} color="var(--brand-primary)" /> تفصيل Agora
          </div>
          <div className="stats-grid">
            <StatCard
              icon={Clock}
              value={formatMinutes(stats.totalRealMinutes)}
              label="الدقائق الفعلية المستهلكة"
              color="#e11212"
              bg="rgba(225,18,18,0.12)"
              trend={{ value: `المفوتر: ${formatMinutes(stats.totalMinutes)}`, up: true }}
            />
            <StatCard
              icon={Phone}
              value={formatNumber(stats.totalSessions)}
              label="عدد الجلسات"
              color="#8b0000"
              bg="rgba(139,0,0,0.12)"
              trend={{ value: `${formatNumber(stats.billedSessions)} مفوترة • ${formatNumber(stats.unbilledSessions)} مجانية`, up: true }}
            />
            <StatCard
              icon={Coins}
              value={formatNumber(stats.totalCoins)}
              label="كوينز مستهلكة"
              color="#F59E0B"
              bg="rgba(245,158,11,0.14)"
            />
            <StatCard
              icon={Gem}
              value={formatNumber(stats.totalPearls)}
              label="لؤلؤ موزّع على المضيفات"
              color="#d21e2a"
              bg="rgba(210,30,42,0.12)"
            />
          </div>

          {/* تقسيم حسب النوع والمصدر */}
          <div className="charts-grid" style={{ marginBottom: 20 }}>
            <SplitCard
              title="حسب نوع الوسيط (فعلي)"
              left={{ icon: <Mic size={18} />, label: 'صوت', minutes: stats.byType.voice, color: '#e11212' }}
              right={{ icon: <Video size={18} />, label: 'فيديو', minutes: stats.byType.video, color: '#8b0000' }}
              total={stats.totalRealMinutes}
            />
            <SplitCard
              title="حسب مصدر المكالمة (فعلي)"
              left={{ icon: <Phone size={18} />, label: 'مكالمات الشات', minutes: stats.bySource.chat, color: '#10B981' }}
              right={{ icon: <Users size={18} />, label: 'المطابقة', minutes: stats.bySource.match, color: '#d21e2a' }}
              total={stats.totalRealMinutes}
            />
          </div>

          {/* الجدول التفصيلي */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <h3>التفصيل الكامل (Agora)</h3>
              <span className="badge badge-purple">{RANGES.find((r) => r.key === range)?.label}</span>
            </div>
            <div className="card-body" style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>الفئة</th>
                    <th>دقائق فعلية</th>
                    <th>دقائق مفوترة</th>
                    <th>الجلسات</th>
                    <th>كوينز</th>
                    <th>لؤلؤ</th>
                  </tr>
                </thead>
                <tbody>
                  {GRID_ROWS.map((row) => {
                    const cell: CallUsageCell = stats.grid[row.key];
                    return (
                      <tr key={row.key}>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: row.color, fontWeight: 600 }}>
                            {row.icon}
                            {row.label}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700 }}>{formatMinutes(cell.realMinutes)}</td>
                        <td style={{ color: 'var(--text-muted, #9CA3AF)' }}>{formatMinutes(cell.minutes)}</td>
                        <td>{formatNumber(cell.sessions)}</td>
                        <td>{formatNumber(cell.coins)}</td>
                        <td>{formatNumber(cell.pearls)}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                    <td>الإجمالي</td>
                    <td>{formatMinutes(stats.totalRealMinutes)}</td>
                    <td style={{ color: 'var(--text-muted, #9CA3AF)' }}>{formatMinutes(stats.totalMinutes)}</td>
                    <td>{formatNumber(stats.totalSessions)}</td>
                    <td>{formatNumber(stats.totalCoins)}</td>
                    <td>{formatNumber(stats.totalPearls)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="card call-pricing-notes">
            <h4>
              <Info size={16} color="var(--brand-primary)" />
              ملاحظات حسابية
            </h4>
            <ul>
              <li><strong>الدقائق الفعلية</strong> = مدّة المكالمة الحقيقية (durationSeconds) لكل جلسة — تشمل المجانية، وتطابق استهلاك Agora.</li>
              <li><strong>الدقائق المفوترة</strong> = ما خُصم عليه كوينز فقط (minutesCharged) — للمحاسبة الداخلية لا للتكلفة.</li>
              <li>Agora يفوتر لكل <em>مشارك</em>: مكالمة 1:1 لمدة دقيقة = دقيقتا مشارك. اضبط السعر أو اضرب التكلفة ×2 حسب الحاجة.</li>
              <li style={{ color: '#B45309' }}>
                دقائق الغرف لكل مشارك غير مسجّلة على السيرفر بعد — الأرقام أعلاه للمكالمات
                والمطابقة فقط.
              </li>

              {(stats.reachedLimit || lk.reachedLimit) && (
                <li style={{ color: 'var(--danger, #EF4444)' }}>
                  تم بلوغ حد القراءة — قلّل النطاق الزمني للحصول على أرقام دقيقة.
                </li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function CostChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 12, opacity: 0.85, color }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function CostInput({ label, value, onChange, suffix }: { label: string; value: number; onChange: (v: number) => void; suffix: string }) {
  return (
    <div style={{ minWidth: 160 }}>
      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted, #6B7280)' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type="number"
          min={0}
          step={0.0001}
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          style={{ width: '100%', padding: '9px 52px 9px 12px', borderRadius: 10, border: '1px solid var(--border)', fontFamily: 'inherit' }}
        />
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-muted, #9CA3AF)' }}>{suffix}</span>
      </div>
    </div>
  );
}

function ProviderCard({
  name,
  role,
  icon,
  color,
  active,
  primaryValue,
  primaryLabel,
  meta,
  note,
  tracked,
}: {
  name: string;
  role: string;
  icon: React.ReactNode;
  color: string;
  active: boolean;
  primaryValue: string;
  primaryLabel: string;
  meta: { label: string; value: string }[];
  note: string;
  tracked: boolean;
}) {
  return (
    <div className="card" style={{ borderTop: `3px solid ${color}` }}>
      <div className="card-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}1f`, color, display: 'grid', placeItems: 'center' }}>
            {icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 17, fontWeight: 800 }}>{name}</span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700,
                color: active ? '#10B981' : '#9CA3AF',
                background: active ? 'rgba(16,185,129,0.12)' : 'rgba(156,163,175,0.15)',
                padding: '2px 8px', borderRadius: 20,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: active ? '#10B981' : '#9CA3AF' }} />
                {active ? 'فعّال' : 'متوقّف'}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted, #9CA3AF)', marginTop: 2 }}>{role}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 28, fontWeight: 800, color: tracked ? 'inherit' : '#9CA3AF' }}>{primaryValue}</span>
          <span style={{ fontSize: 13, color: 'var(--text-muted, #9CA3AF)' }}>{primaryLabel}</span>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          {meta.map((m) => (
            <div key={m.label} style={{ flex: 1, background: 'var(--surface-2, #F9FAFB)', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{m.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted, #9CA3AF)', marginTop: 2 }}>{m.label}</div>
            </div>
          ))}
        </div>

        <div style={{
          display: 'flex', gap: 8, fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-line',
          color: tracked ? 'var(--text-muted, #6B7280)' : '#B45309',
          background: tracked ? 'transparent' : 'rgba(245,158,11,0.1)',
          padding: tracked ? 0 : '8px 10px', borderRadius: 8,
        }}>
          {!tracked && <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />}
          <span>{note}</span>
        </div>
      </div>
    </div>
  );
}

function SplitCard({
  title,
  left,
  right,
  total,
}: {
  title: string;
  left: { icon: React.ReactNode; label: string; minutes: number; color: string };
  right: { icon: React.ReactNode; label: string; minutes: number; color: string };
  total: number;
}) {
  const leftPct = total > 0 ? Math.round((left.minutes / total) * 100) : 0;
  const rightPct = total > 0 ? Math.round((right.minutes / total) * 100) : 0;
  return (
    <div className="card">
      <div className="card-header">
        <h3>{title}</h3>
      </div>
      <div className="card-body">
        <div style={{ display: 'flex', height: 12, borderRadius: 8, overflow: 'hidden', marginBottom: 16, background: 'var(--border)' }}>
          <div style={{ width: `${leftPct}%`, background: left.color }} />
          <div style={{ width: `${rightPct}%`, background: right.color }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          {[left, right].map((s, i) => {
            const pct = i === 0 ? leftPct : rightPct;
            return (
              <div key={s.label} style={{ flex: 1 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: s.color, fontWeight: 600, marginBottom: 4 }}>
                  {s.icon}
                  {s.label}
                </div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{formatMinutes(s.minutes)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted, #9CA3AF)' }}>{pct}%</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
