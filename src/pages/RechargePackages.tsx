import { useEffect, useState } from 'react';
import {
  Coins, Plus, Pencil, Trash2, X, Save, Cloud, Gift, FolderOpen,
  ChevronUp, ChevronDown, Languages,
} from 'lucide-react';
import { Loading } from '@/components/Common';
import {
  getConfigPackagesState,
  saveConfigPackages,
  saveConfigPackageTags,
  DEFAULT_CONFIG_PACKAGES,
  DEFAULT_RECHARGE_PACKAGE_TAGS,
  logAdminAction,
  formatNumber,
  rechargePackageTagLabel,
  type ConfigRechargePackage,
  type ConfigRechargePackageTag,
} from '@/services/admin';

const APP_LANGUAGES = [
  { code: 'ar', name: 'العربية' },
  { code: 'en', name: 'English' },
] as const;

const EMPTY: ConfigRechargePackage = {
  id: '', coins: 10000, bonus: 0, priceUSD: 1, priceLabel: '$1',
};

function tagForPackage(tags: ConfigRechargePackageTag[], pkg: ConfigRechargePackage) {
  return tags.find((t) => t.id === pkg.tagId);
}

export default function RechargePage() {
  const [packages, setPackages] = useState<ConfigRechargePackage[]>([]);
  const [tags, setTags] = useState<ConfigRechargePackageTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ConfigRechargePackage | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [showTags, setShowTags] = useState(false);

  const load = async () => {
    setLoading(true);
    const { exists, packages: p, tags: t } = await getConfigPackagesState();
    let nextPackages = p;
    let nextTags = t;
    if (!exists || p.length === 0) {
      nextPackages = DEFAULT_CONFIG_PACKAGES;
      nextTags = DEFAULT_RECHARGE_PACKAGE_TAGS;
      await saveConfigPackages(nextPackages, nextTags);
    } else if (t.length === 0) {
      nextTags = DEFAULT_RECHARGE_PACKAGE_TAGS;
      await saveConfigPackageTags(nextTags);
    }
    setPackages(nextPackages);
    setTags(nextTags);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (pkg: ConfigRechargePackage) => {
    let updated: ConfigRechargePackage[];
    if (isNew) {
      const id = pkg.id || `pkg_${Date.now()}`;
      updated = [...packages, { ...pkg, id }];
      await logAdminAction('إضافة باقة شحن', pkg.priceLabel, `${formatNumber(pkg.coins)} عملة`);
    } else {
      updated = packages.map((p) => (p.id === pkg.id ? pkg : p));
      await logAdminAction('تعديل باقة شحن', pkg.priceLabel);
    }
    updated.sort((a, b) => a.priceUSD - b.priceUSD);
    setPackages(updated);
    await saveConfigPackages(updated, tags);
    setEditing(null);
  };

  const handleDelete = async (pkg: ConfigRechargePackage) => {
    if (!confirm(`حذف باقة "${pkg.priceLabel}"؟`)) return;
    const updated = packages.filter((p) => p.id !== pkg.id);
    setPackages(updated);
    await saveConfigPackages(updated, tags);
    await logAdminAction('حذف باقة شحن', pkg.priceLabel);
  };

  const handleSaveTags = async (next: ConfigRechargePackageTag[]) => {
    setTags(next);
    await saveConfigPackageTags(next);
    await logAdminAction('تحديث تصنيفات باقات الشحن', `${next.length} تصنيف`);
  };

  return (
    <div className="page-container">
      <div className="filters-bar" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success)', fontSize: 13, fontWeight: 600 }}>
          <Cloud size={16} /> مرتبط بالتطبيق — الأسعار تتحدّث فوراً
        </div>
        <div style={{ display: 'flex', gap: 8, marginRight: 'auto', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => setShowTags(true)}>
            <FolderOpen size={16} /> إدارة التصنيفات ({tags.length})
          </button>
          <button className="btn btn-primary" onClick={() => { setEditing({ ...EMPTY }); setIsNew(true); }}>
            <Plus size={18} /> إضافة باقة
          </button>
        </div>
      </div>

      {!tags.length && !loading && (
        <div className="card" style={{ padding: 20, marginBottom: 16, borderColor: 'var(--warning)' }}>
          <p style={{ margin: 0, fontWeight: 600, color: 'var(--warning)' }}>
            لا توجد تصنيفات بعد. افتح «إدارة التصنيفات» وأضف شارات مثل «الأكثر شيوعاً» أو «أفضل قيمة».
          </p>
        </div>
      )}

      {loading ? <Loading /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {packages.map((p) => {
            const tag = tagForPackage(tags, p);
            const border = tag?.borderColor;
            return (
              <div
                key={p.id}
                className="card"
                style={{
                  padding: 20,
                  position: 'relative',
                  border: border ? `2px solid ${border}` : undefined,
                }}
              >
                {tag && (
                  <div style={{ position: 'absolute', top: -10, right: 16 }}>
                    <span
                      className="badge badge-purple"
                      style={{ background: tag.color, color: '#fff', border: 'none' }}
                    >
                      {tag.emoji ? `${tag.emoji} ` : ''}{rechargePackageTagLabel(tag)}
                    </span>
                  </div>
                )}
                <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 4 }}>
                  <button className="action-icon edit" onClick={() => { setEditing(p); setIsNew(false); }}>
                    <Pencil size={14} />
                  </button>
                  <button className="action-icon ban" onClick={() => handleDelete(p)}>
                    <Trash2 size={14} />
                  </button>
                </div>

                <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(252,211,77,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '8px 0 14px' }}>
                  <Coins size={28} color="#F59E0B" />
                </div>

                <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--brand-primary)' }}>{p.priceLabel}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '6px 0' }}>
                  <Coins size={16} color="#F59E0B" />
                  <span style={{ fontSize: 18, fontWeight: 700 }}>{formatNumber(p.coins)}</span>
                </div>
                {p.bonus > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--success)', fontSize: 13, fontWeight: 700 }}>
                    <Gift size={14} /> +{formatNumber(p.bonus)} مكافأة
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <PackageEditor
          pkg={editing}
          isNew={isNew}
          tags={tags}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}

      {showTags && (
        <TagManager tags={tags} onSave={handleSaveTags} onClose={() => setShowTags(false)} />
      )}
    </div>
  );
}

function PackageEditor({ pkg, isNew, tags, onSave, onClose }: {
  pkg: ConfigRechargePackage;
  isNew: boolean;
  tags: ConfigRechargePackageTag[];
  onSave: (p: ConfigRechargePackage) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ConfigRechargePackage>(pkg);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isNew ? 'إضافة باقة شحن' : 'تعديل الباقة'}</h3>
          <button className="action-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">السعر بالدولار</label>
              <input className="form-input" type="number" step="0.01" value={form.priceUSD}
                onChange={(e) => setForm({ ...form, priceUSD: +e.target.value, priceLabel: `$${e.target.value}` })} />
            </div>
            <div className="form-group">
              <label className="form-label">نص السعر</label>
              <input className="form-input" value={form.priceLabel}
                onChange={(e) => setForm({ ...form, priceLabel: e.target.value })} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">العملات</label>
              <input className="form-input" type="number" value={form.coins}
                onChange={(e) => setForm({ ...form, coins: +e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">عملات إضافية (مكافأة)</label>
              <input className="form-input" type="number" value={form.bonus}
                onChange={(e) => setForm({ ...form, bonus: +e.target.value })} />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: 8 }}>
            <label className="form-label">تصنيف الباقة (يظهر في التطبيق)</label>
            {tags.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--warning)', margin: '6px 0 0' }}>
                أضف تصنيفات من «إدارة التصنيفات» أولاً.
              </p>
            ) : (
              <select
                className="form-input"
                value={form.tagId ?? ''}
                onChange={(e) => setForm({ ...form, tagId: e.target.value || undefined })}
              >
                <option value="">بدون تصنيف</option>
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.emoji ? `${t.emoji} ` : ''}{rechargePackageTagLabel(t)}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={() => onSave(form)}>
            <Save size={16} /> حفظ ونشر للتطبيق
          </button>
          <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </div>
  );
}

