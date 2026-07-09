/** معرّف حساب عام (8 أرقام) — مطابق للتطبيق */
export function generatePublicAccountId(uid: string): string {
  let h = 0;
  for (let i = 0; i < uid.length; i++) {
    h = (Math.imul(31, h) + uid.charCodeAt(i)) >>> 0;
  }
  return String(h % 100_000_000).padStart(8, '0');
}

export function formatPublicAccountId(value: unknown, uid: string): string {
  if (value != null && String(value).trim() !== '') {
    return String(value).replace(/\D/g, '').slice(-8).padStart(8, '0');
  }
  return generatePublicAccountId(uid);
}
