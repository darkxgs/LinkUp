/**
 * بطاقة وكالة — تصميم مطابق للمرجع (شبكة + قائمة مستطيلة).
 */
import React from 'react';
import { View, StyleSheet, Pressable, Text as RNText } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BarChart2, Flame, Gift } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { RealCountryFlag } from '@/components/ui';
import { FramedAgencyCover } from '@/components/agency/FramedAgencyCover';
import { AgencyPresenceAvatars } from '@/components/agency/AgencyPresenceAvatars';
import type { Agency } from '@/services/firebase/social';
import type { Room } from '@/services/firebase/rooms';
import { countFilledSeats, isRoomLive } from '@/services/firebase/rooms';
import type { AgencyRoomPresenceSnapshot } from '@/services/agencyRoomPresence';
import { toSafeInt } from '@/utils/safeNumber';
import { lu } from '@/theme/lu-brand';

export type AgencyCardLayout = 'grid' | 'list';

const FALLBACK_GRADIENTS: readonly (readonly [string, string])[] = [
  ['#FF6B6B', '#3A0A0A'],
  ['#F7971E', '#FFD200'],
  ['#F0A0A0', '#FBD5D5'],
  ['#EA6666', '#8A0E0E'],
];

function pickGrad(seed: string): readonly [string, string] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return FALLBACK_GRADIENTS[h % FALLBACK_GRADIENTS.length] ?? ['#F0A0A0', '#FBD5D5'];
}

function PartyPill() {
  const { t } = useTranslation();
  return (
    <View style={styles.partyPill}>
      <Flame size={9} color="#fff" strokeWidth={2.5} />
      <RNText style={styles.partyPillText}>{t('room.partyBadge')}</RNText>
    </View>
  );
}

