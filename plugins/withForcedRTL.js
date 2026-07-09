/**
 * Expo Config Plugin — دعم RTL/LTR ديناميكي
 *
 * - Android: يحدد android:supportsRtl="true" (يسمح للنظام بـ RTL)
 *   ولا يفرض RTL في MainApplication، عشان I18nManager في JS يقرر
 * - iOS: ما يفرض اتجاه، يخلي UIView.appearance على default
 *
 * بهذا الشكل:
 * - عند اختيار العربية: I18nManager.forceRTL(true) من JS → RTL
 * - عند اختيار الإنجليزية: I18nManager.forceRTL(false) من JS → LTR
 *
 * I18nManager يحتاج reload عشان التغيير يظهر — نعالجه عبر expo-updates
 */

const { withAndroidManifest } = require('@expo/config-plugins');

// ============ Android: supportsRtl in manifest ============
function withAndroidSupportsRtl(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (app && app.$) {
      app.$['android:supportsRtl'] = 'true';
    }
    return cfg;
  });
}

module.exports = function withRTLSupport(config) {
  config = withAndroidSupportsRtl(config);
  return config;
};
