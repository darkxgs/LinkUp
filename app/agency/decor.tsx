/**
 * متجر تخصيص الوكالة — إطارات وخلفيات منفصلة عن متجر الروم العام.
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Lock, Check, Coins, ImagePlus } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';

import { Text, BackButton } from '@/components/ui';
import { FramedAgencyCover } from '@/components/agency/FramedAgencyCover';
import { lu } from '@/theme/lu-brand';
import { colors, radius, spacing } from '@/theme';
import { subscribeToMyAgency, type Agency } from '@/services/agencyService';
import {
  subscribeToAgencyRoomFrames,
  subscribeToAgencyRoomBackgrounds,
  getAgencyOwnedFrames,
  purchaseAgencyFrame,
  equipAgencyCardFrame,
  equipAgencyRoomFrame,
  applyAgencyRoomBackground,
  uploadAgencyBackgroundFromUri,
  type RoomFrame,
  type RoomBackground,
} from '@/services/firebase/agencyRoomDecor';
import { requestMediaLibraryAccess } from '@/services/permissions';

type Tab = 'background' | 'frame';
type Filter = 'mine' | 'all';
type ApplyTarget = 'card' | 'room';

const CUSTOM_BG_ID = '__custom_upload__';

const BADGE_LABEL: Record<string, string> = {
  limited: 'محدود',
  event: 'مناسبة',
  hot: 'رائج',
  new: 'جديد',
};

export default function AgencyDecorScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [agency, setAgency] = useState<Agency | null>(null);
  const [tab, setTab] = useState<Tab>('frame');
  const [filter, setFilter] = useState<Filter>('all');
  const [applyTarget, setApplyTarget] = useState<ApplyTarget>('card');
  const [frames, setFrames] = useState<RoomFrame[]>([]);
  const [backgrounds, setBackgrounds] = useState<RoomBackground[]>([]);
  const [owned, setOwned] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [customBgUrl, setCustomBgUrl] = useState<string | null>(null);

  useEffect(() => {
    const unsubAgency = subscribeToMyAgency(setAgency);
    const u1 = subscribeToAgencyRoomFrames(setFrames);
    const u2 = subscribeToAgencyRoomBackgrounds((b) => {
      setBackgrounds(b);
      setLoading(false);
    });
    return () => {
      unsubAgency();
      u1();
      u2();
    };
  }, []);

  useEffect(() => {
    if (!agency?.id) {
      setOwned([]);
      return;
    }
    getAgencyOwnedFrames(agency.id).then(setOwned);
  }, [agency?.id]);

  const isOwned = (frameId: string) => owned.includes(frameId);

  const visibleFrames = useMemo(
    () => (filter === 'mine' ? frames.filter((f) => isOwned(f.id)) : frames),
    [frames, filter, owned],
  );

  const selectedFrame = frames.find((f) => f.id === selected) ?? null;
  const selectedBg =
    selected === CUSTOM_BG_ID && customBgUrl
      ? ({ id: CUSTOM_BG_ID, name: t('agencyDecor.fromDevice'), imageUrl: customBgUrl } as RoomBackground)
      : backgrounds.find((b) => b.id === selected) ?? null;
  const previewBg = selectedBg?.imageUrl ?? agency?.cardBackgroundUrl ?? agency?.ownerAvatar;
  const previewFrame = tab === 'frame' ? selectedFrame?.imageUrl ?? agency?.cardFrameUrl : undefined;
  const thumb = agency?.ownerAvatar?.startsWith('http') ? agency.ownerAvatar : null;

  const handlePickCustomBackground = async () => {
    try {
      const permOk = await requestMediaLibraryAccess();
      if (!permOk) {
        Alert.alert(t('common.error'), t('agencyDecor.galleryPermission'));
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
      Alert.alert(t('common.error'), e?.message ?? t('common.errorOccurred'));
    } finally {
      setBusy(false);
    }
  };

  const handleActivateBackground = async () => {
    if (!agency?.id || !selectedBg) return;
    setBusy(true);
    try {
      await applyAgencyRoomBackground(agency.id, selectedBg.imageUrl);
      Alert.alert(t('common.done'), t('agencyDecor.bgApplied'));
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message ?? t('common.errorOccurred'));
    } finally {
      setBusy(false);
    }
  };

  const handleFrameAction = async () => {
    if (!agency?.id || !selectedFrame) return;
    if (!isOwned(selectedFrame.id)) {
      Alert.alert(
        t('agencyDecor.buyFrame'),
        t('agencyDecor.buyConfirm', {
          name: selectedFrame.name,
          price: selectedFrame.price.toLocaleString(),
        }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('store.buy'),
            onPress: async () => {
              setBusy(true);
              try {
                await purchaseAgencyFrame(
                  agency.id,
                  selectedFrame.id,
                  selectedFrame.price,
                  selectedFrame.durationDays ?? 0,
                );
                setOwned((prev) => [...prev, selectedFrame.id]);
                Alert.alert(t('common.done'), t('agencyDecor.framePurchased'));
              } catch (e: any) {
                Alert.alert(t('common.error'), e?.message ?? t('common.errorOccurred'));
              } finally {
                setBusy(false);
              }
            },
          },
        ],
      );
      return;
    }

    setBusy(true);
    try {
      if (applyTarget === 'card') {
        await equipAgencyCardFrame(agency.id, selectedFrame.id, selectedFrame.imageUrl);
        Alert.alert(t('common.done'), t('agencyDecor.cardFrameApplied'));
      } else {
        await equipAgencyRoomFrame(agency.id, selectedFrame.id, selectedFrame.imageUrl);
        Alert.alert(t('common.done'), t('agencyDecor.roomFrameApplied'));
      }
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message ?? t('common.errorOccurred'));
    } finally {
      setBusy(false);
    }
  };

  if (!agency) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={lu.colors.purple} />
        <Text variant="body" color={lu.colors.muted} style={{ marginTop: spacing.base }}>
          {t('agencyDecor.noAgency')}
        </Text>
      </View>
    );
  }

  const actLabel =
    tab === 'background'
      ? t('agencyDecor.applyBackground')
      : selectedFrame && !isOwned(selectedFrame.id)
        ? t('agencyDecor.buyPrice', { price: selectedFrame.price.toLocaleString() })
        : t('agencyDecor.applyFrame');

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <LinearGradient colors={['#3A1316', '#1A0A0C']} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <BackButton color="#fff" bg="rgba(255,255,255,0.12)" />
        <Text variant="h4" weight="bold" color="#fff">
          {t('agencyDecor.title')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabsRow}>
        {(['frame', 'background'] as Tab[]).map((tk) => (
          <Pressable
            key={tk}
            onPress={() => {
              setTab(tk);
              setSelected(null);
            }}
            style={styles.tabBtn}
          >
            <Text
              variant="body"
              weight={tab === tk ? 'bold' : 'regular'}
              color={tab === tk ? '#fff' : 'rgba(255,255,255,0.5)'}
            >
              {tk === 'background' ? t('agencyDecor.tabBackground') : t('agencyDecor.tabFrame')}
            </Text>
            {tab === tk && <View style={styles.tabUnderline} />}
          </Pressable>
        ))}
      </View>

      <View style={styles.preview}>
        <FramedAgencyCover
          imageUri={previewBg || thumb}
          frameUri={previewFrame}
          width={140}
          aspect={1.05}
          borderRadius={12}
        />
        <Text variant="caption" color="rgba(255,255,255,0.7)" style={{ marginTop: 8 }}>
          {agency.name}
        </Text>
      </View>

      {tab === 'frame' ? (
        <View style={styles.targetRow}>
          <Pressable
            onPress={() => setApplyTarget('card')}
            style={[styles.targetChip, applyTarget === 'card' && styles.targetChipActive]}
          >
            <Text variant="caption" weight="bold" color={applyTarget === 'card' ? '#fff' : 'rgba(255,255,255,0.6)'}>
              {t('agencyDecor.targetCard')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setApplyTarget('room')}
            style={[styles.targetChip, applyTarget === 'room' && styles.targetChipActive]}
          >
            <Text variant="caption" weight="bold" color={applyTarget === 'room' ? '#fff' : 'rgba(255,255,255,0.6)'}>
              {t('agencyDecor.targetRoom')}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.filterRow}>
        {(['all', 'mine'] as Filter[]).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
          >
            <Text variant="caption" weight="bold" color={filter === f ? '#fff' : 'rgba(255,255,255,0.55)'}>
              {f === 'all' ? t('agencyDecor.filterAll') : t('agencyDecor.filterMine')}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color="#fff" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={
            tab === 'frame'
              ? visibleFrames
              : customBgUrl
                ? [{ id: CUSTOM_BG_ID, name: t('agencyDecor.fromDevice'), imageUrl: customBgUrl, enabled: true }, ...backgrounds]
                : backgrounds
          }
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 120 }}
          columnWrapperStyle={{ gap: 8 }}
          ListHeaderComponent={
            tab === 'background' ? (
              <Pressable style={styles.uploadCard} onPress={handlePickCustomBackground} disabled={busy}>
                <ImagePlus size={26} color={lu.colors.purple} />
                <Text variant="caption" weight="bold" color="#fff" style={{ marginTop: 6 }}>
                  {t('agencyDecor.uploadFromDevice')}
                </Text>
              </Pressable>
            ) : null
          }
          renderItem={({ item }) => {
            if (tab === 'background') {
              const bg = item as RoomBackground;
              const isSel = selected === bg.id;
              return (
                <Pressable style={[styles.card, isSel && styles.cardSel]} onPress={() => setSelected(bg.id)}>
                  <Image source={{ uri: bg.imageUrl }} style={styles.thumbImg} contentFit="cover" />
                  {isSel ? (
                    <View style={styles.selCheck}>
                      <Check size={14} color="#fff" strokeWidth={3} />
                    </View>
                  ) : null}
                  <Text variant="caption" color="#fff" numberOfLines={1} style={styles.cardName}>
                    {bg.name}
                  </Text>
                </Pressable>
              );
            }
            const frame = item as RoomFrame;
            const isSel = selected === frame.id;
            const ownedItem = isOwned(frame.id);
            return (
              <Pressable style={[styles.card, isSel && styles.cardSel]} onPress={() => setSelected(frame.id)}>
                <Image source={{ uri: frame.imageUrl }} style={styles.thumbImg} contentFit="contain" />
                {!ownedItem ? (
                  <View style={styles.lockOverlay}>
                    <Lock size={16} color="#fff" />
                  </View>
                ) : null}
                {isSel ? (
                  <View style={styles.selCheck}>
                    <Check size={14} color="#fff" strokeWidth={3} />
                  </View>
                ) : null}
                <Text variant="caption" color="#fff" numberOfLines={1} style={styles.cardName}>
                  {frame.name}
                </Text>
                {!ownedItem ? (
                  <View style={styles.priceRow}>
                    <Coins size={11} color={lu.colors.gold} />
                    <Text variant="caption" weight="bold" color={lu.colors.gold} style={{ fontSize: 10 }}>
                      {frame.price.toLocaleString()}
                    </Text>
                  </View>
                ) : (
                  <Text variant="caption" color="rgba(255,255,255,0.5)" style={{ fontSize: 9 }}>
                    {frame.badge ? BADGE_LABEL[frame.badge] ?? frame.badge : t('agencyDecor.owned')}
                  </Text>
                )}
              </Pressable>
            );
          }}
        />
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          disabled={busy || (tab === 'background' ? !selectedBg : !selectedFrame)}
          onPress={tab === 'background' ? handleActivateBackground : handleFrameAction}
          style={[styles.actBtn, (busy || (tab === 'background' ? !selectedBg : !selectedFrame)) && { opacity: 0.5 }]}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text variant="body" weight="bold" color="#fff">
              {actLabel}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A0A0C' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: lu.colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    marginBottom: 8,
  },
  tabsRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: 20, marginBottom: 12 },
  tabBtn: { paddingBottom: 6 },
  tabUnderline: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.brand.primary,
    marginTop: 4,
  },
  preview: {
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 12,
    marginHorizontal: spacing.base,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  targetRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: spacing.base,
    marginBottom: 10,
  },
  targetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  targetChipActive: { backgroundColor: lu.colors.purple },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: spacing.base,
    marginBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  filterChipActive: { backgroundColor: 'rgba(255,255,255,0.22)' },
  card: {
    flex: 1,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 6,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cardSel: { borderColor: lu.colors.purple },
  thumbImg: { width: '100%', aspectRatio: 1, borderRadius: 8 },
  cardName: { marginTop: 4, fontSize: 10, textAlign: 'center' },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  selCheck: {
    position: 'absolute',
    top: 10,
    end: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: lu.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, marginTop: 2 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.base,
    paddingTop: 10,
    backgroundColor: 'rgba(26, 10, 12,0.95)',
  },
  actBtn: {
    backgroundColor: lu.colors.purple,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  uploadCard: {
    width: '100%',
    marginBottom: 12,
    paddingVertical: 18,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
