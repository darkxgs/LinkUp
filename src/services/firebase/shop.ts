/**
 * LinkUp App — Shop & Gifts Service
 * نظام شراء حقيقي بـ Firestore + خصم العملات
 */

import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  query,
  orderBy,
  limit,
  where,
  increment,
  runTransaction,
  serverTimestamp,
  arrayUnion,
  onSnapshot,
} from 'firebase/firestore';
import { firestore, auth } from './index';
import { ensureCallableAuth, translateCallableError } from './authReady';
import { callCallableWithAuth } from './callableHttp';
import {
  statsFromFirestoreDoc,
  buildBalanceIncrementPatch,
} from '@/utils/userBalance';
import { applyXpGain, buildWealthXpFirestoreUpdate } from './wealthLevel';
import {
  agencyParticipantFromUserDoc,
  isHostessUser,
} from '@/services/firebase/hostTasks';
import { subscribeToRoomFrames, DEFAULT_FRAMES, type RoomFrame } from './roomDecor';
import {
  getFrameInventoryFromUserData,
  getActiveEquippedFrameId,
  pruneFrameInventory,
  MS_PER_DAY,
} from './userFrames';
import { subscribeToStoreItems, localizeStoreItem, storeItemMediaUrl } from './storeConfig';
import { getEffectiveVipLevel } from './vipSystem';
import { resolveDisplayName } from '@/utils/displayName';
import { resolveUserDocAvatar } from '@/utils/userAvatar';

const GIFT_TX_MAX_ATTEMPTS = 6;
const giftSendQueues = new Map<string, Promise<unknown>>();

