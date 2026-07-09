/**
 * أيقونات الروم من حزمة Line up App Full File / Icons
 */
import React from 'react';
import { DesignIcon } from '@/components/icons/DesignIcon';
import {
  EmojiWhiteSvg,
  VolumeWhiteSvg,
  ChatRoomWhiteSvg,
  CommentWhiteSvg,
  GiftWhiteSvg,
  GridWhiteSvg,
  CopyWhiteSvg,
  PowerWhiteSvg,
  AddSvg,
  AddWhiteSvg,
  TrophyWhiteSvg,
  EditWhiteSvg,
  PartySvg,
} from '@/components/icons/designSvgs';

type Props = { size?: number; color?: string };

function tintedXml(xml: string, color?: string): string {
  if (!color) return xml;
  const normalized = color.toUpperCase();
  if (normalized === '#FFFFFF' || normalized === '#FFF') return xml;
  return xml.replace(/#FFFFFF/gi, color);
}

function RoomDesignIcon({ xml, size = 22, color }: { xml: string; size?: number; color?: string }) {
  return <DesignIcon xml={tintedXml(xml, color)} size={size} />;
}

export function RoomEmojiIcon({ size = 22, color }: Props) {
  return <RoomDesignIcon xml={EmojiWhiteSvg} size={size} color={color} />;
}

export function RoomVolumeIcon({ size = 22, color }: Props) {
  return <RoomDesignIcon xml={VolumeWhiteSvg} size={size} color={color} />;
}

export function RoomChatIcon({ size = 22, color }: Props) {
  return <RoomDesignIcon xml={ChatRoomWhiteSvg} size={size} color={color} />;
}

/** Comment.svg — شريط الروم السفلي */
export function RoomCommentIcon({ size = 22, color }: Props) {
  return <RoomDesignIcon xml={CommentWhiteSvg} size={size} color={color} />;
}

export function RoomGiftIcon({ size = 22, color }: Props) {
  return <RoomDesignIcon xml={GiftWhiteSvg} size={size} color={color} />;
}

export function RoomMoreIcon({ size = 22, color }: Props) {
  return <RoomDesignIcon xml={GridWhiteSvg} size={size} color={color} />;
}

export function RoomCopyIcon({ size = 18 }: Props) {
  return <DesignIcon xml={CopyWhiteSvg} size={size} />;
}

export function RoomPowerIcon({ size = 18 }: Props) {
  return <DesignIcon xml={PowerWhiteSvg} size={size} />;
}

export function RoomAddIcon({ size = 16 }: Props) {
  return <DesignIcon xml={AddWhiteSvg} size={size} />;
}

/** Add.svg — زر أبيض في الهيدر (علامة + داكنة) */
export function RoomAddInkIcon({ size = 14 }: Props) {
  return <DesignIcon xml={AddSvg} size={size} />;
}

export function RoomTrophyIcon({ size = 14 }: Props) {
  return <DesignIcon xml={TrophyWhiteSvg} size={size} />;
}

export function RoomPartyIcon({ size = 14 }: Props) {
  return <DesignIcon xml={PartySvg.replace(/#1B1B22/g, '#FFFFFF')} size={size} />;
}

export function RoomEditIcon({ size = 14 }: Props) {
  return <DesignIcon xml={EditWhiteSvg} size={size} />;
}
