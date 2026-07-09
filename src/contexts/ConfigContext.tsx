/**
 * ConfigProvider — يوفّر إعدادات التطبيق القابلة للتحكم من الأدمن
 * بشكل real-time لكل الشاشات.
 *
 * الاستخدام:
 *   const { gifts, vipTiers, rechargePackages, settings } = useConfig();
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { InteractionManager } from 'react-native';
import { Image } from 'expo-image';
import {
  subscribeToGifts,
  subscribeToGiftCategories,
  subscribeToVipTiers,
  subscribeToRechargePackages,
  subscribeToRechargePackageTags,
  subscribeToSettings,
  DEFAULT_VIP_TIERS,
  DEFAULT_RECHARGE_PACKAGES,
  DEFAULT_RECHARGE_PACKAGE_TAGS,
  DEFAULT_SETTINGS,
  type VipTier,
  type RechargePackage,
  type RechargePackageTag,
  type AppSettings,
} from '@/services/firebase/config';
import {
  subscribeToVipSystem,
  DEFAULT_VIP_SYSTEM,
  type VipSystemConfig,
} from '@/services/firebase/vipSystem';
import { GIFTS_CATALOG, setCachedGiftCommission, type Gift, type GiftCategoryConfig } from '@/services/firebase/shop';
import {
  subscribeToGamesConfig,
  subscribeToGamesGlobal,
  DEFAULT_GAMES,
  DEFAULT_GAMES_GLOBAL,
  type GameConfig,
  type GamesGlobalEconomy,
} from '@/services/firebase/gamesConfig';
import {
  subscribeToCallPricing,
  DEFAULT_CALL_PRICING,
  type CallPricingConfig,
} from '@/services/firebase/callPricingConfig';
import {
  subscribeToChatBackgrounds,
  type ChatBackground,
} from '@/services/firebase/chatBackgroundConfig';
import { DEFAULT_CHAT_BACKGROUNDS } from '@/constants/chatBackgrounds';
import {
  subscribeToRewardsCenter,
  DEFAULT_REWARDS_CENTER,
  type RewardsCenterConfig,
} from '@/services/firebase/rewardsCenter';
import {
  subscribeToAristocracy,
  DEFAULT_ARISTOCRACY_CONFIG,
  type AristocracyConfig,
} from '@/services/firebase/aristocracySystem';
import {
  subscribeToTitles,
  DEFAULT_TITLES_CONFIG,
  type TitlesConfig,
} from '@/services/firebase/titleSystem';
import {
  subscribeToPrivacyConfig,
  DEFAULT_PRIVACY_SYSTEM_CONFIG,
  type PrivacySystemConfig,
} from '@/services/firebase/privacySettings';
import {
  subscribeToHostTasks,
  DEFAULT_HOST_TASKS,
  type HostTasksConfig,
} from '@/services/firebase/hostTasks';
import {
  subscribeToAboutPages,
  DEFAULT_ABOUT_PAGES,
  type AboutPagesConfig,
} from '@/services/firebase/aboutPages';
import {
  subscribeToAppRelease,
  DEFAULT_APP_RELEASE,
  type AppReleaseConfig,
} from '@/services/firebase/appRelease';
import {
  subscribeToRoomThroneConfig,
  DEFAULT_ROOM_THRONE_CONFIG,
  type RoomThroneConfig,
} from '@/services/firebase/roomThroneConfig';
import {
  subscribeToSecondHostMicConfig,
  DEFAULT_SECOND_HOST_MIC_CONFIG,
  type SecondHostMicConfig,
} from '@/services/firebase/secondHostMicConfig';
import {
  subscribeToAgencyPrince,
  DEFAULT_AGENCY_PRINCE_CONFIG,
  type AgencyPrinceConfig,
} from '@/services/firebase/agencyPrinceSystem';
import {
  subscribeToRoomReactionsConfig,
  DEFAULT_ROOM_REACTIONS_CONFIG,
  type RoomReactionsConfig,
} from '@/services/firebase/roomReactionsConfig';

interface ConfigContextValue {
  gifts: Gift[];
  giftCategories: GiftCategoryConfig[];
  vipTiers: VipTier[];
  vipSystem: VipSystemConfig;
  rechargePackages: RechargePackage[];
  rechargePackageTags: RechargePackageTag[];
  settings: AppSettings;
  games: GameConfig[];
  gamesGlobal: GamesGlobalEconomy;
  callPricing: CallPricingConfig;
  chatBackgrounds: ChatBackground[];
  rewardsCenter: RewardsCenterConfig;
  aristocracy: AristocracyConfig;
  titles: TitlesConfig;
  privacy: PrivacySystemConfig;
  hostTasks: HostTasksConfig;
  aboutPages: AboutPagesConfig;
  appRelease: AppReleaseConfig;
  roomThrone: RoomThroneConfig;
  secondHostMic: SecondHostMicConfig;
  agencyPrince: AgencyPrinceConfig;
  roomReactions: RoomReactionsConfig;
  loading: boolean;
}

const ConfigContext = createContext<ConfigContextValue>({
  gifts: GIFTS_CATALOG,
  giftCategories: [],
  vipTiers: DEFAULT_VIP_TIERS,
  vipSystem: DEFAULT_VIP_SYSTEM,
  rechargePackages: DEFAULT_RECHARGE_PACKAGES,
  rechargePackageTags: DEFAULT_RECHARGE_PACKAGE_TAGS,
  settings: DEFAULT_SETTINGS,
  games: DEFAULT_GAMES,
  gamesGlobal: DEFAULT_GAMES_GLOBAL,
  callPricing: DEFAULT_CALL_PRICING,
  chatBackgrounds: DEFAULT_CHAT_BACKGROUNDS,
  rewardsCenter: DEFAULT_REWARDS_CENTER,
  aristocracy: DEFAULT_ARISTOCRACY_CONFIG,
  titles: DEFAULT_TITLES_CONFIG,
  privacy: DEFAULT_PRIVACY_SYSTEM_CONFIG,
  hostTasks: DEFAULT_HOST_TASKS,
  aboutPages: DEFAULT_ABOUT_PAGES,
  appRelease: DEFAULT_APP_RELEASE,
  roomThrone: DEFAULT_ROOM_THRONE_CONFIG,
  secondHostMic: DEFAULT_SECOND_HOST_MIC_CONFIG,
  agencyPrince: DEFAULT_AGENCY_PRINCE_CONFIG,
  roomReactions: DEFAULT_ROOM_REACTIONS_CONFIG,
  loading: true,
});

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [gifts, setGifts] = useState<Gift[]>(GIFTS_CATALOG);
  const [giftCategories, setGiftCategories] = useState<GiftCategoryConfig[]>([]);
  const [vipTiers, setVipTiers] = useState<VipTier[]>(DEFAULT_VIP_TIERS);
  const [vipSystem, setVipSystem] = useState<VipSystemConfig>(DEFAULT_VIP_SYSTEM);
  const [rechargePackages, setRechargePackages] = useState<RechargePackage[]>(DEFAULT_RECHARGE_PACKAGES);
  const [rechargePackageTags, setRechargePackageTags] = useState<RechargePackageTag[]>(DEFAULT_RECHARGE_PACKAGE_TAGS);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [games, setGames] = useState<GameConfig[]>(DEFAULT_GAMES);
  const [gamesGlobal, setGamesGlobal] = useState<GamesGlobalEconomy>(DEFAULT_GAMES_GLOBAL);
  const [callPricing, setCallPricing] = useState<CallPricingConfig>(DEFAULT_CALL_PRICING);
  const [chatBackgrounds, setChatBackgrounds] = useState<ChatBackground[]>(DEFAULT_CHAT_BACKGROUNDS);
  const [rewardsCenter, setRewardsCenter] = useState<RewardsCenterConfig>(DEFAULT_REWARDS_CENTER);
  const [aristocracy, setAristocracy] = useState<AristocracyConfig>(DEFAULT_ARISTOCRACY_CONFIG);
  const [titles, setTitles] = useState<TitlesConfig>(DEFAULT_TITLES_CONFIG);
  const [privacy, setPrivacy] = useState<PrivacySystemConfig>(DEFAULT_PRIVACY_SYSTEM_CONFIG);
  const [hostTasks, setHostTasks] = useState<HostTasksConfig>(DEFAULT_HOST_TASKS);
  const [aboutPages, setAboutPages] = useState<AboutPagesConfig>(DEFAULT_ABOUT_PAGES);
  const [appRelease, setAppRelease] = useState<AppReleaseConfig>(DEFAULT_APP_RELEASE);
  const [roomThrone, setRoomThrone] = useState<RoomThroneConfig>(DEFAULT_ROOM_THRONE_CONFIG);
  const [secondHostMic, setSecondHostMic] = useState<SecondHostMicConfig>(DEFAULT_SECOND_HOST_MIC_CONFIG);
  const [agencyPrince, setAgencyPrince] = useState<AgencyPrinceConfig>(DEFAULT_AGENCY_PRINCE_CONFIG);
  const [roomReactions, setRoomReactions] = useState<RoomReactionsConfig>(DEFAULT_ROOM_REACTIONS_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ⚡ اشتراكات حرجة فقط عند الإقلاع (الظاهرة في التبويبات الرئيسية):
    //    الهدايا/الإعدادات/شارات VIP. الباقي خاص بشاشات محدّدة (ألعاب/محفظة/
    //    مكافآت/ألقاب…) فنؤجّله بعد ظهور أول شاشة حتى لا يتزاحم 19 listener دفعة
    //    واحدة على الشبكة الضعيفة ويبطّئ التصفّح الأول. كلها لها قيم افتراضية.
    const criticalUnsubs = [
      subscribeToGifts((g) => { setGifts(g); setLoading(false); }),
      subscribeToSettings(setSettings),
      subscribeToVipTiers(setVipTiers),
      subscribeToVipSystem(setVipSystem),
      subscribeToCallPricing(setCallPricing),
    ];

    // ⚡ لا نُبقي شاشة التحميل عالقة لو تأخّرت/انقطعت الشبكة — نكمل بالقيم الافتراضية
    //    بعد 3 ثوانٍ (الاشتراكات تُحدّث القيم لاحقاً عند وصولها).
    const loadingTimeout = setTimeout(() => setLoading(false), 3000);

    let deferredUnsubs: Array<() => void> = [];
    const handle = InteractionManager.runAfterInteractions(() => {
      deferredUnsubs = [
        subscribeToGiftCategories(setGiftCategories),
        subscribeToRechargePackages(setRechargePackages),
        subscribeToRechargePackageTags(setRechargePackageTags),
        subscribeToGamesConfig(setGames),
        subscribeToGamesGlobal(setGamesGlobal),
        subscribeToChatBackgrounds(setChatBackgrounds),
        subscribeToRewardsCenter(setRewardsCenter),
        subscribeToAristocracy(setAristocracy),
        subscribeToTitles(setTitles),
        subscribeToPrivacyConfig(setPrivacy),
        subscribeToHostTasks(setHostTasks),
        subscribeToAboutPages(setAboutPages),
        subscribeToAppRelease(setAppRelease),
        subscribeToRoomThroneConfig(setRoomThrone),
        subscribeToSecondHostMicConfig(setSecondHostMic),
        subscribeToAgencyPrince(setAgencyPrince),
        subscribeToRoomReactionsConfig(setRoomReactions),
      ];
    });

    return () => {
      clearTimeout(loadingTimeout);
      handle.cancel?.();
      criticalUnsubs.forEach((u) => u());
      deferredUnsubs.forEach((u) => u());
    };
  }, []);

  // ⚡ تحميل مسبق لصور الهدايا (thumbnails) إلى كاش القرص بمجرد وصولها من لوحة التحكم.
  //    النتيجة: شاشة الهدايا تفتح وتُعرض فوراً بلا تقطيع أو تأخير في أي مكان (روم/محادثة)
  //    حتى على الإنترنت الضعيف، لأن الصور تكون جاهزة قبل فتح الموديل.
  useEffect(() => {
    if (!gifts.length) return;
    const urls = gifts
      .map((g) => g.imageUrl?.trim() || g.animationUrl?.trim())
      .filter((u): u is string => Boolean(u));
    if (!urls.length) return;
    // ⚡ أجّل التحميل المسبق بعد استقرار أول إطار حتى لا يزاحم الإقلاع على I/O/الشبكة
    const t = setTimeout(() => {
      void Image.prefetch(urls, { cachePolicy: 'memory-disk' });
    }, 2000);
    return () => clearTimeout(t);
  }, [gifts]);

  // ⚡ تغذية كاش عمولة الهدايا في طبقة الخدمة حتى يُرسل buyAndSendGift فوراً
  //    دون جلب config/settings عند كل إرسال.
  useEffect(() => {
    setCachedGiftCommission(settings.giftCommission);
  }, [settings.giftCommission]);

  // ⚡ تثبيت قيمة الـ Provider بـ useMemo حتى لا يُعاد رسم كل مستهلكي useConfig
  //    إلا عند تغيّر حقل فعلاً (كان كائناً جديداً بالمرجع في كل رسم).
  const value = useMemo(
    () => ({ gifts, giftCategories, vipTiers, vipSystem, rechargePackages, rechargePackageTags, settings, games, gamesGlobal, callPricing, chatBackgrounds, rewardsCenter, aristocracy, titles, privacy, hostTasks, aboutPages, appRelease, roomThrone, secondHostMic, agencyPrince, roomReactions, loading }),
    [gifts, giftCategories, vipTiers, vipSystem, rechargePackages, rechargePackageTags, settings, games, gamesGlobal, callPricing, chatBackgrounds, rewardsCenter, aristocracy, titles, privacy, hostTasks, aboutPages, appRelease, roomThrone, secondHostMic, agencyPrince, roomReactions, loading],
  );

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => useContext(ConfigContext);
