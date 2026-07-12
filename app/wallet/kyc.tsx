/**
 * LinkUp App — KYC Verification Screen
 * التحقق من الهوية لتفعيل السحب (Luxurious Dark Design)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  GestureResponderEvent,
  ImageBackground,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
  ShieldCheck,
  User,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react-native';

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui';
import { KycFaceVerify } from '@/components/kyc/KycFaceVerify';
import { useAuth } from '@/hooks/useAuth';
import { useKycVerification, resolveKycUiPhase, type KycUiPhase } from '@/hooks/useKycVerification';
import { failStaleKycProcessing, type KycSubmitResult } from '@/services/firebase/kyc';
import { BackChevron } from '@/components/ui/RtlChevron';
import { shouldShowVerificationCenter } from '@/utils/genderAccess';
import { useLightStatusBarOnFocus } from '@/hooks/useLightStatusBarOnFocus';

const { width } = Dimensions.get('window');
const CITY_SKYLINE_URL = 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=1000&auto=format&fit=crop';

function AnimatedPressable({
  children,
  onPress,
  style,
  scaleTo = 0.95,
  duration = 80,
  disabled,
}: {
  children: React.ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  style?: any;
  scaleTo?: number;
  duration?: number;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => {
        if (!disabled) {
          scale.value = withTiming(scaleTo, { duration });
        }
      }}
      onPressOut={() => {
        if (!disabled) {
          scale.value = withSpring(1.0);
        }
      }}
      style={style}
    >
      <Animated.View style={[{ flex: style?.flex }, animStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

type KycMode = 'choose' | 'face';

export default function KYCScreen() {
  // شاشة داكنة الخلفية/الرأس — أيقونات شريط الحالة فاتحة أثناء التركيز فقط
  useLightStatusBarOnFocus();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const kycState = useKycVerification();
  const kycPhase = useMemo(() => resolveKycUiPhase(kycState), [kycState]);
  const accountSuspended =
    user?.isBanned === true && user?.banReason !== 'gender_verification_mismatch';

  const [mode, setMode] = useState<KycMode>('choose');
  // إرسال جارٍ من هذه الشاشة — يمنع تبديل الواجهة عندما يكتب العميل status: processing
  const [submitting, setSubmitting] = useState(false);
  // المدخل دائماً تحقق الـ AI بالوجه — «قيد المراجعة» أو «معالجة» عالقة لا تقفل إعادة المحاولة
  const kycBlocked = kycPhase === 'verified' || accountSuspended;

  // Personal info (للتحقق بالوجه)
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    if (!user) return;
    if (!shouldShowVerificationCenter(user)) {
      router.replace('/(tabs)/profile' as any);
    }
  }, [user, router]);

  useEffect(() => {
    if (user?.profile?.displayName) {
      setFullName((prev) => (prev.trim() ? prev : user.profile!.displayName));
    }
  }, [user?.uid, user?.profile?.displayName]);

  useEffect(() => {
    // أثناء الإرسال لا نبدّل الواجهة — كتابة status: processing من العميل تُطلق onSnapshot فوراً
    if (kycState.loading || accountSuspended || submitting) return;
    if (kycPhase === 'verified') {
      setMode('choose');
      return;
    }
    // pending/processing/rejected/none → دائماً تدفق التحقق بالوجه (AI) مع بانر الحالة أعلاه
    setMode('face');
  }, [kycState.loading, accountSuspended, kycPhase, submitting]);

  const isFaceNameValid = fullName.trim().length >= 2;

  const goBackStep = () => {
    if (mode === 'face') {
      router.back();
      return;
    }
    router.back();
  };

  const handleKycResult = (result: KycSubmitResult) => {
    if (result.suspended) {
      Alert.alert(t('kyc.suspendedTitle'), t('kyc.suspendedBody'), [
        { text: t('common.ok'), onPress: () => router.replace('/(auth)/login' as any) },
      ]);
      return;
    }
    if (result.retry) {
      // غير واضح/غير حاسم — رسالة إعادة تصوير فورية (ليست رفضاً نهائياً ولا مراجعة)
      Alert.alert(
        t('kyc.retryTitle'),
        result.message ?? t('kyc.retryBody'),
        [{ text: t('common.ok') }],
      );
      return;
    }
    if (result.genderMismatch || (result.ok === false && !result.verified && !result.pending)) {
      Alert.alert(t('kyc.rejectedTitle'), result.message ?? t('kyc.rejectedBody'), [
        { text: t('common.ok') },
      ]);
      return;
    }
    if (result.verified) {
      Alert.alert(t('kyc.approvedTitle'), t('kyc.approvedBody'), [
        { text: t('common.ok'), onPress: () => router.replace('/(tabs)' as any) },
      ]);
      return;
    }
    // نبقى على الشاشة — بانر الحالة يتحدّث لحظياً (onSnapshot) عند موافقة/رفض الإدارة
    Alert.alert(t('kyc.pendingTitle'), result.message ?? t('kyc.pendingBody'), [
      { text: t('common.ok') },
    ]);
  };

  // «معالجة» عالقة (فشل استدعاء قديم قبل وصول السيرفر) — تُحوَّل تلقائياً إلى failed
  // فيختفي البانر وتُتاح إعادة المحاولة فوراً بدل «قيد المراجعة» وهمية لأجل غير مسمى
  useEffect(() => {
    if (kycState.loading || submitting || kycPhase !== 'processing') return;
    void failStaleKycProcessing();
    const id = setInterval(() => {
      void failStaleKycProcessing();
    }, 30_000);
    return () => clearInterval(id);
  }, [kycState.loading, submitting, kycPhase]);

  // البانر يعرض الحالة الحقيقية — «جارٍ المعالجة» صادقة لأن العالقة تُصحَّح أعلاه
  const bannerPhase: KycUiPhase = kycPhase;

  return (
    <View style={styles.container}>
      {/* City Skyline Background */}
      <ImageBackground
        source={{ uri: CITY_SKYLINE_URL }}
        style={{ width: '100%', height: 350, position: 'absolute', top: 0 }}
        imageStyle={{ opacity: 0.6 }}
      >
        <LinearGradient
          colors={['rgba(20, 10, 12, 0.1)', 'rgba(20, 10, 12, 0.9)', '#140A0C']}
          style={StyleSheet.absoluteFill}
        />
      </ImageBackground>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 120 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <AnimatedPressable
              onPress={goBackStep}
              style={styles.iconBtn}
              scaleTo={0.9}
              disabled={false}
            >
              <BlurView intensity={20} tint="light" style={styles.glassBtn}>
                <BackChevron color="#fff" size={22} />
              </BlurView>
            </AnimatedPressable>
            <Text variant="h2" weight="bold" color="#fff" style={styles.headerTitle}>
              {t('wallet.text44804')}
            </Text>
            <View style={{ width: 44 }} />
          </View>

          {/* Security note */}
          {mode === 'face' ? (
          <View style={styles.securityNote}>
            <View style={styles.securityIconBg}>
              <ShieldCheck size={20} color="#34D399" strokeWidth={2.5} />
            </View>
            <View style={{ flex: 1, alignItems: 'flex-start' }}>
              <Text variant="bodySmall" weight="bold" color="#6EE7B7">
                {t('wallet.text55883')}
              </Text>
              <Text variant="caption" color="rgba(255,255,255,0.7)" style={{ marginTop: 2 }}>
                {t('wallet.text28844')}
              </Text>
            </View>
          </View>
          ) : null}

          {!kycState.loading && mode !== 'choose' ? (
            <KycStatusBanner
              phase={bannerPhase}
              suspended={accountSuspended}
              rejectionReason={kycState.rejectionReason}
              t={t}
            />
          ) : null}

          {/* === اختيار طريقة التحقق === */}
          {mode === 'choose' && !kycState.loading ? (
            <View style={styles.stepContent}>
              <Text variant="h3" weight="bold" color="#fff" style={{ marginBottom: 4, textAlign: 'right' }}>
                {t('kyc.chooseTitle')}
              </Text>
              <Text variant="bodySmall" color="rgba(255,255,255,0.55)" style={{ marginBottom: 20, textAlign: 'right' }}>
                {t('kyc.chooseSubtitle')}
              </Text>

              {kycPhase === 'verified' ? (
                <View style={[styles.statusBanner, styles.verifiedBanner]}>
                  <CheckCircle2 size={22} color="#10B981" />
                  <Text variant="bodySmall" weight="bold" color="#6EE7B7" style={{ flex: 1, textAlign: 'right' }}>
                    {t('kyc.alreadyVerified')}
                  </Text>
                </View>
              ) : kycPhase === 'pending' || kycPhase === 'processing' ? (
                <View style={[styles.statusBanner, styles.pendingBanner]}>
                  <AlertCircle size={22} color="#FCD34D" />
                  <Text variant="bodySmall" weight="bold" color="#FCD34D" style={{ flex: 1, textAlign: 'right' }}>
                    {kycPhase === 'processing' ? t('kyc.statusProcessing') : t('kyc.statusPendingBanner')}
                  </Text>
                </View>
              ) : kycPhase === 'rejected' ? (
                <View style={[styles.statusBanner, styles.rejectedBanner]}>
                  <AlertCircle size={22} color="#FCA5A5" />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodySmall" weight="bold" color="#FCA5A5" style={{ textAlign: 'right' }}>
                      {t('kyc.statusRejectedBanner')}
                    </Text>
                    <Text variant="caption" color="rgba(252,165,165,0.85)" style={{ marginTop: 4, textAlign: 'right' }}>
                      {kycState.rejectionReason ?? t('kyc.statusRejectedHint')}
                    </Text>
                  </View>
                </View>
              ) : accountSuspended ? (
                <View style={[styles.statusBanner, styles.rejectedBanner]}>
                  <AlertCircle size={22} color="#FCA5A5" />
                  <Text variant="bodySmall" weight="bold" color="#FCA5A5" style={{ flex: 1, textAlign: 'right' }}>
                    {t('kyc.accountSuspendedBanner')}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* === التحقق الفوري بالوجه — الاسم + صورة فقط === */}
          {mode === 'face' && (
            <View style={styles.stepContent}>
              <Text variant="h3" weight="bold" color="#fff" style={{ marginBottom: 4, textAlign: 'right' }}>
                {t('kyc.faceTitle')}
              </Text>
              <Text variant="bodySmall" color="rgba(255,255,255,0.5)" style={{ marginBottom: 20, textAlign: 'right' }}>
                {t('kyc.faceSubtitle')}
              </Text>

              <View style={styles.field}>
                <Text variant="label" color="rgba(255,255,255,0.7)" style={styles.fieldLabel}>
                  {t('auth.fullName')}
                </Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder={t('wallet.text27373')}
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    textAlign="right"
                  />
                  <User size={18} color="rgba(255,255,255,0.4)" />
                </View>
              </View>

              <KycFaceVerify
                fullName={fullName}
                displayName={user?.profile?.displayName ?? fullName}
                disabled={!isFaceNameValid || kycBlocked}
                onResult={handleKycResult}
                onBusyChange={setSubmitting}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const KycStatusBanner: React.FC<{
  phase: KycUiPhase;
  suspended: boolean;
  rejectionReason?: string;
  t: (key: string, opts?: Record<string, string>) => string;
}> = ({ phase, suspended, rejectionReason, t }) => {
  if (suspended) {
    return (
      <View style={[styles.statusBanner, styles.rejectedBanner]}>
        <AlertCircle size={20} color="#FCA5A5" />
        <View style={{ flex: 1 }}>
          <Text variant="bodySmall" weight="bold" color="#FCA5A5" style={{ textAlign: 'right' }}>
            {t('kyc.accountSuspendedBanner')}
          </Text>
        </View>
      </View>
    );
  }
  if (phase === 'verified') {
    return (
      <View style={[styles.statusBanner, styles.verifiedBanner]}>
        <CheckCircle2 size={20} color="#10B981" />
        <Text variant="bodySmall" weight="bold" color="#6EE7B7" style={{ flex: 1, textAlign: 'right' }}>
          {t('kyc.alreadyVerified')}
        </Text>
      </View>
    );
  }
  if (phase === 'processing') {
    return (
      <View style={[styles.statusBanner, styles.pendingBanner]}>
        <AlertCircle size={20} color="#FCD34D" />
        <Text variant="bodySmall" weight="bold" color="#FCD34D" style={{ flex: 1, textAlign: 'right' }}>
          {t('kyc.statusProcessing')}
        </Text>
      </View>
    );
  }
  if (phase === 'pending') {
    return (
      <View style={[styles.statusBanner, styles.pendingBanner]}>
        <AlertCircle size={20} color="#FCD34D" />
        <Text variant="bodySmall" weight="bold" color="#FCD34D" style={{ flex: 1, textAlign: 'right' }}>
          {t('kyc.statusPendingBanner')}
        </Text>
      </View>
    );
  }
  if (phase === 'rejected') {
    return (
      <View style={[styles.statusBanner, styles.rejectedBanner]}>
        <AlertCircle size={20} color="#FCA5A5" />
        <View style={{ flex: 1 }}>
          <Text variant="bodySmall" weight="bold" color="#FCA5A5" style={{ textAlign: 'right' }}>
            {t('kyc.statusRejectedBanner')}
          </Text>
          {rejectionReason ? (
            <Text variant="caption" color="rgba(252,165,165,0.85)" style={{ marginTop: 4, textAlign: 'right' }}>
              {rejectionReason}
            </Text>
          ) : (
            <Text variant="caption" color="rgba(252,165,165,0.75)" style={{ marginTop: 4, textAlign: 'right' }}>
              {t('kyc.statusRejectedHint')}
            </Text>
          )}
        </View>
      </View>
    );
  }
  return null;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#140A0C' },
  scrollContent: { paddingHorizontal: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  iconBtn: {
    width: 44,
    height: 44,
  },
  glassBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: {
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },

  nationalityContainer: {
    width: '100%',
  },
  docUploaderContainer: {
    width: '100%',
  },

  // Steps
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    justifyContent: 'space-between',
  },
  stepIndicator: {
    alignItems: 'center',
    gap: 8,
  },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  stepCircleActive: {
    backgroundColor: 'rgba(225, 20, 20, 0.2)',
    borderColor: '#E11414',
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  stepCircleCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10B981',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 8,
    marginBottom: 20,
  },
  stepLineActive: {
    backgroundColor: '#E11414',
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 3,
  },

  // Security note
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  securityIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginRight: 16,
  },

  // Step content
  stepContent: {
    marginBottom: 24,
  },
  statusBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
  },
  verifiedBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  pendingBanner: {
    backgroundColor: 'rgba(252, 211, 77, 0.1)',
    borderColor: 'rgba(252, 211, 77, 0.35)',
  },
  rejectedBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  modeCard: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  modeCardInner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 14,
    padding: 18,
  },
  modeIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeToggle: {
    alignSelf: 'center',
    paddingVertical: 10,
    marginTop: 8,
  },
  field: {
    marginBottom: 20,
  },
  fieldLabel: {
    marginBottom: 8,
    paddingHorizontal: 4,
    textAlign: 'right',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    padding: 0,
    marginRight: 12,
  },

  // Document uploader
  docUploader: {
    marginBottom: 20,
  },
  docUploaded: {
    height: 180,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.5)',
  },
  docPreview: {
    width: '100%',
    height: '100%',
  },
  docOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16, 185, 129, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docPlaceholder: {
    height: 180,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    overflow: 'hidden',
  },
  docIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },

  // Tips
  tipsCard: {
    padding: 16,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  // Review
  reviewCard: {
    padding: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  reviewDocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  reviewDocThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginLeft: 12,
  },
  termsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },

  // Bottom Floating Bar
  bottomBarWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 30, // Extra space for safe area
    paddingTop: 10,
  },
  bottomBar: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
  },
  glassTopBorder: {
    position: 'absolute',
    top: 0, left: 0, right: 0, height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
});
