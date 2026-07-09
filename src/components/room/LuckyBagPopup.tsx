/**
 * LuckyBagPopup — بوب أب حقيبة الحظ (عد تنازلي 5 دقائق قبل الفتح)
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gift, X, Coins, Clock, Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';

import { Text, useAlert } from '@/components/ui';
import {
  type LuckyBag,
  type LuckyBagPrize,
  openLuckyBag,
  hasOpenedBag,
  checkLuckyBagEligibility,
  getBagOpenCountdownSecondsLeft,
  getBagSecondsLeft,
  isBagOpenUnlocked,
} from '@/services/luckyBag';
import { lu } from '@/theme/lu-brand';

interface Props {
  roomId: string;
  bags: LuckyBag[];
  myUid: string;
  canManageRoom?: boolean;
  /** إظهار حقيبة محددة (بعد الإرسال أو من الأيقونة العائمة) */
  promptBagId?: string | null;
  onPromptHandled?: () => void;
}

function pickActiveBag(
  bags: LuckyBag[],
  myUid: string,
  dismissedIds: Set<string>,
  promptBagId?: string | null,
): LuckyBag | undefined {
  if (promptBagId) {
    const forced = bags.find(
      (b) =>
        b.id === promptBagId &&
        b.status === 'active' &&
        b.remainingSlots > 0 &&
        getBagSecondsLeft(b) > 0,
    );
    if (forced) return forced;
  }

  return bags.find(
    (b) =>
      b.status === 'active' &&
      b.remainingSlots > 0 &&
      getBagSecondsLeft(b) > 0 &&
      !dismissedIds.has(b.id) &&
      (!myUid || !hasOpenedBag(b, myUid)),
  );
}

