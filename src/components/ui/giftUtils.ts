/**
 * مساعدات عرض الهدايا — بدون React (يتجنب الاستيراد الدائري)
 */
export type GiftMediaType = 'static' | 'animated' | 'animated_sound' | 'video';

export type GiftLike = {
  iconName: string;
  iconColor: string;
  imageUrl?: string;
  visualType?: 'icon' | 'image';
  animationUrl?: string;
  giftMediaType?: GiftMediaType;
  soundUrl?: string;
  videoUrl?: string;
  videoUrlMp4?: string;
  videoChromaKey?: 'black' | 'green' | 'none';
  isAnimated?: boolean;
};

export function usesGiftImage(g: GiftLike): boolean {
  return g.visualType === 'image' || Boolean(g.imageUrl?.trim());
}

export type GiftMediaUrlOrder = 'image-first' | 'animation-first';

export function resolveGiftMediaUrl(
  g: GiftLike,
  preferAnimation = false,
  order?: GiftMediaUrlOrder,
): string | null {
  const image = g.imageUrl?.trim() || '';
  const anim = g.animationUrl?.trim() || '';
  const resolvedOrder =
    order ?? (preferAnimation ? 'animation-first' : 'image-first');

  if (resolvedOrder === 'animation-first') {
    return anim || image || null;
  }
  return image || anim || null;
}

/** ترتيب كل المرشّحات للتبديل عند فشل التحميل */
export function giftMediaCandidates(
  g: GiftLike,
  order: GiftMediaUrlOrder = 'image-first',
): string[] {
  const image = g.imageUrl?.trim();
  const anim = g.animationUrl?.trim();
  const video = g.videoUrl?.trim();
  const list =
    order === 'animation-first'
      ? [anim, image, video]
      : [image, anim, video];
  return [...new Set(list.filter((u): u is string => Boolean(u)))];
}

export function inferGiftMediaType(raw: GiftLike): GiftMediaType {
  if (raw.giftMediaType) return raw.giftMediaType;
  if (raw.videoUrl?.trim()) return 'video';
  if (raw.soundUrl?.trim()) return 'animated_sound';
  if (raw.isAnimated || raw.animationUrl?.trim()) return 'animated';
  if (raw.imageUrl?.trim()) return 'static';
  return 'static';
}

export function giftHasSound(g: GiftLike): boolean {
  return inferGiftMediaType(g) === 'animated_sound' && Boolean(g.soundUrl?.trim());
}

export function isAnimatedGiftType(g: GiftLike): boolean {
  const type = inferGiftMediaType(g);
  return type === 'animated' || type === 'animated_sound' || type === 'video';
}

export function giftHasVideo(g: GiftLike): boolean {
  return inferGiftMediaType(g) === 'video' && Boolean(g.videoUrl?.trim());
}

export function giftHasGifAnimation(g: GiftLike): boolean {
  return Boolean(g.animationUrl?.trim());
}

/** صورة ثابتة + GIF منفصل (مثل animated_sound) */
export function giftUsesAnimationOverlay(g: GiftLike): boolean {
  const image = g.imageUrl?.trim();
  const anim = g.animationUrl?.trim();
  return Boolean(image && anim && image !== anim);
}

/** تشغيل GIF في شبكة اختيار الهدايا — عند الاختيار أو إذا لا توجد صورة ثابتة */
export function shouldPlayGiftPickerAnimation(g: GiftLike, selected: boolean): boolean {
  if (!isAnimatedGiftType(g) || !giftHasGifAnimation(g)) return false;
  if (selected) return true;
  return inferGiftMediaType(g) === 'animated' && !g.imageUrl?.trim();
}

