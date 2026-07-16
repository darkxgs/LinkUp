/**
 * ميتاداتا مستخدمي الدردشة — فقاعة الرسالة + المستوى الحقيقي + الأوسمة.
 *
 * كل ذلك يُجلب من **قراءة واحدة** لوثيقة المستخدم ويُخزَّن في كاش دائم (مع TTL)،
 * فلا يُعاد جلب نفس المستخدم مع كل رسالة جديدة → الفقاعة والأوسمة تظهر فوراً
 * وعلى كل نصوص المستخدم، وبأقل ضغط على الشبكة (سريع وخفيف).
 */

import { collection, doc, getDoc, getDocs, query, where, limit } from 'firebase/firestore';
import { firestore } from './index';
import type { StoreItem } from './shop';
import { storeItemMediaUrl } from './storeConfig';
import {
  getEffectiveVipLevel,
  hasVipPrivilege,
  resolveVipPrivilegeAsset,
  type VipSystemConfig,
} from './vipSystem';
import { readUserAgencyPrince, resolveAgencyPrinceBadgeForUser } from './agencyPrinceBadge';
import { resolveAristocracyBadgeUrl, type AristocracyConfig } from './aristocracySystem';
import type { AgencyPrinceConfig } from './agencyPrinceSystem';
import { getTopRelationshipLevelForUser } from './social';
import { prefetchMessageBubbleUris } from '@/components/chat/FramedMessageBubble';

export type ChatUserMeta = {
  bubbleUrl?: string;
  /** مستوى الثروة الحقيقي */
  level: number;
  vipLevel: number;
  isVerified?: boolean;
  gender?: 'male' | 'female';
  /** أعلى مستوى علاقة (وسام ❤ مثل البروفايل) */
  relationshipLevel?: number;
  vipBadgeUrl?: string;
  princeBadgeUrl?: string;
  aristocracyBadgeUrl?: string;
};

const EMPTY_META: ChatUserMeta = { level: 0, vipLevel: 0 };

const META_TTL = 5 * 60 * 1000; // 5 دقائق — توازن بين السرعة وتحديث التجهيزات الجديدة
const metaCache = new Map<string, { meta: ChatUserMeta; ts: number }>();
const metaInFlight = new Map<string, Promise<ChatUserMeta>>();

export function resolveBubbleImageUrl(
  bubbleItemId: string | null | undefined,
  catalog: StoreItem[],
): string | undefined {
  if (!bubbleItemId?.trim()) return undefined;
  const item = catalog.find((i) => i.id === bubbleItemId);
  return item ? storeItemMediaUrl(item) : undefined;
}

function getEquippedBubbleIdFromUserData(data: Record<string, unknown> | undefined): string | null {
  const raw = data?.equippedBubbleId;
  if (raw === '' || raw === null) return null;
  if (typeof raw !== 'string' || raw.length === 0) return null;
  // انتهاء صلاحية الفقاعة المجهّزة (تُكتب عند التجهيز؛ 0/غياب = دائمة) — فقاعة
  // منتهية كانت تبقى تظهر للجميع لأن هذا المسار السريع لم يكن يتحقق من الصلاحية
  const exp = Number(data?.equippedBubbleExpiresAt ?? 0) || 0;
  if (exp > 0 && exp < Date.now()) return null;
  return raw;
}

async function fetchEquippedBubbleIdFromInventory(uid: string): Promise<string | null> {
  const q = query(collection(firestore, 'inventory'), where('uid', '==', uid), limit(80));
  const snap = await getDocs(q);
  const now = Date.now();
  for (const d of snap.docs) {
    const data = d.data();
    if (data.itemType !== 'bubble' || data.isEquipped !== true) continue;
    const exp = data.expiresAt;
    if (typeof exp === 'number' && exp > 0 && exp < now) continue;
    const id = typeof data.itemId === 'string' ? data.itemId : '';
    if (id) return id;
  }
  return null;
}

async function resolveBubbleUrl(
  uid: string,
  userData: Record<string, unknown>,
  catalog: StoreItem[],
  vipSystem?: VipSystemConfig,
): Promise<string | undefined> {
  // فقاعة أمير الوكالة لها الأولوية القصوى (وسام شهري حصري)
  const princeBubble = readUserAgencyPrince(userData.agencyPrince)?.bubbleImageUrl;
  if (princeBubble) return princeBubble;

  let bubbleId = getEquippedBubbleIdFromUserData(userData);
  if (!bubbleId) bubbleId = await fetchEquippedBubbleIdFromInventory(uid);
  let bubbleUrl = resolveBubbleImageUrl(bubbleId, catalog);

  // لا فقاعة مجهّزة لكن لديه SVIP نشط بامتياز chatBubble → استخدمها
  if (!bubbleUrl && vipSystem && hasVipPrivilege(userData, 'chatBubble', vipSystem.privileges)) {
    const vipLevel = getEffectiveVipLevel(userData);
    const bubblePriv = resolveVipPrivilegeAsset(vipLevel, 'chatBubble', vipSystem);
    if (bubblePriv?.imageUrl) bubbleUrl = bubblePriv.imageUrl;
  }
  return bubbleUrl;
}

