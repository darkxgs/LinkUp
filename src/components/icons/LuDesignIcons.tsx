/**
 * أيقونات حزمة التصميم (Line up App Full File / Icons)
 */
import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, Path, Rect, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { COIN_CURRENCY_ICON } from '@/constants/brandAssets';

export type LuDesignIconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function LuSearchIcon({
  size = 24,
  color = '#1B1B22',
  strokeWidth = 1.5,
}: LuDesignIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17 17L21 21"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function LuNotificationIcon({
  size = 24,
  color = '#1B1B22',
  strokeWidth = 1.5,
}: LuDesignIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 18V9.5C19 5.63401 15.866 2.5 12 2.5C8.13401 2.5 5 5.63401 5 9.5V18"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M20.5 18H3.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M13.5 20C13.5 20.8284 12.8284 21.5 12 21.5M12 21.5C11.1716 21.5 10.5 20.8284 10.5 20M12 21.5V20"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** قلب المفضلة — Like.svg من التصميم */
export function LuLikeIcon({
  size = 24,
  color = '#FFFFFF',
  strokeWidth = 1.5,
  filled = false,
}: LuDesignIconProps & { filled?: boolean }) {
  if (filled) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M10.4107 19.9677C7.58942 17.858 2 13.0348 2 8.69444C2 5.82563 4.10526 3.5 7 3.5C8.5 3.5 10 4 12 6C14 4 15.5 3.5 17 3.5C19.8947 3.5 22 5.82563 22 8.69444C22 13.0348 16.4106 17.858 13.5893 19.9677C12.6399 20.6776 11.3601 20.6776 10.4107 19.9677Z"
          fill={color}
        />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M10.4107 19.9677C7.58942 17.858 2 13.0348 2 8.69444C2 5.82563 4.10526 3.5 7 3.5C8.5 3.5 10 4 12 6C14 4 15.5 3.5 17 3.5C19.8947 3.5 22 5.82563 22 8.69444C22 13.0348 16.4106 17.858 13.5893 19.9677C12.6399 20.6776 11.3601 20.6776 10.4107 19.9677Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function LuArrowIcon({
  size = 24,
  color = '#1B1B22',
  strokeWidth = 1.5,
  direction = 'left',
}: LuDesignIconProps & { direction?: 'left' | 'right' }) {
  const flip = direction === 'right' ? { transform: [{ scaleX: -1 }] as const } : undefined;
  const svg = (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5.49848 12L18.9985 12"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10.9976 18C10.9976 18 4.99766 13.5811 4.99756 12C4.99756 10.4188 10.9976 6 10.9976 6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
  return flip ? <View style={flip}>{svg}</View> : svg;
}

/** شارة التوثيق — من test (2)/app/icons.jsx */
export function LuVerifiedIcon({
  size = 15,
  color = '#E11414',
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="m9 1.5 1.8 1.4 2.3-.2 1 2.1 2.1 1-.2 2.3L19.3 13l-1.4 1.8.2 2.3-2.1 1-1 2.1-2.3-.2L9.9 21.5 8.1 20l-2.3.2-1-2.1-2.1-1 .2-2.3L1.5 13l1.4-1.8-.2-2.3 2.1-1 1-2.1 2.3.2z"
        fill={color}
        stroke={color}
        strokeWidth={1.2}
      />
      <Path
        d="m7.2 9.2 2 2 3.6-3.6"
        stroke="#fff"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** قلب البطاقة — من test (2)/app/icons.jsx */
export function LuHeartIcon({
  size = 20,
  color = '#FFFFFF',
  filled = true,
}: {
  size?: number;
  color?: string;
  filled?: boolean;
}) {
  if (filled) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 20.5C5.5 16 3 12.4 3 9a4.6 4.6 0 0 1 9-1.6A4.6 4.6 0 0 1 21 9c0 3.4-2.5 7-9 11.5z"
          fill={color}
          stroke={color}
        />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 20.5C5.5 16 3 12.4 3 9a4.6 4.6 0 0 1 9-1.6A4.6 4.6 0 0 1 21 9c0 3.4-2.5 7-9 11.5z"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** قلب ممتلئ بتدرج أحمر — بانر المطابقة */
export function LuGlowHeartIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        <SvgLinearGradient id="luGlowHeart" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FF4D5E" />
          <Stop offset="0.55" stopColor="#F0182E" />
          <Stop offset="1" stopColor="#C40E1E" />
        </SvgLinearGradient>
      </Defs>
      <Path
        d="M11.1 21.9C6.6 18.4 2.9 14.9 1.8 10.6 0.9 6.8 3 2.9 7 2.3c2.4-0.4 4.3 1.1 5 3.2 1.1-2.6 3.7-4.1 6.5-3.5 3.5 0.8 5 4.3 3.9 7.9-1.3 4.1-5.4 5.1-8.2 7.5-1.3 1.1-2.4 2.8-3.1 4.5z"
        fill="url(#luGlowHeart)"
      />
    </Svg>
  );
}

/** أيقونات الشات — من test (2)/app/icons.jsx */
export function LuSettingsIcon({
  size = 24,
  color = '#1A0A0C',
  strokeWidth = 1.9,
}: LuDesignIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function LuSlidersIcon({
  size = 24,
  color = '#5E5E68',
  strokeWidth = 1.9,
}: LuDesignIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 21V14M5 10V3M12 21v-9M12 8V3M19 21v-5M19 12V3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M2.5 14h5M9.5 8h5M16.5 16h5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function LuSendIcon({
  size = 24,
  color = '#FFFFFF',
  filled = false,
  strokeWidth = 1.5,
}: LuDesignIconProps & { filled?: boolean }) {
  const stroke = filled ? color : color;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21.0477 3.05293C18.8697 0.707361 2.48648 6.4532 2.50001 8.551C2.51535 10.9299 8.89809 11.6617 10.6672 12.1581C11.7311 12.4565 12.016 12.7625 12.2613 13.8781C13.3723 18.9305 13.9301 21.4435 15.2014 21.4996C17.2278 21.5892 23.1733 5.342 21.0477 3.05293Z"
        fill={filled ? color : 'none'}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      <Path
        d="M11.5 12.5L15 9"
        stroke={filled ? '#fff' : color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Emoji.svg — Line up App Full File */
export function LuEmojiIcon({
  size = 20,
  color = '#1B1B22',
  strokeWidth = 1.5,
}: LuDesignIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path
        d="M9.99984 18.3327C14.6022 18.3327 18.3332 14.6017 18.3332 9.99935C18.3332 5.39698 14.6022 1.66602 9.99984 1.66602C5.39746 1.66602 1.6665 5.39698 1.6665 9.99935C1.6665 14.6017 5.39746 18.3327 9.99984 18.3327Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6.6665 12.5C7.4266 13.512 8.63675 14.1667 9.99984 14.1667C11.3629 14.1667 12.5731 13.512 13.3332 12.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M5.4165 7.33268C5.70155 6.92787 6.15535 6.66602 6.6665 6.66602C7.17765 6.66602 7.63146 6.92787 7.9165 7.33268M12.0832 7.33268C12.3682 6.92787 12.822 6.66602 13.3332 6.66602C13.8443 6.66602 14.2982 6.92787 14.5832 7.33268"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function LuSmileIcon({
  size = 24,
  color = '#9A9AA5',
  strokeWidth = 1.5,
}: LuDesignIconProps) {
  return <LuEmojiIcon size={size * 0.85} color={color} strokeWidth={strokeWidth} />;
}

/** Mic.svg */
export function LuMicIcon({
  size = 24,
  color = '#1B1B22',
  strokeWidth = 1.5,
}: LuDesignIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17 7V11C17 13.7614 14.7614 16 12 16C9.23858 16 7 13.7614 7 11V7C7 4.23858 9.23858 2 12 2C14.7614 2 17 4.23858 17 7Z"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Path
        d="M20 11C20 15.4183 16.4183 19 12 19M12 19C7.58172 19 4 15.4183 4 11M12 19V22M12 22H15M12 22H9"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Volume.svg — مكالمة صوتية */
export function LuVolumeIcon({
  size = 24,
  color = '#E11414',
  strokeWidth = 1.5,
}: LuDesignIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14 14.8135V9.18646C14 6.04126 14 4.46866 13.0747 4.0773C12.1494 3.68593 11.0603 4.79793 8.88232 7.02192C7.75439 8.17365 7.11085 8.42869 5.50604 8.42869C4.10257 8.42869 3.40084 8.42869 2.89675 8.77262C1.85035 9.48655 2.00852 10.882 2.00852 12C2.00852 13.118 1.85035 14.5134 2.89675 15.2274C3.40084 15.5713 4.10257 15.5713 5.50604 15.5713C7.11085 15.5713 7.75439 15.8264 8.88232 16.9781C11.0603 19.2021 12.1494 20.3141 13.0747 19.9227C14 19.5313 14 17.9587 14 14.8135Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M17 9C17.6254 9.81968 18 10.8634 18 12C18 13.1366 17.6254 14.1803 17 15" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M20 7C21.2508 8.36613 22 10.1057 22 12C22 13.8943 21.2508 15.6339 20 17" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** أيقونة فيديو — نفس ستاك stroke (#E11414) */
export function LuVideoCallIcon({
  size = 24,
  color = '#E11414',
  strokeWidth = 1.5,
}: LuDesignIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 7.5C3 6.67157 3.67157 6 4.5 6H14.5C15.3284 6 16 6.67157 16 7.5V16.5C16 17.3284 15.3284 18 14.5 18H4.5C3.67157 18 3 17.3284 3 16.5V7.5Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path
        d="M16 10.5L21 8V16L16 13.5V10.5Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** File-2.svg — مرفقات / مستندات */
export function LuFileAttachIcon({
  size = 24,
  color = '#1B1B22',
  strokeWidth = 1.5,
}: LuDesignIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14.4999 17.5V7.5H7.50004C5.14304 7.5 3.96454 7.5 3.23231 8.23222C2.50007 8.96445 2.50006 10.1429 2.50004 12.5L2.5 16.5C2.49998 18.857 2.49997 20.0355 3.2322 20.7678C3.96444 21.5 5.14296 21.5 7.5 21.5H10.4999C12.3855 21.5 13.3283 21.5 13.9141 20.9142C14.4999 20.3284 14.4999 19.3856 14.4999 17.5Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14.4998 16.5H16.4998C18.8568 16.5 20.0354 16.5 20.7676 15.7678C21.4998 15.0355 21.4998 13.857 21.4998 11.5V7.5C21.4998 5.14298 21.4998 3.96447 20.7676 3.23223C20.0354 2.5 18.8568 2.5 16.4998 2.5H9.5L9.50014 7.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M5.5 12.5H9M5.5 16.5H11.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9.5 2.5L14.5 7.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function LuMoreIcon({
  size = 24,
  color = '#1A0A0C',
}: Omit<LuDesignIconProps, 'strokeWidth'>) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="5" cy="12" r="1.5" fill={color} />
      <Circle cx="12" cy="12" r="1.5" fill={color} />
      <Circle cx="19" cy="12" r="1.5" fill={color} />
    </Svg>
  );
}

export function LuGiftIcon({
  size = 24,
  color = '#1B1B22',
  strokeWidth = 1.5,
  filled = false,
}: LuDesignIconProps & { filled?: boolean }) {
  const fc = filled ? color : 'none';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 11V15C4 18.2998 4 19.9497 5.02513 20.9749C6.05025 22 7.70017 22 11 22H13C16.2998 22 17.9497 22 18.9749 20.9749C20 19.9497 20 18.2998 20 15V11"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={fc}
      />
      <Path
        d="M3 9C3 8.25231 3 7.87846 3.20096 7.6C3.33261 7.41758 3.52197 7.26609 3.75 7.16077C4.09808 7 4.56538 7 5.5 7H18.5C19.4346 7 19.9019 7 20.25 7.16077C20.478 7.26609 20.6674 7.41758 20.799 7.6C21 7.87846 21 8.25231 21 9C21 9.74769 21 10.1215 20.799 10.4C20.6674 10.5824 20.478 10.7339 20.25 10.8392C19.9019 11 19.4346 11 18.5 11H5.5C4.56538 11 4.09808 11 3.75 10.8392C3.52197 10.7339 3.33261 10.5824 3.20096 10.4C3 10.1215 3 9.74769 3 9Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path
        d="M6 3.78571C6 2.79949 6.79949 2 7.78571 2H8.14286C10.2731 2 12 3.7269 12 5.85714V7H9.21429C7.43908 7 6 5.56091 6 3.78571Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path
        d="M18 3.78571C18 2.79949 17.2005 2 16.2143 2H15.8571C13.7269 2 12 3.7269 12 5.85714V7H14.7857C16.5609 7 18 5.56091 18 3.78571Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path d="M12 11V22" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** عصّالة — لإهداء/دعم المنشورات (بدل صندوق الهدية في الفيد) */
export function LuPiggyBankIcon({
  size = 24,
  color = '#1B1B22',
  strokeWidth = 1.5,
  filled = false,
}: LuDesignIconProps & { filled?: boolean }) {
  const bodyFill = filled ? `${color}28` : 'none';
  const snoutFill = filled ? color : 'none';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M10 3.2h4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M5.2 12.2c0-3.6 3.2-6.2 6.8-6.2s6.8 2.6 6.8 6.2v5.3c0 1.4-1 2.3-2.4 2.3H7.6c-1.4 0-2.4-.9-2.4-2.3v-5.3z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        fill={bodyFill}
      />
      <Circle
        cx={5.4}
        cy={13.2}
        r={2.1}
        stroke={color}
        strokeWidth={strokeWidth}
        fill={snoutFill}
      />
      <Circle cx={5.4} cy={13.2} r={0.55} fill={filled ? '#fff' : color} />
      <Circle cx={9.6} cy={10.8} r={0.75} fill={color} />
      <Path
        d="M8.4 19.2v1.4M15.6 19.2v1.4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M18.6 13.8c.9.8 1.2 1.8.3 2.7"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {filled ? (
        <Circle cx={12} cy={3.8} r={1.7} fill="#FFB000" stroke={color} strokeWidth={1} />
      ) : null}
    </Svg>
  );
}

/** أيقونة الكوينز — Coin.png */
export function LuCoinIcon({
  size = 24,
}: LuDesignIconProps) {
  return (
    <Image
      source={COIN_CURRENCY_ICON}
      style={{ width: size, height: size }}
      contentFit="contain"
    />
  );
}

/** Rocket.svg — Line up App Full File */
export function LuRocketIcon({
  size = 24,
  color = '#E11414',
  strokeWidth = 1.5,
}: LuDesignIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M11.8013 6.48949L13.2869 5.00392C14.9596 3.3312 17.1495 2.63737 19.4671 2.52399C20.3686 2.47989 20.8193 2.45784 21.1807 2.81928C21.5422 3.18071 21.5201 3.63143 21.476 4.53289C21.3626 6.8505 20.6688 9.04042 18.9961 10.7131L17.5105 12.1987C16.2871 13.4221 15.9393 13.77 16.1961 15.097C16.4496 16.1107 16.6949 17.0923 15.9578 17.8294C15.0637 18.7235 14.2481 18.7235 13.354 17.8294L6.17058 10.646C5.27649 9.75188 5.27646 8.9363 6.17058 8.04219C6.90767 7.30509 7.88929 7.55044 8.90297 7.80389C10.23 8.06073 10.5779 7.71289 11.8013 6.48949Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path d="M2.5 21.5L7.5 16.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M8.5 21.5L10.5 19.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M2.5 15.5L4.5 13.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path
        d="M17.125 7H17M17.25 7C17.25 7.13807 17.1381 7.25 17 7.25C16.8619 7.25 16.75 7.13807 16.75 7C16.75 6.86193 16.8619 6.75 17 6.75C17.1381 6.75 17.25 6.86193 17.25 7Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** male.svg — رمز ذكر (Mars) بنفس أسلوب female.svg */
export function LuMaleIcon({
  size = 24,
  color = '#1B1B22',
  strokeWidth = 1.5,
}: LuDesignIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14.5 10.5L21 4M17 4H21V8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10 16C13.3137 16 16 13.3137 16 10C16 6.68629 13.3137 4 10 4C6.68629 4 4 6.68629 4 10C4 13.3137 6.68629 16 10 16Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** female.svg — Line up App Full File */
export function LuFemaleIcon({
  size = 24,
  color = '#1B1B22',
  strokeWidth = 1.5,
}: LuDesignIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 14C15.3137 14 18 11.3137 18 8C18 4.68629 15.3137 2 12 2C8.68629 2 6 4.68629 6 8C6 11.3137 8.68629 14 12 14ZM12 14V22M9 19H15"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function LuSparkleIcon({
  size = 24,
  color = '#FFFFFF',
  strokeWidth = 1.9,
  filled = true,
}: LuDesignIconProps & { filled?: boolean }) {
  const fc = filled ? color : 'none';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2.5l1.9 6.4 6.6 1.9-6.6 1.9L12 19.5l-1.9-6.8-6.6-1.9 6.6-1.9z"
        fill={fc}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** تاج — للموضوع الملكي (Royal PK) */
export function LuCrownIcon({
  size = 24,
  color = '#FFFFFF',
  strokeWidth = 1.6,
  filled = true,
}: LuDesignIconProps & { filled?: boolean }) {
  const fc = filled ? color : 'none';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 8.2l4.2 3.1L12 4.5l4.8 6.8L21 8.2l-1.6 9.8H4.6z"
        fill={fc}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path d="M4.8 20.6h14.4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

/** قمر — لليالي الساحرة (Magical Nights) */
export function LuMoonIcon({
  size = 24,
  color = '#FFFFFF',
  strokeWidth = 1.6,
  filled = true,
}: LuDesignIconProps & { filled?: boolean }) {
  const fc = filled ? color : 'none';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 12.9A8.6 8.6 0 1 1 11.1 3.3 6.7 6.7 0 0 0 21 12.9Z"
        fill={fc}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** جوهرة — لحفل الزفاف */
export function LuGemIcon({
  size = 24,
  color = '#FFFFFF',
  strokeWidth = 1.5,
  filled = true,
}: LuDesignIconProps & { filled?: boolean }) {
  const fc = filled ? color : 'none';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3.2 9.2 7 4h10l3.8 5.2L12 20.6z"
        fill={fc}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path
        d="M3.2 9.2h17.6M8 4 6 9.2l6 11.4 6-11.4L16 4"
        stroke={filled ? 'rgba(0,0,0,0.16)' : color}
        strokeWidth={1}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** بوصلة الاستكشاف (Discover) — دائرة + إبرة ملاحة كما في التصميم */
export function LuCompassIcon({
  size = 24,
  color = '#FFFFFF',
  strokeWidth = 1.7,
}: LuDesignIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9.2" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M15.7 8.3 13.3 13.3 8.3 15.7 10.7 10.7Z"
        fill={color}
        stroke={color}
        strokeWidth={1}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function LuUserIcon({
  size = 24,
  color = '#5E5E68',
  strokeWidth = 1.9,
  filled = false,
}: LuDesignIconProps & { filled?: boolean }) {
  const fc = filled ? color : 'none';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="4.2" fill={fc} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" fill={fc} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function LuFlagIcon({
  size = 24,
  color = '#5E5E68',
  strokeWidth = 1.9,
}: LuDesignIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 21V4h13l-2.5 4L18 12H5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Globel.svg — تبويب Discover/استكشف */
export function LuGlobeIcon({
  size = 18,
  color = '#1B1B22',
  strokeWidth = 1.5,
}: LuDesignIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21.9995 12.001C21.9995 6.47813 17.5223 2.00098 11.9995 2.00098C6.47666 2.00098 1.99951 6.47813 1.99951 12.001C1.99951 17.5238 6.47666 22.001 11.9995 22.001C17.5223 22.001 21.9995 17.5238 21.9995 12.001Z"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Path
        d="M20.0005 5.69997C19.0658 5.76734 17.8686 6.12922 17.0384 7.20375C15.539 9.14459 14.0395 9.30654 13.0399 8.65959C11.5404 7.68918 12.8005 6.11734 11.0406 5.26313C9.89362 4.7064 9.7337 3.19143 10.3721 2.00098"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path
        d="M1.99951 11.001C2.76201 11.6631 3.82997 12.2692 5.08825 12.2692C7.68794 12.2692 8.20788 12.7659 8.20788 14.7528C8.20788 16.7397 8.20788 16.7397 8.72782 18.2298C9.06602 19.1991 9.18423 20.1684 8.51011 21.001"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path
        d="M21.9995 13.4513C21.1124 12.9401 19.9995 12.7298 18.8729 13.5395C16.7172 15.0888 15.2309 13.805 14.5614 15.0879C13.576 16.9765 17.0952 17.5701 13.9995 21.999"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Comment.svg — Line up App Full File */
export function LuCommentIcon({
  size = 22,
  color = '#5E5E68',
  strokeWidth = 1.5,
}: LuDesignIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21.5 12C21.5 17.2467 17.2467 21.5 12 21.5C10.3719 21.5 8.8394 21.0904 7.5 20.3687C5.63177 19.362 4.37462 20.2979 3.26592 20.4658C3.09774 20.4913 2.93024 20.4302 2.80997 20.31C2.62741 20.1274 2.59266 19.8451 2.6935 19.6074C3.12865 18.5818 3.5282 16.6382 2.98341 15C2.6698 14.057 2.5 13.0483 2.5 12C2.5 6.75329 6.75329 2.5 12 2.5C17.2467 2.5 21.5 6.75329 21.5 12Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12.1257 12H12.0007M8.125 12H8M16.125 12H16"
        stroke={color}
        strokeWidth={strokeWidth + 0.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Share.svg — Line up App Full File */
export function LuShareIcon({
  size = 22,
  color = '#5E5E68',
  strokeWidth = 1.5,
}: LuDesignIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9.39567 4.5H8.354C5.40772 4.5 3.93458 4.5 3.01929 5.37868C2.104 6.25736 2.104 7.67157 2.104 10.5V14.5C2.104 17.3284 2.104 18.7426 3.01929 19.6213C3.93458 20.5 5.40772 20.5 8.354 20.5H12.5606C15.5069 20.5 16.98 20.5 17.8953 19.6213C18.4883 19.052 18.6971 18.2579 18.7706 17"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16.1667 7V3.85355C16.1667 3.65829 16.3316 3.5 16.535 3.5C16.6326 3.5 16.7263 3.53725 16.7954 3.60355L21.5275 8.14645C21.7634 8.37282 21.8958 8.67986 21.8958 9C21.8958 9.32014 21.7634 9.62718 21.5275 9.85355L16.7954 14.3964C16.7263 14.4628 16.6326 14.5 16.535 14.5C16.3316 14.5 16.1667 14.3417 16.1667 14.1464V11H13.1157C8.875 11 7.3125 14.5 7.3125 14.5V12C7.3125 9.23858 9.64435 7 12.5208 7H16.1667Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Edit.svg — زر إنشاء منشور عائم */
export function LuEditIcon({
  size = 24,
  color = '#FFFFFF',
  strokeWidth = 1.7,
}: LuDesignIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19.3949 7.57506L12.7356 14.2344C12.228 14.7419 11.5922 15.102 10.8959 15.276L8 16L8.72397 13.1041C8.89804 12.4078 9.25807 11.772 9.76558 11.2644L16.4249 4.60509L17.4149 3.6151C18.2351 2.79497 19.5648 2.79497 20.3849 3.6151C21.205 4.43524 21.205 5.76493 20.3849 6.58507L19.3949 7.57506ZM16.4249 4.60509L19.3949 7.57506"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path
        d="M18.9999 13.5C18.9999 16.7875 18.9999 18.4312 18.092 19.5376C17.9258 19.7401 17.7401 19.9258 17.5375 20.092C16.4312 21 14.7874 21 11.4999 21H11C7.22876 21 5.34316 21 4.17159 19.8284C3.00003 18.6569 3 16.7712 3 13V12.5C3 9.21252 3 7.56879 3.90794 6.46244C4.07417 6.2599 4.2599 6.07417 4.46244 5.90794C5.56879 5 7.21252 5 10.5 5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** أيقونة الألعاب — من Game.svg في حزمة التصميم */
export function LuGameIcon({
  size = 24,
  color = '#1B1B22',
  strokeWidth = 1.5,
}: LuDesignIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3.01482 18.0594C3.66096 18.6865 4.44014 19 5.35234 19C5.99088 19 6.58381 18.8396 7.13113 18.5188C7.67845 18.1979 8.08894 17.7604 8.3626 17.2063C8.67352 16.6032 8.82897 16.3016 9.05443 16.0785C9.27607 15.8591 9.54593 15.6946 9.84245 15.5982C10.1441 15.5 10.4834 15.5 11.1619 15.5H12.841C13.5004 15.5 13.8301 15.5 14.1236 15.5925C14.4382 15.6917 14.7233 15.8671 14.9537 16.1032C15.1686 16.3234 15.3173 16.6177 15.6146 17.2063C15.8883 17.7604 16.2988 18.1979 16.8461 18.5188C17.3934 18.8396 17.9864 19 18.6249 19C19.5523 19 20.3467 18.6901 21.008 18.0703C21.6694 17.4505 22 16.6958 22 15.8063C22 15.675 21.9886 15.5401 21.9658 15.4016C21.943 15.263 21.9164 15.1281 21.886 14.9969L20.8403 10.983C20.0911 8.10773 19.7166 6.67008 18.6361 5.83504C17.5556 5 16.07 5 13.0987 5H10.8855C7.91884 5 6.43552 5 5.3558 5.83306C4.27608 6.66613 3.89978 8.10093 3.14719 10.9705L2.09122 14.9969C2.06081 15.1281 2.03801 15.2594 2.0228 15.3906C2.0076 15.5219 2 15.6531 2 15.7844C2.0304 16.674 2.36868 17.4323 3.01482 18.0594Z"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Path
        d="M8.495 8.50781V12.5078M10.5 10.5028H6.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16.75 9.125V9.25M17 9.25C17 9.38807 16.8881 9.5 16.75 9.5C16.6119 9.5 16.5 9.38807 16.5 9.25C16.5 9.11193 16.6119 9 16.75 9C16.8881 9 17 9.11193 17 9.25Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14.25 11.625V11.75M14.5 11.75C14.5 11.8881 14.3881 12 14.25 12C14.1119 12 14 11.8881 14 11.75C14 11.6119 14.1119 11.5 14.25 11.5C14.3881 11.5 14.5 11.6119 14.5 11.75Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** أيقونة الحفظ (Bookmark) — بنفس ستايل ستروك حزمة التصميم */
export function LuBookmarkIcon({
  size = 22,
  color = '#5E5E68',
  strokeWidth = 1.5,
  filled = false,
}: LuDesignIconProps & { filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 6.5C5 4.84315 6.34315 3.5 8 3.5H16C17.6569 3.5 19 4.84315 19 6.5V20.1716C19 21.0625 17.9229 21.5086 17.2929 20.8787L12.7071 16.2929C12.3166 15.9024 11.6834 15.9024 11.2929 16.2929L6.70711 20.8787C6.07714 21.5086 5 21.0625 5 20.1716V6.5Z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
