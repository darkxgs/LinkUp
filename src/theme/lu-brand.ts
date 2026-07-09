/**
 * LinkUp Brand System — هوية LinkUp البصرية (أحمر/أسود)
 * مبني على لوجو LinkUp الجديد: أحمر قانٍ على أسود فاخر.
 */

// ============ Brand Colors ============
export const luColors = {
  // Brand (from the LinkUp logo)
  pink: '#FF3340',        // أحمر-وردي (قلوب/تفاعل)
  pink1: '#FF6670',
  magenta: '#C40E1E',
  purple: '#E11414',      // ★ اللون الأساسي (أحمر LinkUp)
  purpleDark: '#B00E0E',
  blue: '#EC3E3E',        // أزرق دلالي (توثيق/ذكر) — يبقى
  blue1: '#EF5F5F',

  // Surfaces (light browsing) — محايد فاتح بلمسة حمراء خفيفة
  bg: '#F8F6F7',
  bg2: '#FCFBFB',
  bgPink: '#FDECEC',
  bgLavender: '#FBEAEA',
  card: '#FFFFFF',
  card2: '#F6EFEF',
  line: '#EEE7E8',

  // Room (dark immersive) — أسود فحمي بنبرة حمراء
  room0: '#140A0C',
  room1: '#26101380',
  room2: '#3A1316',

  // Ink (text) — حبر أسود من اللوجو
  ink: '#15151A',
  ink2: '#56565F',
  muted: '#9A9AA5',
  onGrad: '#FFFFFF',

  // States
  live: '#FF2E3E',
  gold: '#FFC53D',
  gold2: '#FF9A2E',
  mint: '#2BD9A8',

  // Tints (utility)
  pinkSoft: '#FDE2E4',
  purpleSoft: '#FEE2E2',
  goldSoft: '#FFE08A',
  blueSoft: '#FDEAEA',
  redSoft: '#FFE6E9',
};

// ============ Gradients (tuple [from, to] for LinearGradient) ============
export const luGradients = {
  // Main brand gradient (أحمر فاتح → أحمر → أحمر داكن)
  brand: ['#FF2D2D', '#E11414', '#8A0E0E'] as const,
  brandSoft: ['#FF6B6B', '#E83A3A', '#B00E0E'] as const,
  pink: ['#FF4D5A', '#FF2E3E', '#C40E1E'] as const,
  blue: ['#EF5F5F', '#EC3E3E'] as const,
  warm: ['#FFB199', '#FF7A8A'] as const,

  // Tool tile gradients
  gold: ['#FFC53D', '#FF9A2E'] as const,
  purple: ['#E11414', '#B00E0E'] as const,   // التبويب النشط / الأزرار
  orange: ['#FF7A2E', '#FF5C6A'] as const,
  purpleEye: ['#E83A3A', '#B00E0E'] as const,
  mint: ['#2BD9A8', '#22C58A'] as const,
  goldStar: ['#FFD86F', '#FFB347'] as const,

  // Room/Match
  matchVideo: ['#FF7A8A', '#E11414', '#8A0E0E'] as const,
  matchVoice: ['#FF5C6A', '#C40E1E', '#7A0A0A'] as const,
  room: ['#3A0A0A', '#26090C', '#140A0C'] as const,

  // Aristocracy / VIP tiles
  aristocracy: ['#FFE08A', '#FFB347'] as const,
  vip: ['#FFD0A8', '#FF9A6B'] as const,

  // Page backgrounds — محايد أنيق
  pageHome: ['#FDECEC', '#F8F6F7'] as const,
  pageRooms: ['#FDECEC', '#F8F6F7'] as const,
  pageChat: ['#FBEAEA', '#FBF1F1', '#F8F6F7'] as const,
  pageProfile: ['#FBEAEA', '#F8F6F7'] as const,
  pageOnboarding: ['#FFE9E9', '#FCFBFB', '#FFFFFF'] as const,
};

// ============ Geometry ============
export const luRadius = {
  sm: 12,
  base: 18,
  lg: 26,
  xl: 34,
  pill: 99,
  round: 999,
};

// ============ Shadows (RN style) — ظلال حمراء ناعمة ============
export const luShadows = {
  card: {
    shadowColor: '#9A1414',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 6,
  },
  pop: {
    shadowColor: '#7A0E0E',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.3,
    shadowRadius: 28,
    elevation: 10,
  },
  grad: {
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
};

// ============ Typography (unchanged) ============
export const luFonts = {
  body: 'Cairo_400Regular',
  bodyMedium: 'Cairo_500Medium',
  bodySemi: 'Cairo_600SemiBold',
  bodyBold: 'Cairo_700Bold',
  bodyHeavy: 'Cairo_800ExtraBold',
  bodyBlack: 'Cairo_900Black',
  display: 'BalooBhaijaan2_700Bold',
  displaySemi: 'BalooBhaijaan2_600SemiBold',
  displayBold: 'BalooBhaijaan2_700Bold',
  displayHeavy: 'BalooBhaijaan2_800ExtraBold',
};

// ============ Spacing ============
export const luSpacing = {
  xs: 4, sm: 8, base: 12, md: 16, lg: 20, xl: 28, xxl: 36,
};

export const lu = {
  colors: luColors,
  gradients: luGradients,
  radius: luRadius,
  shadows: luShadows,
  fonts: luFonts,
  spacing: luSpacing,
};
