import { useEffect, useState } from 'react';
import { Crown, Cloud, Save, RotateCcw } from 'lucide-react';
import { Loading } from '@/components/Common';
import {
  getRoomThroneConfig,
  saveRoomThroneConfig,
  DEFAULT_ROOM_THRONE,
  logAdminAction,
  formatNumber,
  type ConfigRoomThrone,
} from '@/services/admin';

export default function RoomThronePage() {
  const [config, setConfig] = useState<ConfigRoomThrone>(DEFAULT_ROOM_THRONE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getRoomThroneConfig().then((c) => {
      setConfig(c);
      setLoading(false);
    });
  }, []);

  const patch = (p: Partial<ConfigRoomThrone>) => setConfig((c) => ({ ...c, ...p }));

  const handleSave = async () => {
    setSaving(true);
    await saveRoomThroneConfig(config);
    await logAdminAction('حفظ إعدادات العرش', `${formatNumber(config.minGiftCoins)} كوين`);
    setSaving(false);
  };

  const handleReset = async () => {
    if (!confirm('استعادة الإعدادات الافتراضية؟')) return;
    setConfig(DEFAULT_ROOM_THRONE);
    await saveRoomThroneConfig(DEFAULT_ROOM_THRONE);
    await logAdminAction('استعادة إعدادات العرش الافتراضية', '');
  };

  if (loading) return <Loading />;

  return (
    <div className="page-container">
      <div className="filters-bar">
        <div className="config-sync-badge">
          <Cloud size={16} /> config/roomThrone — يظهر بجانب المضيف في الغرف
        </div>
        <div style={{ display: 'flex', gap: 8, marginRight: 'auto' }}>
          <button className="btn btn-ghost btn-sm" onClick={handleReset}>
            <RotateCcw size={16} /> استعادة الافتراضي
          </button>
          <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
            <Save size={16} /> {saving ? 'جاري الحفظ...' : 'حفظ ونشر'}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 24, maxWidth: 640 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'rgba(245,158,11,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Crown size={28} color="#F59E0B" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20 }}>عرش الغرفة</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
              كرسي بجانب المضيف — يشغله من يتجاوز حد الهدايا المرسلة
            </p>
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => patch({ enabled: e.target.checked })}
          />
          مفعّل في التطبيق
        </label>

        <div className="form-group">
          <label className="form-label">الحد الأدنى للهدايا المرسلة (كوين)</label>
          <input
            className="form-input"
            type="number"
            min={1}
            value={config.minGiftCoins}
            onChange={(e) => patch({ minGiftCoins: Math.max(1, Number(e.target.value) || 2000) })}
          />
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
            من يرسل هدايا في الروم بمجموع يتجاوز هذا الرقم يمكنه شغل العرش. الأعلى مساهمة يحتفظ بالعرش.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">عنوان الموديل (عربي)</label>
            <input className="form-input" value={config.titleAr} onChange={(e) => patch({ titleAr: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">عنوان الموديل (English)</label>
            <input className="form-input" value={config.titleEn} onChange={(e) => patch({ titleEn: e.target.value })} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">نص الشرح (عربي) — استخدم {'{{coins}}'} للرقم</label>
          <textarea
            className="form-input"
            rows={3}
            value={config.hintAr}
            onChange={(e) => patch({ hintAr: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Hint (English) — use {'{{coins}}'} for amount</label>
          <textarea
            className="form-input"
            rows={3}
            value={config.hintEn}
            onChange={(e) => patch({ hintEn: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
