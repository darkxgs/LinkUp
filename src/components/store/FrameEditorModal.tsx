import { useRef, useState } from 'react';
import { Upload, X, Frame, Loader2, Check } from 'lucide-react';
import { uploadDecorAsset } from '@/lib/storage';
import type { DecorBadge, RoomFrame } from '@/services/admin';

const BADGES: { value: DecorBadge; label: string }[] = [
  { value: 'limited', label: 'محدود' },
  { value: 'event', label: 'مناسبة' },
  { value: 'hot', label: 'رائج' },
  { value: 'new', label: 'جديد' },
];

export function FrameEditorModal({
  frame,
  onClose,
  onSave,
}: {
  frame: RoomFrame;
  onClose: () => void;
  onSave: (f: RoomFrame, isNew: boolean) => void | Promise<void>;
}) {
  const isNew = !frame.id;
  const [draft, setDraft] = useState<RoomFrame>(frame);
  const [uploading, setUploading] = useState(false);
  const [uploadOk, setUploadOk] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const id = draft.id || `frame_${Date.now()}`;

  const handleUpload = async (file?: File) => {
    if (!file) return;
    setErr('');
    setUploadOk(false);
    setUploading(true);
    try {
      const url = await uploadDecorAsset(file, 'frames', id);
      setDraft((d) => ({ ...d, id, imageUrl: url }));
      setUploadOk(true);
    } catch (e: unknown) {
      setErr((e as Error)?.message ?? 'فشل الرفع');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const submit = async () => {
    if (!draft.name.trim()) {
      setErr('الاسم مطلوب');
      return;
    }
    if (!draft.imageUrl.trim()) {
      setErr('صورة الإطار مطلوبة — ارفع ملفاً أو الصق رابط الصورة');
      return;
    }
    setErr('');
    await onSave({ ...draft, id }, isNew);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isNew ? 'إطار جديد' : 'تعديل إطار'}</h3>
          <button type="button" className="action-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <div className="room-decor-editor-preview room-decor-preview-frame">
            {draft.imageUrl ? (
              <img src={draft.imageUrl} alt="" />
            ) : (
              <Frame size={40} color="var(--text-muted)" />
            )}
          </div>

          <div className="form-group">
            <label className="form-label">اسم الإطار</label>
            <input
              className="form-input"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="مثال: إطار النمر الذهبي"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">السعر (عملات)</label>
              <input
                className="form-input"
                type="number"
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">الصلاحية (أيام، 0 = دائم)</label>
              <input
                className="form-input"
                type="number"
                value={draft.durationDays ?? 0}
                onChange={(e) => setDraft({ ...draft, durationDays: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">شارة ترويجية</label>
            <select
              className="form-input"
              value={draft.badge ?? ''}
              onChange={(e) =>
                setDraft({ ...draft, badge: (e.target.value || undefined) as DecorBadge | undefined })
              }
            >
              <option value="">بدون شارة</option>
              {BADGES.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>

          <label className="room-decor-check">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
            />
            <span>مفعّل — يظهر في متجر التطبيق</span>
          </label>

          <div className="form-group">
            <label className="form-label">صورة الإطار</label>
            <p className="room-decor-hint">PNG شفاف مفضّل — يُعرض حول مقاعد الغرفة</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <input
                className="form-input"
                style={{ flex: 1 }}
                value={draft.imageUrl}
                onChange={(e) => {
                  setUploadOk(false);
                  setDraft({ ...draft, imageUrl: e.target.value });
                }}
                placeholder="رابط الصورة أو ارفع ملفاً"
              />
              <label className="btn btn-secondary" style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {uploading ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
                رفع
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/*"
                  hidden
                  onChange={(e) => void handleUpload(e.target.files?.[0])}
                />
              </label>
            </div>
            {uploadOk && (
              <p style={{ color: 'var(--success)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Check size={14} /> تم رفع الصورة بنجاح
              </p>
            )}
          </div>

          {err && <p className="room-decor-error">{err}</p>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            إلغاء
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={uploading}>
            حفظ
          </button>
        </div>
      </div>
    </div>
  );
}