/** متطلبات الوسائط حسب نوع الهدية — للوحة التحكم والتطبيق */
export const GIFT_MEDIA_SPECS = {
  static: {
    title: 'صورة ثابتة',
    summary: 'PNG أو JPG للعرض في القائمة والشات',
    requires: ['imageUrl'] as const,
    optional: [] as const,
  },
  animated: {
    title: 'صورة متحركة',
    summary: 'ملف GIF متحرك — يُعرض في القائمة والأنيميشن',
    requires: ['animationUrl'] as const,
    optional: ['imageUrl'] as const,
  },
  animated_sound: {
    title: 'صورة + صوت',
    summary: 'PNG/JPG ثابت + MP3 — يُشغَّل الصوت مع الصورة معاً',
    requires: ['imageUrl', 'soundUrl'] as const,
    optional: ['animationUrl'] as const,
  },
  video: {
    title: 'فيديو',
    summary: 'MP4/MOV — ملء الشاشة مع إزالة الخلفية السوداء تلقائياً',
    requires: ['videoUrl'] as const,
    optional: ['imageUrl', 'videoChromaKey'] as const,
  },
} as const;

export function isGiftMediaComplete(g: GiftLike): boolean {
  const type = inferGiftMediaType(g);
  if (type === 'static') {
    return Boolean(g.imageUrl?.trim()) || g.visualType === 'icon';
  }
  if (type === 'animated') {
    return Boolean(g.animationUrl?.trim());
  }
  if (type === 'video') {
    return Boolean(g.videoUrl?.trim());
  }
  return Boolean(g.imageUrl?.trim()) && Boolean(g.soundUrl?.trim());
}

/** توحيد هدية قادمة من Firestore (لوحة التحكم) */
export function normalizeGiftFromConfig(
  raw: GiftLike & { id: string },
): GiftLike & { id: string; giftMediaType: GiftMediaType } {
  const imageUrl = String(raw.imageUrl ?? '').trim();
  const animationUrl = String(raw.animationUrl ?? '').trim();
  const soundUrl = String(raw.soundUrl ?? '').trim();
  const videoUrl = String(raw.videoUrl ?? '').trim();
  const videoUrlMp4 = String(raw.videoUrlMp4 ?? '').trim();
  const hasMedia = Boolean(imageUrl || animationUrl || videoUrl);
  const giftMediaType = inferGiftMediaType({
    ...raw,
    imageUrl: imageUrl || undefined,
    animationUrl: animationUrl || undefined,
    soundUrl: soundUrl || undefined,
    videoUrl: videoUrl || undefined,
  });

  return {
    ...raw,
    id: raw.id,
    iconName: raw.iconName || 'Gift',
    iconColor: raw.iconColor || '#E11414',
    imageUrl: imageUrl || undefined,
    animationUrl: animationUrl || undefined,
    soundUrl: soundUrl || undefined,
    videoUrl: videoUrl || undefined,
    videoUrlMp4: videoUrlMp4 || undefined,
    giftMediaType,
    isAnimated: giftMediaType !== 'static',
    visualType: hasMedia ? 'image' : (raw.visualType === 'image' ? 'image' : 'icon'),
  };
}

export type GiftAnimationPayload = {
  iconName: string;
  iconColor: string;
  imageUrl?: string;
  animationUrl?: string;
  soundUrl?: string;
  videoUrl?: string;
  videoUrlMp4?: string;
  videoChromaKey?: 'black' | 'green' | 'none';
  giftName: string;
  quantity: number;
  /** سعر الوحدة — لحساب مدة العرض */
  price?: number;
};

export const GIFT_DISPLAY_MIN_MS = 2500;
export const GIFT_DISPLAY_MAX_MS = 10000;
export const GIFT_VIDEO_MAX_MS = 15000;
/** حد أقصى احتياطي فقط — التشغيل ينتهي عند اكتمال الفيديو */
export const GIFT_VIDEO_SAFETY_MAX_MS = 120_000;

/** في الروم: هدايا باهظة/فيديو تُعرض بصورة+صوت خفيف دون فيديو كامل (يمنع تجمّد الواجهة) */
export const ROOM_GIFT_LITE_MIN_PRICE = 2000;

export function shouldRoomLiteGiftPlayback(
  gift: GiftLike,
  unitPrice = 0,
  quantity = 1,
): boolean {
  if (giftHasVideo(gift)) return true;
  const total = Math.max(0, unitPrice) * Math.max(1, quantity);
  return total >= ROOM_GIFT_LITE_MIN_PRICE;
}

