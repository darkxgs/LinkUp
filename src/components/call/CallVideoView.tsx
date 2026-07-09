/**
 * عرض فيديو مكالمة LiveKit — يستخدم VideoView من @livekit/react-native
 */
import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { VideoView } from '@livekit/react-native';
import type { VideoTrack } from 'livekit-client';

interface Props {
  track?: VideoTrack;
  style?: ViewStyle;
  mirror?: boolean;
  objectFit?: 'cover' | 'contain';
}

export function CallVideoView({ track, style, mirror, objectFit = 'cover' }: Props) {
  if (!track) return null;

  return (
    <VideoView
      style={style ? { ...StyleSheet.absoluteFillObject, ...style } : StyleSheet.absoluteFillObject}
      videoTrack={track}
      objectFit={objectFit}
      mirror={mirror}
    />
  );
}
