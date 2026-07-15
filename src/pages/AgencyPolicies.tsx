import { useEffect, useState } from 'react';
import { Wallet, Cloud, Save, RotateCcw, Plus, Trash2 } from 'lucide-react';
import { Loading } from '@/components/Common';
import {
  getAgencyPolicies,
  saveAgencyPolicies,
  DEFAULT_AGENCY_POLICIES,
  logAdminAction,
  type ConfigAgencyPolicies,
  type ConfigAgentPolicyRow,
  type ConfigHostessPolicyRow,
} from '@/services/admin';

// الوكلاء والمضيفات يتشاركان نفس بنية الصف
type PolicyRow = ConfigAgentPolicyRow;

const EMPTY_ROW: PolicyRow = {
  target: 0,
  collectionPct: 0,
  diamonds: 0,
  salaryUsd: 0,
  bonusPct: 0,
  totalUsd: 0,
  giftCoins: 0,
};

const COLUMNS: { key: keyof PolicyRow; label: string; step?: string; width: number }[] = [
  { key: 'target', label: 'الهدف (كوين)', width: 130 },
  { key: 'collectionPct', label: 'نسبة التحصيل %', step: 'any', width: 96 },
  { key: 'diamonds', label: 'الماسات', width: 90 },
  { key: 'salaryUsd', label: 'الراتب ($)', step: 'any', width: 96 },
  { key: 'bonusPct', label: 'المكافأة %', step: 'any', width: 90 },
  { key: 'totalUsd', label: 'الإجمالي ($)', step: 'any', width: 96 },
  { key: 'giftCoins', label: 'كوينز الهدية', width: 110 },
];

