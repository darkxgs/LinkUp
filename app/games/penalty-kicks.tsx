/**
 * ضربات الجزاء (Penalty Kicks)
 * - تحدي 1v1
 * - كل لاعب يسدد 5 ضربات + يتصدى لـ 5
 * - الفائز يأخذ 80%، التطبيق 20%
 * - في النسخة الحالية: ضد AI للتجربة
 */

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  Pressable,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Coins, Sparkles, RotateCw, Target, Trophy } from 'lucide-react-native';
import { ArrowLeft } from '@/components/ui/RtlIcons';

import { Text, SoccerBallIcon, GoalNetIcon } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import { useConfig } from '@/contexts/ConfigContext';
import { formatCoins } from '@/services/games/engine';
import { placeBet, recordWin, recordLoss } from '@/services/firebase/gameTransactions';
import { colors, radius, spacing, shadows } from '@/theme';

const { width: SCREEN_W } = Dimensions.get('window');

type Direction = 'left' | 'center' | 'right';
type Phase = 'setup' | 'shooting' | 'goalkeeping' | 'finished';

export default function PenaltyKicksScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const { gamesGlobal } = useConfig();

  // كل الأرقام من لوحة التحكم (config/games) — كانت ثابتة في الكود
  const STAKES = (gamesGlobal.challengeStakeChips?.length
    ? gamesGlobal.challengeStakeChips
    : [10_000, 50_000, 100_000]
  ).map((coins) => ({
    coins,
    label: `$${Math.max(1, Math.round(coins / (gamesGlobal.coinsPerDollar || 10_000)))}`,
  }));
  const totalRounds = Math.max(1, Math.floor(gamesGlobal.penaltyRounds || 5));
  const winnerPercent = Math.min(100, Math.max(1, gamesGlobal.challengeWinnerPercent || 80));

  const [stake, setStake] = useState(10_000);
  const [phase, setPhase] = useState<Phase>('setup');
  const [round, setRound] = useState(1); // 1-5
  const [isShooter, setIsShooter] = useState(true);
  const [myScore, setMyScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [lastResult, setLastResult] = useState<string>('');

  // مراجع متزامنة: تمنع تضخيم النتيجة بالنقر المتكرر داخل نافذة الـ 1.5 ثانية،
  // وتضمن أن التسوية النهائية تقرأ النتيجة الحقيقية (state كان يتأخر جولة).
  const myScoreRef = useRef(0);
  const aiScoreRef = useRef(0);
  const actionLockRef = useRef(false);
  const startingRef = useRef(false);
  const roundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (roundTimerRef.current) clearTimeout(roundTimerRef.current);
    };
  }, []);

  const handleStart = async () => {
    if (startingRef.current) return; // نقرة مزدوجة = رهان مزدوج
    if (!user || user.stats.coins < stake) {
      Alert.alert(t('gifts.insufficientCoins'), `تحتاج ${formatCoins(stake)} عملة`);
      return;
    }

    startingRef.current = true;
    try {
      await placeBet(stake);
      myScoreRef.current = 0;
      aiScoreRef.current = 0;
      actionLockRef.current = false;
      setRound(1);
      setMyScore(0);
      setAiScore(0);
      setIsShooter(true);
      setPhase('shooting');
      setLastResult('');
    } catch (e: any) {
      Alert.alert(t('roomSettings.text32386'), e.message);
    } finally {
      startingRef.current = false;
    }
  };

  const handleShoot = (direction: Direction) => {
    if (phase !== 'shooting' || actionLockRef.current) return;
    actionLockRef.current = true;

    const aiBlock: Direction = ['left', 'center', 'right'][Math.floor(Math.random() * 3)] as Direction;
    const scored = direction !== aiBlock;

    if (scored) {
      myScoreRef.current += 1;
      setMyScore(myScoreRef.current);
      setLastResult('GOAL - هدف!');
    } else {
      setLastResult('صد الحارس!');
    }

    // بعد ثانية، الـ AI يسدد
    roundTimerRef.current = setTimeout(() => {
      actionLockRef.current = false;
      setPhase('goalkeeping');
      setLastResult('');
    }, 1500);
  };

  const handleSave = (direction: Direction) => {
    if (phase !== 'goalkeeping' || actionLockRef.current) return;
    actionLockRef.current = true;

    const aiShoot: Direction = ['left', 'center', 'right'][Math.floor(Math.random() * 3)] as Direction;
    const blocked = direction === aiShoot;

    if (blocked) {
      setLastResult('صد رائع!');
    } else {
      aiScoreRef.current += 1;
      setAiScore(aiScoreRef.current);
      setLastResult('سجل الخصم!');
    }

    // الجولة التالية
    roundTimerRef.current = setTimeout(() => {
      actionLockRef.current = false;
      if (round >= totalRounds) {
        handleFinish();
      } else {
        setRound((r) => r + 1);
        setPhase('shooting');
        setLastResult('');
      }
    }, 1500);
  };

  const handleFinish = async () => {
    setPhase('finished');

    // النتيجة من المراجع المتزامنة — state كان يفقد هدف الجولة الأخيرة
    const finalMy = myScoreRef.current;
    const finalAi = aiScoreRef.current;
    const won = finalMy > finalAi;
    const tie = finalMy === finalAi;
    const totalPot = stake * 2;
    // نسبة الفائز من لوحة التحكم (كانت 80% ثابتة في engine)
    const winnerGets = Math.floor(totalPot * (winnerPercent / 100));

    try {
      if (won) {
        await recordWin('penalty-kicks', stake, winnerGets, winnerGets / stake, {
          myScore: finalMy,
          aiScore: finalAi,
        });
      } else if (tie) {
        // تعادل = استرجاع
        await recordWin('penalty-kicks', stake, stake, 1, { myScore: finalMy, aiScore: finalAi, tie: true });
      } else {
        await recordLoss('penalty-kicks', stake, { myScore: finalMy, aiScore: finalAi });
      }
      await refreshUser();

      setTimeout(() => {
        if (won) {
          Alert.alert(
            `فزت ${finalMy}-${finalAi}!`,
            `ربحت ${winnerGets.toLocaleString()} Casino Coin (${winnerPercent}% من ${formatCoins(totalPot)})`,
          );
        } else if (tie) {
          Alert.alert(`تعادل ${finalMy}-${finalAi}`, `استرجعت رهانك ${formatCoins(stake)}`);
        } else {
          Alert.alert(`خسرت ${finalMy}-${finalAi}`, t('games.text50088'));
        }
      }, 300);
    } catch (e: any) {
      Alert.alert(t('roomSettings.text32386'), e.message);
    }
  };

  const handleReset = () => {
    myScoreRef.current = 0;
    aiScoreRef.current = 0;
    actionLockRef.current = false;
    setPhase('setup');
    setRound(1);
    setMyScore(0);
    setAiScore(0);
    setLastResult('');
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#15803D', '#16A34A', '#22C55E']}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color={colors.white} strokeWidth={2.5} />
        </Pressable>
        <Text variant="h3" weight="bold" color={colors.white}>
          {t('games.text20099')}
        </Text>
        <View style={styles.balancePill}>
          <Coins size={14} color="#FCD34D" strokeWidth={2.5} />
          <Text variant="caption" weight="bold" color={colors.white}>
            {formatCoins(user?.stats.coins ?? 0)}
          </Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Score */}
        {phase !== 'setup' && (
          <View style={styles.scoreBox}>
            <View style={styles.scoreColumn}>
              <Text variant="caption" color={colors.white}>{t('games.text5341')}</Text>
              <Text variant="h1" weight="bold" color="#FCD34D" style={{ fontSize: 40 }}>
                {myScore}
              </Text>
            </View>
            <View style={styles.scoreDivider}>
              <Text variant="caption" color="rgba(255,255,255,0.6)">
                جولة {round}/{totalRounds}
              </Text>
              <Text variant="h2" weight="bold" color={colors.white}>
                vs
              </Text>
            </View>
            <View style={styles.scoreColumn}>
              <Text variant="caption" color={colors.white}>{t('games.text75252')}</Text>
              <Text variant="h1" weight="bold" color="#EF4444" style={{ fontSize: 40 }}>
                {aiScore}
              </Text>
            </View>
          </View>
        )}

        {/* Goal/Save area */}
        <View style={styles.goalArea}>
          <View style={styles.goalNet}>
            {/* Goal Net SVG */}
            <View style={styles.netVisual}>
              <GoalNetIcon size={200} color="rgba(255,255,255,0.5)" />
            </View>

            {/* Ball in center */}
            <View style={styles.ballCenter}>
              <SoccerBallIcon size={48} />
            </View>

            <Text variant="caption" color="rgba(255,255,255,0.7)" align="center">
              {phase === 'shooting' && t('games.text7567')}
              {phase === 'goalkeeping' && t('games.text66941')}
              {phase === 'setup' && t('games.text17178')}
              {phase === 'finished' && t('games.text20128')}
            </Text>

            {lastResult ? (
              <Text variant="h2" weight="bold" color="#FCD34D" align="center" style={{ marginTop: 12 }}>
                {lastResult}
              </Text>
            ) : null}
          </View>

          {/* Goal directions */}
          {(phase === 'shooting' || phase === 'goalkeeping') && (
            <View style={styles.directionsRow}>
              <Pressable
                onPress={() => (phase === 'shooting' ? handleShoot('right') : handleSave('right'))}
                style={styles.directionBtn}
              >
                <LinearGradient
                  colors={['#ED4444', '#EA2626']}
                  style={StyleSheet.absoluteFill}
                />
                <Target size={28} color={colors.white} strokeWidth={2.5} />
                <Text variant="caption" weight="bold" color={colors.white}>
                  {t('games.text23619')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => (phase === 'shooting' ? handleShoot('center') : handleSave('center'))}
                style={styles.directionBtn}
              >
                <LinearGradient
                  colors={['#FCD34D', '#F59E0B']}
                  style={StyleSheet.absoluteFill}
                />
                <Target size={28} color={colors.white} strokeWidth={2.5} />
                <Text variant="caption" weight="bold" color={colors.white}>
                  {t('games.text7096')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => (phase === 'shooting' ? handleShoot('left') : handleSave('left'))}
                style={styles.directionBtn}
              >
                <LinearGradient
                  colors={['#E11414', '#C40E1E']}
                  style={StyleSheet.absoluteFill}
                />
                <Target size={28} color={colors.white} strokeWidth={2.5} />
                <Text variant="caption" weight="bold" color={colors.white}>
                  {t('games.text74932')}
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Result panel */}
        {phase === 'finished' && (
          <View style={styles.resultPanel}>
            <Trophy size={48} color={myScore > aiScore ? '#FCD34D' : '#9CA3AF'} fill={myScore > aiScore ? '#FCD34D' : 'transparent'} strokeWidth={2} />
            <Text variant="h2" weight="bold" color={colors.white}>
              {myScore > aiScore ? t('games.text39532') : myScore === aiScore ? t('games.text5188') : t('games.text65545')}
            </Text>
            <Text variant="bodySmall" color="rgba(255,255,255,0.85)">
              النتيجة النهائية: {myScore} - {aiScore}
            </Text>
          </View>
        )}
      </View>

      {/* Bottom */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.sm }]}>
        {phase === 'setup' && (
          <>
            <View style={styles.stakesRow}>
              {STAKES.map((s) => {
                const active = stake === s.coins;
                return (
                  <Pressable
                    key={s.coins}
                    onPress={() => setStake(s.coins)}
                    style={[styles.stakeBtn, active && styles.stakeBtnActive]}
                  >
                    <Coins size={12} color="#FCD34D" strokeWidth={2.5} />
                    <Text variant="bodySmall" weight="bold" color={colors.white}>
                      {s.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable onPress={handleStart} style={styles.startBtn}>
              <LinearGradient
                colors={['#FCD34D', '#F59E0B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              <Trophy size={18} color={colors.white} strokeWidth={2.5} />
              <Text variant="button" weight="bold" color={colors.white}>
                ابدأ التحدي - {formatCoins(stake)}
              </Text>
            </Pressable>
            <Text variant="caption" color="rgba(255,255,255,0.7)" align="center" style={{ marginTop: 4 }}>
              {t('games.text92259')}
            </Text>
          </>
        )}
        {phase === 'finished' && (
          <Pressable onPress={handleReset} style={styles.startBtn}>
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <RotateCw size={18} color={colors.white} strokeWidth={2.5} />
            <Text variant="button" weight="bold" color={colors.white}>
              {t('games.text82124')}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  balancePill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: radius.full,
  },

  content: { flex: 1, padding: spacing.base },

  scoreBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.base,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: radius.lg,
    marginBottom: spacing.base,
  },
  scoreColumn: {
    flex: 1,
    alignItems: 'center',
  },
  scoreDivider: {
    alignItems: 'center',
    gap: 4,
  },

  goalArea: {
    flex: 1,
    gap: spacing.base,
  },
  goalNet: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: radius.lg,
    padding: spacing.xl,
    minHeight: 200,
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
    position: 'relative',
    overflow: 'hidden',
  },
  netVisual: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    opacity: 0.4,
  },
  ballCenter: {
    alignSelf: 'center',
    marginVertical: 20,
  },

  directionsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  directionBtn: {
    flex: 1,
    height: 80,
    borderRadius: radius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    ...shadows.md,
  },

  resultPanel: {
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: radius.lg,
    gap: 8,
  },

  bottom: {
    padding: spacing.base,
    backgroundColor: 'rgba(0,0,0,0.5)',
    gap: 12,
  },
  stakesRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  stakeBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  stakeBtnActive: {
    borderColor: '#FCD34D',
    backgroundColor: 'rgba(252, 211, 77, 0.2)',
  },
  startBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
  },
});