function LuckyBagPill() {
  const { t } = useTranslation();
  return (
    <LinearGradient
      colors={[lu.colors.gold, lu.colors.pink]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={styles.luckyBagPill}
    >
      <Gift size={9} color="#fff" strokeWidth={2.5} />
      <RNText style={styles.luckyBagPillText}>{t('luckyBag.discoverBadge')}</RNText>
    </LinearGradient>
  );
}

function AudienceStat({
  micCount,
  audience,
  presence,
  dark,
}: {
  micCount: number;
  audience: number;
  presence?: AgencyRoomPresenceSnapshot;
  dark?: boolean;
}) {
  if (presence && presence.totalCount > 0) {
    return (
      <AgencyPresenceAvatars
        faces={presence.faces}
        totalCount={presence.totalCount}
        micCount={presence.micCount}
        audienceCount={presence.audienceCount}
        variant="inline"
      />
    );
  }
  return (
    <View style={styles.audienceStat}>
      <BarChart2 size={13} color="#EF4444" strokeWidth={2.5} />
      <RNText style={[styles.audienceStatText, dark && { color: 'rgba(255,255,255,0.8)' }]}>
        {micCount} | {audience}
      </RNText>
    </View>
  );
}

export const AgencyRoomCard = React.memo(function AgencyRoomCard({
  agency,
  room,
  width,
  layout,
  supportPercent,
  frameUrl,
  hasActiveLuckyBag = false,
  presence,
  dark = false,
  onPress,
}: {
  agency: Agency;
  room?: Room;
  width: number;
  layout: AgencyCardLayout;
  supportPercent: number;
  frameUrl?: string;
  /** حقيبة حظ نشطة داخل غرفة الوكالة */
  hasActiveLuckyBag?: boolean;
  /** حضور مباشر من roomAudience + المقاعد */
  presence?: AgencyRoomPresenceSnapshot;
  /** السمة الداكنة */
  dark?: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const thumb =
    agency.logo?.startsWith('http')
      ? agency.logo
      : agency.cardBackgroundUrl?.startsWith('http')
        ? agency.cardBackgroundUrl
        : agency.banner?.startsWith('http')
          ? agency.banner
          : room?.banner?.startsWith('http')
            ? room.banner
            : null;
  const live = room ? isRoomLive(room) : false;
  const audience = presence?.audienceCount ?? (room ? toSafeInt(room.audienceCount) : 0);
  const micCount = presence?.micCount ?? (room ? countFilledSeats(room) : 0);
  const totalPresence = presence?.totalCount ?? audience + micCount;
  const showLive = live || totalPresence > 0;
  const grad = pickGrad(agency.id);
  const resolvedFrame = frameUrl?.startsWith('http') ? frameUrl : agency.cardFrameUrl;
  const subtitle =
    agency.description?.trim() ||
    (showLive ? t('rooms.agencyInRoom') : t('rooms.recently'));
  const showLuckyBag = showLive && hasActiveLuckyBag;

  if (layout === 'list') {
    const thumbW = 92;
    return (
      <Pressable onPress={onPress} style={[styles.listCard, dark && styles.listCardDark, { width }]}>
        <FramedAgencyCover
          imageUri={thumb}
          frameUri={resolvedFrame}
          width={thumbW}
          aspect={1}
          fallbackGrad={grad}
          borderRadius={8}
        />

        <View style={styles.listBody}>
          <View style={styles.listTitleRow}>
            <RealCountryFlag countryCode={agency.country || 'WW'} size={15} />
            <RNText style={[styles.listTitle, dark && { color: lu.colors.nightInk }]} numberOfLines={1}>
              {agency.name}
            </RNText>
          </View>

          <View style={styles.listBadgeRow}>
            {showLive ? <PartyPill /> : null}
            {showLuckyBag ? <LuckyBagPill /> : null}
          </View>

          <RNText style={[styles.listSub, dark && { color: lu.colors.nightMuted }]} numberOfLines={1}>
            {subtitle}
          </RNText>

          <View style={styles.listFooter}>
            {supportPercent > 0 ? (
              <RNText style={styles.listSupportHint}>{supportPercent}%</RNText>
            ) : (
              <View />
            )}
            <AudienceStat micCount={micCount} audience={audience} presence={presence} dark={dark} />
          </View>
        </View>
      </Pressable>
    );
  }

  const coverW = width;
  return (
    <Pressable onPress={onPress} style={[styles.gridWrap, { width }]}>
      <FramedAgencyCover
        imageUri={thumb}
        frameUri={resolvedFrame}
        width={coverW}
        aspect={1}
        fallbackGrad={grad}
        borderRadius={12}
      >
        {showLive ? (
          <View style={styles.gridLiveTop}>
            {presence && presence.totalCount > 0 ? (
              <AgencyPresenceAvatars
                faces={presence.faces}
                totalCount={presence.totalCount}
                micCount={presence.micCount}
                audienceCount={presence.audienceCount}
                variant="overlay"
              />
            ) : (
              <View style={styles.liveCountPill}>
                <RNText style={styles.liveCountText}>
                  {micCount} | {audience}
                </RNText>
              </View>
            )}
          </View>
        ) : null}
        {showLuckyBag ? (
          <View style={styles.gridLuckyTop}>
            <LuckyBagPill />
          </View>
        ) : null}
        {showLive ? (
          <View style={styles.gridPartyBottom}>
            <PartyPill />
          </View>
        ) : null}
      </FramedAgencyCover>

      <View style={styles.gridFooter}>
        <RealCountryFlag countryCode={agency.country || 'WW'} size={13} />
        <RNText style={[styles.gridFooterName, dark && { color: lu.colors.nightInk }]} numberOfLines={1}>
          {agency.name}
        </RNText>
      </View>
      {showLive && totalPresence > 0 ? (
        <View style={styles.gridOnlineRow}>
          <View style={styles.gridOnlineDot} />
          <RNText style={styles.gridOnlineText}>
            {t('rooms.onlineCount', { n: totalPresence })}
          </RNText>
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  partyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 3,
    backgroundColor: '#EF4444',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  partyPillText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
  },
  luckyBagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    shadowColor: lu.colors.gold,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 3,
  },
  luckyBagPillText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
  },
  listBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 5,
  },
  liveCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  liveCountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
  },
  audienceStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  audienceStatText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#374151',
    fontFamily: lu.fonts.bodyHeavy,
  },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBF3',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#8B7355',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  listCardDark: {
    backgroundColor: lu.colors.nightCard,
    borderColor: 'rgba(255,45,60,0.22)',
    shadowColor: '#FF1E30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  listBody: {
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  listTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  listTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
    color: '#1F2937',
    fontFamily: lu.fonts.bodyHeavy,
  },
  listSub: {
    fontSize: 11,
    color: '#9CA3AF',
    fontFamily: lu.fonts.bodySemi,
  },
  listFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  listSupportHint: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
    fontFamily: lu.fonts.bodySemi,
  },
  gridWrap: {
    marginBottom: 12,
  },
  gridLiveTop: {
    position: 'absolute',
    top: 10,
    start: 10,
    zIndex: 4,
  },
  gridLuckyTop: {
    position: 'absolute',
    top: 10,
    end: 10,
    zIndex: 4,
  },
  gridPartyBottom: {
    position: 'absolute',
    bottom: 10,
    start: 10,
    zIndex: 4,
  },
  gridFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  gridFooterName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    color: '#1F2937',
    fontFamily: lu.fonts.bodyHeavy,
    textAlign: 'center',
  },
  gridOnlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 3,
  },
  gridOnlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22E06B',
  },
  gridOnlineText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#22C55E',
    fontFamily: lu.fonts.bodyBold,
    includeFontPadding: false,
  },
});
