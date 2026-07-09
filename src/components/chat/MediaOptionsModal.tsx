/**
 * MediaOptionsModal — إرسال صورة / فيديو / صوت (عادي أو مميّز)
 * هوية LinkUp: lavender gradient + بنفسجي LinkUp
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Lock,
  Timer,
  Zap,
  Eye,
  Coins,
  Mic,
  Video as VideoIcon,
  Send,
  Sparkles,
  X,
  Check,
  Play,
} from 'lucide-react-native';

import { Text } from '@/components/ui';
import { TAB_DESIGN } from '@/components/navigation/TabBarNavigationSvg';
import { useConfig } from '@/contexts/ConfigContext';
import { resolveLockedMessagePrice, MIN_LOCKED_MESSAGE_PRICE, MAX_LOCKED_MESSAGE_PRICE } from '@/services/lockedMedia';
import type { LockedMediaType, ExpireMode } from '@/services/lockedMedia';
import { lu } from '@/theme/lu-brand';
import { spacing } from '@/theme';

export type MediaSendOptions = {
  isLocked: boolean;
  enableTimer: boolean;
  expireMode: ExpireMode;
  viewDuration: number;
  /** سعر الفتح الذي يحدده المرسل (عند القفل بالكوينز) */
  unlockPrice?: number;
};

interface Props {
  visible: boolean;
  onClose: () => void;
  mediaType: LockedMediaType;
  mediaPreviewUri: string;
  duration?: number;
  onSend: (opts: MediaSendOptions) => void;
  sending?: boolean;
}

const DURATIONS = [
  { label: '٣', value: 3, suffix: 'ث' },
  { label: '٥', value: 5, suffix: 'ث' },
  { label: '١٠', value: 10, suffix: 'ث' },
  { label: '٣٠', value: 30, suffix: 'ث' },
];

const MIN_UNLOCK_PRICE = MIN_LOCKED_MESSAGE_PRICE;
const MAX_UNLOCK_PRICE = MAX_LOCKED_MESSAGE_PRICE;

type SendMode = 'normal' | 'special';

