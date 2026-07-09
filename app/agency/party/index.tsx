/**
 * برنامج الحفل — طلبات وفعاليات الوكالة
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Megaphone, Share2, Radio } from 'lucide-react-native';

import { Text, useAlert } from '@/components/ui';
import { BackChevron } from '@/components/ui/RtlChevron';
import {
  subscribeToAgencyPartyRequests,
  subscribeToDiscoverPartyEvents,
  isPartyOngoing,
  isPartyUpcoming,
  partyEventTypeLabel,
  type AgencyPartyRequest,
} from '@/services/agencyPartyRequests';
import { ShareToChatModal, type ShareInviteItem } from '@/components/chat/ShareToChatModal';

type MainTab = 'mine' | 'discover';
type TimeTab = 'soon' | 'live';

function formatEventTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

function EventCard({
  item,
  isAr,
  onShare,
}: {
  item: AgencyPartyRequest;
  isAr: boolean;
  onShare: () => void;
}) {
  const live = isPartyOngoing(item);
  return (
    <View style={styles.eventCard}>
      <View style={styles.eventTopRow}>
        {item.allowPublicPromotion ? (
          <View style={styles.recommendTag}>
            <Text style={styles.recommendText}>{isAr ? 'توصية' : 'Featured'}</Text>
          </View>
        ) : (
          <View style={{ width: 56 }} />
        )}
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={styles.eventAgency} numberOfLines={1}>
            {item.agencyName || (isAr ? 'وكالة' : 'Agency')}
          </Text>
          <Text style={styles.eventRoomId}>
            {isAr ? 'أيدي الغرفة:' : 'Room ID:'} {item.roomId.slice(0, 8)}
          </Text>
        </View>
      </View>

      <View style={styles.eventBody}>
        {item.coverUrl ? (
          <Image source={{ uri: item.coverUrl }} style={styles.eventCover} contentFit="cover" />
        ) : (
          <View style={[styles.eventCover, styles.eventCoverFallback]}>
            <Radio size={28} color="#fff" />
          </View>
        )}
        <View style={styles.eventInfo}>
          <View style={styles.typeChip}>
            <Text style={styles.typeChipText}>{partyEventTypeLabel(item.eventType, isAr)}</Text>
          </View>
          <Text style={styles.eventDesc} numberOfLines={3}>
            {item.description}
          </Text>
          <Text style={styles.eventTime}>{formatEventTime(item.startAt)}</Text>
        </View>
      </View>

      <View style={styles.eventActions}>
        <Pressable style={[styles.actionBtn, styles.liveBtn]} disabled={!live}>
          <Radio size={14} color="#fff" />
          <Text style={styles.actionBtnText}>{live ? (isAr ? 'جاري' : 'Live') : item.status === 'pending' ? (isAr ? 'قيد المراجعة' : 'Pending') : (isAr ? 'مجدول' : 'Scheduled')}</Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, styles.shareBtn]} onPress={onShare}>
          <Share2 size={14} color="#fff" />
          <Text style={styles.actionBtnText}>{isAr ? 'مشاركة' : 'Share'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function AgencyPartyProgramScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const params = useLocalSearchParams<{ roomId?: string; agencyId?: string; agencyName?: string }>();
  const isAr = i18n.language?.startsWith('ar') !== false;

  const [mainTab, setMainTab] = useState<MainTab>('mine');
  const [timeTab, setTimeTab] = useState<TimeTab>('live');
  const [mineEvents, setMineEvents] = useState<AgencyPartyRequest[]>([]);
  const [discoverEvents, setDiscoverEvents] = useState<AgencyPartyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareTarget, setShareTarget] = useState<AgencyPartyRequest | null>(null);

  const agencyId = params.agencyId ?? '';

  useEffect(() => {
    if (!agencyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubMine = subscribeToAgencyPartyRequests(agencyId, (list) => {
      setMineEvents(list);
      setLoading(false);
    });
    const unsubDiscover = subscribeToDiscoverPartyEvents(setDiscoverEvents);
    return () => {
      unsubMine();
      unsubDiscover();
    };
  }, [agencyId]);

  const filtered = useMemo(() => {
    const source = mainTab === 'mine' ? mineEvents : discoverEvents;
    return source.filter((e) =>
      timeTab === 'live' ? isPartyOngoing(e) : isPartyUpcoming(e),
    );
  }, [mainTab, timeTab, mineEvents, discoverEvents]);

  const shareInvites = useMemo((): ShareInviteItem[] => {
    if (!shareTarget) return [];
    return [{
      kind: 'party',
      partyId: shareTarget.id,
      roomId: shareTarget.roomId,
      partyTitle: shareTarget.description,
      agencyName: shareTarget.agencyName,
    }];
  }, [shareTarget]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#4A0707', '#2A0404', '#1A0202']} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerSide}>
          <BackChevron size={22} color="#F6D58A" />
        </Pressable>
        <Text style={styles.headerTitle}>{t('agencyParty.title')}</Text>
        <Pressable
          hitSlop={12}
          style={styles.headerSide}
          onPress={() =>
            showAlert({
              type: 'info',
              title: t('agencyParty.detailsTitle'),
              message: t('agencyParty.detailsBody'),
            })
          }
        >
          <Megaphone size={18} color="#F6D58A" />
        </Pressable>
      </View>

      <View style={styles.mainTabs}>
        {([
          { key: 'mine' as MainTab, label: t('agencyParty.tabMine') },
          { key: 'discover' as MainTab, label: t('agencyParty.tabDiscover') },
        ]).map(({ key, label }) => (
          <Pressable
            key={key}
            onPress={() => setMainTab(key)}
            style={[styles.mainTab, mainTab === key && styles.mainTabActive]}
          >
            <Text style={[styles.mainTabText, mainTab === key && styles.mainTabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.subTabs}>
        {([
          { key: 'soon' as TimeTab, label: t('agencyParty.tabSoon') },
          { key: 'live' as TimeTab, label: t('agencyParty.tabLive') },
        ]).map(({ key, label }) => (
          <Pressable
            key={key}
            onPress={() => setTimeTab(key)}
            style={[styles.subTab, timeTab === key && styles.subTabActive]}
          >
            <Text style={[styles.subTabText, timeTab === key && styles.subTabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color="#F6D58A" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}>
          {filtered.length === 0 ? (
            <Text style={styles.emptyText}>{t('agencyParty.empty')}</Text>
          ) : (
            filtered.map((item) => (
              <EventCard key={item.id} item={item} isAr={isAr} onShare={() => setShareTarget(item)} />
            ))
          )}
        </ScrollView>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          style={styles.createBtn}
          onPress={() =>
            router.push({
              pathname: '/agency/party/create',
              params: {
                roomId: params.roomId ?? '',
                agencyId: params.agencyId ?? '',
                agencyName: params.agencyName ?? '',
              },
            } as any)
          }
        >
          <LinearGradient colors={['#F6D58A', '#D4AF37']} style={styles.createBtnGrad}>
            <Text style={styles.createBtnText}>{t('agencyParty.create')}</Text>
          </LinearGradient>
        </Pressable>
      </View>

      <ShareToChatModal
        visible={!!shareTarget}
        onClose={() => setShareTarget(null)}
        title={t('agencyParty.shareTitle')}
        invites={shareInvites}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#2A0404' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerSide: { width: 36, alignItems: 'center' },
  headerTitle: { color: '#F6D58A', fontSize: 20, fontWeight: '800' },
  mainTabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(246,213,138,0.35)',
  },
  mainTab: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: 'rgba(246,213,138,0.12)' },
  mainTabActive: { backgroundColor: '#8B1530' },
  mainTabText: { color: '#F6D58A', fontWeight: '700' },
  mainTabTextActive: { color: '#fff' },
  subTabs: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 12 },
  subTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(246,213,138,0.15)',
  },
  subTabActive: { backgroundColor: '#8B1530' },
  subTabText: { color: '#F6D58A', fontWeight: '700', fontSize: 13 },
  subTabTextActive: { color: '#fff' },
  emptyText: { color: 'rgba(255,255,255,0.65)', textAlign: 'center', marginTop: 32 },
  eventCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
  },
  eventTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  recommendTag: {
    backgroundColor: '#FEE2E2',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  recommendText: { color: '#E11414', fontSize: 11, fontWeight: '700' },
  eventAgency: { color: '#111', fontWeight: '700', fontSize: 13 },
  eventRoomId: { color: '#666', fontSize: 11, marginTop: 2 },
  eventBody: { flexDirection: 'row', gap: 10 },
  eventCover: { width: 88, height: 88, borderRadius: 10 },
  eventCoverFallback: { backgroundColor: '#E11414', alignItems: 'center', justifyContent: 'center' },
  eventInfo: { flex: 1 },
  typeChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFE6E9',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
  },
  typeChipText: { color: '#C40E1E', fontSize: 10, fontWeight: '700' },
  eventDesc: { color: '#222', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  eventTime: { color: '#666', fontSize: 11, marginTop: 8 },
  eventActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    paddingVertical: 10,
  },
  liveBtn: { backgroundColor: '#F97316' },
  shareBtn: { backgroundColor: '#C61414' },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: 'rgba(26, 2, 2, 0.92)',
  },
  createBtn: { borderRadius: 14, overflow: 'hidden' },
  createBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  createBtnText: { color: '#3A2A00', fontWeight: '800', fontSize: 16 },
});
