/**
 * تسعير المكالمات والمطابقة — يُتحكّم به من لوحة الأدمن (config/callPricing)
 */
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { firestore } from './index';

export interface CallPricingRates {
  voicePerMinute: number;
  videoFirstMinute: number;
  videoAfterMinute: number;
}

export interface ChatMessagePricing {
  enabled: boolean;
  textMessage: number;
  voiceMessage: number;
  imageMessage: number;
}

export interface CallPricingConfig {
  match: CallPricingRates;
  chat: CallPricingRates;
  messages: ChatMessagePricing;
  updatedAt?: number;
}

export type ChatMessagePriceType = 'text' | 'voice' | 'image';

export type CallPricingContext = 'match' | 'chat';

export const DEFAULT_CALL_PRICING: CallPricingConfig = {
  match: {
    voicePerMinute: 260,
    videoFirstMinute: 175,
    videoAfterMinute: 350,
  },
  chat: {
    voicePerMinute: 260,
    videoFirstMinute: 175,
    videoAfterMinute: 350,
  },
  messages: {
    enabled: true,
    textMessage: 200,
    voiceMessage: 200,
    imageMessage: 200,
  },
};

const clampPrice = (n: unknown, fallback: number): number => {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : fallback;
  return Math.max(0, Math.min(500_000, v));
};

export const normalizeCallPricing = (raw: Record<string, unknown> | undefined): CallPricingConfig => {
  const match = (raw?.match ?? {}) as Record<string, unknown>;
  const chat = (raw?.chat ?? {}) as Record<string, unknown>;
  const messages = (raw?.messages ?? {}) as Record<string, unknown>;
  return {
    match: {
      voicePerMinute: clampPrice(match.voicePerMinute, DEFAULT_CALL_PRICING.match.voicePerMinute),
      videoFirstMinute: clampPrice(match.videoFirstMinute, DEFAULT_CALL_PRICING.match.videoFirstMinute),
      videoAfterMinute: clampPrice(match.videoAfterMinute, DEFAULT_CALL_PRICING.match.videoAfterMinute),
    },
    chat: {
      voicePerMinute: clampPrice(chat.voicePerMinute, DEFAULT_CALL_PRICING.chat.voicePerMinute),
      videoFirstMinute: clampPrice(chat.videoFirstMinute, DEFAULT_CALL_PRICING.chat.videoFirstMinute),
      videoAfterMinute: clampPrice(chat.videoAfterMinute, DEFAULT_CALL_PRICING.chat.videoAfterMinute),
    },
    messages: {
      enabled: messages.enabled !== false,
      textMessage: clampPrice(messages.textMessage, DEFAULT_CALL_PRICING.messages.textMessage),
      voiceMessage: clampPrice(messages.voiceMessage, DEFAULT_CALL_PRICING.messages.voiceMessage),
      imageMessage: clampPrice(messages.imageMessage, DEFAULT_CALL_PRICING.messages.imageMessage),
    },
    updatedAt: typeof raw?.updatedAt === 'number' ? raw.updatedAt : undefined,
  };
};

export function getChatMessagePrice(
  config: CallPricingConfig,
  type: ChatMessagePriceType,
): number {
  if (!config.messages?.enabled) return 0;
  const m = config.messages;
  if (type === 'text') return m.textMessage;
  if (type === 'voice') return m.voiceMessage;
  return m.imageMessage;
}

export const getMinutePriceFromRates = (
  rates: CallPricingRates,
  type: 'voice' | 'video',
  minuteIndex: number,
): number => {
  if (type === 'video') {
    return minuteIndex <= 0 ? rates.videoFirstMinute : rates.videoAfterMinute;
  }
  return rates.voicePerMinute;
};

export const getMinutePrice = (
  config: CallPricingConfig,
  context: CallPricingContext,
  type: 'voice' | 'video',
  minuteIndex: number,
): number => {
  const rates = context === 'match' ? config.match : config.chat;
  return getMinutePriceFromRates(rates, type, minuteIndex);
};

/** @deprecated — للتوافق؛ استخدم callPricing من useConfig */
export const MATCH_PRICING = {
  voice: DEFAULT_CALL_PRICING.match.voicePerMinute,
  video_first_minute: DEFAULT_CALL_PRICING.match.videoFirstMinute,
  video_after_minute: DEFAULT_CALL_PRICING.match.videoAfterMinute,
};

export const subscribeToCallPricing = (
  cb: (pricing: CallPricingConfig) => void,
): (() => void) => {
  const ref = doc(firestore, 'config', 'callPricing');
  return onSnapshot(
    ref,
    (snap) => {
      cb(snap.exists() ? normalizeCallPricing(snap.data()) : DEFAULT_CALL_PRICING);
    },
    () => cb(DEFAULT_CALL_PRICING),
  );
};

export const getCallPricingOnce = async (): Promise<CallPricingConfig> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'callPricing'));
    if (snap.exists()) return normalizeCallPricing(snap.data());
  } catch {
    // fallback
  }
  return DEFAULT_CALL_PRICING;
};
