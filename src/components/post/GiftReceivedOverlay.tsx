/**
 * بانر لحظي يظهر على أي شاشة عند وصول هدية على منشور المستخدم.
 * حدث مهم — يظهر فوراً (مش بس في قائمة الإشعارات) ويحوي:
 * شكل الهدية + قيمتها + اسم المُرسِل + صورته مع إطاره المفعّل لو موجود.
 * مركّب عالمياً في app/_layout.tsx فوق كل الشاشات.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Gift as GiftIcon } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { GiftVisual } from '@/components/ui/GiftVisual';
import { useAuth } from '@/hooks/useAuth';
import { useConfig } from '@/contexts/ConfigContext';
import { useEquippedFrameUrl } from '@/hooks/useEquippedFrameUrl';
import {
  subscribeToNotifications,
  type Notification,
} from '@/services/firebase/notifications';
import { lu } from '@/theme/lu-brand';

/** الهدية التي نعرضها حالياً في البانر */
type GiftPop = {
  id: string;
  fromUid?: string;
  fromName: string;
  fromAvatar?: string;
  giftId?: string;
  giftName?: string;
  value: number;
  quantity: number;
  postId?: string;
  route?: string;
};

/** أقصى عمر لإشعار لنعتبره "حدث للتو" ونعرضه كبانر (بعده نتجاهله) */
const FRESH_WINDOW_MS = 120_000;
const VISIBLE_MS = 4500;

function toGiftPop(n: Notification): GiftPop | null {
  const data = n.data ?? {};
  const postId = typeof data.postId === 'string' ? data.postId : undefined;
  // مخصّص لهدايا المنشورات فقط — هدايا الغرف لها أنيميشن داخل الغرفة
  if (!postId) return null;
  return {
    id: n.id,
    fromUid: n.fromUid,
    fromName: n.fromName || String(data.title ?? ''),
    fromAvatar: n.fromAvatar,
    giftId: typeof data.giftId === 'string' ? data.giftId : undefined,
    giftName: typeof data.giftName === 'string' ? data.giftName : undefined,
    value: Number(data.giftValue ?? 0) || 0,
    quantity: Number(data.quantity ?? 1) || 1,
    postId,
    route: typeof data.route === 'string' ? data.route : `/post/${postId}`,
  };
}

