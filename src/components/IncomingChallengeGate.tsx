/**
 * IncomingChallengeGate.tsx — بواب استقبال التحديات أونلاين 1v1
 *
 * يستمع بالوقت الفعلي لأي تحدٍ معلق يكون المستخدم الحالي مستهدفاً فيه.
 * يعرض شاشة كاملة متوهجة بنمط نيون ذهبي/بنفسجي، مع صورة المتحدي، اسم اللعبة، الرهان، واهتزاز تفاعلي.
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  Vibration,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Swords, X, Check, Coins } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { colors, radius, spacing, shadows } from '@/theme';
import { lu } from '@/theme/lu-brand';
import {
  subscribeToIncomingChallenges,
  acceptChallenge,
  declineChallenge,
  type ChallengeSession,
} from '@/services/firebase/challenges';

export function IncomingChallengeGate() {
  const router = useRouter();
  const { user } = useAuth();
  const [challenge, setChallenge] = useState<ChallengeSession | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!user) return;

    const unsub = subscribeToIncomingChallenges(user.uid, (challenges) => {
      const pending = challenges[0] ?? null;
      setChallenge(pending);
    });

    return unsub;
  }, [user?.uid]);

  // تشغيل الاهتزاز والنبض الحركي عند استقبال الدعوة
  useEffect(() => {
    if (!challenge) {
      pulse.setValue(0);
      return;
    }

    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      Vibration.vibrate([0, 800, 400, 800, 400], true);
    }

    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    pulseAnim.start();

    return () => {
      Vibration.cancel();
      pulseAnim.stop();
    };
  }, [challenge?.id]);

  if (!challenge) return null;

  const handleAccept = async () => {
    Vibration.cancel();
    try {
      const id = challenge.id;
      await acceptChallenge(id);
      setChallenge(null);
      // التوجيه لشاشة التحدي النشط
      router.push(`/games/challenges/active?challengeId=${id}` as any);
    } catch (e: any) {
      alert(e.message || 'حدث خطأ أثناء قبول التحدي');
    }
  };

  const handleDecline = async () => {
    Vibration.cancel();
    try {
      await declineChallenge(challenge.id);
      setChallenge(null);
    } catch (e: any) {
      console.warn('Decline challenge error:', e);
      setChallenge(null);
    }
  };

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] });

  // الحصول على اسم اللعبة بالعربية
  const getGameName = (id: string) => {
    if (id === 'penalty') return 'ركلات جزاء 1v1';
    if (id === 'coin-flip') return 'رمي قطعة نقدية (3 جولات)';
    if (id === 'billiards') return 'بلياردو ستاندرد 1v1';
    return 'تحدي جديد';
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={StyleSheet.absoluteFill}>
        {/* خلفية غامرة متدرجة من النيون الداكن */}
        <LinearGradient colors={['#1A0A0C', '#3A0A0A', '#0A0405']} style={StyleSheet.absoluteFill} />

        {/* توهج البراند الوردي المتوهج في الأعلى */}
        <LinearGradient
          colors={['rgba(245,158,11,0.2)', 'rgba(225, 20, 20,0.1)', 'transparent']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.glow}
          pointerEvents="none"
        />

        <View style={styles.container}>
          {/* شارة التحدي */}
          <View style={styles.typeBadge}>
            <Swords size={16} color="#F59E0B" strokeWidth={2.5} />
            <Text variant="caption" weight="bold" color="#F59E0B" style={styles.typeText}>
              تحدي مباشر 1v1
            </Text>
          </View>

          {/* العنوان الرئيسي */}
          <Text variant="h2" weight="bold" color={colors.white} style={styles.title}>
            لقد تم تحديك!
          </Text>

          {/* صورة الخصم + حلقة نبض مضيئة */}
          <View style={styles.avatarWrap}>
            <Animated.View
              style={[styles.pulseRing, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
            />
            <LinearGradient
              colors={['#F59E0B', '#E11414']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarRing}
            >
              <View style={styles.avatarInner}>
                {challenge.challengerAvatar ? (
                  <Image source={{ uri: challenge.challengerAvatar }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text variant="h1" color={colors.white}>{challenge.challengerName?.[0] ?? '؟'}</Text>
                  </View>
                )}
              </View>
            </LinearGradient>
          </View>

          {/* اسم الخصم واللعبة والرهان */}
          <Text variant="h3" weight="bold" color={colors.white} style={styles.name}>
            {challenge.challengerName}
          </Text>
          <Text variant="body" color="rgba(255,255,255,0.72)" style={styles.challengeDesc}>
            يدعوك للمواجهة في لعبة:
          </Text>
          <Text variant="h4" weight="bold" color="#FCA5A5" style={styles.gameName}>
            {getGameName(challenge.gameId)}
          </Text>

          {/* مبلغ الرهان */}
          <View style={styles.betCard}>
            <Text variant="caption" color="rgba(255,255,255,0.6)">قيمة الرهان</Text>
            <View style={styles.betRow}>
              <Coins size={18} color="#F59E0B" strokeWidth={2.5} />
              <Text variant="h3" weight="bold" color="#F59E0B">
                {challenge.bet.toLocaleString()} كوين
              </Text>
            </View>
          </View>

          {/* أزرار الإجراءات */}
          <View style={styles.actions}>
            <View style={styles.actionCol}>
              <Pressable
                onPress={handleDecline}
                style={({ pressed }) => [styles.btnPress, pressed && { transform: [{ scale: 0.94 }] }]}
              >
                <LinearGradient colors={['#EF4444', '#B91C1C']} style={[styles.btn, styles.btnRejectShadow]}>
                  <X size={28} color="#fff" strokeWidth={3} />
                </LinearGradient>
              </Pressable>
              <Text variant="caption" weight="bold" color="rgba(255,255,255,0.7)">رفض</Text>
            </View>

            <View style={styles.actionCol}>
              <Pressable
                onPress={handleAccept}
                style={({ pressed }) => [styles.btnPress, pressed && { transform: [{ scale: 0.94 }] }]}
              >
                <LinearGradient colors={['#10B981', '#047857']} style={[styles.btn, styles.btnAnswerShadow]}>
                  <Check size={28} color="#fff" strokeWidth={3} />
                </LinearGradient>
              </Pressable>
              <Text variant="caption" weight="bold" color="rgba(255,255,255,0.7)">قبول</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: '40%' },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  typeBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 16,
  },
  typeText: { fontSize: 12, fontWeight: '700' },
  title: { marginBottom: 30, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },

  avatarWrap: { alignItems: 'center', justifyContent: 'center', width: 180, height: 180 },
  pulseRing: {
    position: 'absolute',
    width: 148,
    height: 148,
    borderRadius: 74,
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  avatarRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.goldGlow,
  },
  avatarInner: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: '#1A0A0C',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: { width: 124, height: 124, borderRadius: 62 },
  avatarFallback: {
    backgroundColor: '#E11414',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { marginTop: 20 },
  challengeDesc: { marginTop: 8 },
  gameName: { marginTop: 4, letterSpacing: 0.5 },

  betCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 20,
    ...shadows.sm,
  },
  betRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },

  actions: {
    flexDirection: 'row-reverse',
    gap: 72,
    marginTop: 50,
  },
  actionCol: { alignItems: 'center', gap: 10 },
  btnPress: { borderRadius: 40 },
  btn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnRejectShadow: {
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 6,
  },
  btnAnswerShadow: {
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 6,
  },
});
