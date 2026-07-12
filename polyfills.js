/**
 * Polyfills لمحرّك Hermes
 *
 * Hermes (محرّك JS في React Native) ينقصه globals تحتاجها مكتبات
 * التطبيق (Firebase وغيرها — أُضيفت أصلاً لأجل LiveKit وبقيت بعد إزالته
 * لأن مكتبات أخرى تعتمد عليها):
 *   - TextDecoder   (Hermes فيه TextEncoder فقط)
 *   - DOMException  (تشير إليه مكتبات ويب متعددة وHermes لا يوفّره)
 *   - URL           (نسخة Hermes ناقصة)
 *   - crypto.getRandomValues (لتوليد المعرّفات)
 *
 * يجب تحميل هذا الملف *أول شيء* قبل أي import آخر.
 */

// 1) crypto.getRandomValues
import 'react-native-get-random-values';

// 2) URL polyfill
import 'react-native-url-polyfill/auto';

// 3) TextEncoder / TextDecoder
import { TextEncoder, TextDecoder } from 'text-encoding';

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder;
}

// 4) DOMException — تشير إليه مكتبات ويب وHermes ما يوفّره
if (typeof global.DOMException === 'undefined') {
  global.DOMException = class DOMException extends Error {
    constructor(message, name) {
      super(message);
      this.name = name || 'Error';
      this.message = message || '';
    }
  };
}
