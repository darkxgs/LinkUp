/**
 * Bottom sheet لاختيار لغة التطبيق — يُستخدم في Onboarding والإعدادات.
 */
import React from 'react';
import { View, StyleSheet, Pressable, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Languages, Check } from 'lucide-react-native';

import { Text, RealCountryFlag } from '@/components/ui';
import { useAppLanguage } from '@/localization/useAppLanguage';
import type { SupportedLanguage } from '@/localization/language';
import { colors } from '@/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onLanguageChanged?: (lang: SupportedLanguage) => void;
};

export function LanguagePickerSheet({ visible, onClose, onLanguageChanged }: Props) {
  const { t, lang, changeLanguage } = useAppLanguage();

  const handleSelect = async (opt: SupportedLanguage) => {
    if (opt === lang) {
      onClose();
      return;
    }
    onClose();
    await changeLanguage(opt);
    onLanguageChanged?.(opt);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <LinearGradient
              colors={['#FF5C5C', '#E11414', '#B00E0E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerIcon}
            >
              <Languages size={28} color="#fff" strokeWidth={2.4} />
            </LinearGradient>
            <Text variant="h3" weight="bold" style={styles.title}>
              {t('settings.language')}
            </Text>
            <Text variant="caption" color={colors.text.tertiary} style={styles.subtitle}>
              {t('settings.languageDescription')}
            </Text>
          </View>

          <View style={styles.options}>
            {(['ar', 'en'] as const).map((opt) => {
              const isActive = lang === opt;
              const flagCode = opt === 'ar' ? 'SA' : 'GB';
              const nativeName = opt === 'ar' ? 'العربية' : 'English';
              const subName = opt === 'ar' ? 'Arabic' : 'الإنجليزية';

              return (
                <Pressable
                  key={opt}
                  onPress={() => handleSelect(opt)}
                  style={({ pressed }) => [
                    styles.option,
                    isActive && styles.optionActive,
                    pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                  ]}
                >
                  <View style={styles.flagWrap}>
                    <RealCountryFlag countryCode={flagCode} size={36} shape="circle" />
                  </View>

                  <View style={styles.textCol}>
                    <Text variant="body" weight="bold" style={{ fontSize: 17 }}>
                      {nativeName}
                    </Text>
                    <Text variant="caption" color={colors.text.tertiary} style={{ fontSize: 12.5, marginTop: 2 }}>
                      {subName}
                    </Text>
                  </View>

                  {isActive ? (
                    <LinearGradient
                      colors={['#FF4D4D', '#B00E0E']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.checkActive}
                    >
                      <Check size={16} color="#fff" strokeWidth={3} />
                    </LinearGradient>
                  ) : (
                    <View style={styles.checkIdle} />
                  )}
                </Pressable>
              );
            })}
          </View>

          <Text variant="caption" color={colors.text.tertiary} style={styles.hint}>
            {t('settings.languageChanged')}
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 8, 10, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 14,
    paddingHorizontal: 22,
    paddingBottom: 38,
    shadowColor: '#15151A',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#F1DCDC',
    alignSelf: 'center',
    marginBottom: 18,
  },
  header: {
    alignItems: 'center',
    marginBottom: 22,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
  },
  title: {
    fontSize: 20,
    color: '#15151A',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 19,
  },
  options: {
    gap: 10,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#FCF4F4',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionActive: {
    backgroundColor: '#FFE6E9',
    borderColor: '#E11414',
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  flagWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#F4DDDD',
    overflow: 'hidden',
  },
  textCol: {
    flex: 1,
  },
  checkActive: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  checkIdle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#F1DCDC',
    backgroundColor: '#FFFFFF',
  },
  hint: {
    textAlign: 'center',
    fontSize: 11.5,
    marginTop: 18,
    paddingHorizontal: 14,
    lineHeight: 16,
  },
});
