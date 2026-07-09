/**
 * Sada App — Discover User Card
 * Matches LinkUp design from screenshots
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Eye, Mic } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import {
  Text,
  Avatar,
  VerifiedBadge,
  CountryFlag,
  HeartBadge,
  CountBadge,
  VIPBadge,
} from '@/components/ui';
import { colors, radius, spacing, shadows } from '@/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_PADDING = spacing.md;
const PHOTO_SIZE = (SCREEN_WIDTH - CARD_PADDING * 2 - spacing.xs * 3) / 4;

export interface DiscoverUser {
  uid: string;
  displayName: string;
  avatar: string;
  country: string;
  isVerified: boolean;
  isVIP?: boolean;
  vipTier?: 'silver' | 'gold' | 'platinum' | 'diamond';
  isOnline: boolean;
  bio: string;
  photos: string[];
  views: number;
  hasVoice?: boolean;
}

interface UserCardProps {
  user: DiscoverUser;
  isLiked?: boolean;
  onPress?: () => void;
  onLike?: () => void;
}

export const UserCard: React.FC<UserCardProps> = ({
  user,
  isLiked = false,
  onPress,
  onLike,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const hasPhotos = user.photos.length > 0;
  
  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      {/* Header: avatar + name + heart */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Avatar
            uri={user.avatar}
            size="md"
            showStatus
            isOnline={user.isOnline}
          />
          <View style={styles.nameRow}>
            <Text variant="h4" weight="semibold" numberOfLines={1}>
              {user.displayName}
            </Text>
            {user.isVerified && <VerifiedBadge size={16} />}
            {user.isVIP && <VIPBadge tier={user.vipTier} size="sm" />}
            <CountryFlag countryCode={user.country} size={16} />
          </View>
        </View>
        
        <Pressable onPress={onLike} hitSlop={10}>
          <HeartBadge isLiked={isLiked} size={22} />
        </Pressable>
      </View>
      
      {/* Photos carousel (if exists) */}
      {hasPhotos && (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            pagingEnabled
            decelerationRate="fast"
            snapToInterval={PHOTO_SIZE + spacing.xs}
            contentContainerStyle={styles.photosContainer}
            onScroll={(e) => {
              const x = e.nativeEvent.contentOffset.x;
              setActiveIndex(Math.round(x / (PHOTO_SIZE + spacing.xs)));
            }}
            scrollEventThrottle={16}
          >
            {user.photos.map((photo, idx) => (
              <View key={idx} style={styles.photoWrapper}>
                <Image
                  source={{ uri: photo }}
                  style={styles.photo}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={200}
                />
              </View>
            ))}
          </ScrollView>
          
          {/* Pagination dots */}
          {user.photos.length > 1 && (
            <View style={styles.pagination}>
              {user.photos.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.dot,
                    idx === activeIndex && styles.dotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </>
      )}
      
      {/* Bio */}
      {user.bio ? (
        <Text
          variant="bodySmall"
          color={colors.text.secondary}
          numberOfLines={2}
          style={styles.bio}
        >
          {user.bio}
        </Text>
      ) : null}
      
      {/* Footer: views + voice indicator */}
      <View style={styles.footer}>
        <CountBadge
          count={user.views}
          icon={<Eye size={12} color={colors.white} />}
          bgColor={colors.brand.secondary}
        />
        
        {user.hasVoice && (
          <View style={styles.voiceBadge}>
            <LinearGradient
              colors={colors.gradients.luckyGame}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.voiceGradient}
            >
              <Mic size={12} color={colors.white} />
            </LinearGradient>
          </View>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: CARD_PADDING,
    marginBottom: spacing.md,
    ...shadows.sm,
    borderWidth: 0.5,
    borderColor: colors.border.light,
  },
  pressed: {
    opacity: 0.95,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 5,
  },
  photosContainer: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  photoWrapper: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.background.tertiary,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginBottom: spacing.sm,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.border.medium,
  },
  dotActive: {
    backgroundColor: colors.text.secondary,
    width: 14,
  },
  bio: {
    marginVertical: spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  voiceBadge: {
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  voiceGradient: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
