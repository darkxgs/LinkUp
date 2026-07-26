import { useEffect, useState } from 'react';
import { Download, Sparkles } from 'lucide-react';
import { v2 } from '@/lib/v2Api';
import { BrandLogo } from '@/components/BrandLogo';
import { DEFAULT_APP_RELEASE, type ConfigAppRelease } from '@/services/admin';

function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return '';
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

export default function LandingPage() {
  const [release, setRelease] = useState<ConfigAppRelease>(DEFAULT_APP_RELEASE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    // A PUBLIC endpoint: this page is open to visitors, so it must not need the
    // admin token. `/app/release` serves the allow-listed release fields only.
    v2.get<Partial<ConfigAppRelease>>('/app/release')
      .then((data) => {
        if (!alive) return;
        if (data) setRelease({ ...DEFAULT_APP_RELEASE, ...data });
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const downloadUrl = release.downloadUrl?.trim() ?? '';
  const ready = isValidDownloadUrl(downloadUrl);
  const notes = release.releaseNotesAr?.trim() || release.releaseNotesEn?.trim();

  const handleDownload = () => {
    if (!ready) return;
    window.open(downloadUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="landing-page">
      <div className="landing-page-bg" />
      <div className="landing-page-orb landing-page-orb-a" />
      <div className="landing-page-orb landing-page-orb-b" />

      <main className="landing-page-card">
        <div className="landing-page-logo-ring">
          <BrandLogo size={88} className="landing-page-logo" />
        </div>

        <p className="landing-page-badge">
          <Sparkles size={14} /> نسخة تجريبية · LinkUp
        </p>

        <h1 className="landing-page-title">حمّل تطبيق LinkUp</h1>
        <p className="landing-page-desc">
          بث صوتي، غرف حية، ودردشة — جرّب أحدث نسخة Android قبل الإطلاق الرسمي.
        </p>

        {loading ? (
          <p className="landing-page-muted">جاري التحميل...</p>
        ) : ready ? (
          <>
            <div className="landing-page-meta">
              <span>الإصدار {release.versionName}</span>
              <span>·</span>
              <span>build {release.versionCode}</span>
              {release.fileSizeBytes ? (
                <>
                  <span>·</span>
                  <span>{formatBytes(release.fileSizeBytes)}</span>
                </>
              ) : null}
            </div>

            {notes ? (
              <div className="landing-page-notes">
                <h2>ما الجديد</h2>
                <p>{release.releaseNotesAr || release.releaseNotesEn}</p>
              </div>
            ) : null}

            <button type="button" className="landing-page-download" onClick={handleDownload}>
              <Download size={20} />
              تحميل APK للأندرويد
            </button>

            <p className="landing-page-hint">
              بعد التحميل، فعّل «التثبيت من مصادر غير معروفة» ثم ثبّت التطبيق.
            </p>
          </>
        ) : (
          <div className="landing-page-empty">
            <p>لا يوجد إصدار منشور حالياً.</p>
            <p className="landing-page-muted">ارجع لاحقاً أو تواصل مع فريق LinkUp.</p>
          </div>
        )}
      </main>

      <footer className="landing-page-footer">© LinkUp — جميع الحقوق محفوظة</footer>
    </div>
  );
}