function isFirestoreVersionConflict(err: unknown): boolean {
  const code = (err as { code?: string })?.code ?? '';
  const msg = String((err as Error)?.message ?? '');
  return (
    code === 'failed-precondition' ||
    code === 'aborted' ||
    /does not match the required base version/i.test(msg)
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** تسلسل إرسال الهدايا لنفس المرسل — يمنع تعارض معاملات Firestore أثناء الكومبو */
function enqueueGiftSend<T>(senderUid: string, task: () => Promise<T>): Promise<T> {
  const prev = giftSendQueues.get(senderUid) ?? Promise.resolve();
  const next = prev
    .catch(() => undefined)
    .then(task)
    .finally(() => {
      if (giftSendQueues.get(senderUid) === next) {
        giftSendQueues.delete(senderUid);
      }
    });
  giftSendQueues.set(senderUid, next);
  return next as Promise<T>;
}

async function runGiftTransaction(
  operation: Parameters<typeof runTransaction>[1],
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < GIFT_TX_MAX_ATTEMPTS; attempt += 1) {
    try {
      await runTransaction(firestore, operation);
      return;
    } catch (err) {
      lastError = err;
      if (!isFirestoreVersionConflict(err) || attempt >= GIFT_TX_MAX_ATTEMPTS - 1) {
        throw err;
      }
      await sleep(40 * (attempt + 1));
    }
  }
  throw lastError;
}

// ==================== TYPES ====================

export type GiftMediaType = 'static' | 'animated' | 'animated_sound' | 'video';

export interface GiftCategoryConfig {
  id: string;
  /** تسميات حسب اللغة — ar, en, fr, ... من لوحة التحكم */
  labels: Record<string, string>;
  order?: number;
  enabled?: boolean;
}

export interface Gift {
  id: string;
  name: string;
  price: number; // بالعملات (Coins)
  /** معرّف التصنيف من config/gifts.categories */
  category: string;
  iconName: string; // اسم Lucide icon
  iconColor: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  description?: string;
  isAnimated?: boolean;
  isLimited?: boolean;
  visualType?: 'icon' | 'image';
  /** static | animated | animated_sound | video */
  giftMediaType?: GiftMediaType;
  imageUrl?: string;
  animationUrl?: string;
  soundUrl?: string;
  videoUrl?: string;
  /** MP4/MOV احتياطي لـ iOS عند WebM */
  videoUrlMp4?: string;
  /** black = إزالة خلفية سوداء | green = كroma أخضر | none = بدون معالجة */
  videoChromaKey?: 'black' | 'green' | 'none';
  /** هدية حصرية: مستوى SVIP المطلوب لإرسالها (0/غير محدد = للجميع) */
  requiredVipLevel?: number;
}

export type StoreItemType =
  | 'frame'
  | 'badge'
  | 'theme'
  | 'effect'
  | 'vip'
  | 'entrance'
  | 'bubble';

export interface StoreItem {
  id: string;
  name: string;
  nameEn?: string;
  description: string;
  descriptionEn?: string;
  type: StoreItemType;
  price: number;
  currency: 'coins' | 'pearls';
  iconName: string;
  iconColor: string;
  bgColors: [string, string];
  imageUrl?: string;
  animationUrl?: string;
  /** فيديو الدخولية (MP4/WebM) — بديل animationUrl */
  videoUrl?: string;
  videoUrlMp4?: string;
  isLimited?: boolean;
  isNew?: boolean;
  validityDays?: number;
  sort?: number;
}

export interface InventoryItem {
  id: string;
  itemId: string;
  itemType: 'gift' | 'frame' | 'badge' | 'theme' | 'effect' | 'vip' | 'entrance' | 'bubble';
  itemName: string;
  iconName: string;
  iconColor: string;
  imageUrl?: string;
  quantity: number;
  isEquipped?: boolean;
  acquiredAt: number;
  expiresAt?: number;
  /** إطار شخصي من users.frameInventory — ليس من مجموعة inventory */
  isFrameEntry?: boolean;
}

export interface Transaction {
  id: string;
  uid: string;
  type: 'purchase' | 'gift_sent' | 'gift_received' | 'recharge' | 'withdraw';
  amount: number;
  currency: 'coins' | 'pearls' | 'casinoCoins';
  itemId?: string;
  itemName?: string;
  toUid?: string;
  fromUid?: string;
  createdAt: number;
  status: 'completed' | 'pending' | 'failed';
}

// ==================== GIFTS CATALOG ====================

export const GIFTS_CATALOG: Gift[] = [
  // Classic
  { id: 'rose', name: 'وردة', price: 10, category: 'classic', iconName: 'Flower2', iconColor: '#E11414', rarity: 'common' },
  { id: 'heart', name: 'قلب', price: 25, category: 'popular', iconName: 'Heart', iconColor: '#EF4444', rarity: 'common' },
  { id: 'kiss', name: 'قُبلة', price: 30, category: 'classic', iconName: 'Heart', iconColor: '#FF6670', rarity: 'common' },
  { id: 'cake', name: 'كعكة', price: 50, category: 'classic', iconName: 'Cake', iconColor: '#F59E0B', rarity: 'common' },
  { id: 'music', name: 'موسيقى', price: 75, category: 'popular', iconName: 'Music', iconColor: '#E11414', rarity: 'rare' },
  { id: 'star', name: 'نجمة', price: 100, category: 'popular', iconName: 'Star', iconColor: '#FCD34D', rarity: 'rare' },
  // Animated
  { id: 'sparkle', name: 'سحر', price: 150, category: 'animated', iconName: 'Sparkles', iconColor: '#E11414', rarity: 'rare', isAnimated: true },
  { id: 'fire', name: 'نار', price: 200, category: 'animated', iconName: 'Flame', iconColor: '#F59E0B', rarity: 'rare', isAnimated: true },
  { id: 'rainbow', name: 'قوس قزح', price: 250, category: 'animated', iconName: 'Rainbow', iconColor: '#E11414', rarity: 'rare', isAnimated: true },
  // Luxury
  { id: 'diamond', name: 'ألماس', price: 500, category: 'luxury', iconName: 'Diamond', iconColor: '#C61414', rarity: 'epic' },
  { id: 'gem', name: 'جوهرة', price: 750, category: 'luxury', iconName: 'Gem', iconColor: '#E11414', rarity: 'epic' },
  { id: 'crown', name: 'تاج', price: 1000, category: 'luxury', iconName: 'Crown', iconColor: '#F59E0B', rarity: 'epic' },
  { id: 'gold-bar', name: 'سبيكة ذهب', price: 1500, category: 'luxury', iconName: 'CircleDollarSign', iconColor: '#FCD34D', rarity: 'epic' },
  // VIP
  { id: 'magic-wand', name: 'عصا سحرية', price: 2000, category: 'vip', iconName: 'Wand2', iconColor: '#E11414', rarity: 'legendary' },
  { id: 'pearl', name: 'ماسة نادرة', price: 3000, category: 'vip', iconName: 'Sparkles', iconColor: '#C61414', rarity: 'legendary' },
  { id: 'sun', name: 'شمس', price: 4000, category: 'vip', iconName: 'Sun', iconColor: '#F59E0B', rarity: 'legendary' },
  // Special
  { id: 'rocket', name: 'صاروخ', price: 5000, category: 'special', iconName: 'Rocket', iconColor: '#EF4444', rarity: 'legendary', isLimited: true },
  { id: 'unicorn', name: 'وحيد القرن', price: 7500, category: 'special', iconName: 'Sparkles', iconColor: '#E11414', rarity: 'legendary', isLimited: true },
  { id: 'castle', name: 'قلعة', price: 10000, category: 'special', iconName: 'Castle', iconColor: '#E11414', rarity: 'legendary', isLimited: true },
  { id: 'lambo', name: 'سيارة فاخرة', price: 15000, category: 'special', iconName: 'Car', iconColor: '#EF4444', rarity: 'legendary', isLimited: true },
  { id: 'yacht', name: 'يخت', price: 25000, category: 'special', iconName: 'Ship', iconColor: '#C61414', rarity: 'legendary', isLimited: true },
  { id: 'jet', name: 'طائرة خاصة', price: 50000, category: 'special', iconName: 'Plane', iconColor: '#E11414', rarity: 'legendary', isLimited: true },
];

// ==================== STORE ITEMS CATALOG ====================

export const STORE_CATALOG: StoreItem[] = [
  // Entrances
  {
    id: 'entrance_desert_camel',
    name: 'دخولية الجمل الصحراوي',
    nameEn: 'Desert Camel Entrance',
    description: 'مؤثر دخول الجمل الصحراوي المهيب عند دخولك للغرفة',
    descriptionEn: 'Majestic desert camel entrance animation when entering a room',
    type: 'entrance',
    price: 15000,
    currency: 'coins',
    iconName: 'Sparkles',
    iconColor: '#F59E0B',
    bgColors: ['#FFD86F', '#FF9A2E'],
    imageUrl: 'https://storage.googleapis.com/linkup-dc45f.firebasestorage.app/store/items/entrance_desert_camel.png',
    validityDays: 3,
    sort: 1
  },
  {
    id: 'entrance_sports_car',
    name: 'دخولية السيارة الرياضية',
    nameEn: 'Sports Car Entrance',
    description: 'دخول سريع ومميز بسيارة رياضية زرقاء فائقة السرعة',
    descriptionEn: 'Fast and premium entry with a blue super sports car',
    type: 'entrance',
    price: 5000,
    currency: 'coins',
    iconName: 'Car',
    iconColor: '#ED4444',
    bgColors: ['#F06A6A', '#EA2626'],
    imageUrl: 'https://storage.googleapis.com/linkup-dc45f.firebasestorage.app/store/items/entrance_sports_car.png',
    validityDays: 1,
    sort: 2
  },
  {
    id: 'entrance_spacecraft',
    name: 'دخولية سفينة الفضاء',
    nameEn: 'Spacecraft Entrance',
    description: 'سفينة فضاء سيبرانية متطورة ترافق حضورك للغرفة',
    descriptionEn: 'Advanced cyber spacecraft accompanying your presence to the room',
    type: 'entrance',
    price: 30000,
    currency: 'coins',
    iconName: 'Rocket',
    iconColor: '#E11414',
    bgColors: ['#FCA5A5', '#E11414'],
    imageUrl: 'https://storage.googleapis.com/linkup-dc45f.firebasestorage.app/store/items/entrance_spacecraft.png',
    validityDays: 7,
    isNew: true,
    sort: 3
  },
  {
    id: 'entrance_rocket',
    name: 'دخولية الصاروخ السريع',
    nameEn: 'Fast Rocket Entrance',
    description: 'صاروخ فضاء ناري فخم يطلق حضورك المميز للغرفة',
    descriptionEn: 'Luxurious fiery space rocket launching your entry to the room',
    type: 'entrance',
    price: 50000,
    currency: 'coins',
    iconName: 'Sparkles',
    iconColor: '#EF4444',
    bgColors: ['#FCA5A5', '#EF4444'],
    imageUrl: 'https://storage.googleapis.com/linkup-dc45f.firebasestorage.app/store/items/entrance_rocket.png',
    validityDays: 3,
    isLimited: true,
    sort: 4
  },
  // Bubbles
  {
    id: 'bubble_golden',
    name: 'فقاعة التاج الذهبي',
    nameEn: 'Golden Crown Bubble',
    description: 'فقاعة دردشة ذهبية فخمة مزينة بتاج للملوك',
    descriptionEn: 'Premium golden chat bubble decorated with a royal crown',
    type: 'bubble',
    price: 4000,
    currency: 'coins',
    iconName: 'MessageCircle',
    iconColor: '#F59E0B',
    bgColors: ['#FFD86F', '#FF9A2E'],
    imageUrl: 'https://storage.googleapis.com/linkup-dc45f.firebasestorage.app/store/items/bubble_golden.png',
    validityDays: 7,
    sort: 5
  },
  {
    id: 'bubble_pink',
    name: 'فقاعة الأحلام الوردية',
    nameEn: 'Pink Dreams Bubble',
    description: 'فقاعة دردشة وردية ناعمة للأوقات الرومانسية',
    descriptionEn: 'Soft pink chat bubble for romantic times',
    type: 'bubble',
    price: 3000,
    currency: 'pearls',
    iconName: 'MessageCircle',
    iconColor: '#E11414',
    bgColors: ['#FCA5A5', '#E11414'],
    imageUrl: 'https://storage.googleapis.com/linkup-dc45f.firebasestorage.app/store/items/bubble_golden.png',
    validityDays: 7,
    sort: 6
  },
  {
    id: 'bubble_violet',
    name: 'فقاعة البنفسج الملكي',
    nameEn: 'Royal Violet Bubble',
    description: 'فقاعة دردشة بلون بنفسجي ملكي هادئ',
    descriptionEn: 'Chat bubble in a calm royal violet color',
    type: 'bubble',
    price: 3000,
    currency: 'pearls',
    iconName: 'MessageCircle',
    iconColor: '#E11414',
    bgColors: ['#FCA5A5', '#E11414'],
    imageUrl: 'https://storage.googleapis.com/linkup-dc45f.firebasestorage.app/store/items/bubble_golden.png',
    validityDays: 7,
    sort: 7
  },
  {
    id: 'bubble_mint',
    name: 'فقاعة النعناع المنعش',
    nameEn: 'Mint Green Bubble',
    description: 'فقاعة دردشة بلون أخضر النعناع الهادئ والمنعش',
    descriptionEn: 'Chat bubble in a calm and refreshing mint green color',
    type: 'bubble',
    price: 3000,
    currency: 'pearls',
    iconName: 'MessageCircle',
    iconColor: '#10B981',
    bgColors: ['#A7F3D0', '#059669'],
    imageUrl: 'https://storage.googleapis.com/linkup-dc45f.firebasestorage.app/store/items/bubble_golden.png',
    validityDays: 7,
    sort: 8
  },
  // Badges
  {
    id: 'badge-verified',
    name: 'شارة موثّقة',
    nameEn: 'Verified Badge',
    description: 'علامة التحقق الزرقاء الرسمية تظهر بجانب اسمك',
    descriptionEn: 'Official blue verification badge next to your name',
    type: 'badge',
    price: 50000,
    currency: 'coins',
    iconName: 'BadgeCheck',
    iconColor: '#ED4444',
    bgColors: ['#F59B9B', '#ED4444'],
    validityDays: 90,
    sort: 9
  },
  {
    id: 'badge-king',
    name: 'شارة الملك',
    nameEn: 'King Badge',
    description: 'شارة ملك المنطقة لتمييز حسابك بين الجميع',
    descriptionEn: 'King badge to distinguish your account from everyone else',
    type: 'badge',
    price: 100000,
    currency: 'coins',
    iconName: 'Crown',
    iconColor: '#F59E0B',
    bgColors: ['#FCD34D', '#F59E0B'],
    isLimited: true,
    sort: 10
  },
  {
    id: 'badge-pro',
    name: 'شارة Pro',
    nameEn: 'Pro Badge',
    description: 'شارة خاصة تدل على المستخدمين المحترفين',
    descriptionEn: 'Special badge indicating professional users',
    type: 'badge',
    price: 2500,
    currency: 'pearls',
    iconName: 'Star',
    iconColor: '#F59E0B',
    bgColors: ['#FBBF24', '#D97706'],
    sort: 11
  },
  // Themes & VIP
  {
    id: 'theme-dark',
    name: 'الثيم الداكن',
    nameEn: 'Dark Theme',
    description: 'مظهر داكن ومريح للعين للتطبيق بالكامل',
    descriptionEn: 'Dark eye-friendly appearance for the entire app',
    type: 'theme',
    price: 1000,
    currency: 'pearls',
    iconName: 'Moon',
    iconColor: '#1F2937',
    bgColors: ['#6B7280', '#1F2937'],
    sort: 12
  },
  {
    id: 'theme-pink',
    name: 'الثيم الوردي',
    nameEn: 'Pink Theme',
    description: 'مظهر وردي رومانسي وناعم للتطبيق بالكامل',
    descriptionEn: 'Soft romantic pink appearance for the entire app',
    type: 'theme',
    price: 1500,
    currency: 'pearls',
    iconName: 'Heart',
    iconColor: '#E11414',
    bgColors: ['#FCA5A5', '#E11414'],
    sort: 13
  },
  {
    id: 'vip-week',
    name: 'VIP لأسبوع',
    nameEn: 'Weekly VIP',
    description: 'احصل على كل مزايا العضوية الفاخرة لمدة 7 أيام',
    descriptionEn: 'Get all premium VIP features for 7 days',
    type: 'vip',
    price: 30000,
    currency: 'coins',
    iconName: 'Crown',
    iconColor: '#FCD34D',
    bgColors: ['#FCD34D', '#F59E0B'],
    validityDays: 7,
    sort: 14
  },
  {
    id: 'vip-month',
    name: 'VIP لشهر',
    nameEn: 'Monthly VIP',
    description: 'احصل على كل مزايا العضوية الفاخرة لمدة 30 يوم كاملة',
    descriptionEn: 'Get all premium VIP features for 30 full days',
    type: 'vip',
    price: 100000,
    currency: 'coins',
    iconName: 'Crown',
    iconColor: '#FCD34D',
    bgColors: ['#FCD34D', '#F59E0B'],
    validityDays: 30,
    isNew: true,
    sort: 15
  }
];

// ==================== BUY STORE ITEM ====================

export const purchaseStoreItem = async (item: StoreItem): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const userRef = doc(firestore, 'users', user.uid);

  // معاملة ذرّية واحدة: فحص الرصيد + الخصم + منح العنصر + سجل المعاملة —
  // كان المنح يتم بعد المعاملة فينفصل عن الخصم عند أي فشل جزئي
  await runTransaction(firestore, async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists()) throw new Error('المستخدم غير موجود');

    const userData = userDoc.data();
    const stats = statsFromFirestoreDoc(userData as Record<string, unknown>);
    const balance =
      item.currency === 'coins' ? stats.coins : stats.pearls;

    if (balance < item.price) {
      throw new Error(
        `رصيد غير كافٍ. تحتاج ${item.price} ${item.currency === 'coins' ? 'عملة' : 'ماسة'}`,
      );
    }

    transaction.update(
      userRef,
      buildBalanceIncrementPatch(item.currency, -item.price),
    );

    const now = Date.now();

    // إضافة للمخزون — داخل نفس المعاملة
    const invRef = doc(collection(firestore, 'inventory'));
    transaction.set(invRef, {
      uid: user.uid,
      itemId: item.id,
      itemType: item.type,
      itemName: item.name,
      iconName: item.iconName,
      iconColor: item.iconColor,
      imageUrl: item.imageUrl ?? null,
      quantity: 1,
      isEquipped: false,
      acquiredAt: now,
      expiresAt: item.validityDays
        ? now + item.validityDays * 24 * 60 * 60 * 1000
        : null,
    });

    // تسجيل المعاملة — داخل نفس المعاملة
    const txRef = doc(collection(firestore, 'transactions'));
    transaction.set(txRef, {
      uid: user.uid,
      type: 'purchase',
      amount: -item.price,
      currency: item.currency,
      itemId: item.id,
      itemName: item.name,
      status: 'completed',
      createdAt: now,
    });
  });
};

