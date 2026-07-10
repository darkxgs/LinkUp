/**
 * RoomBottomToolbar — التصميم الجديد (Agency Room)
 *
 * نفس الـ props API — لا تحتاج تعديل [id].tsx.
 * [شبكة] [هدية] [رسائل] [مايك؟] [سماعة/كتم الروم] [إيموجي] [input]
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  I18nManager,
  useWindowDimensions,
  Animated,
  Easing,
  Keyboard,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Mic, MicOff, Headphones, Smile, MessageCircle, LayoutGrid, ChevronDown, ChevronUp, Send } from 'lucide-react-native';
import Svg, { Path, Rect, Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

import { Text } from '@/components/ui';
import { lu } from '@/theme/lu-brand';

export const ROOM_TOOLBAR_ROW_H = 54;

type Props = {
  chatText: string;
  onChangeChat: (v: string) => void;
  onSend: (message: string) => void;
  chatPlaceholder: string;
  showEmoji: boolean;
  onToggleEmoji: () => void;
  volumeMuted: boolean;
  micMuted: boolean;
  /** على مقعد — يظهر زر المايك بجانب سماعة كتم الروم */
  onSeat?: boolean;
  onToggleMic?: () => void;
  onToggleRoomVolume: () => void;
  messageCount: number;
  onMessages: () => void;
  onGift: () => void;
  onMore: () => void;
  inputRef?: React.Ref<TextInput>;
  inputResetKey?: number;
  onLayoutHeight?: (height: number) => void;
  onInputFocusChange?: (focused: boolean) => void;
  dockCollapsed?: boolean;
  onToggleDock?: () => void;
  keyboardHeight?: number;
};

const RTL = I18nManager.isRTL;

/**
 * أيقونة الهدية — تصميم SVG نظيف بالهوية البصرية (أحمر/أسود/ذهبي):
 * علبة ذهبية متدرّجة + شريطة وفيونكة حمراء، على قرص أسود غامق مع حلقة متدرّجة أنيقة تدور ببطء.
 */
function GiftGlyph({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <SvgLinearGradient id="giftGold" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFE9A8" />
          <Stop offset="0.5" stopColor="#FFC53D" />
          <Stop offset="1" stopColor="#FF9A2E" />
        </SvgLinearGradient>
        <SvgLinearGradient id="giftLid" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFF3CC" />
          <Stop offset="1" stopColor="#FFC53D" />
        </SvgLinearGradient>
      </Defs>
      {/* جسم العلبة */}
      <Rect x="5" y="11.2" width="14" height="9.4" rx="1.7" fill="url(#giftGold)" stroke="#B00E0E" strokeWidth="0.5" />
      {/* غطاء العلبة */}
      <Rect x="3.4" y="7.4" width="17.2" height="4.4" rx="1.5" fill="url(#giftLid)" stroke="#B00E0E" strokeWidth="0.5" />
      {/* الشريطة العمودية */}
      <Rect x="10.6" y="7.4" width="2.8" height="13.2" fill="#E11414" />
      {/* الفيونكة — عروتان */}
      <Path d="M12 7.2 C 10.7 6.9 8.4 6.9 7.7 5.1 C 7.15 3.65 8.9 2.9 10.2 3.85 C 11.25 4.6 11.85 6.05 12 7.2 Z" fill="#E11414" />
      <Path d="M12 7.2 C 13.3 6.9 15.6 6.9 16.3 5.1 C 16.85 3.65 15.1 2.9 13.8 3.85 C 12.75 4.6 12.15 6.05 12 7.2 Z" fill="#FF3340" />
      {/* عقدة الفيونكة */}
      <Circle cx="12" cy="7" r="1.6" fill="#FFC53D" stroke="#B00E0E" strokeWidth="0.4" />
    </Svg>
  );
}

function SpinningGiftIcon({ size = 46 }: { size?: number }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 5200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* حلقة متدرّجة أنيقة تدور ببطء (ذهبي↔أحمر) */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { borderRadius: size / 2, transform: [{ rotate }] },
        ]}
      >
        <LinearGradient
          colors={['#FFD86F', '#E11414', '#B00E0E', '#FF9A2E', '#FFD86F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, borderRadius: size / 2 }}
        />
      </Animated.View>
      {/* القرص الأسود الداخلي */}
      <View
        style={{
          position: 'absolute',
          inset: 2.5,
          borderRadius: (size - 5) / 2,
          backgroundColor: '#0A0405',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'rgba(255,197,61,0.35)',
        }}
      />
      {/* أيقونة الهدية الثابتة في المنتصف */}
      <GiftGlyph size={size * 0.66} />
    </View>
  );
}

function IconBtn({
  children,
  onPress,
  size,
  active,
  warn,
}: {
  children: React.ReactNode;
  onPress: () => void;
  size: number;
  active?: boolean;
  warn?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconBtn,
        { width: size, height: size, borderRadius: size / 2 },
        active && styles.iconBtnActive,
        warn && styles.iconBtnWarn,
        pressed && { opacity: 0.75 },
      ]}
    >
      {children}
    </Pressable>
  );
}