/** دخولية الغرف — عرض مختصر وخفيف (لا Modal ولا انتظار تحميل كامل) */
export const ENTRY_VIDEO_MAX_DISPLAY_MS = 5500;
export const ENTRY_VIDEO_LOAD_TIMEOUT_MS = 2200;
export const ENTRY_VIDEO_SAFETY_MAX_MS = 7000;

/** دخولية الملف الشخصي — كامل الشاشة + المدة الكاملة + صوت */
export const PROFILE_ENTRY_VIDEO_LOAD_TIMEOUT_MS = 10_000;
export const PROFILE_ENTRY_VIDEO_SAFETY_MAX_MS = 120_000;

/** مدة عرض الهدية: 2.5 ثانية (رخيصة) → 10 ثوانٍ (فاخرة) */
export function resolveGiftDisplayDurationMs(
  unitPrice = 0,
  quantity = 1,
  catalogMaxPrice?: number,
): number {
  const total = Math.max(0, unitPrice) * Math.max(1, quantity);
  if (total <= 0) return GIFT_DISPLAY_MIN_MS;

  const floor = 30;
  const ceiling =
    catalogMaxPrice && catalogMaxPrice > floor
      ? catalogMaxPrice
      : Math.max(total, 25_000);

  const logNorm = (v: number) => Math.log10(Math.max(v, floor));
  const span = logNorm(ceiling) - logNorm(floor);
  const ratio = span > 0
    ? Math.min(1, Math.max(0, (logNorm(total) - logNorm(floor)) / span))
    : 0;

  return Math.round(
    GIFT_DISPLAY_MIN_MS + ratio * (GIFT_DISPLAY_MAX_MS - GIFT_DISPLAY_MIN_MS),
  );
}

type CatalogGift = GiftLike & {
  id: string;
  name: string;
  price?: number;
};

type GiftMessageLike = {
  giftId?: string;
  giftName?: string;
  giftQuantity?: number;
  giftPrice?: number;
  imageUrl?: string;
  animationUrl?: string;
  soundUrl?: string;
  videoUrl?: string;
  videoUrlMp4?: string;
  videoChromaKey?: 'black' | 'green' | 'none';
};

/** دمج كتالوج الهدايا + بيانات الرسالة — نفس الشكل للمرسل والمستلم */
export function resolveGiftAnimationPayload(
  catalog: CatalogGift[],
  msg: GiftMessageLike,
): GiftAnimationPayload | null {
  const fromCatalog = msg.giftId
    ? catalog.find((g) => g.id === msg.giftId)
    : undefined;

  const name = fromCatalog?.name ?? msg.giftName?.trim() ?? '';
  if (!name && !fromCatalog) return null;

  const merged: GiftLike = {
    iconName: fromCatalog?.iconName ?? 'Gift',
    iconColor: fromCatalog?.iconColor ?? '#E11414',
    imageUrl: fromCatalog?.imageUrl ?? msg.imageUrl ?? undefined,
    animationUrl: fromCatalog?.animationUrl ?? msg.animationUrl ?? undefined,
    soundUrl: fromCatalog?.soundUrl ?? msg.soundUrl ?? undefined,
    videoUrl: fromCatalog?.videoUrl ?? msg.videoUrl ?? undefined,
    videoUrlMp4: fromCatalog?.videoUrlMp4 ?? msg.videoUrlMp4 ?? undefined,
    videoChromaKey: fromCatalog?.videoChromaKey,
    giftMediaType: fromCatalog?.giftMediaType,
    isAnimated: fromCatalog?.isAnimated,
    visualType: fromCatalog?.visualType,
  };

  const qty = msg.giftQuantity ?? 1;
  const unitPrice =
    fromCatalog?.price ??
    (msg.giftPrice && qty > 0 ? Math.round(msg.giftPrice / qty) : undefined);

  return {
    iconName: merged.iconName,
    iconColor: merged.iconColor,
    imageUrl: merged.imageUrl,
    animationUrl: merged.animationUrl,
    soundUrl: merged.soundUrl,
    videoUrl: merged.videoUrl,
    videoUrlMp4: merged.videoUrlMp4,
    videoChromaKey: merged.videoChromaKey,
    giftName: name || 'هدية',
    quantity: qty,
    price: unitPrice,
  };
}
