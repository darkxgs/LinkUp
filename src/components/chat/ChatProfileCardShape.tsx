/**
 * شكل كارد البروفايل في المحادثة — من Friend Profile Shape.svg (ممدّد أفقياً)
 * + توهج Level Details card Shape (#EB3434 → #EB3333)
 */
import React from 'react';
import Svg, {
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Mask,
  Path,
  Stop,
} from 'react-native-svg';

export const CHAT_PROFILE_CARD_VIEW_W = 358;
export const CHAT_PROFILE_CARD_VIEW_H = 58;

/** Friend Profile Shape ممدّد إلى 358×70 — حواف concave يسار/يمين */
export const CHAT_PROFILE_CARD_PATH =
  'M10.0007 0.5 H348.099 C353.686 0.500076 358.067 5.29704 357.561 10.8604 L356.18 33.7704 C356.123 34.4026 356.123 35.2974 356.18 35.9296 L357.561 55.9336 C358.067 63.134 353.686 69.3519 348.099 69.5 H10.0007 C4.4145 69.3519 0.0340393 63.134 0.539795 55.9336 L1.92065 35.9296 C1.9781 35.2974 1.9781 34.4026 1.92065 33.7704 L0.539795 10.8604 C0.0340392 5.29704 4.4145 0.500076 10.0007 0.5 Z';

const CHAT_PROFILE_MASK_PATH =
  'M10.0007 1 H348.099 C352.686 1 356.067 5.297 355.561 10.36 L354.18 33.77 C354.123 34.4 354.123 35.3 354.18 35.93 L355.561 55.93 C356.067 63.13 352.686 68.35 348.099 68.5 H10.0007 C5.4145 68.35 2.034 63.13 2.54 55.93 L3.921 35.93 C3.978 35.3 3.978 34.4 3.921 33.77 L2.54 10.36 C2.034 5.297 5.4145 1 10.0007 1 Z';

type Props = {
  width: number;
  height?: number;
};

export function ChatProfileCardShape({
  width,
  height = CHAT_PROFILE_CARD_VIEW_H,
}: Props) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${CHAT_PROFILE_CARD_VIEW_W} ${CHAT_PROFILE_CARD_VIEW_H}`}
    >
      <Defs>
        <LinearGradient id="chatProfileFill" x1="179" y1="0" x2="179" y2="70" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#FEE2E2" />
          <Stop offset="1" stopColor="#FEF2F2" />
        </LinearGradient>
        <LinearGradient id="chatProfileGlowL" x1="44" y1="0" x2="44" y2="68" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#EB3434" />
          <Stop offset="1" stopColor="#EB3333" />
        </LinearGradient>
        <LinearGradient id="chatProfileGlowR" x1="28" y1="0" x2="28" y2="43" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#EB3434" />
          <Stop offset="1" stopColor="#EB3333" />
        </LinearGradient>
        <Mask id="chatProfileMask" maskUnits="userSpaceOnUse" x="0" y="0" width="358" height="70">
          <Path d={CHAT_PROFILE_MASK_PATH} fill="#E11414" />
        </Mask>
      </Defs>

      <G>
        <Path d={CHAT_PROFILE_CARD_PATH} fill="url(#chatProfileFill)" />
        <Path d={CHAT_PROFILE_CARD_PATH} fill="#E11414" fillOpacity={0.1} />
        <Path
          d={CHAT_PROFILE_CARD_PATH}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={1.2}
          strokeOpacity={0.95}
        />

        <G mask="url(#chatProfileMask)">
          <Ellipse cx="44" cy="44" rx="44" ry="44" fill="url(#chatProfileGlowL)" opacity={0.28} />
          <Ellipse cx="314" cy="52" rx="28" ry="28" fill="url(#chatProfileGlowR)" opacity={0.22} />
        </G>
      </G>
    </Svg>
  );
}
