import { useEffect, useRef, useState } from 'react';
import { Crown, Save, Cloud, Plus, Trash2, Pencil, X, Upload, Loader2, Eye, Gift } from 'lucide-react';
import { Loading } from '@/components/Common';
import { AristocracyPreview } from '@/components/AristocracyPreview';
import {
  getAristocracyConfig,
  saveAristocracyConfig,
  DEFAULT_ARISTOCRACY_CONFIG,
  logAdminAction,
  formatNumber,
  normalizeAristocracyConfig,
  buildRichAristocracyPrivileges,
  mergeSampleAristocracyLevels,
  SAMPLE_ARISTOCRACY_LEVELS,
  getConfigGifts,
  getConfigVipSystem,
  ARISTOCRACY_PRIVILEGE_ASSET_OPTIONS,
  ARISTOCRACY_THEME_OPTIONS,
  VIP_PRIVILEGE_ASSET_OPTIONS,
  normalizeAristocracyPrivilege,
  mergeRecoveredAristocracyUploads,
  type ConfigAristocracy,
  type ConfigAristocracyLevel,
  type ConfigAristocracyPrivilege,
  type ConfigGift,
  type ConfigVipLevel,
  type ConfigVipPrivilege,
} from '@/services/admin';
import { uploadAristocracyAsset, discoverAristocracyUploadedAssets, saveAristocracyPrivilegeMeta } from '@/lib/storage';

type Tab = 'levels' | 'privileges' | 'preview' | 'rules' | 'settings';

const RULE_SECTIONS: { key: keyof ConfigAristocracy; label: string }[] = [
  { key: 'rulesIntroAr', label: 'مقدمة القواعد (عربي)' },
  { key: 'rulesPurchaseAr', label: 'قواعد الشراء (عربي)' },
  { key: 'rulesRewardsAr', label: 'قواعد العائد (عربي)' },
  { key: 'rulesLegendAr', label: 'قواعد الأسطورة (عربي)' },
  { key: 'experienceCardRulesAr', label: 'بطاقة التجربة (عربي)' },
];

