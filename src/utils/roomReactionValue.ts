/**
 * ترميز/فك ترميز قيمة رمز الروم المرسلة في الشات أو على المقعد.
 * الصور (GIF/PNG/WebP) تُرسل بصيغة image:https://...
 */
export function roomReactionItemToSendValue(item: { imageUrl?: string }): string {
  const url = item.imageUrl?.trim();
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    return `image:${url}`;
  }
  return '✨';
}

export function parseRoomReactionDisplay(value: string): {
  imageUrl?: string;
  emoji: string;
} {
  const v = value.trim();
  if (!v) return { emoji: '✨' };
  if (v.startsWith('image:')) {
    const url = v.slice(6).trim();
    if (url) return { imageUrl: url, emoji: '✨' };
  }
  // Legacy Lottie stickers — عرض احتياطي فقط
  if (v.startsWith('lottie:')) return { emoji: '✨' };
  if (v.startsWith('http://') || v.startsWith('https://')) {
    return { imageUrl: v, emoji: '✨' };
  }
  return { emoji: v };
}
