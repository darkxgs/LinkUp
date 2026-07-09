/**
 * شاشة مكالمة واردة (مسار من الإشعار) — هوية LinkUp
 * المسار الرئيسي داخل التطبيق: IncomingCallModal في _layout
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Vibration, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Phone, PhoneOff, Video as VideoIcon } from 'lucide-react-native';

import { lu } from '@/theme/lu-brand';
import { rejectCall, answerCall } from '@/services/incomingCalls';
import { logChatCallMessage } from '@/services/firebase/chatCallLogs';
import { useAuth } from '@/hooks/useAuth';
import { useLightStatusBarOnFocus } from '@/hooks/useLightStatusBarOnFocus';

export default function IncomingCallScreen() {
  // شاشة داكنة — أيقونات فاتحة أثناء التركيز، وتعود داكنة عند المغادرة
  useLightStatusBarOnFocus();
  const params = useLocalSearchParams<{
    type?: string;
    from?: string;
    channel?: string;
    fromName?: string;
    fromAvatar?: string;
    callId?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const type = params.type === 'video' ? 'video' : 'voice';
  const fromUid = params.from ?? '';
  const channelName = params.channel ?? '';
  const isVideo = type === 'video';

  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!fromUid || !channelName) {
      Alert.alert('مكالمة غير صالحة', 'استخدم إشعار المكالمة من داخل التطبيق.', [
        { text: 'حسناً', onPress: () => router.back() },
      ]);
      return;
    }

    const pattern = [0, 1000, 500, 1000];
    Vibration.vibrate(pattern, true);
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    ).start();
    return () => Vibration.cancel();
  }, [fromUid, channelName, pulseAnim, router]);

  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] });
  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  const openCall = async () => {
    Vibration.cancel();
    if (params.callId) {
      await answerCall(params.callId).catch(() => {});
    }
    const ch = encodeURIComponent(channelName);
    if (isVideo) {
      router.replace(`/call/video/${fromUid}?channel=${ch}` as any);
    } else {
      router.replace(`/call/${fromUid}?channel=${ch}` as any);
    }
  };

  const handleDecline = async () => {
    Vibration.cancel();
    if (params.callId) {
      await rejectCall(params.callId).catch(() => {});
    }
    if (fromUid && channelName && user?.uid) {
      void logChatCallMessage({
        callerUid: fromUid,
        calleeUid: user.uid,
        channelName,
        callType: type,
        status: 'declined',
      }).catch(() => {});
    }
    router.back();
  };

  if (!fromUid || !channelName) {
    return <View style={styles.fill} />;
  }

  return (
    <View style={styles.fill}>
      <LinearGradient colors={['#3A1316', '#26090C', '#1A0A0C']} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(225, 20, 20,0.22)', 'rgba(236, 62, 62, 0.10)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.glow}
        pointerEvents="none"
      />

      <View style={[styles.body, { paddingTop: insets.top + 40 }]}>
        <View style={styles.typeBadge}>
          {isVideo ? <VideoIcon size={15} color={lu.colors.pink1} /> : <Phone size={15} color={lu.colors.pink1} />}
          <Text style={styles.typeText}>{isVideo ? 'مكالمة فيديو واردة' : 'مكالمة صوتية واردة'}</Text>
        </View>

        <View style={styles.avatarWrap}>
          <Animated.View
            style={[styles.pulseRing, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]}
          />
          <LinearGradient
            colors={lu.gradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatarRing}
          >
            <View style={styles.avatarInner}>
              {params.fromAvatar ? (
                <Image source={{ uri: params.fromAvatar }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarFb]}>
                  <Text style={styles.avatarLetter}>{(params.fromName ?? '?')[0]}</Text>
                </View>
              )}
            </View>
          </LinearGradient>
        </View>

        <Text style={styles.name}>{params.fromName ?? 'مستخدم'}</Text>
        <Text style={styles.sub}>يتصل بك الآن...</Text>

        <View style={styles.actions}>
          <View style={styles.actionCol}>
            <Pressable
              onPress={handleDecline}
              style={({ pressed }) => [styles.btnPress, pressed && { transform: [{ scale: 0.94 }] }]}
            >
              <LinearGradient colors={['#FF5C5C', '#FF2E3E']} style={[styles.btn, styles.btnRejectShadow]}>
                <PhoneOff size={30} color="#fff" strokeWidth={2.4} />
              </LinearGradient>
            </Pressable>
            <Text style={styles.label}>رفض</Text>
          </View>

          <View style={styles.actionCol}>
            <Pressable
              onPress={openCall}
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
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#1A0A0C' },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: '60%' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: lu.radius.pill,
    backgroundColor: 'rgba(255,255,255,0.10)',
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
  avatarFb: { backgroundColor: lu.colors.purple, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#fff', fontSize: 56, fontFamily: lu.fonts.display },
  name: { color: '#fff', fontSize: 30, fontFamily: lu.fonts.display, marginTop: 26 },
  sub: { color: 'rgba(255,255,255,0.72)', fontSize: 14.5, marginTop: 6, fontFamily: lu.fonts.body },

  actions: { flexDirection: 'row', gap: 72, marginTop: 80 },
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
    shadowColor: '#FF2E3E',
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
