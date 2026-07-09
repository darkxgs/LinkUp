/** معرّف حساب عام رقمي (8 أرقام) — ثابت لكل uid */
export function generatePublicAccountId(uid: string): string {
  let h = 0;
  for (let i = 0; i < uid.length; i++) {
    h = (Math.imul(31, h) + uid.charCodeAt(i)) >>> 0;
  }
  return String(h % 100_000_000).padStart(8, '0');
}
