import { useEffect, useState, useRef } from 'react';
import * as Icons from 'lucide-react';
import {
  Gift, Coins, Plus, Pencil, Trash2, X, Save, Cloud, ImageIcon, Sparkles,
  Upload, Loader2, FolderOpen, Volume2, ChevronUp, ChevronDown, Languages, Film,
} from 'lucide-react';
import { Loading, Badge } from '@/components/Common';
import {
  getConfigGiftsState,
  saveConfigGifts,
  saveConfigGiftCategories,
  DEFAULT_CONFIG_GIFTS,
  SAMPLE_CONFIG_GIFTS,
  SAMPLE_GIFT_CATEGORIES,
  logAdminAction,
  formatNumber,
  type ConfigGift,
  type ConfigGiftCategory,
  type GiftVisualType,
  type GiftMediaType,
} from '@/services/admin';
import { uploadGiftAsset } from '@/lib/storage';

/** لغات التطبيق — يمكن إضافة المزيد من لوحة التصنيفات */
const APP_LANGUAGES = [
  { code: 'ar', name: 'العربية' },
  { code: 'en', name: 'English' },
] as const;

const ICON_OPTIONS = [
  'Flower2', 'Heart', 'Cake', 'Music', 'Star', 'Sparkles', 'Flame', 'Rainbow',
  'Diamond', 'Gem', 'Crown', 'Rocket', 'Castle', 'Car', 'Ship', 'Plane', 'Sun', 'Wand2',
];
const RARITIES = ['common', 'rare', 'epic', 'legendary'];
const RARITY_LABEL: Record<string, string> = { common: 'عادي', rare: 'نادر', epic: 'ملحمي', legendary: 'أسطوري' };
const RARITY_VARIANT: Record<string, string> = { common: 'gray', rare: 'blue', epic: 'purple', legendary: 'gold' };

const MEDIA_TYPES: { id: GiftMediaType; label: string; hint: string }[] = [
  { id: 'static', label: 'ثابتة', hint: 'PNG أو JPG — صورة ثابتة للقائمة والشات' },
  { id: 'animated', label: 'متحركة', hint: 'GIF متحرك — يُعرض في القائمة والأنيميشن' },
  { id: 'animated_sound', label: 'صورة + صوت', hint: 'PNG/JPG + MP3 — الصوت مع الصورة معاً' },
  { id: 'video', label: 'فيديو', hint: 'MP4 / WebM / MOV — ملء الشاشة في الروم' },
];

function validateGiftMedia(form: ConfigGift, mediaType: GiftMediaType, visualType: GiftVisualType): string | null {
  if (mediaType === 'static') {
    if (visualType === 'icon') return null;
    if (!form.imageUrl?.trim()) return 'ارفع صورة PNG أو JPG للهدية الثابتة';
    return null;
  }
  if (mediaType === 'animated') {
    if (!form.animationUrl?.trim()) return 'ارفع ملف GIF للهدية المتحركة';
    return null;
  }
  if (mediaType === 'video') {
    if (!form.videoUrl?.trim()) return 'ارفع ملف فيديو MP4 أو WebM';
    if (form.videoUrl.trim().toLowerCase().includes('.webm') && !form.videoUrlMp4?.trim()) {
      return 'فيديو WebM يحتاج نسخة MP4 احتياطية لأجهزة iOS — ارفعها من «MP4 احتياطي لـ iOS»';
    }
    return null;
  }
  if (!form.imageUrl?.trim()) return 'ارفع صورة PNG/JPG (مطلوبة مع الصوت)';
  if (!form.soundUrl?.trim()) return 'ارفع ملف MP3 للصوت';
  return null;
}

function categoryLabel(c: ConfigGiftCategory, lang = 'ar'): string {
  return c.labels[lang]?.trim()
    || c.labels.ar?.trim()
    || c.labels.en?.trim()
    || Object.values(c.labels).find((v) => v?.trim())?.trim()
    || c.id;
}

function giftUsesImage(g: ConfigGift): boolean {
  return g.visualType === 'image' || Boolean(g.imageUrl?.trim() || g.animationUrl?.trim() || g.videoUrl?.trim());
}

function GiftPreview({ gift, size = 36 }: { gift: ConfigGift; size?: number }) {
  const url = gift.imageUrl || gift.animationUrl;
  if (gift.videoUrl?.trim() && !url) {
    return (
      <video
        src={gift.videoUrl}
        style={{ width: size, height: size, objectFit: 'contain', borderRadius: 8 }}
        muted
        playsInline
        preload="metadata"
      />
    );
  }
  if (giftUsesImage(gift) && url) {
    return <img src={url} alt="" style={{ width: size, height: size, objectFit: 'contain' }} />;
  }
  const IconComp = (Icons as any)[gift.iconName] ?? Gift;
  return <IconComp size={size} color={gift.iconColor} strokeWidth={2} />;
}

