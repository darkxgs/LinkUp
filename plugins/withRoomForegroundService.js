/**
 * Expo Config Plugin — خدمة أمامية لبقاء صوت الروم على أندرويد («ابقَ في الروم»)
 */
const { withAndroidManifest } = require('@expo/config-plugins');

const FG_PERMISSIONS = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MICROPHONE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
  'android.permission.POST_NOTIFICATIONS',
];

function ensurePermission(manifest, name) {
  if (!manifest['uses-permission']) {
    manifest['uses-permission'] = [];
  }
  const exists = manifest['uses-permission'].some((p) => p.$?.['android:name'] === name);
  if (!exists) {
    manifest['uses-permission'].push({ $: { 'android:name': name } });
  }
}

function withRoomForegroundService(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    FG_PERMISSIONS.forEach((p) => ensurePermission(manifest, p));

    const app = manifest.application?.[0];
    if (!app) return cfg;

    if (!app.service) {
      app.service = [];
    }

    const services = [
      {
        $: {
          'android:name': 'com.supersami.foregroundservice.ForegroundService',
          'android:foregroundServiceType': 'microphone|mediaPlayback',
          'android:exported': 'false',
        },
      },
      {
        $: {
          'android:name': 'com.supersami.foregroundservice.ForegroundServiceTask',
          'android:exported': 'false',
        },
      },
    ];

    for (const svc of services) {
      const name = svc.$['android:name'];
      const exists = app.service.some((s) => s.$?.['android:name'] === name);
      if (!exists) {
        app.service.push(svc);
      }
    }

    return cfg;
  });
}

module.exports = withRoomForegroundService;