export type PurchaseAndSendStoreItemResult = {
  ok: boolean;
  balance: number;
  currency: 'coins' | 'pearls';
};

/** شراء عنصر متجر وإرساله لمستخدم آخر — عبر Cloud Function */
export const purchaseAndSendStoreItem = async (
  item: StoreItem,
  toUid: string,
  toName: string,
  options?: { isRoomFrame?: boolean; durationDays?: number },
): Promise<PurchaseAndSendStoreItemResult> => {
  const user = await ensureCallableAuth();
  if (user.uid === toUid) throw new Error('لا يمكنك الإرسال لنفسك');

  try {
    const idToken = await user.getIdToken();
    const result = await callCallableWithAuth<
      {
        toUid: string;
        toName: string;
        item: {
          id: string;
          name: string;
          type: string;
          price: number;
          currency: 'coins' | 'pearls';
          validityDays?: number;
          durationDays?: number;
          iconName?: string;
          iconColor?: string;
          isRoomFrame?: boolean;
        };
      },
      PurchaseAndSendStoreItemResult
    >(
      'purchaseAndSendStoreItem',
      {
        toUid,
        toName,
        item: {
          id: item.id,
          name: item.name,
          type: item.type,
          price: item.price,
          currency: item.currency,
          validityDays: item.validityDays,
          durationDays: options?.durationDays,
          iconName: item.iconName,
          iconColor: item.iconColor,
          isRoomFrame: options?.isRoomFrame === true,
        },
      },
      idToken,
    );
    return result;
  } catch (e) {
    throw new Error(translateCallableError(e));
  }
};

