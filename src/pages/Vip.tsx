import { useEffect, useRef, useState } from 'react';
import { Pencil, X, Save, Cloud, Upload, Loader2, Plus, Trash2 } from 'lucide-react';
import { Loading } from '@/components/Common';
import {
  getConfigVipSystem, saveConfigVipSystem, DEFAULT_CONFIG_VIP_SYSTEM, logAdminAction, formatNumber,
  normalizeConfigVipLevel, normalizeConfigVipSystem, normalizeConfigVipPrivilege, getConfigStoreState,
  type ConfigVipSystem, type ConfigVipLevel, type ConfigVipPrivilege, type ConfigStoreItem,
  VIP_PRIVILEGE_ASSET_OPTIONS,
} from '@/services/admin';
import { uploadVipAsset } from '@/lib/storage';

export default function VipPage() {
  const [vipSystem, setVipSystem] = useState<ConfigVipSystem>(DEFAULT_CONFIG_VIP_SYSTEM);
  const [loading, setLoading] = useState(true);
  const [editingLevel, setEditingLevel] = useState<ConfigVipLevel | null>(null);
  const [editingPrivilege, setEditingPrivilege] = useState<ConfigVipPrivilege | null>(null);

  const load = async () => {
    setLoading(true);
    let sys = await getConfigVipSystem();
    if (!sys.levels?.length) {
      sys = DEFAULT_CONFIG_VIP_SYSTEM;
      await saveConfigVipSystem(sys);
    }
    setVipSystem(sys);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSaveLevel = async (level: ConfigVipLevel) => {
    const normalized = normalizeConfigVipLevel(level);
    const updated = {
      ...vipSystem,
      levels: vipSystem.levels.map((l) => (l.level === normalized.level ? normalized : l)),
    };
    setVipSystem(updated);
    await saveConfigVipSystem(normalizeConfigVipSystem(updated));
    await logAdminAction('تعديل مستوى VIP', normalized.label, `${formatNumber(normalized.priceCoins)} كوين`);
    setEditingLevel(null);
  };

  const handleSavePrivilege = async (priv: ConfigVipPrivilege) => {
    const normalizedPriv = normalizeConfigVipPrivilege(priv);
    const exists = vipSystem.privileges.some((p) => p.id === normalizedPriv.id);
    const updated = {
      ...vipSystem,
      privileges: exists
        ? vipSystem.privileges.map((p) => (p.id === normalizedPriv.id ? normalizedPriv : p))
        : [...vipSystem.privileges, normalizedPriv].sort((a, b) => a.order - b.order),
    };
    setVipSystem(updated);
    await saveConfigVipSystem(normalizeConfigVipSystem(updated));
    await logAdminAction(exists ? 'تعديل امتياز VIP' : 'إضافة امتياز VIP', normalizedPriv.title || normalizedPriv.id, `مستوى ${normalizedPriv.unlockLevel}`);
    setEditingPrivilege(null);
  };

  const handleAddPrivilege = () => {
    const nextOrder = (vipSystem.privileges.reduce((m, p) => Math.max(m, p.order), 0) || 0) + 1;
    const id = `privilege-${Date.now()}`;
    setEditingPrivilege({
      id,
      assetKey: 'vipBadge',
      titleKey: 'vipHub.privilegeBadge',
      descKey: 'vipHub.privilegeBadgeDesc',
      unlockLevel: 1,
      mode: 'svip',
      order: nextOrder,
      title: '',
      desc: '',
      enabled: true,
    });
  };

  const handleDeletePrivilege = async (priv: ConfigVipPrivilege) => {
    if (!confirm(`حذف الامتياز «${priv.title || priv.id}»؟`)) return;
    const updated = {
      ...vipSystem,
      privileges: vipSystem.privileges.filter((p) => p.id !== priv.id),
    };
    setVipSystem(updated);
    await saveConfigVipSystem(normalizeConfigVipSystem(updated));
    await logAdminAction('حذف امتياز VIP', priv.title || priv.id);
  };

  const saveSettings = async () => {
    const normalized = normalizeConfigVipSystem(vipSystem);
    await saveConfigVipSystem(normalized);
    setVipSystem(normalized);
    await logAdminAction('تعديل إعدادات VIP', 'عام', `${normalized.validityDays} يوم`);
  };

  if (loading) return <div className="page-container"><Loading /></div>;

  return (
    <div className="page-container">
      <div className="filters-bar" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success)', fontSize: 13, fontWeight: 600 }}>
          <Cloud size={16} /> مرتبط بالتطبيق — يتحدّث فوراً
        </div>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>المستويات والامتيازات</h2>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div>
            <label className="form-label">نقاط لكل عملة مشحونة</label>
            <input
              className="form-input"
              type="number"
              value={vipSystem.pointPerCoin}
              onChange={(e) => setVipSystem({ ...vipSystem, pointPerCoin: +e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">مدة العضوية (أيام)</label>
            <input
              className="form-input"
              type="number"
              value={vipSystem.validityDays ?? 30}
              onChange={(e) => setVipSystem({ ...vipSystem, validityDays: +e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">أيام التحذير قبل انتهاء الباقة</label>
            <input
              className="form-input"
              type="number"
              min={1}
              max={30}
              value={vipSystem.expiryWarningDays ?? 5}
              onChange={(e) => setVipSystem({ ...vipSystem, expiryWarningDays: +e.target.value })}
            />
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              تُرسل رسالة يومية داخل التطبيق وPush خلال هذه المدة إذا لم يشحن المستخدم
            </p>
          </div>
          <div>
            <label className="form-label">الإنزال عند فشل الحفاظ (مستوى)</label>
            <input
              className="form-input"
              type="number"
              min={1}
              value={vipSystem.downgradeToLevel ?? 1}
              onChange={(e) => setVipSystem({ ...vipSystem, downgradeToLevel: +e.target.value })}
            />
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              عند عدم تحقيق نقاط الحفاظ خلال الشهر يُخفَّض المستخدم لهذا المستوى (افتراضي SVIP1)
            </p>
          </div>
        </div>
        <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={saveSettings}>
          <Save size={14} /> حفظ الإعدادات
        </button>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>إعدادات شاشة SVIP</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <label className="form-label">عنوان الشاشة (عربي)</label>
            <input className="form-input" value={vipSystem.screenTitleAr ?? 'SVIP'}
              onChange={(e) => setVipSystem({ ...vipSystem, screenTitleAr: e.target.value })} />
          </div>
          <div>
            <label className="form-label">عنوان الشاشة (English)</label>
            <input className="form-input" value={vipSystem.screenTitleEn ?? 'SVIP'}
              onChange={(e) => setVipSystem({ ...vipSystem, screenTitleEn: e.target.value })} />
          </div>
          <div>
            <label className="form-label">عنوان شريط الامتيازات (عربي)</label>
            <input className="form-input" value={vipSystem.privilegesSectionAr ?? 'امتيازات'}
              onChange={(e) => setVipSystem({ ...vipSystem, privilegesSectionAr: e.target.value })} />
          </div>
          <div>
            <label className="form-label">عنوان شريط الامتيازات (English)</label>
            <input className="form-input" value={vipSystem.privilegesSectionEn ?? 'Privileges'}
              onChange={(e) => setVipSystem({ ...vipSystem, privilegesSectionEn: e.target.value })} />
          </div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '12px 0 8px' }}>أزرار الإجراءات السريعة</p>
        <div style={{ display: 'grid', gap: 8 }}>
          {(vipSystem.quickActions ?? DEFAULT_CONFIG_VIP_SYSTEM.quickActions ?? []).map((qa, idx) => (
            <div key={qa.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto auto', gap: 8, alignItems: 'center' }}>
              <input className="form-input" placeholder="عربي" value={qa.labelAr}
                onChange={(e) => {
                  const quickActions = [...(vipSystem.quickActions ?? [])];
                  quickActions[idx] = { ...qa, labelAr: e.target.value };
                  setVipSystem({ ...vipSystem, quickActions });
                }} />
              <input className="form-input" placeholder="English" value={qa.labelEn}
                onChange={(e) => {
                  const quickActions = [...(vipSystem.quickActions ?? [])];
                  quickActions[idx] = { ...qa, labelEn: e.target.value };
                  setVipSystem({ ...vipSystem, quickActions });
                }} />
              <input className="form-input" placeholder="Route" value={qa.route ?? ''}
                onChange={(e) => {
                  const quickActions = [...(vipSystem.quickActions ?? [])];
                  quickActions[idx] = { ...qa, route: e.target.value };
                  setVipSystem({ ...vipSystem, quickActions });
                }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                <input type="checkbox" checked={qa.enabled !== false}
                  onChange={(e) => {
                    const quickActions = [...(vipSystem.quickActions ?? [])];
                    quickActions[idx] = { ...qa, enabled: e.target.checked };
                    setVipSystem({ ...vipSystem, quickActions });
                  }} />
                مفعّل
              </label>
            </div>
          ))}
        </div>
        <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={saveSettings}>
          <Save size={14} /> حفظ إعدادات الشاشة
        </button>
      </div>

      <h3 style={{ marginBottom: 12 }}>مستويات SVIP</h3>
      <div className="table-wrap" style={{ marginBottom: 28 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>الشعار</th>
              <th>المستوى</th>
              <th>حد النقاط (تراكمي)</th>
              <th>نقاط الاحتفاظ / شهر</th>
              <th>النوع</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {vipSystem.levels.map((lv) => {
              const n = normalizeConfigVipLevel(lv);
              const img = n.imageAnimatedUrl || n.imageUrl;
              return (
                <tr key={lv.level}>
                  <td>
                    {img ? (
                      <img src={img} alt={n.label} style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'contain' }} />
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>افتراضي</span>
                    )}
                  </td>
                  <td><strong>{n.label}</strong></td>
                  <td>{formatNumber(n.priceCoins)}</td>
                  <td>{formatNumber(n.maintainPoints)}</td>
                  <td>{n.mode.toUpperCase()}</td>
                  <td>
                    <button className="action-icon edit" onClick={() => setEditingLevel(n)}><Pencil size={14} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>الامتيازات حسب المرحلة</h3>
        <button className="btn btn-secondary btn-sm" onClick={handleAddPrivilege}>
          <Plus size={14} /> إضافة امتياز
        </button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
        اربط كل امتياز بوظيفة داخل التطبيق (شعار، مقعد، دخولية…) وحدّد مستوى SVIP المطلوب لفتحه
      </p>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>الأيقونة</th>
              <th>الاسم</th>
              <th>الوصف</th>
              <th>الوظيفة</th>
              <th>مستوى الفتح</th>
              <th>الترتيب</th>
              <th>مفعّل</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {vipSystem.privileges.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.title || p.id} style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'contain' }} />
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>افتراضية</span>
                  )}
                </td>
                <td><strong>{p.title || p.id}</strong></td>
                <td><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.desc || p.descKey}</span></td>
                <td>
                  <span style={{ fontSize: 12 }}>
                    {VIP_PRIVILEGE_ASSET_OPTIONS.find((o) => o.key === p.assetKey)?.labelAr ?? p.assetKey}
                  </span>
                </td>
                <td>SVIP {p.unlockLevel}</td>
                <td>{p.order}</td>
                <td>{p.enabled === false ? 'معطّل' : 'نعم'}</td>
                <td style={{ display: 'flex', gap: 4 }}>
                  <button className="action-icon edit" onClick={() => setEditingPrivilege(p)}><Pencil size={14} /></button>
                  <button className="action-icon delete" onClick={() => void handleDeletePrivilege(p)}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingLevel && (
        <LevelEditor level={editingLevel} onSave={handleSaveLevel} onClose={() => setEditingLevel(null)} />
      )}
      {editingPrivilege && (
        <PrivilegeEditor privilege={editingPrivilege} onSave={handleSavePrivilege} onClose={() => setEditingPrivilege(null)} />
      )}
    </div>
  );
}

function AssetUploadRow({
  label, hint, url, uploading, statusLabel, onPick, onClear, accept = "image/png,image/jpeg,image/webp,image/gif",
}: {
  label: string; hint: string; url?: string; uploading: boolean; statusLabel?: string;
  onPick: (file: File) => void; onClear: () => void; accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isVideo = url && /\.(mp4|mov|webm|m4v)($|\?|#)/i.test(url);
  return (
    <div className="form-group">
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

function LevelEditor({ level, onSave, onClose }: {
  level: ConfigVipLevel; onSave: (l: ConfigVipLevel) => void; onClose: () => void;
}) {
  const [form, setForm] = useState<ConfigVipLevel>(normalizeConfigVipLevel(level));
  const [uploading, setUploading] = useState<'badge' | 'badgeAnim' | 'background' | null>(null);
  const [storeCatalog, setStoreCatalog] = useState<ConfigStoreItem[]>([]);
  const [editingLevelPriv, setEditingLevelPriv] = useState<ConfigVipPrivilege | null>(null);

  useEffect(() => {
    void getConfigStoreState().then((s) => {
      const seen = new Set<string>();
      const items = s.items
        .filter((i) => i.enabled !== false)
        .filter((i) => {
          const key = (i.id || i.name || '').trim();
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      setStoreCatalog(items);
    });
  }, []);

  const handleUpload = async (file: File, kind: 'badge' | 'badgeAnim' | 'background') => {
    setUploading(kind);
    try {
      const url = await uploadVipAsset(file, `level_${form.level}`, kind);
      if (kind === 'badgeAnim') setForm({ ...form, imageAnimatedUrl: url });
      else if (kind === 'background') setForm({ ...form, backgroundImageUrl: url });
      else setForm({ ...form, imageUrl: url });
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'فشل الرفع');
    } finally {
      setUploading(null);
    }
  };

  const toggleStoreItem = (id: string) => {
    const ids = form.storeItemIds ?? [];
    setForm({
      ...form,
      storeItemIds: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    });
  };

  const saveLevelPriv = (priv: ConfigVipPrivilege) => {
    const normalizedPriv = normalizeConfigVipPrivilege(priv);
    const list = form.levelPrivileges ?? [];
    const exists = list.some((p) => p.id === normalizedPriv.id);
    setForm({
      ...form,
      levelPrivileges: exists
         ? list.map((p) => (p.id === normalizedPriv.id ? normalizedPriv : p))
         : [...list, normalizedPriv].sort((a, b) => a.order - b.order),
    });
    setEditingLevelPriv(null);
  };

  const deleteLevelPriv = (id: string) => {
    setForm({ ...form, levelPrivileges: (form.levelPrivileges ?? []).filter((p) => p.id !== id) });
  };

  const addLevelPriv = () => {
    const nextOrder = ((form.levelPrivileges ?? []).reduce((m, p) => Math.max(m, p.order), 0) || 0) + 1;
    setEditingLevelPriv({
      id: `lv${form.level}-priv-${Date.now()}`,
      assetKey: 'vipBadge',
      titleKey: 'vipHub.privilegeBadge',
      descKey: 'vipHub.privilegeBadgeDesc',
      unlockLevel: form.level,
      mode: 'svip',
      order: nextOrder,
      title: '',
      desc: '',
      enabled: true,
    });
  };

  const bg = form.bgColors ?? ['#1A0E08', '#2D1810', '#0F0806'];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640, maxHeight: '92vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>تعديل {form.label} — شاشة SVIP</h3>
          <button className="action-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">الاسم</label>
            <input className="form-input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">حد النقاط للوصول (تراكمي — 1 نقطة = 1 كوين)</label>
              <input className="form-input" type="number" value={form.priceCoins}
                onChange={(e) => setForm({ ...form, priceCoins: +e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">نقاط الحفاظ الشهرية</label>
              <input className="form-input" type="number" value={form.maintainPoints}
                onChange={(e) => setForm({ ...form, maintainPoints: +e.target.value })} />
            </div>
          </div>

          <h4 style={{ margin: '16px 0 8px', fontSize: 13 }}>المظهر — خلفية وشارة</h4>
          <AssetUploadRow
            label="خلفية الشاشة (Hero)"
            hint="صورة خلفية كاملة للمستوى (مثل الذئب)"
            url={form.backgroundImageUrl}
            uploading={uploading === 'background'}
            onPick={(f) => void handleUpload(f, 'background')}
            onClear={() => setForm({ ...form, backgroundImageUrl: undefined })}
          />
          <AssetUploadRow
            label="شعار ثابت (PNG/JPG)"
            hint="شارة المستوى على يسار الشاشة"
            url={form.imageUrl}
            uploading={uploading === 'badge'}
            onPick={(f) => void handleUpload(f, 'badge')}
            onClear={() => setForm({ ...form, imageUrl: undefined })}
          />
          <AssetUploadRow
            label="شعار متحرك (GIF)"
            hint="يُستخدم بدل الثابت إن وُجد"
            url={form.imageAnimatedUrl}
            uploading={uploading === 'badgeAnim'}
            onPick={(f) => void handleUpload(f, 'badgeAnim')}
            onClear={() => setForm({ ...form, imageAnimatedUrl: undefined })}
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8 }}>
            {(['أعلى', 'وسط', 'أسفل'] as const).map((lbl, i) => (
              <div key={lbl} className="form-group">
                <label className="form-label">تدرّج {lbl}</label>
                <input
                  className="form-input"
                  type="color"
                  value={bg[i] ?? '#000000'}
                  onChange={(e) => {
                    const next = [...bg] as [string, string, string];
                    next[i] = e.target.value;
                    setForm({ ...form, bgColors: next });
                  }}
                />
              </div>
            ))}
          </div>
          <div className="form-group">
            <label className="form-label">لون التمييز (Accent)</label>
            <input className="form-input" type="color" value={form.accentColor ?? '#F5C842'}
              onChange={(e) => setForm({ ...form, accentColor: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">نص Hero (عربي)</label>
              <input className="form-input" value={form.heroSubtitleAr ?? ''}
                onChange={(e) => setForm({ ...form, heroSubtitleAr: e.target.value })} placeholder="لقد وصلت لهذا المستوى" />
            </div>
            <div className="form-group">
              <label className="form-label">نص Hero (English)</label>
              <input className="form-input" value={form.heroSubtitleEn ?? ''}
                onChange={(e) => setForm({ ...form, heroSubtitleEn: e.target.value })} placeholder="You reached this level" />
            </div>
          </div>

          <h4 style={{ margin: '16px 0 8px', fontSize: 13 }}>متجر SVIP — عناصر هذا المستوى</h4>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 8px' }}>
            اختر الهدايا والدخوليات والإطارات من المتجر لتظهر في شبكة هذا المستوى
          </p>
          <div style={{ maxHeight: 180, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
            {storeCatalog.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>لا عناصر في المتجر — أضفها من صفحة المتجر</p>
            ) : storeCatalog.map((item, idx) => (
              <label key={`svip-store-${item.id || item.name}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={(form.storeItemIds ?? []).includes(item.id)}
                  onChange={() => toggleStoreItem(item.id)}
                />
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 4 }} />
                ) : null}
                <span><strong>{item.name}</strong> — {item.category} ({formatNumber(item.price)})</span>
              </label>
            ))}
          </div>

          <h4 style={{ margin: '16px 0 8px', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            امتيازات مخصصة لهذا المستوى
            <button type="button" className="btn btn-secondary btn-sm" onClick={addLevelPriv}><Plus size={12} /> إضافة</button>
          </h4>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 8px' }}>
            إن تُركت فارغة تُستخدم الامتيازات العامة حسب مستوى الفتح
          </p>
          {(form.levelPrivileges ?? []).map((p, idx) => (
            <div key={`${p.id}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12 }}>
              {p.imageUrl ? <img src={p.imageUrl} alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} /> : null}
              <span style={{ flex: 1 }}>{p.title || p.id}</span>
              <button type="button" className="action-icon edit" onClick={() => setEditingLevelPriv(p)}><Pencil size={12} /></button>
              <button type="button" className="action-icon delete" onClick={() => deleteLevelPriv(p.id)}><Trash2 size={12} /></button>
            </div>
          ))}

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.enabled !== false}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
            <span>مفعّل في التطبيق</span>
          </label>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={() => onSave(normalizeConfigVipLevel(form))}><Save size={16} /> حفظ</button>
          <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
        </div>
      </div>

      {editingLevelPriv && (
        <PrivilegeEditor
          privilege={editingLevelPriv}
          onSave={saveLevelPriv}
          onClose={() => setEditingLevelPriv(null)}
        />
      )}
    </div>
  );
}

function PrivilegeEditor({ privilege, onSave, onClose }: {
  privilege: ConfigVipPrivilege; onSave: (p: ConfigVipPrivilege) => void; onClose: () => void;
}) {
  const [form, setForm] = useState<ConfigVipPrivilege>({ ...privilege });
  const [uploading, setUploading] = useState<'image' | 'video' | 'videoMp4' | null>(null);
  const [statusLabel, setStatusLabel] = useState('');

  const handleUpload = async (file: File, kind: 'privilege' | 'video' | 'videoMp4' | 'sound') => {
    setUploading(kind === 'privilege' ? 'image' : kind === 'sound' ? 'video' : kind);
    setStatusLabel('جارٍ التحضير…');
    try {
      const url = await uploadVipAsset(file, form.id, kind === 'sound' ? 'video' : kind, ({ stage, ratio }) => {
        if (stage === 'load') setStatusLabel('تحضير الضاغط…');
        else if (stage === 'transcode') setStatusLabel(`جارٍ الضغط ${Math.round(ratio * 100)}%`);
        else setStatusLabel('جارٍ الرفع…');
      });
      if (kind === 'video') setForm({ ...form, videoUrl: url });
      else if (kind === 'videoMp4') setForm({ ...form, videoUrlMp4: url });
      else if (kind === 'sound') setForm({ ...form, soundUrl: url });
      else setForm({ ...form, imageUrl: url });
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'فشل الرفع');
    } finally {
      setUploading(null);
      setStatusLabel('');
    }
  };

  const isEntry = form.assetKey === 'entryEffect' || form.assetKey === 'vipEntry';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520, maxHeight: '92vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>تعديل الامتياز: {form.title || form.id}</h3>
          <button className="action-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">وظيفة التطبيق</label>
            <select
              className="form-input"
              value={form.assetKey}
              onChange={(e) => {
                const key = e.target.value;
                const opt = VIP_PRIVILEGE_ASSET_OPTIONS.find((o) => o.key === key);
                setForm((f) => ({
                  ...f,
                  assetKey: key,
                  title: f.title?.trim() ? f.title : (opt?.labelAr ?? f.title),
                }));
              }}
            >
              {VIP_PRIVILEGE_ASSET_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>{o.labelAr} — {o.feature}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">اسم الامتياز</label>
            <input className="form-input" value={form.title ?? ''} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">الوصف</label>
            <textarea className="form-input" rows={3} value={form.desc ?? ''} onChange={(e) => setForm({ ...form, desc: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">مستوى الفتح</label>
              <input className="form-input" type="number" value={form.unlockLevel} onChange={(e) => setForm({ ...form, unlockLevel: +e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">الترتيب</label>
              <input className="form-input" type="number" value={form.order} onChange={(e) => setForm({ ...form, order: +e.target.value })} />
            </div>
          </div>
          <AssetUploadRow
            label="أيقونة الامتياز (صورة المعاينة)"
            hint="PNG, JPG, WebP أو GIF متحرك"
            url={form.imageUrl}
            uploading={uploading === 'image'}
            statusLabel={statusLabel}
            onPick={(f) => void handleUpload(f, 'privilege')}
            onClear={() => setForm({ ...form, imageUrl: undefined })}
          />

          {isEntry ? (
            <>
              <AssetUploadRow
                label="فيديو الدخولية الرئيسي (WebM / MP4 / MOV)"
                hint="صيغة WebM أو MP4 للدخولية"
                url={form.videoUrl}
                uploading={uploading === 'video'}
                statusLabel={statusLabel}
                accept="video/mp4,video/quicktime,video/webm,video/x-m4v"
                onPick={(f) => void handleUpload(f, 'video')}
                onClear={() => setForm({ ...form, videoUrl: undefined })}
              />
              <AssetUploadRow
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

          {form.assetKey === 'specialSoundEffect' ? (
            <AssetUploadRow
              label="ملف الصوت (تأثير الدخول الصوتي)"
              hint="MP3 / M4A / WAV — يُشغّل عند دخول العضو الغرفة"
              url={form.soundUrl}
              uploading={uploading === 'video'}
              statusLabel={statusLabel}
              accept="audio/mpeg,audio/mp4,audio/wav,audio/x-m4a,audio/*"
              onPick={(f) => void handleUpload(f, 'sound')}
              onClear={() => setForm({ ...form, soundUrl: undefined })}
            />
          ) : null}

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.enabled !== false}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            />
            <span>مفعّل في التطبيق</span>
          </label>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={() => onSave(normalizeConfigVipPrivilege(form))}><Save size={16} /> حفظ</button>
          <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </div>
  );
}
