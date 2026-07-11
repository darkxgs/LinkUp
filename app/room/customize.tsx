/**
 * تخصيص الروم — خلفيات (مجانية) + إطارات (مدفوعة).
 * تبويبان، فلتر (مملوكاتي/الكل)، معاينة، تفعيل/شراء/قفل.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Lock, Check, Coins, ImagePlus } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

import { Text, BackButton } from '@/components/ui';
import { IMG, IMG_ICON } from '@/utils/imageConfig';
import { lu } from '@/theme/lu-brand';
import { ROOM_DESIGN } from '@/theme/room-design';
import { colors, radius, spacing } from '@/theme';
import { useAuth } from '@/hooks/useAuth';
import { useConfig } from '@/contexts/ConfigContext';
import { userHasVipFeature } from '@/services/firebase/vipSystem';
import {
  subscribeToRoomFrames,
  subscribeToRoomBackgrounds,
  getOwnedFrames,
  purchaseFrame,
  equipUserFrame,
  applyBackgroundToRoom,
  clearRoomFrame,
  type RoomFrame,
  type RoomBackground,
} from '@/services/firebase/roomDecor';
import {
  subscribeToAgencyRoomFrames,
  subscribeToAgencyRoomBackgrounds,
  getCombinedOwnedFrameIds,
  purchaseAgencyFrame,
  equipAgencyCardFrame,
  applyAgencyRoomBackground,
  uploadAgencyBackgroundFromUri,
  canManageAgencyDecor,
} from '@/services/firebase/agencyRoomDecor';
import { requestMediaLibraryAccess } from '@/services/permissions';
import { ref as rtdbRef, get as rtdbGet } from 'firebase/database';
import { doc as fsDoc, getDoc as fsGetDoc } from 'firebase/firestore';
import { realtimeDb, firestore, auth } from '@/services/firebase/index';

type Tab = 'background' | 'frame';
type Filter = 'mine' | 'all';

const CUSTOM_BG_ID = '__custom_upload__';

const BADGE_LABEL: Record<string, string> = {
  limited: 'محدود',
  event: 'مناسبة',
  hot: 'رائج',
  new: 'جديد',
};

export default function RoomCustomizeScreen() {
  const { id: roomId, agencyId: paramAgencyId } = useLocalSearchParams<{ id: string; agencyId?: string }>();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const { vipSystem } = useConfig();
  const canUseRoomBackground = userHasVipFeature(user, 'roomBackground', vipSystem);

  const [tab, setTab] = useState<Tab>('background');
  const [filter, setFilter] = useState<Filter>('all');
  const [frames, setFrames] = useState<RoomFrame[]>([]);
  const [backgrounds, setBackgrounds] = useState<RoomBackground[]>([]);
  const [owned, setOwned] = useState<string[]>([]);
  // تحميل منفصل لكل تبويب → لا ينتظر تبويب الإطارات تحميل الخلفيات (لا تعليق على السبينر)
  const [bgLoading, setBgLoading] = useState(true);
  const [framesLoading, setFramesLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // وضع الوكالة: لو الروم تابعة لوكالة والمستخدم هو مالكها → الإطار/الخلفية تُطبَّق على الوكالة (تظهر في الهوم)
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [canManageAgency, setCanManageAgency] = useState(false);
  const [modeResolved, setModeResolved] = useState(false);
  const [customBgUrl, setCustomBgUrl] = useState<string | null>(null);
  const agencyMode = !!agencyId && canManageAgency;
  const bgUsable = agencyMode || canUseRoomBackground;

  // 1) حدّد الوضع: هل الروم تابعة لوكالة والمستخدم مالكها؟
  useEffect(() => {
    if (!roomId) {
      setModeResolved(true);
      return;
    }
    let active = true;
    (async () => {
      try {
        let aId = String(paramAgencyId ?? '').trim();
        const snap = await rtdbGet(rtdbRef(realtimeDb, `rooms/${roomId}`));
        const data = snap.val() ?? {};
        if (!aId) aId = String(data.agencyId ?? '').trim();

        const myUid = user?.uid ?? auth.currentUser?.uid ?? '';
        if (!aId && myUid) {
          const userAgencyId = String(user?.agencyId ?? '').trim();
          if (userAgencyId) {
            const aSnap = await fsGetDoc(fsDoc(firestore, 'agencies', userAgencyId));
            if (aSnap.exists()) {
              const liveRoomId = String(aSnap.data()?.liveRoomId ?? '').trim();
              if (liveRoomId === roomId) aId = userAgencyId;
            }
          }
        }

        if (aId) {
          const aSnap = await fsGetDoc(fsDoc(firestore, 'agencies', aId));
          const canManage =
            aSnap.exists() &&
            (await canManageAgencyDecor(aId, aSnap.data() as Record<string, unknown>));
          if (active) {
            setAgencyId(aId);
            setCanManageAgency(canManage);
          }
        }
      } catch {
        // تجاهل → الوضع العام
      } finally {
        if (active) setModeResolved(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [roomId, user?.uid, paramAgencyId]);

  // 2) اشترك بالكتالوج المناسب بعد معرفة الوضع
  useEffect(() => {
    if (!modeResolved) return;
    const subFrames = agencyMode ? subscribeToAgencyRoomFrames : subscribeToRoomFrames;
    const subBgs = agencyMode ? subscribeToAgencyRoomBackgrounds : subscribeToRoomBackgrounds;
    const u1 = subFrames((f) => {
      setFrames(f);
      setFramesLoading(false);
    });
    const u2 = subBgs((b) => {
      setBackgrounds(b);
      setBgLoading(false);
    });
    if (agencyMode && agencyId) {
      getCombinedOwnedFrameIds(agencyId).then(setOwned);
    } else {
      getOwnedFrames().then(setOwned);
    }
    return () => {
      u1();
      u2();
    };
  }, [modeResolved, agencyMode, agencyId]);

  const isOwned = (frameId: string) => owned.includes(frameId);

  const visibleBackgrounds = backgrounds;
  const backgroundItems = useMemo(() => {
    if (!customBgUrl) return visibleBackgrounds;
    const custom: RoomBackground = {
      id: CUSTOM_BG_ID,
      name: 'من جهازي',
      imageUrl: customBgUrl,
      enabled: true,
    };
    return [custom, ...visibleBackgrounds];
  }, [visibleBackgrounds, customBgUrl]);
  const visibleFrames = useMemo(
    () => (filter === 'mine' ? frames.filter((f) => isOwned(f.id)) : frames),
    [frames, filter, owned],
  );

  const selectedFrame = frames.find((f) => f.id === selected) ?? null;
  const selectedBg =
    selected === CUSTOM_BG_ID && customBgUrl
      ? ({ id: CUSTOM_BG_ID, name: 'من جهازي', imageUrl: customBgUrl } as RoomBackground)
      : backgrounds.find((b) => b.id === selected) ?? null;
  const previewBg = selectedBg?.imageUrl;
  const previewFrame = tab === 'frame' ? selectedFrame?.imageUrl : undefined;

  const handlePickCustomBackground = async () => {
    if (!agencyMode) return;
    try {
      const permOk = await requestMediaLibraryAccess();
      if (!permOk) {
        Alert.alert('الإذن مطلوب', 'فعّل إذن الوصول للمعرض من إعدادات الجهاز.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: true,
        aspect: [9, 16],
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      setBusy(true);
      const url = await uploadAgencyBackgroundFromUri(result.assets[0].uri);
      setCustomBgUrl(url);
      setSelected(CUSTOM_BG_ID);
    } catch (e: any) {
      Alert.alert('خطأ', e?.message ?? 'تعذّر رفع الصورة');
    } finally {
      setBusy(false);
    }
  };

  const handleActivateBackground = async () => {
    if (!selectedBg) return;
    setBusy(true);
    try {
      if (agencyMode && agencyId) {
        await applyAgencyRoomBackground(agencyId, selectedBg.imageUrl);
        Alert.alert('تم', 'تم تفعيل الخلفية على غرفة الوكالة.');
      } else {
        if (!roomId) return;
        if (!canUseRoomBackground) {
          Alert.alert('ميزة SVIP', 'خلفية الغرفة تتطلب امتياز SVIP8');
          return;
        }
        await applyBackgroundToRoom(roomId, selectedBg.imageUrl);
        Alert.alert('تم', 'تم تفعيل الخلفية على روم.');
      }
    } catch (e: any) {
      Alert.alert('خطأ', e?.message ?? 'تعذّر التفعيل');
    } finally {
      setBusy(false);
    }
  };

  const handleFramePress = async () => {
    if (!selectedFrame) return;
    if (isOwned(selectedFrame.id)) {
      setBusy(true);
      try {
        if (agencyMode && agencyId) {
          await equipAgencyCardFrame(agencyId, selectedFrame.id, selectedFrame.imageUrl);
          Alert.alert('تم', 'تم تفعيل الإطار حول صورة الوكالة — يظهر في الرئيسية 🎉');
        } else {
          await equipUserFrame(selectedFrame.id);
          Alert.alert('تم', 'تم تفعيل الإطار حول صورتك الشخصية.');
        }
      } catch (e: any) {
        Alert.alert('خطأ', e?.message ?? 'تعذّر التفعيل');
      } finally {
        setBusy(false);
      }
      return;
    }
    // شراء
    Alert.alert(
      'شراء الإطار',
      `هل تريد شراء "${selectedFrame.name}" مقابل ${selectedFrame.price.toLocaleString()} عملة؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'شراء',
          onPress: async () => {
            setBusy(true);
            try {
              if (agencyMode && agencyId) {
                await purchaseAgencyFrame(
                  agencyId,
                  selectedFrame.id,
                  selectedFrame.price,
                  selectedFrame.durationDays ?? 0,
                );
                setOwned((prev) => [...prev, selectedFrame.id]);
                // تحديث الرصيد المعروض فوراً — الخصم كان يتم في الخادم دون أن يظهر في التطبيق
                void refreshUser?.();
                Alert.alert('تم', 'تم شراء إطار الوكالة — فعّله ليظهر حول صورتها 🎉');
              } else {
                await purchaseFrame(
                  selectedFrame.id,
                  selectedFrame.price,
                  selectedFrame.durationDays ?? 0,
                );
                setOwned((prev) => [...prev, selectedFrame.id]);
                // تحديث الرصيد المعروض فوراً — الخصم كان يتم في الخادم دون أن يظهر في التطبيق
                void refreshUser?.();
                Alert.alert('تم', 'تم شراء الإطار — يظهر حول صورتك في الملف والغرف 🎉');
              }
            } catch (e: any) {
              Alert.alert('خطأ', e?.message ?? 'تعذّر الشراء');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const renderBackground = (item: RoomBackground) => {
    const isSel = selected === item.id;
    return (
      <Pressable style={[styles.card, isSel && styles.cardSel]} onPress={() => setSelected(item.id)}>
        <View style={styles.thumbBg}>
          <Image source={{ uri: item.imageUrl }} style={styles.thumbImg} contentFit="cover" recyclingKey={item.id || item.imageUrl} {...IMG} />
          {!bgUsable && (
            <View style={styles.lockOverlay}>
              <Lock size={18} color="#fff" />
            </View>
          )}
          {isSel && (
            <View style={styles.selCheck}>
              <Check size={14} color="#fff" strokeWidth={3} />
            </View>
          )}
          {bgUsable ? (
            <View style={[styles.tag, styles.tagFree]}>
              <Text variant="caption" weight="bold" color="#fff" style={{ fontSize: 9 }}>مجاني</Text>
            </View>
          ) : (
            <View style={[styles.tag, styles.tagLimited]}>
              <Text variant="caption" weight="bold" color="#fff" style={{ fontSize: 9 }}>SV8</Text>
            </View>
          )}
        </View>
        <Text variant="caption" color="#fff" numberOfLines={1} style={styles.cardName}>{item.name}</Text>
      </Pressable>
    );
  };

  const renderFrame = (item: RoomFrame) => {
    const isSel = selected === item.id;
    const ownedItem = isOwned(item.id);
    return (
      <Pressable style={[styles.card, isSel && styles.cardSel]} onPress={() => setSelected(item.id)}>
        <View style={styles.thumbFrame}>
          <Image source={{ uri: item.imageUrl }} style={styles.thumbImg} contentFit="contain" recyclingKey={item.id || item.imageUrl} {...IMG_ICON} />
          {!ownedItem && (
            <View style={styles.lockOverlay}>
              <Lock size={18} color="#fff" />
            </View>
          )}
          {isSel && (
            <View style={styles.selCheck}>
              <Check size={14} color="#fff" strokeWidth={3} />
            </View>
          )}
          {item.badge && (
            <View style={[styles.tag, styles.tagLimited]}>
              <Text variant="caption" weight="bold" color="#fff" style={{ fontSize: 9 }}>
                {BADGE_LABEL[item.badge] ?? item.badge}
              </Text>
            </View>
          )}
        </View>
        <Text variant="caption" color="#fff" numberOfLines={1} style={styles.cardName}>{item.name}</Text>
        {ownedItem ? (
          <Text variant="caption" color="rgba(255,255,255,0.5)" style={{ fontSize: 10 }}>
            {item.durationDays ? `${item.durationDays} يوم` : 'دائم'}
          </Text>
        ) : (
          <View style={styles.priceRow}>
            <Coins size={11} color={lu.colors.gold} />
            <Text variant="caption" weight="bold" color={lu.colors.gold} style={{ fontSize: 11 }}>
              {item.price.toLocaleString()}
            </Text>
          </View>
        )}
      </Pressable>
    );
  };

  const canAct =
    tab === 'background' ? !!selectedBg && bgUsable : !!selectedFrame;
  const actLabel =
    tab === 'background'
      ? 'تفعيل الخلفية'
      : selectedFrame && !isOwned(selectedFrame.id)
        ? `شراء (${selectedFrame.price.toLocaleString()})`
        : 'تفعيل الإطار';

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <LinearGradient colors={['#3A1316', '#1A0A0C']} style={StyleSheet.absoluteFill} />

      {/* الهيدر */}
      <View style={styles.header}>
        <BackButton color="#fff" bg="rgba(255,255,255,0.12)" />
        <Text variant="h4" weight="bold" color="#fff">تخصيص الروم</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* تبويبات */}
      <View style={styles.tabsRow}>
        {(['background', 'frame'] as Tab[]).map((tk) => (
          <Pressable
            key={tk}
            onPress={() => { setTab(tk); setSelected(null); }}
            style={styles.tabBtn}
          >
            <Text variant="body" weight={tab === tk ? 'bold' : 'regular'} color={tab === tk ? '#fff' : 'rgba(255,255,255,0.5)'}>
              {tk === 'background' ? 'الخلفية' : 'الإطار'}
            </Text>
            {tab === tk && <View style={styles.tabUnderline} />}
          </Pressable>
        ))}
      </View>

      {/* المعاينة */}
      <View style={styles.preview}>
        {previewBg ? (
          <Image source={{ uri: previewBg }} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={previewBg} {...IMG} />
        ) : (
          <LinearGradient colors={[...ROOM_DESIGN.panelGradientShort]} style={StyleSheet.absoluteFill} />
        )}
        <View style={styles.previewInner}>
          <View style={styles.previewAvatar}>
            {previewFrame && (
              <Image source={{ uri: previewFrame }} style={styles.previewFrameImg} contentFit="contain" />
            )}
          </View>
          <Text variant="caption" color="rgba(255,255,255,0.8)" style={{ marginTop: 6 }}>معاينة</Text>
        </View>
      </View>

      {/* فلتر مملوكاتي/الكل (للإطارات فقط) */}
      {tab === 'frame' && (
        <View style={styles.filterRow}>
          {(['mine', 'all'] as Filter[]).map((fk) => (
            <Pressable
              key={fk}
              onPress={() => setFilter(fk)}
              style={[styles.filterChip, filter === fk && styles.filterChipActive]}
            >
              <Text variant="caption" weight="bold" color={filter === fk ? '#fff' : 'rgba(255,255,255,0.6)'}>
                {fk === 'mine' ? 'مملوكاتي' : 'الكل'}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* الشبكة */}
      {tab === 'background' ? (
        bgLoading ? (
          <ActivityIndicator color="#fff" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={backgroundItems}
            key="bg"
            keyExtractor={(i) => i.id}
            numColumns={3}
            contentContainerStyle={styles.grid}
            columnWrapperStyle={{ gap: 10 }}
            initialNumToRender={9}
            maxToRenderPerBatch={6}
            updateCellsBatchingPeriod={60}
            windowSize={5}
            removeClippedSubviews
            ListHeaderComponent={
              agencyMode ? (
                <Pressable
                  style={styles.uploadCard}
                  onPress={handlePickCustomBackground}
                  disabled={busy}
                >
                  <ImagePlus size={28} color={lu.colors.purple} />
                  <Text variant="caption" weight="bold" color="#fff" style={{ marginTop: 6 }}>
                    رفع من الجهاز
                  </Text>
                </Pressable>
              ) : null
            }
            ListEmptyComponent={<Text variant="body" color="rgba(255,255,255,0.5)" align="center" style={{ marginTop: 30 }}>لا توجد خلفيات بعد</Text>}
            renderItem={({ item }) => renderBackground(item)}
          />
        )
      ) : framesLoading ? (
        <ActivityIndicator color="#fff" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={visibleFrames}
          key="frame"
          keyExtractor={(i) => i.id}
          numColumns={3}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap: 10 }}
          initialNumToRender={9}
          maxToRenderPerBatch={6}
          updateCellsBatchingPeriod={60}
          windowSize={5}
          removeClippedSubviews
          ListEmptyComponent={<Text variant="body" color="rgba(255,255,255,0.5)" align="center" style={{ marginTop: 30 }}>{filter === 'mine' ? 'لا تملك إطارات بعد' : 'لا توجد إطارات بعد'}</Text>}
          renderItem={({ item }) => renderFrame(item)}
        />
      )}

      {/* زر التفعيل/الشراء */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          disabled={!canAct || busy}
          onPress={tab === 'background' ? handleActivateBackground : handleFramePress}
          style={[styles.actBtn, (!canAct || busy) && styles.actBtnDisabled]}
        >
          <LinearGradient
            colors={canAct ? [lu.colors.pink, lu.colors.purple] : ['#555', '#444']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.actBtnGrad}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text variant="body" weight="bold" color="#fff">{actLabel}</Text>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A0A0C' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  tabsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    marginVertical: spacing.sm,
  },
  tabBtn: { alignItems: 'center', paddingVertical: 6 },
  tabUnderline: {
    marginTop: 4,
    width: 26,
    height: 3,
    borderRadius: 2,
    backgroundColor: lu.colors.pink,
  },
  preview: {
    height: 150,
    marginHorizontal: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  previewInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  previewAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewFrameImg: { position: 'absolute', width: 104, height: 104 },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  filterChipActive: { backgroundColor: lu.colors.pink },
  grid: { paddingHorizontal: spacing.md, paddingBottom: 100, gap: 10 },
  card: {
    flex: 1 / 3,
    alignItems: 'center',
    borderRadius: radius.md,
    padding: 4,
  },
  cardSel: {
    backgroundColor: 'rgba(225,20,20,0.12)',
    borderWidth: 1,
    borderColor: lu.colors.pink,
  },
  thumbBg: {
    width: '100%',
    aspectRatio: 0.62,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  thumbFrame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImg: { width: '100%', height: '100%' },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selCheck: {
    position: 'absolute',
    top: 6,
    end: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: lu.colors.pink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: {
    position: 'absolute',
    top: 6,
    start: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagFree: { backgroundColor: '#10B981' },
  tagLimited: { backgroundColor: '#F59E0B' },
  cardName: { marginTop: 6, fontSize: 12 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  footer: {
    position: 'absolute',
    bottom: 0,
    start: 0,
    end: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: 'rgba(26,10,12,0.95)',
  },
  actBtn: { borderRadius: radius.full, overflow: 'hidden' },
  actBtnDisabled: { opacity: 0.6 },
  actBtnGrad: { paddingVertical: 15, alignItems: 'center' },
  uploadCard: {
    width: '100%',
    marginBottom: 12,
    paddingVertical: 18,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