// ==================== BUY & SEND GIFT ====================

/**
 * كاش نسبة عمولة الهدايا — يُغذّى من ConfigContext فور تحميل/تحديث الإعدادات،
 * فلا يحتاج buyAndSendGift لجلب config/settings عند كل إرسال (إرسال أسرع).
 */
let cachedGiftCommission = 0;
export const setCachedGiftCommission = (pct: number): void => {
  if (typeof pct === 'number' && pct >= 0 && pct <= 100) cachedGiftCommission = pct;
};

export function computeGiftRecipientCoins(
  totalPrice: number,
  commissionPct = cachedGiftCommission,
): number {
  const commission = Math.max(0, Math.min(100, commissionPct));
  const recipientShareRatio = Math.max(0, Math.min(1, (100 - commission) / 100));
  return Math.floor(Math.max(0, totalPrice) * recipientShareRatio);
}

export type BuyAndSendGiftResult = {
  totalPrice: number;
  coinsForRecipient: number;
  senderLevel: number;
  recipientLevel: number;
};

export const buyAndSendGift = async (
  gift: Gift,
  toUid: string,
  toName: string,
  roomId?: string,
  quantity = 1,
  context?: { postId?: string; agencyId?: string },
): Promise<BuyAndSendGiftResult> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');
  // منع الإهداء/الدعم الذاتي: كان يسمح برفع المستوى مجاناً (كوينز تخرج وتعود
  // فتتعادل) وللمضيفة بسكّ ماسة قابلة للسحب 1:1 من الكوينز بلا عمولة — ثغرة
  // خسارة مالية على الوكيل. المنع هنا يغطّي كل مسارات الإهداء (روم/خاص/منشور).
  if (toUid === user.uid) {
    throw new Error('لا يمكنك إهداء أو دعم نفسك');
  }

  return enqueueGiftSend(user.uid, () =>
    executeBuyAndSendGift(user, gift, toUid, toName, roomId, quantity, context),
  );
};

