module.exports = function (api) {
  // الكاش يعتمد على البيئة حتى يُعاد تقييم isProduction لكل من dev/prod بدل
  // تجميد أول تقييم (api.cache(true) كان قد يُجمّد وضع التطوير فلا تُزال الـlogs
  // في بناء الإنتاج). api.env('production') هو الفحص المعياري في babel.
  api.cache.using(() => process.env.NODE_ENV ?? process.env.BABEL_ENV ?? 'development');
  const isProduction =
    api.env('production') ||
    process.env.NODE_ENV === 'production' ||
    process.env.BABEL_ENV === 'production';
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            '@': './src',
            '@/components': './src/components',
            '@/services': './src/services',
            '@/hooks': './src/hooks',
            '@/stores': './src/stores',
            '@/theme': './src/theme',
            '@/types': './src/types',
            '@/utils': './src/utils',
            '@/config': './src/config',
            '@/localization': './src/localization',
          },
        },
      ],
      // ⚡ إزالة console.* في الإنتاج لتحسين الأداء (يبقى console.error للأخطاء الحرجة)
      ...(isProduction
        ? [['transform-remove-console', { exclude: ['error'] }]]
        : []),
      // يجب أن يكون reanimated آخر plugin دائماً
      'react-native-reanimated/plugin',
    ],
  };
};
