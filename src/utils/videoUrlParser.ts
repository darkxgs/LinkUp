/**
 * Video URL Parser
 * يحدّد نوع الفيديو من URL ويُخرج البيانات اللازمة للتشغيل
 */

export type VideoSourceType = 'mp4' | 'hls' | 'youtube' | 'unknown';

export interface ParsedVideoSource {
  type: VideoSourceType;
  url: string; // URL أصلي
  playableUrl: string; // URL جاهز للتشغيل
  youtubeId?: string; // إذا كان YouTube
  isValid: boolean;
  error?: string;
}

/**
 * استخراج معرّف YouTube من URL متعدّد الأشكال
 *  - https://youtube.com/watch?v=ID
 *  - https://youtu.be/ID
 *  - https://youtube.com/embed/ID
 *  - https://youtube.com/shorts/ID
 *  - https://m.youtube.com/watch?v=ID
 */
export const extractYouTubeId = (url: string): string | null => {
  if (!url) return null;
  try {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/v\/|m\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/, // مجرّد ID
    ];
    for (const re of patterns) {
      const m = url.match(re);
      if (m && m[1]) return m[1];
    }
  } catch {
    // ignore
  }
  return null;
};

/**
 * يحدّد إذا كان URL يُشير لـ HLS stream
 */
export const isHLS = (url: string): boolean => {
  if (!url) return false;
  return /\.m3u8($|\?)/i.test(url);
};

/**
 * يحدّد إذا كان URL يُشير لـ MP4 (أو صيغ مشابهة قابلة للتشغيل عبر expo-video)
 */
export const isDirectVideo = (url: string): boolean => {
  if (!url) return false;
  return /\.(mp4|m4v|mov|webm)($|\?)/i.test(url);
};

/**
 * يحلّل URL ويُخرج المصدر القابل للتشغيل
 */
export const parseVideoUrl = (raw: string): ParsedVideoSource => {
  const url = raw.trim();

  if (!url) {
    return {
      type: 'unknown',
      url: '',
      playableUrl: '',
      isValid: false,
      error: 'الرابط فارغ',
    };
  }

  // YouTube؟
  const ytId = extractYouTubeId(url);
  if (ytId) {
    return {
      type: 'youtube',
      url,
      playableUrl: `https://www.youtube.com/watch?v=${ytId}`,
      youtubeId: ytId,
      isValid: true,
    };
  }

  // HLS؟
  if (isHLS(url)) {
    if (!url.startsWith('http')) {
      return { type: 'unknown', url, playableUrl: url, isValid: false, error: 'الرابط يجب أن يبدأ بـ https://' };
    }
    return {
      type: 'hls',
      url,
      playableUrl: url,
      isValid: true,
    };
  }

  // MP4 / video مباشر؟
  if (isDirectVideo(url) || url.startsWith('file://') || url.startsWith('content://')) {
    return {
      type: 'mp4',
      url,
      playableUrl: url,
      isValid: true,
    };
  }

  // غير معروف لكن http(s)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // نحاول كـ mp4 على أمل العمل
    return {
      type: 'mp4',
      url,
      playableUrl: url,
      isValid: true,
    };
  }

  return {
    type: 'unknown',
    url,
    playableUrl: url,
    isValid: false,
    error: 'صيغة الرابط غير مدعومة. الصيغ المدعومة: YouTube, MP4, HLS (.m3u8)',
  };
};

/**
 * أمثلة على الـ URLs المدعومة (للعرض في الـ UI)
 */
export const VIDEO_EXAMPLES = [
  { type: 'YouTube', example: 'https://youtu.be/dQw4w9WgXcQ' },
  { type: 'MP4', example: 'https://example.com/video.mp4' },
  { type: 'HLS', example: 'https://example.com/stream.m3u8' },
];