async function executeBuyAndSendGift(
  user: NonNullable<ReturnType<typeof auth.currentUser>>,
  gift: Gift,
  toUid: string,
  toName: string,
  roomId?: string,
  quantity = 1,
  context?: { postId?: string; agencyId?: string },
): Promise<BuyAndSendGiftResult> {
  const qty = Math.max(1, Math.min(99, quantity));
  const totalPrice = gift.price * qty;

  const userRef = doc(firestore, 'users', user.uid);
  const recipientRef = doc(firestore, 'users', toUid);

  // ⚡ تحديث كاش العمولة في الخلفية (للاستخدامات الأخرى) دون حجب الإرسال
  void getDoc(doc(firestore, 'config', 'settings'))
    .then((snap) => {
      if (snap.exists()) {
        const s = snap.data() as Record<string, unknown>;
        if (typeof s.giftCommission === 'number') cachedGiftCommission = s.giftCommission;
      }
    })
    .catch(() => {});
  // المضيفة تستلم ماسة؛ غير المضيف يستلم كوينز
  const recipientAmount = totalPrice;
  const now = Date.now();
  const giftLabel = qty > 1 ? `${gift.name} ×${qty}` : gift.name;
  let senderName = user.displayName ?? 'مستخدم';
  let senderAvatar = user.photoURL ?? '';
  let recipientIsHostess = false;

  let senderLevel = 1;
  let recipientLevel = 1;

  // معاملة ذرّية: خصم المرسل + إضافة رصيد المستلم + سجل الهدية (مع إعادة محاولة عند الكومبو)
  await runGiftTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    const recipientDoc = await transaction.get(recipientRef);
    if (!userDoc.exists()) throw new Error('المستخدم غير موجود');
    if (!recipientDoc.exists()) throw new Error('المستلم غير موجود');

    const senderData = userDoc.data() as Record<string, unknown>;
    const recipientData = recipientDoc.data() as Record<string, unknown>;
    recipientIsHostess = isHostessUser(agencyParticipantFromUserDoc(recipientData));
    senderName = resolveDisplayName(
      {
        displayName: (senderData.displayName as string) ?? user.displayName,
        email: (senderData.email as string) ?? user.email ?? undefined,
      },
      'مستخدم',
    );
    senderAvatar = resolveUserDocAvatar(senderData, user.uid);

    // هدية حصرية: تتطلب مستوى SVIP معيّن (امتياز «هدايا حصرية»)
    // نحسب المستوى الفعّال ليشمل SVIP الممنوح من الأرستقراطية النشطة
    if (gift.requiredVipLevel && gift.requiredVipLevel > 0) {
      const senderVipLevel = getEffectiveVipLevel(userDoc.data() as Record<string, unknown>);
      if (senderVipLevel < gift.requiredVipLevel) {
        throw new Error(`هذه الهدية حصرية لأعضاء SVIP${gift.requiredVipLevel} وما فوق`);
      }
    }

    const stats = statsFromFirestoreDoc(userDoc.data() as Record<string, unknown>);
    if (stats.coins < totalPrice) {
      throw new Error(`رصيد غير كافٍ. تحتاج ${totalPrice} عملة`);
    }

    const senderStats = statsFromFirestoreDoc(senderData);
    const senderXp = applyXpGain(senderStats.level, senderStats.xp, totalPrice);
    senderLevel = senderXp.level;
    transaction.update(userRef, {
      ...buildBalanceIncrementPatch('coins', -totalPrice),
      ...buildWealthXpFirestoreUpdate(senderXp.level, senderXp.xp),
    });

    if (recipientAmount > 0) {
      // كل أرباح الهدايا تصل Coins 100% للجميع (بقرار المالك) — المضيفة تحوّلها
      // Diamonds عبر شاشة التحويل عند السحب. لا تُائتمن الماسة مباشرة من الهدايا بعد الآن.
      const balanceKey = 'coins';
      // مستوى الثروة من الإنفاق فقط — منح المستلم XP بكامل قيمة الهدية كان
      // يجعل مستواه يطابق مستوى المُرسِل (تدوير الكوينز بالهدايا يضخّم
      // المستويين معاً بلا حد فتظهر حسابات المستخدمين بنفس اللفل)
      const recipientStats = statsFromFirestoreDoc(recipientData);
      recipientLevel = recipientStats.level;
      transaction.update(recipientRef, {
        ...buildBalanceIncrementPatch(balanceKey, recipientAmount),
      });
    }

    const sentTxRef = doc(collection(firestore, 'transactions'));
    const recvTxRef = doc(collection(firestore, 'transactions'));

    const agencyId = String(context?.agencyId ?? '').trim();

    transaction.set(sentTxRef, {
    uid: user.uid,
    type: 'gift_sent',
    amount: -totalPrice,
    currency: 'coins',
    itemId: gift.id,
      itemName: giftLabel,
      quantity: qty,
    toUid,
      toName,
    status: 'completed',
      createdAt: now,
      ...(roomId ? { roomId } : {}),
      ...(agencyId ? { agencyId, agencySupportRecordedByClient: true } : {}),
      ...(context?.postId ? { postId: context.postId } : {}),
  });

    transaction.set(recvTxRef, {
    uid: toUid,
    type: 'gift_received',
      amount: recipientAmount,
    // الهدايا تصل Coins 100% — نُبقي gift_received بعملة coins حتى للمضيفة
    currency: 'coins',
    itemId: gift.id,
    itemName: gift.name,
      quantity: qty,
    fromUid: user.uid,
      fromName: user.displayName ?? 'مستخدم',
    status: 'completed',
      createdAt: now,
      // يمنع ازدواج pearlsEarned مع creditAgencyPearlsOnGift على السيرفر
      ...(recipientIsHostess ? { agencyEarningRecordedByClient: true } : {}),
      ...(roomId ? { roomId } : {}),
      ...(agencyId ? { agencyId } : {}),
      ...(context?.postId ? { postId: context.postId } : {}),
    });
  });

  void import('./aristocracySystem')
    .then(({ addAristocracyHonorPoints }) => addAristocracyHonorPoints(totalPrice))
    .catch(() => {});

  // #20: دعم فترة الوكالة + تحصيل العضو — كانا معرّفين دون استدعاء من مسار الهدايا
  // عند وجود agencyId يُعلَّم gift_sent بـ agencySupportRecordedByClient ليتخطّى الـCF الازدواج
  const agencyIdForSupport = String(context?.agencyId ?? '').trim();
  if (agencyIdForSupport && totalPrice > 0) {
    void import('@/services/agencyService')
      .then(({ bumpAgencyPeriodSupport }) =>
        bumpAgencyPeriodSupport(agencyIdForSupport, totalPrice),
      )
      .catch(() => {});
  }
  if (recipientIsHostess && recipientAmount > 0) {
    void import('@/services/agencyService')
      .then(({ recordAgencyMemberEarning }) =>
        recordAgencyMemberEarning(toUid, recipientAmount),
      )
      .catch(() => {});
  }

  // إرسال إشعار للمستلم — في الخلفية (لا يحجب اكتمال الهدية / لا يبطّئ الإرسال)
  const giftBody = `أرسل لك ${gift.name}${qty > 1 ? ` ×${qty}` : ''} (${totalPrice} عملة)`;
  const postId = context?.postId;
  void import('./notifications')
    .then(({ createNotification }) =>
      createNotification({
        uid: toUid,
        type: 'gift',
        fromUid: user.uid,
        fromName: senderName,
        fromAvatar: senderAvatar || undefined,
        message: postId ? `🎁 ${giftBody} على منشورك` : giftBody,
        data: {
          giftId: gift.id,
          giftName: gift.name,
          giftValue: totalPrice,
          quantity: qty,
          title: senderName,
          body: giftBody,
          fromUid: user.uid,
          type: 'gift',
          ...(postId ? { postId, route: `/post/${postId}` } : {}),
          ...(roomId ? { roomId } : {}),
        },
        isRead: false,
      }),
    )
    .catch((e) => console.warn('failed to send notification:', e));

  // مهمة «إرسال هدايا» اليومية في مستوى الثروة — كل مسارات الإهداء تمر من هنا
  void import('./rewardsCenter')
    .then(({ trackRewardsGiftSent }) => trackRewardsGiftSent(qty))
    .catch(() => {});

  return {
    totalPrice,
    coinsForRecipient: recipientAmount,
    senderLevel,
    recipientLevel,
  };
}

