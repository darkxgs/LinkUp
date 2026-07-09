/**
 * صور أوسمة/إطارات SVIP — وضوح عالٍ على شاشات Retina
 */
import React from 'react';
import { Image, type ImageProps } from 'expo-image';
import { type StyleProp, type ImageStyle } from 'react-native';

import { IMG_DECOR, sharpImageStyle } from '@/utils/imageConfig';

type Props = Omit<ImageProps, 'style' | 'width' | 'height'> & {
  width: number;
  height: number;
  style?: StyleProp<ImageStyle>;
  sharp?: boolean;
};

export function DecorImage({
  width,
  height,
  style,
  sharp = true,
  contentFit = 'contain',
  ...rest
}: Props) {
  const sizeStyle = sharp ? sharpImageStyle(width, height) : { width, height };

  return (
    <Image
      {...IMG_DECOR}
      style={[sizeStyle, style]}
      contentFit={contentFit}
      {...rest}
    />
  );
}
