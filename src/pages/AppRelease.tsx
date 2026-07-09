import { useEffect, useRef, useState } from 'react';
import { Cloud, Download, Save, Smartphone, Upload, ExternalLink, Link2 } from 'lucide-react';
import { Loading } from '@/components/Common';
import { BrandLogo } from '@/components/BrandLogo';
import { uploadApkRelease } from '@/lib/storage';
import {
  getAppReleaseConfig,
  saveAppReleaseConfig,
  DEFAULT_APP_RELEASE,
  logAdminAction,
  type ConfigAppRelease,
} from '@/services/admin';

function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isValidDownloadUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function AppReleasePage() {
  const [config, setConfig] = useState<ConfigAppRelease>(DEFAULT_APP_RELEASE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const landingPreview = `${window.location.origin}/landing`;

  const load = async () => {
    setLoading(true);
    let data = await getAppReleaseConfig();
    if (!data) {
      data = { ...DEFAULT_APP_RELEASE, landingUrl: landingPreview };
      await saveAppReleaseConfig(data);
    } else if (!data.landingUrl) {
      data = { ...data, landingUrl: landingPreview };
    }
    setConfig(data);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const patch = (patch: Partial<ConfigAppRelease>) => {
    setConfig((c) => ({ ...c, ...patch }));
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadApkRelease(file, config.versionName);
      const safeVersion = config.versionName.replace(/[^a-zA-Z0-9._-]/g, '_');
      patch({
        downloadUrl: url,
        storagePath: `config/releases/${safeVersion}/linkup.apk`,
        fileSizeBytes: file.size,
        enabled: true,
        landingUrl: landingPreview,
      });
      alert('تم رفع APK بنجاح — احفظ الإعدادات لتفعيلها في التطبيق');
    } catch (e: unknown) {
      alert((e as Error)?.message ?? 'فشل رفع APK');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const openDownloadLink = () => {
    const url = config.downloadUrl.trim();
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSave = async () => {
    if (config.enabled && !config.downloadUrl.trim()) {
      alert('أدخل رابط التحميل أو ارفع ملف APK قبل التفعيل');
      return;
    }
    if (config.downloadUrl.trim() && !isValidDownloadUrl(config.downloadUrl)) {
      alert('رابط التحميل غير صالح — يجب أن يبدأ بـ http:// أو https://');
      return;
    }
    if (config.versionCode < 1) {
      alert('رقم البناء (versionCode) يجب أن يكون 1 أو أكثر');
      return;
    }
    setSaving(true);
    const trimmedUrl = config.downloadUrl.trim();
    const payload: ConfigAppRelease = {
      ...config,
      downloadUrl: trimmedUrl,
      landingUrl: landingPreview,
      enabled: isValidDownloadUrl(trimmedUrl) ? true : config.enabled,
      updatedAt: Date.now(),
    };
    await saveAppReleaseConfig(payload);
    await logAdminAction(
      'نشر إصدار APK',
      `v${config.versionName} (${config.versionCode})`,
    );
    setConfig(payload);
    setSaving(false);
    alert('تم الحفظ — التطبيق وصفحة التحميل يتحدّثان فوراً');
  };

  if (loading) return <Loading />;

  return (
    <div className="page-container">
      <div className="filters-bar">
        <div className="config-sync-badge">
          <Cloud size={16} /> config/appRelease — التطبيق + /landing
        </div>
        <a
          href="/download"
          target="_blank"
          rel="noreferrer"
          className="btn btn-ghost"
          style={{ marginRight: 'auto' }}
        >
          <ExternalLink size={16} /> معاينة صفحة التحميل
        </a>
        <button className="btn btn-primary" onClick={() => void handleSave()} disabled={saving}>
          <Save size={16} /> {saving ? 'جاري الحفظ...' : 'حفظ ونشر'}
        </button>
      </div>

      <div className="page-header">
        <Smartphone size={28} />
        <div>
          <h1>إصدار التطبيق (APK)</h1>
          <p>أضف رابط تحميل مباشر أو ارفع APK — صفحة /landing والتطبيق يفتحان الرابط عند الضغط على تحميل</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label className="form-check" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => patch({ enabled: e.target.checked })}
            />
            <span>تفعيل التحديث داخل التطبيق (صفحة /landing تظهر عند وجود رابط)</span>
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">اسم الإصدار (versionName)</label>
              <input
                className="form-input"
                placeholder="1.2.0"
                value={config.versionName}
                onChange={(e) => patch({ versionName: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">رقم البناء (versionCode)</label>
              <input
                className="form-input"
                type="number"
                min={1}
                value={config.versionCode}
                onChange={(e) => patch({ versionCode: Math.max(1, parseInt(e.target.value, 10) || 1) })}
              />
            </div>
          </div>

          <div>
            <label className="form-label">أدنى رقم بناء إجباري (minVersionCode)</label>
            <input
              className="form-input"
              type="number"
              min={1}
              value={config.minVersionCode}
              onChange={(e) => patch({ minVersionCode: Math.max(1, parseInt(e.target.value, 10) || 1) })}
            />
            <p className="form-hint">من دون هذا الرقم يُجبر المستخدم على التحديث</p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            <label className="form-check" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={config.promptUpdate}
                onChange={(e) => patch({ promptUpdate: e.target.checked })}
              />
              <span>اقتراح التحديث (يمكن التخطي)</span>
            </label>
            <label className="form-check" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={config.forceUpdate}
                onChange={(e) => patch({ forceUpdate: e.target.checked })}
              />
              <span>تحديث إجباري لكل من دون الإصدار الجديد</span>
            </label>
          </div>

          <div>
            <label className="form-label">
              <Link2 size={14} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 6 }} />
              رابط التحميل المباشر (APK)
            </label>
            <input
              className="form-input"
              type="url"
              dir="ltr"
              placeholder="https://example.com/linkup.apk"
              value={config.downloadUrl}
              onChange={(e) => {
                const url = e.target.value;
                patch({
                  downloadUrl: url,
                  storagePath: undefined,
                  fileSizeBytes: undefined,
                  enabled: isValidDownloadUrl(url) ? true : config.enabled,
                });
              }}
            />
            <p className="form-hint">
              الصق رابط Google Drive أو أي استضافة — عند الضغط على «تحميل APK» ينتقل المستخدم مباشرة لهذا الرابط
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!isValidDownloadUrl(config.downloadUrl)}
                onClick={openDownloadLink}
              >
                <ExternalLink size={16} /> تجربة الرابط
              </button>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <label className="form-label">أو ارفع APK على Storage (اختياري)</label>
            <input
              ref={fileRef}
              type="file"
              accept=".apk,application/vnd.android.package-archive"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUpload(f);
              }}
            />
            <button
              type="button"
              className="btn btn-ghost"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={16} /> {uploading ? 'جاري الرفع...' : 'رفع APK واستبدال الرابط'}
            </button>
            {config.downloadUrl && config.storagePath ? (
              <p className="form-hint" style={{ marginTop: 8 }}>
                مرفوع على Storage — الحجم: {formatBytes(config.fileSizeBytes)}
              </p>
            ) : null}
          </div>

          <div>
            <label className="form-label">ملاحظات الإصدار (عربي)</label>
            <textarea
              className="form-input"
              rows={3}
              value={config.releaseNotesAr}
              onChange={(e) => patch({ releaseNotesAr: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">Release notes (English)</label>
            <textarea
              className="form-input"
              rows={3}
              value={config.releaseNotesEn}
              onChange={(e) => patch({ releaseNotesEn: e.target.value })}
            />
          </div>

          <div>
            <label className="form-label">عنوان شاشة التحديث (عربي)</label>
            <input
              className="form-input"
              value={config.updateTitleAr}
              onChange={(e) => patch({ updateTitleAr: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">نص شاشة التحديث (عربي)</label>
            <textarea
              className="form-input"
              rows={2}
              value={config.updateMessageAr}
              onChange={(e) => patch({ updateMessageAr: e.target.value })}
            />
          </div>
        </div>

        <div className="card landing-preview-card">
          <div className="landing-preview-glow" />
          <BrandLogo size={72} className="landing-preview-logo" />
          <h2 className="landing-preview-title">LinkUp</h2>
          <p className="landing-preview-version">
            {config.enabled ? `v${config.versionName}` : 'غير منشور'}
          </p>
          <p className="landing-preview-sub">
            build {config.versionCode}
            {config.fileSizeBytes ? ` · ${formatBytes(config.fileSizeBytes)}` : ''}
          </p>
          <button
            type="button"
            className="landing-preview-btn"
            disabled={!isValidDownloadUrl(config.downloadUrl)}
            onClick={openDownloadLink}
          >
            <Download size={18} /> تحميل APK
          </button>
          <p className="landing-preview-url">{landingPreview}</p>
        </div>
      </div>
    </div>
  );
}