export function RoomBottomToolbar({
  chatText,
  onChangeChat,
  onSend,
  chatPlaceholder,
  showEmoji,
  onToggleEmoji,
  volumeMuted,
  micMuted,
  onSeat = false,
  onToggleMic,
  onToggleRoomVolume,
  messageCount,
  onMessages,
  onGift,
  onMore,
  inputRef,
  inputResetKey = 0,
  onLayoutHeight,
  onInputFocusChange,
  dockCollapsed,
  onToggleDock,
  keyboardHeight = 0,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const tight = W < 360;
  const compact = W < 400;
  const btnSize = tight ? 30 : compact ? 32 : 36;
  const iconSize = tight ? 14 : compact ? 15 : 17;
  const giftSize = tight ? 34 : compact ? 36 : 40;
  const rowGap = tight ? 4 : compact ? 5 : 7;
  const pillPadH = tight ? 6 : compact ? 8 : 10;
  const pillPadV = tight ? 5 : 6;
  // يتوسّع الشريط فقط أثناء تركيز حقل الكتابة — لا بمجرد وجود نص
  const [focused, setFocused] = useState(false);
  const expanded = focused;
  const kbUp = keyboardHeight > 0;
  const restingPad = Math.max(insets.bottom, Platform.OS === 'android' ? 10 : 8);
  const bottomPad = kbUp
    ? (Platform.OS === 'ios' ? keyboardHeight - insets.bottom : 0)
    : restingPad;
  // نُبلّغ الأب بارتفاع الشريط في وضع الراحة (بلا حشوة الكيبورد) حتى يبقى حجز مساحة
  // الشات ثابتاً، ويُطبّق الروم رفع الكيبورد مرة واحدة فقط عبر keyboardHeight (بلا ازدواج).
  const reportRestingHeight = (h: number) => onLayoutHeight?.(h - bottomPad + restingPad);

  const dismissInput = () => {
    setFocused(false);
    onInputFocusChange?.(false);
    inputRef?.current?.blur();
    Keyboard.dismiss();
  };

  const handleSendPress = () => {
    const text = chatText.trim();
    if (!text) return;
    dismissInput();
    onSend(text);
  };

  if (dockCollapsed) {
    return (
      <View
        style={[styles.collapsedWrap, { paddingBottom: bottomPad }]}
        onLayout={(e) => reportRestingHeight(e.nativeEvent.layout.height)}
      >
        <Pressable
          onPress={onToggleDock}
          style={({ pressed }) => [styles.collapsedPill, pressed && { opacity: 0.85 }]}
          hitSlop={12}
        >
          <View style={styles.collapsedPillBg}>
            <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.pillTint} />
          </View>
          <ChevronUp size={20} color="rgba(255,255,255,0.85)" strokeWidth={2.5} />
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { paddingBottom: bottomPad, paddingHorizontal: tight ? 8 : 10 }]}
      onLayout={(e) => reportRestingHeight(e.nativeEvent.layout.height)}
    >
      {onToggleDock ? (
        <Pressable
          onPress={onToggleDock}
          style={({ pressed }) => [styles.collapseHandle, pressed && { opacity: 0.8 }]}
          hitSlop={{ top: 8, bottom: 4, left: 20, right: 20 }}
        >
          <View style={styles.collapseHandleInner}>
            <ChevronDown size={16} color="rgba(255,255,255,0.7)" strokeWidth={2.5} />
          </View>
        </Pressable>
      ) : null}
      <View style={styles.pill}>
        <View style={styles.pillBg}>
          <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.pillTint} />
        </View>
        <View
          style={[
            styles.pillContent,
            {
              flexDirection: 'row-reverse',
              gap: rowGap,
              paddingHorizontal: pillPadH,
              paddingVertical: pillPadV,
            },
          ]}
        >

          {/* أزرار الأدوات تختفي أثناء التركيز على حقل الكتابة فقط */}
          {!expanded ? (
            <>
          <IconBtn size={btnSize} onPress={onMore}>
            <LayoutGrid size={iconSize} color="rgba(255,255,255,0.75)" strokeWidth={2} />
          </IconBtn>

          <Pressable onPress={onGift} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
            <SpinningGiftIcon size={giftSize} />
          </Pressable>

          <View style={styles.iconWithBadge}>
            <IconBtn size={btnSize} onPress={onMessages}>
              <MessageCircle size={iconSize} color="rgba(255,255,255,0.75)" strokeWidth={2} />
            </IconBtn>
            {messageCount > 0 ? (
              <View style={styles.badge} pointerEvents="none">
                <Text style={styles.badgeText}>{messageCount > 99 ? '99+' : messageCount}</Text>
              </View>
            ) : null}
          </View>

          {onSeat && onToggleMic ? (
            <IconBtn size={btnSize} onPress={onToggleMic} warn={micMuted}>
              {micMuted ? (
                <MicOff size={iconSize} color="#FF2E62" strokeWidth={2} />
              ) : (
                <Mic size={iconSize} color="rgba(255,255,255,0.75)" strokeWidth={2} />
              )}
            </IconBtn>
          ) : null}

          <IconBtn size={btnSize} onPress={onToggleRoomVolume} warn={volumeMuted}>
            <Headphones
              size={iconSize}
              color={volumeMuted ? '#FF2E62' : 'rgba(255,255,255,0.75)'}
              strokeWidth={2}
            />
          </IconBtn>
            </>
          ) : (
            <IconBtn size={btnSize} onPress={dismissInput}>
              <ChevronDown size={iconSize} color="rgba(255,255,255,0.85)" strokeWidth={2.4} />
            </IconBtn>
          )}

          <IconBtn size={btnSize} onPress={onToggleEmoji} active={showEmoji}>
            <Smile size={iconSize} color={showEmoji ? '#E81717' : 'rgba(255,255,255,0.75)'} strokeWidth={2} />
          </IconBtn>

          <View style={[styles.inputShell, tight && styles.inputShellTight]}>
            <TextInput
              key={inputResetKey}
              ref={inputRef}
              style={[
                styles.input,
                tight && styles.inputTight,
                {
                  // التطبيق عربي أولاً — الكتابة تبدأ من اليمين دائماً حتى على
                  // الأجهزة التي لا يُفعَّل عليها وضع RTL للنظام
                  textAlign: 'right',
                  writingDirection: 'rtl',
                },
              ]}
              value={chatText}
              onChangeText={onChangeChat}
              onFocus={() => {
                setFocused(true);
                onInputFocusChange?.(true);
              }}
              onBlur={() => {
                setFocused(false);
                onInputFocusChange?.(false);
              }}
              placeholder={chatPlaceholder}
              placeholderTextColor="rgba(255,255,255,0.3)"
              returnKeyType="default"
              multiline
              textAlignVertical="center"
              blurOnSubmit={false}
              maxLength={500}
            />
            {chatText.trim().length > 0 ? (
              <Pressable
                onPress={handleSendPress}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.sendBtn,
                  tight && styles.sendBtnTight,
                  pressed && { opacity: 0.7 },
                ]}
              >
                {/* نعكس الأيقونة عبر View لا عبر الـ SVG مباشرة: transform على جذر SVG
                    يُطبَّق حول نقطة الأصل (0,0) فتنزاح خارج الزر وتختفي في RTL. */}
                <View style={RTL ? { transform: [{ scaleX: -1 }] } : undefined}>
                  <Send size={tight ? 14 : 16} color="#fff" strokeWidth={2.4} />
                </View>
              </Pressable>
            ) : null}
          </View>

        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    start: 0,
    end: 0,
    bottom: 0,
    zIndex: 100,
    paddingHorizontal: 10,
  },
  pill: {
    position: 'relative',
    borderRadius: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 22,
    elevation: 16,
  },
  pillBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 40,
    overflow: 'hidden',
  },
  pillTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(24, 4, 4, 0.55)',
  },
  pillContent: {
    alignItems: 'flex-end',
  },
  iconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    flexShrink: 0,
  },
  iconBtnActive: {
    backgroundColor: 'rgba(232, 23, 23, 0.15)',
    borderColor: 'rgba(232, 23, 23, 0.55)',
    shadowColor: '#E81717',
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  iconBtnWarn: {
    backgroundColor: 'rgba(255,46,98,0.12)',
    borderColor: 'rgba(255,46,98,0.4)',
  },
  iconWithBadge: {
    position: 'relative',
    zIndex: 4,
    overflow: 'visible',
  },
  badge: {
    position: 'absolute',
    top: -4,
    end: -4,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: '#FF2E62',
    borderWidth: 1.5,
    borderColor: '#0A0405',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    zIndex: 2,
  },
  badgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
    fontFamily: lu.fonts.bodyHeavy,
  },
  inputShell: {
    flex: 1,
    flexShrink: 1,
    minWidth: 64,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 22,
    paddingStart: 13,
    paddingEnd: 5,
    paddingVertical: Platform.OS === 'android' ? 4 : 6,
  },
  inputShellTight: {
    minWidth: 72,
    paddingStart: 10,
    paddingEnd: 4,
    paddingVertical: Platform.OS === 'android' ? 3 : 5,
    borderRadius: 18,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    fontFamily: lu.fonts.body,
    includeFontPadding: false,
    padding: 0,
    maxHeight: 120,
    minHeight: 20,
  },
  inputTight: {
    fontSize: 12,
    minHeight: 18,
  },
  sendBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E11414',
    alignItems: 'center',
    justifyContent: 'center',
    marginStart: 6,
    flexShrink: 0,
  },
  sendBtnTight: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginStart: 4,
  },
  collapseHandle: {
    alignSelf: 'center',
    marginBottom: 4,
    zIndex: 2,
  },
  collapseHandleInner: {
    width: 44,
    height: 22,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: 'rgba(24, 4, 4, 0.75)',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
  },
  collapsedWrap: {
    position: 'absolute',
    start: 0,
    end: 0,
    bottom: 0,
    zIndex: 100,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  collapsedPill: {
    width: 52,
    height: 36,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 12,
  },
  collapsedPillBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    overflow: 'hidden',
  },
});
