/**
 * أيقونات شريط التبويب السفلي — Line up App Full File / Icons
 * Home | File (feed) | Heart (rooms) | Chat | profile = avatar
 */
import React from 'react';
import { I18nManager } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { UserPlus, Heart } from 'lucide-react-native';
import { lu } from '@/theme/lu-brand';

// ذيل فقاعة الشات ينعكس حسب اللغة (يسار بالإنجليزية / يمين بالعربية)
const CHAT_MIRROR = { transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] } as const;

/** outline غير النشط — رمادي واضح على الأبيض */
const INACTIVE = '#9A9AA5';
/** أيقونة بيضاء داخل الكبسولة الحمراء النشطة */
const ACTIVE_FILL = '#FFFFFF';

export type LuTabIconProps = {
  size?: number;
  active?: boolean;
};

function strokeColor(active?: boolean) {
  return active ? ACTIVE_FILL : INACTIVE;
}

function fillColor(active?: boolean) {
  return active ? ACTIVE_FILL : INACTIVE;
}

/** Home.svg / Home-1.svg */
export function LuTabHomeIcon({ size = 24, active = false }: LuTabIconProps) {
  const c = strokeColor(active);
  const f = fillColor(active);
  if (active) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M3 11.9896V14.5C3 17.7998 3 19.4497 4.02513 20.4749C5.05025 21.5 6.70017 21.5 10 21.5H14C17.2998 21.5 18.9497 21.5 19.9749 20.4749C21 19.4497 21 17.7998 21 14.5V11.9896C21 10.3083 21 9.46773 20.6441 8.74005C20.2882 8.01237 19.6247 7.49628 18.2976 6.46411L16.2976 4.90855C14.2331 3.30285 13.2009 2.5 12 2.5C10.7991 2.5 9.76689 3.30285 7.70242 4.90855L5.70241 6.46411C4.37533 7.49628 3.71179 8.01237 3.3559 8.74005C3 9.46773 3 10.3083 3 11.9896Z"
          fill={f}
        />
        <Path
          d="M15 17C14.2005 17.6224 13.1502 18 12 18C10.8497 18 9.79953 17.6224 9 17"
          stroke="#fff"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12.8924 2.80982L21.4876 9.59547C21.8112 9.85095 22 10.2405 22 10.6528C22 11.3969 21.3969 12 20.6528 12H20V15.5C20 18.3284 20 19.7426 19.1213 20.6213C18.2426 21.5 16.8284 21.5 14 21.5H10C7.17157 21.5 5.75736 21.5 4.87868 20.6213C4 19.7426 4 18.3284 4 15.5V12H3.34716C2.60315 12 2 11.3969 2 10.6528C2 10.2405 2.1888 9.85095 2.5124 9.59547L11.1076 2.80982C11.3617 2.60915 11.6761 2.5 12 2.5C12.3239 2.5 12.6383 2.60915 12.8924 2.80982Z"
        stroke={c}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14.5 21.5V17C14.5 16.0654 14.5 15.5981 14.299 15.25C14.1674 15.022 13.978 14.8326 13.75 14.701C13.4019 14.5 12.9346 14.5 12 14.5C11.0654 14.5 10.5981 14.5 10.25 14.701C10.022 14.8326 9.83261 15.022 9.70096 15.25C9.5 15.5981 9.5 16.0654 9.5 17V21.5"
        stroke={c}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** File.svg / File-1.svg — تبويب المنشورات */
export function LuTabFeedIcon({ size = 24, active = false }: LuTabIconProps) {
  const c = strokeColor(active);
  const f = fillColor(active);
  if (active) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12.5 2C16.2712 2 18.1565 2.00032 19.3281 3.17188C20.4996 4.34346 20.5 6.22878 20.5 10V14C20.5 17.7712 20.4996 19.6566 19.3281 20.8281C18.1565 21.9997 16.2712 22 12.5 22H11.5C7.72877 22 5.84345 21.9997 4.67188 20.8281C3.50031 19.6565 3.49997 17.7712 3.5 14V10C3.50003 6.22884 3.50035 4.34344 4.67188 3.17188C5.84344 2.00031 7.72883 2 11.5 2H12.5ZM8 16.25C7.58579 16.25 7.25 16.5858 7.25 17C7.25 17.4142 7.58579 17.75 8 17.75H12C12.4142 17.75 12.75 17.4142 12.75 17C12.75 16.5858 12.4142 16.25 12 16.25H8ZM8 11.25C7.58579 11.25 7.25 11.5858 7.25 12C7.25 12.4142 7.58579 12.75 8 12.75H16C16.4142 12.75 16.75 12.4142 16.75 12C16.75 11.5858 16.4142 11.25 16 11.25H8ZM8 6.25C7.58579 6.25 7.25 6.58579 7.25 7C7.25 7.41421 7.58579 7.75 8 7.75H16C16.4142 7.75 16.75 7.41421 16.75 7C16.75 6.58579 16.4142 6.25 16 6.25H8Z"
          fill={f}
        />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20.4999 14V10C20.4999 6.22876 20.4999 4.34315 19.3284 3.17157C18.1568 2 16.2712 2 12.4999 2H11.5C7.72883 2 5.84323 2 4.67166 3.17156C3.50008 4.34312 3.50007 6.22872 3.50004 9.99993L3.5 13.9999C3.49997 17.7712 3.49995 19.6568 4.67153 20.8284C5.8431 22 7.72873 22 11.5 22H12.4999C16.2712 22 18.1568 22 19.3284 20.8284C20.4999 19.6569 20.4999 17.7712 20.4999 14Z"
        stroke={c}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8 7H16M8 12H16M8 17H12"
        stroke={c}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Chat.svg / Chat-1.svg */
export function LuTabChatIcon({ size = 24, active = false }: LuTabIconProps) {
  const c = strokeColor(active);
  const f = fillColor(active);
  if (active) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={CHAT_MIRROR}>
      <Path
        d="M12 2.5C17.2467 2.5 21.5 6.75329 21.5 12C21.5 17.2467 17.2467 21.5 12 21.5C10.372 21.5 8.83936 21.0908 7.5 20.3691C5.63177 19.3624 4.37433 20.2979 3.26562 20.4658C3.09754 20.4912 2.92977 20.4297 2.80957 20.3096C2.62739 20.127 2.59263 19.8449 2.69336 19.6074C3.12851 18.5818 3.52819 16.6382 2.9834 15C2.66979 14.057 2.5 13.0483 2.5 12C2.5 6.75329 6.75329 2.5 12 2.5ZM16.4502 14.4004C16.119 14.1517 15.6491 14.2186 15.4004 14.5498C14.6238 15.5837 13.3898 16.25 12 16.25C10.6102 16.25 9.3762 15.5837 8.59961 14.5498C8.35088 14.2186 7.881 14.1517 7.5498 14.4004C7.21864 14.6491 7.15172 15.119 7.40039 15.4502C8.44805 16.845 10.1184 17.75 12 17.75C13.8816 17.75 15.552 16.8451 16.5996 15.4502C16.8483 15.119 16.7814 14.6491 16.4502 14.4004ZM8.375 7.25C7.83479 7.25 7.5474 7.66817 7.43945 7.88379C7.3093 8.1441 7.25 8.45171 7.25 8.75C7.25 9.04829 7.3093 9.3559 7.43945 9.61621C7.5474 9.83183 7.83479 10.25 8.375 10.25C8.91521 10.25 9.20261 9.83183 9.31055 9.61621C9.4407 9.3559 9.5 9.04829 9.5 8.75C9.5 8.45171 9.4407 8.1441 9.31055 7.88379C9.2026 7.66817 8.91521 7.25 8.375 7.25ZM15.625 7.25C15.0848 7.25 14.7974 7.66819 14.6895 7.88379C14.5593 8.1441 14.5 8.4517 14.5 8.75C14.5 9.0483 14.5593 9.3559 14.6895 9.61621C14.7974 9.83181 15.0848 10.25 15.625 10.25C16.1652 10.25 16.4526 9.83181 16.5605 9.61621C16.6907 9.3559 16.75 9.0483 16.75 8.75C16.75 8.4517 16.6907 8.1441 16.5605 7.88379C16.4526 7.66819 16.1652 7.25 15.625 7.25Z"
        fill={f}
      />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={CHAT_MIRROR}>
      <Path
        d="M21.5 12C21.5 17.2467 17.2467 21.5 12 21.5C10.3719 21.5 8.8394 21.0904 7.5 20.3687C5.63177 19.362 4.37462 20.2979 3.26592 20.4658C3.09774 20.4913 2.93024 20.4302 2.80997 20.31C2.62741 20.1274 2.59266 19.8451 2.6935 19.6074C3.12865 18.5818 3.5282 16.6382 2.98341 15C2.6698 14.057 2.5 13.0483 2.5 12C2.5 6.75329 6.75329 2.5 12 2.5C17.2467 2.5 21.5 6.75329 21.5 12Z"
        stroke={c}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8 15C8.91212 16.2144 10.3643 17 12 17C13.6357 17 15.0879 16.2144 16 15"
        stroke={c}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M15.625 8.387V8.91649M8.375 8.387V8.91649M8.75 8.75C8.75 8.33579 8.58211 8 8.375 8C8.16789 8 8 8.33579 8 8.75C8 9.16421 8.16789 9.5 8.375 9.5C8.58211 9.5 8.75 9.16421 8.75 8.75ZM16 8.75C16 8.33579 15.8321 8 15.625 8C15.4179 8 15.25 8.33579 15.25 8.75C15.25 9.16421 15.4179 9.5 15.625 9.5C15.8321 9.5 16 9.16421 16 8.75Z"
        stroke={c}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** UserPlus — زر الرومات المركزي (أبيض على التدرج البنفسجي) */
export function LuTabRoomsFabIcon({
  size = 24,
  color = '#FFFFFF',
}: {
  size?: number;
  color?: string;
}) {
  return <Heart size={size} color={color} fill={color} strokeWidth={2.4} />;
}

/** Heart — شكل القلب (للزر غير النشط) */
export function LuTabRoomsFabIconOutline({
  size = 24,
  color = '#1B1B22',
}: {
  size?: number;
  color?: string;
}) {
  return <Heart size={size} color={color} strokeWidth={1.8} />;
}
