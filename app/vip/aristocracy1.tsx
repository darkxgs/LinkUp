/**
 * LinkUp App — Aristocracy Screen
 * نظام الأرستقراطية بمستويات 1-10 — أعلى تكريم
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    View,
    StyleSheet,
    ScrollView,
    Pressable,
    Alert,
    Dimensions,
    GestureResponderEvent,
    Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, Sparkles, Star, Award, TrendingUp, Lock, Coins, Check, Flame, Diamond, Gem } from 'lucide-react-native';
import { ChevronLeft } from '@/components/ui/RtlIcons';
import i18n from '@/localization/i18n';

import { Text, Card } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useConfig } from '@/contexts/ConfigContext';
import { purchaseAristocracy } from '@/services/firebase/aristocracySystem';
import { colors, radius, spacing, shadows } from '@/theme';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    withRepeat,
    withSequence,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AristocracyLevel {
    level: number;
    name: string;
    cost: number;
    duration: number; // days
    colors: [string, string];
    unlocks: string[];
    Icon: any;
}

const LEVELS: AristocracyLevel[] = [
    { level: 1, name: i18n.t('vip.text73132'), cost: 50, duration: 30, colors: ['#94A3B8', '#64748B'], Icon: Award, unlocks: ['شارة كونت الأرستقراطية المميزة', 'إطار كونت الفضي حول الصورة الشخصية', 'أولوية دعم العملاء العادية', 'مضاعف خبرة +5% لجميع الأنشطة'] },
    { level: 2, name: i18n.t('vip.text87289'), cost: 100, duration: 30, colors: ['#FCA5A5', '#E11414'], Icon: Award, unlocks: ['كل مزايا المستوى 1', 'إطار فيكونت الأرجواني الفاخر', 'تأثير دخول خاص عند الانضمام للغرف', 'أولوية متوسطة لدعم العملاء'] },
    { level: 3, name: i18n.t('vip.text16686'), cost: 200, duration: 30, colors: ['#E11414', '#B00E0E'], Icon: Crown, unlocks: ['كل مزايا المستوى 2', 'شارة بارون البراقة بالدردشات', 'أولوية خاصة في قوائم ترتيب الغرف', 'هدية ترحيبية خاصة عند الترقية (500 كوين)'] },
    { level: 4, name: i18n.t('vip.text73706'), cost: 500, duration: 30, colors: ['#E11414', '#8A0E0E'], Icon: Crown, unlocks: ['كل مزايا المستوى 3', 'لقب فخري حصري بجانب الاسم', 'إطار مركيز الماسي حول الصورة', 'تأثير دخول مهيب للغرف الصوتية'] },
    { level: 5, name: i18n.t('vip.text87259'), cost: 1000, duration: 30, colors: ['#E11414', '#8A0E0E'], Icon: Diamond, unlocks: ['كل مزايا المستوى 4', 'صلاحية بدء بث صوتي/مرئي خاص', 'مضاعف نقاط خبرة (XP) أعلى بنسبة +20%', 'فقاعة دردشة ذهبية للرسائل'] },
    { level: 6, name: i18n.t('vip.text54886'), cost: 2000, duration: 30, colors: ['#E11414', '#8A0E0E'], Icon: Diamond, unlocks: ['كل مزايا المستوى 5', 'فقاعة دردشة الأمير الفاخرة الملونة', 'تأثير دخول ملكي خاص يعلن عن هبوطك', 'شارة أمير أسطورية لامعة'] },
    { level: 7, name: i18n.t('vip.text64658'), cost: 5000, duration: 30, colors: ['#F59E0B', '#D97706'], Icon: Crown, unlocks: ['كل مزايا المستوى 6', 'إعلان دخول عريض في نظام الغرف الصوتي', 'بطاقة هوية مخصصة ومطورة', 'حزمة هدايا شهرية مجانية للمشتركين'] },
    { level: 8, name: i18n.t('vip.text26137'), cost: 10000, duration: 30, colors: ['#EF4444', '#B91C1C'], Icon: Crown, unlocks: ['كل مزايا المستوى 7', 'تأثير دخول زلزالي يهز أرجان الغرفة الصوتية', 'شارة الملك الملكية باللون الذهبي البراق', 'حصانة جزئية ضد الكتم من مدراء الغرف'] },
    { level: 9, name: i18n.t('vip.text11660'), cost: 20000, duration: 30, colors: ['#F59E0B', '#EF4444'], Icon: Crown, unlocks: ['كل مزايا المستوى 8', 'دعم فني وتنسيقي مخصص 24/7 على مدار الساعة', 'باقة هدايا الإمبراطور الحصرية الفاخرة شهرياً', 'إمكانية إخفاء التواجد بالكامل عن الغرف'] },
    { level: 10, name: i18n.t('vip.text60477'), cost: 50000, duration: 30, colors: ['#FCD34D', '#F59E0B'], Icon: Sparkles, unlocks: ['كل المزايا والامتيازات بدون قيود', 'حصانة مطلقة وكاملة ضد الطرد أو الكتم في الغرف', 'تأثير دخول إلهي أسطوري يلفت انتباه الجميع', 'مكافآت يومية مجانية مطورة ومضاعف XP أقصى'] },
];

const PRIVILEGES = [
    { Icon: Award, label: i18n.t('vip.text42554'), color: '#F59E0B', bg: '#FEF3C7' },
    { Icon: Sparkles, label: i18n.t('vip.text93737'), color: '#E11414', bg: '#FFE6E9' },
    { Icon: Crown, label: i18n.t('vip.text51591'), color: '#E11414', bg: '#FEE2E2' },
    { Icon: Diamond, label: i18n.t('vip.text7260'), color: '#E11414', bg: '#FEE2E2' },
    { Icon: Gem, label: i18n.t('vip.text68414'), color: '#E11414', bg: '#FEE2E2' },
    { Icon: TrendingUp, label: i18n.t('vip.text83036'), color: '#10B981', bg: '#D1FAE5' },
    { Icon: Star, label: i18n.t('vip.text83918'), color: '#F59E0B', bg: '#FEF3C7' },
    { Icon: Flame, label: i18n.t('vip.text43545'), color: '#EF4444', bg: '#FEE2E2' },
];

function AnimatedPressable({
    children,
    onPress,
    style,
    scaleTo = 0.95,
    duration = 80,
    disabled = false,
    onLongPress,
    hitSlop,
}: {
    children: React.ReactNode;
    onPress?: (event: GestureResponderEvent) => void;
    style?: any;
    scaleTo?: number;
    duration?: number;
    disabled?: boolean;
    onLongPress?: () => void;
    hitSlop?: any;
}) {
    const scale = useSharedValue(1);
    const animStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <Pressable
            onPress={onPress}
            onPressIn={() => {
                if (!disabled) scale.value = withTiming(scaleTo, { duration });
            }}
            onPressOut={() => {
                if (!disabled) scale.value = withSpring(1.0);
            }}
            style={style}
            disabled={disabled}
            onLongPress={onLongPress}
            hitSlop={hitSlop}
        >
            <Animated.View style={[{ flex: style?.flex }, animStyle]}>
                {children}
            </Animated.View>
        </Pressable>
    );
}

export default function AristocracyScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user, refreshUser } = useAuth();
    const { aristocracy: config } = useConfig();
    const [selectedLevel, setSelectedLevel] = useState(5);
    const [purchasing, setPurchasing] = useState(false);

    const tier = LEVELS[selectedLevel - 1]!;

    const buttonShadowStyle = {
        shadowColor: tier.colors[1],
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.85,
        shadowRadius: 20,
        elevation: 10,
        borderRadius: 999,
    };

    const dynamicFilledGlow = {
        shadowColor: tier.colors[1],
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
        elevation: 6,
    };

    const dynamicOutlineGlow = {
        shadowColor: tier.colors[1],
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
        elevation: 4,
        borderColor: `${tier.colors[1]}30`,
        borderWidth: 1.2,
        backgroundColor: 'rgba(16, 4, 6, 0.85)',
        borderRadius: 24,
    };

    const handlePurchase = () => {
        const dbLevel = config.levels?.find(l => l.level === tier.level);
        if (!dbLevel) {
            Alert.alert(t('common.error'), 'Level not found in server config');
            return;
        }

        const myCoins = user?.stats?.coins ?? 0;
        if (myCoins < tier.cost) {
            Alert.alert(
                t('vip.mysteryInsufficientTitle', 'رصيد غير كافٍ'),
                t('vip.mysteryInsufficient', { needed: tier.cost, have: myCoins })
            );
            return;
        }

        Alert.alert(
            t('vip.text89760'),
            `الترقية إلى "${tier.name}" بسعر ${tier.cost} عملة لمدة ${tier.duration} يوم؟`,
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.confirm'),
                    onPress: async () => {
                        setPurchasing(true);
                        try {
                            await purchaseAristocracy(dbLevel.id);
                            await refreshUser?.();
                            Alert.alert(t('common.success', 'نجاح'), t('vip.text35234', `أصبحت ${tier.name} الآن`));
                        } catch (e: any) {
                            Alert.alert(t('common.error', 'خطأ'), e.message);
                        } finally {
                            setPurchasing(false);
                        }
                    },
                },
            ],
        );
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#100406', '#1A0A0C', '#100406']}
                style={StyleSheet.absoluteFill}
            />

            <ScrollView
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingTop: insets.top + spacing.base, paddingBottom: insets.bottom + 140 },
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.headerContainer}>
                    <View style={styles.header}>
                        <AnimatedPressable
                            onPress={() => router.back()}
                            style={styles.iconButton}
                            scaleTo={0.9}
                        >
                            <ChevronLeft size={24} color={colors.white} />
                        </AnimatedPressable>
                        <View style={styles.titleContainer}>
                            <Crown size={20} color="#FFFFFF" fill="#FFFFFF" strokeWidth={0} />
                            <Text variant="h3" weight="bold" color={colors.white}>
                                {t('profile.aristocracy')}
                            </Text>
                        </View>
                        <View style={{ width: 40 }} />
                    </View>
                    <Text variant="caption" color="rgba(255, 255, 255, 0.7)" align="center" style={styles.headerSubtitle}>
                        ارتق بمستواك، واستفد من مزايا حصرية
                    </Text>
                </View>

                {/* Big crown display */}
                <View style={styles.crownDisplay}>
                    <View style={styles.badgeImageContainer}>
                        <Image
                            source={require('../../assets/images/vip-badge-main.png')}
                            style={styles.mainBadgeImage}
                            resizeMode="contain"
                        />
                    </View>

                    {/* Level pill overlay */}
                    <View style={styles.badgePill}>
                        <Text variant="caption" weight="bold" color="rgba(255, 255, 255, 0.9)">
                            المستوى {tier.level} • 24 ميزة
                        </Text>
                    </View>
                </View>

                {/* Content section */}
                <View style={styles.contentSection}>
                    {/* Level selector */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.levelsScroll}
                    >
                        {LEVELS.map((l) => {
                            const isSelected = selectedLevel === l.level;
                            return (
                                <AnimatedPressable
                                    key={l.level}
                                    onPress={() => setSelectedLevel(l.level)}
                                    scaleTo={0.93}
                                    style={{ width: 76 }}
                                >
                                    <View
                                        style={[
                                            styles.levelChip,
                                            isSelected && { borderColor: l.colors[1], borderWidth: 1.5, backgroundColor: `${l.colors[1]}20` }
                                        ]}
                                    >
                                        <View style={styles.levelChipIconBg}>
                                            <LinearGradient
                                                colors={l.colors}
                                                style={StyleSheet.absoluteFill}
                                            />
                                            <l.Icon size={18} color={colors.white} strokeWidth={2} />
                                        </View>
                                        <Text
                                            variant="caption"
                                            weight={isSelected ? 'bold' : 'medium'}
                                            color={isSelected ? colors.white : 'rgba(255, 255, 255, 0.5)'}
                                            style={{ fontSize: 10 }}
                                        >
                                            LV{l.level}
                                        </Text>
                                        <Text
                                            variant="caption"
                                            weight={isSelected ? 'semibold' : 'medium'}
                                            color={isSelected ? colors.white : 'rgba(255, 255, 255, 0.5)'}
                                            numberOfLines={1}
                                            style={{ fontSize: 11, maxWidth: 60 }}
                                        >
                                            {l.name}
                                        </Text>
                                    </View>
                                </AnimatedPressable>
                            );
                        })}
                    </ScrollView>

                    {/* Description Card */}
                    <Card variant="elevated" style={[styles.descCard, dynamicOutlineGlow]}>
                        <View style={styles.descLeftContent}>
                            <View style={styles.descCardHeaderRow}>
                                <View style={[styles.descIconBg, { backgroundColor: `${tier.colors[1]}20` }]}>
                                    <Sparkles size={16} color={tier.colors[0]} strokeWidth={2.5} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text variant="caption" weight="medium" color="rgba(255, 255, 255, 0.5)">
                                        اختر المستوى (1-10)
                                    </Text>
                                    <Text variant="bodyLarge" weight="bold" color={colors.white}>
                                        وصف الترقية
                                    </Text>
                                </View>
                            </View>
                            <Text variant="body" color="rgba(255, 255, 255, 0.85)" style={styles.descText}>
                                {t(`vip.descLevel${tier.level}`)}
                            </Text>
                        </View>
                        <View style={styles.descRightContent}>
                            <Image
                                source={require('../../assets/images/vip-crown.png')}
                                style={styles.descCrownImage}
                                resizeMode="contain"
                            />
                        </View>
                    </Card>

                    {/* Price card */}
                    <Card variant="elevated" style={[styles.priceCard, dynamicOutlineGlow]}>
                        <View style={styles.priceContent}>
                            <View style={styles.priceLeft}>
                                <Text variant="caption" color="rgba(255,255,255,0.5)">
                                    السعر
                                </Text>
                                <View style={styles.priceRow}>
                                    <Coins size={22} color={tier.colors[0]} strokeWidth={2.5} />
                                    <Text variant="display2" weight="bold" color={colors.white}>
                                        {tier.cost.toLocaleString()}
                                    </Text>
                                </View>
                                <Text variant="caption" color="rgba(255,255,255,0.5)">
                                    لمدة {tier.duration} يوم
                                </Text>
                            </View>
                            <View style={[styles.priceBadge, { backgroundColor: `${tier.colors[1]}20`, borderColor: `${tier.colors[1]}40`, borderWidth: 1 }]}>
                                <Crown size={30} color={colors.white} strokeWidth={2} />
                            </View>
                        </View>
                    </Card>

                    {/* Unlocks Card */}
                    {tier.unlocks && tier.unlocks.length > 0 && (
                        <Card variant="elevated" style={[styles.unlocksCard, dynamicOutlineGlow]}>
                            {tier.unlocks.map((unlock, idx) => (
                                <View key={idx} style={[styles.unlockRow, idx < tier.unlocks.length - 1 && styles.unlockRowBorder]}>
                                    <View style={[styles.checkIcon, { backgroundColor: `${tier.colors[1]}20` }]}>
                                        <Check size={14} color={tier.colors[0]} strokeWidth={3} />
                                    </View>
                                    <Text variant="body" color="rgba(255, 255, 255, 0.9)" style={{ flex: 1, marginStart: spacing.sm }}>
                                        {unlock}
                                    </Text>
                                </View>
                            ))}
                        </Card>
                    )}

                    {/* Privileges Grid */}
                    <View style={styles.featuresHeaderContainer}>
                        <View style={styles.diamondDivider} />
                        <Text variant="label" weight="bold" color="rgba(255, 255, 255, 0.7)">
                            ♦ مزايا المستوى ♦
                        </Text>
                        <View style={styles.diamondDivider} />
                    </View>

                    <View style={styles.privilegesGrid}>
                        {PRIVILEGES.map((p, idx) => (
                            <AnimatedPressable
                                key={idx}
                                scaleTo={0.96}
                                style={{ width: (SCREEN_WIDTH - spacing.base * 2 - spacing.sm * 3) / 4 }}
                            >
                                <View style={styles.privilegeCard}>
                                    <View style={[styles.privilegeIconBg, { backgroundColor: `${tier.colors[1]}15`, borderColor: `${tier.colors[1]}30`, borderWidth: 1 }]}>
                                        <p.Icon size={20} color={p.color} strokeWidth={2} />
                                    </View>
                                    <Text variant="caption" weight="semibold" align="center" color="rgba(255, 255, 255, 0.9)" style={{ fontSize: 11 }}>
                                        {p.label}
                                    </Text>
                                </View>
                            </AnimatedPressable>
                        ))}
                    </View>

                    {/* Stats Dashboard */}
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text variant="h3" weight="bold" color={tier.colors[0]}>
                                10
                            </Text>
                            <Text variant="caption" color="rgba(255, 255, 255, 0.5)">
                                {t('vip.text19520')}
                            </Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text variant="h3" weight="bold" color={tier.colors[1]}>
                                24
                            </Text>
                            <Text variant="caption" color="rgba(255, 255, 255, 0.5)">
                                {t('vip.text76239')}
                            </Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text variant="h3" weight="bold" color="#E11414">
                                30
                            </Text>
                            <Text variant="caption" color="rgba(255, 255, 255, 0.5)">
                                {t('common.day')}
                            </Text>
                        </View>
                    </View>
                </View>
            </ScrollView>

            {/* Bottom button */}
            <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.sm }]}>
                <AnimatedPressable
                    onPress={handlePurchase}
                    style={{ flex: 1 }}
                    scaleTo={0.96}
                    disabled={purchasing}
                >
                    <View style={[buttonShadowStyle, purchasing && { opacity: 0.7 }]}>
                        <View style={styles.purchaseBtn}>
                            <LinearGradient
                                colors={tier.colors}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={StyleSheet.absoluteFill}
                            />
                            <Crown size={20} color={colors.white} strokeWidth={2} />
                            <Text variant="button" color={colors.white} weight="bold">
                                {purchasing ? t('common.loading', 'جاري...') : `ترقية إلى المستوى ${tier.level}`}
                            </Text>
                            {!purchasing && (
                                <View style={styles.purchaseBtnPrice}>
                                    <Coins size={12} color="#FFE082" strokeWidth={2.5} />
                                    <Text variant="caption" color="#FFE082" weight="bold" style={{ fontSize: 12 }}>
                                        {tier.cost.toLocaleString()}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                </AnimatedPressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#100406' },
    scrollContent: { paddingHorizontal: 0 },
    headerContainer: {
        paddingHorizontal: spacing.base,
        paddingBottom: spacing.base,
        width: '100%',
        alignItems: 'center',
    },
    headerSubtitle: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.65)',
        marginTop: 4,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: spacing.xs,
    },
    iconButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },

    // Crown display
    crownDisplay: {
        alignItems: 'center',
        paddingHorizontal: spacing.base,
        paddingBottom: spacing.xl,
        position: 'relative',
        marginTop: spacing.md,
    },
    badgeImageContainer: {
        width: 230,
        height: 230,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        marginTop: spacing.xs,
    },
    mainBadgeImage: {
        width: 220,
        height: 220,
    },
    badgePill: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderColor: 'rgba(255,255,255,0.15)',
        borderWidth: 1,
        paddingHorizontal: spacing.lg,
        paddingVertical: 5,
        borderRadius: radius.full,
        marginTop: spacing.base,
    },

    // Content section
    contentSection: {
        paddingHorizontal: spacing.base,
        marginTop: spacing.sm,
    },

    // Levels selection
    levelsScroll: {
        gap: spacing.sm,
        paddingVertical: spacing.xs,
        paddingBottom: spacing.lg,
    },
    levelChip: {
        alignItems: 'center',
        gap: 2,
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.base,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 20,
        borderWidth: 1.2,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    levelChipIconBg: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        marginBottom: 2,
    },

    // Description Card
    descCard: {
        flexDirection: 'row',
        padding: 22,
        borderRadius: 24,
        marginBottom: spacing.lg,
        minHeight: 145,
    },
    descLeftContent: {
        flex: 1.3,
        gap: spacing.sm,
        justifyContent: 'center',
    },
    descRightContent: {
        flex: 0.7,
        justifyContent: 'center',
        alignItems: 'center',
    },
    descCrownImage: {
        width: 115,
        height: 115,
    },
    descCardHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    descIconBg: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    descText: {
        lineHeight: 20,
        color: 'rgba(255, 255, 255, 0.85)',
        fontSize: 13,
        textAlign: 'right',
    },

    // Price Card
    priceCard: {
        padding: 0,
        overflow: 'hidden',
        marginBottom: spacing.lg,
        borderRadius: 24,
    },
    priceContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 22,
    },
    priceLeft: { gap: 4 },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    priceBadge: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Unlocks
    unlocksCard: {
        padding: 0,
        overflow: 'hidden',
        marginBottom: spacing.lg,
        borderRadius: 24,
    },
    unlockRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.base,
        paddingHorizontal: 22,
    },
    unlockRowBorder: {
        borderBottomWidth: 0.5,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    checkIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Features title divider
    featuresHeaderContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.base,
        marginVertical: spacing.lg,
    },
    diamondDivider: {
        width: 24,
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },

    // Privileges Grid
    privilegesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    privilegeCard: {
        aspectRatio: 0.95,
        backgroundColor: 'rgba(26, 10, 12, 0.45)',
        borderWidth: 1.2,
        borderColor: 'rgba(225, 20, 20, 0.2)',
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.sm,
        gap: 6,
        height: '100%',
    },
    privilegeIconBg: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Stats Dashboard
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingVertical: spacing.base,
        backgroundColor: 'rgba(26, 10, 12, 0.45)',
        borderWidth: 1.2,
        borderColor: 'rgba(225, 20, 20, 0.2)',
        borderRadius: radius.lg,
        marginBottom: spacing.lg,
    },
    statItem: {
        alignItems: 'center',
        gap: 2,
    },
    statDivider: {
        width: 1,
        height: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },

    // Bottom checkouts
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(10, 4, 5, 0.85)',
        padding: spacing.base,
        borderTopWidth: 1,
        borderTopColor: 'rgba(225, 20, 20, 0.15)',
    },
    purchaseBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.base,
        borderRadius: 999,
        overflow: 'hidden',
        borderWidth: 1.2,
        borderColor: 'rgba(255, 255, 255, 0.45)',
    },
    purchaseBtnPrice: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        backgroundColor: 'rgba(0,0,0,0.3)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radius.full,
    },
});