function TagManager({ tags, onSave, onClose }: {
  tags: ConfigRechargePackageTag[];
  onSave: (tags: ConfigRechargePackageTag[]) => Promise<void>;
  onClose: () => void;
}) {
  const [list, setList] = useState<ConfigRechargePackageTag[]>(tags);
  const [editing, setEditing] = useState<ConfigRechargePackageTag | null>(null);
  const [extraLang, setExtraLang] = useState('');
  const [saving, setSaving] = useState(false);

  const startNew = () => {
    setEditing({
      id: '',
      labels: { ar: '', en: '' },
      emoji: '⭐',
      color: '#e11212',
      borderColor: '#e11212',
      order: list.length,
      enabled: true,
    });
  };

  const saveTag = () => {
    if (!editing) return;
    const id = editing.id.trim() || `tag_${Date.now()}`;
    const labels: Record<string, string> = {};
    Object.entries(editing.labels).forEach(([k, v]) => {
      if (v?.trim()) labels[k] = v.trim();
    });
    if (!Object.keys(labels).length) {
      alert('أدخل اسم التصنيف بلغة واحدة على الأقل');
      return;
    }
    const item: ConfigRechargePackageTag = {
      id,
      labels,
      emoji: editing.emoji?.trim() || undefined,
      color: editing.color?.trim() || '#e11212',
      borderColor: editing.borderColor?.trim() || editing.color?.trim() || '#e11212',
      order: editing.order ?? list.length,
      enabled: editing.enabled !== false,
    };
    const exists = list.some((t) => t.id === id);
    setList(exists ? list.map((t) => (t.id === id ? item : t)) : [...list, item]);
    setEditing(null);
  };

  const removeTag = (id: string) => {
    if (!confirm('حذف هذا التصنيف؟ الباقات المرتبطة به ستبقى بدون شارة.')) return;
    setList(list.filter((t) => t.id !== id));
  };

  const moveTag = (idx: number, dir: -1 | 1) => {
    const next = [...list];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j]!, next[idx]!];
    setList(next.map((t, i) => ({ ...t, order: i })));
  };

  const addLanguageField = () => {
    if (!editing || !extraLang.trim()) return;
    const code = extraLang.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!code) return;
    setEditing({ ...editing, labels: { ...editing.labels, [code]: '' } });
    setExtraLang('');
  };

  const handlePublish = async () => {
    setSaving(true);
    try {
      await onSave(list.map((t, i) => ({ ...t, order: i })));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3><Languages size={18} style={{ verticalAlign: 'middle', marginLeft: 6 }} /> تصنيفات باقات الشحن</h3>
          <button className="action-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 0 }}>
            أضف شارات مخصّصة (مثل «الأكثر شيوعاً» أو «عرض خاص») — تظهر على الباقة في التطبيق حسب لغة المستخدم.
          </p>

          {list.map((t, idx) => (
            <div key={t.id} className="card" style={{ padding: 12, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                  background: t.color ?? '#e11212', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18,
                }}
              >
                {t.emoji || '🏷️'}
              </div>
              <div style={{ flex: 1 }}>
                <strong>{rechargePackageTagLabel(t)}</strong>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 8 }}>({t.id})</span>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {Object.entries(t.labels).map(([lang, label]) => (
                    <span key={lang} style={{ marginLeft: 10 }}>{lang}: {label}</span>
                  ))}
                </div>
              </div>
              <button className="action-icon" onClick={() => moveTag(idx, -1)} disabled={idx === 0}>
                <ChevronUp size={14} />
              </button>
              <button className="action-icon" onClick={() => moveTag(idx, 1)} disabled={idx === list.length - 1}>
                <ChevronDown size={14} />
              </button>
              <button className="action-icon edit" onClick={() => setEditing(t)}><Pencil size={14} /></button>
              <button className="action-icon ban" onClick={() => removeTag(t.id)}><Trash2 size={14} /></button>
            </div>
          ))}

          {!editing ? (
            <button className="btn btn-secondary" style={{ width: '100%', marginTop: 8 }} onClick={startNew}>
              <Plus size={16} /> تصنيف جديد
            </button>
          ) : (
            <div className="card" style={{ padding: 16, marginTop: 12 }}>
              <div className="form-group">
                <label className="form-label">معرّف التصنيف (إنجليزي، بدون مسافات)</label>
                <input className="form-input" value={editing.id}
                  placeholder="special_offer"
                  onChange={(e) => setEditing({ ...editing, id: e.target.value.replace(/\s/g, '_') })} />
              </div>
              {APP_LANGUAGES.map(({ code, name }) => (
                <div className="form-group" key={code}>
                  <label className="form-label">الاسم — {name} ({code})</label>
                  <input className="form-input" value={editing.labels[code] ?? ''}
                    onChange={(e) => setEditing({
                      ...editing,
                      labels: { ...editing.labels, [code]: e.target.value },
                    })} />
                </div>
              ))}
              {Object.keys(editing.labels)
                .filter((c) => !APP_LANGUAGES.some((l) => l.code === c))
                .map((code) => (
                  <div className="form-group" key={code}>
                    <label className="form-label">الاسم — {code}</label>
                    <input className="form-input" value={editing.labels[code] ?? ''}
                      onChange={(e) => setEditing({
                        ...editing,
                        labels: { ...editing.labels, [code]: e.target.value },
                      })} />
                  </div>
                ))}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input className="form-input" placeholder="كود لغة إضافي (fr)" value={extraLang}
                  onChange={(e) => setExtraLang(e.target.value)} style={{ flex: 1 }} />
                <button type="button" className="btn btn-secondary" onClick={addLanguageField}>إضافة لغة</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">إيموجي</label>
                  <input className="form-input" value={editing.emoji ?? ''} placeholder="🔥"
                    onChange={(e) => setEditing({ ...editing, emoji: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">لون الشارة</label>
                  <input className="form-input" type="color" value={editing.color ?? '#e11212'}
                    onChange={(e) => setEditing({ ...editing, color: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">لون الإطار</label>
                  <input className="form-input" type="color" value={editing.borderColor ?? '#e11212'}
                    onChange={(e) => setEditing({ ...editing, borderColor: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn btn-primary" onClick={saveTag}>حفظ التصنيف</button>
                <button className="btn btn-ghost" onClick={() => setEditing(null)}>إلغاء</button>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={handlePublish} disabled={saving}>
            <Save size={16} /> {saving ? 'جارٍ النشر...' : 'نشر للتطبيق'}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>إغلاق</button>
        </div>
      </div>
    </div>
  );
}
