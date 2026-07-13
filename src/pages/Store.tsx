/**
 * إدارة متجر التطبيق — تصنيفات + عناصر + إطارات الروم
 */
import { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import {
  ShoppingBag, Plus, Pencil, Trash2, X, Coins, Gem, Upload, Loader2,
  FolderOpen, Languages, ChevronUp, ChevronDown, Sparkles, Frame,
} from 'lucide-react';
import { Loading, Badge } from '@/components/Common';
import { FrameEditorModal } from '@/components/store/FrameEditorModal';
import {
  getConfigStoreState,
  saveConfigStore,
  saveConfigStoreCategories,
  getRoomFrames,
  saveRoomFrames,
  DEFAULT_CONFIG_STORE_ITEMS,
  DEFAULT_STORE_CATEGORIES,
  logAdminAction,
  formatNumber,
  type ConfigStoreItem,
  type ConfigStoreCategory,
  type RoomFrame,
  type DecorBadge,
} from '@/services/admin';
import { uploadStoreAsset } from '@/lib/storage';
import { useAdminProfile } from '@/contexts/AdminProfileContext';

const APP_LANGUAGES = [
  { code: 'ar', name: 'العربية' },
  { code: 'en', name: 'English' },
] as const;

const ICON_OPTIONS = [
  'Sparkles', 'MessageCircle', 'Award', 'Gift', 'Crown', 'Star', 'Moon', 'Heart',
  'Rocket', 'BadgeCheck', 'Palette', 'ShoppingBag', 'Gem', 'Flame', 'Diamond',
];

const FRAMES_CATEGORY_ID = 'frame';

const PROTECTED_CATEGORY_IDS = ['entrance', 'frame', 'bubble', 'badge', 'effect', 'theme', 'vip'];

const FRAME_BADGE_LABELS: Record<DecorBadge, string> = {
  limited: 'محدود',
  event: 'مناسبة',
  hot: 'رائج',
  new: 'جديد',
};

/** أين يظهر التصنيف في تبويبات المتجر بالتطبيق */
const APP_TAB_FOR_CATEGORY: Record<string, string> = {
  entrance: 'دخولية',
  frame: 'الإطارات',
  bubble: 'فقاعة',
  badge: 'مميز',
  effect: 'مميز',
  theme: 'مميز',
  vip: 'مميز',
};

function categoryLabel(c: ConfigStoreCategory, lang = 'ar'): string {
  return c.labels[lang]?.trim()
    || c.labels.ar?.trim()
    || c.labels.en?.trim()
    || c.id;
}

function ItemPreview({ item, size = 40 }: { item: ConfigStoreItem; size?: number }) {
  const url = item.animationUrl || item.imageUrl;
  if (url) {
    return <img src={url} alt="" style={{ width: size, height: size, objectFit: 'contain', borderRadius: 8 }} />;
  }
  const IconComp = (Icons as unknown as Record<string, React.ComponentType<{ size?: number; color?: string }>>)[item.iconName]
    ?? ShoppingBag;
  return <IconComp size={size} color={item.iconColor} />;
}

/** معاينة بطاقة المنتج كما تظهر في تطبيق المتجر */
function AppStoreCardPreview({ item }: { item: ConfigStoreItem }) {
  const media = item.animationUrl || item.imageUrl;
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--text-muted)' }}>
        معاينة التطبيق
      </div>
      <div
        style={{
          width: 168,
          borderRadius: 16,
          background: '#fff',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          overflow: 'hidden',
          border: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ position: 'relative', height: 120, background: `linear-gradient(135deg, ${item.bgColor1}, ${item.bgColor2})` }}>
          {item.validityDays ? (
            <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 10, background: 'rgba(0,0,0,0.55)', color: '#fff', padding: '2px 8px', borderRadius: 8 }}>
              {item.validityDays} يوم
            </span>
          ) : null}
          {item.isLimited ? (
            <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, background: '#EF4444', color: '#fff', padding: '2px 8px', borderRadius: 8 }}>محدود</span>
          ) : item.isNew ? (
            <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, background: '#10B981', color: '#fff', padding: '2px 8px', borderRadius: 8 }}>جديد</span>
          ) : null}
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {media ? (
              <img src={media} alt="" style={{ width: 72, height: 72, objectFit: 'contain' }} />
            ) : (
              <ItemPreview item={item} size={56} />
            )}
          </div>
        </div>
        <div style={{ padding: '10px 12px' }}>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>{item.name || 'اسم العنصر'}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
            {item.currency === 'pearls' ? <Gem size={14} color="#f2454e" /> : <Coins size={14} color="#F59E0B" />}
            {formatNumber(item.price)}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{ flex: 1, textAlign: 'center', fontSize: 11, padding: '6px 0', borderRadius: 10, border: '1.5px solid #e11212', color: '#e11212' }}>إرسال</span>
            <span style={{ flex: 1, textAlign: 'center', fontSize: 11, padding: '6px 0', borderRadius: 10, background: 'linear-gradient(90deg,#e11212,#b00814)', color: '#fff' }}>شراء</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StorePage() {
  const { isSuper, can } = useAdminProfile();
  const [items, setItems] = useState<ConfigStoreItem[]>([]);
  const [frames, setFrames] = useState<RoomFrame[]>([]);
  const [categories, setCategories] = useState<ConfigStoreCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('all');
  const [editing, setEditing] = useState<ConfigStoreItem | null>(null);
  const [editingFrame, setEditingFrame] = useState<RoomFrame | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [showCategories, setShowCategories] = useState(false);

  const isFramesView = filterCategory === FRAMES_CATEGORY_ID;
  const frameCat = categories.find((c) => c.id === FRAMES_CATEGORY_ID);
  const frameCategoryLabel = frameCat ? categoryLabel(frameCat) : 'الإطارات';

  const load = async () => {
    setLoading(true);
    const [{ exists, items: list, categories: cats }, frameList] = await Promise.all([
      getConfigStoreState(),
      getRoomFrames(),
    ]);
    let nextItems = list;
    let nextCats = cats.length ? cats : DEFAULT_STORE_CATEGORIES;
    if (!nextCats.some((c) => c.id === FRAMES_CATEGORY_ID)) {
      const frameDefault = DEFAULT_STORE_CATEGORIES.find((c) => c.id === FRAMES_CATEGORY_ID);
      if (frameDefault) nextCats = [...nextCats, frameDefault].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    if (!exists) {
      nextItems = DEFAULT_CONFIG_STORE_ITEMS;
      await saveConfigStore(nextItems, nextCats);
    }
    setItems(nextItems);
    setCategories(nextCats);
    setFrames(frameList);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const filtered = filterCategory === 'all'
    ? items
    : items.filter((i) => i.category === filterCategory);

  const handleSaveItem = async (item: ConfigStoreItem) => {
    if (!categories.length) {
      alert('أضف تصنيفاً واحداً على الأقل من «إدارة التصنيفات».');
      return;
    }
    const normalized = { ...item, category: item.category || categories[0]?.id || 'badge' };
    let updated: ConfigStoreItem[];
    if (isNew) {
      const id = normalized.id.trim() || `store_${Date.now()}`;
      updated = [...items, { ...normalized, id }];
      await logAdminAction('إضافة عنصر متجر', normalized.name, `${normalized.price} ${normalized.currency}`);
    } else {
      updated = items.map((x) => (x.id === normalized.id ? normalized : x));
      await logAdminAction('تعديل عنصر متجر', normalized.name, `${normalized.price} ${normalized.currency}`);
    }
    setItems(updated);
    await saveConfigStore(updated, categories);
    setEditing(null);
  };

  const handleDeleteItem = async (item: ConfigStoreItem) => {
    if (!confirm(`حذف "${item.name}"؟`)) return;
    const updated = items.filter((x) => x.id !== item.id);
    setItems(updated);
    await saveConfigStore(updated, categories);
    await logAdminAction('حذف عنصر متجر', item.name);
  };

  const handleSaveCategories = async (cats: ConfigStoreCategory[]) => {
    setCategories(cats);
    await saveConfigStoreCategories(cats);
    await logAdminAction('تعديل تصنيفات المتجر', `${cats.length} تصنيف`);
    setShowCategories(false);
  };

  const handleSaveFrame = async (frame: RoomFrame, asNew: boolean) => {
    const next = asNew ? [...frames, frame] : frames.map((x) => (x.id === frame.id ? frame : x));
    setFrames(next);
    await saveRoomFrames(next);
    await logAdminAction(asNew ? 'إضافة إطار متجر' : 'تعديل إطار متجر', frame.name, `${frame.price} عملة`);
    setEditingFrame(null);
  };

  const handleDeleteFrame = async (frame: RoomFrame) => {
    if (!confirm(`حذف الإطار "${frame.name}"؟`)) return;
    const next = frames.filter((x) => x.id !== frame.id);
    setFrames(next);
    await saveRoomFrames(next);
    await logAdminAction('حذف إطار متجر', frame.name);
  };

  if (loading) return <Loading />;

  return (
    <div className="page-container">
      <div className="agency-page-header">
        <div>
          <h1>
            <ShoppingBag size={26} style={{ verticalAlign: 'middle', marginLeft: 8, color: 'var(--brand-primary)' }} />
            متجر التطبيق
          </h1>
          <p>
            عناصر المتجر في <code>config/store</code> — إطارات الروم في <code>config/roomFrames</code>.
            كل التعديلات تظهر فوراً في تبويبات المتجر بالتطبيق.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(isSuper || can('store:edit')) && (
            <button type="button" className="btn btn-secondary" onClick={() => setShowCategories(true)}>
              <FolderOpen size={16} /> إدارة التصنيفات ({categories.length})
            </button>
          )}
          {isFramesView ? (
            (isSuper || can('store:add')) && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setEditingFrame({ id: '', name: '', imageUrl: '', price: 1000, enabled: true });
                }}
              >
                <Plus size={18} /> إطار جديد
              </button>
            )
          ) : (
            (isSuper || can('store:add')) && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setIsNew(true);
                  setEditing({
                    id: '',
                    name: '',
                    description: '',
                    category: filterCategory !== 'all' && filterCategory !== FRAMES_CATEGORY_ID
                      ? filterCategory
                      : (categories.find((c) => c.id !== FRAMES_CATEGORY_ID)?.id ?? 'entrance'),
                    price: 1000,
                    currency: 'coins',
                    iconName: 'Sparkles',
                    iconColor: '#e11212',
                    bgColor1: '#FCD34D',
                    bgColor2: '#F59E0B',
                    enabled: true,
                    sort: items.length,
                  });
                }}
              >
                <Plus size={18} /> عنصر جديد
              </button>
            )
          )}
        </div>
      </div>

      <div
        className="info-banner"
        style={{
          marginBottom: 16,
          padding: '12px 16px',
          borderRadius: 12,
          background: 'rgba(225, 18, 18, 0.08)',
          border: '1px solid rgba(225, 18, 18, 0.2)',
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        <strong>ربط التطبيق:</strong> تبويبات المتجر = دخولية | الإطارات | فقاعة | مميز.
        {' '}شارات + تأثيرات + ثيمات + VIP تظهر تحت «مميز».
        {' '}السعر بعملات 🪙 أو ماس 💎، الشارات «جديد/محدود»، والصلاحية بالأيام تظهر على بطاقة المنتج.
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button
          type="button"
          className={`btn btn-sm ${filterCategory === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilterCategory('all')}
        >
          الكل ({items.length})
        </button>
        {categories.map((c) => {
          const count = c.id === FRAMES_CATEGORY_ID
            ? frames.length
            : items.filter((i) => i.category === c.id).length;
          return (
            <button
              key={c.id}
              type="button"
              className={`btn btn-sm ${filterCategory === c.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterCategory(c.id)}
            >
              {categoryLabel(c)} ({count})
            </button>
          );
        })}
      </div>

      {isFramesView ? (
        frames.length === 0 ? (
          <div className="empty-state">
            <Frame size={40} color="var(--text-muted)" />
            <p>لا توجد إطارات بعد. أضف إطاراً جديداً ليظهر في تبويب «{frameCategoryLabel}» بالتطبيق.</p>
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>الإطار</th>
                  <th>السعر</th>
                  <th>الصلاحية</th>
                  <th>تبويب التطبيق</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {frames.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {f.imageUrl ? (
                          <img src={f.imageUrl} alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />
                        ) : (
                          <Frame size={32} color="var(--text-muted)" />
                        )}
                        <div>
                          <div style={{ fontWeight: 700 }}>{f.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{f.id}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Coins size={14} />
                        {formatNumber(f.price)}
                      </span>
                    </td>
                    <td>{f.durationDays ? `${f.durationDays} يوم` : 'دائم'}</td>
                    <td><Badge variant="blue">{APP_TAB_FOR_CATEGORY.frame}</Badge></td>
                    <td>
                      {f.enabled === false ? <Badge variant="gray">معطّل</Badge> : null}
                      {f.badge ? <Badge variant="green">{FRAME_BADGE_LABELS[f.badge]}</Badge> : null}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {(isSuper || can('store:edit')) && (
                          <button
                            type="button"
                            className="action-icon"
                            title="تعديل"
                            onClick={() => setEditingFrame(f)}
                          >
                            <Pencil size={16} />
                          </button>
                        )}
                        {(isSuper || can('store:delete')) && (
                          <button
                            type="button"
                            className="action-icon danger"
                            title="حذف"
                            onClick={() => void handleDeleteFrame(f)}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Sparkles size={40} color="var(--text-muted)" />
          <p>لا توجد عناصر في هذا التصنيف.</p>
        </div>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>العنصر</th>
                <th>التصنيف</th>
                <th>السعر</th>
                <th>الصلاحية</th>
                <th>تبويب التطبيق</th>
                <th>الحالة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const cat = categories.find((c) => c.id === item.category);
                return (
                  <tr key={item.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <ItemPreview item={item} />
                        <div>
                          <div style={{ fontWeight: 700 }}>{item.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.id}</div>
                        </div>
                      </div>
                    </td>
                    <td>{cat ? categoryLabel(cat) : item.category}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {item.currency === 'pearls' ? <Gem size={14} /> : <Coins size={14} />}
                        {formatNumber(item.price)}
                      </span>
                    </td>
                    <td>{item.validityDays ? `${item.validityDays} يوم` : 'دائم'}</td>
                    <td>
                      <Badge variant="blue">{APP_TAB_FOR_CATEGORY[item.category] ?? item.category}</Badge>
                    </td>
                    <td>
                      {item.enabled === false ? <Badge variant="gray">معطّل</Badge> : null}
                      {item.isNew ? <Badge variant="green">جديد</Badge> : null}
                      {item.isLimited ? <Badge variant="purple">محدود</Badge> : null}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {(isSuper || can('store:edit')) && (
                          <button
                            type="button"
                            className="action-icon"
                            title="تعديل"
                            onClick={() => { setIsNew(false); setEditing(item); }}
                          >
                            <Pencil size={16} />
                          </button>
                        )}
                        {(isSuper || can('store:delete')) && (
                          <button
                            type="button"
                            className="action-icon danger"
                            title="حذف"
                            onClick={() => void handleDeleteItem(item)}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <ItemModal
          item={editing}
          isNew={isNew}
          categories={categories.filter((c) => c.id !== FRAMES_CATEGORY_ID)}
          onClose={() => setEditing(null)}
          onSave={handleSaveItem}
        />
      )}

      {editingFrame && (
        <FrameEditorModal
          frame={editingFrame}
          onClose={() => setEditingFrame(null)}
          onSave={handleSaveFrame}
        />
      )}

      {showCategories && (
        <CategoriesModal
          categories={categories}
          onClose={() => setShowCategories(false)}
          onSave={handleSaveCategories}
        />
      )}
    </div>
  );
}

function ItemModal({
  item,
  isNew,
  categories,
  onClose,
  onSave,
}: {
  item: ConfigStoreItem;
  isNew: boolean;
  categories: ConfigStoreCategory[];
  onClose: () => void;
  onSave: (item: ConfigStoreItem) => void | Promise<void>;
}) {
  const [form, setForm] = useState<ConfigStoreItem>(item);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'image' | 'animation' | 'video' | 'videoMp4' | null>(null);
  const [uploadPct, setUploadPct] = useState(0);

  const patch = (p: Partial<ConfigStoreItem>) => setForm((f) => ({ ...f, ...p }));
  const isEntrance = form.category === 'entrance';

  const handleUpload = async (file: File, kind: 'image' | 'animation' | 'video' | 'videoMp4') => {
    const id = form.id.trim() || `store_${Date.now()}`;
    if (!form.id.trim()) patch({ id });
    setUploadPct(0);
    setUploading(kind);
    try {
      const url = await uploadStoreAsset(file, id, kind === 'videoMp4' ? 'animation' : kind, (p) => setUploadPct(Math.round(p.ratio * 100)));
      if (kind === 'image') patch({ imageUrl: url });
      else if (kind === 'video') patch({ videoUrl: url, animationUrl: url });
      else if (kind === 'videoMp4') patch({ videoUrlMp4: url });
      else patch({ animationUrl: url });
    } catch (e: unknown) {
      alert((e as Error)?.message ?? 'فشل الرفع');
    } finally {
      setUploading(null);
      setUploadPct(0);
    }
  };

  const submit = async () => {
    if (!form.name.trim()) return alert('أدخل اسم العنصر');
    if (!form.category) return alert('اختر التصنيف');
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isNew ? 'عنصر متجر جديد' : `تعديل: ${form.name}`}</h3>
          <button type="button" className="action-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ display: 'grid', gap: 12 }}>
          <div className="form-row">
            <label>المعرّف (إنجليزي)</label>
            <input
              className="form-input"
              value={form.id}
              disabled={!isNew}
              onChange={(e) => patch({ id: e.target.value.replace(/\s/g, '_') })}
              placeholder="entrance_gold"
            />
          </div>
          <div className="form-row">
            <label>الاسم (عربي)</label>
            <input className="form-input" value={form.name} onChange={(e) => patch({ name: e.target.value })} />
          </div>
          <div className="form-row">
            <label>الاسم (إنجليزي)</label>
            <input className="form-input" value={form.nameEn ?? ''} onChange={(e) => patch({ nameEn: e.target.value })} />
          </div>
          <div className="form-row">
            <label>الوصف (عربي)</label>
            <textarea className="form-input" rows={2} value={form.description} onChange={(e) => patch({ description: e.target.value })} />
          </div>
          <div className="form-row">
            <label>الوصف (إنجليزي)</label>
            <textarea className="form-input" rows={2} value={form.descriptionEn ?? ''} onChange={(e) => patch({ descriptionEn: e.target.value })} />
          </div>
          <div className="form-row">
            <label>التصنيف</label>
            <select className="form-input" value={form.category} onChange={(e) => patch({ category: e.target.value })}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {categoryLabel(c)} — تبويب «{APP_TAB_FOR_CATEGORY[c.id] ?? c.id}»
                </option>
              ))}
            </select>
          </div>
          <AppStoreCardPreview item={form} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div className="form-row">
              <label>السعر</label>
              <input className="form-input" type="number" min={0} value={form.price} onChange={(e) => patch({ price: Number(e.target.value) })} />
            </div>
            <div className="form-row">
              <label>العملة</label>
              <select className="form-input" value={form.currency} onChange={(e) => patch({ currency: e.target.value as 'coins' | 'pearls' })}>
                <option value="coins">عملات</option>
                <option value="pearls">ماس (لؤلؤ)</option>
              </select>
            </div>
            <div className="form-row">
              <label>صلاحية (أيام)</label>
              <input className="form-input" type="number" min={0} value={form.validityDays ?? ''} onChange={(e) => patch({ validityDays: Number(e.target.value) || undefined })} placeholder="0 = دائم" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="form-row">
              <label>أيقونة Lucide</label>
              <select className="form-input" value={form.iconName} onChange={(e) => patch({ iconName: e.target.value })}>
                {ICON_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>لون الأيقونة</label>
              <input className="form-input" type="color" value={form.iconColor} onChange={(e) => patch({ iconColor: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="form-row">
              <label>لون البطاقة 1</label>
              <input className="form-input" type="color" value={form.bgColor1} onChange={(e) => patch({ bgColor1: e.target.value })} />
            </div>
            <div className="form-row">
              <label>لون البطاقة 2</label>
              <input className="form-input" type="color" value={form.bgColor2} onChange={(e) => patch({ bgColor2: e.target.value })} />
            </div>
          </div>
          {uploading && (
            <div className="form-row" style={{ display: 'block' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                <span>جارٍ المعالجة والرفع…</span>
                <span>{uploadPct}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${uploadPct}%`, background: 'var(--primary, #e11212)', transition: 'width 0.2s' }} />
              </div>
            </div>
          )}
          <div className="form-row">
            <label>صورة العنصر (PNG/JPG)</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input className="form-input" style={{ flex: 1 }} value={form.imageUrl ?? ''} onChange={(e) => patch({ imageUrl: e.target.value })} placeholder="رابط أو ارفع ملفاً" />
              <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                {uploading === 'image' ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
                <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUpload(f, 'image'); }} />
              </label>
            </div>
          </div>
          <div className="form-row">
            <label>{isEntrance ? 'فيديو الدخولية (MP4 أو WebM)' : 'أنيميشن GIF (اختياري)'}</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="form-input"
                style={{ flex: 1 }}
                value={(isEntrance ? (form.videoUrl ?? form.animationUrl) : form.animationUrl) ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  if (isEntrance) patch({ videoUrl: v, animationUrl: v });
                  else patch({ animationUrl: v });
                }}
                placeholder={isEntrance ? 'رابط فيديو يُعرض عند دخول الغرفة' : ''}
              />
              <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                {uploading === (isEntrance ? 'video' : 'animation') ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
                <input
                  type="file"
                  accept={isEntrance ? 'video/mp4,video/webm,video/quicktime' : 'image/gif'}
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUpload(f, isEntrance ? 'video' : 'animation');
                  }}
                />
              </label>
            </div>
            {isEntrance ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                يُشغَّل للجميع عند دخول صاحب SVIP مع امتياز الدخولية. على iOS أضف MP4 احتياطي أدناه إن كان الملف WebM.
              </p>
            ) : null}
          </div>
          {isEntrance ? (
            <div className="form-row">
              <label>فيديو MP4 احتياطي لـ iOS (اختياري)</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className="form-input"
                  style={{ flex: 1 }}
                  value={form.videoUrlMp4 ?? ''}
                  onChange={(e) => patch({ videoUrlMp4: e.target.value })}
                  placeholder="رابط MP4 للآيفون"
                />
                <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                  {uploading === 'videoMp4' ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
                  <input
                    type="file"
                    accept="video/mp4,video/quicktime"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleUpload(f, 'videoMp4');
                    }}
                  />
                </label>
              </div>
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <label><input type="checkbox" checked={form.enabled !== false} onChange={(e) => patch({ enabled: e.target.checked })} /> مفعّل</label>
            <label><input type="checkbox" checked={!!form.isNew} onChange={(e) => patch({ isNew: e.target.checked || undefined })} /> جديد</label>
            <label><input type="checkbox" checked={!!form.isLimited} onChange={(e) => patch({ isLimited: e.target.checked || undefined })} /> محدود</label>
            {/* إصلاح #15 — إخفاء/إظهار زر «إهداء» بعد الشراء */}
            <label title="عند إيقاف التفعيل: يختفي زر «إهداء» من هذا العنصر بعد الشراء">
              <input type="checkbox" checked={form.allowGift !== false}
                onChange={(e) => patch({ allowGift: e.target.checked ? undefined : false })} />
              {' '}إتاحة الإهداء بعد الشراء 🎁
            </label>
          </div>
          <div className="form-row">
            <label>ترتيب العرض</label>
            <input className="form-input" type="number" value={form.sort ?? 0} onChange={(e) => patch({ sort: Number(e.target.value) })} />
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>إلغاء</button>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void submit()}>
            {saving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoriesModal({
  categories,
  onClose,
  onSave,
}: {
  categories: ConfigStoreCategory[];
  onClose: () => void;
  onSave: (cats: ConfigStoreCategory[]) => void | Promise<void>;
}) {
  const [cats, setCats] = useState<ConfigStoreCategory[]>(categories);
  const [lang, setLang] = useState<'ar' | 'en'>('ar');

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...cats];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setCats(next.map((c, i) => ({ ...c, order: i })));
  };

  const addCat = () => {
    const id = prompt('معرّف التصنيف (إنجليزي، مثل entrance):');
    if (!id?.trim()) return;
    if (cats.some((c) => c.id === id.trim())) return alert('المعرّف موجود');
    setCats([...cats, { id: id.trim(), labels: { ar: id.trim(), en: id.trim() }, order: cats.length, enabled: true, iconName: 'ShoppingBag' }]);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h3><Languages size={18} /> تصنيفات المتجر</h3>
          <button type="button" className="action-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            التصنيفات الافتراضية: دخولية، فقاعة، شارات، تأثيرات، ثيمات، VIP. يمكنك إضافة تصنيفات جديدة أو تعديل الأسماء.
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {APP_LANGUAGES.map((l) => (
              <button key={l.code} type="button" className={`btn btn-sm ${lang === l.code ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setLang(l.code)}>{l.name}</button>
            ))}
            <button type="button" className="btn btn-sm btn-secondary" onClick={addCat}><Plus size={14} /> تصنيف</button>
          </div>
          {cats.map((c, idx) => (
            <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <button type="button" className="action-icon" onClick={() => move(idx, -1)} disabled={idx === 0}><ChevronUp size={14} /></button>
                <button type="button" className="action-icon" onClick={() => move(idx, 1)} disabled={idx === cats.length - 1}><ChevronDown size={14} /></button>
              </div>
              <code style={{ minWidth: 90, fontSize: 12 }}>{c.id}</code>
              <input
                className="form-input"
                style={{ flex: 1 }}
                value={c.labels[lang] ?? ''}
                onChange={(e) => {
                  const next = [...cats];
                  next[idx] = { ...c, labels: { ...c.labels, [lang]: e.target.value } };
                  setCats(next);
                }}
              />
              <select
                className="form-input"
                style={{ width: 120 }}
                value={c.iconName ?? 'ShoppingBag'}
                onChange={(e) => {
                  const next = [...cats];
                  next[idx] = { ...c, iconName: e.target.value };
                  setCats(next);
                }}
              >
                {ICON_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <label title="مفعّل">
                <input
                  type="checkbox"
                  checked={c.enabled !== false}
                  onChange={(e) => {
                    const next = [...cats];
                    next[idx] = { ...c, enabled: e.target.checked };
                    setCats(next);
                  }}
                />
              </label>
              {!PROTECTED_CATEGORY_IDS.includes(c.id) && (
                <button
                  type="button"
                  className="action-icon danger"
                  onClick={() => setCats(cats.filter((x) => x.id !== c.id))}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>إلغاء</button>
          <button type="button" className="btn btn-primary" onClick={() => void onSave(cats.map((c, i) => ({ ...c, order: i })))}>حفظ التصنيفات</button>
        </div>
      </div>
    </div>
  );
}
