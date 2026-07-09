/**
 * تعديل منشور — النص (هوية LinkUp)
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  I18nManager,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Check, Pencil } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Text, BackButton } from '@/components/ui';
import { getPostById, updatePost } from '@/services/firebase/posts';
import { lu } from '@/theme/lu-brand';

export default function EditPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    getPostById(id).then((p) => {
      // null = غير موجود أو فشل التحميل — لا نعرض محرراً فارغاً يوحي أن كل شيء سليم
      if (p) setText(p.text);
      else setLoadFailed(true);
      setLoading(false);
    });
  }, [id]);

  const handleSave = async () => {
    if (!id || busy) return;
    setBusy(true);
    try {
      await updatePost(id, text);
      router.back();
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('feed.editFailed'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <LinearGradient colors={lu.gradients.pageHome} style={styles.flex}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={lu.colors.purple} />
        </View>
      </LinearGradient>
    );
  }

  if (loadFailed) {
    return (
      <LinearGradient colors={lu.gradients.pageHome} style={styles.flex}>
        <View style={styles.center}>
          <Text style={styles.loadFailedText}>{t('post.loadFailed')}</Text>
          <BackButton />
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={lu.gradients.pageHome} locations={[0, 0.25]} style={styles.flex}>
      <StatusBar style="dark" />
      <SafeAreaView edges={['top']} style={styles.flex}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <BackButton />
            <View style={styles.headerCenter}>
              <LinearGradient colors={lu.gradients.brand} style={styles.headerIcon}>
                <Pencil size={16} color="#fff" strokeWidth={2.5} />
              </LinearGradient>
              <Text style={styles.headerTitle}>{t('feed.editPost')}</Text>
            </View>
            <Pressable
              onPress={handleSave}
              disabled={busy || !text.trim()}
              style={[styles.saveBtn, (!text.trim() || busy) && { opacity: 0.45 }]}
            >
              {busy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Check size={20} color="#fff" strokeWidth={2.5} />
              )}
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}
            keyboardShouldPersistTaps="handled"
          >
            <LinearGradient
              colors={['#FFFFFF', '#FEF2F2']}
              style={styles.editorCard}
            >
              <Text style={styles.hint}>{t('feed.editPostHint')}</Text>
              <TextInput
                style={styles.input}
                multiline
                maxLength={2000}
                value={text}
                onChangeText={setText}
                placeholder={t('feed.writeSomething')}
                placeholderTextColor={lu.colors.muted}
                textAlignVertical="top"
                textAlign={I18nManager.isRTL ? 'right' : 'left'}
              />
              <Text style={styles.counter}>{text.length}/2000</Text>
            </LinearGradient>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: lu.colors.line,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: lu.colors.ink,
    fontFamily: lu.fonts.bodyHeavy,
  },
  saveBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: lu.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
    ...lu.shadows.card,
  },
  body: { padding: 16 },
  editorCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: lu.colors.line,
    ...lu.shadows.card,
  },
  hint: {
    fontSize: 13,
    color: lu.colors.muted,
    marginBottom: 12,
    fontFamily: lu.fonts.body,
  },
  input: {
    minHeight: 180,
    fontSize: 16,
    lineHeight: 24,
    color: lu.colors.ink,
    fontFamily: lu.fonts.body,
  },
  counter: {
    marginTop: 10,
    textAlign: I18nManager.isRTL ? 'left' : 'right',
    fontSize: 12,
    color: lu.colors.muted,
  },
  loadFailedText: {
    fontSize: 14,
    color: lu.colors.ink2,
    textAlign: 'center',
    paddingHorizontal: 32,
    marginBottom: 12,
  },
});
