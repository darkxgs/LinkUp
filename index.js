/**
 * نقطة دخول التطبيق
 *
 * الترتيب مهم:
 *  1) polyfills
 *  2) expo-router/entry — يجب أن يكون متزامناً (يسجّل "main" فوراً)
 *
 * لا تضع await أو import ديناميكي لـ expo-router هنا — وإلا يظهر:
 *   "main" has not been registered
 *
 * LiveKit يُحمَّل فقط عند دخول الروم (roomAudioSession) أو المكالمة (useCall).
 * RTL من التخزين: يُشغَّل بالتوازي + initI18n في _layout
 */
import './polyfills';
import './src/services/roomForegroundService';

import 'expo-router/entry';

import('./src/localization/bootstrapRtl')
  .then((m) => m.bootstrapRtlFromStorage())
  .catch(() => {});
