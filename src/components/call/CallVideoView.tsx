/**
 * عرض فيديو المكالمة — يميّز مسار المزوّد من شكل المرجع الممرَّر:
 * - كائن VideoTrack من LiveKit → VideoView من @livekit/react-native (كما كان).
 * - مرجع AgoraCallVideoRef ({provider:'agora'}) → AgoraVideoView الكسول.
 * الشاشات لا تعرف المزوّد — تمرر snapshot.localVideoTrack/remoteVideoTrack كما هي.
 */
import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { VideoView } from '@livekit/react-native';
import type { VideoTrack } from 'livekit-client';
import type { AgoraCallVideoRef } from '@/services/rtc/agoraCallSession';

import { AgoraVideoView } from './AgoraVideoView';

interface Props {
  track?: VideoTrack | AgoraCallVideoRef;
  style?: ViewStyle;
  mirror?: boolean;
  objectFit?: 'cover' | 'contain';
}

function isAgoraRef(track: VideoTrack | AgoraCallVideoRef): track is AgoraCallVideoRef {
  return (track as AgoraCallVideoRef).provider === 'agora';
}

export function CallVideoView({ track, style, mirror, objectFit = 'cover' }: Props) {
  if (!track) return null;

  if (isAgoraRef(track)) {
    return (
      <AgoraVideoView
        uid={track.uid}
        local={track.local}
        style={style}
        mirror={mirror}
        objectFit={objectFit}
      />
    );
  }

  return (
    <VideoView
      style={style ? { ...StyleSheet.absoluteFillObject, ...style } : StyleSheet.absoluteFillObject}
      videoTrack={track}
      objectFit={objectFit}
      mirror={mirror}
    />
  );
}
