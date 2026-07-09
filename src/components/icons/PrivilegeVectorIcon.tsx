/**
 * أيقونات vector موحّدة لامتيازات VIP / الأرستقراطية / الثروة / الغموض / المكافآت
 * تستبدل صور اللعبة ثلاثية الأبعاد بأيقونات lucide نظيفة بألوان الهوية البصرية.
 *
 * - PrivilegeVectorIcon: أيقونة مسطّحة داخل بطاقة الامتياز (تأخذ مفتاح الأصل الأصلي assetKey)
 * - VectorEmblem: شارة كبيرة بتدرّج الهوية + أيقونة بيضاء، بديل الشعارات الفخمة
 */
import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Crown,
  Medal,
  Frame,
  Rocket,
  BellRing,
  MessageCircle,
  IdCard,
  Armchair,
  Gift,
  Coins,
  Sparkles,
  // — أيقونات الامتيازات الموسّعة —
  Plane,
  Megaphone,
  AudioLines,
  Hash,
  Fingerprint,
  Image as ImageIcon,
  Ghost,
  Headphones,
  CircleSlash,
  EyeOff,
  ShoppingBag,
  Clapperboard,
  Trophy,
  UserPlus,
  MicOff,
  Radio,
  VenetianMask,
  ShieldCheck,
  ShieldOff,
  Hourglass,
  ScrollText,
  Car,
  type LucideIcon,
} from 'lucide-react-native';

const GOLD = '#E0930B';
const PURPLE = '#E11414';
const PINK = '#E11414';
const BLUE = '#EC3E3E';
const MAGENTA = '#E02B2B';
const GREEN = '#22C55E';
const RED = '#EF4444';
const TEAL = '#14B8A6';
const ORANGE = '#F97316';

type IconSpec = { Icon: LucideIcon; color: string; fill?: boolean };

/** خريطة موحّدة: مفتاح الأصل (من أي شاشة) → أيقونة + لون الهوية */
const ICON_MAP: Record<string, IconSpec> = {
  // شعارات / أوسمة فخمة
  emblem: { Icon: Crown, color: GOLD, fill: true },
  hero: { Icon: Crown, color: GOLD, fill: true },
  vipBadge: { Icon: Crown, color: GOLD, fill: true },
  badge: { Icon: Medal, color: GOLD },
  honorMedal: { Icon: Medal, color: GOLD },
  privilegeHonor: { Icon: Medal, color: GOLD },

  // إطارات الصورة
  frame: { Icon: Frame, color: PURPLE },
  photoFrame: { Icon: Frame, color: PURPLE },

  // تأثيرات الدخول
  entry: { Icon: Rocket, color: PINK },
  entryEffect: { Icon: Rocket, color: PINK },
  effects: { Icon: Rocket, color: PINK },

  // إشعار الدخول
  entryNotice: { Icon: BellRing, color: BLUE },

  // فقاعة الكتابة / الدردشة
  bubble: { Icon: MessageCircle, color: BLUE },
  chatBubble: { Icon: MessageCircle, color: BLUE },

  // بطاقة الملف الشخصي
  profileCard: { Icon: IdCard, color: PURPLE },

  // مقعد VIP
  vipSeat: { Icon: Armchair, color: MAGENTA },
  seat: { Icon: Armchair, color: MAGENTA },

  // هدية مجانية
  freeGift: { Icon: Gift, color: PINK },
  gift: { Icon: Gift, color: PINK },

  // عملة
  coin: { Icon: Coins, color: GOLD },

  // — امتيازات SVIP الموسّعة —
  exclusiveGifts: { Icon: Gift, color: PINK, fill: true },
  visitorsLog: { Icon: ScrollText, color: BLUE },
  flyingMessage: { Icon: Plane, color: BLUE },
  upgradeAnnouncement: { Icon: Megaphone, color: ORANGE },
  specialSoundEffect: { Icon: AudioLines, color: TEAL },
  specialRoomId: { Icon: Hash, color: GOLD },
  specialId: { Icon: Fingerprint, color: PURPLE },
  roomBackground: { Icon: ImageIcon, color: MAGENTA },
  invisibleVisitor: { Icon: Ghost, color: BLUE },
  exclusiveSupport: { Icon: Headphones, color: TEAL },
  hideOnline: { Icon: CircleSlash, color: RED },
  hideGiftHistory: { Icon: EyeOff, color: MAGENTA },
  luckyBagMax: { Icon: ShoppingBag, color: GOLD },
  animatedAvatar: { Icon: Clapperboard, color: PINK },
  hiddenRanking: { Icon: Trophy, color: GOLD },
  extraRoomAdmins: { Icon: UserPlus, color: GREEN },
  antiMute: { Icon: MicOff, color: RED },
  appWideMessage: { Icon: Radio, color: ORANGE },
  hiddenPresence: { Icon: EyeOff, color: BLUE },
  hiddenVipIdentity: { Icon: VenetianMask, color: PURPLE },
  antiKick: { Icon: ShieldCheck, color: GREEN },
  removeBan: { Icon: ShieldOff, color: GOLD },
  comingSoon: { Icon: Hourglass, color: GOLD },
  // تمييز دخولية VIP (سيارة) عن تأثير الدخول (صاروخ)
  vipEntry: { Icon: Car, color: PINK },
};

function specFor(name: string): IconSpec {
  return ICON_MAP[name] ?? { Icon: Sparkles, color: PURPLE };
}

type IconProps = {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function PrivilegeVectorIcon({ name, size = 28, color, strokeWidth = 2 }: IconProps) {
  const { Icon, color: defColor, fill } = specFor(name);
  const c = color ?? defColor;
  return <Icon size={size} color={c} strokeWidth={strokeWidth} fill={fill ? c : 'transparent'} />;
}

type EmblemProps = {
  name: string;
  size?: number;
  gradient?: readonly [string, string, ...string[]];
  style?: StyleProp<ViewStyle>;
};

/** شارة كبيرة بتدرّج + أيقونة بيضاء، بديل الشعارات الفخمة في رؤوس الكروت */
export function VectorEmblem({
  name,
  size = 92,
  gradient = ['#FFD86F', '#F5B721', '#E0930B'] as const,
  style,
}: EmblemProps) {
  const { Icon, fill } = specFor(name);
  return (
    <View style={[{ width: size, height: size }, styles.emblemWrap, style]}>
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
      />
      <Icon
        size={size * 0.5}
        color="#FFFFFF"
        strokeWidth={1.6}
        fill={fill ? '#FFFFFF' : 'transparent'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  emblemWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