export function GiftReceivedOverlay() {
  const { user } = useAuth();
  const { gifts } = useConfig();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [current, setCurrent] = useState<GiftPop | null>(null);
  const queueRef = useRef<GiftPop[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const readyRef = useRef(false);
  const showingRef = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anim = useRef(new Animated.Value(0)).current;

  // إطار المُرسِل المفعّل (يتحدّث حياً) — للهدية المعروضة حالياً
  const frameUrl = useEquippedFrameUrl(current?.fromUid);

  // يعرض العنصر التالي من الطابور — مستقر (يعتمد على anim فقط) فلا يعيد الاشتراك
  const pump = useCallback(() => {
    if (showingRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    showingRef.current = true;
    setCurrent(next);
    anim.setValue(0);
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      bounciness: 8,
      speed: 12,
    }).start();
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }).start(() => {
        showingRef.current = false;
        setCurrent(null);
        pump();
      });
    }, VISIBLE_MS);
  }, [anim]);

  // اشتراك واحد فقط لكل مستخدم — لا يُعاد عند ظهور/اختفاء البانر
  useEffect(() => {
    if (!user?.uid) return;
    seenRef.current = new Set();
    readyRef.current = false;

    const unsub = subscribeToNotifications((items) => {
      const now = Date.now();

      // هدايا لم نعرضها بعد، وليست من المستخدم نفسه، وأحدث من مدة معيّنة
      const pickFresh = (maxAgeMs: number, requireUnread: boolean) =>
        items
          .filter(
            (n) =>
              n.type === 'gift' &&
              n.fromUid !== user.uid &&
              !seenRef.current.has(n.id) &&
              (!requireUnread || !n.isRead) &&
              now - (n.createdAt ?? 0) < maxAgeMs,
          )
          .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));

      const enqueue = (list: Notification[]): boolean => {
        let added = false;
        list.forEach((n) => {
          seenRef.current.add(n.id);
          const pop = toGiftPop(n); // يرجع null لغير هدايا المنشورات
          if (pop) {
            queueRef.current.push(pop);
            added = true;
          }
        });
        return added;
      };

      if (!readyRef.current) {
        readyRef.current = true;
        // خط الأساس: نتجاهل تاريخ الإشعارات كي لا يُعاد عرضه عند كل فتح للتطبيق،
        // لكن نعرض هدية وصلت لتوّها (سباق الإقلاع): غير مقروءة وعمرها < 30 ثانية.
        const justArrived = pickFresh(30_000, true);
        items.forEach((n) => seenRef.current.add(n.id));
        justArrived.forEach((n) => seenRef.current.delete(n.id)); // نُبقيها قابلة للعرض
        if (enqueue(justArrived)) pump();
        return;
      }

      // بعد خط الأساس: أي هدية منشور جديدة تصل حياً تظهر فوق أي شاشة
      if (enqueue(pickFresh(FRESH_WINDOW_MS, false))) pump();
    });

    return () => {
      unsub();
      if (hideTimer.current) clearTimeout(hideTimer.current);
      showingRef.current = false;
      queueRef.current = [];
    };
  }, [user?.uid, pump]);

  const handlePress = useCallback(() => {
    const target = current?.route;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    Animated.timing(anim, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(() => {
      showingRef.current = false;
      setCurrent(null);
      pump();
    });
    if (target) router.push(target as any);
  }, [current?.route, anim, router, pump]);

  if (!current) return null;

  const giftCfg = current.giftId
    ? gifts.find((g) => g.id === current.giftId)
    : undefined;
  const giftLabel = current.giftName || giftCfg?.name || '';
  const giftText =
    current.quantity > 1 ? `${giftLabel} ×${current.quantity}` : giftLabel;

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-140, 0],
  });

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.host]}
      pointerEvents="box-none"
    >
      <Animated.View
        style={[
          styles.animWrap,
          { marginTop: insets.top + 8, opacity: anim, transform: [{ translateY }] },
        ]}
        pointerEvents="auto"
      >
        <Pressable onPress={handlePress}>
          <LinearGradient
            colors={['#3A1015', '#8A0E12', '#E11414']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            {/* صورة المُرسِل مع الإطار */}
            <View style={styles.avatarWrap}>
              {current.fromAvatar ? (
                <Image
                  source={{ uri: current.fromAvatar }}
                  style={styles.avatar}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text weight="bold" style={styles.avatarInitial}>
                    {(current.fromName || '?').trim().charAt(0) || '★'}
                  </Text>
                </View>
              )}
              {frameUrl ? (
                <Image
                  source={{ uri: frameUrl }}
                  style={styles.frame}
                  contentFit="contain"
                  pointerEvents="none"
                />
              ) : null}
            </View>

            {/* النص */}
            <View style={styles.body}>
              <Text style={styles.title} numberOfLines={1}>
                {t('feed.giftReceivedTitle')}
              </Text>
              <Text style={styles.subtitle} numberOfLines={2}>
                <Text style={styles.senderName}>{current.fromName}</Text>
                {' '}
                {t('feed.giftReceivedOnPost', { gift: giftText })}
              </Text>
              {current.value > 0 ? (
                <Text style={styles.value} numberOfLines={1}>
                  {t('feed.giftReceivedValue', {
                    value: current.value.toLocaleString(),
                  })}
                </Text>
              ) : null}
            </View>

            {/* شكل الهدية — صورة من لوحة التحكم أو أيقونة الهدية بلونها */}
            <View style={styles.giftWrap}>
              {giftCfg ? (
                <GiftVisual gift={giftCfg} size={42} mediaOrder="image-first" />
              ) : (
                <GiftIcon size={30} color="#fff" strokeWidth={2} />
              )}
            </View>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const AVATAR = 44;
const FRAME = AVATAR * 1.42;

const styles = StyleSheet.create({
  host: {
    zIndex: 9998,
    elevation: 98,
    alignItems: 'center',
  },
  animWrap: {
    width: '92%',
    maxWidth: 460,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
    ...lu.shadows.grad,
  },
  avatarWrap: {
    width: FRAME,
    height: FRAME,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 18,
  },
  frame: {
    position: 'absolute',
    width: FRAME,
    height: FRAME,
  },
  body: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    fontFamily: lu.fonts.bodyHeavy,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
    fontFamily: lu.fonts.body,
  },
  senderName: {
    color: '#FFE08A',
    fontWeight: '900',
  },
  value: {
    color: '#FFD54A',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 3,
    fontFamily: lu.fonts.bodyHeavy,
  },
  giftWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftImg: {
    width: 42,
    height: 42,
  },
});
