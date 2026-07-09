/**
 * أنواع أمير الوكلاء — بدون استيرادات (تجنّب التبعيات الدائرية)
 */
export interface AgencyPrinceHolder {
  uid: string;
  agencyId: string;
  agencyName: string;
  ownerName: string;
  monthKey: string;
  monthlyTotal: number;
  grantedAt: number;
}

export interface AgencyPrinceConfig {
  enabled: boolean;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  rulesAr: string[];
  rulesEn: string[];
  badgeImageUrl?: string;
  crownImageUrl?: string;
  entryImageUrl?: string;
  entryAnimationUrl?: string;
  accentColor: string;
  autoAssignMonthly: boolean;
  currentHolder?: AgencyPrinceHolder | null;
}

export interface UserAgencyPrince {
  active: boolean;
  monthKey: string;
  agencyId: string;
  agencyName: string;
  badgeImageUrl?: string | null;
  entryImageUrl?: string | null;
  entryAnimationUrl?: string | null;
  entryVideoUrl?: string | null;
  entryVideoUrlMp4?: string | null;
  frameImageUrl?: string | null;
  bubbleImageUrl?: string | null;
  grantedAt: number;
}
