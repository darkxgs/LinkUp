/**
 * تعديل معلومات الروم — غلاف، اسم، إعلان، تخصيص، وضع الروم، عدد المقاعد.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
  Switch,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft as Chevron } from '@/components/ui/RtlIcons';
import { Globe, Users, Lock, Copy, Shield, X } from 'lucide-react-native';

import { Text, BackButton, useAlert } from '@/components/ui';
import { lu } from '@/theme/lu-brand';
import { colors, radius, spacing } from '@/theme';
import { useImageUpload } from '@/hooks/useImageUpload';
import { useTranslation } from 'react-i18next';
import {
  subscribeToRoom,
  updateRoomSettings,
  getRoomBlockedUsers,
  unblockUserFromRoom,
  setRoomVanityId,
  type RoomBlockedUser,
} from '@/services/firebase/rooms';
import { useConfig } from '@/contexts/ConfigContext';
import { useAuth } from '@/hooks/useAuth';
import { userHasVipFeature } from '@/services/firebase/vipSystem';
import { copyToClipboard } from '@/utils/copyToClipboard';
import { formatBlockRemaining } from '@/utils/roomBlockDuration';

type Mode = 'public' | 'friend' | 'locked';
type RoomCategory = 'general' | 'music' | 'gaming' | 'study' | 'dating' | 'arabic';
const SEAT_OPTIONS: (9 | 11 | 16 | 19 | 21)[] = [9, 11, 16, 19, 21];
const CATEGORIES: { value: RoomCategory; label: string; emoji: string }[] = [
  { value: 'general', label: 'عام', emoji: '💬' },
  { value: 'music', label: 'موسيقى', emoji: '🎵' },
  { value: 'gaming', label: 'ألعاب', emoji: '🎮' },
  { value: 'study', label: 'دراسة', emoji: '📚' },
  { value: 'dating', label: 'تعارف', emoji: '💕' },
  { value: 'arabic', label: 'عربي', emoji: '🇸🇦' },
];

export default function EditRoomScreen() {
  const { id: roomId } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { showToast } = useAlert();
  const { pickAndUpload, uploading } = useImageUpload();

  const [banner, setBanner] = useState('');
  const [name, setName] = useState('');
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annAuto, setAnnAuto] = useState(false);
  const [mode, setMode] = useState<Mode>('public');
  const [password, setPassword] = useState('');
  const [seats, setSeats] = useState<9 | 11 | 16 | 19 | 21>(9);
  const [category, setCategory] = useState<RoomCategory>('general');
  const [welcome, setWelcome] = useState('');
  const [vanityId, setVanityId] = useState('');
  const [hostUid, setHostUid] = useState('');
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const { vipSystem } = useConfig();
  // امتياز SVIP «أيدي غرفة مميز» — متاح لمالك الغرفة المؤهّل
  const canSetVanity =
    !!user?.uid && hostUid === user.uid && userHasVipFeature(user, 'specialRoomId', vipSystem);
  const [showBlocked, setShowBlocked] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<RoomBlockedUser[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);

  useEffect(() => {
    if (!roomId) return;
    const unsub = subscribeToRoom(roomId, (r) => {
      if (!r) return;
      setBanner(r.banner ?? '');
      setName(r.name ?? '');
      setVanityId(r.vanityId ?? '');
      setHostUid(r.hostUid ?? '');
      setSeats((r.seatsCount as 9 | 11 | 16 | 19 | 21) ?? 9);
      setCategory(((r.category as RoomCategory) ?? 'general'));
      setWelcome((r as any).welcomeMessage ?? '');
      const m = (r as any).mode as Mode | undefined;
      setMode(m ?? (r.isPrivate ? 'locked' : 'public'));
      setPassword((r as any).password ?? '');
      const ann = (r as any).announcement;
      if (ann) {
        setAnnTitle(ann.title ?? '');
        setAnnContent(ann.content ?? '');
        setAnnAuto(Boolean(ann.autoShow));
      }
    });
    return unsub;
  }, [roomId]);

  const handleCover = async () => {
    const url = await pickAndUpload({ folder: 'banners', aspect: [1, 1], quality: 0.85 });
    if (url) setBanner(url);
  };

  const handleSave = async () => {
    if (!roomId) return;
    if (!name.trim()) {
      Alert.alert('تنبيه', 'اسم الروم مطلوب');
      return;
    }
    // غرفة مقفلة بلا كلمة مرور = غرفة مفتوحة فعلياً (البوابة تتجاوزها) — نمنع الحفظ
    if (mode === 'locked' && !password.trim()) {
      Alert.alert('تنبيه', 'يجب تعيين كلمة مرور للغرفة المقفلة');
      return;
    }
    setSaving(true);
    try {
      await updateRoomSettings(roomId, {
        name: name.trim(),
        banner: banner || undefined,
        seatsCount: seats,
        mode,
        isPrivate: mode === 'locked',
        password: mode === 'locked' ? (password.trim() || null) : null,
        category,
        welcomeMessage: welcome.trim(),
        announcement: {
          title: annTitle.trim(),
          content: annContent.trim(),
          autoShow: annAuto,
        },
      });
      if (canSetVanity && vanityId.trim()) {
        await setRoomVanityId(roomId, vanityId.trim()).catch((e) =>
          Alert.alert('تنبيه', e?.message ?? 'تعذّر حفظ المعرّف المميز'),
        );
      }
      Alert.alert('تم', 'تم حفظ معلومات الروم');
      router.back();
    } catch (e: any) {
      Alert.alert('خطأ', e?.message ?? 'تعذّر الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const openBlocked = async () => {
    if (!roomId) return;
    setShowBlocked(true);
    setLoadingBlocked(true);
    try {
      setBlockedUsers(await getRoomBlockedUsers(roomId));
    } catch {
      setBlockedUsers([]);
    } finally {
      setLoadingBlocked(false);
    }
  };

  const handleUnblock = (entry: RoomBlockedUser) => {
    if (!roomId) return;
    const name = entry.displayName ?? entry.uid;
    Alert.alert(
      t('room.unblockTitle', 'إزالة الحظر'),
      t('room.unblockConfirm', { name, defaultValue: `إزالة ${name} من قائمة المحظورين؟` }),
      [
        { text: t('common.cancel', 'إلغاء'), style: 'cancel' },
        {
          text: t('room.unblockAction', 'إزالة'),
          style: 'destructive',
          onPress: async () => {
            try {
              await unblockUserFromRoom(roomId, entry.uid);
              setBlockedUsers((prev) => prev.filter((u) => u.uid !== entry.uid));
            } catch (e: any) {
              Alert.alert(t('common.error', 'خطأ'), e?.message ?? t('room.unblockFailed', 'تعذّر إلغاء الحظر'));
            }
          },
        },
      ],
    );
  };

  const copyRoomId = async () => {
    if (!roomId) return;
    const ok = await copyToClipboard(roomId);
    if (ok) showToast(t('common.copied'));
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <LinearGradient colors={['#3A1316', '#1A0A0C']} style={StyleSheet.absoluteFill} />

      {/* الهيدر */}
      <View style={styles.header}>
        <BackButton color="#fff" bg="rgba(255,255,255,0.12)" />
        <Text variant="h4" weight="bold" color="#fff">تعديل معلومات الروم</Text>
        <Pressable onPress={handleSave} disabled={saving} hitSlop={10}>
          <Text variant="body" weight="bold" color={saving ? 'rgba(255,255,255,0.4)' : lu.colors.pink}>
            حفظ
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        {/* غلاف الروم */}
        <Pressable onPress={handleCover} disabled={uploading} style={styles.coverRow}>
          <View style={styles.coverThumb}>
            {banner ? (
              <Image source={{ uri: banner }} style={styles.coverImg} contentFit="cover" cachePolicy="memory-disk" recyclingKey={banner} transition={150} />
            ) : (
              <View style={[styles.coverImg, styles.coverEmpty]}>
                <Text variant="caption" color="rgba(255,255,255,0.5)">غلاف</Text>
              </View>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="body" weight="bold" color="#fff">غلاف الروم</Text>
            <Text variant="caption" color="rgba(255,255,255,0.55)">غلاف جذّاب يجذب زوّاراً أكثر لرومك ~</Text>
          </View>
          <Chevron size={20} color="rgba(255,255,255,0.5)" />
        </Pressable>

        {/* اسم الروم */}
        <Text style={styles.label}>اسم الروم</Text>
        <View style={styles.inputWrap}>
          <TextInput
            value={name}
            onChangeText={(t) => t.length <= 35 && setName(t)}
            placeholder="اسم الروم"
            placeholderTextColor="rgba(255,255,255,0.4)"
            style={styles.input}
          />
          <Text variant="caption" color="rgba(255,255,255,0.4)">{name.length}/35</Text>
        </View>

        {/* أيدي غرفة مميز — امتياز SVIP */}
        {canSetVanity ? (
          <>
            <Text style={styles.label}>أيدي غرفة مميز (SVIP)</Text>
            <View style={styles.inputWrap}>
              <TextInput
                value={vanityId}
                onChangeText={(t) => setVanityId(t.replace(/[^0-9]/g, '').slice(0, 9))}
                placeholder="4–9 أرقام (مثال: 88888)"
                placeholderTextColor="rgba(255,255,255,0.4)"
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>
          </>
        ) : null}

        {/* الإعلان */}
        <Text style={styles.label}>إعلان الروم</Text>
        <Pressable style={styles.annAuto} onPress={() => setAnnAuto((v) => !v)}>
          <Switch
            value={annAuto}
            onValueChange={setAnnAuto}
            trackColor={{ true: lu.colors.pink, false: 'rgba(255,255,255,0.2)' }}
          />
          <Text variant="body" color="#fff">إظهار تلقائي عند الدخول</Text>
        </Pressable>
        <View style={styles.inputWrap}>
          <TextInput
            value={annTitle}
            onChangeText={(t) => t.length <= 35 && setAnnTitle(t)}
            placeholder="عنوان الإعلان"
            placeholderTextColor="rgba(255,255,255,0.4)"
            style={styles.input}
          />
          <Text variant="caption" color="rgba(255,255,255,0.4)">{annTitle.length}/35</Text>
        </View>
        <View style={[styles.inputWrap, { alignItems: 'flex-start', minHeight: 90 }]}>
          <TextInput
            value={annContent}
            onChangeText={(t) => t.length <= 500 && setAnnContent(t)}
            placeholder="نص الإعلان…"
            placeholderTextColor="rgba(255,255,255,0.4)"
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            multiline
          />
          <Text variant="caption" color="rgba(255,255,255,0.4)">{annContent.length}/500</Text>
        </View>

        {/* تخصيص الروم */}
        <Text style={styles.label}>تخصيص الروم</Text>
        <Pressable
          style={styles.customizeRow}
          onPress={() => router.push({ pathname: '/room/customize', params: { id: roomId } } as any)}
        >
          <Text variant="body" color="#fff">غيّر الخلفية والإطار لتمييز رومك!</Text>
          <View style={styles.customizeRight}>
            <View style={styles.newBadge}>
              <Text variant="caption" weight="bold" color="#fff" style={{ fontSize: 10 }}>جديد</Text>
            </View>
            <Chevron size={20} color="rgba(255,255,255,0.5)" />
          </View>
        </Pressable>

        {/* وضع الروم */}
        <Text style={styles.label}>وضع الروم</Text>
        <View style={styles.modeRow}>
          {([
            { k: 'public' as Mode, icon: Globe, label: 'عام' },
            { k: 'friend' as Mode, icon: Users, label: 'أصدقاء' },
            { k: 'locked' as Mode, icon: Lock, label: 'مقفل' },
          ]).map(({ k, icon: Icon, label }) => {
            const active = mode === k;
            return (
              <Pressable key={k} onPress={() => setMode(k)} style={[styles.modeBtn, active && styles.modeBtnActive]}>
                <Icon size={16} color={active ? lu.colors.pink : 'rgba(255,255,255,0.7)'} />
                <Text variant="caption" weight="bold" color={active ? lu.colors.pink : 'rgba(255,255,255,0.7)'}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* كلمة مرور الغرفة المقفلة */}
        {mode === 'locked' && (
          <View style={[styles.inputWrap, { marginTop: spacing.sm }]}>
            <Lock size={16} color="rgba(255,255,255,0.6)" />
            <TextInput
              value={password}
              onChangeText={(t) => t.length <= 20 && setPassword(t)}
              placeholder="كلمة مرور الدخول (مطلوبة للوضع المقفل)"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.input}
              autoCapitalize="none"
            />
          </View>
        )}

        {/* عدد المقاعد */}
        <Text style={styles.label}>عدد المقاعد</Text>
        <View style={styles.seatsRow}>
          {SEAT_OPTIONS.map((n) => {
            const active = seats === n;
            return (
              <Pressable key={n} onPress={() => setSeats(n)} style={[styles.seatBtn, active && styles.seatBtnActive]}>
                <Text variant="h4" weight="bold" color={active ? lu.colors.pink : '#fff'}>{n}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* التصنيف */}
        <Text style={styles.label}>التصنيف</Text>
        <View style={styles.catWrap}>
          {CATEGORIES.map((c) => {
            const active = category === c.value;
            return (
              <Pressable key={c.value} onPress={() => setCategory(c.value)} style={[styles.catChip, active && styles.catChipActive]}>
                <Text variant="caption" weight="bold" color={active ? '#fff' : 'rgba(255,255,255,0.7)'}>
                  {c.emoji} {c.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* رسالة الترحيب */}
        <Text style={styles.label}>رسالة الترحيب</Text>
        <View style={[styles.inputWrap, { alignItems: 'flex-start', minHeight: 70 }]}>
          <TextInput
            value={welcome}
            onChangeText={(t) => t.length <= 200 && setWelcome(t)}
            placeholder="رسالة ترحيب تظهر للمستخدمين الجدد…"
            placeholderTextColor="rgba(255,255,255,0.4)"
            style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
            multiline
          />
        </View>

        {/* رقم الغرفة + المحظورون */}
        <Text style={styles.label}>إدارة</Text>
        <Pressable style={styles.manageRow} onPress={copyRoomId}>
          <View style={styles.manageLeft}>
            <Copy size={18} color="rgba(255,255,255,0.7)" />
            <Text variant="body" color="#fff">رقم الغرفة</Text>
          </View>
          <Text variant="caption" color="rgba(255,255,255,0.55)" numberOfLines={1}>{roomId}</Text>
        </Pressable>
        <Pressable style={styles.manageRow} onPress={openBlocked}>
          <View style={styles.manageLeft}>
            <Shield size={18} color="#EF4444" />
            <Text variant="body" color="#fff">{t('room.blockedFromRoom', 'المحظورون من الغرفة')}</Text>
          </View>
          <Chevron size={20} color="rgba(255,255,255,0.5)" />
        </Pressable>
      </ScrollView>

      {/* مودال المحظورين */}
      <Modal visible={showBlocked} transparent animationType="slide" onRequestClose={() => setShowBlocked(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowBlocked(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <LinearGradient colors={['#3A1316', '#1A0A0C']} style={StyleSheet.absoluteFill} />
            <View style={styles.modalHead}>
              <Text variant="h4" weight="bold" color="#fff">{t('room.blockedFromRoom', 'المحظورون من الغرفة')}</Text>
              <Pressable onPress={() => setShowBlocked(false)} hitSlop={10}>
                <X size={20} color="#fff" />
              </Pressable>
            </View>
            <Text variant="caption" color="rgba(255,255,255,0.5)" style={{ marginBottom: spacing.sm }}>
              {t('room.blockedListHint', 'المستخدمون المطرودون أو المحظورون — يمكنك إزالتهم في أي وقت')}
            </Text>
            {loadingBlocked ? (
              <ActivityIndicator color="#fff" style={{ marginVertical: 30 }} />
            ) : blockedUsers.length === 0 ? (
              <Text variant="body" color="rgba(255,255,255,0.5)" align="center" style={{ marginVertical: 30 }}>
                {t('room.noBlockedUsers', 'لا يوجد محظورون')}
              </Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
                {blockedUsers.map((entry) => {
                  const isPermanent = entry.blockedUntil == null;
                  const remaining = isPermanent
                    ? t('room.blockPermanent', 'حظر دائم')
                    : t('room.blockExpires', {
                        time: formatBlockRemaining(entry.blockedUntil, i18n.language),
                        defaultValue: `ينتهي خلال: ${formatBlockRemaining(entry.blockedUntil, i18n.language)}`,
                      });
                  return (
                    <View key={entry.uid} style={styles.blockedRow}>
                      <View style={styles.blockedAvatar}>
                        {entry.avatar ? (
                          <Image source={{ uri: entry.avatar }} style={styles.blockedAvatarImg} contentFit="cover" cachePolicy="memory-disk" recyclingKey={entry.uid} transition={150} />
                        ) : (
                          <Text variant="caption" weight="bold" color="#fff">
                            {(entry.displayName ?? '?').charAt(0)}
                          </Text>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text variant="body" weight="semibold" color="#fff" numberOfLines={1}>
                          {entry.displayName ?? entry.uid}
                        </Text>
                        <Text variant="caption" color="rgba(255,255,255,0.5)">
                          {remaining}
                        </Text>
                      </View>
                      <Pressable onPress={() => handleUnblock(entry)} style={styles.unblockBtn}>
                        <Text variant="caption" weight="bold" color="#fff">
                          {t('room.unblockAction', 'إزالة')}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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
  coverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  coverThumb: { width: 64, height: 64, borderRadius: radius.md, overflow: 'hidden' },
  coverImg: { width: '100%', height: '100%' },
  coverEmpty: { backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  label: { color: '#fff', fontWeight: '700', fontSize: 15, marginTop: spacing.lg, marginBottom: spacing.sm },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    marginBottom: spacing.sm,
  },
  input: { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 12 },
  annAuto: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.sm },
  customizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  customizeRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  newBadge: { backgroundColor: lu.colors.pink, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  modeRow: { flexDirection: 'row', gap: 10 },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  modeBtnActive: { backgroundColor: 'rgba(225,20,20,0.12)', borderColor: lu.colors.pink },
  seatsRow: { flexDirection: 'row', gap: 10 },
  seatBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  seatBtnActive: { backgroundColor: 'rgba(225,20,20,0.12)', borderColor: lu.colors.pink },
  catWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  catChipActive: { backgroundColor: lu.colors.pink },
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  manageLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  modalSheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '70%',
    overflow: 'hidden',
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  blockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  blockedAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  blockedAvatarImg: { width: '100%', height: '100%' },
  unblockBtn: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
});
