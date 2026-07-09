/**
 * LinkUp — ملفي الشخصي (نبذة / منشورات / شرف)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  useWindowDimensions,
  ActivityIndicator,
  I18nManager,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import {
  Pencil, ChevronLeft, ChevronRight, Mic, Cake, Calendar, Globe, Copy, Gift, User, FileText, Trophy,
} from 'lucide-react-native';

import { Text, RealCountryFlag, VoiceMessagePlayer } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useConfig } from '@/contexts/ConfigContext';
import { userHasVipFeature } from '@/services/firebase/vipSystem';
import { setCustomAccountId, sendAppWideMessage } from '@/services/firebase/svipPerks';
import { lu } from '@/theme/lu-brand';
import { resolveDisplayName } from '@/utils/displayName';
import { getCountryByCode } from '@/data/countries';
import { getDisplayAccountId } from '@/services/userIdentifier';
import { copyToClipboard } from '@/utils/copyToClipboard';
import { getJoinDays } from '@/utils/joinDays';
import { calculateProfileCompleteness } from '@/services/firebase/users';
import { getPostsByUser, type Post } from '@/services/firebase/posts';
import {
  readUserTitles,
  countOwnedTitles,
  getTitleDef,
} from '@/services/firebase/titleSystem';
import { TitleBanner } from '@/components/titles/TitleBanner';
import { GiftVisual } from '@/components/ui/GiftVisual';
import { getGiftWall, countGiftWallItems } from '@/services/firebase/giftWall';
import { ProfileAlbumOvals } from '@/components/profile/ProfileAlbumOvals';
import { ProfileImagePreview } from '@/components/profile/ProfileImagePreview';
import { RoomEntryVideoOverlay } from '@/components/room/RoomEntryVideoOverlay';
import { useProfileEntryVideo } from '@/hooks/useProfileEntryVideo';

type Tab = 'about' | 'posts' | 'honor';

export default function MyProfileScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const { user, refreshUser } = useAuth();
  const { titles: titlesConfig, gifts, vipSystem, aristocracy } = useConfig();
  // امتياز SVIP «أيدي مميز»
  const canSetCustomId = userHasVipFeature(user, 'specialId', vipSystem);
  const [showIdModal, setShowIdModal] = useState(false);
  const [idInput, setIdInput] = useState('');
  const [savingId, setSavingId] = useState(false);
  // امتياز SVIP «رسائل على مستوى التطبيق»
  const canAppMessage = userHasVipFeature(user, 'appWideMessage', vipSystem);
  const [showMsgModal, setShowMsgModal] = useState(false);
  const [msgInput, setMsgInput] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  const submitAppMessage = useCallback(async () => {
    setSendingMsg(true);
    try {
      const res = await sendAppWideMessage(msgInput);
      if (res.ok) {
        setShowMsgModal(false);
        setMsgInput('');
        Alert.alert('تم', 'تم بثّ رسالتك لكل المستخدمين');
      } else {
        Alert.alert('تعذّر', res.error ?? 'حدث خطأ');
      }
    } finally {
      setSendingMsg(false);
    }
  }, [msgInput]);

  const submitCustomId = useCallback(async () => {
    setSavingId(true);
    try {
      const res = await setCustomAccountId(idInput);
      if (res.ok) {
        setShowIdModal(false);
        setIdInput('');
        await refreshUser?.();
        Alert.alert('تم', `معرّفك الجديد: ${res.accountId}`);
      } else {
        Alert.alert('تعذّر', res.error ?? 'حدث خطأ');
      }
    } finally {
      setSavingId(false);
    }
  }, [idInput]);

  const [tab, setTab] = useState<Tab>('about');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [giftWallCount, setGiftWallCount] = useState(0);
  const [giftWallPreview, setGiftWallPreview] = useState<
    {
      giftId: string;
      name: string;
      imageUrl?: string;
      animationUrl?: string;
      iconName?: string;
      iconColor?: string;
      count: number;
    }[]
  >([]);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const isAr = i18n.language?.startsWith('ar');
  const profile = user?.profile;
  const name = resolveDisplayName({ displayName: profile?.displayName, email: user?.email });
  const accountId = getDisplayAccountId(user?.publicAccountId, user?.uid ?? '');
  const age = profile?.birthYear ? new Date().getFullYear() - profile.birthYear : 0;
  const completeness = calculateProfileCompleteness({
    displayName: profile?.displayName,
    avatar: profile?.avatar,
    gender: profile?.gender,
    birthYear: profile?.birthYear,
    country: profile?.country,
    residence: profile?.residence,
    bio: profile?.bio,
    photos: profile?.photos,
    voiceBio: profile?.voiceBio,
    height: profile?.height,
    weight: profile?.weight,
    education: profile?.education,
    job: profile?.job,
    relationship: profile?.relationship,
  });
  const joinDays = getJoinDays(user?.createdAt);

  const { entryVideo, clearEntryVideo } = useProfileEntryVideo({
    userId: user?.uid,
    displayName: name,
    profileReady: Boolean(user?.uid),
    vipSystem,
    aristocracy,
  });

  const titlesState = useMemo(() => readUserTitles({ userTitles: user?.userTitles }), [user?.userTitles]);
  const ownedTitles = countOwnedTitles(titlesState);
  const equippedTitles = useMemo(
    () =>
      titlesState.equipped
        .filter((id): id is string => Boolean(id))
        .map((id) => getTitleDef(titlesConfig, id))
        .filter(Boolean),
    [titlesState.equipped, titlesConfig],
  );

  useEffect(() => {
    if (!user?.uid || tab !== 'posts') return;
    setLoadingPosts(true);
    getPostsByUser(user.uid, 30)
      .then(setPosts)
      .finally(() => setLoadingPosts(false));
  }, [user?.uid, tab]);

  useEffect(() => {
    if (!user?.uid) return;
    getGiftWall(user.uid, user.uid, gifts).then((items) => {
      setGiftWallCount(countGiftWallItems(items));
      setGiftWallPreview(
        items.slice(0, 4).map((i) => ({
          giftId: i.giftId,
          name: i.giftName,
          imageUrl: i.imageUrl,
          animationUrl: i.animationUrl,
          iconName: i.iconName,
          iconColor: i.iconColor,
          count: i.count,
        })),
      );
    });
  }, [user?.uid, gifts]);

  const copyId = useCallback(async () => {
    if (!accountId) return;
    await copyToClipboard(accountId);
  }, [accountId]);

  const coverH = 190;
  // سنة الميلاد فقط — كان يُلصق يوم/شهر وهميان (03/17) بكل المستخدمين
  const birthStr = profile?.birthYear ? String(profile.birthYear) : '—';
  const countryName = getCountryByCode(profile?.country ?? '')?.name ?? profile?.country ?? '—';

  const tabs = [
    { id: 'about' as Tab, label: t('profileMe.about'), Icon: User },
    { id: 'posts' as Tab, label: t('profileMe.posts'), Icon: FileText },
    { id: 'honor' as Tab, label: t('profileMe.honor'), Icon: Trophy },
  ];

  return (
    <View style={styles.fill}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
      >
        {/* Cover Wrap */}
        <View style={[styles.coverWrap, { height: coverH }]}>
          {profile?.avatar ? (
            <Image source={{ uri: profile.avatar }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={profile.avatar} transition={150} />
          ) : (
            <LinearGradient colors={lu.gradients.brand} style={StyleSheet.absoluteFill} />
          )}
          <LinearGradient
            colors={['rgba(0,0,0,0.3)', 'transparent', 'rgba(0,0,0,0.4)']}
            style={StyleSheet.absoluteFill}
          />

          <View style={[styles.topBar, { paddingTop: insets.top + 8, flexDirection: 'row' }]}>
            <Pressable onPress={() => router.back()} style={styles.iconBtn}>
              {isAr
                ? <ChevronRight size={22} color="#fff" />
                : <ChevronLeft size={22} color="#fff" />}
            </Pressable>
            <Pressable onPress={() => router.push('/profile/edit' as any)} style={styles.iconBtn}>
              <Pencil size={18} color="#fff" />
            </Pressable>
          </View>
        </View>

        {/* Profile Info Block (Centered) */}
        <View style={styles.profileHeaderContainer}>
          <View style={styles.avatarOverlapContainer}>
            {profile?.avatar ? (
              <Pressable onPress={() => setAvatarPreview(profile.avatar!)} style={styles.avatarLargeRing}>
                <Image
                  source={{ uri: profile.avatar }}
                  style={styles.avatarLargeImg}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              </Pressable>
            ) : (
              <View style={styles.avatarLargeRing} />
            )}
          </View>

          <View style={styles.nameRowCentered}>
            <Text weight="bold" style={styles.nameCentered} numberOfLines={1}>{name}</Text>
            <View style={[styles.agePill, profile?.gender === 'male' ? styles.agePillMale : styles.agePillFemale]}>
              <Text style={[styles.ageText, profile?.gender === 'male' ? styles.ageTextMale : styles.ageTextFemale]}>
                {profile?.gender === 'male' ? '♂' : '♀'} {age}
              </Text>
            </View>
          </View>

          <View style={[styles.locationIdRow, { flexDirection: 'row' }]}>
            <View style={styles.metaItem}>
              <RealCountryFlag countryCode={profile?.country ?? ''} size={15} />
              <Text style={styles.metaText}>{countryName}</Text>
            </View>
            <View style={styles.metaDivider} />
            <Pressable style={styles.metaItem} onPress={copyId}>
              <Text style={styles.metaText}>ID: {accountId}</Text>
              <Copy size={12} color={lu.colors.muted} />
            </Pressable>
            {canSetCustomId ? (
              <Pressable
                style={styles.metaItem}
                onPress={() => { setIdInput(accountId); setShowIdModal(true); }}
              >
                <Pencil size={12} color={lu.colors.gold} />
              </Pressable>
            ) : null}
          </View>
          {canAppMessage ? (
            <Pressable
              onPress={() => setShowMsgModal(true)}
              style={{ marginTop: 10, alignSelf: isAr ? 'flex-end' : 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(252,211,77,0.15)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 }}
            >
              <FileText size={13} color={lu.colors.gold} />
              <Text variant="caption" weight="bold" color={lu.colors.gold}>رسالة لكل التطبيق (SVIP)</Text>
            </Pressable>
          ) : null}
        </View>

        <Modal visible={showMsgModal} transparent animationType="fade" onRequestClose={() => setShowMsgModal(false)}>
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}
            onPress={() => setShowMsgModal(false)}
          >
            <Pressable
              style={{ backgroundColor: lu.colors.purpleDark, borderRadius: 18, padding: 20, gap: 12 }}
              onPress={(e) => e.stopPropagation()}
            >
              <Text weight="bold" color="#fff" style={{ fontSize: 16, textAlign: 'center' }}>
                رسالة على مستوى التطبيق
              </Text>
              <Text variant="caption" color="rgba(255,255,255,0.6)" style={{ textAlign: 'center' }}>
                تظهر لكل المستخدمين — رسالة واحدة كل ساعة
              </Text>
              <TextInput
                value={msgInput}
                onChangeText={(v) => setMsgInput(v.slice(0, 200))}
                placeholder="اكتب رسالتك..."
                placeholderTextColor="rgba(255,255,255,0.4)"
                multiline
                style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, minHeight: 80, textAlignVertical: 'top' }}
              />
              <Pressable
                disabled={sendingMsg}
                onPress={submitAppMessage}
                style={{ backgroundColor: lu.colors.gold, borderRadius: 12, paddingVertical: 12, alignItems: 'center', opacity: sendingMsg ? 0.6 : 1 }}
              >
                {sendingMsg ? <ActivityIndicator color="#000" /> : <Text weight="bold" color="#000">بثّ الرسالة</Text>}
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal visible={showIdModal} transparent animationType="fade" onRequestClose={() => setShowIdModal(false)}>
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}
            onPress={() => setShowIdModal(false)}
          >
            <Pressable
              style={{ backgroundColor: lu.colors.purpleDark, borderRadius: 18, padding: 20, gap: 12 }}
              onPress={(e) => e.stopPropagation()}
            >
              <Text weight="bold" color="#fff" style={{ fontSize: 16, textAlign: 'center' }}>
                أيدي مميز (5–9 أرقام)
              </Text>
              <TextInput
                value={idInput}
                onChangeText={(v) => setIdInput(v.replace(/[^0-9]/g, '').slice(0, 9))}
                keyboardType="number-pad"
                placeholder="مثال: 888888"
                placeholderTextColor="rgba(255,255,255,0.4)"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18, textAlign: 'center', letterSpacing: 4 }}
              />
              <Pressable
                disabled={savingId}
                onPress={submitCustomId}
                style={{ backgroundColor: lu.colors.gold, borderRadius: 12, paddingVertical: 12, alignItems: 'center', opacity: savingId ? 0.6 : 1 }}
              >
                {savingId ? <ActivityIndicator color="#000" /> : <Text weight="bold" color="#000">حفظ المعرّف</Text>}
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Voice Intro Card */}
        <View style={styles.cardPadding}>
          {profile?.voiceBio ? (
            <View style={styles.voiceCard}>
              <View style={styles.cardHeader}>
                <Mic size={16} color={lu.colors.pink} />
                <Text weight="bold" style={styles.cardTitle}>{t('profileMe.myVoice') || 'المقدمة الصوتية'}</Text>
              </View>
              <View style={styles.voicePlayerContainer}>
                <VoiceMessagePlayer
                  voiceUrl={profile.voiceBio}
                  duration={profile.voiceBioDuration || 30}
                  variant="profile"
                />
              </View>
            </View>
          ) : (
            <Pressable style={styles.voiceCardEmpty} onPress={() => router.push('/profile/edit' as any)}>
              <View style={styles.cardHeader}>
                <Mic size={16} color={lu.colors.muted} />
                <Text weight="bold" style={styles.cardTitleEmpty}>{t('profileMe.recordVoice') || 'سجل مقدمتك الصوتية'}</Text>
              </View>
              <Text style={styles.voiceEmptyText}>
                {isAr ? '+ أضف مقدمة صوتية لملفك الشخصي' : '+ Add a voice intro to your profile'}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Tabs Bar */}
        <View style={styles.tabBar}>
          {tabs.map((tb) => {
            const active = tab === tb.id;
            return (
              <Pressable
                key={tb.id}
                style={[styles.tabItem, active && styles.tabItemActive]}
                onPress={() => setTab(tb.id)}
              >
                <View style={styles.tabItemContent}>
                  <tb.Icon size={16} color={active ? '#E11414' : '#6B7280'} />
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                    {tb.label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* About Tab Content */}
        {tab === 'about' && (
          <View style={styles.tabContent}>
            {/* Bio Card */}
            <View style={styles.bioCard}>
              <View style={styles.bioHeader}>
                <Pencil size={14} color={lu.colors.pink} />
                <Text weight="bold" style={styles.bioTitle}>{t('profileMe.about') || 'نبذة عني'}</Text>
              </View>
              <Text style={styles.bioText}>
                {profile?.bio || t('profileMe.bioPlaceholder')}
              </Text>
            </View>

            {/* Photo Album Card if has photos */}
            {profile?.photos && profile.photos.length > 0 && (
              <Pressable style={styles.albumCard} onPress={() => router.push('/profile/edit' as any)}>
                <View style={styles.albumHeader}>
                  <Text weight="bold" style={styles.albumTitle}>🖼️ {t('profileEdit.text51647') || 'معرض الصور'}</Text>
                  <Text style={styles.albumCount}>{profile.photos.length}/9</Text>
                </View>
                <View style={styles.albumOvalsWrapper}>
                  <ProfileAlbumOvals photos={profile.photos} />
                </View>
              </Pressable>
            )}

            {/* Basic Info Card */}
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Cake size={16} color={lu.colors.gold2} />
                <Text style={styles.infoText}>{birthStr}</Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <Globe size={16} color={lu.colors.blue} />
                <Text style={styles.infoText}>{countryName}</Text>
              </View>
              {joinDays > 0 ? (
              <>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <Calendar size={16} color={lu.colors.purple} />
                <Text style={styles.infoText}>
                  {t('profileEdit.joinedDays', { days: joinDays })}
                </Text>
              </View>
              </>
              ) : null}
            </View>

            {/* Tags Card */}
            <View style={styles.tagsCard}>
              <Text weight="bold" style={styles.tagsTitle}>🏷️ {t('profile.personalTags') || 'الوسوم الشخصية'}</Text>
              <View style={styles.tagsRow}>
                {/* بدون وسوم = لا شيء (كانت تُعرض وسوم وهمية وكأنها وسوم المستخدم) */}
                {profile?.tags && profile.tags.length > 0
                  ? profile.tags.map((tag) => (
                      <View key={tag} style={styles.tagChip}>
                        <Text style={styles.tagChipText}>{tag}</Text>
                      </View>
                    ))
                  : null}
                <Pressable style={styles.tagAddBtn} onPress={() => router.push('/profile/edit' as any)}>
                  <Text style={styles.tagAddBtnText}>+ {t('profileMe.addTags') || 'Add Tag'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* Posts Tab Content */}
        {tab === 'posts' && (
          <View style={styles.tabContent}>
            {loadingPosts ? (
              <ActivityIndicator color={lu.colors.pink} style={{ marginTop: 24 }} />
            ) : posts.length === 0 ? (
              <Text style={styles.empty}>{t('profileMe.noPosts')}</Text>
            ) : (
              posts.map((p) => (
                <Pressable
                  key={p.id}
                  style={styles.postCard}
                  onPress={() => router.push('/(tabs)/feed' as any)}
                >
                  <Text style={styles.postText} numberOfLines={3}>{p.text}</Text>
                  {p.images?.[0] ? (
                    <Image source={{ uri: p.images[0] }} style={styles.postImg} contentFit="cover" cachePolicy="memory-disk" recyclingKey={p.id} />
                  ) : null}
                </Pressable>
              ))
            )}
          </View>
        )}

        {/* Honor Tab Content */}
        {tab === 'honor' && (
          <View style={styles.tabContent}>
            <HonorSection
              title={t('profileMe.medals')}
              count={0}
              empty={t('profileMe.noMedals')}
              onPress={() => router.push('/vip' as any)}
            />
            <HonorSection
              title={t('profileMe.titles')}
              count={ownedTitles}
              empty={t('profileMe.noTitles')}
              onPress={() => router.push('/titles' as any)}
            >
              {equippedTitles.length > 0 ? (
                <View style={styles.titlesRow}>
                  {equippedTitles.map((td) => td && (
                    <TitleBanner
                      key={td.id}
                      title={td}
                      label={isAr ? td.nameAr : td.nameEn}
                      width={140}
                      height={36}
                    />
                  ))}
                </View>
              ) : null}
            </HonorSection>
            <HonorSection
              title={t('profileMe.entrance')}
              count={user?.vipLevel && user.vipLevel >= 5 ? 1 : 0}
              empty={t('profileMe.noEntrance')}
              onPress={() => router.push('/store' as any)}
            />
            <HonorSection
              title={t('profileMe.giftWall')}
              count={giftWallCount}
              empty={t('profileMe.noGifts')}
              onPress={() => router.push('/profile/gift-wall' as any)}
            >
              {giftWallPreview.length > 0 ? (
                <View style={styles.giftPreviewRow}>
                  {giftWallPreview.map((g) => (
                    <View key={g.giftId} style={styles.giftPreviewCard}>
                      <GiftVisual
                        gift={{
                          iconName: g.iconName ?? 'Gift',
                          iconColor: g.iconColor ?? lu.colors.pink,
                          imageUrl: g.imageUrl,
                          animationUrl: g.animationUrl,
                        }}
                        size={40}
                        cachePolicy="memory-disk"
                      />
                      <Text style={styles.giftPreviewCount}>×{g.count}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Gift size={32} color={lu.colors.pink} />
              )}
            </HonorSection>
          </View>
        )}
      </ScrollView>

      {/* Bottom Bar Actions */}
      <View style={[styles.fixedBottomBar, { paddingBottom: insets.bottom + 12, flexDirection: 'row' }]}>
        <Pressable style={styles.btnSecondary} onPress={() => router.push('/profile/edit' as any)}>
          <Text style={styles.btnSecondaryText}>✏️ {isAr ? 'تعديل الملف الشخصي' : 'Edit Profile'}</Text>
        </Pressable>
        <Pressable style={styles.btnPrimary} onPress={() => router.push('/(tabs)/feed' as any)}>
          <LinearGradient
            colors={lu.gradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientBtn}
          >
            <Text style={styles.btnPrimaryText}>+ {isAr ? 'إنشاء منشور' : 'Create Post'}</Text>
          </LinearGradient>
        </Pressable>
      </View>

      <ProfileImagePreview uri={avatarPreview} onClose={() => setAvatarPreview(null)} />

      {entryVideo ? (
        <RoomEntryVideoOverlay
          key={entryVideo.key}
          userName={entryVideo.name}
          videoUrl={entryVideo.videoUrl}
          videoUrlMp4={entryVideo.videoUrlMp4}
          mode="profile"
          onComplete={clearEntryVideo}
        />
      ) : null}
    </View>
  );
}

function HonorSection({
  title,
  count,
  empty,
  onPress,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  onPress: () => void;
  children?: React.ReactNode;
}) {
  const { i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  return (
    <View style={styles.honorCard}>
      <Pressable style={[styles.honorHead, { flexDirection: 'row' }]} onPress={onPress}>
        <Text weight="bold" style={styles.honorTitle}>{title}</Text>
        <View style={[styles.honorCountRow, { flexDirection: 'row' }]}>
          <Text style={styles.honorCount}>{count}</Text>
          {isAr
            ? <ChevronLeft size={16} color={lu.colors.muted} />
            : <ChevronRight size={16} color={lu.colors.muted} />}
        </View>
      </Pressable>
      <View style={styles.honorContent}>
        {children ?? <Text style={styles.empty}>{empty}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: '#F8F9FC',
  },
  coverWrap: {
    width: '100%',
    backgroundColor: '#1A0A0C',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHeaderContainer: {
    alignItems: 'center',
    paddingBottom: 16,
    backgroundColor: '#F8F9FC',
  },
  avatarOverlapContainer: {
    marginTop: -48,
    marginBottom: 12,
  },
  avatarLargeRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    borderColor: '#ffffff',
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarLargeImg: {
    width: '100%',
    height: '100%',
  },
  nameRowCentered: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 6,
  },
  nameCentered: {
    fontSize: 22,
    lineHeight: 32,
    fontWeight: 'bold',
    color: '#15151A',
    fontFamily: lu.fonts.displayHeavy,
  },
  agePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
  },
  agePillMale: {
    backgroundColor: lu.colors.blueSoft,
  },
  agePillFemale: {
    backgroundColor: lu.colors.pinkSoft,
  },
  ageText: {
    fontSize: 11,
    fontFamily: lu.fonts.bodyBold,
  },
  ageTextMale: {
    color: lu.colors.blue,
  },
  ageTextFemale: {
    color: lu.colors.pink,
  },
  locationIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: lu.fonts.bodySemi,
  },
  metaDivider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginHorizontal: 4,
  },
  cardPadding: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  voiceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  voiceCardEmpty: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.06)',
    borderStyle: 'dashed',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 14.5,
    color: '#15151A',
    fontFamily: lu.fonts.bodyBold,
  },
  cardTitleEmpty: {
    fontSize: 14.5,
    color: '#6B7280',
    fontFamily: lu.fonts.bodyBold,
  },
  voicePlayerContainer: {
    marginTop: 4,
  },
  voiceEmptyText: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
    fontFamily: lu.fonts.body,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 5,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  tabItemActive: {
    backgroundColor: 'rgba(225, 20, 20, 0.06)',
  },
  tabItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: lu.fonts.bodyBold,
  },
  tabLabelActive: {
    color: '#E11414',
    fontFamily: lu.fonts.displayHeavy,
  },
  tabContent: {
    paddingHorizontal: 16,
  },
  bioCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  bioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  bioTitle: {
    fontSize: 14,
    color: '#15151A',
    fontFamily: lu.fonts.bodyBold,
  },
  bioText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
    fontFamily: lu.fonts.body,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  infoText: {
    fontSize: 14,
    color: '#4B5563',
    fontFamily: lu.fonts.bodyBold,
  },
  infoDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.04)',
    marginVertical: 4,
  },
  tagsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  tagsTitle: {
    fontSize: 14,
    color: '#15151A',
    fontFamily: lu.fonts.bodyBold,
    marginBottom: 12,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 99,
  },
  tagChipText: {
    fontSize: 13,
    color: '#374151',
    fontFamily: lu.fonts.bodyBold,
  },
  tagAddBtn: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 99,
  },
  tagAddBtnText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontFamily: lu.fonts.bodyBold,
  },
  albumCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  albumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  albumTitle: {
    fontSize: 14,
    color: '#15151A',
    fontFamily: lu.fonts.bodyBold,
  },
  albumCount: {
    fontSize: 13,
    color: '#9CA3AF',
    fontFamily: lu.fonts.bodyBold,
  },
  albumOvalsWrapper: {
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  postCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  postText: {
    fontSize: 14,
    color: '#15151A',
    lineHeight: 22,
    fontFamily: lu.fonts.body,
  },
  postImg: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    marginTop: 10,
  },
  honorCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  honorHead: {
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  honorTitle: {
    fontSize: 14.5,
    color: '#15151A',
    fontFamily: lu.fonts.bodyBold,
  },
  honorCountRow: {
    alignItems: 'center',
    gap: 4,
  },
  honorCount: {
    fontSize: 13.5,
    color: '#9CA3AF',
    fontFamily: lu.fonts.bodyBold,
  },
  honorContent: {
    marginTop: 4,
  },
  titlesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  giftPreviewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  giftPreviewCard: {
    width: 72,
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    padding: 8,
  },
  giftPreviewImg: {
    width: 48,
    height: 40,
  },
  giftPreviewCount: {
    fontSize: 12,
    fontWeight: '700',
    color: lu.colors.pink,
    marginTop: 4,
  },
  empty: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 10,
  },
  fixedBottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 10,
    gap: 10,
  },
  btnPrimary: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  btnSecondary: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    color: '#374151',
    fontSize: 14.5,
    fontFamily: lu.fonts.bodyBold,
  },
  gradientBtn: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 14.5,
    fontFamily: lu.fonts.bodyBold,
  },
});

