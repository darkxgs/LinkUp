import { useEffect, useState } from 'react';
import { FileText, Save, Cloud } from 'lucide-react';
import { Loading } from '@/components/Common';
import {
  getAboutPagesConfig,
  saveAboutPagesConfig,
  DEFAULT_ABOUT_PAGES,
  logAdminAction,
  type ConfigAboutPages,
  type ConfigAboutSection,
  type ConfigAboutAction,
} from '@/services/admin';

export default function AboutPagesPage() {
  const [config, setConfig] = useState<ConfigAboutPages>(DEFAULT_ABOUT_PAGES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState('terms');

  const load = async () => {
    setLoading(true);
    let data = await getAboutPagesConfig();
    if (!data) {
      data = DEFAULT_ABOUT_PAGES;
      await saveAboutPagesConfig(data);
    }
    setConfig(data);
    setSelectedId(data.sections[0]?.id ?? 'terms');
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const section = config.sections.find((s) => s.id === selectedId) ?? config.sections[0];

  const updateSection = (patch: Partial<ConfigAboutSection>) => {
    if (!section) return;
    setConfig((c) => ({
      ...c,
      sections: c.sections.map((s) => (s.id === section.id ? { ...s, ...patch } : s)),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    await saveAboutPagesConfig(config);
    await logAdminAction('حفظ أقسام حول التطبيق', `${config.sections.length} قسم`);
    setSaving(false);
    alert('تم الحفظ — التطبيق يتحدّث فوراً');
  };

  if (loading || !section) return <Loading />;

  return (
    <div className="page-container">
      <div className="filters-bar">
        <div className="config-sync-badge">
          <Cloud size={16} /> config/aboutPages — مرتبط بشاشة حول التطبيق
        </div>
        <button className="btn btn-primary" style={{ marginRight: 'auto' }} onClick={handleSave} disabled={saving}>
          <Save size={16} /> {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </button>
      </div>

      <div className="page-header">
        <FileText size={28} />
        <div>
          <h1>حول التطبيق</h1>
          <p>إدارة نصوص الأقسام بالعربي والإنجليزي — تظهر داخل التطبيق</p>
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16, maxWidth: 320 }}>
        <label className="form-label">إصدار التطبيق (يظهر تحت الشعار)</label>
        <input
          className="form-input"
          value={config.appVersion}
          onChange={(e) => setConfig((c) => ({ ...c, appVersion: e.target.value }))}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, alignItems: 'start' }}>
        <div className="card" style={{ padding: 8 }}>
          {config.sections
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((s) => (
              <button
                key={s.id}
                type="button"
                className={`btn ${selectedId === s.id ? 'btn-primary' : 'btn-ghost'}`}
                style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 4, opacity: s.enabled ? 1 : 0.5 }}
                onClick={() => setSelectedId(s.id)}
              >
                {s.titleAr}
              </button>
            ))}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>{section.titleAr}</h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <input type="checkbox" checked={section.enabled} onChange={(e) => updateSection({ enabled: e.target.checked })} />
              مفعّل
            </label>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">الترتيب</label>
              <input className="form-input" type="number" value={section.order}
                onChange={(e) => updateSection({ order: +e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">نوع الإجراء</label>
              <select
                className="form-input"
                value={section.actionType}
                onChange={(e) => updateSection({ actionType: e.target.value as ConfigAboutAction })}
              >
                <option value="page">صفحة داخل التطبيق (نص)</option>
                <option value="support">فتح مركز الدعم</option>
                <option value="url">رابط خارجي</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">العنوان (عربي)</label>
              <input className="form-input" value={section.titleAr}
                onChange={(e) => updateSection({ titleAr: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">العنوان (إنجليزي)</label>
              <input className="form-input" value={section.titleEn}
                onChange={(e) => updateSection({ titleEn: e.target.value })} />
            </div>
            {section.actionType === 'url' && (
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">الرابط الخارجي</label>
                <input className="form-input" value={section.externalUrl ?? ''}
                  onChange={(e) => updateSection({ externalUrl: e.target.value })} placeholder="https://..." />
              </div>
            )}
            {section.actionType === 'page' && (
              <>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">المحتوى (عربي) — سطر جديد = فقرة</label>
                  <textarea
                    className="form-input"
                    rows={10}
                    value={section.contentAr}
                    onChange={(e) => updateSection({ contentAr: e.target.value })}
                    style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">المحتوى (إنجليزي)</label>
                  <textarea
                    className="form-input"
                    rows={10}
                    value={section.contentEn}
                    onChange={(e) => updateSection({ contentEn: e.target.value })}
                    style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">رابط إضافي اختياري</label>
                  <input className="form-input" value={section.externalUrl ?? ''}
                    onChange={(e) => updateSection({ externalUrl: e.target.value })} placeholder="https://..." />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
