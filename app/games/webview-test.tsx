import React, { useState, useRef } from 'react';
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { ChevronRight } from '@/components/ui/RtlIcons';
import { 
  Grid3x3, 
  Dices, 
  CircleDot, 
  Coins, 
  Sparkles, 
  Flame, 
  Flag,
  Brain,
  RefreshCw 
} from 'lucide-react-native';
import { colors, radius, spacing, shadows } from '@/theme';
import { Text } from '@/components/ui';

interface TestGame {
  id: string;
  name: string;
  url: string;
  Icon: any;
  color: string;
}

const TEST_GAMES: TestGame[] = [
  {
    id: 'xo',
    name: 'لعبة XO الشهيرة',
    url: 'https://linkup-dc45f.web.app/games/xo/',
    Icon: Grid3x3,
    color: '#E11414'
  },
  {
    id: 'dice',
    name: 'نرد ثلاثي الأبعاد 3D',
    url: 'https://linkup-dc45f.web.app/games/dice/',
    Icon: Dices,
    color: '#10B981'
  },
  {
    id: 'wheel',
    name: 'عجلة الحظ التفاعلية',
    url: 'https://linkup-dc45f.web.app/games/wheel/',
    Icon: CircleDot,
    color: '#F59E0B'
  },
  {
    id: 'coin',
    name: 'رمي العملة 3D',
    url: 'https://linkup-dc45f.web.app/games/coin/',
    Icon: Coins,
    color: '#C61414'
  },
  {
    id: 'slot',
    name: 'ماكينة لاكي 777',
    url: 'https://linkup-dc45f.web.app/games/slot/',
    Icon: Sparkles,
    color: '#E11414'
  },
  {
    id: 'crash',
    name: 'الصاروخ الحماسي Crash',
    url: 'https://linkup-dc45f.web.app/games/crash/',
    Icon: Flame,
    color: '#F97316'
  },
  {
    id: 'flag-guess',
    name: 'خمن العلم أو المشهد',
    url: 'https://linkup-dc45f.web.app/games/flag-guess/',
    Icon: Flag,
    color: '#ED4444'
  },
  {
    id: 'memory-match',
    name: 'تطابق الأشكال Memory Match',
    url: 'https://linkup-dc45f.web.app/games/memory-match/',
    Icon: Grid3x3,
    color: '#E11414'
  },
  {
    id: 'sequence-memory',
    name: 'تذكر التسلسل Sequence Memory',
    url: 'https://linkup-dc45f.web.app/games/sequence-memory/',
    Icon: Brain,
    color: '#E11414'
  }
];

export default function WebViewTestScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [selectedGame, setSelectedGame] = useState<TestGame>(TEST_GAMES[0]!);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setIsLoading(true);
    setRefreshKey(prev => prev + 1);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ChevronRight size={24} color="#FFFFFF" />
        </Pressable>
        <View style={styles.titleContainer}>
          <Text variant="h3" weight="bold" color="#FFFFFF">منصة فحص الألعاب 🧪</Text>
          <Text variant="caption" color="rgba(255,255,255,0.6)">اختبر تشغيل ألعاب الـ WebView واحدة بواحدة</Text>
        </View>
        <Pressable onPress={handleRefresh} style={styles.refreshButton}>
          <RefreshCw size={18} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Horizontal Tabs for Game Selection */}
      <View style={styles.tabContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {TEST_GAMES.map((game) => {
            const isSelected = game.id === selectedGame.id;
            return (
              <Pressable
                key={game.id}
                onPress={() => {
                  setSelectedGame(game);
                  setIsLoading(true);
                }}
                style={[
                  styles.tabCard,
                  isSelected && {
                    backgroundColor: game.color,
                    borderColor: game.color,
                    ...shadows.md
                  }
                ]}
              >
                <game.Icon size={16} color={isSelected ? '#FFFFFF' : game.color} />
                <Text 
                  variant="caption" 
                  weight="bold" 
                  color={isSelected ? '#FFFFFF' : colors.text.secondary}
                  style={{ marginStart: 6 }}
                >
                  {game.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* WebView Container */}
      <View style={styles.webviewContainer}>
        <WebView
          key={`${selectedGame.id}-${refreshKey}`}
          source={{ uri: selectedGame.url }}
          domStorageEnabled={true}
          javaScriptEnabled={true}
          allowsInlineMediaPlayback={true}
          scrollEnabled={false}
          bounces={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          androidLayerType="hardware"
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
          style={styles.webview}
        />

        {/* Loading Overlay */}
        {isLoading && (
          <View style={StyleSheet.absoluteFillObject}>
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={selectedGame.color} />
              <Text variant="caption" color="rgba(255,255,255,0.7)" style={{ marginTop: 12, fontWeight: '700' }}>
                جاري تحميل {selectedGame.name} ميديا وأصوات...
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#100406',
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginStart: spacing.sm,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainer: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#1A0A0C',
  },
  scrollContent: {
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
    flexDirection: 'row',
  },
  tabCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  webviewContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000000',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: '#100406',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
