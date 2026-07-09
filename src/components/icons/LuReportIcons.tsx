/**
 * أيقونات شاشة الإبلاغ — من حزمة Line up / assets/design/icons
 * stroked SVG بنفس أسلوب LuDesignIcons
 */
import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import type { LuDesignIconProps } from './LuDesignIcons';

export type ReportIconComponent = React.FC<LuDesignIconProps>;

/** درع + تنبيه — بطاقة الترحيب */
export function LuReportHeroIcon({
  size = 32,
  color = '#E11414',
  strokeWidth = 1.5,
}: LuDesignIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2.75L19.25 5.75V11.25C19.25 15.55 16.35 19.35 12 21.25C7.65 19.35 4.75 15.55 4.75 11.25V5.75L12 2.75Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path d="M12 8V13" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Circle cx="12" cy="16.25" r="0.9" fill={color} />
    </Svg>
  );
}

/** Chat.svg — سبام / إزعاج متكرر */
export function LuChatSpamIcon({
  size = 20,
  color = '#1B1B22',
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
        d="M8 15C8.91212 16.2144 10.3643 17 12 17C13.6357 17 15.0879 16.2144 16 15"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8.75 8.75C8.75 8.33579 8.58211 8 8.375 8C8.16789 8 8 8.33579 8 8.75C8 9.16421 8.16789 9.5 8.375 9.5C8.58211 9.5 8.75 9.16421 8.75 8.75ZM16 8.75C16 8.33579 15.8321 8 15.625 8C15.4179 8 15.25 8.33579 15.25 8.75C15.25 9.16421 15.4179 9.5 15.625 9.5C15.8321 9.5 16 9.16421 16 8.75Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** MicOff.svg — تحرش / تنمر */
export function LuHarassmentIcon({
  size = 20,
  color = '#1B1B22',
  strokeWidth = 1.5,
}: LuDesignIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M2 2L22 22" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path
        d="M4 11C4 15.4183 7.58172 19 12 19M12 19C13.9545 19 15.7454 18.2991 17.1348 17.1348M12 19V22M12 22H15M12 22H9M20 11C20 12.6514 19.4996 14.1859 18.6422 15.4603"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M7 6.98V11C7 13.7614 9.23858 16 12 16C13.1354 16 14.1647 15.6096 15.004 14.972M16.4387 13.244C16.7973 12.5545 17 11.8309 17 11V6.98C17 4.21858 14.7614 2 12 2C10.1312 2 8.53009 2.96527 7.672 4.484"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** محتوى غير لائق — عين مشطوبة */
export function LuInappropriateIcon({
  size = 20,
  color = '#1B1B22',
  strokeWidth = 1.5,
}: LuDesignIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2.5 12C2.5 12 6.5 5 12 5C17.5 5 21.5 12 21.5 12C21.5 12 17.5 19 12 19C6.5 19 2.5 12 2.5 12Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="12" r="2.75" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M4 4L20 20" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

/** User.svg + خط — حساب مزيف */
export function LuFakeAccountIcon({
  size = 20,
  color = '#1B1B22',
  strokeWidth = 1.5,
}: LuDesignIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15.5 10.5C15.5 8.567 13.933 7 12 7C10.067 7 8.5 8.567 8.5 10.5C8.5 12.433 10.067 14 12 14C13.933 14 15.5 12.433 15.5 10.5Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M18 20C18 16.6863 15.3137 14 12 14C8.68629 14 6 16.6863 6 20"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M5.5 5.5L18.5 18.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

/** Coin.svg — احتيال / نصب */
export function LuScamIcon({
  size = 20,
  color = '#1B1B22',
  strokeWidth = 1.5,
}: LuDesignIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15.5 13C19.0899 13 22 12.1046 22 11C22 9.89543 19.0899 9 15.5 9C11.9101 9 9 9.89543 9 11C9 12.1046 11.9101 13 15.5 13Z"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Path
        d="M22 15.5C22 16.6046 19.0899 17.5 15.5 17.5C11.9101 17.5 9 16.6046 9 15.5"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Path
        d="M22 11V19.8C22 21.015 19.0899 22 15.5 22C11.9101 22 9 21.015 9 19.8V11"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Path
        d="M8.5 6C12.0899 6 15 5.10457 15 4C15 2.89543 12.0899 2 8.5 2C4.91015 2 2 2.89543 2 4C2 5.10457 4.91015 6 8.5 6Z"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Path
        d="M6 11C4.10819 10.7698 2.36991 10.1745 2 9M6 16C4.10819 15.7698 2.36991 15.1745 2 14"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M6 21C4.10819 20.7698 2.36991 20.1745 2 19V4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path d="M15 6V4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

/** Blocked list.svg — خطاب كراهية / محظور */
export function LuHateSpeechIcon({
  size = 20,
  color = '#1B1B22',
  strokeWidth = 1.5,
}: LuDesignIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5.25 5L19.25 19"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M22.25 12C22.25 6.47715 17.7728 2 12.25 2C6.72715 2 2.25 6.47715 2.25 12C2.25 17.5228 6.72715 22 12.25 22C17.7728 22 22.25 17.5228 22.25 12Z"
        stroke={color}
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}

/** Power.svg — عنف / تهديد */
export function LuViolenceIcon({
  size = 20,
  color = '#1B1B22',
  strokeWidth = 1.5,
}: LuDesignIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18.7083 6C20.1334 7.59227 21 9.69494 21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 9.69494 3.86656 7.59227 5.29168 6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M12 3V12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** User-2.svg — قاصر */
export function LuUnderageIcon({
  size = 20,
  color = '#1B1B22',
  strokeWidth = 1.5,
}: LuDesignIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path
        d="M12.9173 8.7487C12.9173 7.13786 11.6115 5.83203 10.0007 5.83203C8.38982 5.83203 7.08398 7.13786 7.08398 8.7487C7.08398 10.3595 8.38982 11.6654 10.0007 11.6654C11.6115 11.6654 12.9173 10.3595 12.9173 8.7487Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M18.3327 10.0013C18.3327 5.39893 14.6017 1.66797 9.99935 1.66797C5.39697 1.66797 1.66602 5.39893 1.66602 10.0013C1.66602 14.6036 5.39697 18.3346 9.99935 18.3346C14.6017 18.3346 18.3327 14.6036 18.3327 10.0013Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M15 16.668C15 13.9066 12.7614 11.668 10 11.668C7.23857 11.668 5 13.9066 5 16.668"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Feedback.svg — سبب آخر / بلاغ عام */
export function LuReportOtherIcon({
  size = 20,
  color = '#1B1B22',
  strokeWidth = 1.5,
}: LuDesignIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14 6H22M18 2V10"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6.09881 19.5C4.7987 19.3721 3.82475 18.9816 3.17157 18.3284C2 17.1569 2 15.2712 2 11.5V11C2 7.22876 2 5.34315 3.17157 4.17157C4.34315 3 6.22876 3 10 3H11.5M6.5 18C6.29454 19.0019 5.37769 21.1665 6.31569 21.8651C6.806 22.2218 7.58729 21.8408 9.14987 21.0789C10.2465 20.5441 11.3562 19.9309 12.5546 19.655C12.9931 19.5551 13.4395 19.5125 14 19.5C17.7712 19.5 19.6569 19.5 20.8284 18.3284C21.947 17.2098 21.9976 15.4403 21.9999 12"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M8 14H14M8 9H11"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Add.svg */
export function LuAddIcon({
  size = 22,
  color = '#E11414',
  strokeWidth = 1.5,
}: LuDesignIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12.001 5.00003V19.002" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M19.002 12.002H5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

/** علامة صح للخصوصية */
export function LuPrivacyCheckIcon({
  size = 16,
  color = '#2BD9A8',
  strokeWidth = 2,
}: LuDesignIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 12.5L10 17.5L19 7.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
