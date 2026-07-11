/**
 * IncomingCallModal — modal فل-سكرين للمكالمة الواردة (هوية LinkUp)
 *
 * يستمع real-time للمكالمات الواردة ويظهر فوق كل الشاشات.
 * زرّان كبيران: رد (أخضر برّاند) / رفض (أحمر برّاند) — بتدرّجات وظلال هوية LinkUp.
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  Vibration,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Phone, PhoneOff, Video } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import {
  subscribeToIncomingCalls,
  answerCall,
  rejectCall,
  INCOMING_CALL_RING_WINDOW_MS,
  type IncomingCall,
} from '@/services/incomingCalls';
import { logChatCallMessage } from '@/services/firebase/chatCallLogs';
import { useAuth } from '@/hooks/useAuth';
import { canUserMakeCalls } from '@/utils/genderAccess';
import { lu } from '@/theme/lu-brand';

export function IncomingCallModal() {
  const router = useRouter();
  const { user } = useAuth();
  const [call, setCall] = useState<IncomingCall | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;

  // الاستماع للمكالمات الواردة (فقط إذا المستخدم مسجّل دخول)
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToIncomingCalls((calls) => {
      // أول مكالمة ترنّ
      const ringing = calls[0] ?? null;
      setCall(ringing);
    });
    return unsub;
  }, [user?.uid]);

  // رفض تلقائي للإناث غير الموثّقات — لا يمكنهن استقبال مكالمات
  useEffect(() => {
    if (!call || !user) return;
    if (!canUserMakeCalls(user)) {
      void rejectCall(call.id).then(() => setCall(null));
    }
  }, [call?.id, user]);

  // انتهاء نافذة الرنين — المتصل لا يحذف الوثيقة عند الاستسلام، فبدون هذا
  // المؤقّت كان المودال يظل يرنّ إلى ما لا نهاية بعد إقفال المتصل
  useEffect(() => {
    if (!call) return;
    const remaining = call.createdAt + INCOMING_CALL_RING_WINDOW_MS - Date.now();
    if (remaining <= 0) {
      setCall(null);
      return;
    }
    const timer = setTimeout(() => setCall(null), remaining);
    return () => clearTimeout(timer);
  }, [call?.id]);

  // اهتزاز ونبض الحلقة عند الرنين
  useEffect(() => {
    if (!call) {
      pulse.setValue(0);
      return;
    }
    if (Platform.OS === 'android') {
      Vibration.vibrate([0, 1000, 500, 1000, 500], true);
    }
    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    pulseAnim.start();

    return () => {
      Vibration.cancel();
      pulseAnim.stop();
    };
  }, [call?.id]);

  if (!call) return null;

  if (user && !canUserMakeCalls(user)) return null;

  const isVideo = call.type === 'video';

  const handleAnswer = async () => {
    Vibration.cancel();
    const channel = encodeURIComponent(call.channelName);
    const type = call.type;
    await answerCall(call.id);
    setCall(null);
    if (type === 'video') {
      router.push(`/call/video/${call.from}?channel=${channel}` as any);
    } else {
      router.push(`/call/${call.from}?channel=${channel}` as any);
    }
  };

  const handleReject = async () => {
    Vibration.cancel();
    const rejected = call;
    await rejectCall(call.id);
    setCall(null);
    if (rejected?.from && rejected.channelName && user?.uid) {
      void logChatCallMessage({
        callerUid: rejected.from,
        calleeUid: user.uid,
        channelName: rejected.channelName,
        callType: rejected.type,
        status: 'declined',
      }).catch(() => {});
    }
  };

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={StyleSheet.absoluteFill}>
        {/* خلفية غامرة بهوية LinkUp */}
        <LinearGradient colors={['#3A1316', '#26090C', '#1A0A0C']} style={StyleSheet.absoluteFill} />
        {/* توهّج البراند (وردي → أزرق) */}
        <LinearGradient
          colors={['rgba(225, 20, 20,0.22)', 'rgba(236, 62, 62, 0.10)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.glow}
          pointerEvents="none"
        />

        <View style={styles.container}>
          {/* شارة النوع */}
          <View style={styles.typeBadge}>
            {isVideo ? (
              <Video size={15} color={lu.colors.pink1} />
            ) : (
              <Phone size={15} color={lu.colors.pink1} />
            )}
            <Text style={styles.typeText}>
              {isVideo ? 'مكالمة فيديو واردة' : 'مكالمة صوتية واردة'}
            </Text>
          </View>

          {/* الصورة + حلقة براند نابضة */}
          <View style={styles.avatarWrap}>
            <Animated.View
              style={[styles.pulseRing, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
            />
            <LinearGradient
              colors={lu.gradients.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarRing}
            >
              <View style={styles.avatarInner}>
                {call.fromAvatar ? (
                  <Image source={{ uri: call.fromAvatar }} style={styles.avatar} contentFit="cover" cachePolicy="memory-disk" recyclingKey={call.fromAvatar} transition={150} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarLetter}>{call.fromName?.[0] ?? '؟'}</Text>
                  </View>
                )}
              </View>
            </LinearGradient>
          </View>

          {/* الاسم */}
          <Text style={styles.name}>{call.fromName}</Text>
          <Text style={styles.subtitle}>يتصل بك الآن...</Text>

          {/* الأزرار */}
          <View style={styles.actions}>
            <View style={styles.actionCol}>
              <Pressable
                onPress={handleReject}
                style={({ pressed }) => [styles.btnPress, pressed && { transform: [{ scale: 0.94 }] }]}
              >
                <LinearGradient colors={['#FF5C7A', '#FF2E62']} style={[styles.btn, styles.btnRejectShadow]}>
                  <PhoneOff size={30} color="#fff" strokeWidth={2.4} />
                </LinearGradient>
              </Pressable>
              <Text style={styles.label}>رفض</Text>
            </View>

            <View style={styles.actionCol}>
              <Pressable
                onPress={handleAnswer}
                style={({ pressed }) => [styles.btnPress, pressed && { transform: [{ scale: 0.94 }] }]}
              >
                <LinearGradient colors={lu.gradients.mint} style={[styles.btn, styles.btnAnswerShadow]}>
                  <Phone size={30} color="#fff" strokeWidth={2.4} />
                </LinearGradient>
              </Pressable>
              <Text style={styles.label}>قبول</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: '60%' },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: lu.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    marginBottom: 40,
  },
  typeText: { color: '#fff', fontSize: 13.5, fontFamily: lu.fonts.bodyBold },

  avatarWrap: { alignItems: 'center', justifyContent: 'center', width: 200, height: 200 },
  pulseRing: {
    position: 'absolute',
    width: 168,
    height: 168,
    borderRadius: 84,
    borderWidth: 2,
    borderColor: lu.colors.pink1,
  },
  avatarRing: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    ...lu.shadows.grad,
  },
  avatarInner: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#1A0A0C',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: { width: 142, height: 142, borderRadius: 71 },
  avatarFallback: {
    backgroundColor: lu.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: '#fff', fontSize: 56, fontFamily: lu.fonts.display },
  name: { color: '#fff', fontSize: 30, fontFamily: lu.fonts.display, marginTop: 26 },
  subtitle: { color: 'rgba(255,255,255,0.72)', fontSize: 14.5, marginTop: 6, fontFamily: lu.fonts.body },

  actions: {
    flexDirection: 'row',
    gap: 72,
    marginTop: 80,
  },
  actionCol: { alignItems: 'center', gap: 12 },
  btnPress: { borderRadius: 40 },
  btn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnRejectShadow: {
    shadowColor: '#FF2E62',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 8,
  },
  btnAnswerShadow: {
    shadowColor: '#2BD9A8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 8,
  },
  label: { color: 'rgba(255,255,255,0.85)', fontSize: 13.5, fontFamily: lu.fonts.bodyBold },
});
