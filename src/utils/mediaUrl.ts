/** هل الرابط صورة GIF متحركة؟ */
export function isGifImageUrl(url?: string | null): boolean {
  if (!url?.trim()) return false;
  return /\.gif($|\?|#)/i.test(url.trim());
}

/** هل الرابط فيديو (mp4 / webm / mov)؟ */
export function isVideoMediaUrl(url?: string | null): boolean {
  if (!url?.trim()) return false;
  return /\.(mp4|m4v|mov|webm)($|\?|#)/i.test(url.trim());
}
