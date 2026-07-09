import { useEffect, useState } from 'react';
import { Shield, Save, Cloud, Plus, Trash2 } from 'lucide-react';
import { Loading } from '@/components/Common';
import {
  getPrivacyConfig,
  savePrivacyConfig,
  DEFAULT_PRIVACY_CONFIG,
  logAdminAction,
  type ConfigPrivacy,
  type ConfigPrivacyFeature,
} from '@/services/admin';

type Tab = 'general' | 'features' | 'intro';

export default function PrivacyPage() {
  const [config, setConfig] = useState<ConfigPrivacy>(DEFAULT_PRIVACY_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>('general');
  const [selectedKey, setSelectedKey] = useState('visitAnonymously');

  const load = async () => {
    setLoading(true);
    let data = await getPrivacyConfig();
    if (!data) {
      data = DEFAULT_PRIVACY_CONFIG;
      await savePrivacyConfig(data);
    }
    setConfig(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const current = config.features.find((f) => f.key === selectedKey) ?? config.features[0];

  const patch = (p: Partial<ConfigPrivacy>) => setConfig((c) => ({ ...c, ...p }));

  const updateFeature = (patchF: Partial<ConfigPrivacyFeature>) => {
    if (!current) return;
    setConfig((c) => ({
      ...c,
      features: c.features.map((f) => (f.key === current.key ? { ...f, ...patchF } : f)),
    }));
  };

  const updateIntro = (key: 'introAr' | 'introEn', idx: number, value: string) => {
    const arr = [...config[key]];
    arr[idx] = value;
    patch({ [key]: arr });
  };

  const addIntroLine = (key: 'introAr' | 'introEn') => patch({ [key]: [...config[key], ''] });
  const removeIntroLine = (key: 'introAr' | 'introEn', idx: number) => {
    patch({ [key]: config[key].filter((_, i) => i !== idx) });
  };

  const handleSave = async () => {
    setSaving(true);
    await savePrivacyConfig(config);
    await logAdminAction('حفظ الخصوصية', config.titleAr);
    setSaving(false);
    alert('تم الحفظ — التطبيق يتحدّث فوراً');
  };

  if (loading) return <Loading />;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'general', label: 'عام' },
    { id: 'features', label: 'الخيارات' },
    { id: 'intro', label: 'نصوص الشرح' },
  ];

  return (
    <div className="page-container">
      <div className="filters-bar">
        <div className="config-sync-badge">
          <Cloud size={16} /> مرتبط بالتطبيق — التعديلات فورية
        </div>
        <button className="btn btn-primary" style={{ marginRight: 'auto' }} onClick={handleSave} disabled={saving}>
          <Save size={16} /> {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {tabs.map((t) => (
          <button key={t.id} className={`btn ${tab === t.id ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(t.id)}>
            <Shield size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <div className="card" style={{ padding: 20, display: 'grid', gap: 12, maxWidth: 640 }}>
          <label><input type="checkbox" checked={config.enabled} onChange={(e) => patch({ enabled: e.target.checked })} /> النظام مفعّل</label>
          <div className="form-row">
            <label className="form-label">عنوان الشاشة (عربي)
              <input className="form-input" value={config.titleAr} onChange={(e) => patch({ titleAr: e.target.value })} />
            </label>
            <label className="form-label">عنوان الشاشة (إنجليزي)
              <input className="form-input" value={config.titleEn} onChange={(e) => patch({ titleEn: e.target.value })} />
            </label>
          </div>
        </div>
      )}

      {tab === 'features' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {config.features.map((f) => (
              <button key={f.key} className={`btn ${selectedKey === f.key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSelectedKey(f.key)}>
                {f.labelAr || f.key}
              </button>
            ))}
          </div>
          {current && (
            <div className="card" style={{ padding: 20, display: 'grid', gap: 12, maxWidth: 760 }}>
              <h3 style={{ margin: 0 }}>{current.labelAr}</h3>
              <label><input type="checkbox" checked={current.enabled} onChange={(e) => updateFeature({ enabled: e.target.checked })} /> مفعّل في التطبيق</label>
              <div className="form-row">
                <label className="form-label">الاسم عربي
                  <input className="form-input" value={current.labelAr} onChange={(e) => updateFeature({ labelAr: e.target.value })} />
                </label>
                <label className="form-label">الاسم إنجليزي
                  <input className="form-input" value={current.labelEn} onChange={(e) => updateFeature({ labelEn: e.target.value })} />
                </label>
              </div>
              <div className="form-row">
                <label className="form-label">نص القفل عربي
                  <input className="form-input" value={current.lockLabelAr} onChange={(e) => updateFeature({ lockLabelAr: e.target.value })} />
                </label>
                <label className="form-label">نص القفل إنجليزي
                  <input className="form-input" value={current.lockLabelEn} onChange={(e) => updateFeature({ lockLabelEn: e.target.value })} />
                </label>
              </div>
              <div className="form-row">
                <label className="form-label">SVIP مطلوب
                  <input className="form-input" type="number" value={current.requiredVipLevel ?? 0} onChange={(e) => updateFeature({ requiredVipLevel: Number(e.target.value) || 0 })} />
                </label>
                <label className="form-label">أرستقراطية مطلوبة
                  <input className="form-input" type="number" value={current.requiredAristocracyLevel ?? 0} onChange={(e) => updateFeature({ requiredAristocracyLevel: Number(e.target.value) || 0 })} />
                </label>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'intro' && (
        <div style={{ display: 'grid', gap: 16, maxWidth: 760 }}>
          {(['introAr', 'introEn'] as const).map((key) => (
            <div key={key} className="card" style={{ padding: 16 }}>
              <h4 style={{ margin: '0 0 10px' }}>{key === 'introAr' ? 'مقدمة عربية' : 'مقدمة إنجليزية'}</h4>
              {config[key].map((line, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input className="form-input" style={{ flex: 1 }} value={line} onChange={(e) => updateIntro(key, i, e.target.value)} />
                  <button className="btn btn-ghost" onClick={() => removeIntroLine(key, i)}><Trash2 size={14} /></button>
                </div>
              ))}
              <button className="btn btn-ghost" onClick={() => addIntroLine(key)}><Plus size={14} /> سطر</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
