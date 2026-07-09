/**
 * DesignIcon — يعرض أيقونات حزمة التصميم الأصلية (SVG XML) بألوانها الكاملة.
 * المصادر في designSvgs.ts (مولّدة من Line up App Full File/Icons).
 */
import React from 'react';
import { SvgXml } from 'react-native-svg';

export function DesignIcon({ xml, size = 24 }: { xml: string; size?: number }) {
  return <SvgXml xml={xml} width={size} height={size} />;
}
