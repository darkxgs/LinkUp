/**
 * عرض اسم المستخدم — لا نعرض البريد الإلكتروني كاسم
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function isEmailLike(value?: string | null): boolean {
  if (!value) return false;
  return EMAIL_RE.test(value.trim());
}

/**
 * علامات combining زخرفية (zalgo) تتراكم فوق/تحت الحروف فتزيد ارتفاع السطر
 * فيُقصّ الاسم من الأعلى في الغرف («الاسم يطلع لفوق مو كامل»). نُطبّع NFC (تُدمج
 * اللكنات الشرعية) ثم نزيل هذه العلامات الزخرفية. لا نمسّ تشكيل العربية
 * (U+064B–065F، U+0670، U+06D6–06ED) ولا الحروف نفسها.
 */
const DECORATIVE_COMBINING_RE =
  /[̀-ͯ҃-҉᪰-᫿᷀-᷿⃐-⃿︠-︯]/g;

export function sanitizeDisplayName(value?: string | null): string {
  const raw = (value ?? '').toString();
  if (!raw) return raw;
  let out = raw;
  try {
    out = raw.normalize('NFC');
  } catch {
    /* normalize غير متاح — نكمل بالخام */
  }
  return out.replace(DECORATIVE_COMBINING_RE, '');
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
  const name = sanitizeDisplayName(options.displayName).trim();
  if (name.length > 0 && !isEmailLike(name)) {
    return name;
  }
  return fallback;
}
