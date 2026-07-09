/**
 * تصنيفات الهدايا — تسميات متعددة اللغات من لوحة التحكم فقط
 */
import type { GiftCategoryConfig } from '@/services/firebase/shop';

type LegacyCategory = GiftCategoryConfig & {
  label?: string;
  labelEn?: string;
};

/** توحيد تصنيف قادم من Firestore (يدعم الصيغة القديمة label/labelEn) */
export function normalizeGiftCategory(raw: LegacyCategory): GiftCategoryConfig {
  const labels: Record<string, string> = { ...(raw.labels ?? {}) };

  if (raw.label?.trim() && !labels.ar) labels.ar = raw.label.trim();
  if (raw.labelEn?.trim() && !labels.en) labels.en = raw.labelEn.trim();

  Object.keys(labels).forEach((k) => {
    if (!labels[k]?.trim()) delete labels[k];
  });

  return {
    id: raw.id,
    labels,
    order: raw.order ?? 0,
    enabled: raw.enabled !== false,
  };
}

/** ترتيب التصنيفات حسب order */
export function sortGiftCategories(cats: GiftCategoryConfig[]): GiftCategoryConfig[] {
  return cats
    .map(normalizeGiftCategory)
    .filter((c) => c.enabled !== false && c.id)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * اسم التصنيف حسب لغة التطبيق الحالية
 * fallback: ar → en → أول تسمية → id
 */
export function getGiftCategoryLabel(
  category: GiftCategoryConfig | undefined,
  lang: string,
): string {
  if (!category) return '';
  const base = (lang || 'ar').split('-')[0] ?? 'ar';
  const { labels, id } = category;

  return (
    labels[lang]?.trim()
    || labels[base]?.trim()
    || labels.ar?.trim()
    || labels.en?.trim()
    || Object.values(labels).find((v) => v?.trim())?.trim()
    || id
  );
}

/** إيجاد تصنيف بالمعرّف */
export function findGiftCategory(
  categories: GiftCategoryConfig[],
  id: string,
): GiftCategoryConfig | undefined {
  return categories.find((c) => c.id === id);
}
