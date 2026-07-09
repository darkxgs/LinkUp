/**
 * Sada App — Gift Types
 */

import type { Timestamp } from 'firebase/firestore';

export type GiftCategory =
  | 'basic'
  | 'romantic'
  | 'premium'
  | 'luxury'
  | 'event'
  | 'seasonal';

export type GiftRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type GiftAnimationType = 'lottie' | 'svga' | 'static';
export type GiftDisplayMode = 'inline' | 'fullscreen' | 'premium';

export interface Gift {
  id: string;
  name: { ar: string; en: string };
  description?: { ar: string; en: string };
  
  pricing: {
    coins: number;
  };
  
  rewards: {
    senderXP: number;
    receiverPearls: number;
    intimacyPoints: number;
  };
  
  visuals: {
    icon: string;
    preview: string;
    animation: {
      type: GiftAnimationType;
      url: string;
      duration: number;
    };
    displayMode: GiftDisplayMode;
  };
  
  category: GiftCategory;
  rarity: GiftRarity;
  
  availability: {
    isActive: boolean;
    isLimited: boolean;
    limitedUntil?: Timestamp;
    minVIPLevel?: number;
    countries?: string[];
  };
  
  stats: {
    totalSent: number;
    totalRevenue: number;
  };
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SendGiftPayload {
  giftId: string;
  recipientIds: string[];
  quantity: number;
  context: {
    type: 'room' | 'chat';
    roomId?: string;
    chatId?: string;
  };
  idempotencyKey: string;
}

export interface SendGiftResponse {
  success: boolean;
  giftInstanceId: string;
  totalCost: number;
  newBalance: number;
}
