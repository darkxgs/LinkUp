/**
 * أيقونات شاشة مستوى الثروة — Line up App Full File / Icons (SVG أصلية)
 */
import React from 'react';
import { I18nManager, View } from 'react-native';
import { DesignIcon } from '@/components/icons/DesignIcon';
import {
  BackArrowSvg,
  GameSvg,
  GiftSvg,
  HomeSvg,
  LockSvg,
  LockWhiteSvg,
  MicSvg,
  QuestionSvg,
  RocketSvg,
} from '@/components/icons/designSvgs';

// color مقبول للتوافق مع المستدعين؛ الأيقونات هنا بألوان ثابتة فلا يُطبَّق (السلوك كما هو)
type IconProps = { size?: number; color?: string };

export function WlBackIcon({ size = 20 }: IconProps) {
  const mirror = I18nManager.isRTL ? ({ transform: [{ scaleX: -1 }] } as const) : undefined;
  return (
    <View style={mirror}>
      <DesignIcon xml={BackArrowSvg} size={size} />
    </View>
  );
}

export function WlQuestionIcon({ size = 20 }: IconProps) {
  return <DesignIcon xml={QuestionSvg} size={size} />;
}

export function WlLockWhiteIcon({ size = 11 }: IconProps) {
  return <DesignIcon xml={LockWhiteSvg} size={size} />;
}

export function WlLockIcon({ size = 16 }: IconProps) {
  return <DesignIcon xml={LockSvg} size={size} />;
}

export function WlHomeIcon({ size = 20 }: IconProps) {
  return <DesignIcon xml={HomeSvg} size={size} />;
}

export function WlGameIcon({ size = 20 }: IconProps) {
  return <DesignIcon xml={GameSvg} size={size} />;
}

export function WlMicIcon({ size = 20 }: IconProps) {
  return <DesignIcon xml={MicSvg} size={size} />;
}

export function WlGiftIcon({ size = 18 }: IconProps) {
  return <DesignIcon xml={GiftSvg} size={size} />;
}

export function WlRocketIcon({ size = 18 }: IconProps) {
  return <DesignIcon xml={RocketSvg} size={size} />;
}
