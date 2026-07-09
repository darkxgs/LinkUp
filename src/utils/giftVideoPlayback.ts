import { Platform } from 'react-native';

export function isWebmVideoUrl(url?: string | null): boolean {
  if (!url?.trim()) return false;
  return /\.webm($|\?|#)/i.test(url.trim());
}

function isMp4CompatibleUrl(url?: string | null): boolean {
  if (!url?.trim()) return false;
  return /\.(mp4|m4v|mov)($|\?|#)/i.test(url.trim());
}

/**
 * روابط التشغيل حسب المنصة — iOS لا يُضاف له WebM أبداً.
 */
export function getGiftVideoPlaybackCandidates(
  videoUrl?: string,
  videoUrlMp4?: string,
): string[] {
  const primary = videoUrl?.trim() ?? '';
  const fallback = videoUrlMp4?.trim() ?? '';
  const out: string[] = [];

  if (Platform.OS === 'ios') {
    if (isWebmVideoUrl(primary)) {
      if (fallback) out.push(fallback);
      else if (isMp4CompatibleUrl(primary)) out.push(primary);
      return out;
    }
    if (primary) out.push(primary);
    if (fallback && fallback !== primary) out.push(fallback);
    return out;
  }

  if (primary) out.push(primary);
  if (fallback && fallback !== primary) out.push(fallback);
  return out;
}

export function pickGiftVideoPlaybackUrl(
  videoUrl?: string,
  videoUrlMp4?: string,
): string {
  return getGiftVideoPlaybackCandidates(videoUrl, videoUrlMp4)[0] ?? '';
}

export function canPlayGiftVideoOnDevice(
  videoUrl?: string,
  videoUrlMp4?: string,
): boolean {
  return getGiftVideoPlaybackCandidates(videoUrl, videoUrlMp4).length > 0;
}

export function giftVideoUnsupportedReason(
  videoUrl?: string,
  videoUrlMp4?: string,
): string | null {
  if (!videoUrl?.trim()) return null;
  if (Platform.OS === 'ios' && isWebmVideoUrl(videoUrl) && !videoUrlMp4?.trim()) {
    return 'WebM غير مدعوم على iOS — ارفع نسخة MP4 من لوحة التحكم';
  }
  if (!canPlayGiftVideoOnDevice(videoUrl, videoUrlMp4)) {
    return 'صيغة الفيديو غير مدعومة على هذا الجهاز';
  }
  return null;
}