function formatTimer(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function LuckyBagPopup({ roomId, bags, myUid, canManageRoom, promptBagId, onPromptHandled }: Props) {
  const { t } = useTranslation();
  const { showAlert } = useAlert();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [opening, setOpening] = useState(false);
  const [prize, setPrize] = useState<{ prize: LuckyBagPrize; bag: LuckyBag } | null>(null);
  const [openCountdown, setOpenCountdown] = useState(0);
  const [expireSeconds, setExpireSeconds] = useState(0);
  const [eligible, setEligible] = useState(true);
  const [eligibilityReason, setEligibilityReason] = useState('');
  const pulse = useRef(new Animated.Value(1)).current;

  const activeBag = pickActiveBag(bags, myUid, dismissedIds, promptBagId);
  const isSender = activeBag ? activeBag.senderUid === myUid : false;
  const senderViewOnly = isSender && !canManageRoom;
  const openUnlocked = activeBag ? isBagOpenUnlocked(activeBag) : false;

  useEffect(() => {
    if (promptBagId && activeBag?.id === promptBagId) {
      setDismissedIds((prev) => {
        if (!prev.has(promptBagId)) return prev;
        const next = new Set(prev);
        next.delete(promptBagId);
        return next;
      });
    }
  }, [promptBagId, activeBag?.id]);

  const dismissBag = useCallback(
    (bagId: string) => {
      setDismissedIds((p) => new Set(p).add(bagId));
      if (promptBagId === bagId) onPromptHandled?.();
    },
    [onPromptHandled, promptBagId],
  );

  useEffect(() => {
    if (!activeBag) return;
    const tick = () => {
      setOpenCountdown(getBagOpenCountdownSecondsLeft(activeBag));
      setExpireSeconds(getBagSecondsLeft(activeBag));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeBag]);

  useEffect(() => {
    if (!activeBag || !myUid) {
      setEligible(false);
      return;
    }
    let alive = true;
    checkLuckyBagEligibility(activeBag, myUid, roomId).then((r) => {
      if (!alive) return;
      if (r.reason === 'WAIT_COUNTDOWN') {
        setEligible(false);
        setEligibilityReason('');
        return;
      }
      setEligible(r.eligible);
      setEligibilityReason(r.reason ?? '');
    });
    return () => {
      alive = false;
    };
  }, [activeBag, myUid, roomId, openCountdown]);

  useEffect(() => {
    if (!activeBag || !openUnlocked || !eligible || senderViewOnly) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [activeBag, openUnlocked, eligible, senderViewOnly, pulse]);

  const handleOpen = useCallback(async () => {
    if (!activeBag || opening || !openUnlocked) return;
    if (!eligible) return;
    setOpening(true);
    try {
      const result = await openLuckyBag(roomId, activeBag.id);
      if (result) {
        setPrize({ prize: result, bag: activeBag });
        dismissBag(activeBag.id);
      } else {
        showAlert({ type: 'info', title: t('luckyBag.expiredTitle'), message: t('luckyBag.expiredMsg') });
        dismissBag(activeBag.id);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('common.error');
      showAlert({ type: 'error', title: t('luckyBag.openFailed'), message: msg });
    } finally {
      setOpening(false);
    }
  }, [activeBag, opening, openUnlocked, eligible, roomId, showAlert, t, dismissBag]);

  if (!activeBag) return null;

  const canPressOpen = openUnlocked && eligible && !opening && !senderViewOnly;
  const timerStr = formatTimer(openUnlocked ? expireSeconds : openCountdown);
  const openLabel = senderViewOnly ? t('luckyBag.sentByYou') : t('luckyBag.open');

  return (
    <>
      <Modal
        visible
        transparent
        animationType="fade"
        onRequestClose={() => dismissBag(activeBag.id)}
      >
        <Pressable style={styles.overlay} onPress={() => dismissBag(activeBag.id)}>
          <Pressable style={styles.cardOuter} onPress={(e) => e.stopPropagation()}>
            <Pressable
              onPress={() => dismissBag(activeBag.id)}
              style={styles.closeTopBtn}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <X size={18} color="#fff" strokeWidth={2.5} />
            </Pressable>

            <View style={styles.card}>
              <LinearGradient
                colors={['#B00E0E', '#E11414', '#8A0E0E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardTop}
              >
                <View style={styles.patternRow}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <View key={i} style={[styles.patternDot, { opacity: 0.15 + (i % 3) * 0.08 }]} />
                  ))}
                </View>
                <Sparkles size={18} color="rgba(255,255,255,0.35)" style={styles.sparkleA} />
                <Sparkles size={14} color="rgba(255,255,255,0.25)" style={styles.sparkleB} />

                <View style={styles.bagHero}>
                  <LinearGradient colors={['#FDE68A', '#F59E0B']} style={styles.bagHeroRing}>
                    <Gift size={36} color="#fff" strokeWidth={2.2} />
                  </LinearGradient>
                </View>
              </LinearGradient>

              <View style={styles.cardWave} />

              <View style={styles.cardBody}>
                {/* من أرسل الحقيبة — بطاقة مركزية */}
                <View style={styles.senderRow}>
                  {activeBag.senderAvatar ? (
                    <Image source={{ uri: activeBag.senderAvatar }} style={styles.senderAvatarSmall} contentFit="cover" />
                  ) : (
                    <View style={[styles.senderAvatarSmall, styles.senderAvatarFallback]}>
                      <Text variant="caption" weight="bold" color="#fff">
                        {activeBag.senderName.charAt(0)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.senderTextCol}>
                    <Text variant="bodySmall" weight="bold" color="#fff" numberOfLines={1} align="center">
                      {activeBag.senderName}
                    </Text>
                    <Text variant="caption" color="rgba(255,255,255,0.78)" align="center">
                      {t('luckyBag.sentBag')}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                {/* المبلغ الكلّي */}
                <View style={styles.amountRow}>
                  <Text variant="h1" weight="bold" color="#fff" style={styles.amountText}>
                    {activeBag.totalAmount.toLocaleString()}
                  </Text>
                  <LinearGradient colors={['#FDE68A', '#F59E0B']} style={styles.coinBadge}>
                    <Coins size={17} color="#fff" />
                  </LinearGradient>
                </View>

                <Animated.View style={[styles.openCircleWrap, { transform: [{ scale: canPressOpen ? pulse : 1 }] }]}>
                  <Pressable
                    onPress={() => void handleOpen()}
                    disabled={!canPressOpen}
                    style={[
                      styles.openCircle,
                      senderViewOnly && styles.openCircleSender,
                      !canPressOpen && !senderViewOnly && styles.openCircleDisabled,
                    ]}
                  >
                    {opening ? (
                      <ActivityIndicator color={senderViewOnly ? lu.colors.purple : '#E11414'} />
                    ) : senderViewOnly ? (
                      <>
                        <Gift size={28} color={lu.colors.purple} strokeWidth={2.2} />
                        <Text variant="caption" weight="bold" color={lu.colors.purple} style={styles.senderLabel}>
                          {openLabel}
                        </Text>
                      </>
                    ) : (
                      <Text variant="h3" weight="bold" color="#E11414">
                        {openLabel}
                      </Text>
                    )}
                  </Pressable>
                </Animated.View>

                <View style={styles.countdownRow}>
                  <Clock size={14} color="#FDE68A" />
                  <Text variant="caption" weight="bold" color="#fff">
                    {openUnlocked
                      ? t('luckyBag.expiresIn', { time: timerStr })
                      : t('luckyBag.countdown', { time: timerStr })}
                  </Text>
                </View>

                {!openUnlocked ? (
                  <Text variant="caption" color="rgba(255,255,255,0.85)" align="center" style={styles.hint}>
                    {senderViewOnly ? t('luckyBag.senderWaitHint') : t('luckyBag.waitToOpen')}
                  </Text>
                ) : senderViewOnly ? (
                  <Text variant="caption" color="rgba(255,255,255,0.85)" align="center" style={styles.hint}>
                    {t('luckyBag.senderOpenHint')}
                  </Text>
                ) : isSender && canManageRoom ? (
                  <Text variant="caption" color="rgba(255,255,255,0.85)" align="center" style={styles.hint}>
                    {t('luckyBag.managerOpenHint')}
                  </Text>
                ) : null}

                {openUnlocked && !eligible && !senderViewOnly && eligibilityReason ? (
                  <Text variant="caption" color={lu.colors.live} align="center" style={styles.hint}>
                    {eligibilityReason}
                  </Text>
                ) : null}

                <Pressable onPress={() => dismissBag(activeBag.id)} style={styles.closeBottomBtn}>
                  <Text variant="button" weight="bold" color="#fff">
                    {t('common.close')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <PrizeRevealModal
        visible={!!prize}
        onClose={() => setPrize(null)}
        prize={prize?.prize ?? null}
        bag={prize?.bag ?? null}
      />
    </>
  );
}

function PrizeRevealModal({
  visible,
  onClose,
  prize,
  bag,
}: {
  visible: boolean;
  onClose: () => void;
  prize: LuckyBagPrize | null;
  bag: LuckyBag | null;
}) {
  const { t } = useTranslation();
  const scaleAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0);
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, scaleAnim]);

  if (!prize) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.prizeBg} onPress={onClose}>
        <Pressable style={styles.prizeCard} onPress={(e) => e.stopPropagation()}>
          <LinearGradient colors={[lu.colors.goldSoft, lu.colors.bgPink]} style={StyleSheet.absoluteFill} />
          <Text variant="h4" weight="bold" align="center" color={lu.colors.purpleDark}>
            {t('luckyBag.congrats')}
          </Text>
          <Animated.View style={[styles.prizeGift, { transform: [{ scale: scaleAnim }] }]}>
            <LinearGradient colors={[lu.colors.gold, lu.colors.gold2]} style={styles.prizeGiftCircle}>
              <Gift size={48} color="#fff" />
              <Sparkles size={16} color="#fff" style={{ position: 'absolute', top: 8, right: 10 }} />
            </LinearGradient>
          </Animated.View>
          <View style={styles.prizeCoins}>
            <Coins size={20} color={lu.colors.gold2} />
            <Text variant="h3" weight="bold" color={lu.colors.gold2}>
              +{prize.amount.toLocaleString()}
            </Text>
            <Text variant="caption" color={lu.colors.ink2}>{t('luckyBag.coins')}</Text>
          </View>
          <Text variant="caption" color={lu.colors.muted} align="center" style={{ marginTop: 8 }}>
            {t('luckyBag.fromSender', { name: bag?.senderName ?? '' })}
          </Text>
          <Pressable onPress={onClose} style={styles.prizeOkBtn}>
            <LinearGradient
              colors={[lu.colors.pink, lu.colors.purple]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <Text variant="button" color="#fff" weight="bold">{t('luckyBag.awesome')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  cardOuter: {
    width: '100%',
    maxWidth: 320,
    position: 'relative',
  },
  closeTopBtn: {
    position: 'absolute',
    top: 12,
    end: 12,
    zIndex: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(253,230,138,0.45)',
    shadowColor: '#B00E0E',
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
  cardTop: {
    paddingTop: 28,
    paddingBottom: 36,
    alignItems: 'center',
    position: 'relative',
  },
  patternRow: {
    position: 'absolute',
    top: 12,
    start: 12,
    end: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  patternDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#fff',
    transform: [{ rotate: '45deg' }],
  },
  sparkleA: { position: 'absolute', top: 18, end: 24 },
  sparkleB: { position: 'absolute', top: 42, start: 20 },
  bagHero: {
    marginTop: 8,
  },
  bagHeroRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  cardWave: {
    height: 18,
    marginTop: -18,
    backgroundColor: '#8A0E0E',
    borderTopStartRadius: 28,
    borderTopEndRadius: 28,
  },
  cardBody: {
    backgroundColor: '#8A0E0E',
    paddingHorizontal: 22,
    paddingBottom: 20,
    paddingTop: 14,
  },
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 14,
  },
  senderTextCol: {
    alignItems: 'center',
    maxWidth: 200,
  },
  senderAvatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  senderAvatarFallback: {
    backgroundColor: lu.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginBottom: 16,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 18,
  },
  amountText: {
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: 0.5,
  },
  coinBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openCircleWrap: { alignItems: 'center', marginBottom: 16 },
  openCircle: {
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: lu.colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: lu.colors.gold,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 10,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  openCircleSender: {
    backgroundColor: '#FEE2E2',
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: lu.colors.purple,
  },
  openCircleDisabled: {
    opacity: 0.65,
    backgroundColor: '#FDE68A',
  },
  senderLabel: {
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 8,
    fontSize: 11,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  hint: {
    marginTop: 12,
    lineHeight: 19,
    paddingHorizontal: 6,
  },
  closeBottomBtn: {
    marginTop: 18,
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  prizeBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  prizeCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    overflow: 'hidden',
  },
  prizeGift: { marginVertical: 20 },
  prizeGiftCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prizeCoins: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 99,
  },
  prizeOkBtn: {
    marginTop: 24,
    width: '100%',
    height: 48,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