// ==================== GET INVENTORY ====================

function catalogLookup(storeItems: StoreItem[]): Map<string, StoreItem> {
  const map = new Map<string, StoreItem>();
  for (const item of STORE_CATALOG) map.set(item.id, item);
  for (const item of storeItems) map.set(item.id, item);
  return map;
}

function enrichInventoryDoc(
  raw: InventoryItem,
  catalog: Map<string, StoreItem>,
  lang: string,
): InventoryItem {
  const cat = catalog.get(raw.itemId);
  const localized = cat ? localizeStoreItem(cat, lang) : null;
  return {
    ...raw,
    itemName: raw.itemName || localized?.name || raw.itemId,
    imageUrl:
      raw.imageUrl ||
      (localized ? storeItemMediaUrl(localized) : undefined) ||
      localized?.imageUrl,
    iconName: raw.iconName || localized?.iconName || 'Package',
    iconColor: raw.iconColor || localized?.iconColor || '#E11414',
  };
}

function framesToInventoryItems(
  userData: Record<string, unknown>,
  frames: RoomFrame[],
): InventoryItem[] {
  const inv = pruneFrameInventory(getFrameInventoryFromUserData(userData));
  const equippedId = getActiveEquippedFrameId(userData);
  const now = Date.now();
  const catalog = resolveFrameCatalog(frames);
  const frameMap = new Map(catalog.map((f) => [f.id, f]));

  return Object.entries(inv).map(([frameId, expiresAt]) => {
    const frame = frameMap.get(frameId) ?? DEFAULT_FRAMES.find((f) => f.id === frameId);
    const durationMs =
      frame?.durationDays && frame.durationDays > 0
        ? frame.durationDays * MS_PER_DAY
        : 0;
    return {
      id: `frame_${frameId}`,
      itemId: frameId,
      itemType: 'frame' as const,
      itemName: frame?.name ?? frameId,
      iconName: 'Crown',
      iconColor: '#F59E0B',
      imageUrl: frame?.imageUrl,
      quantity: 1,
      isEquipped: equippedId === frameId,
      acquiredAt:
        expiresAt > 0 && durationMs > 0 ? Math.max(0, expiresAt - durationMs) : now,
      expiresAt: expiresAt === 0 ? undefined : expiresAt,
      isFrameEntry: true,
    };
  });
}

