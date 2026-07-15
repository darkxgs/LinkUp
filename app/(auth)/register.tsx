/**
 * LinkUp App — Register Screen
 */

import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User as UserIcon,
  ChevronDown,
  Check,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react-native';

import { RealCountryFlag } from '@/components/ui';
import { CountryPickerSheet } from '@/components/ui/CountryPickerSheet';
import {
  AuthShell,
  AuthField,
  AuthPrimaryButton,
  AuthBottomSheet,
  AuthSheetRow,
} from '@/components/auth';
import { useAuth } from '@/hooks/useAuth';
import { lu } from '@/theme/lu-brand';

export default function RegisterScreen() {
  const { t, i18n } = useTranslation();
  const linkDir = { flexDirection: ('row') as 'row' | 'row-reverse' };
  const router = useRouter();
  const { register, isLoading } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  // لا نضع دولة افتراضية — يجب على المستخدم الاختيار (كان 'PS' يظهر فلسطين للجميع)
  const [country, setCountry] = useState<{ code: string; name?: string; nameKey?: string } | null>(null);
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePart, setDatePart] = useState<'day' | 'month' | 'year'>('year');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordsMatch = password === confirmPassword;

  const calcAge = (): number | null => {
    if (!birthDay || !birthMonth || !birthYear) return null;
    const d = Number(birthDay);
    const m = Number(birthMonth);
    const y = Number(birthYear);
    if (!d || !m || !y) return null;
    const birth = new Date(y, m - 1, d);
    if (birth.getDate() !== d || birth.getMonth() !== m - 1 || birth.getFullYear() !== y) {
      return null;
    }
    const today = new Date();
    let age = today.getFullYear() - y;
    const monthDiff = today.getMonth() - (m - 1);
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d)) {
      age--;
    }
    return age;
  };

  const age = calcAge();
  const hasBirthDate = !!(birthDay && birthMonth && birthYear);
  const isValidDate = age !== null;
  const isAdult = age !== null && age >= 18;

  const canSubmit =
    displayName.trim().length >= 2 &&
    isValidEmail &&
    password.length >= 6 &&
    passwordsMatch &&
    gender !== null &&
    country !== null &&
    hasBirthDate &&
    isValidDate &&
    isAdult &&
    agreedToTerms &&
    !isLoading;

  const handleRegister = async () => {
    if (!canSubmit) {
      if (displayName.trim().length < 2) {
        Alert.alert(t('common.error'), t('auth.nameMin'));
      } else if (!isValidEmail) {
        Alert.alert(t('common.error'), t('auth.emailInvalid'));
      } else if (password.length < 6) {
        Alert.alert(t('common.error'), t('auth.passwordMinLen'));
      } else if (!passwordsMatch) {
        Alert.alert(t('common.error'), t('auth.passwordsMismatch'));
      } else if (!gender) {
        Alert.alert(t('common.error'), t('auth.selectGenderError'));
      } else if (!country) {
        Alert.alert(t('common.error'), t('auth.selectCountryError'));
      } else if (!hasBirthDate) {
        Alert.alert(t('common.error'), t('auth.enterBirthDate'));
      } else if (!isValidDate) {
        Alert.alert(t('common.error'), t('auth.invalidBirthDate'));
      } else if (!isAdult) {
        Alert.alert(t('auth.sorry'), t('auth.ageRestriction'));
      } else if (!agreedToTerms) {
        Alert.alert(t('common.error'), t('auth.agreeTerms'));
      }
      return;
    }

    try {
      await register({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        gender: gender!,
        country: country!.code,
        birthYear: Number(birthYear),
        birthDay: Number(birthDay),
        birthMonth: Number(birthMonth),
      });

      Alert.alert(t('auth.welcomeLU'), t('auth.accountCreated'), [
        { text: t('auth.start'), onPress: () => router.replace('/(tabs)' as any) },
      ]);
    } catch (e: any) {
      Alert.alert(t('auth.registerFailed'), e.message);
    }
  };

  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear - 18; y >= 1950; y--) years.push(y);
  const days: number[] = [];
  for (let d = 1; d <= 31; d++) days.push(d);
  const MONTHS_KEYS = [
    'auth.monthJan', 'auth.monthFeb', 'auth.monthMar', 'auth.monthApr', 'auth.monthMay', 'auth.monthJun',
    'auth.monthJul', 'auth.monthAug', 'auth.monthSep', 'auth.monthOct', 'auth.monthNov', 'auth.monthDec',
  ];

  const datePickerTitle =
    datePart === 'day' ? t('auth.dayLabel') : datePart === 'month' ? t('auth.monthLabel') : t('auth.birthYearLabel');

  return (
    <>
      <AuthShell
        title={t('auth.createAccount')}
        subtitle={t('auth.joinFamily')}
        contentStyle={{ paddingBottom: lu.spacing.xxl }}
      >
        <AuthField
          label={`${t('auth.fullName')} *`}
          icon={<UserIcon size={18} color={lu.colors.muted} strokeWidth={2} />}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder={t('auth.fullNamePlaceholder')}
          maxLength={50}
        />

        <AuthField
          label={`${t('auth.emailLabel')} *`}
          icon={<Mail size={18} color={lu.colors.muted} strokeWidth={2} />}
          value={email}
          onChangeText={setEmail}
          placeholder="example@gmail.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textAlign="left"
        />

        <AuthField
          label={`${t('auth.passwordLabel')} * ${t('auth.passwordHint')}`}
          icon={<Lock size={18} color={lu.colors.muted} strokeWidth={2} />}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry={!showPassword}
          textAlign="left"
          trailing={
            showPassword ? (
              <EyeOff size={18} color={lu.colors.muted} strokeWidth={2} />
            ) : (
              <Eye size={18} color={lu.colors.muted} strokeWidth={2} />
            )
          }
          onTrailingPress={() => setShowPassword(!showPassword)}
        />

        <AuthField
          label={`${t('auth.confirmPasswordLabel')} *`}
          icon={<Lock size={18} color={lu.colors.muted} strokeWidth={2} />}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="••••••••"
          secureTextEntry={!showConfirm}
          textAlign="left"
          error={confirmPassword.length > 0 && !passwordsMatch ? t('auth.passwordsMismatchInline') : undefined}
          trailing={
            showConfirm ? (
              <EyeOff size={18} color={lu.colors.muted} strokeWidth={2} />
            ) : (
              <Eye size={18} color={lu.colors.muted} strokeWidth={2} />
            )
          }
          onTrailingPress={() => setShowConfirm(!showConfirm)}
        />

        <Text style={styles.sectionLabel}>{t('auth.gender')} *</Text>
        <View style={styles.genderRow}>
          <Pressable
            onPress={() => setGender('male')}
            style={[styles.genderBtn, gender === 'male' && styles.genderBtnActive]}
          >
            {gender === 'male' && (
              <LinearGradient
                colors={[lu.colors.blue, lu.colors.purpleDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            )}
            <Text style={[styles.genderText, gender === 'male' && styles.genderTextActive]}>
              {t('auth.male')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setGender('female')}
            style={[styles.genderBtn, gender === 'female' && styles.genderBtnActive]}
          >
            {gender === 'female' && (
              <LinearGradient
                colors={[lu.colors.pink, lu.colors.magenta]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            )}
            <Text style={[styles.genderText, gender === 'female' && styles.genderTextActive]}>
              {t('auth.female')}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>{t('auth.nationality')} *</Text>
        <Pressable onPress={() => setShowCountryPicker(true)} style={styles.selectBtn}>
          {country ? (
            <>
              <RealCountryFlag countryCode={country.code} size={22} shape="rectangle" />
              <Text style={styles.selectValue}>
                {country.nameKey ? t(country.nameKey) : country.name ?? country.code}
              </Text>
            </>
          ) : (
            <Text style={styles.selectPlaceholder}>{t('auth.chooseNationality')}</Text>
          )}
          <ChevronDown size={18} color={lu.colors.muted} />
        </Pressable>

        <Text style={styles.sectionLabel}>{t('auth.birthDate')} *</Text>
        <View style={styles.dateRow}>
          <Pressable
            onPress={() => { setDatePart('day'); setShowDatePicker(true); }}
            style={[styles.selectBtn, styles.dateCell]}
          >
            <Text style={birthDay ? styles.selectValue : styles.selectPlaceholder}>
              {birthDay || t('auth.dayLabel')}
            </Text>
            <ChevronDown size={16} color={lu.colors.muted} />
          </Pressable>
          <Pressable
            onPress={() => { setDatePart('month'); setShowDatePicker(true); }}
            style={[styles.selectBtn, styles.dateCellMonth]}
          >
            <Text style={birthMonth ? styles.selectValue : styles.selectPlaceholder}>
              {birthMonth ? t(MONTHS_KEYS[Number(birthMonth) - 1] ?? 'auth.monthLabel') : t('auth.monthLabel')}
            </Text>
            <ChevronDown size={16} color={lu.colors.muted} />
          </Pressable>
          <Pressable
            onPress={() => { setDatePart('year'); setShowDatePicker(true); }}
            style={[styles.selectBtn, styles.dateCell]}
          >
            <Text style={birthYear ? styles.selectValue : styles.selectPlaceholder}>
              {birthYear || t('auth.yearLabel')}
            </Text>
            <ChevronDown size={16} color={lu.colors.muted} />
          </Pressable>
        </View>

        {hasBirthDate && !isValidDate && (
          <View style={styles.hintRow}>
            <AlertCircle size={14} color={lu.colors.live} />
            <Text style={styles.hintError}>{t('auth.invalidBirthDate')}</Text>
          </View>
        )}
        {hasBirthDate && isValidDate && !isAdult && (
          <View style={styles.hintRow}>
            <AlertCircle size={14} color={lu.colors.live} />
            <Text style={styles.hintError}>{t('auth.ageMustBe18', { age })}</Text>
          </View>
        )}
        {hasBirthDate && isAdult && (
          <View style={styles.hintRow}>
            <CheckCircle2 size={14} color={lu.colors.mint} />
            <Text style={styles.hintOk}>{t('auth.yourAgeIs', { age })}</Text>
          </View>
        )}

        <Pressable onPress={() => setAgreedToTerms(!agreedToTerms)} style={styles.termsRow}>
          <View style={[styles.checkbox, agreedToTerms && styles.checkboxActive]}>
            {agreedToTerms && <Check size={14} color={lu.colors.onGrad} strokeWidth={3} />}
          </View>
          <Text style={styles.termsText}>
            {t('auth.agreeOn')}{' '}
            <Text style={styles.termsLink}>{t('auth.termsOfUse')}</Text>
            {' '}{t('auth.and')}{' '}
            <Text style={styles.termsLink}>{t('auth.privacyPolicy')}</Text>
          </Text>
        </Pressable>

        <AuthPrimaryButton
          label={t('auth.createAccountBtn')}
          onPress={handleRegister}
          disabled={!canSubmit}
          loading={isLoading}
        />

        <Pressable onPress={() => router.replace('/(auth)/login' as any)} style={[styles.linkRow, linkDir]}>
          <Text style={styles.linkMuted}>{t('auth.alreadyHaveAccount')} </Text>
          <Text style={styles.linkAccent}>{t('auth.signIn')}</Text>
        </Pressable>
      </AuthShell>

      <CountryPickerSheet
        visible={showCountryPicker}
        title={t('auth.selectCountryTitle')}
        selectedCode={country?.code}
        onSelect={(c) => {
          setCountry(c);
          setShowCountryPicker(false);
        }}
        onClose={() => setShowCountryPicker(false)}
      />

      <AuthBottomSheet
        visible={showDatePicker}
        title={datePickerTitle}
        onClose={() => setShowDatePicker(false)}
      >
        {datePart === 'day' &&
          days.map((d) => (
            <AuthSheetRow
              key={d}
              label={String(d)}
              selected={birthDay === String(d)}
              onPress={() => { setBirthDay(String(d)); setShowDatePicker(false); }}
            />
          ))}

        {datePart === 'month' &&
          MONTHS_KEYS.map((nameKey, idx) => (
            <AuthSheetRow
              key={nameKey}
              label={t(nameKey)}
              selected={birthMonth === String(idx + 1)}
              onPress={() => { setBirthMonth(String(idx + 1)); setShowDatePicker(false); }}
            />
          ))}

        {datePart === 'year' &&
          years.map((y) => (
            <AuthSheetRow
              key={y}
              label={String(y)}
              hint={t('auth.yearsAge', { count: currentYear - y })}
              selected={birthYear === String(y)}
              onPress={() => { setBirthYear(String(y)); setShowDatePicker(false); }}
            />
          ))}
      </AuthBottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    marginBottom: lu.spacing.xs,
    paddingHorizontal: 2,
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: lu.fonts.bodySemi,
    includeFontPadding: false,
  },
  genderRow: {
    flexDirection: 'row',
    gap: lu.spacing.sm,
    marginBottom: lu.spacing.base,
  },
  genderBtn: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,77,94,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  genderBtnActive: {
    borderColor: 'transparent',
  },
  genderText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontFamily: lu.fonts.bodyBold,
    includeFontPadding: false,
  },
  genderTextActive: {
    color: lu.colors.onGrad,
  },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: lu.spacing.sm,
    paddingHorizontal: lu.spacing.md,
    paddingVertical: 13,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,77,94,0.35)',
    marginBottom: lu.spacing.base,
  },
  selectValue: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
    fontFamily: lu.fonts.bodySemi,
    includeFontPadding: false,
  },
  selectPlaceholder: {
    flex: 1,
    fontSize: 15,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: lu.fonts.body,
    includeFontPadding: false,
  },
  dateRow: {
    flexDirection: 'row',
    gap: lu.spacing.sm,
    marginBottom: lu.spacing.xs,
  },
  dateCell: {
    flex: 1,
    marginBottom: 0,
  },
  dateCellMonth: {
    flex: 1.35,
    marginBottom: 0,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: lu.spacing.sm,
  },
  hintError: {
    fontSize: 12,
    color: lu.colors.live,
    fontFamily: lu.fonts.bodyMedium,
    includeFontPadding: false,
  },
  hintOk: {
    fontSize: 12,
    color: lu.colors.mint,
    fontFamily: lu.fonts.bodyMedium,
    includeFontPadding: false,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: lu.spacing.sm,
    marginTop: lu.spacing.sm,
    marginBottom: lu.spacing.xs,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'rgba(255,77,94,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxActive: {
    backgroundColor: '#E11414',
    borderColor: '#E11414',
  },
  termsText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: lu.fonts.body,
    includeFontPadding: false,
  },
  termsLink: {
    color: lu.colors.purple,
    fontFamily: lu.fonts.bodyBold,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: lu.spacing.base,
    marginTop: lu.spacing.xs,
  },
  linkMuted: {
    fontSize: 14,
    color: lu.colors.ink2,
    fontFamily: lu.fonts.body,
    includeFontPadding: false,
  },
  linkAccent: {
    fontSize: 14,
    color: lu.colors.pink,
    fontFamily: lu.fonts.bodyBold,
    includeFontPadding: false,
  },
});
