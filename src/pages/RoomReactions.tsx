/**
 * لوحة التحكم — رموز الروم (تصنيفات + صور/GIF)
 * تُحفظ في config/roomReactions وتظهر في لوحة الإيموجي داخل الغرفة.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pencil, Trash2, Upload, X, Cloud, Smile, ImageIcon, FolderPlus,
} from 'lucide-react';
import { Loading, Empty, Badge } from '@/components/Common';
import {
  getRoomReactionsConfig,
  saveRoomReactionsConfig,
  logAdminAction,
  type ConfigRoomReactionPack,
  type ConfigRoomReactionItem,
  type ConfigRoomReactions,
} from '@/services/admin';
import { uploadRoomReactionAsset, uploadRoomReactionPackIcon } from '@/lib/storage';

function newReactionItemId(): string {
  return `img_${Date.now()}`;
}

function slugId(name: string): string {
  const base = name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^\w\u0600-\u06FF-]/g, '');
  return base || `pack_${Date.now()}`;
}

export default function RoomReactionsPage() {
  const [config, setConfig] = useState<ConfigRoomReactions>({ packs: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activePackId, setActivePackId] = useState('');
  const [editingPack, setEditingPack] = useState<ConfigRoomReactionPack | null>(null);
  const [editingItem, setEditingItem] = useState<ConfigRoomReactionItem | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState('');
  const bulkInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const data = await getRoomReactionsConfig();
    const packs = data.packs ?? [];
    setConfig({ packs });
    setActivePackId((prev) => {
      if (prev && packs.some((p) => p.id === prev)) return prev;
      return packs[0]?.id ?? '';
    });
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const packs = config.packs ?? [];

  const enabledPacks = useMemo(
    () => packs.filter((p) => p.enabled !== false),
    [packs],
  );

  const activePack = useMemo(
    () => packs.find((p) => p.id === activePackId) ?? packs[0],
    [packs, activePackId],
  );

  const totalItems = packs.reduce((n, p) => n + (p.items?.length ?? 0), 0);
  const enabledItems = packs.reduce(
    (n, p) => n + (p.items ?? []).filter((i) => i.enabled !== false).length,
    0,
  );

  const persist = async (next: ConfigRoomReactions, logLabel?: string) => {
    const normalized = { packs: next.packs ?? [] };
    setSaving(true);
    setConfig(normalized);
    await saveRoomReactionsConfig(normalized);
    if (logLabel) await logAdminAction('حفظ رموز الروم', logLabel);
    setSaving(false);
  };

  const savePack = async (pack: ConfigRoomReactionPack, isNew: boolean) => {
    const nextPacks = isNew
      ? [...packs, { ...pack, items: pack.items ?? [] }]
      : packs.map((p) => (p.id === pack.id ? { ...pack, items: pack.items ?? p.items ?? [] } : p));
    const next = { packs: nextPacks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) };
    await persist(next, isNew ? `تصنيف: ${pack.nameAr}` : `تعديل: ${pack.nameAr}`);
    setActivePackId(pack.id);
    setEditingPack(null);
  };

  const deletePack = async (pack: ConfigRoomReactionPack) => {
    if (!confirm(`حذف التصنيف "${pack.nameAr}" وجميع صوره (${pack.items.length})؟`)) return;
    const next = { packs: packs.filter((p) => p.id !== pack.id) };
    await persist(next, `حذف تصنيف: ${pack.nameAr}`);
    if (activePackId === pack.id) {
      setActivePackId(next.packs[0]?.id ?? '');
    }
  };

  const saveItem = async (packId: string, item: ConfigRoomReactionItem, isNew: boolean) => {
    const nextPacks = packs.map((pack) => {
      if (pack.id !== packId) return pack;
      const items = isNew
        ? [...(pack.items ?? []), item]
        : (pack.items ?? []).map((x) => (x.id === item.id ? item : x));
      return {
        ...pack,
        items: items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      };
    });
    await persist({ packs: nextPacks }, isNew ? `صورة: ${item.id}` : `تعديل صورة: ${item.id}`);
    setEditingItem(null);
  };

  const deleteItem = async (packId: string, item: ConfigRoomReactionItem) => {
    if (!confirm(`حذف الصورة "${item.id}"؟`)) return;
    const nextPacks = packs.map((pack) =>
      pack.id === packId ? { ...pack, items: (pack.items ?? []).filter((x) => x.id !== item.id) } : pack,
    );
    await persist({ packs: nextPacks }, `حذف صورة: ${item.id}`);
  };

  const handleBulkUpload = async (fileList: FileList | null) => {
    if (!activePack || !fileList?.length || bulkUploading) return;
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/') || /\.(gif|png|jpe?g|webp|svga|json)$/i.test(f.name));
    if (!files.length) {
      alert('لم يُعثر على ملصقات أو صور صالحة (PNG, JPG, WebP, GIF, SVGA, JSON)');
      return;
    }

    setBulkUploading(true);
    const startOrder = (activePack.items ?? []).length;
    const newItems: ConfigRoomReactionItem[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        setBulkProgress(`${i + 1} / ${files.length}`);
        const itemId = `img_${Date.now()}_${i}`;
        const url = await uploadRoomReactionAsset(file, activePack.id, itemId);
        newItems.push({
          id: itemId,
          imageUrl: url,
          enabled: true,
          order: startOrder + i,
        });
      }

      const nextPacks = packs.map((pack) =>
        pack.id === activePack.id
          ? {
              ...pack,
              items: [...(pack.items ?? []), ...newItems].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
            }
          : pack,
      );
      await persist({ packs: nextPacks }, `رفع ${newItems.length} صورة · ${activePack.nameAr}`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'فشل رفع بعض الصور');
    } finally {
      setBulkUploading(false);
      setBulkProgress('');
      if (bulkInputRef.current) bulkInputRef.current.value = '';
    }
  };

  const openBulkPicker = () => {
    if (!bulkUploading) bulkInputRef.current?.click();
  };

  const bulkUploadButton = activePack ? (
    <button
      type="button"
      className="btn btn-primary"
      disabled={bulkUploading}
      style={{ cursor: bulkUploading ? 'wait' : 'pointer' }}
      onClick={openBulkPicker}
    >
      <Upload size={18} />
      {bulkUploading ? `جاري الرفع… ${bulkProgress}` : 'رفع صور متعددة'}
    </button>
  ) : null;

  if (loading) return <Loading />;

  return (
    <div className="page-container room-decor-page">
      <div className="agency-page-header">
        <div>
          <h1>
            <Smile size={26} style={{ verticalAlign: 'middle', marginLeft: 8, color: 'var(--brand-primary)' }} />
            الملصقات والرموز التعبيرية المتحركة (Stickers & Reactions)
          </h1>
          <p>
            أضف تصنيفات (مثل: تعبيرات متحركة، حيوانات، ورود…) وارفع ملفات SVGA أو Lottie JSON أو GIF أو PNG/WebP.
            تظهر فوراً في لوحة الملصقات والإيموجي داخل الغرف الصوتية وفي الشات.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              setEditingPack({
                id: '',
                nameAr: '',
                nameEn: '',
                icon: '✨',
                iconUrl: '',
                enabled: true,
                order: packs.length,
                items: [],
              })
            }
          >
            <FolderPlus size={18} />
            تصنيف جديد
          </button>
          {bulkUploadButton}
        </div>
      </div>

      <div className="filters-bar" style={{ marginBottom: 16 }}>
        <div className="config-sync-badge">
          <Cloud size={16} /> config/roomReactions — يظهر فوراً في التطبيق
        </div>
        {saving ? (
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>جاري الحفظ…</span>
        ) : null}
      </div>

      <div className="room-decor-stats">
        <div className="room-decor-stat">
          <div className="room-decor-stat-icon" style={{ background: 'rgba(210,30,42,0.12)' }}>
            <FolderPlus size={22} color="#d21e2a" />
          </div>
          <div>
            <span className="room-decor-stat-value">{packs.length}</span>
            <span className="room-decor-stat-label">تصنيف ({enabledPacks.length} مفعّل)</span>
          </div>
        </div>
        <div className="room-decor-stat">
          <div className="room-decor-stat-icon" style={{ background: 'rgba(225,18,18,0.12)' }}>
            <ImageIcon size={22} color="var(--brand-primary)" />
          </div>
          <div>
            <span className="room-decor-stat-value">{totalItems}</span>
            <span className="room-decor-stat-label">صورة ({enabledItems} مفعّلة)</span>
          </div>
        </div>
        <div className="room-decor-stat room-decor-stat-hint">
          الملصقات المتحركة: SVGA, JSON (Lottie), GIF · الملصقات الثابتة: PNG, WebP · حد الرفع 15 ميجابايت
        </div>
      </div>

      {packs.length === 0 ? (
        <Empty text="لا توجد تصنيفات — أنشئ تصنيفاً ثم أضف الصور" />
      ) : (
        <>
          <div className="room-reactions-pack-tabs">
            {packs.map((pack) => {
              const active = pack.id === activePack?.id;
              return (
                <button
                  key={pack.id}
                  type="button"
                  className={`room-reactions-pack-tab ${active ? 'room-reactions-pack-tab-active' : ''}`}
                  onClick={() => setActivePackId(pack.id)}
                >
                  <span className="room-reactions-pack-icon">
                    {pack.iconUrl ? (
                      <img src={pack.iconUrl} alt="" />
                    ) : (
                      pack.icon
                    )}
                  </span>
                  <span>{pack.nameAr}</span>
                  {pack.enabled === false ? <Badge variant="gray">معطّل</Badge> : null}
                  <span className="room-reactions-pack-count">{pack.items.length}</span>
                </button>
              );
            })}
          </div>

          {activePack ? (
            <div className="room-reactions-pack-header">
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>{activePack.nameAr}</h2>
                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  {activePack.nameEn} · {activePack.items.length} صورة
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {bulkUploadButton}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingPack(activePack)}>
                  <Pencil size={16} /> تعديل التصنيف
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-icon-danger"
                  onClick={() => void deletePack(activePack)}
                >
                  <Trash2 size={16} /> حذف
                </button>
              </div>
            </div>
          ) : null}

          {activePack && (activePack.items ?? []).length === 0 ? (
            <Empty text="لا توجد صور — اضغط «رفع صور متعددة» واختر كل الصور دفعة واحدة" />
          ) : activePack ? (
            <div className="room-decor-grid">
              {activePack.items.map((item) => (
                <div
                  key={item.id}
                  className={`card room-decor-card ${item.enabled === false ? 'room-decor-card-off' : ''}`}
                >
                  <div className="room-decor-card-actions">
                    <button type="button" className="btn-icon" onClick={() => setEditingItem(item)} title="تعديل">
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className="btn-icon btn-icon-danger"
                      onClick={() => void deleteItem(activePack.id, item)}
                      title="حذف"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="room-decor-preview room-reactions-preview">
                    <img src={item.imageUrl} alt="" />
                  </div>
                  <div className="room-decor-badges">
                    {item.enabled === false ? <Badge variant="gray">معطّل</Badge> : null}
                    {item.imageUrl.toLowerCase().endsWith('.svga') ? (
                      <Badge variant="gold">SVGA</Badge>
                    ) : item.imageUrl.toLowerCase().endsWith('.json') ? (
                      <Badge variant="green">Lottie</Badge>
                    ) : item.imageUrl.toLowerCase().includes('.gif') ? (
                      <Badge variant="pink">GIF</Badge>
                    ) : (
                      <Badge variant="blue">IMAGE</Badge>
                    )}
                  </div>
                  <div className="room-decor-card-meta" style={{ justifyContent: 'center', marginTop: 8 }}>
                    <span>ترتيب {item.order ?? 0}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}

      {editingPack ? (
        <PackEditor
          pack={editingPack}
          existingIds={packs.map((p) => p.id)}
          onClose={() => setEditingPack(null)}
          onSave={savePack}
        />
      ) : null}

      {editingItem && activePack && editingItem.id ? (
        <ItemEditor
          item={editingItem}
          packId={activePack.id}
          existingIds={(activePack.items ?? []).map((i) => i.id)}
          onClose={() => setEditingItem(null)}
          onSave={(item, isNew) => saveItem(activePack.id, item, isNew)}
        />
      ) : null}

      <input
        ref={bulkInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,.svga,application/json"
        multiple
        hidden
        tabIndex={-1}
        aria-hidden
        onChange={(e) => void handleBulkUpload(e.target.files)}
      />
    </div>
  );
}

function PackEditor({
  pack,
  existingIds,
  onClose,
  onSave,
}: {
  pack: ConfigRoomReactionPack;
  existingIds: string[];
  onClose: () => void;
  onSave: (pack: ConfigRoomReactionPack, isNew: boolean) => void | Promise<void>;
}) {
  const isNew = !pack.id;
  const [draft, setDraft] = useState<ConfigRoomReactionPack>(pack);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  const handleIconUpload = async (file: File) => {
    const nameAr = draft.nameAr.trim();
    if (!nameAr) {
      setErr('أدخل الاسم العربي أولاً');
      return;
    }
    const packId = draft.id || slugId(nameAr);
    setUploading(true);
    setErr('');
    try {
      const url = await uploadRoomReactionPackIcon(file, packId);
      setDraft((d) => ({ ...d, id: d.id || packId, iconUrl: url }));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'فشل رفع الأيقونة');
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setErr('');
    const nameAr = draft.nameAr.trim();
    const nameEn = draft.nameEn.trim();
    if (!nameAr) {
      setErr('الاسم العربي مطلوب');
      return;
    }
    if (!draft.iconUrl?.trim()) {
      setErr('ارفع أيقونة التصنيف أولاً');
      return;
    }
    const id = isNew ? slugId(nameAr) : draft.id;
    if (isNew && existingIds.includes(id)) {
      setErr('المعرّف مستخدم — غيّر الاسم');
      return;
    }
    await onSave(
      {
        ...draft,
        id,
        nameAr,
        nameEn: nameEn || nameAr,
        iconUrl: draft.iconUrl.trim(),
        icon: draft.icon.trim() || '✨',
        items: isNew ? [] : draft.items,
      },
      isNew,
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h3>{isNew ? 'تصنيف جديد' : 'تعديل التصنيف'}</h3>
          <button type="button" className="action-icon" onClick={onClose} aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">الاسم (عربي)</label>
              <input
                className="form-input"
                value={draft.nameAr}
                onChange={(e) => setDraft((d) => ({ ...d, nameAr: e.target.value }))}
                placeholder="مثال: حيوانات"
              />
            </div>
            <div className="form-group">
              <label className="form-label">الاسم (English)</label>
              <input
                className="form-input"
                value={draft.nameEn}
                onChange={(e) => setDraft((d) => ({ ...d, nameEn: e.target.value }))}
                placeholder="Animals"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">أيقونة التبويب</label>
            <p className="room-decor-hint">PNG/WebP/JPG أو GIF — تظهر في التطبيق على تبويب التصنيف</p>
            <div className="room-decor-editor-preview room-reactions-preview room-reactions-icon-preview">
              {draft.iconUrl ? (
                <img src={draft.iconUrl} alt="" />
              ) : (
                <div className="room-reactions-preview-empty">معاينة الأيقونة</div>
              )}
            </div>
            <div className="chat-bg-upload-row" style={{ marginTop: 10 }}>
              <label className="btn btn-secondary">
                <Upload size={16} />
                {uploading ? 'جاري الرفع…' : 'رفع أيقونة'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  hidden
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void handleIconUpload(file);
                  }}
                />
              </label>
              {draft.iconUrl ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setDraft((d) => ({ ...d, iconUrl: '' }))}
                >
                  إزالة الأيقونة
                </button>
              ) : null}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">ترتيب العرض</label>
            <input
              type="number"
              className="form-input"
              value={draft.order ?? 0}
              onChange={(e) => setDraft((d) => ({ ...d, order: Number(e.target.value) || 0 }))}
            />
          </div>
          <label className="room-decor-check">
            <input
              type="checkbox"
              checked={draft.enabled !== false}
              onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
            />
            <span>مفعّل في التطبيق</span>
          </label>
          {err ? <p className="room-decor-error">{err}</p> : null}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>إلغاء</button>
          <button type="button" className="btn btn-primary" onClick={() => void submit()}>حفظ</button>
        </div>
      </div>
    </div>
  );
}

function ItemEditor({
  item,
  packId,
  existingIds,
  onClose,
  onSave,
}: {
  item: ConfigRoomReactionItem;
  packId: string;
  existingIds: string[];
  onClose: () => void;
  onSave: (item: ConfigRoomReactionItem, isNew: boolean) => void | Promise<void>;
}) {
  const isNew = !item.id;
  const [draft, setDraft] = useState<ConfigRoomReactionItem>(item);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  const handleUpload = async (file: File) => {
    setUploading(true);
    setErr('');
    try {
      const itemId = draft.id || newReactionItemId();
      const url = await uploadRoomReactionAsset(file, packId, itemId);
      setDraft((d) => ({ ...d, id: d.id || itemId, imageUrl: url }));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'فشل الرفع');
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setErr('');
    if (!draft.imageUrl.trim()) {
      setErr('ارفع صورة أو GIF أولاً');
      return;
    }
    const id = isNew ? (draft.id || newReactionItemId()) : draft.id;
    if (isNew && existingIds.includes(id)) {
      setErr('المعرّف مستخدم — أعد رفع الصورة');
      return;
    }
    await onSave(
      {
        id,
        imageUrl: draft.imageUrl.trim(),
        enabled: draft.enabled !== false,
        order: Number(draft.order) || 0,
      },
      isNew,
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal chat-bg-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isNew ? 'صورة جديدة' : 'تعديل الصورة'}</h3>
          <button type="button" className="action-icon" onClick={onClose} aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body chat-bg-editor-body">
          <div className="room-decor-editor-preview room-reactions-preview">
            {draft.imageUrl ? (
              <img src={draft.imageUrl} alt="" />
            ) : (
              <div className="room-reactions-preview-empty">معاينة الصورة</div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">رفع GIF أو صورة (PNG/WebP/JPG)</label>
            <p className="room-decor-hint">GIF للصور المتحركة — PNG/WebP للثابتة</p>
            <div className="chat-bg-upload-row">
              <label className="btn btn-secondary">
                <Upload size={16} />
                {uploading ? 'جاري الرفع…' : 'اختر ملف'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,.svga,application/json"
                  hidden
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUpload(f);
                  }}
                />
              </label>
              {draft.imageUrl ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setDraft((d) => ({ ...d, imageUrl: '' }))}
                >
                  إزالة
                </button>
              ) : null}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">ترتيب العرض</label>
            <input
              type="number"
              className="form-input"
              value={draft.order ?? 0}
              onChange={(e) => setDraft((d) => ({ ...d, order: Number(e.target.value) || 0 }))}
            />
          </div>

          <label className="room-decor-check">
            <input
              type="checkbox"
              checked={draft.enabled !== false}
              onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
            />
            <span>مفعّلة في التطبيق</span>
          </label>

          {err ? <p className="room-decor-error">{err}</p> : null}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>إلغاء</button>
          <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={uploading}>
            حفظ ونشر
          </button>
        </div>
      </div>
    </div>
  );
}
