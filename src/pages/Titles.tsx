import { useEffect, useState } from 'react';
import { Award, Save, Cloud, Plus, Trash2, UserPlus } from 'lucide-react';
import { Loading } from '@/components/Common';
import {
  getTitlesConfig,
  saveTitlesConfig,
  DEFAULT_TITLES_CONFIG,
  grantUserTitle,
  revokeUserTitle,
  logAdminAction,
  formatNumber,
  type ConfigTitles,
  type ConfigTitleDef,
  type ConfigTitleSlot,
  type ConfigTitleObtainType,
} from '@/services/admin';

type Tab = 'general' | 'slots' | 'catalog' | 'about' | 'grant';

const OBTAIN_TYPES: { id: ConfigTitleObtainType; label: string }[] = [
  { id: 'free', label: 'مجاني' },
  { id: 'vip', label: 'VIP' },
  { id: 'wealth', label: 'ثروة' },
  { id: 'aristocracy', label: 'أرستقراطية' },
  { id: 'purchase', label: 'شراء' },
  { id: 'manual', label: 'يدوي (أدمن)' },
];

const RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;

export default function TitlesPage() {
  const [config, setConfig] = useState<ConfigTitles>(DEFAULT_TITLES_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>('general');
  const [selectedId, setSelectedId] = useState('traveler');
  const [grantUid, setGrantUid] = useState('');
  const [grantTitleId, setGrantTitleId] = useState('traveler');
  const [grantDays, setGrantDays] = useState(0);
  const [granting, setGranting] = useState(false);

  const load = async () => {
    setLoading(true);
    let data = await getTitlesConfig();
    if (!data) {
      data = DEFAULT_TITLES_CONFIG;
      await saveTitlesConfig(data);
    }
    setConfig(data);
    setSelectedId(data.titles[0]?.id ?? 'traveler');
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const current = config.titles.find((t) => t.id === selectedId) ?? config.titles[0];

  const patch = (p: Partial<ConfigTitles>) => setConfig((c) => ({ ...c, ...p }));

  const updateTitle = (patchTitle: Partial<ConfigTitleDef>) => {
    if (!current) return;
    setConfig((c) => ({
      ...c,
      titles: c.titles.map((t) => (t.id === current.id ? { ...t, ...patchTitle } : t)),
    }));
  };

  const updateSlot = (idx: number, patchSlot: Partial<ConfigTitleSlot>) => {
    setConfig((c) => ({
      ...c,
      slots: c.slots.map((s) => (s.slotIndex === idx ? { ...s, ...patchSlot } : s)),
    }));
  };

  const addTitle = () => {
    const id = `title-${Date.now()}`;
    const t: ConfigTitleDef = {
      id,
      nameAr: 'لقب جديد',
      nameEn: 'New Title',
      enabled: true,
      imageUrl: '',
      rarity: 'common',
      obtainType: 'manual',
      obtainValue: 0,
      priceCoins: 0,
      validityDays: 30,
      order: config.titles.length + 1,
      descAr: '',
      descEn: '',
      gradientColors: ['#ff5a47', '#e11212'],
    };
    patch({ titles: [...config.titles, t] });
    setSelectedId(id);
  };

  const removeTitle = (id: string) => {
    if (!confirm('حذف هذا اللقب؟')) return;
    patch({ titles: config.titles.filter((t) => t.id !== id) });
    if (selectedId === id) setSelectedId(config.titles[0]?.id ?? '');
  };

  const updateRuleList = (
    key: 'aboutUseAr' | 'aboutUseEn' | 'aboutBadgeAr' | 'aboutBadgeEn',
    idx: number,
    value: string,
  ) => {
    const arr = [...config[key]];
    arr[idx] = value;
    patch({ [key]: arr });
  };

  const addRuleLine = (key: 'aboutUseAr' | 'aboutUseEn' | 'aboutBadgeAr' | 'aboutBadgeEn') => {
    patch({ [key]: [...config[key], ''] });
  };

  const removeRuleLine = (
    key: 'aboutUseAr' | 'aboutUseEn' | 'aboutBadgeAr' | 'aboutBadgeEn',
    idx: number,
  ) => {
    patch({ [key]: config[key].filter((_, i) => i !== idx) });
  };

  const handleSave = async () => {
    setSaving(true);
    await saveTitlesConfig(config);
    await logAdminAction('حفظ الألقاب', config.wallTitleAr);
    setSaving(false);
    alert('تم الحفظ — التطبيق يتحدّث فوراً');
  };

  const handleGrant = async () => {
    if (!grantUid.trim()) {
      alert('أدخل UID المستخدم');
      return;
    }
    setGranting(true);
    try {
      await grantUserTitle(grantUid.trim(), grantTitleId, grantDays);
      await logAdminAction('منح لقب', `${grantTitleId} → ${grantUid}`);
      alert('تم منح اللقب');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'فشل المنح');
    } finally {
      setGranting(false);
    }
  };

  const handleRevoke = async () => {
    if (!grantUid.trim()) {
      alert('أدخل UID المستخدم');
      return;
    }
    if (!confirm('سحب اللقب من المستخدم؟')) return;
    setGranting(true);
    try {
      await revokeUserTitle(grantUid.trim(), grantTitleId);
      await logAdminAction('سحب لقب', `${grantTitleId} ← ${grantUid}`);
      alert('تم سحب اللقب');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'فشل السحب');
    } finally {
      setGranting(false);
    }
  };

  if (loading) return <Loading />;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'general', label: 'عام' },
    { id: 'slots', label: 'الفتحات' },
    { id: 'catalog', label: 'الألقاب' },
    { id: 'about', label: 'صفحة الشرح' },
    { id: 'grant', label: 'منح يدوي' },
  ];

  return (
    <div className="page-container">
      <div className="filters-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success)', fontSize: 13, fontWeight: 600 }}>
          <Cloud size={16} /> مرتبط بالتطبيق — التعديلات فورية
        </div>
        <button className="btn btn-primary" style={{ marginRight: 'auto' }} onClick={handleSave} disabled={saving}>
          <Save size={16} /> {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {tabs.map((t) => (
          <button key={t.id} className={`btn ${tab === t.id ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(t.id)}>
            <Award size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <div className="card" style={{ padding: 20, display: 'grid', gap: 12, maxWidth: 640 }}>
          <h3 style={{ margin: 0 }}>إعدادات جدار الألقاب</h3>
          <label>
            <input type="checkbox" checked={config.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
            {' '}النظام مفعّل
          </label>
          <div className="form-row">
            <label className="form-label">عنوان الجدار (عربي)
              <input className="form-input" value={config.wallTitleAr} onChange={(e) => patch({ wallTitleAr: e.target.value })} />
            </label>
            <label className="form-label">عنوان الجدار (إنجليزي)
              <input className="form-input" value={config.wallTitleEn} onChange={(e) => patch({ wallTitleEn: e.target.value })} />
            </label>
          </div>
          <div className="form-row">
            <label className="form-label">فتحات مجانية افتراضية
              <input className="form-input" type="number" value={config.defaultSlots} onChange={(e) => patch({ defaultSlots: Number(e.target.value) || 0 })} />
            </label>
            <label className="form-label">أقصى فتحات
              <input className="form-input" type="number" value={config.maxSlots} onChange={(e) => patch({ maxSlots: Number(e.target.value) || 9 })} />
            </label>
          </div>
        </div>
      )}

      {tab === 'slots' && (
        <div className="card" style={{ padding: 20, maxWidth: 800 }}>
          <h3 style={{ margin: '0 0 12px' }}>فتحات الجدار (3×3)</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            الفتحات 0–2 مجانية، 3–5 VIP، 6–8 ثروة — كما في المرجع
          </p>
          <div style={{ display: 'grid', gap: 10 }}>
            {config.slots
              .slice()
              .sort((a, b) => a.slotIndex - b.slotIndex)
              .map((slot) => (
                <div key={slot.slotIndex} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 120px', gap: 8, alignItems: 'center' }}>
                  <strong>#{slot.slotIndex + 1}</strong>
                  <select
                    className="form-input"
                    value={slot.unlockType}
                    onChange={(e) => updateSlot(slot.slotIndex, { unlockType: e.target.value as ConfigTitleSlot['unlockType'] })}
                  >
                    <option value="free">مجاني</option>
                    <option value="vip">VIP</option>
                    <option value="wealth">ثروة</option>
                  </select>
                  <input
                    className="form-input"
                    type="number"
                    placeholder="قيمة الفتح"
                    value={slot.unlockValue}
                    onChange={(e) => updateSlot(slot.slotIndex, { unlockValue: Number(e.target.value) || 0 })}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {slot.unlockType === 'free' ? 'مفتوح' : slot.unlockType === 'vip' ? `VIP ${slot.unlockValue}` : `ثروة ${slot.unlockValue}`}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {tab === 'catalog' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            {config.titles.map((t) => (
              <button key={t.id} className={`btn ${selectedId === t.id ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSelectedId(t.id)}>
                {t.nameAr}
              </button>
            ))}
            <button className="btn btn-ghost" onClick={addTitle}><Plus size={14} /> إضافة لقب</button>
          </div>
          {current && (
            <div className="card" style={{ padding: 20, display: 'grid', gap: 12, maxWidth: 760 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>تعديل: {current.nameAr}</h3>
                <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => removeTitle(current.id)}>
                  <Trash2 size={14} /> حذف
                </button>
              </div>
              <label><input type="checkbox" checked={current.enabled} onChange={(e) => updateTitle({ enabled: e.target.checked })} /> مفعّل</label>
              <div className="form-row">
                <label className="form-label">المعرّف (id)
                  <input className="form-input" value={current.id} onChange={(e) => updateTitle({ id: e.target.value })} />
                </label>
                <label className="form-label">الترتيب
                  <input className="form-input" type="number" value={current.order} onChange={(e) => updateTitle({ order: Number(e.target.value) || 0 })} />
                </label>
              </div>
              <div className="form-row">
                <label className="form-label">الاسم عربي
                  <input className="form-input" value={current.nameAr} onChange={(e) => updateTitle({ nameAr: e.target.value })} />
                </label>
                <label className="form-label">الاسم إنجليزي
                  <input className="form-input" value={current.nameEn} onChange={(e) => updateTitle({ nameEn: e.target.value })} />
                </label>
              </div>
              <label className="form-label">رابط الصورة (PNG)
                <input className="form-input" value={current.imageUrl} onChange={(e) => updateTitle({ imageUrl: e.target.value })} placeholder="https://..." />
              </label>
              <div className="form-row">
                <label className="form-label">الندرة
                  <select className="form-input" value={current.rarity} onChange={(e) => updateTitle({ rarity: e.target.value as ConfigTitleDef['rarity'] })}>
                    {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>
                <label className="form-label">طريقة الحصول
                  <select className="form-input" value={current.obtainType} onChange={(e) => updateTitle({ obtainType: e.target.value as ConfigTitleObtainType })}>
                    {OBTAIN_TYPES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </label>
                <label className="form-label">قيمة الشرط
                  <input className="form-input" type="number" value={current.obtainValue} onChange={(e) => updateTitle({ obtainValue: Number(e.target.value) || 0 })} />
                </label>
              </div>
              <div className="form-row">
                <label className="form-label">سعر الشراء (كوينز)
                  <input className="form-input" type="number" value={current.priceCoins} onChange={(e) => updateTitle({ priceCoins: Number(e.target.value) || 0 })} />
                </label>
                <label className="form-label">أيام الصلاحية (0 = دائم)
                  <input className="form-input" type="number" value={current.validityDays} onChange={(e) => updateTitle({ validityDays: Number(e.target.value) || 0 })} />
                </label>
              </div>
              <div className="form-row">
                <label className="form-label">لون 1
                  <input className="form-input" value={current.gradientColors[0]} onChange={(e) => updateTitle({ gradientColors: [e.target.value, current.gradientColors[1]] })} />
                </label>
                <label className="form-label">لون 2
                  <input className="form-input" value={current.gradientColors[1]} onChange={(e) => updateTitle({ gradientColors: [current.gradientColors[0], e.target.value] })} />
                </label>
              </div>
              <label className="form-label">وصف عربي
                <textarea className="form-input" rows={2} value={current.descAr} onChange={(e) => updateTitle({ descAr: e.target.value })} />
              </label>
              <label className="form-label">وصف إنجليزي
                <textarea className="form-input" rows={2} value={current.descEn} onChange={(e) => updateTitle({ descEn: e.target.value })} />
              </label>
              {current.priceCoins > 0 && (
                <div style={{ fontSize: 13, padding: 10, background: 'var(--bg-secondary)', borderRadius: 8 }}>
                  السعر: {formatNumber(current.priceCoins)} كوين
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'about' && (
        <div style={{ display: 'grid', gap: 16, maxWidth: 760 }}>
          <div className="form-row">
            <label className="form-label">عنوان صفحة الشرح (عربي)
              <input className="form-input" value={config.aboutPageTitleAr} onChange={(e) => patch({ aboutPageTitleAr: e.target.value })} />
            </label>
            <label className="form-label">عنوان صفحة الشرح (إنجليزي)
              <input className="form-input" value={config.aboutPageTitleEn} onChange={(e) => patch({ aboutPageTitleEn: e.target.value })} />
            </label>
          </div>
          {(['aboutUseAr', 'aboutBadgeAr'] as const).map((key) => (
            <div key={key} className="card" style={{ padding: 16 }}>
              <h4 style={{ margin: '0 0 10px' }}>{key === 'aboutUseAr' ? '● استخدم اللقب ●' : '● وسام اللقب ●'}</h4>
              {config[key].map((line, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input className="form-input" style={{ flex: 1 }} value={line} onChange={(e) => updateRuleList(key, i, e.target.value)} />
                  <button className="btn btn-ghost" onClick={() => removeRuleLine(key, i)}><Trash2 size={14} /></button>
                </div>
              ))}
              <button className="btn btn-ghost" onClick={() => addRuleLine(key)}><Plus size={14} /> سطر</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'grant' && (
        <div className="card" style={{ padding: 20, maxWidth: 520, display: 'grid', gap: 12 }}>
          <h3 style={{ margin: 0 }}><UserPlus size={18} /> منح / سحب لقب يدوياً</h3>
          <label className="form-label">UID المستخدم
            <input className="form-input" value={grantUid} onChange={(e) => setGrantUid(e.target.value)} placeholder="firebase uid" />
          </label>
          <label className="form-label">اللقب
            <select className="form-input" value={grantTitleId} onChange={(e) => setGrantTitleId(e.target.value)}>
              {config.titles.map((t) => (
                <option key={t.id} value={t.id}>{t.nameAr} ({t.id})</option>
              ))}
            </select>
          </label>
          <label className="form-label">أيام الصلاحية (0 = دائم)
            <input className="form-input" type="number" value={grantDays} onChange={(e) => setGrantDays(Number(e.target.value) || 0)} />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={handleGrant} disabled={granting}>منح اللقب</button>
            <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={handleRevoke} disabled={granting}>سحب اللقب</button>
          </div>
        </div>
      )}
    </div>
  );
}
