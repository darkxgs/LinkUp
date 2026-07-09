import type { RechargePackageTag } from '@/services/firebase/config';

export function normalizeRechargePackageTag(raw: RechargePackageTag): RechargePackageTag {
  const labels: Record<string, string> = {};
  Object.entries(raw.labels ?? {}).forEach(([k, v]) => {
    if (v?.trim()) labels[k] = v.trim();
  });
  return {
    id: raw.id,
    labels,
    emoji: raw.emoji?.trim() || undefined,
    color: raw.color?.trim() || undefined,
    borderColor: raw.borderColor?.trim() || undefined,
    order: raw.order ?? 0,
    enabled: raw.enabled !== false,
  };
}

export function sortRechargePackageTags(tags: RechargePackageTag[]): RechargePackageTag[] {
  return tags
    .map(normalizeRechargePackageTag)
    .filter((t) => t.id && t.enabled !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function getRechargePackageTagLabel(
  tag: RechargePackageTag | undefined,
  lang: string,
): string {
  if (!tag) return '';
  const base = (lang || 'ar').split('-')[0] ?? 'ar';
  const { labels, id } = tag;
  return (
    labels[lang]?.trim()
    || labels[base]?.trim()
    || labels.ar?.trim()
    || labels.en?.trim()
    || Object.values(labels).find((v) => v?.trim())?.trim()
    || id
  );
}

export function findRechargePackageTag(
  tags: RechargePackageTag[],
  id: string | undefined,
): RechargePackageTag | undefined {
  if (!id) return undefined;
  return tags.find((t) => t.id === id);
}
