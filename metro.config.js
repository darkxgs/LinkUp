// Metro configuration — تحسينات الأداء + حل bundle Firebase Auth لـ React Native
// firebase/auth الافتراضي = bundle المتصفح (بدون getReactNativePersistence ولا إرسال توken للـ Functions)
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};

const rnAuthEntry = path.resolve(
  __dirname,
  'node_modules/@firebase/auth/dist/rn/index.js',
);

config.resolver = {
  ...config.resolver,
  resolveRequest(context, moduleName, platform) {
    if (platform !== 'web' && moduleName === 'firebase/auth') {
      return {
        filePath: rnAuthEntry,
        type: 'sourceFile',
      };
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
