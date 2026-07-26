import { useEffect, useState } from 'react';
import { TrendingUp, Cloud, Save, RotateCcw, Plus, Trash2 } from 'lucide-react';
import { Loading } from '@/components/Common';
import {
  getAgencyLevelsConfig,
  saveAgencyLevelsConfig,
  DEFAULT_AGENCY_LEVELS_CONFIG,
  logAdminAction,
  formatNumber,
  type ConfigAgencyLevels,
  type ConfigAgencyLevelRow,
  type ConfigAgencySupervisorCapTier,
} from '@/services/admin';

export default function AgencyLevelsPage() {
  const [config, setConfig] = useState<ConfigAgencyLevels>(DEFAULT_AGENCY_LEVELS_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAgencyLevelsConfig().then((c) => {
      setConfig(c);
      setLoading(false);
    });
  }, []);

  const patch = (p: Partial<ConfigAgencyLevels>) => setConfig((c) => ({ ...c, ...p }));

  const updateRow = (index: number, patchRow: Partial<ConfigAgencyLevelRow>) => {
    setConfig((c) => {
      const levels = [...c.levels];
      const prev = levels[index];
      if (!prev) return c;
      levels[index] = { ...prev, ...patchRow };
      return { ...c, levels };
    });
  };

  const addRow = () => {
    setConfig((c) => {
      const last = c.levels[c.levels.length - 1];
      const nextLevel = (last?.level ?? 0) + 1;
      const nextTarget = (last?.supportTarget ?? 0) + c.extendStepCoins;
      return {
        ...c,
        levels: [
          ...c.levels,
          {
            level: nextLevel,
            supportTarget: nextTarget,
            managerBonus: Math.floor(nextTarget * 0.32),
          },
        ],
      };
    });
  };

  const removeRow = (index: number) => {
    setConfig((c) => ({ ...c, levels: c.levels.filter((_, i) => i !== index) }));
  };

  const updateSupervisorTier = (index: number, patchRow: Partial<ConfigAgencySupervisorCapTier>) => {
    setConfig((c) => {
      const supervisorCapTiers = [...(c.supervisorCapTiers ?? [])];
      const prev = supervisorCapTiers[index];
      if (!prev) return c;
      supervisorCapTiers[index] = { ...prev, ...patchRow };
      return { ...c, supervisorCapTiers };
    });
  };

  const addSupervisorTier = () => {
    setConfig((c) => {
      const tiers = [...(c.supervisorCapTiers ?? [])];
      const last = tiers[tiers.length - 1];
      const minLevel = (last?.maxLevel ?? 0) + 1;
      return {
        ...c,
        supervisorCapTiers: [
          ...tiers,
          { minLevel: Math.max(1, minLevel), maxLevel: minLevel + 9, maxSupervisors: 3 },
        ],
      };
    });
  };

  const removeSupervisorTier = (index: number) => {
    setConfig((c) => ({
      ...c,
      supervisorCapTiers: (c.supervisorCapTiers ?? []).filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    await saveAgencyLevelsConfig(config);
    await logAdminAction('حفظ مستويات الوكالة', `${config.levels.length} مستوى`);
    setSaving(false);
  };

  const handleReset = async () => {
    if (!confirm('استعادة جدول المستويات الافتراضي؟')) return;
    setConfig(DEFAULT_AGENCY_LEVELS_CONFIG);
    await saveAgencyLevelsConfig(DEFAULT_AGENCY_LEVELS_CONFIG);
    await logAdminAction('استعادة مستويات الوكالة الافتراضية', '');
  };

  if (loading) return <Loading />;

  return (
    <div className="page-container">
      <div className="filters-bar">
        <div className="config-sync-badge">
          <Cloud size={16} /> config/agencyLevels — يظهر في إعدادات غرفة الوكالة
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

      <div className="card" style={{ padding: 24, marginBottom: 16, maxWidth: 720 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'rgba(5,150,105,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <TrendingUp size={28} color="#059669" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20 }}>مستويات الوكالة</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
              حسب قيمة الدعم (كوينز الهدايا) داخل الوكالة خلال آخر 7 أيام
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div className="form-group">
            <label className="form-label">مستوى فتح العرش</label>
            <input
              className="form-input"
              type="number"
              min={1}
              value={config.throneUnlockLevel}
              onChange={(e) => patch({ throneUnlockLevel: Math.max(1, Number(e.target.value) || 15) })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">بعد آخر مستوى: +1 كل (كوين)</label>
            <input
              className="form-input"
              type="number"
              min={1}
              value={config.extendStepCoins}
              onChange={(e) => patch({ extendStepCoins: Math.max(1, Number(e.target.value) || 25_000_000) })}
            />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
              بعد 300M: كل {formatNumber(config.extendStepCoins)} كوين = مستوى جديد
            </p>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 16, maxWidth: 900, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>حد مشرفي الإشراف</h3>
            <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
              عدد مشرفي الإشراف (الأصفر) المسموح حسب مستوى الوكالة — LV.1–9: 3 · LV.10–19: 5 · LV.20+: 7
            </p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addSupervisorTier}>
            <Plus size={14} /> إضافة شريحة
          </button>
        </div>

        <div className="form-group" style={{ maxWidth: 280, marginBottom: 16 }}>
          <label className="form-label">إضافة SVIP «زيادة مشرفين» (اختياري)</label>
          <input
            className="form-input"
            type="number"
            min={0}
            value={config.vipSupervisorBonus ?? 0}
            onChange={(e) => patch({ vipSupervisorBonus: Math.max(0, Number(e.target.value) || 0) })}
          />
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
            تُضاف لمالك الوكالة إذا يملك امتياز extraRoomAdmins
          </p>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: 520 }}>
            <thead>
              <tr>
                <th>من مستوى</th>
                <th>إلى مستوى</th>
                <th>عدد المشرفين</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(config.supervisorCapTiers ?? []).map((tier, idx) => (
                <tr key={`sup-${idx}`}>
                  <td>
                    <input
                      className="form-input"
                      type="number"
                      min={1}
                      style={{ width: 88 }}
                      value={tier.minLevel}
                      onChange={(e) => updateSupervisorTier(idx, { minLevel: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </td>
                  <td>
                    <input
                      className="form-input"
                      type="number"
                      min={1}
                      style={{ width: 88 }}
                      value={tier.maxLevel}
                      onChange={(e) => updateSupervisorTier(idx, { maxLevel: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </td>
                  <td>
                    <input
                      className="form-input"
                      type="number"
                      min={1}
                      style={{ width: 88 }}
                      value={tier.maxSupervisors}
                      onChange={(e) => updateSupervisorTier(idx, { maxSupervisors: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => removeSupervisorTier(idx)}
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

      <div className="card" style={{ padding: 16, maxWidth: 900 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>جدول العتبات</h3>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addRow}>
            <Plus size={14} /> إضافة مستوى
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: 520 }}>
            <thead>
              <tr>
                <th>المستوى</th>
                <th>حد الدعم (كوين)</th>
                <th>مكافأة المدير</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {config.levels.map((row, idx) => (
                <tr key={`${row.level}-${idx}`}>
                  <td>
                    <input
                      className="form-input"
                      type="number"
                      min={1}
                      style={{ width: 72 }}
                      value={row.level}
                      onChange={(e) => updateRow(idx, { level: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </td>
                  <td>
                    <input
                      className="form-input"
                      type="number"
                      min={1}
                      value={row.supportTarget}
                      onChange={(e) => {
                        // لا نلمس مكافأة المدير عند تعديل حدّ الدعم — كان يعيد كتابتها
                        // إلى 32% من الحدّ مع كل ضغطة فيمسح القيمة المخصّصة التي كتبها المالك.
                        const supportTarget = Math.max(1, Number(e.target.value) || 1);
                        updateRow(idx, { supportTarget });
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className="form-input"
                      type="number"
                      min={0}
                      value={row.managerBonus ?? 0}
                      onChange={(e) => updateRow(idx, { managerBonus: Math.max(0, Number(e.target.value) || 0) })}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => removeRow(idx)}
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
    </div>
  );
}