async function fetchChatUserMeta(
  uid: string,
  catalog: StoreItem[],
  vipSystem?: VipSystemConfig,
  aristocracy?: AristocracyConfig,
  agencyPrince?: AgencyPrinceConfig,
): Promise<ChatUserMeta> {
  const cached = metaCache.get(uid);
  if (cached && Date.now() - cached.ts < META_TTL) return cached.meta;

  const pending = metaInFlight.get(uid);
  if (pending) return pending;

  const request = (async () => {
    try {
      // قراءة وثيقة المستخدم + أعلى مستوى علاقة بالتوازي (مرة واحدة، مخزّنة)
      const [userSnap, relationshipLevel] = await Promise.all([
        getDoc(doc(firestore, 'users', uid)),
        getTopRelationshipLevelForUser(uid),
      ]);
      if (!userSnap.exists()) return EMPTY_META;
      const userData = userSnap.data() as Record<string, unknown>;

      const bubbleUrl = await resolveBubbleUrl(uid, userData, catalog, vipSystem);

      const stats = userData.stats as Record<string, unknown> | undefined;
      const level = Number(userData.level ?? stats?.level ?? 0) || 0;
      // «إخفاء هوية SVIP» من إعدادات الخصوصية — يخفي الشارة والمستوى عن الجميع
      const hideSvip =
        (userData.privacySettings as { hideSvipIdentity?: boolean } | undefined)
          ?.hideSvipIdentity === true;
      const vipLevel = hideSvip ? 0 : getEffectiveVipLevel(userData);

      let vipBadgeUrl: string | undefined;
      if (!hideSvip && vipSystem && hasVipPrivilege(userData, 'vipBadge', vipSystem.privileges)) {
        vipBadgeUrl = resolveVipPrivilegeAsset(vipLevel, 'vipBadge', vipSystem)?.imageUrl;
      }

      const princeBadgeUrl = agencyPrince
        ? resolveAgencyPrinceBadgeForUser(uid, agencyPrince, userData.agencyPrince)
        : undefined;
      const aristocracyBadgeUrl = aristocracy
        ? resolveAristocracyBadgeUrl(userData, aristocracy)
        : undefined;

      const gender = userData.gender === 'female' ? 'female' : userData.gender === 'male' ? 'male' : undefined;
      const meta: ChatUserMeta = {
        bubbleUrl,
        level,
        vipLevel,
        isVerified: userData.isVerified === true,
        gender,
        relationshipLevel,
        vipBadgeUrl,
        princeBadgeUrl,
        aristocracyBadgeUrl,
      };
      metaCache.set(uid, { meta, ts: Date.now() });
      if (bubbleUrl) prefetchMessageBubbleUris([bubbleUrl]);
      return meta;
    } catch {
      return EMPTY_META;
    } finally {
      metaInFlight.delete(uid);
    }
  })();

  metaInFlight.set(uid, request);
  return request;
}

/** ميتاداتا موحّدة لمجموعة مستخدمين (فقاعة + مستوى + أوسمة) — مع كاش دائم. */
export async function fetchChatUserMetaForUsers(
  uids: string[],
  catalog: StoreItem[],
  vipSystem?: VipSystemConfig,
  aristocracy?: AristocracyConfig,
  agencyPrince?: AgencyPrinceConfig,
): Promise<Record<string, ChatUserMeta>> {
  const unique = [...new Set(uids.filter(Boolean))];
  if (!unique.length) return {};
  const map: Record<string, ChatUserMeta> = {};
  await Promise.all(
    unique.map(async (uid) => {
      map[uid] = await fetchChatUserMeta(uid, catalog, vipSystem, aristocracy, agencyPrince);
    }),
  );
  return map;
}

/** توافق خلفي — فقاعات فقط (شات الوكالة). يستفيد من نفس الكاش الدائم. */
export async function fetchEquippedBubbleUrlsForUsers(
  uids: string[],
  catalog: StoreItem[],
  vipSystem?: VipSystemConfig,
): Promise<Record<string, string>> {
  const unique = [...new Set(uids.filter(Boolean))];
  if (!unique.length || !catalog.length) return {};
  const map: Record<string, string> = {};
  await Promise.all(
    unique.map(async (uid) => {
      const meta = await fetchChatUserMeta(uid, catalog, vipSystem);
      if (meta.bubbleUrl) map[uid] = meta.bubbleUrl;
    }),
  );
  return map;
}
