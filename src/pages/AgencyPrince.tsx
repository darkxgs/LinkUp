import { useEffect, useRef, useState } from 'react';
import { Crown, Save, Cloud, RefreshCw, UserPlus, Trash2, Upload, Loader2 } from 'lucide-react';
import { Loading } from '@/components/Common';
import {
  getAgencyPrinceConfig,
  saveAgencyPrinceConfig,
  DEFAULT_AGENCY_PRINCE_CONFIG,
  grantAgencyPrinceManual,
  lookupAgencyPrinceGrantCandidate,
  revokeAgencyPrinceFromUser,
  refreshMonthlyAgencyPrince,
  logAdminAction,
  formatNumber,
  type ConfigAgencyPrince,
  type AgencyPrinceGrantPreview,
} from '@/services/admin';
import { uploadAgencyPrinceAsset } from '@/lib/storage';

type Tab = 'general' | 'assets' | 'holder';

export default function AgencyPrincePage() {
  const [config, setConfig] = useState<ConfigAgencyPrince>(DEFAULT_AGENCY_PRINCE_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>('general');
  const [grantUid, setGrantUid] = useState('');
  const [grantPreview, setGrantPreview] = useState<AgencyPrinceGrantPreview | null>(null);
  const [grantPreviewError, setGrantPreviewError] = useState('');
  const [working, setWorking] = useState(false);

  const load = async () => {
    setLoading(true);
    let data = await getAgencyPrinceConfig();
    if (!data) {
      data = DEFAULT_AGENCY_PRINCE_CONFIG;
      await saveAgencyPrinceConfig(data);
    }
    setConfig(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const patch = (p: Partial<ConfigAgencyPrince>) => setConfig((c) => ({ ...c, ...p }));

  const handleSave = async () => {
    setSaving(true);
    await saveAgencyPrinceConfig(config);
    await logAdminAction('حفظ أمير الوكلاء', config.titleAr);
    setSaving(false);
    alert('تم الحفظ — يظهر فوراً في التطبيق');
  };

  const handleRefreshMonthly = async () => {
    if (!confirm('حساب أكبر وكالة لهذا الشهر ومنح أمير الوكلاء لمالكها؟')) return;
    setWorking(true);
    try {
      const holder = await refreshMonthlyAgencyPrince();
      if (!holder) {
        alert('لا توجد أرباح شهرية كافية لأي وكالة بعد.');
      } else {
        setConfig((c) => ({ ...c, currentHolder: holder }));
        alert(`تم!\n${holder.agencyName} — ${formatNumber(holder.monthlyTotal)} لؤلؤ`);
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'فشل التحديث');
    } finally {
      setWorking(false);
    }
  };

  const handleLookupGrant = async () => {
    const raw = grantUid.trim();
    if (!raw) {
      alert('أدخل UID أو رقم الحساب');
      return;
    }
    setWorking(true);
    setGrantPreview(null);
    setGrantPreviewError('');
    try {
      const preview = await lookupAgencyPrinceGrantCandidate(raw);
      setGrantPreview(preview);
      setGrantUid(preview.uid);
    } catch (e: unknown) {
      setGrantPreviewError(e instanceof Error ? e.message : 'فشل التحقق');
    } finally {
      setWorking(false);
    }
  };

  const handleManualGrant = async () => {
    const raw = grantUid.trim();
    if (!raw) {
      alert('أدخل معرّف المستخدم (UID أو رقم الحساب)');
      return;
    }
    setWorking(true);
    try {
      const holder = await grantAgencyPrinceManual(raw, config);
      const next = { ...config, currentHolder: holder };
      await saveAgencyPrinceConfig(next);
      setConfig(next);
      setGrantPreview(null);
      setGrantPreviewError('');
      await logAdminAction('منح أمير الوكلاء', `${holder.agencyName} (${holder.uid})`);
      alert(`تم منح أمير الوكلاء لـ ${holder.ownerName || holder.uid}\nالوكالة: ${holder.agencyName}`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'فشل المنح');
    } finally {
      setWorking(false);
    }
  };

  const handleRevoke = async () => {
    const uid = config.currentHolder?.uid ?? grantUid.trim();
    if (!uid || !confirm('سحب وسام أمير الوكلاء من هذا المستخدم؟')) return;
    setWorking(true);
    try {
      await revokeAgencyPrinceFromUser(uid);
      const next = { ...config, currentHolder: null };
      await saveAgencyPrinceConfig(next);
      setConfig(next);
      alert('تم السحب');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'فشل السحب');
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <Loading />;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'general', label: 'عام' },
    { id: 'assets', label: 'الشارات والدخولية' },
    { id: 'holder', label: 'الحامل والمنح' },
  ];

  return (
    <div className="page-container">
      <div className="filters-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success)', fontSize: 13, fontWeight: 600 }}>
          <Cloud size={16} /> مرتبط بالتطبيق — يظهر لمديري الوكالات فقط
        </div>
        <button className="btn btn-primary" style={{ marginRight: 'auto' }} onClick={handleSave} disabled={saving}>
          <Save size={16} /> {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </button>
        <button className="btn btn-secondary" onClick={handleRefreshMonthly} disabled={working}>
          {working ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
          تحديث التوب الشهري
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {tabs.map((t) => (
          <button key={t.id} className={`btn ${tab === t.id ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(t.id)}>
            <Crown size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <div className="card" style={{ padding: 20, display: 'grid', gap: 12, maxWidth: 720 }}>
          <label><input type="checkbox" checked={config.enabled} onChange={(e) => patch({ enabled: e.target.checked })} /> مفعّل في التطبيق</label>
          <label><input type="checkbox" checked={config.autoAssignMonthly} onChange={(e) => patch({ autoAssignMonthly: e.target.checked })} /> تحديث تلقائي شهري (زر التحديث)</label>
          <div className="form-row">
            <label className="form-label">العنوان (عربي)
              <input className="form-input" value={config.titleAr} onChange={(e) => patch({ titleAr: e.target.value })} />
            </label>
            <label className="form-label">العنوان (إنجليزي)
              <input className="form-input" value={config.titleEn} onChange={(e) => patch({ titleEn: e.target.value })} />
            </label>
          </div>
          <label className="form-label">الوصف (عربي)
            <input className="form-input" value={config.subtitleAr} onChange={(e) => patch({ subtitleAr: e.target.value })} />
          </label>
          <label className="form-label">لون التمييز
            <input className="form-input" value={config.accentColor} onChange={(e) => patch({ accentColor: e.target.value })} />
          </label>
          <div>
            <strong>قواعد البرنامج (عربي)</strong>
            {config.rulesAr.map((line, i) => (
              <input key={i} className="form-input" style={{ marginTop: 6 }} value={line}
                onChange={(e) => {
                  const rulesAr = [...config.rulesAr];
                  rulesAr[i] = e.target.value;
                  patch({ rulesAr });
                }} />
            ))}
          </div>
        </div>
      )}

      {tab === 'assets' && (
        <div className="card" style={{ padding: 20, display: 'grid', gap: 16, maxWidth: 720 }}>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
            تُمنح هذه الامتيازات تلقائياً لأمير الوكالة الحالي وتُفعّل عنده في التطبيق (دخولية، إطار، فقاعة دردشة، وسام).
          </p>
          <AssetRow label="الرمز / شارة الوسام (تظهر في الملف الشخصي)" url={config.badgeImageUrl} kind="badge" onUploaded={(url) => patch({ badgeImageUrl: url })} />
          <AssetRow label="تاج الأمير" url={config.crownImageUrl} kind="crown" onUploaded={(url) => patch({ crownImageUrl: url })} />
          <AssetRow label="إطار الصورة الشخصية (PNG/GIF شفاف)" url={config.frameImageUrl} kind="frame" onUploaded={(url) => patch({ frameImageUrl: url })} />
          <AssetRow label="فقاعة الدردشة (Bubble — PNG)" url={config.bubbleImageUrl} kind="bubble" onUploaded={(url) => patch({ bubbleImageUrl: url })} />
          <AssetRow label="فيديو الدخولية الرئيسي (WebM / MP4 / MOV)" url={config.entryVideoUrl} kind="entry-video" onUploaded={(url) => patch({ entryVideoUrl: url })} accept="video/mp4,video/quicktime,video/webm,video/x-m4v" />
          <AssetRow label="فيديو الدخولية لنظام iOS (MP4 / MOV)" url={config.entryVideoUrlMp4} kind="entry-video-ios" onUploaded={(url) => patch({ entryVideoUrlMp4: url })} accept="video/mp4,video/quicktime,video/x-m4v" />
          <AssetRow label="صورة الدخولية الثابتة (بطاقة الترحيب)" url={config.entryImageUrl} kind="entry" onUploaded={(url) => patch({ entryImageUrl: url })} />
        </div>
      )}

      {tab === 'holder' && (
        <div className="card" style={{ padding: 20, display: 'grid', gap: 14, maxWidth: 720 }}>
          {config.currentHolder ? (
            <div style={{ padding: 14, background: 'var(--bg-secondary)', borderRadius: 10 }}>
              <strong>الحامل الحالي — {config.currentHolder.monthKey}</strong>
              <p style={{ margin: '8px 0 0', fontSize: 13 }}>
                {config.currentHolder.agencyName} ({config.currentHolder.ownerName})<br />
                UID: {config.currentHolder.uid}<br />
                أرباح الشهر: {formatNumber(config.currentHolder.monthlyTotal)} لؤلؤ
              </p>
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={handleRevoke} disabled={working}>
                <Trash2 size={14} /> سحب الوسام
              </button>
            </div>
          ) : (
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>لا يوجد حامل حالياً — استخدم التحديث الشهري أو المنح اليدوي.</p>
          )}

          <h4 style={{ margin: '8px 0 0' }}>منح يدوي</h4>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
            أدخل UID أو رقم الحساب (8 أرقام) — يُتحقق تلقائياً أن المستخدم مدير وكالة (مالك أو وكيل).
          </p>
          <label className="form-label">معرّف المستخدم (UID أو رقم الحساب)
            <input
              className="form-input"
              value={grantUid}
              onChange={(e) => {
                setGrantUid(e.target.value);
                setGrantPreview(null);
                setGrantPreviewError('');
              }}
              placeholder="uid أو 12345678"
            />
          </label>
          <button className="btn btn-ghost" onClick={handleLookupGrant} disabled={working || !grantUid.trim()}>
            {working ? <Loader2 size={16} className="spin" /> : <UserPlus size={16} />}
            تحقق من المستخدم
          </button>

          {grantPreviewError ? (
            <p style={{ margin: 0, color: 'var(--danger)', fontSize: 13 }}>{grantPreviewError}</p>
          ) : null}

          {grantPreview ? (
            <div style={{ padding: 12, background: 'rgba(16, 185, 129, 0.08)', borderRadius: 10, fontSize: 13 }}>
              <strong style={{ color: 'var(--success)' }}>✓ مدير وكالة — جاهز للمنح</strong>
              <p style={{ margin: '8px 0 0' }}>
                {grantPreview.displayName}
                {grantPreview.publicAccountId ? ` (#${grantPreview.publicAccountId})` : ''}
                <br />
                الوكالة: {grantPreview.agencyName}
                <br />
                الدور: {grantPreview.isOwner ? 'مالك وكالة' : grantPreview.isAgent ? 'وكيل' : grantPreview.agencyRole}
                <br />
                UID: {grantPreview.uid}
              </p>
            </div>
          ) : null}

          <button className="btn btn-secondary" onClick={handleManualGrant} disabled={working || !grantUid.trim()}>
            <UserPlus size={16} /> منح أمير الوكلاء
          </button>
        </div>
      )}
    </div>
  );
}

function AssetRow({
  label, url, kind, onUploaded, accept = 'image/png,image/jpeg,image/webp,image/gif',
}: {
  label: string;
  url?: string;
  kind: 'badge' | 'crown' | 'entry' | 'entry-animation' | 'entry-video' | 'entry-video-ios' | 'frame' | 'bubble';
  onUploaded: (url: string) => void;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');
  const isVideo = !!url && /\.(mp4|mov|webm|m4v)($|\?|#)/i.test(url);

  return (
    <div>
      <label className="form-label">{label}</label>
      {url ? (
        isVideo
          ? <video src={url} controls style={{ width: 120, height: 75, objectFit: 'contain', marginBottom: 8, display: 'block', borderRadius: 8, background: '#000' }} />
          : <img src={url} alt="" style={{ width: 72, height: 72, objectFit: 'contain', marginBottom: 8, display: 'block' }} />
      ) : null}
      <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setUploading(true);
          setStatus('جارٍ التحضير…');
          try {
            const uploadedUrl = await uploadAgencyPrinceAsset(f, kind, ({ stage, ratio }) => {
              if (stage === 'load') setStatus('تحضير الضاغط…');
              else if (stage === 'transcode') setStatus(`جارٍ الضغط ${Math.round(ratio * 100)}%`);
              else setStatus('جارٍ الرفع…');
            });
            onUploaded(uploadedUrl);
          } catch (err: unknown) {
            alert(err instanceof Error ? err.message : 'فشل الرفع');
          } finally {
            setUploading(false);
            setStatus('');
          }
          e.target.value = '';
        }} />
      <button type="button" className="btn btn-secondary btn-sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
        {uploading ? <Loader2 size={14} className="spin" /> : <Upload size={14} />} {uploading ? (status || 'رفع') : 'رفع'}
      </button>
      <input className="form-input" style={{ marginTop: 8 }} value={url ?? ''} placeholder="أو الصق رابطاً"
        onChange={(e) => onUploaded(e.target.value.trim())} />
    </div>
  );
}
