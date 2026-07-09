/**
 * Sada App — Room Types
 */

import type { Timestamp } from 'firebase/firestore';

export type RoomType =
  | 'party'
  | '2p'
  | 'sing'
  | 'dating'
  | 'wedding'
  | 'birthday'
  | 'broadcast';

export type RoomMode = 'public' | 'friend' | 'locked';
export type SeatCount = 9 | 11 | 16 | 19 | 21;

export interface RoomMeta {
  name: string;
  cover: string;
  type: RoomType;
  country: string;
  description: string;
  announcement?: {
    title: string;
    content: string;
    autoShow: boolean;
  };
}

export interface RoomOwner {
  userId: string;
  name: string;
  avatar: string;
}

export interface RoomSettings {
  mode: RoomMode;
  password?: string;
  maxSeats: SeatCount;
  vipOnly: boolean;
  minLevel?: number;
  blockedCountries: string[];
  language: 'ar' | 'en' | 'mixed';
  theme: string;
  musicEnabled: boolean;
}

export interface RoomState {
  isActive: boolean;
  isPK: boolean;
  pkOpponentRoomId?: string;
  startedAt?: Timestamp;
  endedAt?: Timestamp;
}

export interface RoomStats {
  totalVisits: number;
  totalMinutes: number;
  totalGiftsValue: number;
  peakListeners: number;
  weeklyRanking?: number;
}

export interface Room {
  id: string;
  meta: RoomMeta;
  owner: RoomOwner;
  agency?: {
    id: string;
    name: string;
  };
  settings: RoomSettings;
  state: RoomState;
  stats: RoomStats;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============ RTDB Schemas ============
export interface RTDBSeat {
  userId: string | null;
  muted: boolean;
  isSpeaking: boolean;
  joinedAt: number;
}

export interface RTDBListener {
  joinedAt: number;
  name: string;
  avatar: string;
  level: number;
  country: string;
}

export interface RTDBMicRequest {
  seatNumber: number;
  requestedAt: number;
  name: string;
  avatar: string;
}

export interface RTDBPresence {
  isOnline: boolean;
  lastActiveAt: number;
  device: 'ios' | 'android';
}
