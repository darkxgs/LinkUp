/**
 * متجر تخصيص الروم — إطارات (مدفوعة) + خلفيات (مجانية).
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  Plus, Pencil, Trash2, Upload, X, Coins, Cloud, Frame, ImageIcon,
  Sparkles, Layers,
} from 'lucide-react';
import { Loading, Empty, Badge } from '@/components/Common';
import {
  getRoomFrames,
  saveRoomFrames,
  getRoomBackgrounds,
  saveRoomBackgrounds,
  getAgencyRoomFrames,
  saveAgencyRoomFrames,
  getAgencyRoomBackgrounds,
  saveAgencyRoomBackgrounds,
  logAdminAction,
  formatNumber,
  type RoomFrame,
  type RoomBackground,
  type DecorBadge,
} from '@/services/admin';
import { uploadDecorAsset } from '@/lib/storage';
import { FrameEditorModal } from '@/components/store/FrameEditorModal';

type Tab = 'frames' | 'backgrounds';
type Catalog = 'app' | 'agency';

const BADGES: { value: DecorBadge; label: string; variant: string }[] = [
  { value: 'limited', label: 'محدود', variant: 'purple' },
  { value: 'event', label: 'مناسبة', variant: 'blue' },
  { value: 'hot', label: 'رائج', variant: 'pink' },
  { value: 'new', label: 'جديد', variant: 'green' },
];

function badgeVariant(badge?: DecorBadge): string {
  return BADGES.find((b) => b.value === badge)?.variant ?? 'gray';
}

export default function RoomDecor() {
  const [catalog, setCatalog] = useState<Catalog>('app');
  const [tab, setTab] = useState<Tab>('frames');
  const [frames, setFrames] = useState<RoomFrame[]>([]);
  const [backgrounds, setBackgrounds] = useState<RoomBackground[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFrame, setEditingFrame] = useState<RoomFrame | null>(null);
  const [editingBg, setEditingBg] = useState<RoomBackground | null>(null);

  useEffect(() => {
    setLoading(true);
    const load =
      catalog === 'agency'
        ? Promise.all([getAgencyRoomFrames(), getAgencyRoomBackgrounds()])
        : Promise.all([getRoomFrames(), getRoomBackgrounds()]);
    load
      .then(([f, b]) => {
        setFrames(f);
        setBackgrounds(b);
      })
      .finally(() => setLoading(false));
  }, [catalog]);

  const persistFrames = async (next: RoomFrame[]) => {
    setFrames(next);
    if (catalog === 'agency') await saveAgencyRoomFrames(next);
    else await saveRoomFrames(next);
  };
  const persistBgs = async (next: RoomBackground[]) => {
    setBackgrounds(next);
    if (catalog === 'agency') await saveAgencyRoomBackgrounds(next);
    else await saveRoomBackgrounds(next);
  };

  const saveFrame = async (f: RoomFrame, isNew: boolean) => {
    const next = isNew ? [...frames, f] : frames.map((x) => (x.id === f.id ? f : x));
    await persistFrames(next);
    await logAdminAction(isNew ? 'إضافة إطار روم' : 'تعديل إطار روم', f.name, `${f.price} عملة · ${catalog === 'agency' ? 'وكالات' : 'عام'}`);
    setEditingFrame(null);
  };
  const deleteFrame = async (f: RoomFrame) => {
    if (!confirm(`حذف الإطار "${f.name}"؟`)) return;
    await persistFrames(frames.filter((x) => x.id !== f.id));
    await logAdminAction('حذف إطار روم', f.name);
  };

  const saveBg = async (b: RoomBackground, isNew: boolean) => {
    const next = isNew ? [...backgrounds, b] : backgrounds.map((x) => (x.id === b.id ? b : x));
    await persistBgs(next);
    await logAdminAction(isNew ? 'إضافة خلفية روم' : 'تعديل خلفية روم', b.name);
    setEditingBg(null);
  };
  const deleteBg = async (b: RoomBackground) => {
    if (!confirm(`حذف الخلفية "${b.name}"؟`)) return;
    await persistBgs(backgrounds.filter((x) => x.id !== b.id));
    await logAdminAction('حذف خلفية روم', b.name);
  };

  const openNew = () => {
    if (tab === 'frames') {
      setEditingFrame({ id: '', name: '', imageUrl: '', price: 1000, enabled: true });
    } else {
      setEditingBg({ id: '', name: '', imageUrl: '', enabled: true });
    }
  };

  const enabledFrames = frames.filter((f) => f.enabled).length;
  const enabledBgs = backgrounds.filter((b) => b.enabled).length;

  return (
    <div className="page-container room-decor-page">
      <div className="agency-page-header">
        <div>
          <h1>
            <Sparkles size={26} style={{ verticalAlign: 'middle', marginLeft: 8, color: 'var(--brand-primary)' }} />
            تخصيص الروم
          </h1>
          <p>
            إدارة إطارات الغرفة (مدفوعة بالعملات) وخلفيات الغرفة (مجانية). اختر «عام» للتطبيق أو «وكالات» لمتجر الوكالات فقط.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openNew}>
          <Plus size={18} />
          {tab === 'frames' ? 'إطار جديد' : 'خلفية جديدة'}
        </button>
      </div>

      <div className="room-decor-stats">
        <div className="room-decor-stat">
          <div className="room-decor-stat-icon" style={{ background: 'rgba(225,18,18,0.12)' }}>
            <Frame size={22} color="var(--brand-primary)" />
          </div>
          <div>
            <span className="room-decor-stat-value">{frames.length}</span>
            <span className="room-decor-stat-label">إطار ({enabledFrames} مفعّل)</span>
          </div>
        </div>
        <div className="room-decor-stat">
          <div className="room-decor-stat-icon" style={{ background: 'rgba(176,8,20,0.12)' }}>
            <ImageIcon size={22} color="var(--brand-secondary)" />
          </div>
          <div>
            <span className="room-decor-stat-value">{backgrounds.length}</span>
            <span className="room-decor-stat-label">خلفية ({enabledBgs} مفعّلة)</span>
          </div>
        </div>
        <div className="room-decor-stat room-decor-stat-hint">
          <Layers size={18} color="var(--text-muted)" />
          <span>PNG شفاف للإطارات · JPG/WebP للخلفيات</span>
        </div>
      </div>

      <div className="filters-bar">
        <div className="room-decor-sync">
          <Cloud size={16} />
          مرتبط بالتطبيق — التحديث فوري
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 8 }}>
        <button
          type="button"
          className={`tab ${catalog === 'app' ? 'active' : ''}`}
          onClick={() => { setCatalog('app'); setTab('frames'); }}
        >
          عام (الرومات)
        </button>
        <button
          type="button"
          className={`tab ${catalog === 'agency' ? 'active' : ''}`}
          onClick={() => { setCatalog('agency'); setTab('frames'); }}
        >
          وكالات
        </button>
      </div>

      <div className="tabs">
        <button
          type="button"
          className={`tab ${tab === 'frames' ? 'active' : ''}`}
          onClick={() => setTab('frames')}
        >
          <Frame size={16} style={{ verticalAlign: 'middle', marginLeft: 6 }} />
          الإطارات ({frames.length})
        </button>
        <button
          type="button"
          className={`tab ${tab === 'backgrounds' ? 'active' : ''}`}
          onClick={() => setTab('backgrounds')}
        >
          <ImageIcon size={16} style={{ verticalAlign: 'middle', marginLeft: 6 }} />
          الخلفيات ({backgrounds.length})
        </button>
      </div>

      {loading ? (
        <Loading text="جارٍ تحميل التخصيصات…" />
      ) : tab === 'frames' ? (
        frames.length === 0 ? (
          <div className="card room-decor-empty-card">
            <Empty text="لا توجد إطارات بعد — أضف أول إطار للمتجر." />
            <button type="button" className="btn btn-primary" style={{ margin: '0 auto' }} onClick={openNew}>
              <Plus size={18} /> إطار جديد
            </button>
          </div>
        ) : (
          <div className="room-decor-grid">
            {frames.map((f) => (
              <DecorCard
                key={f.id}
                name={f.name}
                imageUrl={f.imageUrl}
                variant="frame"
                enabled={f.enabled}
                badges={[
                  ...(f.badge ? [{ label: BADGES.find((b) => b.value === f.badge)?.label ?? f.badge, variant: badgeVariant(f.badge) }] : []),
                  ...(!f.enabled ? [{ label: 'معطّل', variant: 'gray' }] : []),
                ]}
                meta={
                  <>
                    <span className="room-decor-price">
                      <Coins size={14} color="#F59E0B" />
                      {formatNumber(f.price)}
                    </span>
                    <span className="room-decor-duration">
                      {f.durationDays ? `${f.durationDays} يوم` : 'دائم'}
                    </span>
                  </>
                }
                onEdit={() => setEditingFrame(f)}
                onDelete={() => deleteFrame(f)}
              />
            ))}
          </div>
        )
      ) : backgrounds.length === 0 ? (
        <div className="card room-decor-empty-card">
          <Empty text="لا توجد خلفيات بعد — أضف أول خلفية مجانية." />
          <button type="button" className="btn btn-primary" style={{ margin: '0 auto' }} onClick={openNew}>
            <Plus size={18} /> خلفية جديدة
          </button>
        </div>
      ) : (
        <div className="room-decor-grid">
          {backgrounds.map((b) => (
            <DecorCard
              key={b.id}
              name={b.name}
              imageUrl={b.imageUrl}
              variant="background"
              enabled={b.enabled}
              badges={[
                { label: 'مجاني', variant: 'green' },
                ...(!b.enabled ? [{ label: 'معطّل', variant: 'gray' }] : []),
              ]}
              onEdit={() => setEditingBg(b)}
              onDelete={() => deleteBg(b)}
            />
          ))}
        </div>
      )}

      {editingFrame && (
        <FrameEditorModal frame={editingFrame} onClose={() => setEditingFrame(null)} onSave={saveFrame} />
      )}
      {editingBg && (
        <BackgroundEditor background={editingBg} onClose={() => setEditingBg(null)} onSave={saveBg} />
      )}
    </div>
  );
}

function DecorCard({
  name,
  imageUrl,
  variant,
  enabled,
  badges,
  meta,
  onEdit,
  onDelete,
}: {
  name: string;
  imageUrl: string;
  variant: 'frame' | 'background';
  enabled: boolean;
  badges: { label: string; variant: string }[];
  meta?: ReactNode;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`card room-decor-card ${!enabled ? 'room-decor-card-off' : ''}`}>
      <div className="room-decor-card-actions">
        <button type="button" className="action-icon edit" onClick={onEdit} title="تعديل">
          <Pencil size={14} />
        </button>
        <button type="button" className="action-icon ban" onClick={onDelete} title="حذف">
          <Trash2 size={14} />
        </button>
      </div>

      <div className={`room-decor-preview room-decor-preview-${variant}`}>
        {imageUrl ? (
          <img src={imageUrl} alt={name} />
        ) : (
          <div className="room-decor-preview-placeholder">
            {variant === 'frame' ? <Frame size={28} /> : <ImageIcon size={28} />}
            <span>بلا صورة</span>
          </div>
        )}
        <div className="room-decor-badges">
          {badges.map((b) => (
            <Badge key={b.label} variant={b.variant}>{b.label}</Badge>
          ))}
        </div>
      </div>

      <h3 className="room-decor-card-title">{name}</h3>
      {meta && <div className="room-decor-card-meta">{meta}</div>}
    </div>
  );
}

function BackgroundEditor({
  background,
  onClose,
  onSave,
}: {
  background: RoomBackground;
  onClose: () => void;
  onSave: (b: RoomBackground, isNew: boolean) => void;
}) {
  const isNew = !background.id;
  const [draft, setDraft] = useState<RoomBackground>(background);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  const id = draft.id || `bg_${Date.now()}`;

  const handleUpload = async (file?: File) => {
    if (!file) return;
    if (!draft.name.trim()) {
      setErr('أدخل اسم الخلفية أولاً');
      return;
    }
    setErr('');
    setUploading(true);
    try {
      const url = await uploadDecorAsset(file, 'backgrounds', id);
      setDraft((d) => ({ ...d, id, imageUrl: url }));
    } catch (e: any) {
      setErr(e?.message ?? 'فشل الرفع');
    } finally {
      setUploading(false);
    }
  };

  const submit = () => {
    if (!draft.name.trim()) {
      setErr('الاسم مطلوب');
      return;
    }
    if (!draft.imageUrl.trim()) {
      setErr('صورة الخلفية مطلوبة');
      return;
    }
    onSave({ ...draft, id }, isNew);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isNew ? 'خلفية جديدة' : 'تعديل خلفية'}</h3>
          <button type="button" className="action-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <div className="room-decor-editor-preview room-decor-preview-background">
            {draft.imageUrl ? (
              <img src={draft.imageUrl} alt="" />
            ) : (
              <ImageIcon size={40} color="var(--text-muted)" />
            )}
          </div>

          <div className="form-group">
            <label className="form-label">اسم الخلفية</label>
            <input
              className="form-input"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="مثال: ليل المدينة"
            />
          </div>

          <label className="room-decor-check">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
            />
            <span>مفعّلة — تظهر في متجر التطبيق</span>
          </label>

          <div className="form-group">
            <label className="form-label">صورة الخلفية</label>
            <p className="room-decor-hint">نسبة عمودية 9:16 تقريباً — تُعرض خلف واجهة الغرفة</p>
            <label className="btn btn-secondary">
              <Upload size={16} />
              {uploading ? 'جارٍ الرفع…' : 'رفع صورة'}
              <input type="file" accept="image/*" hidden onChange={(e) => handleUpload(e.target.files?.[0])} />
            </label>
          </div>

          {err && <p className="room-decor-error">{err}</p>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            إلغاء
          </button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={uploading}>
            حفظ
          </button>
        </div>
      </div>
    </div>
  );
}
