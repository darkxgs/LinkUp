/**
 * لوحة التحكم — خلفيات المحادثة (تدرّجات / صور + مستوى العلاقة)
 */
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Upload, X, Sparkles, Layers, Heart } from 'lucide-react';
import { Loading, Empty, Badge } from '@/components/Common';
import {
  getConfigChatBackgrounds,
  saveConfigChatBackgrounds,
  DEFAULT_CONFIG_CHAT_BACKGROUNDS,
  logAdminAction,
  type ConfigChatBackground,
} from '@/services/admin';
import { uploadDecorAsset } from '@/lib/storage';

function gradientStyle(bg: ConfigChatBackground): React.CSSProperties {
  const colors = bg.colors?.length >= 2 ? bg.colors.join(', ') : '#F3E9FF, #faf7f7';
  const sx = bg.start?.x ?? 0;
  const sy = bg.start?.y ?? 0;
  const ex = bg.end?.x ?? 0;
  const ey = bg.end?.y ?? 1;
  const angle = Math.round((Math.atan2(ey - sy, ex - sx) * 180) / Math.PI + 90);
  return {
    background: `linear-gradient(${angle}deg, ${colors})`,
  };
}

function slugId(name: string): string {
  const base = name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^\w\u0600-\u06FF-]/g, '');
  return base || `bg_${Date.now()}`;
}

