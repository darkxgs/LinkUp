/**
 * Polyfills لمحرّك Hermes
 *
 * Hermes (محرّك JS في React Native) ينقصه globals تحتاجها
 * مكتبة LiveKit / livekit-client / webrtc:
 *   - TextDecoder   (Hermes فيه TextEncoder فقط)
 *   - DOMException  (يستخدمه webrtc-adapter داخل livekit-client)
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

// 4) DOMException — يشير إليه livekit-client وHermes ما يوفّره
if (typeof global.DOMException === 'undefined') {
  global.DOMException = class DOMException extends Error {
    constructor(message, name) {
      super(message);
      this.name = name || 'Error';
      this.message = message || '';
    }
  };
}
