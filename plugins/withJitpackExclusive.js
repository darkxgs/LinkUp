/**
 * BlurView (تبعية expo-blur الأصلية) تُحلّ حصرياً من JitPack.
 *
 * السبب: Gradle كان يستعلم مستودع oss.sonatype.org (المتوقَّف تدريجياً) قبل
 * JitPack، وأي 504 منه «يفشّل» البناء بالكامل بدل تجاوزه للمستودع التالي —
 * فشل بناءا EAS d6996399 و699896b2 بهذا الخطأ بالضبط:
 *   Could not GET '.../BlurView-version-2.0.6.pom' — 504 Gateway Time-out
 * exclusiveContent يجعل مجموعة com.github.Dimezis تُطلب من JitPack فقط.
 */
const { withProjectBuildGradle } = require('expo/config-plugins');

const MARKER = 'exclusiveContent-jitpack-Dimezis';
const BLOCK = `
// ${MARKER}: BlurView (expo-blur) من JitPack حصرياً — sonatype كان يرجع 504 فيفشل البناء
allprojects {
    repositories {
        exclusiveContent {
            forRepository { maven { url "https://www.jitpack.io" } }
            filter { includeGroup "com.github.Dimezis" }
        }
    }
}
`;

module.exports = function withJitpackExclusive(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes(MARKER)) {
      cfg.modResults.contents += BLOCK;
    }
    return cfg;
  });
};