function resolveFrameCatalog(raw: RoomFrame[] | undefined): RoomFrame[] {
  const enabled = (raw ?? []).filter((f) => f.enabled !== false && f.id);
  return enabled.length > 0 ? enabled : DEFAULT_FRAMES;
}

function legacyFramesFromInventoryDocs(
  docs: InventoryItem[],
  frameItems: InventoryItem[],
  catalog: Map<string, StoreItem>,
  lang: string,
): InventoryItem[] {
  const known = new Set(frameItems.map((f) => f.itemId));
  return docs
    .filter((d) => d.itemType === 'frame' && d.itemId && !known.has(d.itemId))
    .map((d) =>
      enrichInventoryDoc(
        { ...d, isFrameEntry: true },
        catalog,
        lang,
      ),
    );
}

function mergeInventoryItems(
  docs: InventoryItem[],
  frameItems: InventoryItem[],
  storeItems: StoreItem[],
  lang: string,
): InventoryItem[] {
  const catalog = catalogLookup(storeItems);
  const frameIds = new Set(frameItems.map((f) => f.itemId));
  const enrichedDocs = docs
    .filter((d) => d.itemType !== 'frame' || !frameIds.has(d.itemId))
    .map((item) => enrichInventoryDoc(item, catalog, lang));
  const legacyFrames = legacyFramesFromInventoryDocs(docs, frameItems, catalog, lang);
  const merged = [...frameItems, ...legacyFrames, ...enrichedDocs];
  merged.sort((a, b) => (b.acquiredAt ?? 0) - (a.acquiredAt ?? 0));
  return merged.slice(0, 100);
}

function mapInventoryDocs(
  docs: { id: string; data: () => Record<string, unknown> }[],
): InventoryItem[] {
  const items = docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      itemId: String(data.itemId ?? ''),
      itemType: data.itemType as InventoryItem['itemType'],
      itemName: String(data.itemName ?? ''),
      iconName: String(data.iconName ?? 'Package'),
      iconColor: String(data.iconColor ?? '#E11414'),
      imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : undefined,
      quantity: Number(data.quantity ?? 1),
      isEquipped: data.isEquipped === true,
      acquiredAt: Number(data.acquiredAt ?? 0),
      expiresAt: data.expiresAt != null ? Number(data.expiresAt) : undefined,
    } satisfies InventoryItem;
  });
  items.sort((a, b) => (b.acquiredAt ?? 0) - (a.acquiredAt ?? 0));
  return items.slice(0, 100);
}

async function fetchInventoryContext(uid: string) {
  const [invSnap, userSnap] = await Promise.all([
    getDocs(
      query(collection(firestore, 'inventory'), where('uid', '==', uid), limit(200)),
    ),
    getDoc(doc(firestore, 'users', uid)),
  ]);
  const userData = (userSnap.exists() ? userSnap.data() : {}) as Record<string, unknown>;
  return {
    docs: mapInventoryDocs(invSnap.docs),
    userData,
  };
}

export const getUserInventory = async (uid?: string, lang = 'ar'): Promise<InventoryItem[]> => {
  const resolvedUid = uid ?? auth.currentUser?.uid;
  if (!resolvedUid) return [];

  try {
    const { docs, userData } = await fetchInventoryContext(resolvedUid);
    const [framesSnap, storeSnap] = await Promise.all([
      getDoc(doc(firestore, 'config', 'roomFrames')),
      getDoc(doc(firestore, 'config', 'store')),
    ]);
    const frameCatalog = resolveFrameCatalog(framesSnap.data()?.items as RoomFrame[] | undefined);
    const rawStoreItems = storeSnap.exists()
      ? ((storeSnap.data()?.items ?? []) as Record<string, unknown>[])
      : [];
    const storeItems =
      rawStoreItems.length > 0
        ? (rawStoreItems
            .map((raw) => {
              const id = String(raw.id ?? '').trim();
              if (!id) return null;
              return {
                id,
                name: String(raw.name ?? ''),
                nameEn: raw.nameEn ? String(raw.nameEn) : undefined,
                description: String(raw.description ?? ''),
                type: String(raw.category ?? raw.type ?? '') as StoreItem['type'],
                price: Number(raw.price ?? 0),
                currency: raw.currency === 'pearls' ? 'pearls' : 'coins',
                iconName: String(raw.iconName ?? 'Package'),
                iconColor: String(raw.iconColor ?? '#E11414'),
                bgColors: ['#FCD34D', '#F59E0B'] as [string, string],
                imageUrl: raw.imageUrl ? String(raw.imageUrl) : undefined,
                animationUrl: raw.animationUrl ? String(raw.animationUrl) : undefined,
              } satisfies StoreItem;
            })
            .filter(Boolean) as StoreItem[])
        : STORE_CATALOG.filter((i) => i.type !== 'frame');

    const frameItems = framesToInventoryItems(userData, frameCatalog);
    return mergeInventoryItems(docs, frameItems, storeItems, lang);
  } catch (e) {
    console.error('getUserInventory:', e);
    return [];
  }
};

/** تحديث حيّ للمخزون — inventory + إطارات المستخدم + صور الكتالوج */
export const subscribeToUserInventory = (
  uid: string,
  cb: (items: InventoryItem[]) => void,
  lang = 'ar',
): (() => void) => {
  if (!uid) {
    cb([]);
    return () => {};
  }

  let invDocs: InventoryItem[] = [];
  let userData: Record<string, unknown> = {};
  let frameCatalog: RoomFrame[] = DEFAULT_FRAMES;
  let storeItems: StoreItem[] = [];

  const emit = () => {
    const frameItems = framesToInventoryItems(userData, frameCatalog);
    cb(mergeInventoryItems(invDocs, frameItems, storeItems, lang));
  };

  const invQuery = query(
    collection(firestore, 'inventory'),
    where('uid', '==', uid),
    limit(200),
  );

  const unsubs = [
    onSnapshot(
      invQuery,
      (snap) => {
        invDocs = mapInventoryDocs(snap.docs);
        emit();
      },
      (e) => {
        console.error('subscribeToUserInventory inventory:', e);
        invDocs = [];
        emit();
      },
    ),
    onSnapshot(
      doc(firestore, 'users', uid),
      (snap) => {
        userData = (snap.exists() ? snap.data() : {}) as Record<string, unknown>;
        emit();
      },
      (e) => {
        console.error('subscribeToUserInventory user:', e);
        userData = {};
        emit();
      },
    ),
    subscribeToRoomFrames((frames) => {
      frameCatalog = resolveFrameCatalog(frames);
      emit();
    }),
    subscribeToStoreItems((items) => {
      storeItems = items;
      emit();
    }),
  ];

  return () => unsubs.forEach((u) => u());
};

