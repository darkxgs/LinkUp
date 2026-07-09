/**
 * تطبيق إعدادات الخصوصية على العرض — غرف، ترتيب، بروفايل
 */
import {
  readPrivacyFromUser,
  type PrivacySettings,
} from '@/services/firebase/privacySettings';
import { getEffectiveVipLevel } from '@/services/firebase/vipSystem';
import { statsFromFirestoreDoc } from '@/utils/userBalance';

export function getUserPrivacy(data: Record<string, unknown> | null | undefined): PrivacySettings {
  return readPrivacyFromUser(data);
}

export function isSelfView(profileUid: string, viewerUid?: string | null): boolean {
  return Boolean(profileUid && viewerUid && profileUid === viewerUid);
}

export function shouldHideGiftWall(
  profileUid: string,
  viewerUid: string | undefined | null,
  privacy: PrivacySettings,
): boolean {
  return privacy.hideGiftHistory && !isSelfView(profileUid, viewerUid);
}

export function shouldHideWealthLevel(
  profileUid: string,
  viewerUid: string | undefined | null,
  privacy: PrivacySettings,
): boolean {
  return privacy.hideWealthLevel && !isSelfView(profileUid, viewerUid);
}

export function shouldHideFromRanking(privacy: PrivacySettings): boolean {
  return privacy.hideFromRanking;
}

export function shouldHideSvipIdentity(
  profileUid: string,
  viewerUid: string | undefined | null,
  privacy: PrivacySettings,
): boolean {
  return privacy.hideSvipIdentity && !isSelfView(profileUid, viewerUid);
}

export function isProfileUnsearchable(privacy: PrivacySettings): boolean {
  return privacy.profileUnsearchable;
}

export interface SeatPublicData {
  uid: string;
  displayName: string;
  avatar: string;
  level: number;
  isVIP: boolean;
  vipLevel?: number;
  coins: number;
  isMuted?: boolean;
  joinedAt?: number;
  hiddenInRoom?: boolean;
}

/** بناء بيانات المقعد مع احترام الخصوصية عند الجلوس */
export function buildSeatPublicData(
  userData: Record<string, unknown>,
  uid: string,
  displayName: string,
  avatar: string,
  coins: number,
): SeatPublicData {
  const privacy = readPrivacyFromUser(userData);
  const level = statsFromFirestoreDoc(userData).level;
  const isVIP = Boolean(userData.isVIP);
  // المستوى الفعّال يشمل SVIP الممنوح من الأرستقراطية النشطة (شارة الهوية)
  const vipLevel = getEffectiveVipLevel(userData);

  if (privacy.hideInRoom) {
    return {
      uid,
      displayName,
      avatar,
      level: 1,
      isVIP: false,
      vipLevel: 0,
      coins: 0,
      isMuted: false,
      hiddenInRoom: true,
      joinedAt: Date.now(),
    };
  }

  return {
    uid,
    displayName,
    avatar,
    level,
    isVIP: privacy.hideSvipIdentity ? false : isVIP,
    vipLevel: privacy.hideSvipIdentity ? 0 : vipLevel,
    coins,
    isMuted: false,
    joinedAt: Date.now(),
  };
}

/** إخفاء مستوى الثروة في واجهة العرض */
export function maskWealthLevel(
  level: number,
  profileUid: string,
  viewerUid: string | undefined | null,
  userData?: Record<string, unknown> | null,
): number | null {
  const privacy = readPrivacyFromUser(userData);
  if (shouldHideWealthLevel(profileUid, viewerUid, privacy)) return null;
  return level;
}
