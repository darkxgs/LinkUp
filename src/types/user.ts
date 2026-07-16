/**
 * Sada App — User Types
 */

import type { Timestamp } from 'firebase/firestore';

export type Gender = 'male' | 'female';
export type Language = 'ar' | 'en';
export type AppTheme = 'dark' | 'light' | 'auto';
export type VIPTier = 'silver' | 'gold' | 'platinum' | 'diamond';

export interface UserProfile {
  displayName: string;
  bio: string;
  gender: Gender;
  birthYear: number;
  country: string;
  city?: string;
  language: Language;
  avatar: string;
  photos: string[];
  cover?: string;
}

export interface UserStats {
  coins: number;
  pearls: number;
  casinoCoins: number;
  level: number;
  xp: number;
  /** مستوى الجاذبية — من استقبال الهدايا (يكتبه السيرفر حصرياً) */
  charmLevel?: number;
  charmXp?: number;
  followers: number;
  following: number;
  visitors: number;
  totalRoomsCreated: number;
  totalRoomMinutes: number;
  totalGiftsSent: number;
  totalGiftsReceived: number;
}

export interface UserBadges {
  verified: boolean;
  vip: {
    isActive: boolean;
    tier: VIPTier;
    expiresAt: Timestamp | null;
  };
  aristocracy: {
    level: number;
    expiresAt: Timestamp | null;
  };
  avatarFrame?: string;
  entrance?: string;
  chatBubble?: string;
  currentTitle?: string;
}

export interface UserSettings {
  notifications: {
    messages: boolean;
    calls: boolean;
    gifts: boolean;
    visitors: boolean;
    promotions: boolean;
    social: boolean;
  };
  privacy: {
    hideOnlineStatus: boolean;
    hideVisitors: boolean;
    blockStrangerMessages: boolean;
  };
  language: Language;
  theme: AppTheme;
}

export interface UserStatus {
  isOnline: boolean;
  lastActiveAt: Timestamp | null;
  currentRoomId?: string;
  isInCall: boolean;
}

export interface UserModeration {
  isBanned: boolean;
  bannedUntil?: Timestamp;
  banReason?: string;
  warningCount: number;
  reportsReceived: number;
}

export interface UserAgency {
  id: string;
  role: 'host' | 'manager';
  joinedAt: Timestamp;
}

export interface User {
  uid: string;
  phoneNumber: string;
  profile: UserProfile;
  stats: UserStats;
  badges: UserBadges;
  settings: UserSettings;
  status: UserStatus;
  moderation: UserModeration;
  agency?: UserAgency;
  fcmTokens: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============ Transactions ============
export type TransactionType =
  | 'gift_sent'
  | 'gift_received'
  | 'recharge'
  | 'subscription'
  | 'game_bet'
  | 'game_win'
  | 'lottery_ticket'
  | 'lottery_prize'
  | 'withdrawal'
  | 'currency_conversion'
  | 'agency_commission'
  | 'admin_adjustment'
  | 'welcome_bonus'
  | 'daily_bonus';

export type Currency = 'coins' | 'pearls' | 'casinoCoins' | 'usd';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: Currency;
  balanceBefore: number;
  balanceAfter: number;
  meta: {
    giftId?: string;
    otherUserId?: string;
    roomId?: string;
    gameId?: string;
    transactionId?: string;
    packageId?: string;
    [key: string]: string | number | undefined;
  };
  timestamp: Timestamp;
}

// ============ Default User Builder ============
export const createDefaultUser = (
  uid: string,
  phoneNumber: string,
  profile: Partial<UserProfile>
): Omit<User, 'createdAt' | 'updatedAt'> => ({
  uid,
  phoneNumber,
  profile: {
    displayName: profile.displayName ?? '',
    bio: '',
    gender: profile.gender ?? 'male',
    birthYear: profile.birthYear ?? new Date().getFullYear() - 20,
    country: profile.country ?? 'SA',
    language: profile.language ?? 'ar',
    avatar: profile.avatar ?? '',
    photos: [],
  },
  stats: {
    coins: 0,
    pearls: 0,
    casinoCoins: 0,
    level: 1,
    xp: 0,
    charmLevel: 1,
    charmXp: 0,
    followers: 0,
    following: 0,
    visitors: 0,
    totalRoomsCreated: 0,
    totalRoomMinutes: 0,
    totalGiftsSent: 0,
    totalGiftsReceived: 0,
  },
  badges: {
    verified: false,
    vip: { isActive: false, tier: 'silver', expiresAt: null },
    aristocracy: { level: 0, expiresAt: null },
  },
  settings: {
    notifications: {
      messages: true,
      calls: true,
      gifts: true,
      visitors: true,
      promotions: true,
      social: true,
    },
    privacy: {
      hideOnlineStatus: false,
      hideVisitors: false,
      blockStrangerMessages: false,
    },
    language: profile.language ?? 'ar',
    theme: 'auto',
  },
  status: {
    isOnline: true,
    lastActiveAt: null,
    isInCall: false,
  },
  moderation: {
    isBanned: false,
    warningCount: 0,
    reportsReceived: 0,
  },
  fcmTokens: [],
});