export default function GiftsPage() {
  const [gifts, setGifts] = useState<ConfigGift[]>([]);
  const [categories, setCategories] = useState<ConfigGiftCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('all');
  const [editing, setEditing] = useState<ConfigGift | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const load = async () => {
    setLoading(true);
    const { exists, items: g, categories: cats } = await getConfigGiftsState();
    let items = g;
    // نزرع الهدايا الافتراضية مرة واحدة فقط عند أول تشغيل (المستند غير موجود).
    // بعد ذلك يُحترم حذف المستخدم — الهدايا المحذوفة لا ترجع أبداً.
    if (!exists) {
      items = DEFAULT_CONFIG_GIFTS;
      await saveConfigGifts(items, cats);
    }
    setGifts(items);
    setCategories(cats);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = filterCategory === 'all'
    ? gifts
    : gifts.filter((g) => g.category === filterCategory);

  const handleSaveGift = async (gift: ConfigGift) => {
    if (!categories.length) {
      alert('أضف تصنيفاً واحداً على الأقل من «إدارة التصنيفات» قبل حفظ الهدايا.');
      return;
    }
    const hasImage = Boolean(gift.imageUrl?.trim() || gift.animationUrl?.trim() || gift.videoUrl?.trim());
    if ((gift.visualType === 'image' || hasImage) && !hasImage) {
      alert('ارفع صورة الهدية أو الصق رابطاً قبل الحفظ');
      return;
    }
    const normalized: ConfigGift = { ...gift };
    if (gift.imageUrl?.trim()) normalized.imageUrl = gift.imageUrl.trim();
    else delete normalized.imageUrl;
    if (gift.animationUrl?.trim()) normalized.animationUrl = gift.animationUrl.trim();
    else delete normalized.animationUrl;
    if (gift.soundUrl?.trim()) normalized.soundUrl = gift.soundUrl.trim();
    else delete normalized.soundUrl;
    if (gift.videoUrl?.trim()) normalized.videoUrl = gift.videoUrl.trim();
    else delete normalized.videoUrl;
    if (gift.videoUrlMp4?.trim()) normalized.videoUrlMp4 = gift.videoUrlMp4.trim();
    else delete normalized.videoUrlMp4;

    let updated: ConfigGift[];
    if (isNew) {
      const id = normalized.id || `gift_${Date.now()}`;
      updated = [...gifts, { ...normalized, id }];
      await logAdminAction('إضافة هدية', normalized.name, `${normalized.price} عملة`);
    } else {
      updated = gifts.map((g) => (g.id === normalized.id ? normalized : g));
      await logAdminAction('تعديل هدية', normalized.name, `${normalized.price} عملة`);
    }
    setGifts(updated);
    await saveConfigGifts(updated, categories);
    setEditing(null);
  };

  const handleDeleteGift = async (gift: ConfigGift) => {
    if (!confirm(`حذف هدية "${gift.name}"؟`)) return;
    const updated = gifts.filter((g) => g.id !== gift.id);
    setGifts(updated);
    await saveConfigGifts(updated, categories);
    await logAdminAction('حذف هدية', gift.name);
  };

  const handleDeleteAllGifts = async () => {
    if (!gifts.length) return;
    if (!confirm(`حذف كل الهدايا (${gifts.length})؟\n\nلن ترجع بعد الآن — بعدها أضف هداياك الحقيقية.`)) return;
    const count = gifts.length;
    setGifts([]);
    await saveConfigGifts([], categories);
    await logAdminAction('حذف كل الهدايا', `${count} هدية`);
  };

  const handleSaveCategories = async (next: ConfigGiftCategory[]) => {
    setCategories(next);
    await saveConfigGiftCategories(next);
    await logAdminAction('تحديث تصنيفات الهدايا', `${next.length} تصنيف`);
  };

  const handleSeedSamples = async () => {
    const total = SAMPLE_CONFIG_GIFTS.length;
    if (!confirm(`إضافة ${total} هدية تجريبية (ثابتة / متحركة / صوتية) + 4 تصنيفات؟\n\nلن تُكرَّر الهدايا الموجودة مسبقاً.`)) return;
    setSeeding(true);
    try {
      const mergedCats = [...categories];
      let catsAdded = 0;
      for (const sc of SAMPLE_GIFT_CATEGORIES) {
        if (!mergedCats.some((c) => c.id === sc.id)) {
          mergedCats.push(sc);
          catsAdded += 1;
        }
      }
      mergedCats.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      const mergedGifts = [...gifts];
      let giftsAdded = 0;
      for (const sg of SAMPLE_CONFIG_GIFTS) {
        if (!mergedGifts.some((g) => g.id === sg.id)) {
          mergedGifts.push(sg);
          giftsAdded += 1;
        }
      }

      setCategories(mergedCats);
      setGifts(mergedGifts);
      await saveConfigGifts(mergedGifts, mergedCats);
      await logAdminAction('إضافة عينات هدايا', `${giftsAdded} هدية جديدة`);
      alert(`تم!\n• ${giftsAdded} هدية جديدة (${total - giftsAdded} موجودة مسبقاً)\n• ${catsAdded} تصنيف جديد\n\nتظهر فوراً في التطبيق.`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'فشل إضافة العينات');
    } finally {
      setSeeding(false);
    }
  };

  const openNewGift = () => {
    const defaultCat = categories[0]?.id ?? '';
    setEditing({
      id: `gift_${Date.now()}`,
      name: '',
      price: 100,
      category: defaultCat,
      iconName: 'Gift',
      iconColor: '#e11212',
      rarity: 'common',
      giftMediaType: 'static',
      visualType: 'icon',
    });
    setIsNew(true);
  };

  return (
    <div className="page-container">
      <div className="filters-bar" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success)', fontSize: 13, fontWeight: 600 }}>
          <Cloud size={16} /> مرتبط بالتطبيق — أي تعديل يظهر فوراً
        </div>
        <div style={{ display: 'flex', gap: 8, marginRight: 'auto', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => setShowCategories(true)}>
            <FolderOpen size={16} /> إدارة التصنيفات ({categories.length})
          </button>
          <button className="btn btn-secondary" onClick={handleSeedSamples} disabled={seeding} title="17 هدية: 6 ثابتة · 6 متحركة · 5 صوتية">
            {seeding ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
            عينات واقعية ({SAMPLE_CONFIG_GIFTS.length})
          </button>
          <button className="btn btn-danger" onClick={handleDeleteAllGifts} disabled={!gifts.length} title="حذف كل الهدايا — لن ترجع">
            <Trash2 size={16} /> حذف الكل
          </button>
          <button className="btn btn-primary" onClick={openNewGift} disabled={!categories.length}>
            <Plus size={18} /> إضافة هدية
          </button>
        </div>
      </div>

      {!categories.length && !loading && (
        <div className="card" style={{ padding: 20, marginBottom: 16, borderColor: 'var(--warning)' }}>
          <p style={{ margin: 0, fontWeight: 600, color: 'var(--warning)' }}>
            لا توجد تصنيفات بعد. افتح «إدارة التصنيفات» وأضف تصنيفات بأسماء عربية وإنجليزية (أو أي لغة).
          </p>
        </div>
      )}

      {!loading && (
        <div className="card" style={{ padding: 16, marginBottom: 16, background: 'rgba(116, 33, 235, 0.06)', borderColor: 'rgba(116, 33, 235, 0.2)' }}>
          <p style={{ margin: '0 0 8px', fontWeight: 700, color: 'var(--primary)' }}>
            <Sparkles size={16} style={{ verticalAlign: 'middle', marginLeft: 6 }} />
            بيانات تجريبية جاهزة
          </p>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            اضغط «عينات واقعية» لإضافة {SAMPLE_CONFIG_GIFTS.length} هدية:{' '}
            <strong>ثابتة</strong> (PNG) · <strong>متحركة</strong> (GIF) · <strong>صوتية</strong> (PNG + MP3).
            يمكنك تعديل أي هدية أو رفع ملفاتك الخاصة من نموذج التعديل.
          </p>
        </div>
      )}

      <div className="tabs" style={{ overflowX: 'auto' }}>
        <button
          className={`tab ${filterCategory === 'all' ? 'active' : ''}`}
          onClick={() => setFilterCategory('all')}
        >
          الكل
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            className={`tab ${filterCategory === c.id ? 'active' : ''}`}
            onClick={() => setFilterCategory(c.id)}
          >
            {categoryLabel(c)}
          </button>
        ))}
      </div>

      {loading ? <Loading /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 16 }}>
          {filtered.map((g) => (
            <div key={g.id} className="card" style={{ padding: 16, position: 'relative' }}>
              <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 4 }}>
                <button className="action-icon edit" onClick={() => { setEditing(g); setIsNew(false); }}>
                  <Pencil size={14} />
                </button>
                <button className="action-icon ban" onClick={() => handleDeleteGift(g)}>
                  <Trash2 size={14} />
                </button>
              </div>
              {g.giftMediaType === 'animated_sound' && (
                <span style={{
                  position: 'absolute', top: 10, right: 10, fontSize: 9, fontWeight: 700,
                  background: '#FEF3C7', color: '#D97706', padding: '2px 6px', borderRadius: 6,
                  display: 'flex', alignItems: 'center', gap: 2,
                }}>
                  <Volume2 size={10} /> صوت
                </span>
              )}
              {g.giftMediaType === 'animated' && !g.soundUrl && (
                <span style={{
                  position: 'absolute', top: 10, right: 10, fontSize: 9, fontWeight: 700,
                  background: 'var(--primary-soft)', color: 'var(--primary)', padding: '2px 6px', borderRadius: 6,
                }}>
                  متحرك
                </span>
              )}
              {g.giftMediaType === 'video' && (
                <span style={{
                  position: 'absolute', top: 10, right: 10, fontSize: 9, fontWeight: 700,
                  background: '#DBEAFE', color: '#8b0000', padding: '2px 6px', borderRadius: 6,
                  display: 'flex', alignItems: 'center', gap: 2,
                }}>
                  <Film size={10} /> فيديو
                </span>
              )}
              <div style={{
                width: 60, height: 60, borderRadius: 16, margin: '8px auto 12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${g.iconColor}1A`,
              }}>
                <GiftPreview gift={g} size={34} />
              </div>
              <p style={{ fontWeight: 700, fontSize: 15, textAlign: 'center', marginBottom: 4 }}>{g.name}</p>
              <p style={{ fontSize: 11, textAlign: 'center', color: 'var(--text-muted)', marginBottom: 4 }}>
                {categoryLabel(categories.find((c) => c.id === g.category) ?? { id: g.category, labels: {} })}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 8 }}>
                <Coins size={14} color="#F59E0B" />
                <span style={{ fontWeight: 700, color: 'var(--gold-dark)' }}>{formatNumber(g.price)}</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <Badge variant={RARITY_VARIANT[g.rarity]}>{RARITY_LABEL[g.rarity]}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <GiftEditor
          gift={editing}
          isNew={isNew}
          categories={categories}
          onSave={handleSaveGift}
          onClose={() => setEditing(null)}
        />
      )}

      {showCategories && (
        <CategoryManager
          categories={categories}
          onSave={handleSaveCategories}
          onClose={() => setShowCategories(false)}
        />
      )}
    </div>
  );
}