/** تفعيل/إيقاف عنصر — يدعم إطارات الملف الشخصي وعناصر inventory */
export const toggleInventoryItemEquip = async (item: InventoryItem): Promise<void> => {
  if (item.isFrameEntry || item.itemType === 'frame') {
    const { equipUserFrame, clearEquippedUserFrame } = await import('./roomDecor');
    if (item.isEquipped) {
      await clearEquippedUserFrame();
    } else {
      await equipUserFrame(item.itemId);
    }
    return;
  }
  await toggleEquipItem(item.id, item.itemType);
};

// ==================== EQUIP/UNEQUIP ITEM ====================

export const toggleEquipItem = async (
  inventoryId: string,
  itemType: string,
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  // فقط where على uid، باقي الفلترة في الكلاينت
  const q = query(
    collection(firestore, 'inventory'),
    where('uid', '==', user.uid),
    limit(100),
  );
  const snap = await getDocs(q);
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    // unequip أي عنصر آخر من نفس النوع
    if (
      docSnap.id !== inventoryId &&
      data.itemType === itemType &&
      data.isEquipped === true
    ) {
      await updateDoc(doc(firestore, 'inventory', docSnap.id), { isEquipped: false });
    }
  }

  // toggle الحالي
  const currentRef = doc(firestore, 'inventory', inventoryId);
  const currentDoc = await getDoc(currentRef);
  if (currentDoc.exists()) {
    const wasEquipped = currentDoc.data().isEquipped === true;
    const nextEquipped = !wasEquipped;
    await updateDoc(currentRef, {
      isEquipped: nextEquipped,
    });

    if (itemType === 'bubble') {
      const itemId = typeof currentDoc.data().itemId === 'string' ? currentDoc.data().itemId : '';
      await updateDoc(doc(firestore, 'users', user.uid), {
        equippedBubbleId: nextEquipped && itemId ? itemId : '',
      });
    }
    if (itemType === 'entrance') {
      const itemId = typeof currentDoc.data().itemId === 'string' ? currentDoc.data().itemId : '';
      await updateDoc(doc(firestore, 'users', user.uid), {
        equippedEntranceId: nextEquipped && itemId ? itemId : '',
      });
    }
  }
};

// ==================== GET TRANSACTIONS ====================

export const getUserTransactions = async (
  limitCount: number = 50,
): Promise<Transaction[]> => {
  const user = auth.currentUser;
  if (!user) return [];

  try {
    const q = query(
      collection(firestore, 'transactions'),
      where('uid', '==', user.uid),
      limit(200),
    );
    const snap = await getDocs(q);
    const txs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Transaction);
    // ترتيب في الكلاينت
    txs.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    return txs.slice(0, limitCount);
  } catch (e) {
    console.error('getUserTransactions:', e);
    return [];
  }
};

/** اشتراك ريل-تايم للمعاملات الأخيرة */
export function subscribeToUserTransactions(
  limitCount: number,
  callback: (txs: Transaction[]) => void,
): () => void {
  const user = auth.currentUser;
  if (!user) return () => {};

  const q = query(
    collection(firestore, 'transactions'),
    where('uid', '==', user.uid),
    orderBy('createdAt', 'desc'),
    limit(limitCount),
  );

  return onSnapshot(q, (snap) => {
    const txs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Transaction);
    callback(txs);
  }, () => callback([])); // خطأ الاستماع كان يُبتلع فيبقى مؤشر التحميل للأبد
}

// ==================== RECHARGE COINS ====================

export const rechargeCoins = async (
  packageId: string,
  coinsAmount: number,
  price: number,
): Promise<{ firstRechargeBonus: number }> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const { getSettingsOnce } = await import('./config');
  const settings = await getSettingsOnce();
  if (settings.inAppRechargeEnabled !== true) {
    throw new Error('الشحن من التطبيق غير متاح حالياً. تواصل مع الإدارة.');
  }

  await updateDoc(
    doc(firestore, 'users', user.uid),
    buildBalanceIncrementPatch('coins', coinsAmount),
  );

  await addDoc(collection(firestore, 'transactions'), {
    uid: user.uid,
    type: 'recharge',
    amount: coinsAmount,
    currency: 'coins',
    itemId: packageId,
    itemName: `شحن ${coinsAmount} عملة بقيمة $${price}`,
    status: 'completed',
    createdAt: Date.now(),
  });

  try {
    const { addVipPoints } = await import('./vipSystem');
    await addVipPoints(user.uid, coinsAmount);
  } catch (e) {
    console.warn('addVipPoints after recharge:', e);
  }

  try {
    const { tryGrantFirstRechargeBonus } = await import('./firstRechargeBonus');
    const { bonus } = await tryGrantFirstRechargeBonus(user.uid);
    void import('./casinoLiveActivity')
      .then(({ logCasinoRechargeActivity }) => logCasinoRechargeActivity(coinsAmount))
      .catch(() => {});
    return { firstRechargeBonus: bonus };
  } catch (e) {
    console.warn('firstRechargeBonus after recharge:', e);
    return { firstRechargeBonus: 0 };
  }
};
