/**
 * ضغط الوسائط في المتصفح قبل الرفع — فيديو / GIF / صور.
 * يعتمد على ffmpeg.wasm (نواة أحادية الخيط لا تتطلب ترويسات COOP/COEP،
 * لذلك لا تكسر تحميل أصول Firebase أو نوافذ تسجيل الدخول).
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// النواة محمّلة محلياً (من public/ffmpeg — نفس الأصل) — أسرع وأكثر موثوقية من CDN ولا تتسبب بتعليق
const BASE = import.meta.env.BASE_URL || '/';
const coreUrl = `${BASE}ffmpeg/ffmpeg-core.js`;
const wasmUrl = `${BASE}ffmpeg/ffmpeg-core.wasm`;

// عتبات: لا نضغط الملفات الصغيرة أصلاً (لا فائدة + إبطاء)
const VIDEO_MIN_BYTES = 3 * 1024 * 1024; // 3MB
const GIF_MIN_BYTES = 1 * 1024 * 1024; // 1MB
const IMAGE_MIN_BYTES = 1.5 * 1024 * 1024; // 1.5MB

// مهلات أمان — إن تجاوزها الضغط نرفع الملف الأصلي بدل التعليق
const LOAD_TIMEOUT_MS = 30_000;
const TRANSCODE_TIMEOUT_MS = 240_000;

export type CompressStage = 'load' | 'transcode' | 'done';
export type CompressProgress = (info: { stage: CompressStage; ratio: number }) => void;

/** خيارات ضغط اختيارية — تسمح بأهداف أخف للأصول الصغيرة مثل صور الهدايا في القائمة */
export interface CompressOptions {
  /** أقصى بُعد للصور الثابتة بالبكسل (افتراضي 1600) */
  maxImageDimension?: number;
  /** جودة WebP للصور 1-100 (افتراضي 82) */
  imageQuality?: number;
  /** عتبة الحجم الأدنى للصور قبل الضغط بالبايت (افتراضي 1.5MB) */
  imageMinBytes?: number;
  /** أقصى بُعد للـ GIF بالبكسل (افتراضي 480) */
  maxGifDimension?: number;
  /** إطارات GIF في الثانية (افتراضي 15) */
  gifFps?: number;
  /** عتبة الحجم الأدنى للـ GIF قبل الضغط بالبايت (افتراضي 1MB) */
  gifMinBytes?: number;
}

class TimeoutError extends Error {}

function withTimeout<T>(p: Promise<T>, ms: number, onTimeout?: () => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      onTimeout?.();
      reject(new TimeoutError(`انتهت المهلة بعد ${Math.round(ms / 1000)} ثانية`));
    }, ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

let ffmpegPromise: Promise<FFmpeg> | null = null;

function resetFFmpeg() {
  ffmpegPromise = null;
}

async function getFFmpeg(onProgress?: CompressProgress): Promise<FFmpeg> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const ffmpeg = new FFmpeg();
      onProgress?.({ stage: 'load', ratio: 0 });
      await withTimeout(
        (async () => {
          await ffmpeg.load({
            coreURL: await toBlobURL(coreUrl, 'text/javascript'),
            wasmURL: await toBlobURL(wasmUrl, 'application/wasm'),
          });
        })(),
        LOAD_TIMEOUT_MS,
        () => { try { ffmpeg.terminate(); } catch { /* noop */ } },
      );
      return ffmpeg;
    })().catch((e) => {
      ffmpegPromise = null; // اسمح بإعادة المحاولة لاحقاً
      throw e;
    });
  }
  return ffmpegPromise;
}

function isVideo(file: File): boolean {
  return file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(file.name);
}
function isGif(file: File): boolean {
  return file.type === 'image/gif' || /\.gif$/i.test(file.name);
}
function isImage(file: File): boolean {
  return file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name);
}