export default function AristocracyPage() {
  const [config, setConfig] = useState<ConfigAristocracy>(DEFAULT_ARISTOCRACY_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>('levels');
  const [selectedId, setSelectedId] = useState('noble');
  const [editingPrivilege, setEditingPrivilege] = useState<ConfigAristocracyPrivilege | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [gifts, setGifts] = useState<ConfigGift[]>([]);
  const [vipLevels, setVipLevels] = useState<ConfigVipLevel[]>([]);
  const [vipPrivileges, setVipPrivileges] = useState<ConfigVipPrivilege[]>([]);

  const load = async () => {
    setLoading(true);
    const [data, giftItems, vipSystem] = await Promise.all([
      getAristocracyConfig(),
      getConfigGifts(),
      getConfigVipSystem(),
    ]);
    let cfg = data;
    if (!cfg) {
      cfg = normalizeAristocracyConfig({ enabled: true });
      await saveAristocracyConfig(cfg);
    }
    setConfig(cfg);
    setGifts(giftItems);
    setVipLevels([...vipSystem.levels].sort((a, b) => a.level - b.level));
    setVipPrivileges(vipSystem.privileges ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const current = config.levels.find((l) => l.id === selectedId) ?? config.levels[0];

  const updateLevel = (patch: Partial<ConfigAristocracyLevel>) => {
    if (!current) return;
    setConfig((c) => ({
      ...c,
      levels: c.levels.map((l) => (l.id === current.id ? { ...l, ...patch } : l)),
    }));
  };

  const applyTheme = (themeKey: string) => {
    const theme = ARISTOCRACY_THEME_OPTIONS.find((t) => t.key === themeKey);
    if (!theme) {
      updateLevel({ themeKey });
      return;
    }
    updateLevel({ themeKey, accentColor: theme.accent, bgColors: [...theme.bg] });
  };

  const handleAddLevel = () => {
    alert('تم تثبيت 5 مستويات أرستقراطية فقط ولا يمكن إضافة مستوى جديد.');
  };

  const handleDeleteLevel = () => {
    alert('لا يمكن حذف مستويات الأرستقراطية الأساسية الخمسة.');
  };

  const persistConfig = async (next: ConfigAristocracy, successMsg?: string) => {
    const normalized = normalizeAristocracyConfig(next);
    await saveAristocracyConfig(normalized);
    setConfig(normalized);
    if (successMsg) alert(successMsg);
  };

  const handleSavePrivilege = async (priv: ConfigAristocracyPrivilege) => {
    if (!current) return;
    const exists = current.privileges.some((p) => p.id === priv.id);
    const privileges = exists
      ? current.privileges.map((p) => (p.id === priv.id ? priv : p))
      : [...current.privileges, priv].sort((a, b) => a.order - b.order);
    const next: ConfigAristocracy = {
      ...config,
      levels: config.levels.map((l) => (l.id === current.id ? { ...l, privileges } : l)),
    };
    setEditingPrivilege(null);
    try {
      await saveAristocracyPrivilegeMeta(`${current.id}_${priv.id}`, {
        levelId: current.id,
        privId: priv.id,
        assetKey: priv.assetKey,
        titleAr: priv.titleAr,
        titleEn: priv.titleEn,
      });
      await persistConfig(next);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'فشل حفظ الامتياز');
    }
  };

  const handleRestoreFromStorage = async () => {
    if (!confirm('استعادة الامتيازات من الملفات المرفوعة في Storage؟\n\nلكل مستوى له ملفات مرفوعة: تُستبدل امتيازات ذلك المستوى بالملفات من Storage فقط.')) return;
    setRestoring(true);
    try {
      const uploads = await discoverAristocracyUploadedAssets();
      if (!uploads.length) {
        alert('لم يُعثر على ملفات مرفوعة في Storage.');
        return;
      }
      const next = mergeRecoveredAristocracyUploads(config, uploads);
      await persistConfig(next, `تمت الاستعادة — ${uploads.length} ملف`);
      await logAdminAction('استعادة امتيازات أرستقراطية', `${uploads.length} ملف`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'فشلت الاستعادة');
    } finally {
      setRestoring(false);
    }
  };

  const handleDeletePrivilege = async (priv: ConfigAristocracyPrivilege) => {
    if (!current || !confirm(`حذف الامتياز «${priv.titleAr}»؟`)) return;
    const privileges = current.privileges.filter((p) => p.id !== priv.id);
    const next: ConfigAristocracy = {
      ...config,
      levels: config.levels.map((l) => (l.id === current.id ? { ...l, privileges } : l)),
    };
    try {
      await persistConfig(next);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'فشل الحذف');
    }
  };

  const handleDeleteAllPrivileges = async () => {
    if (!current || !current.privileges.length) return;
    if (!confirm(`حذف جميع امتيازات «${current.nameAr}» (${current.privileges.length})؟ لا يمكن التراجع.`)) return;
    const next: ConfigAristocracy = {
      ...config,
      levels: config.levels.map((l) => (l.id === current.id ? { ...l, privileges: [] } : l)),
    };
    try {
      await persistConfig(next);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'فشل الحذف');
    }
  };

  const addRuleLine = (key: keyof ConfigAristocracy) => {
    const arr = [...(config[key] as string[]), ''];
    setConfig((c) => ({ ...c, [key]: arr }));
  };

  const updateRule = (key: keyof ConfigAristocracy, idx: number, value: string) => {
    const arr = [...(config[key] as string[])];
    arr[idx] = value;
    setConfig((c) => ({ ...c, [key]: arr }));
  };

  const removeRuleLine = (key: keyof ConfigAristocracy, idx: number) => {
    const arr = (config[key] as string[]).filter((_, i) => i !== idx);
    setConfig((c) => ({ ...c, [key]: arr }));
  };

  const handleSave = async () => {
    setSaving(true);
    const normalized = normalizeAristocracyConfig(config);
    await saveAristocracyConfig(normalized);
    setConfig(normalized);
    await logAdminAction('حفظ الأرستقراطية', normalized.titleAr);
    setSaving(false);
    alert('تم الحفظ — التطبيق يتحدّث فوراً');
  };

  const handleSeedRichContent = async () => {
    const total = SAMPLE_ARISTOCRACY_LEVELS.length;
    if (!confirm(
      `تحميل محتوى واقعي لـ ${total} مستويات؟\n\n`
      + '• صور وأيقونات لكل امتياز\n'
      + '• خلفيات وشارات لكل مستوى\n'
      + '• الإمبراطور: 8 بطاقات + 12 أيقونة عرض\n'
      + '• متجر هدايا حصرية لكل مستوى (نبيل/ملك/إمبراطور)\n\n'
      + 'يُحافظ على الأسعار الحالية — يمكنك تعديل أي صورة بعد التحميل.',
    )) return;
    setSeeding(true);
    try {
      const merged = mergeSampleAristocracyLevels(config.levels);
      const next = normalizeAristocracyConfig({ ...config, levels: merged });
      setConfig(next);
      await saveAristocracyConfig(next);
      await logAdminAction('تحميل محتوى أرستقراطية', `${merged.length} مستوى`);
      alert(`تم!\n• ${merged.length} مستوى بمحتوى كامل\n• يظهر فوراً في التطبيق`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'فشل التحميل');
    } finally {
      setSeeding(false);
    }
  };

  if (loading) return <Loading />;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'levels', label: 'التصنيفات' },
    { id: 'privileges', label: 'امتيازات التصنيف' },
    { id: 'preview', label: 'معاينة التطبيق' },
    { id: 'rules', label: 'القواعد' },
    { id: 'settings', label: 'إعدادات' },
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
        <button className="btn btn-secondary" onClick={handleSeedRichContent} disabled={seeding}>
          {seeding ? <Loader2 size={16} className="spin" /> : <Crown size={16} />}
          محتوى واقعي ({SAMPLE_ARISTOCRACY_LEVELS.length} مستويات)
        </button>
      </div>

      {!loading && (
        <div className="card" style={{ padding: 16, marginBottom: 16, background: 'rgba(59, 130, 246, 0.06)', borderColor: 'rgba(59, 130, 246, 0.2)' }}>
          <p style={{ margin: '0 0 8px', fontWeight: 700, color: 'var(--primary)' }}>
            <Crown size={16} style={{ verticalAlign: 'middle', marginLeft: 6 }} />
            محتوى جاهز للتطبيق
          </p>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            اضغط «محتوى واقعي» لتحميل صور وأيقونات وامتيازات مرتبة لكل مستوى (القائد → الأسطورة).
            الإمبراطور يحصل على المحتوى الكامل مثل المنافس. كل صورة قابلة للاستبدال من محرر الامتياز أو رفع ملف جديد.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {tabs.map((t) => (
          <button key={t.id} className={`btn ${tab === t.id ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(t.id)}>
            <Crown size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'levels' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
              أضف أو عدّل تصنيفات الأرستقراطية — الأسماء والأسعار تنعكس مباشرة في التطبيق
            </p>
            <button className="btn btn-secondary btn-sm" onClick={handleAddLevel}>
              <Plus size={14} /> المستويات ثابتة (5)
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {config.levels.map((l) => (
              <button
                key={l.id}
                className={`btn ${selectedId === l.id ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setSelectedId(l.id)}
                style={{ opacity: l.enabled ? 1 : 0.5 }}
              >
                {l.nameAr}
                {l.comingSoon ? ' (قريباً)' : ''}
              </button>
            ))}
          </div>

          {current && (
            <div className="card" style={{ padding: 20, display: 'grid', gap: 14, maxWidth: 800 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>تعديل: {current.nameAr}</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    type="button"
                    onClick={() => {
                      if (!confirm(`استبدال امتيازات «${current.nameAr}» بالقائمة الغنية (صور + نصوص)؟`)) return;
                      updateLevel({ privileges: buildRichAristocracyPrivileges(current.level) });
                    }}
                  >
                    امتيازات غنية
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={handleDeleteLevel}>
                    <Trash2 size={14} /> حذف (مغلق)
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="form-label">الاسم (عربي)
                  <input className="form-input" value={current.nameAr} onChange={(e) => updateLevel({ nameAr: e.target.value })} />
                </label>
                <label className="form-label">الاسم (إنجليزي)
                  <input className="form-input" value={current.nameEn} onChange={(e) => updateLevel({ nameEn: e.target.value })} />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <label className="form-label">رقم التصنيف
                  <input className="form-input" type="number" min={1} value={current.level}
                    onChange={(e) => updateLevel({ level: Number(e.target.value) || 1 })} />
                </label>
                <label className="form-label">المعرّف (ID)
                  <input className="form-input" value={current.id} onChange={(e) => updateLevel({ id: e.target.value.trim() })} />
                </label>
                <label className="form-label">الثيم
                  <select className="form-input" value={current.themeKey} onChange={(e) => applyTheme(e.target.value)}>
                    {ARISTOCRACY_THEME_OPTIONS.map((t) => (
                      <option key={t.key} value={t.key}>{t.labelAr}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <label><input type="checkbox" checked={current.enabled} onChange={(e) => updateLevel({ enabled: e.target.checked })} /> مفعّل في التطبيق</label>
                <label><input type="checkbox" checked={current.comingSoon} onChange={(e) => updateLevel({ comingSoon: e.target.checked })} /> قريباً (لا يُشترى)</label>
                <label><input type="checkbox" checked={current.allowRenewal !== false} onChange={(e) => updateLevel({ allowRenewal: e.target.checked, renewalCoins: e.target.checked ? current.renewalCoins : 0 })} /> يسمح بالتجديد</label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                <label className="form-label">تفعيل (كوينز)
                  <input className="form-input" type="number" value={current.activationCoins} onChange={(e) => updateLevel({ activationCoins: Number(e.target.value) || 0 })} />
                </label>
                <label className="form-label">تجديد (كوينز)
                  <input className="form-input" type="number" disabled={current.allowRenewal === false} value={current.allowRenewal === false ? 0 : current.renewalCoins} onChange={(e) => updateLevel({ renewalCoins: Number(e.target.value) || 0 })} />
                </label>
                <label className="form-label">الصلاحية (أيام)
                  <input className="form-input" type="number" value={current.validityDays} onChange={(e) => updateLevel({ validityDays: Number(e.target.value) || 30 })} />
                </label>
                <label className="form-label">عائد %
                  <input className="form-input" type="number" value={current.coinReturnPercent} onChange={(e) => updateLevel({ coinReturnPercent: Number(e.target.value) || 0 })} />
                </label>
                <label className="form-label">كاش باك (كوينز)
                  <input className="form-input" type="number" value={current.coinReturnCoins ?? 0} onChange={(e) => updateLevel({ coinReturnCoins: Number(e.target.value) || 0 })} />
                </label>
                <label className="form-label">امتياز SVIP الممنوح
                  <select
                    className="form-input"
                    value={current.grantedVipLevel ?? 0}
                    onChange={(e) => updateLevel({ grantedVipLevel: Number(e.target.value) || 0 })}
                  >
                    <option value={0}>بدون امتيازات SVIP</option>
                    {vipLevels.map((lv) => {
                      const count = vipPrivileges.filter((p) => p.enabled !== false && p.unlockLevel <= lv.level).length;
                      return (
                        <option key={lv.level} value={lv.level}>
                          {lv.label || `SVIP${lv.level}`} — {count} امتياز
                        </option>
                      );
                    })}
                  </select>
                </label>
                <label className="form-label">نقاط تشريف
                  <input className="form-input" type="number" value={current.honorPointsRequired} onChange={(e) => updateLevel({ honorPointsRequired: Number(e.target.value) || 0 })} />
                </label>
                <label className="form-label">VIP مطلوب
                  <input className="form-input" type="number" value={current.requiredVipLevel} onChange={(e) => updateLevel({ requiredVipLevel: Number(e.target.value) || 0 })} />
                </label>
              </div>

              {(current.grantedVipLevel ?? 0) > 0 ? (
                <SvipPrivilegeSelector
                  grantedVipLevel={current.grantedVipLevel ?? 0}
                  vipPrivileges={vipPrivileges}
                  selectedKeys={current.svipPrivilegeKeys}
                  onChange={(keys) => updateLevel({ svipPrivilegeKeys: keys })}
                />
              ) : null}

              <EmblemUploadRow
                url={current.imageUrl}
                levelId={current.id}
                onUploaded={(url) => updateLevel({ imageUrl: url })}
                onClear={() => updateLevel({ imageUrl: undefined })}
              />

              <BackgroundUploadRow
                url={current.backgroundImageUrl}
                levelId={current.id}
                onUploaded={(url) => updateLevel({ backgroundImageUrl: url })}
                onClear={() => updateLevel({ backgroundImageUrl: undefined })}
              />

              <ExclusiveGiftsPicker
                gifts={gifts}
                selectedIds={current.exclusiveGiftIds ?? []}
                onChange={(ids) => updateLevel({ exclusiveGiftIds: ids })}
              />

              <div style={{ marginTop: 8 }}>
                <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
                  <Eye size={14} style={{ verticalAlign: 'middle', marginLeft: 6 }} />
                  معاينة سريعة — كما يظهر في التطبيق
                </p>
                <AristocracyPreview level={current} config={config} gifts={gifts} active />
              </div>

              <div style={{ fontSize: 13, padding: 10, background: 'var(--bg-secondary)', borderRadius: 8 }}>
                تفعيل: <strong>{formatNumber(current.activationCoins)}</strong> — تجديد: <strong>{current.allowRenewal === false ? 'غير متاح' : formatNumber(current.renewalCoins)}</strong> — عائد %: <strong>{current.coinReturnPercent}%</strong> — كاش باك: <strong>{formatNumber(current.coinReturnCoins ?? 0)}</strong> — SVIP: <strong>{
                  current.grantedVipLevel
                    ? `${vipLevels.find((lv) => lv.level === current.grantedVipLevel)?.label || `SVIP${current.grantedVipLevel}`} (${vipPrivileges.filter((p) => p.enabled !== false && p.unlockLevel <= (current.grantedVipLevel ?? 0)).length} امتياز)`
                    : 'بدون'
                }</strong> — {current.privileges.filter((p) => p.enabled !== false).length} امتياز عرض
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'privileges' && current && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {config.levels.map((l) => (
              <button key={l.id} className={`btn ${selectedId === l.id ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSelectedId(l.id)}>
                {l.nameAr}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ margin: 0 }}>امتيازات {current.nameAr}</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setEditingPrivilege(applyAristoAssetDefaults({
                  id: `priv-${Date.now()}`,
                  titleAr: '',
                  titleEn: '',
                  descAr: '',
                  descEn: '',
                  assetKey: 'entry',
                  layout: 'half',
                  order: (current.privileges.reduce((m, p) => Math.max(m, p.order), 0) || 0) + 1,
                  enabled: true,
                }, 'entry'))}
              >
                <Plus size={14} /> إضافة امتياز
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--danger)' }}
                disabled={!current.privileges.length}
                onClick={handleDeleteAllPrivileges}
              >
                <Trash2 size={14} /> حذف كل الامتيازات
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={restoring}
                onClick={handleRestoreFromStorage}
              >
                {restoring ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
                استعادة من Storage
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <AristocracyPreview level={current} config={config} gifts={gifts} />
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>الوظيفة</th>
                  <th>العرض</th>
                  <th>الترتيب</th>
                  <th>مفعّل</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {current.privileges.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.titleAr || p.id}</strong></td>
                    <td>{ARISTOCRACY_PRIVILEGE_ASSET_OPTIONS.find((o) => o.key === p.assetKey)?.labelAr ?? p.assetKey}</td>
                    <td>{p.layout === 'wide' ? 'عريض' : p.layout === 'icon' ? 'أيقونة (عرض)' : 'نصف'}</td>
                    <td>{p.order}</td>
                    <td>{p.enabled === false ? 'معطّل' : 'نعم'}</td>
                    <td style={{ display: 'flex', gap: 4 }}>
                      <button className="action-icon edit" onClick={() => setEditingPrivilege(p)}><Pencil size={14} /></button>
                      <button className="action-icon delete" onClick={() => handleDeletePrivilege(p)}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'preview' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {config.levels.map((l) => (
              <button key={l.id} className={`btn ${selectedId === l.id ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSelectedId(l.id)}>
                {l.nameAr}
              </button>
            ))}
          </div>
          {current && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
              <div>
                <h3 style={{ margin: '0 0 12px' }}>معاينة {current.nameAr}</h3>
                <AristocracyPreview level={current} config={config} gifts={gifts} active />
              </div>
              <div className="card" style={{ padding: 16, fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                <p style={{ margin: '0 0 8px', fontWeight: 700, color: 'var(--text-primary)' }}>هيكل الشاشة</p>
                <ol style={{ margin: 0, paddingRight: 18 }}>
                  <li>بطاقات المعاينة (عمودين) — layout: نصف/عريض</li>
                  <li>متجر الهدايا الحصرية (4 أعمدة) — من اختيار الهدايا أدناه</li>
                  <li>فاصل + شعار + «إمتيازات العرض»</li>
                  <li>شبكة الأيقونات (3 أعمدة) — layout: أيقونة</li>
                  <li>شريط السعر + تفعيل / أرسل</li>
                </ol>
                <p style={{ margin: '12px 0 0' }}>
                  {(current.privileges.filter((p) => p.enabled !== false && (p.layout === 'half' || p.layout === 'wide')).length)} بطاقة معاينة —{' '}
                  {(current.exclusiveGiftIds?.length ?? 0)} هدية —{' '}
                  {current.privileges.filter((p) => p.enabled !== false && p.layout === 'icon').length} أيقونة عرض
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'rules' && (
        <div className="card" style={{ padding: 20, maxWidth: 720, display: 'grid', gap: 18 }}>
          {RULE_SECTIONS.map(({ key, label }) => (
            <div key={key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong>{label}</strong>
                <button className="btn btn-ghost btn-sm" onClick={() => addRuleLine(key)}><Plus size={12} /> سطر</button>
              </div>
              {(config[key] as string[]).map((rule, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <input className="form-input" style={{ flex: 1 }} value={rule}
                    onChange={(e) => updateRule(key, idx, e.target.value)} />
                  <button className="btn btn-ghost btn-sm" onClick={() => removeRuleLine(key, idx)}><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          ))}
          <label className="form-label">عنوان جدول الأسعار (عربي)
            <input className="form-input" value={config.levelTableNoteAr}
              onChange={(e) => setConfig((c) => ({ ...c, levelTableNoteAr: e.target.value }))} />
          </label>
        </div>
      )}

      {tab === 'settings' && (
        <div className="card" style={{ padding: 20, maxWidth: 480, display: 'grid', gap: 12 }}>
          <label><input type="checkbox" checked={config.enabled} onChange={(e) => setConfig((c) => ({ ...c, enabled: e.target.checked }))} /> مفعّل في التطبيق</label>
          <label className="form-label">عنوان الصفحة (عربي)
            <input className="form-input" value={config.titleAr} onChange={(e) => setConfig((c) => ({ ...c, titleAr: e.target.value }))} />
          </label>
          <label className="form-label">عنوان الصفحة (إنجليزي)
            <input className="form-input" value={config.titleEn} onChange={(e) => setConfig((c) => ({ ...c, titleEn: e.target.value }))} />
          </label>
          <label className="form-label">عنوان «إمتيازات العرض» (عربي)
            <input className="form-input" value={config.showPrivilegesSectionAr ?? ''}
              onChange={(e) => setConfig((c) => ({ ...c, showPrivilegesSectionAr: e.target.value }))} />
          </label>
          <label className="form-label">عنوان «إمتيازات العرض» (إنجليزي)
            <input className="form-input" value={config.showPrivilegesSectionEn ?? ''}
              onChange={(e) => setConfig((c) => ({ ...c, showPrivilegesSectionEn: e.target.value }))} />
          </label>
          <label className="form-label">نص «قيود الهوية» (عربي)
            <input className="form-input" value={config.identityRulesAr ?? ''}
              onChange={(e) => setConfig((c) => ({ ...c, identityRulesAr: e.target.value }))} />
          </label>
          <label className="form-label">نص «قيود الهوية» (إنجليزي)
            <input className="form-input" value={config.identityRulesEn ?? ''}
              onChange={(e) => setConfig((c) => ({ ...c, identityRulesEn: e.target.value }))} />
          </label>
          <label className="form-label">أيام الحماية
            <input className="form-input" type="number" value={config.gracePeriodDays} onChange={(e) => setConfig((c) => ({ ...c, gracePeriodDays: Number(e.target.value) || 5 }))} />
          </label>
          <label className="form-label">أيام فقدان العائد المجمّد
            <input className="form-input" type="number" value={config.frozenExpireDays} onChange={(e) => setConfig((c) => ({ ...c, frozenExpireDays: Number(e.target.value) || 60 }))} />
          </label>
          <label className="form-label">أقصى صلاحية (أيام)
            <input className="form-input" type="number" value={config.maxValidityDays} onChange={(e) => setConfig((c) => ({ ...c, maxValidityDays: Number(e.target.value) || 120 }))} />
          </label>
        </div>
      )}

      {editingPrivilege && current && (
        <PrivilegeEditor
          privilege={editingPrivilege}
          levelId={current.id}
          onSave={handleSavePrivilege}
          onClose={() => setEditingPrivilege(null)}
        />
      )}
    </div>
  );
}

function SvipPrivilegeSelector({
  grantedVipLevel,
  vipPrivileges,
  selectedKeys,
  onChange,
}: {
  grantedVipLevel: number;
  vipPrivileges: ConfigVipPrivilege[];
  selectedKeys?: string[];
  onChange: (keys: string[]) => void;
}) {
  // مفاتيح امتيازات SVIP المفتوحة عند هذا المستوى (بدون تكرار)
  const unlockedKeys = Array.from(
    new Set(
      vipPrivileges
        .filter((p) => p.enabled !== false && p.unlockLevel <= grantedVipLevel)
        .map((p) => p.assetKey),
    ),
  );

  // undefined = الكل مفعّل (سلوك افتراضي)
  const effective = Array.isArray(selectedKeys) ? selectedKeys : unlockedKeys;
  const labelFor = (key: string) => VIP_PRIVILEGE_ASSET_OPTIONS.find((o) => o.key === key)?.labelAr ?? key;
  const featureFor = (key: string) => VIP_PRIVILEGE_ASSET_OPTIONS.find((o) => o.key === key)?.feature ?? '';

  const toggle = (key: string) => {
    const base = Array.isArray(selectedKeys) ? selectedKeys : unlockedKeys;
    const next = base.includes(key) ? base.filter((k) => k !== key) : [...base, key];
    onChange(next);
  };

  if (!unlockedKeys.length) return null;

  return (
    <div style={{ marginTop: 8, padding: 14, background: 'var(--bg-secondary)', borderRadius: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <strong style={{ fontSize: 13 }}>امتيازات SVIP التي تظهر للأرستقراطي ({effective.length}/{unlockedKeys.length})</strong>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange([...unlockedKeys])}>تحديد الكل</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange([])}>إلغاء الكل</button>
        </div>
      </div>
      <p style={{ margin: '6px 0 12px', fontSize: 11.5, color: 'var(--text-muted)' }}>
        اختر الامتيازات التي يحصل عليها حامل هذا المستوى من امتيازات SVIP — البقية لن تظهر له حتى لو فُتحت في المستوى.
        يُطبَّق على المشترين الجدد وعند المنح/التجديد.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
        {unlockedKeys.map((key) => {
          const checked = effective.includes(key);
          return (
            <label
              key={key}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                background: checked ? 'rgba(245, 183, 33, 0.12)' : 'var(--bg-primary)',
                border: `1px solid ${checked ? 'var(--warning, #F5B721)' : 'var(--border)'}`,
              }}
            >
              <input type="checkbox" checked={checked} onChange={() => toggle(key)} style={{ marginTop: 3 }} />
              <span style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{labelFor(key)}</span>
                <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{featureFor(key)}</span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function ExclusiveGiftsPicker({
  gifts,
  selectedIds,
  onChange,
}: {
  gifts: ConfigGift[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  if (!gifts.length) {
    return (
      <div className="form-group">
        <label className="form-label">
          <Gift size={14} style={{ verticalAlign: 'middle', marginLeft: 6 }} />
          متجر الهدايا الحصرية
        </label>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
          لا توجد هدايا في النظام — أضف هدايا من صفحة الهدايا أولاً أو اضغط «محتوى واقعي» للهدايا التجريبية.
        </p>
      </div>
    );
  }

  const sorted = [...gifts].sort((a, b) => {
    const aSel = selectedIds.includes(a.id) ? 0 : 1;
    const bSel = selectedIds.includes(b.id) ? 0 : 1;
    return aSel - bSel || a.name.localeCompare(b.name, 'ar');
  });

  return (
    <div className="form-group">
      <label className="form-label">
        <Gift size={14} style={{ verticalAlign: 'middle', marginLeft: 6 }} />
        متجر الهدايا الحصرية — اختر الهدايا كما تظهر في التطبيق (4 أعمدة)
      </label>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
          gap: 8,
          maxHeight: 280,
          overflowY: 'auto',
          padding: 8,
          background: 'var(--bg-secondary)',
          borderRadius: 10,
          border: '1px solid var(--border)',
        }}
      >
        {sorted.map((g) => {
          const selected = selectedIds.includes(g.id);
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => toggle(g.id)}
              style={{
                border: selected ? '2px solid var(--primary)' : '1px solid var(--border)',
                borderRadius: 10,
                padding: 8,
                background: selected ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-primary)',
                cursor: 'pointer',
                textAlign: 'center',
                minHeight: 96,
              }}
            >
              {g.imageUrl ? (
                <img src={g.imageUrl} alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />
              ) : (
                <div style={{ width: 40, height: 40, margin: '0 auto', background: 'var(--bg-secondary)', borderRadius: 8 }} />
              )}
              <div style={{ fontSize: 10, fontWeight: 600, marginTop: 4, lineHeight: 1.35, wordBreak: 'break-word' }}>
                {g.name}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginTop: 2 }}>{formatNumber(g.price)}</div>
            </button>
          );
        })}
      </div>
      <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text-secondary)' }}>
        محدّد: {selectedIds.length} هدية
      </p>
    </div>
  );
}

function BackgroundUploadRow({
  url, levelId, onUploaded, onClear,
}: {
  url?: string; levelId: string; onUploaded: (url: string) => void; onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handlePick = async (file: File) => {
    setUploading(true);
    try {
      const uploaded = await uploadAristocracyAsset(file, levelId, 'background');
      onUploaded(uploaded);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'فشل الرفع');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="form-group">
      <label className="form-label">خلفية المستوى (PNG/JPG)</label>
      {url ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <img src={url} alt="" style={{ width: 120, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClear}>إزالة</button>
        </div>
      ) : null}
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handlePick(f); e.target.value = ''; }} />
      <button type="button" className="btn btn-secondary btn-sm" disabled={uploading}
        onClick={() => inputRef.current?.click()}>
        {uploading ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
        {uploading ? ' جارٍ الرفع...' : ' رفع الخلفية'}
      </button>
    </div>
  );
}

function EmblemUploadRow({
  url, levelId, onUploaded, onClear,
}: {
  url?: string; levelId: string; onUploaded: (url: string) => void; onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handlePick = async (file: File) => {
    setUploading(true);
    try {
      const uploaded = await uploadAristocracyAsset(file, levelId, 'emblem');
      onUploaded(uploaded);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'فشل الرفع');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="form-group">
      <label className="form-label">شعار التصنيف (PNG/GIF)</label>
      {url ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <img src={url} alt="" style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border)' }} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClear}>إزالة</button>
        </div>
      ) : null}
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handlePick(f); e.target.value = ''; }} />
      <button type="button" className="btn btn-secondary btn-sm" disabled={uploading}
        onClick={() => inputRef.current?.click()}>
        {uploading ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
        {uploading ? ' جارٍ الرفع...' : ' رفع الشعار'}
      </button>
    </div>
  );
}

// تعبئة تلقائية لاسم/وصف/عرض الامتياز حسب وظيفته — حتى لا يحتاج المشرف لإدخالها يدوياً
const ARISTO_ASSET_DEFAULTS: Record<string, { titleAr: string; titleEn: string; descAr: string; descEn: string; layout: 'wide' | 'half' | 'icon' }> = {
  entry: { titleAr: 'دخولية', titleEn: 'Entrance', descAr: 'مؤثرات دخول حصرية', descEn: 'Exclusive entrance', layout: 'half' },
  frame: { titleAr: 'إطار الصورة', titleEn: 'Avatar Frame', descAr: 'إطار فاخر متحرك', descEn: 'Animated frame', layout: 'half' },
  profileCard: { titleAr: 'بطاقة الملف', titleEn: 'Profile Card', descAr: 'تصميم فاخر لملفك', descEn: 'Premium profile card', layout: 'wide' },
  effects: { titleAr: 'تأثيرات', titleEn: 'Effects', descAr: 'تأثيرات بصرية مميزة', descEn: 'Special visual effects', layout: 'half' },
  badge: { titleAr: 'وسام الهوية', titleEn: 'Identity Badge', descAr: 'وسام ذهبي على ملفك', descEn: 'Golden identity badge', layout: 'half' },
  bubble: { titleAr: 'إطار الكتابة', titleEn: 'Chat Frame', descAr: 'رسائلك بارزة', descEn: 'Stand-out messages', layout: 'wide' },
  emblem: { titleAr: 'شعار التصنيف', titleEn: 'Tier Emblem', descAr: 'شعار يظهر مع مستواك', descEn: 'Tier emblem', layout: 'icon' },
};

function applyAristoAssetDefaults(p: ConfigAristocracyPrivilege, key: string): ConfigAristocracyPrivilege {
  const d = ARISTO_ASSET_DEFAULTS[key] ?? ARISTO_ASSET_DEFAULTS.entry;
  return { ...p, assetKey: key, titleAr: d.titleAr, titleEn: d.titleEn, descAr: d.descAr, descEn: d.descEn, layout: d.layout };
}

function AristoAssetUploadRow({
  label, hint, url, uploading, statusLabel, onPick, onClear, accept = 'image/png,image/jpeg,image/webp,image/gif',
}: {
  label: string; hint: string; url?: string; uploading: boolean; statusLabel?: string;
  onPick: (file: File) => void; onClear: () => void; accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isVideo = !!url && /\.(mp4|mov|webm|m4v)($|\?|#)/i.test(url);
  return (
    <div className="form-group" style={{ marginTop: 12 }}>
      <label className="form-label">{label}</label>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 8px' }}>{hint}</p>
      {url ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          {isVideo ? (
            <video src={url} controls style={{ width: 120, height: 75, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: '#000' }} />
          ) : (
            <img src={url} alt="" style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border)' }} />
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClear}>إزالة</button>
        </div>
      ) : null}
      <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ''; }} />
      <button type="button" className="btn btn-secondary btn-sm" disabled={uploading}
        onClick={() => inputRef.current?.click()}>
        {uploading ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
        {uploading ? ` ${statusLabel || 'جارٍ الرفع...'}` : ' رفع من الجهاز'}
      </button>
    </div>
  );
}

function PrivilegeEditor({
  privilege, levelId, onSave, onClose,
}: {
  privilege: ConfigAristocracyPrivilege;
  levelId: string;
  onSave: (p: ConfigAristocracyPrivilege) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ConfigAristocracyPrivilege>({ ...privilege });
  const [uploading, setUploading] = useState<'image' | 'video' | 'videoMp4' | null>(null);
  const [statusLabel, setStatusLabel] = useState('');

  const assetId = `${levelId}_${form.id}`;

  const handleUpload = async (file: File, kind: 'privilege' | 'video' | 'videoMp4') => {
    setUploading(kind === 'privilege' ? 'image' : kind);
    setStatusLabel('جارٍ التحضير…');
    try {
      const url = await uploadAristocracyAsset(file, assetId, kind, ({ stage, ratio }) => {
        if (stage === 'load') setStatusLabel('تحضير الضاغط…');
        else if (stage === 'transcode') setStatusLabel(`جارٍ الضغط ${Math.round(ratio * 100)}%`);
        else setStatusLabel('جارٍ الرفع…');
      });
      if (kind === 'video') setForm((f) => ({ ...f, videoUrl: url }));
      else if (kind === 'videoMp4') setForm((f) => ({ ...f, videoUrlMp4: url }));
      else setForm((f) => ({ ...f, imageUrl: url }));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'فشل الرفع');
    } finally {
      setUploading(null);
      setStatusLabel('');
    }
  };

  // امتيازات تعتمد فيديو دخولية (دخولية الغرف) — مثل دخولية SVIP
  const isEntry = form.assetKey === 'entry';
  // امتيازات تعتمد صورة متحركة GIF (إطار الصورة / إطار الدردشة)
  const isAnimated = form.assetKey === 'frame' || form.assetKey === 'bubble';

  const imageLabel = isAnimated
    ? 'صورة الامتياز المتحركة (GIF)'
    : form.assetKey === 'badge'
    ? 'صورة الوسام'
    : 'أيقونة الامتياز (صورة المعاينة)';
  const imageHint = isAnimated
    ? 'يفضّل GIF متحرك بخلفية شفافة — يظهر مثل إطار/فقاعة SVIP'
    : 'PNG, JPG, WebP أو GIF متحرك';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520, maxHeight: '92vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>امتياز: {ARISTO_ASSET_DEFAULTS[form.assetKey]?.titleAr ?? (form.titleAr || form.id)}</h3>
          <button className="action-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <label className="form-label">نوع الامتياز
            <select className="form-input" value={form.assetKey}
              onChange={(e) => setForm((f) => applyAristoAssetDefaults(f, e.target.value))}>
              {ARISTOCRACY_PRIVILEGE_ASSET_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>{o.labelAr} — {o.feature}</option>
              ))}
            </select>
          </label>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '6px 0 4px' }}>
            الاسم والوصف يُضبطان تلقائياً حسب النوع — فقط ارفع الملف المطلوب.
          </p>

          <AristoAssetUploadRow
            label={imageLabel}
            hint={imageHint}
            url={form.imageUrl}
            uploading={uploading === 'image'}
            statusLabel={statusLabel}
            onPick={(f) => void handleUpload(f, 'privilege')}
            onClear={() => setForm({ ...form, imageUrl: undefined })}
          />

          {isEntry ? (
            <>
              <AristoAssetUploadRow
                label="فيديو الدخولية الرئيسي (WebM / MP4 / MOV)"
                hint="يظهر لكل من في الوكالة أو الغرفة الخاصة عند دخول الأرستقراطي — مثل فيديو الهدية"
                url={form.videoUrl}
                uploading={uploading === 'video'}
                statusLabel={statusLabel}
                accept="video/mp4,video/quicktime,video/webm,video/x-m4v"
                onPick={(f) => void handleUpload(f, 'video')}
                onClear={() => setForm({ ...form, videoUrl: undefined })}
              />
              <AristoAssetUploadRow
                label="فيديو الدخولية لنظام iOS (MP4 / MOV)"
                hint="صيغة MP4 أو MOV المشفرة بـ H.264 المطلوبة للآيفون"
                url={form.videoUrlMp4}
                uploading={uploading === 'videoMp4'}
                statusLabel={statusLabel}
                accept="video/mp4,video/quicktime,video/x-m4v"
                onPick={(f) => void handleUpload(f, 'videoMp4')}
                onClear={() => setForm({ ...form, videoUrlMp4: undefined })}
              />
            </>
          ) : null}

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <input type="checkbox" checked={form.enabled !== false} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
            مفعّل في التطبيق
          </label>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={() => onSave(normalizeAristocracyPrivilege(applyAristoAssetDefaults(form, form.assetKey)))}><Save size={16} /> حفظ</button>
          <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </div>
  );
}