function PolicyTable({
  title,
  addLabel,
  rows,
  onUpdate,
  onAdd,
  onRemove,
}: {
  title: string;
  addLabel: string;
  rows: PolicyRow[];
  onUpdate: (index: number, patch: Partial<PolicyRow>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="card" style={{ padding: 16, maxWidth: 980, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onAdd}>
          <Plus size={14} /> {addLabel}
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ minWidth: 780 }}>
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx}>
                {COLUMNS.map((c) => (
                  <td key={c.key}>
                    <input
                      className="form-input"
                      type="number"
                      min={0}
                      step={c.step ?? 1}
                      style={{ width: c.width }}
                      value={row[c.key]}
                      onChange={(e) =>
                        onUpdate(idx, { [c.key]: Math.max(0, Number(e.target.value) || 0) } as Partial<PolicyRow>)
                      }
                    />
                  </td>
                ))}
                <td>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => onRemove(idx)}
                    aria-label="حذف"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AgencyPoliciesPage() {
  const [config, setConfig] = useState<ConfigAgencyPolicies>(DEFAULT_AGENCY_POLICIES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAgencyPolicies().then((c) => {
      setConfig(c);
      setLoading(false);
    });
  }, []);

  const patch = (p: Partial<ConfigAgencyPolicies>) => setConfig((c) => ({ ...c, ...p }));

  const updateAgentRow = (index: number, patchRow: Partial<ConfigAgentPolicyRow>) => {
    setConfig((c) => {
      const agent = [...c.agent];
      const prev = agent[index];
      if (!prev) return c;
      agent[index] = { ...prev, ...patchRow };
      return { ...c, agent };
    });
  };
  const addAgentRow = () =>
    setConfig((c) => ({ ...c, agent: [...c.agent, { ...(c.agent[c.agent.length - 1] ?? EMPTY_ROW) }] }));
  const removeAgentRow = (index: number) =>
    setConfig((c) => ({ ...c, agent: c.agent.filter((_, i) => i !== index) }));

  const updateHostessRow = (index: number, patchRow: Partial<ConfigHostessPolicyRow>) => {
    setConfig((c) => {
      const hostess = [...c.hostess];
      const prev = hostess[index];
      if (!prev) return c;
      hostess[index] = { ...prev, ...patchRow };
      return { ...c, hostess };
    });
  };
  const addHostessRow = () =>
    setConfig((c) => ({ ...c, hostess: [...c.hostess, { ...(c.hostess[c.hostess.length - 1] ?? EMPTY_ROW) }] }));
  const removeHostessRow = (index: number) =>
    setConfig((c) => ({ ...c, hostess: c.hostess.filter((_, i) => i !== index) }));

  const handleSave = async () => {
    setSaving(true);
    await saveAgencyPolicies(config);
    await logAdminAction(
      'حفظ سياسات الوكالة',
      `وكلاء ${config.agent.length} صف · مضيفات ${config.hostess.length} صف`,
    );
    setSaving(false);
  };

  const handleReset = async () => {
    if (!confirm('استعادة جداول الرواتب الرسمية الافتراضية؟')) return;
    setConfig(DEFAULT_AGENCY_POLICIES);
    await saveAgencyPolicies(DEFAULT_AGENCY_POLICIES);
    await logAdminAction('استعادة سياسات الوكالة الافتراضية', '');
  };

  if (loading) return <Loading />;

  return (
    <div className="page-container">
      <div className="filters-bar">
        <div className="config-sync-badge">
          <Cloud size={16} /> config/agencyPolicies
        </div>
        <div style={{ display: 'flex', gap: 8, marginRight: 'auto' }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleReset}>
            <RotateCcw size={16} /> استعادة الافتراضي
          </button>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={handleSave}>
            <Save size={16} /> {saving ? 'جاري الحفظ...' : 'حفظ ونشر'}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 16, maxWidth: 980 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: 'rgba(5,150,105,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Wallet size={28} color="#059669" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20 }}>الجداول الرسمية للرواتب</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.7 }}>
              الماسات = الهدف × نسبة التحصيل ÷ 50,000 · الراتب = الماسات × سعر الماسة · الإجمالي = الراتب × (1+نسبة
              المكافأة)
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">سعر الماسة ($)</label>
            <input
              className="form-input"
              type="number"
              min={0}
              step="any"
              value={config.usdPerDiamond}
              onChange={(e) => patch({ usdPerDiamond: Math.max(0, Number(e.target.value) || 0) })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">تحصيل الوكيل فوق آخر هدف %</label>
            <input
              className="form-input"
              type="number"
              min={0}
              step="any"
              value={config.agentCollectionAbovePct}
              onChange={(e) => patch({ agentCollectionAbovePct: Math.max(0, Number(e.target.value) || 0) })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">مكافأة الوكيل فوق آخر هدف %</label>
            <input
              className="form-input"
              type="number"
              min={0}
              step="any"
              value={config.agentBonusAbovePct}
              onChange={(e) => patch({ agentBonusAbovePct: Math.max(0, Number(e.target.value) || 0) })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">هدية الوكيل فوق الحد (% من الهدف)</label>
            <input
              className="form-input"
              type="number"
              min={0}
              step="any"
              value={config.agentGiftAboveTargetPct}
              onChange={(e) => patch({ agentGiftAboveTargetPct: Math.max(0, Number(e.target.value) || 0) })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">مكافأة المضيفة فوق آخر هدف %</label>
            <input
              className="form-input"
              type="number"
              min={0}
              step="any"
              value={config.hostessBonusAbovePct}
              onChange={(e) => patch({ hostessBonusAbovePct: Math.max(0, Number(e.target.value) || 0) })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">هدية المضيفة فوق الحد (% من الهدف)</label>
            <input
              className="form-input"
              type="number"
              min={0}
              step="any"
              value={config.hostessGiftAboveTargetPct}
              onChange={(e) => patch({ hostessGiftAboveTargetPct: Math.max(0, Number(e.target.value) || 0) })}
            />
          </div>
        </div>
      </div>

      <PolicyTable
        title="سياسة الوكلاء الشهرية"
        addLabel="إضافة هدف"
        rows={config.agent}
        onUpdate={updateAgentRow}
        onAdd={addAgentRow}
        onRemove={removeAgentRow}
      />

      <PolicyTable
        title="سياسة المضيفات الأسبوعية"
        addLabel="إضافة هدف"
        rows={config.hostess}
        onUpdate={updateHostessRow}
        onAdd={addHostessRow}
        onRemove={removeHostessRow}
      />
    </div>
  );
}
