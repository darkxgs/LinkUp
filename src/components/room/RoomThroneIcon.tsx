/**
 * أيقونة العرش — كرسي ملوكي فاخر (Royal Throne) بتصميم حديث:
 * ظهر مرتفع مذهّب بحواف مزخرفة + مخمل أحمر + جواهر + مساند ذراعين ملتفّة + قاعدة وأرجل ذهبية.
 * صورة الشاغل تُركَّب فوق منطقة المخمل (المنتصف العلوي).
 */
import React from 'react';
import Svg, {
  Path,
  Rect,
  Circle,
  Ellipse,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
} from 'react-native-svg';

interface Props {
  size?: number;
}

export function RoomThroneIcon({ size = 60 }: Props) {
  const h = Math.round((size * 72) / 64);
  return (
    <Svg width={size} height={h} viewBox="0 0 64 72">
      <Defs>
        <LinearGradient id="rt-gold" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFF3C0" />
          <Stop offset="0.45" stopColor="#FACC15" />
          <Stop offset="1" stopColor="#B8860B" />
        </LinearGradient>
        <LinearGradient id="rt-gold-edge" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#B8860B" />
          <Stop offset="0.5" stopColor="#FDE68A" />
          <Stop offset="1" stopColor="#B8860B" />
        </LinearGradient>
        <RadialGradient id="rt-velvet" cx="0.5" cy="0.38" r="0.75">
          <Stop offset="0" stopColor="#F43F3F" />
          <Stop offset="0.6" stopColor="#8A0E0E" />
          <Stop offset="1" stopColor="#5C0A0A" />
        </RadialGradient>
        <RadialGradient id="rt-jewel" cx="0.4" cy="0.35" r="0.8">
          <Stop offset="0" stopColor="#F7AAAA" />
          <Stop offset="0.5" stopColor="#EA2626" />
          <Stop offset="1" stopColor="#8A1E1E" />
        </RadialGradient>
      </Defs>

      {/* أرجل ذهبية */}
      <Rect x="15" y="56" width="7" height="13" rx="2.5" fill="url(#rt-gold)" />
      <Rect x="42" y="56" width="7" height="13" rx="2.5" fill="url(#rt-gold)" />

      {/* مساند الذراعين — التفافات ذهبية (volutes) */}
      <Path
        d="M9 41 C1 43 1 56 9 56 L14 56 L14 47 C14 44 11 41 9 41 Z"
        fill="url(#rt-gold)"
        stroke="#8A6209"
        strokeWidth="0.6"
      />
      <Circle cx="7" cy="49" r="3.4" fill="url(#rt-gold)" stroke="#8A6209" strokeWidth="0.6" />
      <Path
        d="M55 41 C63 43 63 56 55 56 L50 56 L50 47 C50 44 53 41 55 41 Z"
        fill="url(#rt-gold)"
        stroke="#8A6209"
        strokeWidth="0.6"
      />
      <Circle cx="57" cy="49" r="3.4" fill="url(#rt-gold)" stroke="#8A6209" strokeWidth="0.6" />

      {/* قاعدة المقعد الذهبية */}
      <Path d="M9 43 L55 43 L58 57 L6 57 Z" fill="url(#rt-gold)" stroke="#8A6209" strokeWidth="0.7" />
      {/* وسادة المخمل على المقعد */}
      <Path d="M13 44 L51 44 L53 53 L11 53 Z" fill="url(#rt-velvet)" />
      <Ellipse cx="32" cy="46" rx="17" ry="2.4" fill="rgba(255,255,255,0.12)" />

      {/* ظهر العرش — إطار ذهبي مرتفع بقمّة مزخرفة */}
      <Path
        d="M12 46 L12 20 C12 12 17 9 22 9 C24 5 28 3 32 3 C36 3 40 5 42 9 C47 9 52 12 52 20 L52 46 Z"
        fill="url(#rt-gold)"
        stroke="#8A6209"
        strokeWidth="0.8"
      />
      {/* مخمل داخلي */}
      <Path
        d="M16 45 L16 21 C16 14 20 12 23 12 C25 8 28 7 32 7 C36 7 39 8 41 12 C44 12 48 14 48 21 L48 45 Z"
        fill="url(#rt-velvet)"
      />

      {/* كرات ذهبية على أطراف الظهر (finials) */}
      <Circle cx="13" cy="19" r="3" fill="url(#rt-gold)" stroke="#8A6209" strokeWidth="0.5" />
      <Circle cx="51" cy="19" r="3" fill="url(#rt-gold)" stroke="#8A6209" strokeWidth="0.5" />

      {/* تاج صغير فوق القمّة */}
      <Path
        d="M25 8 L28 3 L32 7 L36 3 L39 8 L37 11 L27 11 Z"
        fill="url(#rt-gold-edge)"
        stroke="#8A6209"
        strokeWidth="0.5"
      />
      <Circle cx="32" cy="2.4" r="1.5" fill="#FDE68A" />

      {/* جواهر زينة على الإطار */}
      <Circle cx="32" cy="40" r="2.4" fill="url(#rt-jewel)" stroke="#FDE68A" strokeWidth="0.6" />
      <Circle cx="13" cy="50" r="1.6" fill="url(#rt-jewel)" />
      <Circle cx="51" cy="50" r="1.6" fill="url(#rt-jewel)" />
    </Svg>
  );
}

export function RoomThroneAvatarPlaceholder({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="8" r="4" fill="rgba(255,255,255,0.85)" />
      <Path d="M 4 20 C 4 15 7.5 13 12 13 C 16.5 13 20 15 20 20" fill="rgba(255,255,255,0.85)" />
    </Svg>
  );
}
