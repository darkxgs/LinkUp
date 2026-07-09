/**
 * مكتبة المؤثرات الصوتية — أيقونات Lucide + ملفات صوت محلية
 */
import type { LucideIcon } from 'lucide-react-native';
import {
  Clapperboard,
  PartyPopper,
  Smile,
  Music2,
  Bell,
  ThumbsDown,
  Sparkles,
  Heart,
} from 'lucide-react-native';
import { lu } from '@/theme/lu-brand';

export type SoundEffectId =
  | 'applause'
  | 'cheer'
  | 'laugh'
  | 'drum'
  | 'whistle'
  | 'boo'
  | 'wow'
  | 'heart';

export interface SoundEffectDef {
  id: SoundEffectId;
  labelKey: string;
  Icon: LucideIcon;
  color: string;
  source: number;
}

export const ROOM_SOUND_EFFECTS: SoundEffectDef[] = [
  {
    id: 'applause',
    labelKey: 'room.sfx.applause',
    Icon: Clapperboard,
    color: lu.colors.gold,
    source: require('../../assets/sounds/applause.mp3'),
  },
  {
    id: 'cheer',
    labelKey: 'room.sfx.cheer',
    Icon: PartyPopper,
    color: lu.colors.pink,
    source: require('../../assets/sounds/cheer.mp3'),
  },
  {
    id: 'laugh',
    labelKey: 'room.sfx.laugh',
    Icon: Smile,
    color: lu.colors.gold2,
    source: require('../../assets/sounds/laugh.mp3'),
  },
  {
    id: 'drum',
    labelKey: 'room.sfx.drum',
    Icon: Music2,
    color: lu.colors.purple,
    source: require('../../assets/sounds/drum.mp3'),
  },
  {
    id: 'whistle',
    labelKey: 'room.sfx.whistle',
    Icon: Bell,
    color: lu.colors.blue,
    source: require('../../assets/sounds/whistle.mp3'),
  },
  {
    id: 'boo',
    labelKey: 'room.sfx.boo',
    Icon: ThumbsDown,
    color: lu.colors.muted,
    source: require('../../assets/sounds/boo.mp3'),
  },
  {
    id: 'wow',
    labelKey: 'room.sfx.wow',
    Icon: Sparkles,
    color: lu.colors.mint,
    source: require('../../assets/sounds/wow.mp3'),
  },
  {
    id: 'heart',
    labelKey: 'room.sfx.heart',
    Icon: Heart,
    color: lu.colors.live,
    source: require('../../assets/sounds/heart.mp3'),
  },
];

export const getSoundEffectById = (id: string): SoundEffectDef | undefined =>
  ROOM_SOUND_EFFECTS.find((e) => e.id === id);
