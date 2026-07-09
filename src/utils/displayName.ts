/**
 * عرض اسم المستخدم — لا نعرض البريد الإلكتروني كاسم
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function isEmailLike(value?: string | null): boolean {
  if (!value) return false;
  return EMAIL_RE.test(value.trim());
}

/**
 * يُرجع displayName من Firestore/المحادثة، ويتجاهل القيم الشبيهة بالإيميل
 */
export function resolveDisplayName(
  options: {
    displayName?: string | null;
    email?: string | null;
  },
  fallback = 'مستخدم',
): string {
  const name = (options.displayName ?? '').trim();
  if (name.length > 0 && !isEmailLike(name)) {
    return name;
  }
  return fallback;
}
