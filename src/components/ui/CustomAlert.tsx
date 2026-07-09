/**
 * LinkUp App — Custom Alert/Toast Component
 * بديل Alert العادي مع Lucide icons احترافية
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  Animated,
  Dimensions,
  Text as RNText,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Sparkles,
  Crown,
  Gift,
  Trophy,
  AlertCircle,
  Frown,
} from 'lucide-react-native';

import { Text } from './Text';
import { colors, radius, spacing, shadows } from '@/theme';
import {
  LuActionSheet,
  type ActionSheetConfig,
  type ActionSheetButton,
} from './LuActionSheet';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type AlertType =
  | 'success'   // ✅ نجاح
  | 'error'     // ❌ خطأ
  | 'warning'   // ⚠️ تحذير
  | 'info'      // ℹ️ معلومة
  | 'celebration' // 🎉 احتفال
  | 'gift'      // 🎁 هدية
  | 'crown'     // 👑 VIP
  | 'trophy'    // 🏆 جائزة
  | 'sad';      // 😔 خسارة

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AlertConfig {
  type?: AlertType;
  title: string;
  message?: string;
  buttons?: AlertButton[];
}

interface AlertContextType {
  showAlert: (config: AlertConfig) => void;
  hideAlert: () => void;
  showToast: (message: string) => void;
  showActionSheet: (config: ActionSheetConfig) => void;
  hideActionSheet: () => void;
}

const AlertContext = createContext<AlertContextType | null>(null);

// === Type configurations ===
const TYPE_CONFIG: Record<
  AlertType,
  { Icon: any; iconColor: string; gradient: [string, string]; bg: string }
> = {
  success: {
    Icon: CheckCircle2,
    iconColor: '#10B981',
    gradient: ['#34D399', '#10B981'],
    bg: '#D1FAE5',
  },
  error: {
    Icon: XCircle,
    iconColor: '#EF4444',
    gradient: ['#F87171', '#DC2626'],
    bg: '#FEE2E2',
  },
  warning: {
    Icon: AlertTriangle,
    iconColor: '#F59E0B',
    gradient: ['#FBBF24', '#D97706'],
    bg: '#FEF3C7',
  },
  info: {
    Icon: Info,
    iconColor: '#ED4444',
    gradient: ['#F06A6A', '#EA2626'],
    bg: '#FCDDDD',
  },
  celebration: {
    Icon: Sparkles,
    iconColor: '#FCD34D',
    gradient: ['#FCD34D', '#F59E0B'],
    bg: '#FEF3C7',
  },
  gift: {
    Icon: Gift,
    iconColor: '#E11414',
    gradient: ['#FF6670', '#C40E1E'],
    bg: '#FFE6E9',
  },
  crown: {
    Icon: Crown,
    iconColor: '#F59E0B',
    gradient: ['#FCD34D', '#F59E0B'],
    bg: '#FEF3C7',
  },
  trophy: {
    Icon: Trophy,
    iconColor: '#F59E0B',
    gradient: ['#FCD34D', '#F59E0B'],
    bg: '#FEF3C7',
  },
  sad: {
    Icon: Frown,
    iconColor: '#6B7280',
    gradient: ['#9CA3AF', '#4B5563'],
    bg: '#F3F4F6',
  },
};

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AlertConfig | null>(null);
  const [actionSheet, setActionSheet] = useState<ActionSheetConfig | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [scaleAnim] = useState(new Animated.Value(0));
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showAlert = useCallback((cfg: AlertConfig) => {
    setConfig(cfg);
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 8,
      tension: 50,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const hideAlert = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setConfig(null);
    });
  }, [scaleAnim]);

  const showActionSheet = useCallback((cfg: ActionSheetConfig) => {
    setActionSheet(cfg);
  }, []);

  const hideActionSheet = useCallback(() => {
    setActionSheet(null);
  }, []);

  const showToast = useCallback(
    (message: string) => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
      setToastMessage(message);
      toastAnim.setValue(0);
      Animated.timing(toastAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
      toastTimerRef.current = setTimeout(() => {
        Animated.timing(toastAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) setToastMessage(null);
        });
      }, 1800);
    },
    [toastAnim],
  );

  const handleButtonPress = (button: AlertButton) => {
    hideAlert();
    setTimeout(() => button.onPress?.(), 150);
  };

  const typeConfig = config ? TYPE_CONFIG[config.type ?? 'info'] : null;

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert, showToast, showActionSheet, hideActionSheet }}>
      <View style={styles.providerRoot}>
      {children}

      {toastMessage ? (
        <View style={styles.toastHost} pointerEvents="none">
          <Animated.View
            style={[
              styles.toast,
              {
                opacity: toastAnim,
                transform: [
                  {
                    translateY: toastAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <RNText style={styles.toastText}>{toastMessage}</RNText>
          </Animated.View>
        </View>
      ) : null}

      <LuActionSheet
        visible={!!actionSheet}
        config={actionSheet}
        onClose={hideActionSheet}
      />

      <Modal
        visible={!!config}
        transparent
        animationType="fade"
        onRequestClose={hideAlert}
      >
        <Pressable style={styles.overlay} onPress={hideAlert}>
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <Pressable
              style={styles.dialog}
              onPress={(e) => e.stopPropagation()}
            >
              {config && typeConfig && (
                <>
                  {/* Icon Header */}
                  <View style={styles.iconHeader}>
                    <LinearGradient
                      colors={typeConfig.gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.iconCircle}
                    >
                      <typeConfig.Icon
                        size={40}
                        color={colors.white}
                        strokeWidth={2.5}
                      />
                    </LinearGradient>
                  </View>

                  {/* Title */}
                  <Text
                    variant="h3"
                    weight="bold"
                    align="center"
                    style={styles.title}
                  >
                    {config.title}
                  </Text>

                  {/* Message */}
                  {config.message && (
                    <Text
                      variant="bodySmall"
                      color={colors.text.secondary}
                      align="center"
                      style={styles.message}
                    >
                      {config.message}
                    </Text>
                  )}

                  {/* Buttons */}
                  <View style={styles.buttons}>
                    {(config.buttons ?? [{ text: 'موافق' }]).map((btn, idx, arr) => (
                      <Pressable
                        key={idx}
                        onPress={() => handleButtonPress(btn)}
                        style={[
                          styles.button,
                          arr.length === 1 && styles.buttonFullWidth,
                          arr.length > 1 && idx > 0 && { marginStart: spacing.sm },
                          btn.style === 'cancel' && styles.buttonCancel,
                          btn.style === 'destructive' && styles.buttonDestructive,
                        ]}
                      >
                        {btn.style !== 'cancel' && btn.style !== 'destructive' && (
                          <LinearGradient
                            colors={typeConfig.gradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={StyleSheet.absoluteFill}
                          />
                        )}
                        <Text
                          variant="button"
                          weight="bold"
                          color={
                            btn.style === 'cancel'
                              ? colors.text.primary
                              : btn.style === 'destructive'
                              ? colors.white
                              : colors.white
                          }
                        >
                          {btn.text}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
      </View>
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const ctx = useContext(AlertContext);
  if (!ctx) {
    throw new Error('useAlert must be used within AlertProvider');
  }
  return ctx;
};

// Helper functions for common alerts
export const createAlertHelpers = (showAlert: (cfg: AlertConfig) => void) => ({
  success: (title: string, message?: string, onOk?: () => void) =>
    showAlert({
      type: 'success',
      title,
      message,
      buttons: [{ text: 'موافق', onPress: onOk }],
    }),

  error: (title: string, message?: string) =>
    showAlert({
      type: 'error',
      title,
      message,
    }),

  warning: (title: string, message?: string) =>
    showAlert({
      type: 'warning',
      title,
      message,
    }),

  info: (title: string, message?: string) =>
    showAlert({
      type: 'info',
      title,
      message,
    }),

  confirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText: string = 'تأكيد',
    cancelText: string = 'إلغاء',
  ) =>
    showAlert({
      type: 'warning',
      title,
      message,
      buttons: [
        { text: cancelText, style: 'cancel' },
        { text: confirmText, onPress: onConfirm },
      ],
    }),
});

const styles = StyleSheet.create({
  providerRoot: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  dialog: {
    width: Math.min(SCREEN_WIDTH - 40, 320),
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadows.lg,
  },
  iconHeader: {
    marginTop: -spacing.xl * 2,
    marginBottom: spacing.base,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.white,
    ...shadows.md,
  },
  title: {
    marginBottom: spacing.xs,
  },
  message: {
    marginBottom: spacing.base,
    lineHeight: 20,
  },
  buttons: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadows.sm,
  },
  buttonFullWidth: {
    width: '100%',
  },
  buttonCancel: {
    backgroundColor: '#FBEAEA',
  },
  buttonDestructive: {
    backgroundColor: '#EF4444',
  },
  toastHost: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 96,
    paddingHorizontal: spacing.lg,
  },
  toast: {
    backgroundColor: 'rgba(36, 16, 16, 0.92)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    maxWidth: SCREEN_WIDTH - 64,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
});