// ==================== إدارة التصنيفات ====================

function CategoryManager({ categories, onSave, onClose }: {
  categories: ConfigGiftCategory[];
  onSave: (cats: ConfigGiftCategory[]) => Promise<void>;
  onClose: () => void;
}) {
  const [list, setList] = useState<ConfigGiftCategory[]>(categories);
  const [editing, setEditing] = useState<ConfigGiftCategory | null>(null);
  const [extraLang, setExtraLang] = useState('');
  const [saving, setSaving] = useState(false);

  const startNew = () => {
    setEditing({
      id: '',
      labels: { ar: '', en: '' },
      order: list.length,
      enabled: true,
    });
  };

  const saveCategory = () => {
    if (!editing) return;
    const id = editing.id.trim() || `cat_${Date.now()}`;
    const labels: Record<string, string> = {};
    Object.entries(editing.labels).forEach(([k, v]) => {
      if (v?.trim()) labels[k] = v.trim();
    });
    if (!Object.keys(labels).length) {
      alert('أدخل اسم التصنيف بلغة واحدة على الأقل');
      return;
    }
    const item: ConfigGiftCategory = { id, labels, order: editing.order ?? list.length, enabled: editing.enabled !== false };
    const exists = list.some((c) => c.id === id);
    setList(exists ? list.map((c) => (c.id === id ? item : c)) : [...list, item]);
    setEditing(null);
  };

  const removeCategory = (id: string) => {
    if (!confirm('حذف هذا التصنيف؟ الهدايا المرتبطة به ستبقى لكن قد لا تظهر في التبويب.')) return;
    setList(list.filter((c) => c.id !== id));
  };

  const moveCategory = (idx: number, dir: -1 | 1) => {
    const next = [...list];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j]!, next[idx]!];
    setList(next.map((c, i) => ({ ...c, order: i })));
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
      await onSave(list.map((c, i) => ({ ...c, order: i })));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3><Languages size={18} style={{ verticalAlign: 'middle', marginLeft: 6 }} /> تصنيفات الهدايا</h3>
          <button className="action-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 0 }}>
            أضف تصنيفات بأسماء لكل لغة — تظهر في التطبيق حسب لغة المستخدم (ar / en / …).
          </p>

          {list.map((c, idx) => (
            <div key={c.id} className="card" style={{ padding: 12, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <strong>{categoryLabel(c)}</strong>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 8 }}>({c.id})</span>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {Object.entries(c.labels).map(([lang, label]) => (
                    <span key={lang} style={{ marginLeft: 10 }}>{lang}: {label}</span>
                  ))}
                </div>
              </div>
              <button className="action-icon" onClick={() => moveCategory(idx, -1)} disabled={idx === 0}>
                <ChevronUp size={14} />
              </button>
              <button className="action-icon" onClick={() => moveCategory(idx, 1)} disabled={idx === list.length - 1}>
                <ChevronDown size={14} />
              </button>
              <button className="action-icon edit" onClick={() => setEditing(c)}><Pencil size={14} /></button>
              <button className="action-icon ban" onClick={() => removeCategory(c.id)}><Trash2 size={14} /></button>
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
                  placeholder="classic"
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
                .filter((k) => !APP_LANGUAGES.some((l) => l.code === k))
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
                <input className="form-input" style={{ flex: 1 }} placeholder="كود لغة إضافي (fr, tr...)"
                  value={extraLang} onChange={(e) => setExtraLang(e.target.value)} />
                <button type="button" className="btn btn-ghost" onClick={addLanguageField}>+ لغة</button>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={saveCategory}><Save size={14} /> حفظ التصنيف</button>
                <button className="btn btn-ghost" onClick={() => setEditing(null)}>إلغاء</button>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={handlePublish} disabled={saving}>
            {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
            نشر التصنيفات للتطبيق
          </button>
          <button className="btn btn-ghost" onClick={onClose}>إغلاق</button>
        </div>
      </div>
    </div>
  );
}

// ==================== محرر الهدية ====================

function GiftEditor({ gift, isNew, categories, onSave, onClose }: {
  gift: ConfigGift;
  isNew: boolean;
  categories: ConfigGiftCategory[];
  onSave: (g: ConfigGift) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ConfigGift>(gift);
  const [uploading, setUploading] = useState<'thumb' | 'animation' | 'sound' | 'video' | 'videoMp4' | null>(null);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const thumbRef = useRef<HTMLInputElement>(null);
  const animRef = useRef<HTMLInputElement>(null);
  const soundRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const videoMp4Ref = useRef<HTMLInputElement>(null);

  const mediaType: GiftMediaType = form.giftMediaType ?? 'static';
  const visualType: GiftVisualType = form.visualType === 'image' || form.imageUrl ? 'image' : 'icon';
  const giftId = form.id || `gift_${Date.now()}`;
  const mediaHint = MEDIA_TYPES.find((m) => m.id === mediaType)?.hint ?? '';

  const setMediaType = (t: GiftMediaType) => {
    setSaveError('');
    setForm((f) => ({
      ...f,
      giftMediaType: t,
      isAnimated: t !== 'static',
      visualType: t === 'static' ? f.visualType : 'image',
      ...(t === 'static' ? { animationUrl: undefined, soundUrl: undefined, videoUrl: undefined } : {}),
      ...(t === 'animated' ? { soundUrl: undefined, videoUrl: undefined } : {}),
      ...(t === 'video' ? { animationUrl: undefined, soundUrl: undefined } : {}),
      ...(t === 'animated_sound' ? { videoUrl: undefined } : {}),
    }));
  };

  const handleFile = async (file: File | undefined, kind: 'thumb' | 'animation' | 'sound' | 'video' | 'videoMp4') => {
    if (!file) return;
    setUploadError('');
    setUploadPct(0);
    setUploading(kind);
    try {
      const id = form.id || giftId;
      if (!form.id) setForm((f) => ({ ...f, id }));
      const url = await uploadGiftAsset(file, id, kind, (p) => setUploadPct(Math.round(p.ratio * 100)));
      if (kind === 'thumb') {
        setForm((f) => ({ ...f, id, visualType: 'image', imageUrl: url }));
      } else if (kind === 'animation') {
        setForm((f) => ({
          ...f, id, visualType: 'image', animationUrl: url,
          giftMediaType: f.giftMediaType === 'static' ? 'animated' : f.giftMediaType,
          isAnimated: true,
        }));
      } else if (kind === 'video') {
        setForm((f) => ({
          ...f, id, visualType: 'image', videoUrl: url,
          giftMediaType: 'video', isAnimated: true,
        }));
      } else if (kind === 'videoMp4') {
        setForm((f) => ({ ...f, id, videoUrlMp4: url }));
      } else {
        setForm((f) => ({
          ...f, id, soundUrl: url, giftMediaType: 'animated_sound', isAnimated: true,
        }));
      }
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : 'فشل الرفع');
    } finally {
      setUploading(null);
      setUploadPct(0);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isNew ? 'إضافة هدية جديدة' : 'تعديل الهدية'}</h3>
          <button className="action-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{
            width: 88, height: 88, borderRadius: 20, margin: '0 auto 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `linear-gradient(135deg, ${form.iconColor}22, ${form.iconColor}08)`,
            border: `2px solid ${form.iconColor}44`,
          }}>
            <GiftPreview gift={form} size={48} />
          </div>

          <div className="form-group">
            <label className="form-label">اسم الهدية</label>
            <input className="form-input" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">السعر (عملات)</label>
              <input className="form-input" type="number" value={form.price}
                onChange={(e) => setForm({ ...form, price: +e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">لون الإطار</label>
              <input className="form-input" type="color" value={form.iconColor}
                onChange={(e) => setForm({ ...form, iconColor: e.target.value })} style={{ height: 46, padding: 4 }} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">حصرية لـ SVIP (امتياز «هدايا حصرية»)</label>
            <input
              className="form-input"
              type="number"
              min={0}
              max={16}
              value={form.requiredVipLevel ?? 0}
              onChange={(e) => setForm({ ...form, requiredVipLevel: Math.max(0, +e.target.value) })}
            />
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
              0 = متاحة للجميع. أي رقم أكبر = لا يمكن إرسالها إلا لأعضاء SVIP بهذا المستوى وما فوق.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">نوع الهدية</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {MEDIA_TYPES.map((m) => (
                <button key={m.id} type="button"
                  className={`btn ${mediaType === m.id ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1, minWidth: 100 }}
                  onClick={() => setMediaType(m.id)}>
                  {m.id === 'animated_sound' && <Volume2 size={14} />}
                  {m.id === 'animated' && <Sparkles size={14} />}
                  {m.id === 'video' && <Film size={14} />}
                  {m.id === 'static' && <ImageIcon size={14} />}
                  {m.label}
                </button>
              ))}
            </div>
            {mediaHint && (
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>
                {mediaHint}
              </p>
            )}
          </div>

          {mediaType === 'static' && (
            <>
              <div className="form-group">
                <label className="form-label">شكل العرض</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className={`btn ${visualType === 'icon' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ flex: 1 }} onClick={() => setForm({ ...form, visualType: 'icon' })}>
                    <Gift size={16} /> أيقونة Lucide
                  </button>
                  <button type="button" className={`btn ${visualType === 'image' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ flex: 1 }} onClick={() => setForm({ ...form, visualType: 'image' })}>
                    <ImageIcon size={16} /> صورة PNG/JPG
                  </button>
                </div>
              </div>
              {visualType === 'image' && (
                <div className="form-group">
                  <label className="form-label">صورة ثابتة <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    PNG أو JPG — 512×512 — للقائمة والشات
                  </p>
                  <input ref={thumbRef} type="file" accept="image/png,image/jpeg,image/webp"
                    style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files?.[0], 'thumb')} />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-secondary" disabled={uploading === 'thumb'}
                      onClick={() => thumbRef.current?.click()}>
                      {uploading === 'thumb' ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
                      رفع PNG/JPG
                    </button>
                    <input className="form-input" style={{ flex: 1, minWidth: 140 }} placeholder="رابط الصورة"
                      value={form.imageUrl ?? ''}
                      onChange={(e) => setForm({ ...form, imageUrl: e.target.value, visualType: 'image' })} />
                  </div>
                </div>
              )}
            </>
          )}

          {mediaType === 'animated' && (
            <div className="form-group">
              <label className="form-label"><Sparkles size={14} /> GIF متحرك <span style={{ color: 'var(--danger)' }}>*</span></label>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
                GIF فقط — 320×320 تقريباً — يُعرض في القائمة والأنيميشن
              </p>
              <input ref={animRef} type="file" accept="image/gif"
                style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files?.[0], 'animation')} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-secondary" disabled={uploading === 'animation'}
                  onClick={() => animRef.current?.click()}>
                  {uploading === 'animation' ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
                  رفع GIF
                </button>
                <input className="form-input" style={{ flex: 1, minWidth: 140 }} placeholder="رابط GIF"
                  value={form.animationUrl ?? ''}
                  onChange={(e) => setForm({ ...form, animationUrl: e.target.value, visualType: 'image', isAnimated: true, giftMediaType: 'animated' })} />
              </div>
              <div className="form-group" style={{ marginTop: 12, marginBottom: 0 }}>
                <label className="form-label">صورة قائمة (اختياري)</label>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  PNG/JPG ثابتة للشبكة — إن تُركت فارغة يُستخدم GIF
                </p>
                <input ref={thumbRef} type="file" accept="image/png,image/jpeg,image/webp"
                  style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files?.[0], 'thumb')} />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-ghost" disabled={uploading === 'thumb'}
                    onClick={() => thumbRef.current?.click()}>
                    {uploading === 'thumb' ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
                    رفع PNG/JPG
                  </button>
                  <input className="form-input" style={{ flex: 1, minWidth: 140 }} placeholder="رابط الصورة الثابتة"
                    value={form.imageUrl ?? ''}
                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value, visualType: 'image' })} />
                </div>
              </div>
            </div>
          )}

          {mediaType === 'video' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label"><Film size={14} /> فيديو الهدية <span style={{ color: 'var(--danger)' }}>*</span></label>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  MP4 / WebM / MOV — 3–15 ثانية — يُعرض ملء الشاشة في الروم.
                  WebM يعمل على Android؛ لـ iOS ارفع نسخة MP4 احتياطية أدناه.
                </p>
                <input ref={videoRef} type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                  style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files?.[0], 'video')} />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-secondary" disabled={uploading === 'video'}
                    onClick={() => videoRef.current?.click()}>
                    {uploading === 'video' ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
                    رفع فيديو
                  </button>
                  <input className="form-input" style={{ flex: 1, minWidth: 140 }} placeholder="رابط الفيديو"
                    value={form.videoUrl ?? ''}
                    onChange={(e) => setForm({
                      ...form, videoUrl: e.target.value, visualType: 'image', isAnimated: true, giftMediaType: 'video',
                    })} />
                </div>
                {form.videoUrl?.trim() && (
                  <video
                    src={form.videoUrl}
                    controls
                    muted
                    playsInline
                    style={{ width: '100%', maxHeight: 180, marginTop: 10, borderRadius: 12, background: '#000' }}
                  />
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">MP4 احتياطي لـ iOS (اختياري)</label>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  مطلوب إذا كان الفيديو الأساسي WebM — iOS لا يشغّل WebM.
                </p>
                <input ref={videoMp4Ref} type="file" accept="video/mp4,video/quicktime,.mp4,.mov"
                  style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files?.[0], 'videoMp4')} />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-ghost" disabled={uploading === 'videoMp4'}
                    onClick={() => videoMp4Ref.current?.click()}>
                    {uploading === 'videoMp4' ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
                    رفع MP4 لـ iOS
                  </button>
                  <input className="form-input" style={{ flex: 1, minWidth: 140 }} placeholder="رابط MP4 احتياطي"
                    value={form.videoUrlMp4 ?? ''}
                    onChange={(e) => setForm({ ...form, videoUrlMp4: e.target.value })} />
                </div>
                {form.videoUrlMp4?.trim() && (
                  <video
                    src={form.videoUrlMp4}
                    controls
                    muted
                    playsInline
                    style={{ width: '100%', maxHeight: 140, marginTop: 10, borderRadius: 12, background: '#000' }}
                  />
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">إزالة الخلفية</label>
                <select
                  className="form-input"
                  value={form.videoChromaKey ?? 'black'}
                  onChange={(e) => setForm({
                    ...form,
                    videoChromaKey: e.target.value as 'black' | 'green' | 'none',
                  })}
                >
                  <option value="black">سوداء (افتراضي — الأفضل لمعظم الفيديوهات)</option>
                  <option value="green">خضراء (Green Screen)</option>
                  <option value="none">بدون معالجة (فيدio شفاف MOV/alpha-packed فقط)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">صورة قائمة (اختياري)</label>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  PNG/JPG ثابتة لشبكة اختيار الهدايا — إن تُركت فارغة يُستخدم إطار من الفيديو
                </p>
                <input ref={thumbRef} type="file" accept="image/png,image/jpeg,image/webp"
                  style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files?.[0], 'thumb')} />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-ghost" disabled={uploading === 'thumb'}
                    onClick={() => thumbRef.current?.click()}>
                    {uploading === 'thumb' ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
                    رفع PNG/JPG
                  </button>
                  <input className="form-input" style={{ flex: 1, minWidth: 140 }} placeholder="رابط الصورة الثابتة"
                    value={form.imageUrl ?? ''}
                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value, visualType: 'image' })} />
                </div>
              </div>
            </div>
          )}

          {mediaType === 'animated_sound' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label"><ImageIcon size={14} /> صورة ثابتة <span style={{ color: 'var(--danger)' }}>*</span></label>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  PNG أو JPG — تظهر مع الصوت في نفس اللحظة
                </p>
                <input ref={thumbRef} type="file" accept="image/png,image/jpeg,image/webp"
                  style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files?.[0], 'thumb')} />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-secondary" disabled={uploading === 'thumb'}
                    onClick={() => thumbRef.current?.click()}>
                    {uploading === 'thumb' ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
                    رفع PNG/JPG
                  </button>
                  <input className="form-input" style={{ flex: 1, minWidth: 140 }} placeholder="رابط الصورة"
                    value={form.imageUrl ?? ''}
                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value, visualType: 'image', giftMediaType: 'animated_sound' })} />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label"><Volume2 size={14} /> ملف صوت MP3 <span style={{ color: 'var(--danger)' }}>*</span></label>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  1–3 ثوانٍ — يُشغَّل فوراً مع ظهور الصورة
                </p>
                <input ref={soundRef} type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg"
                  style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files?.[0], 'sound')} />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-secondary" disabled={uploading === 'sound'}
                    onClick={() => soundRef.current?.click()}>
                    {uploading === 'sound' ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
                    رفع MP3
                  </button>
                  <input className="form-input" style={{ flex: 1, minWidth: 140 }} placeholder="رابط MP3"
                    value={form.soundUrl ?? ''}
                    onChange={(e) => setForm({ ...form, soundUrl: e.target.value, giftMediaType: 'animated_sound' })} />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label"><Sparkles size={14} /> GIF إضافي (اختياري)</label>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  طبقة حركة فوق الصورة — ليس بديلاً عن الصورة الثابتة
                </p>
                <input ref={animRef} type="file" accept="image/gif"
                  style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files?.[0], 'animation')} />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-ghost" disabled={uploading === 'animation'}
                    onClick={() => animRef.current?.click()}>
                    {uploading === 'animation' ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
                    رفع GIF
                  </button>
                  <input className="form-input" style={{ flex: 1, minWidth: 140 }} placeholder="رابط GIF (اختياري)"
                    value={form.animationUrl ?? ''}
                    onChange={(e) => setForm({ ...form, animationUrl: e.target.value, visualType: 'image', isAnimated: true, giftMediaType: 'animated_sound' })} />
                </div>
              </div>
            </div>
          )}

          {visualType === 'icon' && mediaType === 'static' && (
            <div className="form-group">
              <label className="form-label">الأيقونة</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 120, overflowY: 'auto' }}>
                {ICON_OPTIONS.map((ic) => {
                  const I = (Icons as any)[ic] ?? Gift;
                  const active = form.iconName === ic;
                  return (
                    <button key={ic} type="button" onClick={() => setForm({ ...form, iconName: ic })}
                      style={{
                        width: 42, height: 42, borderRadius: 10,
                        border: `2px solid ${active ? form.iconColor : 'var(--border)'}`,
                        background: active ? `${form.iconColor}12` : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                      <I size={20} color={active ? form.iconColor : 'var(--text-secondary)'} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {uploading && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                <span>جارٍ المعالجة والرفع…</span>
                <span>{uploadPct}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${uploadPct}%`, background: 'var(--primary, #e11212)', transition: 'width 0.2s' }} />
              </div>
            </div>
          )}

          {uploadError && (
            <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 8 }}>{uploadError}</p>
          )}
          {saveError && (
            <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 8 }}>{saveError}</p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
            <div className="form-group">
              <label className="form-label">التصنيف</label>
              <select className="form-input" value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {categories.length === 0 && <option value="">— أضف تصنيفاً أولاً —</option>}
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{categoryLabel(c)} ({c.id})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">الندرة</label>
              <select className="form-input" value={form.rarity}
                onChange={(e) => setForm({ ...form, rarity: e.target.value as ConfigGift['rarity'] })}>
                {RARITIES.map((r) => <option key={r} value={r}>{RARITY_LABEL[r]}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={() => {
            const err = validateGiftMedia(form, mediaType, visualType);
            if (err) { setSaveError(err); return; }
            if (!form.name || !form.category) { setSaveError('أكمل الاسم والتصنيف'); return; }
            setSaveError('');
            onSave({ ...form, id: form.id || giftId });
          }}
            disabled={!form.name || !form.category}>
            <Save size={16} /> حفظ ونشر
          </button>
          <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </div>
  );
}
