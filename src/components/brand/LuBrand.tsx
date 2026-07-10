/**
 * LinkUp Brand Components — الشعار + شعارات اجتماعية
 */

import React from 'react';
import { View, Text, StyleSheet, I18nManager } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { Image } from 'expo-image';
import { lu } from '@/theme/lu-brand';

// ============ LinkUp Wordmark (LINK gray + UP gradient) ============
// LTR direction even in RTL — لأن الشعار اسم انجليزي.
export function Wordmark({ size = 40 }: { size?: number }) {
  return (
    <View style={[styles.wordmark, { flexDirection: 'row' }]}>
      <Text style={[styles.wordmarkText, { fontSize: size, color: lu.colors.ink }]}>
        LINK
      </Text>
      <MaskedView
        maskElement={
          <Text style={[styles.wordmarkText, { fontSize: size, color: '#000' }]}>UP</Text>
        }
      >
        <LinearGradient
          colors={lu.gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={[styles.wordmarkText, { fontSize: size, opacity: 0 }]}>UP</Text>
        </LinearGradient>
      </MaskedView>
    </View>
  );
}

export const FULL_LOGO_ASPECT = 4197 / 1128;

type LuLogoProps = {
  width?: number;
  height?: number;
  size?: number;
  light?: boolean;
};

// ============ Compact Logo (full wordmark image) ============
export function LuLogo({ width, height, size = 42, light }: LuLogoProps) {
  const resolvedWidth = width ?? size * 0.82 * FULL_LOGO_ASPECT;
  const resolvedHeight = height ?? resolvedWidth / FULL_LOGO_ASPECT;

  // على الخلفية الداكنة: نص الشعار الأسود لا يظهر — بلاطة فاتحة للأيقونة + كلمة بيضاء/حمراء.
  if (light) {
    const tile = Math.round(resolvedHeight * 1.06);
    const fontSize = Math.round(resolvedHeight * 0.82);
    return (
      <View style={[styles.logoRow, { gap: 8, maxWidth: '100%' }]}>
        <View style={[styles.logoTile, { width: tile, height: tile, borderRadius: Math.round(tile * 0.3) }]}>
          <LinearGradient
            colors={['#3A141C', '#1B0C10']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Image
            source={require('../../../assets/images/linkup-icon-standalone.png')}
            style={{ width: '68%', height: '68%' }}
            contentFit="contain"
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[styles.logoLightText, { fontSize, color: '#FFFFFF' }]}>Link</Text>
          <MaskedView
            maskElement={
              <Text style={[styles.logoLightText, { fontSize, color: '#000' }]}>Up</Text>
            }
          >
            <LinearGradient
              colors={['#FF4D4D', '#E11414']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={[styles.logoLightText, { fontSize, opacity: 0 }]}>Up</Text>
            </LinearGradient>
          </MaskedView>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.logoRow, { width: resolvedWidth, maxWidth: '100%' }]}>
      <Image
        source={require('../../../assets/images/linkup-full-logo-black.png')}
        style={{ width: '100%', aspectRatio: FULL_LOGO_ASPECT }}
        contentFit="contain"
      />
    </View>
  );
}

// ============ Google "G" Logo (real colors) ============
export function GoogleLogo({ size = 26 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.2 13.6 17.6 9.5 24 9.5z"
      />
      <Path
        fill="#ED4949"
        d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.7c-.6 3-2.3 5.5-4.9 7.2l7.6 5.9c4.4-4.1 7.1-10.1 7.1-17.4z"
      />
      <Path
        fill="#FBBC05"
        d="M10.4 28.3c-.5-1.5-.8-3.1-.8-4.8s.3-3.3.8-4.8l-7.8-6.1C.9 16.1 0 19.9 0 23.5s.9 7.4 2.6 10.9l7.8-6.1z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.4 0-11.8-4.1-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48z"
      />
    </Svg>
  );
}

// ============ TikTok Logo ============
export function TikTokLogo({ size = 24, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M16.5 3c.3 2.3 1.7 3.9 3.9 4.1v2.6c-1.3.1-2.5-.3-3.9-1v6.7c0 4-3.4 6.6-7 5.9-3-.6-4.7-3.6-4-6.6.6-2.6 3-4.2 5.7-3.9v2.7c-.5-.1-1-.2-1.6 0-1.1.3-1.8 1.4-1.6 2.6.2 1.1 1.2 1.8 2.4 1.7 1.3-.1 2.1-1.1 2.1-2.5V3z"
      />
    </Svg>
  );
}

// ============ X (Twitter) Logo ============
export function XLogo({ size = 24, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"
      />
    </Svg>
  );
}

// ============ Snapchat Logo (ghost) ============
export function SnapchatLogo({ size = 24, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.075.27-.27.405-.555.405h-.03c-.135 0-.313-.031-.538-.074-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.273-3.294 1.273-.06 0-.119-.001-.18-.007-.075.006-.149.007-.225.007-1.468 0-2.427-.674-3.279-1.272-.599-.42-1.137-.78-1.737-.884-.314-.06-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.887-.225-2.92-.643-3.158-1.226-.031-.075-.046-.15-.046-.225-.015-.24.165-.465.42-.509 3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809-.121-.029-.24-.074-.346-.119-1.107-.435-1.257-.93-1.197-1.273.09-.479.674-.793 1.168-.793.146 0 .27.029.383.074.42.194.789.299 1.104.299.234 0 .384-.06.465-.105l-.046-.569c-.098-1.626-.225-3.651.307-4.837C7.392 1.077 10.739.807 11.733.807l.405-.014h.06z"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wordmark: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wordmarkText: {
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: lu.fonts.bodyHeavy,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoTile: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.2,
    borderColor: 'rgba(255,77,94,0.4)',
    shadowColor: '#FF2D3E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 9,
    elevation: 6,
  },
  logoLightText: {
    fontWeight: '800',
    letterSpacing: 0.2,
    fontFamily: lu.fonts.displayHeavy,
    includeFontPadding: false,
  },
});