export default function ChatBackgroundsPage() {
  const [items, setItems] = useState<ConfigChatBackground[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ConfigChatBackground | null>(null);

  const load = async () => {
    setLoading(true);
    let list = await getConfigChatBackgrounds();
    if (list.length === 0) {
      list = DEFAULT_CONFIG_CHAT_BACKGROUNDS;
      await saveConfigChatBackgrounds(list);
    }
    setItems(list.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const persist = async (next: ConfigChatBackground[]) => {
    const sorted = [...next].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
    setItems(sorted);
    await saveConfigChatBackgrounds(sorted);
  };

  const restoreDefaults = async () => {
    if (!confirm('استعادة الخلفيات الافتراضية؟ سيتم استبدال القائمة الحالية.')) return;
    await persist(DEFAULT_CONFIG_CHAT_BACKGROUNDS);
    await logAdminAction('استعادة خلفيات الشات', 'افتراضي', `${DEFAULT_CONFIG_CHAT_BACKGROUNDS.length} خلفية`);
    alert('تمت الاستعادة — تظهر فوراً في التطبيق');
  };

  const saveItem = async (bg: ConfigChatBackground, isNew: boolean) => {
    let next = isNew ? [...items, bg] : items.map((x) => (x.id === bg.id ? bg : x));
    if (bg.isDefault) {
      next = next.map((x) => ({ ...x, isDefault: x.id === bg.id }));
    }
    await persist(next);
    await logAdminAction(isNew ? 'إضافة خلفية شات' : 'تعديل خلفية شات', bg.name, `مستوى ${bg.minBondLevel}`);
    setEditing(null);
  };

  const deleteItem = async (bg: ConfigChatBackground) => {
    if (!confirm(`حذف "${bg.name}"؟`)) return;
    await persist(items.filter((x) => x.id !== bg.id));
    await logAdminAction('حذف خلفية شات', bg.name);
  };

  const enabledCount = items.filter((b) => b.enabled !== false).length;

  return (
    <div className="page-container room-decor-page">
      <div className="agency-page-header">
        <div>
          <h1>
            <Layers size={26} style={{ verticalAlign: 'middle', marginLeft: 8, color: 'var(--brand-primary)' }} />
            خلفيات المحادثة
          </h1>
          <p>
            إدارة خلفيات الشات بين المستخدمين — تُفتح حسب مستوى العلاقة (bond). أي تعديل يظهر فوراً في التطبيق.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={restoreDefaults}>
            <Sparkles size={18} />
            استعادة الافتراضي
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              setEditing({
                id: '',
                name: '',
                minBondLevel: 1,
                colors: ['#F3E9FF', '#faf7f7'],
                start: { x: 0, y: 0 },
                end: { x: 0, y: 1 },
                enabled: true,
                sort: items.length,
              })
            }
          >
            <Plus size={18} />
            خلفية جديدة
          </button>
        </div>
      </div>

      <div className="room-decor-stats">
        <div className="room-decor-stat">
          <div className="room-decor-stat-icon" style={{ background: 'rgba(210,30,42,0.12)' }}>
            <Layers size={22} color="#d21e2a" />
          </div>
          <div>
            <span className="room-decor-stat-value">{items.length}</span>
            <span className="room-decor-stat-label">خلفية ({enabledCount} مفعّلة)</span>
          </div>
        </div>
        <div className="room-decor-stat room-decor-stat-hint">
          <Heart size={18} color="var(--brand-primary)" style={{ marginLeft: 6 }} />
          كل خلفية تتطلب مستوى علاقة — المستخدم يراها مقفلة حتى يصل للمستوى المطلوب
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty text="لا توجد خلفيات — أضف واحدة أو استعد الافتراضي" />
      ) : (
        <div className="room-decor-grid">
          {items.map((bg) => (
            <div
              key={bg.id}
              className={`card room-decor-card ${bg.enabled === false ? 'room-decor-card-off' : ''}`}
            >
              <div className="room-decor-card-actions">
                <button type="button" className="btn-icon" onClick={() => setEditing(bg)} title="تعديل">
                  <Pencil size={16} />
                </button>
                <button type="button" className="btn-icon btn-icon-danger" onClick={() => deleteItem(bg)} title="حذف">
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="room-decor-preview room-decor-preview-background">
                {bg.imageUrl ? (
                  <img src={bg.imageUrl} alt={bg.name} />
                ) : (
                  <div style={{ ...gradientStyle(bg), width: '100%', height: '100%' }} />
                )}
              </div>
              <div className="room-decor-badges">
                {bg.isDefault ? <Badge variant="purple">افتراضي</Badge> : null}
                {bg.enabled === false ? <Badge variant="gray">معطّل</Badge> : null}
                <Badge variant="pink">مستوى {bg.minBondLevel}</Badge>
              </div>
              <h3 className="room-decor-card-title">{bg.name}</h3>
              <div className="room-decor-card-meta">
                <span>{bg.colors?.join(' → ')}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing ? (
        <BackgroundEditor
          background={editing}
          existingIds={items.map((i) => i.id)}
          onClose={() => setEditing(null)}
          onSave={saveItem}
        />
      ) : null}
    </div>
  );
}

function BackgroundEditor({
  background,
  existingIds,
  onClose,
  onSave,
}: {
  background: ConfigChatBackground;
  existingIds: string[];
  onClose: () => void;
  onSave: (b: ConfigChatBackground, isNew: boolean) => void | Promise<void>;
}) {
  const isNew = !background.id;
  const [draft, setDraft] = useState<ConfigChatBackground>(background);
  const [colorsText, setColorsText] = useState(background.colors?.join(', ') ?? '#F3E9FF, #faf7f7');
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  const applyColors = (text: string) => {
    setColorsText(text);
    const colors = text.split(/[,،\n]+/).map((c) => c.trim()).filter(Boolean);
    setDraft((d) => ({ ...d, colors }));
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setErr('');
    try {
      const id = draft.id || slugId(draft.name || 'chat_bg');
      const url = await uploadDecorAsset(file, 'backgrounds', `chat_${id}`);
      setDraft((d) => ({ ...d, imageUrl: url }));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'فشل الرفع');
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setErr('');
    const name = draft.name.trim();
    if (!name) {
      setErr('الاسم مطلوب');
      return;
    }
    const colors = colorsText.split(/[,،\n]+/).map((c) => c.trim()).filter(Boolean);
    if (colors.length < 2 && !draft.imageUrl?.trim()) {
      setErr('أدخل لونين على الأقل أو ارفع صورة');
      return;
    }
    const id = isNew ? slugId(name) : draft.id;
    if (isNew && existingIds.includes(id)) {
      setErr('المعرّف مستخدم — غيّر الاسم');
      return;
    }
    await onSave(
      {
        ...draft,
        id,
        name,
        colors: colors.length >= 2 ? colors : ['#F3E9FF', '#faf7f7'],
      },
      isNew,
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal chat-bg-editor-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{isNew ? 'خلفية جديدة' : 'تعديل الخلفية'}</h3>
          <button type="button" className="action-icon" onClick={onClose} aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body chat-bg-editor-body">
          <div className="room-decor-editor-preview room-decor-preview-background chat-bg-editor-preview">
            {draft.imageUrl ? (
              <img src={draft.imageUrl} alt="" />
            ) : (
              <div
                style={{
                  ...gradientStyle({
                    ...draft,
                    colors: colorsText.split(/[,،\n]+/).map((c) => c.trim()).filter(Boolean),
                  }),
                  width: '100%',
                  height: '100%',
                }}
              />
            )}
          </div>

          <div className="form-group">
            <label className="form-label">الاسم (يظهر في التطبيق)</label>
            <input
              className="form-input"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="مثال: لافندر"
            />
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">مستوى العلاقة (1–15)</label>
              <input
                type="number"
                min={1}
                max={15}
                className="form-input"
                value={draft.minBondLevel}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, minBondLevel: Number(e.target.value) || 1 }))
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">ترتيب العرض</label>
              <input
                type="number"
                className="form-input"
                value={draft.sort ?? 0}
                onChange={(e) => setDraft((d) => ({ ...d, sort: Number(e.target.value) || 0 }))}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">ألوان التدرّج (مفصولة بفاصلة)</label>
            <input
              className="form-input chat-bg-colors-input"
              value={colorsText}
              onChange={(e) => applyColors(e.target.value)}
              placeholder="#F3E9FF, #FBEFF8, #faf7f7"
              dir="ltr"
            />
            <p className="room-decor-hint">لونان على الأقل — أو ارفع صورة بدلاً من التدرّج</p>
          </div>

          <div className="form-group">
            <label className="form-label">اتجاه التدرّج</label>
            <div className="chat-bg-gradient-grid">
              <div>
                <span className="chat-bg-mini-label">بداية X</span>
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  max={1}
                  className="form-input"
                  value={draft.start?.x ?? 0}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      start: { x: Number(e.target.value), y: d.start?.y ?? 0 },
                    }))
                  }
                />
              </div>
              <div>
                <span className="chat-bg-mini-label">بداية Y</span>
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  max={1}
                  className="form-input"
                  value={draft.start?.y ?? 0}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      start: { x: d.start?.x ?? 0, y: Number(e.target.value) },
                    }))
                  }
                />
              </div>
              <div>
                <span className="chat-bg-mini-label">نهاية X</span>
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  max={1}
                  className="form-input"
                  value={draft.end?.x ?? 0}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      end: { x: Number(e.target.value), y: d.end?.y ?? 1 },
                    }))
                  }
                />
              </div>
              <div>
                <span className="chat-bg-mini-label">نهاية Y</span>
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  max={1}
                  className="form-input"
                  value={draft.end?.y ?? 1}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      end: { x: d.end?.x ?? 0, y: Number(e.target.value) },
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">صورة خلفية (اختياري)</label>
            <p className="room-decor-hint">PNG أو JPG — تُستخدم بدل التدرّج إذا رُفعت</p>
            <div className="chat-bg-upload-row">
              <label className="btn btn-secondary">
                <Upload size={16} />
                {uploading ? 'جاري الرفع…' : 'رفع صورة'}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                  }}
                />
              </label>
              {draft.imageUrl ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setDraft((d) => ({ ...d, imageUrl: '' }))}
                >
                  إزالة الصورة
                </button>
              ) : null}
            </div>
          </div>

          <div className="chat-bg-checks">
            <label className="room-decor-check">
              <input
                type="checkbox"
                checked={draft.enabled !== false}
                onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
              />
              <span>مفعّلة في التطبيق</span>
            </label>

            <label className="room-decor-check">
              <input
                type="checkbox"
                checked={draft.isDefault === true}
                onChange={(e) => setDraft((d) => ({ ...d, isDefault: e.target.checked }))}
              />
              <span>الخلفية الافتراضية</span>
            </label>
          </div>

          {err ? <p className="room-decor-error">{err}</p> : null}
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
