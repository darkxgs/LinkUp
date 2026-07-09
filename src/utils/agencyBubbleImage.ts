export type AgencyImageFields = {
  logo?: string;
  banner?: string;
  cardBackgroundUrl?: string;
  ownerAvatar?: string;
};

const pickAgencyHttpUrl = (
  url: string | null | undefined,
  exclude?: Set<string>,
): string | undefined => {
  const t = url?.trim();
  if (!t?.startsWith('http')) return undefined;
  if (exclude?.has(t)) return undefined;
  return t;
};

/**
 * شعار/صورة الوكالة — يفضّل logo ثم غلاف الغرفة/البطاقة، ويتجنّب ownerAvatar.
 */
export function resolveAgencyLogoImage(
  agency: AgencyImageFields | null | undefined,
  options?: { roomBanner?: string },
): string | undefined {
  if (!agency) return undefined;

  const exclude = new Set<string>();
  const ownerUrl = agency.ownerAvatar?.trim();
  if (ownerUrl?.startsWith('http')) exclude.add(ownerUrl);

  return (
    pickAgencyHttpUrl(agency.logo, exclude) ||
    pickAgencyHttpUrl(options?.roomBanner, exclude) ||
    pickAgencyHttpUrl(agency.cardBackgroundUrl, exclude) ||
    pickAgencyHttpUrl(agency.banner, exclude) ||
    undefined
  );
}

/**
 * صورة الوكالة للفقاعة العائمة — شعار/غلاف الوكالة وليس صورة مدير الوكالة.
 */
export function resolveAgencyBubbleImage(
  agency: AgencyImageFields | null | undefined,
  hostAvatar?: string,
): string | undefined {
  if (!agency) return undefined;

  const exclude = new Set<string>();
  const hostUrl = hostAvatar?.trim();
  if (hostUrl?.startsWith('http')) exclude.add(hostUrl);
  const ownerUrl = agency.ownerAvatar?.trim();
  if (ownerUrl?.startsWith('http')) exclude.add(ownerUrl);

  return (
    pickAgencyHttpUrl(agency.cardBackgroundUrl, exclude) ||
    pickAgencyHttpUrl(agency.logo, exclude) ||
    pickAgencyHttpUrl(agency.banner, exclude) ||
    undefined
  );
}