export function MediaOptionsModal({
  visible,
  onClose,
  mediaType,
  mediaPreviewUri,
  duration,
  onSend,
  sending,
}: Props) {
  const insets = useSafeAreaInsets();
  const { settings } = useConfig();
  const defaultUnlockPrice = resolveLockedMessagePrice(settings?.lockedMessagePrice);

  const [mode, setMode] = useState<SendMode>('normal');
  const [isLocked, setIsLocked] = useState(false);
  const [enableTimer, setEnableTimer] = useState(false);
  const [expireMode, setExpireMode] = useState<ExpireMode>('once');
  const [viewDuration, setViewDuration] = useState(5);
  const [customPrice, setCustomPrice] = useState(String(defaultUnlockPrice));

  const mediaLabel = mediaType === 'image' ? 'صورة' : mediaType === 'video' ? 'فيديو' : 'رسالة صوتية';

  const parsedPrice = (() => {
    const n = parseInt(customPrice.replace(/\D/g, ''), 10);
    if (!Number.isFinite(n)) return defaultUnlockPrice;
    return Math.min(MAX_UNLOCK_PRICE, Math.max(MIN_UNLOCK_PRICE, n));
  })();

  useEffect(() => {
    if (!visible) return;
    setMode('normal');
    setIsLocked(false);
    setEnableTimer(false);
    setExpireMode('once');
    setViewDuration(5);
    setCustomPrice(String(defaultUnlockPrice));
  }, [visible, mediaPreviewUri, defaultUnlockPrice]);

  const handleSend = () => {
    if (sending) return;

    if (mode === 'normal') {
      onSend({
        isLocked: false,
        enableTimer: false,
        expireMode: 'once',
        viewDuration: 0,
      });
      return;
    }

    const effectiveLocked = isLocked;
    const effectiveTimer = enableTimer;

    onSend({
      isLocked: effectiveLocked,
      enableTimer: effectiveTimer,
      expireMode: effectiveTimer ? expireMode : 'once',
      viewDuration: effectiveTimer && expireMode === 'timed' ? viewDuration : 0,
      unlockPrice: effectiveLocked ? parsedPrice : undefined,
    });
  };

  const handleClose = () => {
    if (sending) return;
    onClose();
  };

  const selectSpecial = () => {
    setMode('special');
    if (!isLocked && !enableTimer) {
      setIsLocked(true);
    }
  };

  const summaryParts: string[] = [];
  if (mode === 'special') {
    if (isLocked) summaryParts.push(`مقفلة • ${parsedPrice.toLocaleString('en-US')} عملة`);
    if (enableTimer) {
      summaryParts.push(
        expireMode === 'once' ? 'تظهر مرة واحدة' : `تختفي بعد ${viewDuration} ث`,
      );
    }
  }
  const summary = summaryParts.length > 0 ? summaryParts.join(' • ') : 'إرسال عادي';

  const ctaLabel =
    mode === 'special' && (isLocked || enableTimer)
      ? 'إرسال مميّز'
      : `إرسال ${mediaLabel}`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.sm }]}
          onPress={(e) => e.stopPropagation()}
        >
          <LinearGradient
            colors={['#FEE2E2', '#FEF2F2', '#FFFFFF']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text weight="bold" style={styles.headerTitle}>
              إرسال {mediaLabel}
            </Text>
            <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={10} disabled={sending}>
              <X size={20} color={lu.colors.ink2} strokeWidth={2.5} />
            </Pressable>
          </View>

          <ScrollView
            style={{ maxHeight: 520 }}
            contentContainerStyle={{ paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.hero}>
              {mediaType === 'image' ? (
                <Image source={{ uri: mediaPreviewUri }} style={styles.heroMedia} contentFit="cover" />
              ) : mediaType === 'video' ? (
                <View style={[styles.heroMedia, styles.heroDark]}>
                  {mediaPreviewUri ? (
                    <Image source={{ uri: mediaPreviewUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : null}
                  <LinearGradient
                    colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.playCircle}>
                    <Play size={26} color="#fff" fill="#fff" strokeWidth={0} />
                  </View>
                  {!!duration && (
                    <View style={styles.durationBadge}>
                      <VideoIcon size={11} color="#fff" strokeWidth={2.2} />
                      <Text weight="bold" style={{ color: '#fff', fontSize: 11 }}>
                        {Math.round(duration)} ث
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <LinearGradient
                  colors={[TAB_DESIGN.purpleSoft, '#FFE4E4']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.heroMedia, { alignItems: 'center', justifyContent: 'center' }]}
                >
                  <View style={styles.voiceCircle}>
                    <Mic size={32} color="#fff" strokeWidth={2.2} />
                  </View>
                  <Text weight="bold" style={{ fontSize: 16, color: lu.colors.ink, marginTop: 10 }}>
                    {duration ? `${Math.round(duration)} ثانية` : 'تسجيل صوتي'}
                  </Text>
                  <View style={styles.waveform}>
                    {Array.from({ length: 24 }).map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.waveBar,
                          { height: 6 + Math.abs(Math.sin(i * 0.7)) * 18 },
                        ]}
                      />
                    ))}
                  </View>
                </LinearGradient>
              )}
            </View>

            <View style={styles.modeSwitch}>
              <Pressable
                onPress={() => setMode('normal')}
                style={[styles.modeOption, mode === 'normal' && styles.modeOptionActive]}
              >
                {mode === 'normal' && (
                  <LinearGradient
                    colors={[...TAB_DESIGN.activeGrad]}
                    style={StyleSheet.absoluteFill}
                  />
                )}
                <Send
                  size={16}
                  color={mode === 'normal' ? '#fff' : lu.colors.ink2}
                  strokeWidth={2.4}
                />
                <Text
                  weight="bold"
                  style={{
                    fontSize: 13,
                    color: mode === 'normal' ? '#fff' : lu.colors.ink2,
                  }}
                >
                  إرسال عادي
                </Text>
              </Pressable>

              <Pressable
                onPress={selectSpecial}
                style={[styles.modeOption, mode === 'special' && styles.modeOptionActive]}
              >
                {mode === 'special' && (
                  <LinearGradient
                    colors={['#FF3340', '#B00E0E']}
                    style={StyleSheet.absoluteFill}
                  />
                )}
                <Sparkles
                  size={16}
                  color={mode === 'special' ? '#fff' : lu.colors.ink2}
                  strokeWidth={2.4}
                />
                <Text
                  weight="bold"
                  style={{
                    fontSize: 13,
                    color: mode === 'special' ? '#fff' : lu.colors.ink2,
                  }}
                >
                  إرسال مميّز
                </Text>
              </Pressable>
            </View>

            {mode === 'special' && (
              <View style={styles.specialOpts}>
                <Pressable
                  onPress={() => setIsLocked(!isLocked)}
                  style={[styles.optCard, isLocked && styles.optCardActive]}
                >
                  <View style={[styles.optIcon, { backgroundColor: lu.colors.goldSoft }]}>
                    <Lock size={18} color={lu.colors.gold2} strokeWidth={2.2} />
                  </View>
                  <View style={styles.optBody}>
                    <Text weight="bold" style={{ fontSize: 14, color: lu.colors.ink }}>
                      قفل بالكوينز
                    </Text>
                    <View style={styles.optMeta}>
                      <Coins size={11} color={lu.colors.gold2} strokeWidth={2.4} />
                      <Text style={{ fontSize: 11, color: lu.colors.ink2 }}>
                        المستلم يدفع عملة للفتح
                      </Text>
                    </View>
                    {isLocked && (
                      <View style={styles.priceRow}>
                        <TextInput
                          style={styles.priceInput}
                          value={customPrice}
                          onChangeText={(v) => setCustomPrice(v.replace(/\D/g, ''))}
                          keyboardType="number-pad"
                          maxLength={7}
                          selectTextOnFocus
                        />
                        <Text weight="bold" style={{ fontSize: 12, color: lu.colors.gold2 }}>
                          عملة
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={[styles.checkBox, isLocked && styles.checkBoxOn]}>
                    {isLocked && <Check size={14} color="#fff" strokeWidth={3} />}
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => setEnableTimer(!enableTimer)}
                  style={[styles.optCard, enableTimer && styles.optCardActive]}
                >
                  <View style={[styles.optIcon, { backgroundColor: lu.colors.blueSoft }]}>
                    <Timer size={18} color={lu.colors.blue} strokeWidth={2.2} />
                  </View>
                  <View style={styles.optBody}>
                    <Text weight="bold" style={{ fontSize: 14, color: lu.colors.ink }}>
                      توقيت العرض
                    </Text>
                    <Text style={{ fontSize: 11, color: lu.colors.ink2 }}>
                      تختفي أو تُقفل بعد مدة
                    </Text>
                  </View>
                  <View style={[styles.checkBox, enableTimer && styles.checkBoxOn]}>
                    {enableTimer && <Check size={14} color="#fff" strokeWidth={3} />}
                  </View>
                </Pressable>

                {enableTimer && (
                  <View style={styles.timerDetails}>
                    <View style={styles.segmented}>
                      <Pressable
                        onPress={() => setExpireMode('once')}
                        style={[styles.segItem, expireMode === 'once' && styles.segItemActive]}
                      >
                        <Zap
                          size={14}
                          color={expireMode === 'once' ? '#fff' : lu.colors.ink2}
                          strokeWidth={2.4}
                        />
                        <Text
                          weight="bold"
                          style={{
                            fontSize: 12,
                            color: expireMode === 'once' ? '#fff' : lu.colors.ink2,
                          }}
                        >
                          مرة واحدة
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setExpireMode('timed')}
                        style={[styles.segItem, expireMode === 'timed' && styles.segItemActive]}
                      >
                        <Eye
                          size={14}
                          color={expireMode === 'timed' ? '#fff' : lu.colors.ink2}
                          strokeWidth={2.4}
                        />
                        <Text
                          weight="bold"
                          style={{
                            fontSize: 12,
                            color: expireMode === 'timed' ? '#fff' : lu.colors.ink2,
                          }}
                        >
                          مؤقّتة
                        </Text>
                      </Pressable>
                    </View>

                    {expireMode === 'timed' && (
                      <View style={{ marginTop: 12 }}>
                        <Text style={{ fontSize: 11.5, color: lu.colors.ink2, marginBottom: 7 }}>
                          مدّة العرض قبل القفل
                        </Text>
                        <View style={styles.durationsRow}>
                          {DURATIONS.map((d) => {
                            const active = viewDuration === d.value;
                            return (
                              <Pressable
                                key={d.value}
                                onPress={() => setViewDuration(d.value)}
                                style={[styles.durChip, active && styles.durChipActive]}
                              >
                                <Text
                                  weight="bold"
                                  style={{
                                    fontSize: 14,
                                    color: active ? '#fff' : lu.colors.ink,
                                  }}
                                >
                                  {d.label}
                                </Text>
                                <Text
                                  style={{
                                    fontSize: 9.5,
                                    color: active ? 'rgba(255,255,255,0.85)' : lu.colors.muted,
                                  }}
                                >
                                  {d.suffix}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            {mode === 'special' && (isLocked || enableTimer) && (
              <View style={styles.summaryChip}>
                {isLocked ? (
                  <Lock size={12} color={lu.colors.gold2} strokeWidth={2.4} />
                ) : (
                  <Timer size={12} color={TAB_DESIGN.purple} strokeWidth={2.4} />
                )}
                <Text style={{ fontSize: 11.5, color: lu.colors.ink2 }} numberOfLines={1}>
                  {summary}
                </Text>
              </View>
            )}

            <Pressable
              onPress={handleSend}
              disabled={sending}
              style={[styles.ctaBtn, sending && { opacity: 0.65 }]}
            >
              <LinearGradient
                colors={
                  mode === 'special' && (isLocked || enableTimer)
                    ? ['#FF3340', '#B00E0E']
                    : [...TAB_DESIGN.activeGrad]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              {sending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  {mode === 'special' && (isLocked || enableTimer) ? (
                    <Sparkles size={18} color="#fff" strokeWidth={2.4} />
                  ) : (
                    <Send size={17} color="#fff" strokeWidth={2.4} />
                  )}
                  <Text weight="bold" style={{ color: '#fff', fontSize: 15 }}>
                    {ctaLabel}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(26, 10, 12,0.5)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(225, 20, 20,0.2)',
    alignSelf: 'center',
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: 10,
  },
  headerTitle: { fontSize: 17, color: lu.colors.ink, flex: 1 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    marginHorizontal: spacing.base,
    marginBottom: 14,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: lu.colors.bg,
    borderWidth: 1,
    borderColor: 'rgba(225, 20, 20,0.12)',
  },
  heroMedia: {
    width: '100%',
    height: 200,
    borderRadius: 20,
  },
  heroDark: {
    backgroundColor: '#1A0A0C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 12,
    insetInlineStart: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 99,
  },
  voiceCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: TAB_DESIGN.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 12,
    height: 24,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: TAB_DESIGN.purple,
    opacity: 0.45,
  },
  modeSwitch: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: spacing.base,
    padding: 4,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(225, 20, 20,0.1)',
  },
  modeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    overflow: 'hidden',
  },
  modeOptionActive: {},
  specialOpts: {
    paddingHorizontal: spacing.base,
    paddingTop: 14,
    gap: 10,
  },
  optCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1.5,
    borderColor: 'rgba(225, 20, 20,0.12)',
  },
  optCardActive: {
    backgroundColor: '#FEF2F2',
    borderColor: TAB_DESIGN.purple,
  },
  optIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optBody: { flex: 1, gap: 3 },
  optMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  priceInput: {
    minWidth: 88,
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(225, 20, 20,0.25)',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '700',
    color: lu.colors.ink,
    textAlign: 'center',
  },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: lu.colors.line,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxOn: {
    backgroundColor: TAB_DESIGN.purple,
    borderColor: TAB_DESIGN.purple,
  },
  timerDetails: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.75)',
    marginTop: -2,
    borderWidth: 1,
    borderColor: 'rgba(225, 20, 20,0.08)',
  },
  segmented: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  segItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 8,
  },
  segItemActive: {
    backgroundColor: TAB_DESIGN.purple,
  },
  durationsRow: { flexDirection: 'row', gap: 8 },
  durChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: lu.colors.line,
  },
  durChipActive: {
    backgroundColor: TAB_DESIGN.purple,
    borderColor: TAB_DESIGN.purple,
  },
  footer: {
    paddingHorizontal: spacing.base,
    paddingTop: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(225, 20, 20,0.1)',
  },
  summaryChip: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
  },
  ctaBtn: {
    height: 52,
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