async function runFFmpeg(
  input: File,
  outName: string,
  args: (inName: string, outName: string) => string[],
  outType: string,
  onProgress?: CompressProgress,
): Promise<File> {
  const ffmpeg = await getFFmpeg(onProgress);
  const inName = `in_${Date.now()}.${input.name.split('.').pop() || 'bin'}`;
  const handler = (e: { progress: number }) => {
    const ratio = Math.max(0, Math.min(1, e.progress || 0));
    onProgress?.({ stage: 'transcode', ratio });
  };
  ffmpeg.on('progress', handler);
  try {
    await ffmpeg.writeFile(inName, await fetchFile(input));
    await withTimeout(
      ffmpeg.exec(args(inName, outName)),
      TRANSCODE_TIMEOUT_MS,
      () => { try { ffmpeg.terminate(); } catch { /* noop */ } resetFFmpeg(); },
    );
    const data = (await ffmpeg.readFile(outName)) as Uint8Array;
    await ffmpeg.deleteFile(inName).catch(() => {});
    await ffmpeg.deleteFile(outName).catch(() => {});
    onProgress?.({ stage: 'done', ratio: 1 });
    const blob = new Blob([data as unknown as BlobPart], { type: outType });
    return new File([blob], outName, { type: outType });
  } finally {
    ffmpeg.off('progress', handler);
  }
}

/**
 * يضغط الفيديو/GIF/الصورة إن تجاوز العتبة، وإلا يُعيد الملف كما هو.
 * عند فشل الضغط (مثلاً تعذّر تحميل النواة) يُعيد الملف الأصلي.
 */
export async function compressMedia(
  file: File,
  onProgress?: CompressProgress,
  opts?: CompressOptions,
): Promise<File> {
  try {
    if (isVideo(file)) {
      if (file.size < VIDEO_MIN_BYTES) return file;
      const isWebm = file.type === 'video/webm' || /\.webm$/i.test(file.name);
      if (isWebm) {
        // WebM/VP9 — يحافظ على الشفافية (alpha) المهمة لدخوليات الفيديو
        const out = await runFFmpeg(
          file,
          'compressed.webm',
          (i, o) => [
            '-i', i,
            '-vf', "scale='min(1280,iw)':-2",
            '-c:v', 'libvpx-vp9',
            '-crf', '36',
            '-b:v', '0',
            '-deadline', 'realtime',
            '-cpu-used', '8',
            '-row-mt', '1',
            '-c:a', 'libopus',
            '-b:a', '128k',
            o,
          ],
          'video/webm',
          onProgress,
        );
        return out.size < file.size ? out : file;
      }
      // MP4/MOV — H.264 + AAC، توافق ممتاز مع iOS وحجم أصغر بكثير
      const out = await runFFmpeg(
        file,
        'compressed.mp4',
        (i, o) => [
          '-i', i,
          '-vf', "scale='min(1280,iw)':-2",
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-crf', '28',
          '-pix_fmt', 'yuv420p',
          '-movflags', '+faststart',
          '-c:a', 'aac',
          '-b:a', '128k',
          o,
        ],
        'video/mp4',
        onProgress,
      );
      return out.size < file.size ? out : file;
    }

    if (isGif(file)) {
      const gifMin = opts?.gifMinBytes ?? GIF_MIN_BYTES;
      if (file.size < gifMin) return file;
      const gifDim = opts?.maxGifDimension ?? 480;
      const gifFps = opts?.gifFps ?? 15;
      // إعادة ترميز GIF مع لوحة ألوان محسّنة — يحافظ على الحركة مع تقليل الحجم
      const out = await runFFmpeg(
        file,
        'compressed.gif',
        (i, o) => [
          '-i', i,
          '-vf', `fps=${gifFps},scale='min(${gifDim},iw)':-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer`,
          o,
        ],
        'image/gif',
        onProgress,
      );
      return out.size < file.size ? out : file;
    }

    if (isImage(file)) {
      const imageMin = opts?.imageMinBytes ?? IMAGE_MIN_BYTES;
      if (file.size < imageMin) return file;
      const imageDim = opts?.maxImageDimension ?? 1600;
      const imageQuality = opts?.imageQuality ?? 82;
      // تصغير الأبعاد + WebP بجودة جيدة
      const out = await runFFmpeg(
        file,
        'compressed.webp',
        (i, o) => ['-i', i, '-vf', `scale='min(${imageDim},iw)':-2`, '-quality', String(imageQuality), o],
        'image/webp',
        onProgress,
      );
      return out.size < file.size ? out : file;
    }

    return file;
  } catch (e) {
    console.warn('[compress] فشل الضغط، سيُرفع الملف الأصلي:', e);
    return file;
  }
}
