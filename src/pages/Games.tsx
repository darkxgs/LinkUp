import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  Gamepad2, Coins, Save, Cloud, Power, TrendingUp, Plus, Minus, Settings2, BarChart3, FlaskConical, X, ExternalLink, RotateCcw, Swords
} from 'lucide-react';
import { Loading, Badge } from '@/components/Common';
import {
  getConfigGames, saveConfigGames, DEFAULT_CONFIG_GAMES, logAdminAction, formatNumber,
  getGameTransactions, timeAgo, getGamesGlobalEconomy, DEFAULT_GAMES_GLOBAL, runWeeklyLotteryDraw,
  DEFAULT_GAMES_SECTIONS,
  normalizeSequenceMemoryTiming,
  type ConfigGame, type AdminTransaction, type GamesGlobalEconomy, type GameSectionId,
  type SequenceMemoryStakeTiming,
} from '@/services/admin';
import {
  WEBVIEW_TEST_GAMES,
  WEBVIEW_CATEGORY_LABELS,
  buildWebviewGameUrl,
  getWebviewUrlForConfigId,
  type WebviewGameCategory,
} from '@/constants/gameWebviewUrls';
import { GAME_MULTIPLIER_HINTS, INTELLIGENCE_GAME_IDS } from '@/constants/gameMultiplierHints';
import {
  isChallengeWebviewGame,
  createDemoChallenge,
  handleChallengeIframeMessage,
  type DemoChallenge,
} from '@/utils/challengeWebviewDemo';

export default function GamesPage() {
  const [tab, setTab] = useState<'control' | 'stats' | 'webview'>('control');
  const [games, setGames] = useState<ConfigGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ConfigGame | null>(null);
  const [savedId, setSavedId] = useState('');
  const [testingGame, setTestingGame] = useState<ConfigGame | null>(null);
  const [webviewTestId, setWebviewTestId] = useState<string | null>(null);
  const [globalEconomy, setGlobalEconomy] = useState<GamesGlobalEconomy>(DEFAULT_GAMES_GLOBAL);
  const [globalSaved, setGlobalSaved] = useState(false);

  const load = async () => {
    setLoading(true);
    let g = await getConfigGames();
    const global = await getGamesGlobalEconomy();
    if (g.length === 0) { g = DEFAULT_CONFIG_GAMES; await saveConfigGames(g, global); }
    g = g.map((game) =>
      game.id === 'sequence-memory'
        ? {
            ...game,
            sequenceTimingByStake: normalizeSequenceMemoryTiming(
              global.intelligenceStakeChips,
              game.sequenceTimingByStake,
              {
                memorizeSeconds: global.sequenceMemoryMemorizeSeconds,
                reconstructSeconds: global.sequenceMemoryReconstructSeconds,
              },
            ),
          }
        : game,
    );
    setGames(g);
    setGlobalEconomy(global);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleEnabled = async (game: ConfigGame) => {
    const updated = games.map((g) => g.id === game.id ? { ...g, enabled: !g.enabled } : g);
    setGames(updated);
    await saveConfigGames(updated, globalEconomy);
    await logAdminAction(game.enabled ? 'تعطيل لعبة' : 'تفعيل لعبة', game.name);
  };

  const CAT_TO_SECTION: Record<string, GameSectionId> = {
    intelligence: 'intelligence',
    casino: 'casino',
    challenge: 'challenges',
    lottery: 'lottery',
  };

  const toggleSection = async (sectionId: GameSectionId) => {
    const enabled = globalEconomy.sections?.[sectionId] !== false;
    const updatedGlobal: GamesGlobalEconomy = {
      ...globalEconomy,
      sections: {
        ...DEFAULT_GAMES_SECTIONS,
        ...globalEconomy.sections,
        [sectionId]: !enabled,
      },
    };
    setGlobalEconomy(updatedGlobal);
    await saveConfigGames(games, updatedGlobal);
    const labels: Record<GameSectionId, string> = {
      challenges: 'التحديات',
      intelligence: 'الذكاء',
      casino: 'الكازينو',
      lottery: 'اليانصيب',
    };
    await logAdminAction(
      !enabled ? 'تفعيل قسم ألعاب' : 'تعطيل قسم ألعاب',
      labels[sectionId],
    );
  };

  const toggleAllGamesInSection = async (gameIds: string[], enable: boolean) => {
    const updated = games.map((g) => (gameIds.includes(g.id) ? { ...g, enabled: enable } : g));
    setGames(updated);
    await saveConfigGames(updated, globalEconomy);
    await logAdminAction(
      enable ? 'تفعيل كل ألعاب القسم' : 'تعطيل كل ألعاب القسم',
      `${gameIds.length} لعبة`,
    );
  };

  const handleSaveGlobalEconomy = async () => {
    await saveConfigGames(games, globalEconomy);
    await logAdminAction('تعديل اقتصاد الألعاب العام', 'النسب والأرباح', `فائز التحدي ${globalEconomy.challengeWinnerPercent}%`);
    setGlobalSaved(true);
    setTimeout(() => setGlobalSaved(false), 1500);
  };

  const handleSaveGame = async (game: ConfigGame) => {
    const normalized: ConfigGame = INTELLIGENCE_GAME_IDS.has(game.id)
      ? {
          ...game,
          minBet: Math.max(5000, game.minBet),
          maxBet: Math.min(50000, Math.max(5000, game.maxBet)),
          multipliers: game.multipliers.length ? game.multipliers : [20],
        }
      : game;
    if (normalized.id === 'sequence-memory') {
      normalized.sequenceTimingByStake = normalizeSequenceMemoryTiming(
        globalEconomy.intelligenceStakeChips,
        normalized.sequenceTimingByStake,
        {
          memorizeSeconds: globalEconomy.sequenceMemoryMemorizeSeconds,
          reconstructSeconds: globalEconomy.sequenceMemoryReconstructSeconds,
        },
      );
    }
    const updated = games.map((g) => (g.id === normalized.id ? normalized : g));
    setGames(updated);
    await saveConfigGames(updated, globalEconomy);
    const timingNote =
      normalized.id === 'sequence-memory' && normalized.sequenceTimingByStake?.length
        ? normalized.sequenceTimingByStake
            .map((t) => `${formatNumber(t.stake)}: ${t.sequenceLength}م · ${t.memorizeSeconds}/${t.reconstructSeconds}ث`)
            .join(' · ')
        : null;
    await logAdminAction(
      'تعديل إعدادات لعبة',
      normalized.name,
      normalized.id === 'sequence-memory' && timingNote
        ? `توقيت حسب الدخولية — ${timingNote}`
        : INTELLIGENCE_GAME_IDS.has(normalized.id)
          ? `مضاعف فوز ×${normalized.multipliers[0]}`
          : `RTP ${normalized.rtp}%`,
    );
    setSavedId(normalized.id);
    setTimeout(() => setSavedId(''), 1500);
    setEditing(null);
  };

  if (loading) return <div className="page-container"><Loading /></div>;

  return (
    <div className="page-container">
      <div className="filters-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success)', fontSize: 13, fontWeight: 600 }}>
          <Cloud size={16} /> مرتبط بالتطبيق — التعديلات تُطبّق فوراً
        </div>
      </div>

      <div className="tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <button className={`tab ${tab === 'control' ? 'active' : ''}`} onClick={() => setTab('control')}>
          <Settings2 size={15} /> التحكم بالألعاب
        </button>
        <button className={`tab ${tab === 'stats' ? 'active' : ''}`} onClick={() => setTab('stats')}>
          <BarChart3 size={15} /> الإحصائيات والأرباح
        </button>
        <button className={`tab ${tab === 'webview' ? 'active' : ''}`} onClick={() => setTab('webview')}>
          <FlaskConical size={15} /> فحص الألعاب (تجريبي)
        </button>
      </div>

      {tab === 'control' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <GamesGlobalEconomyPanel
            economy={globalEconomy}
            onChange={setGlobalEconomy}
            onSave={handleSaveGlobalEconomy}
            onToggleSection={toggleSection}
            saved={globalSaved}
          />

          {[
            {
              id: 'intelligence',
              name: '🧠 ألعاب الذكاء (Intelligence Games)',
              color: '#b00814',
              gameIds: ['flag-guess', 'memory-match', 'sequence-memory'],
            },
            {
              id: 'casino',
              name: '🎰 ألعاب الكازينو (Casino Games)',
              color: '#d21e2a',
              gameIds: [
                'lucky-777', 'crash-rocket', 'plinko', 'dino', 'spin-win', 'mines',
                'dice', 'duck-race', 'rock-paper-scissors', 'hilo', 'limbo',
                'roulette', 'blackjack', 'chicken-cross',
              ],
            },
            {
              id: 'challenge',
              name: '⚔️ ألعاب التحدي (Challenge Games)',
              color: '#EF4444',
              gameIds: ['challenges', 'penalty-kicks', 'coin-challenge', 'pool'],
            },
            {
              id: 'lottery',
              name: '🎟️ اليانصيب (Lottery)',
              color: '#F59E0B',
              gameIds: ['lottery'],
            },
          ].map((cat) => {
            const catGames = games.filter(g => cat.gameIds.includes(g.id));
            if (catGames.length === 0) return null;

            const sectionId = CAT_TO_SECTION[cat.id];
            const sectionEnabled = sectionId
              ? globalEconomy.sections?.[sectionId] !== false
              : true;
            const enabledCount = catGames.filter((g) => g.enabled).length;
            const allGamesEnabled = enabledCount === catGames.length;
            const anyGameEnabled = enabledCount > 0;
            
            return (
              <div key={cat.id} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                  borderBottom: `2px solid ${cat.color}`, 
                  paddingBottom: 10,
                  marginBottom: 4
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{cat.name}</h3>
                    <span style={{ 
                      background: cat.color, 
                      color: '#fff', 
                      fontSize: 11, 
                      fontWeight: 700, 
                      padding: '2px 8px', 
                      borderRadius: 12 
                    }}>
                      {catGames.length} ألعاب
                    </span>
                    {sectionId ? (
                      <Badge variant={sectionEnabled ? 'green' : 'gray'}>
                        {sectionEnabled ? 'القسم ظاهر' : 'القسم مخفي'}
                      </Badge>
                    ) : null}
                    <Badge variant={anyGameEnabled ? 'green' : 'gray'}>
                      {enabledCount}/{catGames.length} مفعّلة
                    </Badge>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    {sectionId ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                          ظهور القسم
                        </span>
                        <EnableSwitch
                          enabled={sectionEnabled}
                          onToggle={() => toggleSection(sectionId)}
                        />
                      </div>
                    ) : null}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                        كل الألعاب
                      </span>
                      <EnableSwitch
                        enabled={allGamesEnabled}
                        onToggle={() => toggleAllGamesInSection(cat.gameIds, !allGamesEnabled)}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => toggleAllGamesInSection(cat.gameIds, true)}
                      disabled={allGamesEnabled}
                    >
                      تفعيل الكل
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => toggleAllGamesInSection(cat.gameIds, false)}
                      disabled={!anyGameEnabled}
                    >
                      تعطيل الكل
                    </button>
                  </div>
                </div>

                {cat.id === 'intelligence' ? (
                  <>
                    <IntelligenceProfitControl
                      games={catGames}
                      stakeChips={globalEconomy.intelligenceStakeChips || DEFAULT_GAMES_GLOBAL.intelligenceStakeChips}
                      onApply={async (mult) => {
                        const updated = games.map((g) =>
                          INTELLIGENCE_GAME_IDS.has(g.id) ? { ...g, multipliers: [mult] } : g,
                        );
                        setGames(updated);
                        await saveConfigGames(updated, globalEconomy);
                        await logAdminAction('تعديل مضاعف ربح ألعاب الذكاء', `×${mult}`, 'كل الألعاب الثلاث');
                      }}
                    />
                  </>
                ) : null}
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                  {catGames.map((game) => (
                    <div key={game.id} className="card" style={{ padding: 18, opacity: game.enabled ? 1 : 0.6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 42, height: 42, borderRadius: 11, background: `${cat.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Gamepad2 size={22} color={cat.color} />
                          </div>
                          <div>
                            <p style={{ fontWeight: 700, fontSize: 15 }}>{game.name}</p>
                            <Badge variant={game.enabled ? 'green' : 'gray'}>
                              {game.enabled ? 'مفعّلة' : 'معطّلة'}
                            </Badge>
                          </div>
                        </div>
                        <EnableSwitch enabled={game.enabled} onToggle={() => toggleEnabled(game)} />
                      </div>

                      {game.id !== 'challenges' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                          <MiniStat label="RTP" value={`${game.rtp}%`} color={game.rtp >= 95 ? '#10B981' : game.rtp >= 90 ? '#F59E0B' : '#EF4444'} />
                          <MiniStat label="أقل رهان" value={formatNumber(game.minBet)} />
                          <MiniStat label="أكثر رهان" value={formatNumber(game.maxBet)} />
                        </div>
                      )}

                      {game.multipliers.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                            {INTELLIGENCE_GAME_IDS.has(game.id) ? 'مضاعف الربح (صافي × الدخولية)' : 'المضاعفات'}
                          </p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {game.multipliers.map((m, i) => (
                              <span key={i} style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--gold-dark)', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                                ×{m}
                              </span>
                            ))}
                          </div>
                          {INTELLIGENCE_GAME_IDS.has(game.id) && (
                            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                              مثال: {formatNumber(game.minBet)} دخولية ← صافي {formatNumber(game.minBet * (game.multipliers[0] || 20))} كوين
                            </p>
                          )}
                        </div>
                      )}

                      {game.id === 'sequence-memory' && game.sequenceTimingByStake?.length ? (
                        <div style={{ marginBottom: 12, padding: '8px 10px', borderRadius: 8, background: 'rgba(59,130,246,0.08)', fontSize: 11 }}>
                          <p style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text-muted)' }}>⏱️ إعدادات حسب الدخولية</p>
                          {game.sequenceTimingByStake.map((t) => (
                            <span key={t.stake} style={{ display: 'inline-block', margin: '2px 4px 2px 0', padding: '2px 6px', borderRadius: 6, background: 'rgba(99,102,241,0.12)', fontWeight: 600 }}>
                              {formatNumber(t.stake)}: {t.sequenceLength} مرب · {t.memorizeSeconds}ث / {t.reconstructSeconds}ث
                            </span>
                          ))}
                        </div>
                      ) : null}

                      <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                        <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center' }}
                          onClick={() => setEditing(game)} disabled={game.id === 'challenges'}>
                          {savedId === game.id ? '✓ تم الحفظ' : 'الإعدادات'}
                        </button>
                        {game.id !== 'challenges' && getWebviewUrlForConfigId(game.id) && (
                          <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center', background: 'linear-gradient(135deg, #e11e2a 0%, #c21520 50%, #ff5a47 100%)', border: 'none', color: '#fff' }}
                            onClick={() => setTestingGame(game)}>
                            تجربة LinkUp 🎮
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : tab === 'stats' ? (
        <GameStats games={games} />
      ) : (
        <WebViewTestHub games={games} onTest={(id) => setWebviewTestId(id)} />
      )}

      {editing && (
        <GameEditor
          game={editing}
          stakeChips={globalEconomy.intelligenceStakeChips || DEFAULT_GAMES_GLOBAL.intelligenceStakeChips}
          globalFallback={{
            memorizeSeconds: globalEconomy.sequenceMemoryMemorizeSeconds,
            reconstructSeconds: globalEconomy.sequenceMemoryReconstructSeconds,
          }}
          onSave={handleSaveGame}
          onClose={() => setEditing(null)}
        />
      )}

      {testingGame && (
        <GameSimulatorModal
          game={testingGame}
          webGame={WEBVIEW_TEST_GAMES.find((g) => g.id === testingGame.id)}
          globalEconomy={globalEconomy}
          onClose={() => setTestingGame(null)}
        />
      )}

      {webviewTestId && (
        <WebViewSimulatorModal
          testGameId={webviewTestId}
          configGames={games}
          globalEconomy={globalEconomy}
          onClose={() => setWebviewTestId(null)}
        />
      )}
    </div>
  );
}

function GamesGlobalEconomyPanel({
  economy,
  onChange,
  onSave,
  onToggleSection,
  saved,
}: {
  economy: GamesGlobalEconomy;
  onChange: (e: GamesGlobalEconomy) => void;
  onSave: () => void;
  onToggleSection: (sectionId: GameSectionId) => void;
  saved: boolean;
}) {
  const setWinner = (v: number) => {
    const winner = Math.min(100, Math.max(50, v));
    onChange({ ...economy, challengeWinnerPercent: winner, challengeAppPercent: 100 - winner });
  };
  const [drawing, setDrawing] = useState(false);

  const handleLotteryDraw = async () => {
    if (!confirm('إجراء سحب اليانصيب الأسبوعي الآن؟ يُختار فائز عشوائياً من تذاكر هذا الأسبوع.')) return;
    setDrawing(true);
    try {
      const result = await runWeeklyLotteryDraw();
      alert(`تم السحب!\n${result.winnerName}\nUID: ${result.winnerUid}\n${formatNumber(result.prize)} كوين — ${result.ticketCount} تذكرة`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'فشل السحب');
    } finally {
      setDrawing(false);
    }
  };

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>⚙️ الاقتصاد العام للألعاب</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            نسب الأرباح والتحويلات — تُطبَّق فوراً على التطبيق وتحديات 1v1
          </p>
        </div>
        <button className="btn btn-primary" onClick={onSave}>
          <Save size={16} /> {saved ? '✓ تم الحفظ' : 'حفظ الإعدادات العامة'}
        </button>
      </div>

      <div style={{ marginBottom: 20 }}>
        <h4 style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>📂 إظهار أقسام الألعاب في التطبيق</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {([
            { id: 'challenges' as GameSectionId, label: '⚔️ التحديات' },
            { id: 'intelligence' as GameSectionId, label: '🧠 الذكاء' },
            { id: 'casino' as GameSectionId, label: '🎰 الكازينو' },
            { id: 'lottery' as GameSectionId, label: '🎟️ اليانصيب' },
          ]).map(({ id, label }) => {
            const enabled = economy.sections?.[id] !== false;
            return (
              <div key={id} className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{label}</span>
                  <Badge variant={enabled ? 'green' : 'gray'}>
                    {enabled ? 'ظاهر في التطبيق' : 'مخفي'}
                  </Badge>
                </div>
                <EnableSwitch enabled={enabled} onToggle={() => onToggleSection(id)} />
              </div>
            );
          })}
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
          التعديل يُطبَّق فوراً على التطبيق — يمكنك أيضاً التحكم من رأس كل قسم أدناه
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        <div className="form-group">
          <label className="form-label">نسبة الفائز في التحديات (%)</label>
          <input className="form-input" type="range" min={50} max={95} value={economy.challengeWinnerPercent}
            onChange={(e) => setWinner(+e.target.value)} />
          <p style={{ textAlign: 'center', fontWeight: 800, color: 'var(--brand-primary)' }}>{economy.challengeWinnerPercent}%</p>
        </div>
        <div className="form-group">
          <label className="form-label">عمولة المنصة من التحديات (%)</label>
          <p style={{ textAlign: 'center', fontWeight: 800, color: 'var(--success)', fontSize: 22 }}>
            {economy.challengeAppPercent}%
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>تُحسب تلقائياً = 100 − نسبة الفائز</p>
        </div>
        <div className="form-group">
          <label className="form-label">سعر تذكرة اليانصيب (كوين)</label>
          <input className="form-input" type="number" value={economy.lotteryTicketPrice}
            onChange={(e) => onChange({ ...economy, lotteryTicketPrice: +e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">الجائزة الكبرى لليانصيب (كوين)</label>
          <input className="form-input" type="number" value={economy.lotteryGrandPrize}
            onChange={(e) => onChange({ ...economy, lotteryGrandPrize: +e.target.value })} />
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            افتراضي: 10,000,000 كوين (= 1000$ عند 10,000 كوين/$)
          </p>
        </div>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">🎟️ سحب اليانصيب الأسبوعي</label>
          <button type="button" className="btn btn-secondary" disabled={drawing} onClick={handleLotteryDraw}>
            {drawing ? 'جاري السحب...' : 'إجراء السحب الأسبوعي الآن'}
          </button>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
            يختار فائزاً عشوائياً من تذاكر الأسبوع الحالي ويمنحه الجائزة الكبرى
          </p>
        </div>
        <div className="form-group">
          <label className="form-label">تحويل 1 كازينو كوين → كوين عادي</label>
          <input className="form-input" type="number" value={economy.casinoToCoinsRate}
            onChange={(e) => onChange({ ...economy, casinoToCoinsRate: +e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">1$ = كم كوين</label>
          <input className="form-input" type="number" value={economy.coinsPerDollar}
            onChange={(e) => onChange({ ...economy, coinsPerDollar: +e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">رصيد التجربة / المحاكي (كوين)</label>
          <input className="form-input" type="number" value={economy.demoBalance}
            onChange={(e) => onChange({ ...economy, demoBalance: +e.target.value })} />
        </div>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">شرائح رهان ألعاب الذكاء (مفصولة بفاصلة)</label>
          <input className="form-input" value={(economy.intelligenceStakeChips || []).join(', ')}
            onChange={(e) => onChange({
              ...economy,
              intelligenceStakeChips: e.target.value.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n > 0),
            })} />
        </div>
        <div className="form-group">
          <label className="form-label">مؤقّت سؤال ألعاب الذكاء (ثانية)</label>
          <input className="form-input" type="number" min={3} max={120}
            value={economy.intelligenceQuestionSeconds ?? 10}
            onChange={(e) => onChange({ ...economy, intelligenceQuestionSeconds: +e.target.value })} />
          <small style={{ color: 'var(--text-secondary, #888)', display: 'block', marginTop: 4 }}>
            زمن الإجابة على كل سؤال في «خمّن العلم»
          </small>
        </div>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <div style={{
            background: 'rgba(225,20,20,0.06)', border: '1px solid rgba(225,20,20,0.25)',
            borderRadius: 8, padding: '10px 12px', fontSize: 13, lineHeight: 1.7,
          }}>
            🔒 <b>القفل اليومي لألعاب الذكاء:</b> مرة واحدة يومياً <b>لكل الألعاب معاً</b> — لعب أي لعبة ذكاء
            يقفل البقية حتى اليوم التالي. يُحتسب اليوم <b>بوقت السيرفر (UTC)</b> وليس ساعة الهاتف،
            والتنفيذ على السيرفر (Cloud Function) فلا يمكن التحايل عليه بتغيير وقت الجهاز.
          </div>
        </div>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">شرائح رهان التحديات 1v1 (مفصولة بفاصلة)</label>
          <input className="form-input" value={(economy.challengeStakeChips || []).join(', ')}
            onChange={(e) => onChange({
              ...economy,
              challengeStakeChips: e.target.value.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n > 0),
            })} />
        </div>
        <div className="form-group">
          <label className="form-label">وقت البلياردو لكل لاعب (ثانية)</label>
          <input className="form-input" type="number" value={Math.round((economy.billiardsTurnMs || 420000) / 1000)}
            onChange={(e) => onChange({ ...economy, billiardsTurnMs: Math.max(60, +e.target.value) * 1000 })} />
        </div>
        <div className="form-group">
          <label className="form-label">جولات الجزاء</label>
          <input className="form-input" type="number" value={economy.penaltyRounds}
            onChange={(e) => onChange({ ...economy, penaltyRounds: +e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">مهلة الجزاء (ثانية)</label>
          <input className="form-input" type="number" value={economy.penaltyTurnSeconds}
            onChange={(e) => onChange({ ...economy, penaltyTurnSeconds: +e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">جولات رمي العملة</label>
          <input className="form-input" type="number" value={economy.coinChallengeRounds}
            onChange={(e) => onChange({ ...economy, coinChallengeRounds: +e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">مهلة رمي العملة (ثانية)</label>
          <input className="form-input" type="number" value={economy.coinChallengeTurnSeconds}
            onChange={(e) => onChange({ ...economy, coinChallengeTurnSeconds: +e.target.value })} />
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: 'var(--bg-app)', borderRadius: 8, padding: '8px 6px', textAlign: 'center' }}>
      <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 700, color: color ?? 'var(--text-primary)' }}>{value}</p>
    </div>
  );
}

function SequenceMemoryTimingTable({
  timing,
  stakeChips,
  globalFallback,
  onChange,
}: {
  timing: SequenceMemoryStakeTiming[];
  stakeChips: number[];
  globalFallback: { memorizeSeconds: number; reconstructSeconds: number };
  onChange: (timing: SequenceMemoryStakeTiming[]) => void;
}) {
  const rows = normalizeSequenceMemoryTiming(stakeChips, timing, globalFallback);

  const updateRow = (
    stake: number,
    field: 'memorizeSeconds' | 'reconstructSeconds' | 'sequenceLength',
    value: number,
  ) => {
    const next = rows.map((row) =>
      row.stake === stake ? { ...row, [field]: value } : row,
    );
    onChange(next);
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={{ textAlign: 'right', padding: '8px 6px', color: 'var(--text-muted)', fontWeight: 600 }}>الدخولية</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: 'var(--text-muted)', fontWeight: 600 }}>المربعات</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: 'var(--text-muted)', fontWeight: 600 }}>حفظ (ث)</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: 'var(--text-muted)', fontWeight: 600 }}>ترتيب (ث)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.stake} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '8px 6px', fontWeight: 700 }}>{formatNumber(row.stake)} كوين</td>
              <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                <input
                  className="form-input"
                  type="number"
                  min={4}
                  max={20}
                  value={row.sequenceLength}
                  onChange={(e) => updateRow(row.stake, 'sequenceLength', +e.target.value)}
                  style={{ width: 72, textAlign: 'center', fontWeight: 700 }}
                />
              </td>
              <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                <input
                  className="form-input"
                  type="number"
                  min={3}
                  max={60}
                  value={row.memorizeSeconds}
                  onChange={(e) => updateRow(row.stake, 'memorizeSeconds', +e.target.value)}
                  style={{ width: 72, textAlign: 'center', fontWeight: 700 }}
                />
              </td>
              <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                <input
                  className="form-input"
                  type="number"
                  min={5}
                  max={180}
                  value={row.reconstructSeconds}
                  onChange={(e) => updateRow(row.stake, 'reconstructSeconds', +e.target.value)}
                  style={{ width: 72, textAlign: 'center', fontWeight: 700 }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IntelligenceProfitControl({
  games,
  stakeChips,
  onApply,
}: {
  games: ConfigGame[];
  stakeChips: number[];
  onApply: (mult: number) => Promise<void>;
}) {
  const currentMult = Math.max(1, Number(games[0]?.multipliers?.[0]) || 20);
  const multsDiffer = games.some((g) => (g.multipliers[0] || 20) !== currentMult);
  const [val, setVal] = useState(currentMult);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const exampleStake = stakeChips[0] ?? 5000;

  useEffect(() => {
    setVal(currentMult);
  }, [currentMult]);

  const handleSave = async () => {
    const mult = Math.max(1, Number(val) || 20);
    setSaving(true);
    try {
      await onApply(mult);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ padding: 16, background: 'linear-gradient(135deg, rgba(176,8,20,0.06) 0%, rgba(245,158,11,0.08) 100%)', border: '1px solid rgba(245,158,11,0.25)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h4 style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>💰 مضاعف ربح ألعاب الذكاء</h4>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 0 }}>
            صافي الربح = <strong>الدخولية × المضاعف</strong>. يُطبَّق على خمّن العلم، الذاكرة، وتسلسل الذاكرة.
          </p>
          {multsDiffer ? (
            <p style={{ fontSize: 12, color: '#F59E0B', marginTop: 8, fontWeight: 600 }}>
              ⚠️ المضاعفات مختلفة بين الألعاب — احفظ لتطبيق قيمة موحّدة على الكل
            </p>
          ) : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 800, fontSize: 22, color: 'var(--gold-dark)' }}>×</span>
            <input
              className="form-input"
              type="number"
              min={1}
              step={0.5}
              value={val}
              onChange={(e) => setVal(+e.target.value)}
              style={{ width: 100, fontWeight: 800, fontSize: 18, textAlign: 'center' }}
            />
          </div>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={handleSave}>
            <Save size={16} /> {saved ? '✓ تم' : saving ? 'جاري الحفظ...' : 'حفظ المضاعف'}
          </button>
        </div>
      </div>
      <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'rgba(16,185,129,0.1)', fontSize: 13 }}>
        مثال: دخولية <strong>{formatNumber(exampleStake)}</strong> كوين ← صافي ربح{' '}
        <strong style={{ color: 'var(--success)' }}>{formatNumber(exampleStake * Math.max(1, Number(val) || 20))}</strong> كوين
        {' '}(إجمالي يُضاف للرصيد: {formatNumber(exampleStake + exampleStake * Math.max(1, Number(val) || 20))} كوين)
      </div>
    </div>
  );
}

function EnableSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={enabled ? 'تعطيل' : 'تفعيل'}
      style={{
        width: 46,
        height: 26,
        borderRadius: 13,
        padding: 3,
        flexShrink: 0,
        border: 'none',
        cursor: 'pointer',
        background: enabled ? 'var(--success)' : 'var(--border)',
        display: 'flex',
        justifyContent: enabled ? 'flex-start' : 'flex-end',
        transition: 'background 0.2s',
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  );
}

function GameEditor({ game, stakeChips, globalFallback, onSave, onClose }: {
  game: ConfigGame;
  stakeChips: number[];
  globalFallback: { memorizeSeconds: number; reconstructSeconds: number };
  onSave: (g: ConfigGame) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ConfigGame>({ ...game, multipliers: [...game.multipliers] });
  const [sequenceTiming, setSequenceTiming] = useState<SequenceMemoryStakeTiming[]>(() =>
    normalizeSequenceMemoryTiming(stakeChips, game.sequenceTimingByStake, globalFallback),
  );

  const updateMult = (i: number, val: number) => {
    const m = [...form.multipliers]; m[i] = val; setForm({ ...form, multipliers: m });
  };
  const addMult = () => setForm({ ...form, multipliers: [...form.multipliers, 2] });
  const removeMult = (i: number) => setForm({ ...form, multipliers: form.multipliers.filter((_, idx) => idx !== i) });

  const hints = GAME_MULTIPLIER_HINTS[form.id] ?? [];
  const isIntelligence = INTELLIGENCE_GAME_IDS.has(form.id);
  const isSequenceMemory = form.id === 'sequence-memory';
  const houseEdge = (100 - form.rtp).toFixed(1);
  const winMult = Math.max(1, Number(form.multipliers[0]) || 20);
  const exampleStake = 5000;
  const exampleWin = exampleStake * winMult;

  const handleSubmit = () => {
    if (isIntelligence) {
      onSave({
        ...form,
        minBet: Math.max(5000, form.minBet),
        maxBet: Math.min(50000, Math.max(5000, form.maxBet)),
        multipliers: [Math.max(1, Number(form.multipliers[0]) || 20)],
        ...(isSequenceMemory
          ? {
              sequenceTimingByStake: normalizeSequenceMemoryTiming(
                stakeChips,
                sequenceTiming,
                globalFallback,
              ),
            }
          : {}),
      });
      return;
    }
    onSave(form);
  };

  const setIntelligenceWinMult = (val: number) => {
    const m = Math.max(1, Number(val) || 1);
    setForm({ ...form, multipliers: [m] });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>تعديل: {form.name}</h3>
          <button className="action-icon" onClick={onClose}><Power size={18} /></button>
        </div>
        <div className="modal-body">
          {/* RTP */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{isIntelligence ? 'هامش ربح المنصة المتوقع (%)' : 'نسبة الإرجاع للاعب RTP (%)'}</span>
              <span style={{ color: 'var(--success)', fontWeight: 700 }}>ربح البيت: {houseEdge}%</span>
            </label>
            <input className="form-input" type="range" min={70} max={99} value={form.rtp}
              onChange={(e) => setForm({ ...form, rtp: +e.target.value })} />
            <div style={{ textAlign: 'center', fontSize: 22, fontWeight: 800, color: 'var(--brand-primary)' }}>
              {form.rtp}%
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
              {isIntelligence
                ? 'ألعاب الذكاء: المضاعف الأول يحدد قيمة الربح. RTP للتخطيط والإحصائيات.'
                : 'كلما قلّت النسبة، زاد ربح المنصة وقلّت فرص الفوز العشوائي'}
            </p>
          </div>

          {/* حدود الرهان */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">أقل رهان</label>
              <input className="form-input" type="number" value={form.minBet}
                onChange={(e) => setForm({ ...form, minBet: +e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">أكثر رهان</label>
              <input className="form-input" type="number" value={form.maxBet}
                onChange={(e) => setForm({ ...form, maxBet: +e.target.value })} />
            </div>
          </div>

          {/* المضاعفات */}
          <div className="form-group">
            {isIntelligence ? (
              <>
                <label className="form-label">مضاعف الصافي (× الدخولية)</label>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                  صافي الربح = الدخولية × المضاعف (مثال: 5,000 × 20 = 100,000 صافي) — يُطبَّق فوراً على التطبيق
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontWeight: 800, fontSize: 22, color: 'var(--gold-dark)' }}>×</span>
                  <input
                    className="form-input"
                    type="number"
                    min={1}
                    step={0.5}
                    value={winMult}
                    onChange={(e) => setIntelligenceWinMult(+e.target.value)}
                    style={{ maxWidth: 120, fontWeight: 800, fontSize: 18 }}
                  />
                </div>
                <div style={{ background: 'rgba(16,185,129,0.1)', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>
                  مثال: دخولية <strong>{exampleStake.toLocaleString()}</strong> كوين ← صافي ربح{' '}
                  <strong style={{ color: 'var(--success)' }}>{exampleWin.toLocaleString()}</strong> كوين
                </div>
              </>
            ) : (
              <>
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  مضاعفات الجوائز
                  <button className="btn btn-ghost btn-sm" onClick={addMult}><Plus size={14} /> إضافة</button>
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {form.multipliers.map((m, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'var(--bg-app)', borderRadius: 8, padding: 6 }}>
                      {hints[i] && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', maxWidth: 90, textAlign: 'center' }}>{hints[i]}</span>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontWeight: 700, color: 'var(--gold-dark)' }}>×</span>
                        <input type="number" step="0.1" value={m} onChange={(e) => updateMult(i, +e.target.value)}
                          style={{ width: 60, border: 'none', background: 'transparent', fontWeight: 700, fontSize: 14, textAlign: 'center', color: 'var(--text-primary)' }} />
                        <button className="action-icon ban" style={{ width: 24, height: 24 }} onClick={() => removeMult(i)}>
                          <Minus size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {isSequenceMemory ? (
            <div className="form-group" style={{ marginTop: 4 }}>
              <label className="form-label">⏱️ إعدادات اللعب حسب الدخولية</label>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                لكل شريحة: <strong>عدد المربعات</strong>، ثواني <strong>«احفظ التسلسل»</strong>، ثم <strong>«أعد الترتيب»</strong>.
              </p>
              <SequenceMemoryTimingTable
                timing={sequenceTiming}
                stakeChips={stakeChips}
                globalFallback={globalFallback}
                onChange={setSequenceTiming}
              />
            </div>
          ) : null}
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={handleSubmit}>
            <Save size={16} /> حفظ ونشر للتطبيق
          </button>
          <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </div>
  );
}

function WebViewTestHub({ games, onTest }: { games: ConfigGame[]; onTest: (id: string) => void }) {
  const categories: WebviewGameCategory[] = ['intelligence', 'casino', 'challenge'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="card" style={{ padding: 16, background: 'rgba(155, 43, 240, 0.08)', border: '1px solid rgba(255, 46, 147, 0.2)' }}>
        <p style={{ fontWeight: 700, marginBottom: 6 }}>فحص ألعاب LinkUp — للاختبار فقط</p>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          الألعاب هنا تعمل برصيد تجريبي داخل لوحة التحكم ولا تؤثر على محافظ المستخدمين.
          ألعاب التحدي 1v1 بنفس واجهة التطبيق في بيئة فحص محلية.
          التطبيق يستخدم نفس روابط الاستضافة مع الإعدادات الحقيقية.
        </p>
      </div>

      {categories.map((cat) => {
        const items = WEBVIEW_TEST_GAMES.filter((g) => g.category === cat);
        return (
          <div key={cat}>
            <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>{WEBVIEW_CATEGORY_LABELS[cat]}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {items.map((item) => {
                const cfg = games.find((g) => g.id === item.id);
                const url = buildWebviewGameUrl(item);
                return (
                  <div key={item.id} className="card" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 15 }}>{item.name}</p>
                        {cfg && (
                          <Badge variant={cfg.enabled ? 'green' : 'gray'}>
                            {cfg.enabled ? 'مفعّلة بالتطبيق' : 'معطّلة بالتطبيق'}
                          </Badge>
                        )}
                      </div>
                      <a href={url} target="_blank" rel="noreferrer" className="action-icon" title="فتح الرابط مباشرة">
                        <ExternalLink size={16} />
                      </a>
                    </div>
                    {item.note && (
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{item.note}</p>
                    )}
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', wordBreak: 'break-all', marginBottom: 12, fontFamily: 'monospace' }}>
                      {url}
                    </p>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #e11e2a 0%, #c21520 50%, #ff5a47 100%)', border: 'none' }}
                      onClick={() => onTest(item.id)}
                    >
                      <FlaskConical size={14} /> فتح فحص اللعبة
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GameStats({ games }: { games: ConfigGame[] }) {
  const [txs, setTxs] = useState<AdminTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGameTransactions().then((t) => { setTxs(t); setLoading(false); });
  }, []);

  if (loading) return <Loading />;

  // حساب الربح/الخسارة لكل لعبة
  const byGame = games.map((g) => {
    const gameTxs = txs.filter((t: any) => t.gameId === g.id || t.itemName?.includes(g.name));
    const totalBet = gameTxs.reduce((s, t: any) => s + (t.stake ?? 0), 0);
    const totalWin = gameTxs.reduce((s, t: any) => s + (t.winAmount ?? 0), 0);
    const profit = totalBet - totalWin;
    return { ...g, totalBet, totalWin, profit, plays: gameTxs.length };
  });

  return (
    <div className="card">
      <table className="data-table">
        <thead>
          <tr>
            <th>اللعبة</th><th>عدد اللعبات</th><th>إجمالي الرهان</th><th>إجمالي الجوائز</th><th>ربح المنصة</th>
          </tr>
        </thead>
        <tbody>
          {byGame.map((g) => (
            <tr key={g.id}>
              <td style={{ fontWeight: 700 }}>{g.name}</td>
              <td>{formatNumber(g.plays)}</td>
              <td>{formatNumber(g.totalBet)}</td>
              <td>{formatNumber(g.totalWin)}</td>
              <td style={{ color: g.profit >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                {g.profit >= 0 ? '+' : ''}{formatNumber(g.profit)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface GameSimulatorModalProps {
  game: ConfigGame;
  webGame?: import('@/constants/gameWebviewUrls').WebviewTestGame;
  globalEconomy: GamesGlobalEconomy;
  onClose: () => void;
}

function GameSimulatorModal({ game, webGame, globalEconomy, onClose }: GameSimulatorModalProps) {
  const isChallenge = isChallengeWebviewGame(game.id);
  const [demoBalance, setDemoBalance] = useState(globalEconomy.demoBalance ?? 50000);
  const [logs, setLogs] = useState<string[]>([]);
  const [demoChallenge, setDemoChallenge] = useState<DemoChallenge>(() => createDemoChallenge(game.id, globalEconomy));
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const demoChallengeRef = useRef(demoChallenge);
  const initSentRef = useRef(false);
  demoChallengeRef.current = demoChallenge;

  const baseUrl = webGame ? buildWebviewGameUrl(webGame) : getWebviewUrlForConfigId(game.id);
  /** ثابت بين الـ re-renders — تغيير src كان يسبب reload متكرر وتقطيع */
  const gameUrl = useMemo(() => {
    if (!baseUrl) return '';
    const sep = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${sep}demo=1&cb=${iframeKey}`;
  }, [baseUrl, iframeKey]);

  useEffect(() => {
    initSentRef.current = false;
  }, [iframeKey]);

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 24)]);
  }, []);

  const postToIframe = useCallback((data: object) => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify(data), '*');
  }, []);

  const setChallengeState = useCallback((c: DemoChallenge) => {
    demoChallengeRef.current = c;
    setDemoChallenge(c);
  }, []);

  const resetChallenge = () => {
    const fresh = createDemoChallenge(game.id, globalEconomy);
    setChallengeState(fresh);
    setLogs([]);
    setIframeKey((k) => k + 1);
    initSentRef.current = false;
    addLog('إعادة تشغيل التحدي من البداية');
  };

  const sendInitToIframe = useCallback(() => {
    if (initSentRef.current) return;
    initSentRef.current = true;
    if (isChallenge) {
      const bet = demoChallengeRef.current.bet;
      addLog(`تهيئة تحدي 1v1 — أنت اللاعب الأول (خصم دخولية الرهان: -${bet} كوين)`);
      setDemoBalance((prev) => prev - bet);
      postToIframe({
        type: 'INIT_DATA',
        challenge: demoChallengeRef.current,
        role: 'challenger',
        myRole: 'challenger',
        global: globalEconomy,
      });
    } else {
      addLog('تهيئة اللعبة (INIT_GAME)');
      postToIframe({
        type: 'INIT_DATA',
        balance: demoBalance,
        hasPlayedToday: false,
        config: game,
        global: globalEconomy,
      });
    }
  }, [isChallenge, addLog, postToIframe, demoBalance, game, globalEconomy]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (iframeRef.current?.contentWindow && event.source !== iframeRef.current.contentWindow) return;
      try {
        const data = JSON.parse(event.data as string);

        if (isChallenge) {
          if (data.type === 'INIT_GAME') {
            sendInitToIframe();
          }
          handleChallengeIframeMessage(data, game.id, {
            getChallenge: () => demoChallengeRef.current,
            setChallenge: setChallengeState,
            postToIframe,
            addLog,
            setDemoBalance,
          });
          return;
        }

        if (data.type === 'INIT_GAME') {
          sendInitToIframe();
        } else if (data.type === 'PLACE_BET') {
          const stake = Number(data.stake);
          addLog(`طلب رهان فحص: ${stake} كوين`);
          if (demoBalance < stake) {
            postToIframe({ type: 'ERROR', message: 'الرصيد الافتراضي غير كافٍ!' });
          } else {
            setDemoBalance((prev) => prev - stake);
            postToIframe({ type: 'BET_CONFIRMED', status: 'success' });
          }
        } else if (data.type === 'GAME_RESULT') {
          const win = Number(data.winAmount);
          const isWin = Boolean(data.isWin);
          addLog(`النتيجة: ${isWin ? `فوز +${win}` : 'خسارة الرهان'}`);
          if (isWin && win > 0) setDemoBalance((prev) => prev + win);
          postToIframe({ type: 'RESULT_RECORDED', status: 'success' });
        }
      } catch {
        /* تجاهل رسائل غير JSON */
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [demoBalance, game, isChallenge, addLog, postToIframe, setChallengeState, sendInitToIframe]);

  useEffect(() => {
    if (!isChallenge) {
      postToIframe({ type: 'UPDATE_BALANCE', balance: demoBalance });
    }
  }, [demoBalance, isChallenge, postToIframe]);

  const penaltyState = isChallenge && game.id === 'penalty-kicks' ? demoChallenge.gameState : null;
  const coinState = isChallenge && game.id === 'coin-challenge' ? demoChallenge.gameState : null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={onClose}>
      <div className="modal" style={{ maxWidth: 860, width: '95%', height: '90vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>{isChallenge ? '⚔️' : '🧪'} فحص LinkUp: {game.name}</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {isChallenge
                ? 'تحدي 1v1 — بيئة فحص LinkUp (لا تؤثر على الأرصدة الحقيقية)'
                : 'رصيد تجريبي — لا يؤثر على أرصدة التطبيق الحقيقية'}
            </p>
          </div>
          <button className="action-icon" onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
        </div>
        <div className="modal-body" style={{ flex: 1, display: 'flex', gap: 16, padding: 16, overflow: 'hidden' }}>
          <div style={{ flex: 1, background: '#000', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', position: 'relative', minHeight: 420 }}>
            {gameUrl ? (
              <iframe
                key={iframeKey}
                ref={iframeRef}
                src={gameUrl}
                onLoad={sendInitToIframe}
                style={{ width: '100%', height: '100%', border: 'none' }}
                title={game.name}
                allow="autoplay"
              />
            ) : (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                رابط اللعبة غير متاح
              </div>
            )}
          </div>

          <div style={{ width: 290, display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--bg-app)', borderRadius: 12, padding: 16, overflow: 'hidden' }}>
            {isChallenge ? (
              <>
                <div style={{ padding: 10, borderRadius: 10, background: 'rgba(155, 43, 240, 0.1)', border: '1px solid rgba(155, 43, 240, 0.22)' }}>
                  <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Swords size={14} /> أنت: اللاعب الأول
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>اللاعب الثاني: {demoChallenge.challengedName}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>رهان الفحص: {demoChallenge.bet.toLocaleString()} كوين</p>
                </div>

                {penaltyState && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <MiniStat label="نتيجتك" value={String(penaltyState.challengerScore ?? 0)} color="#10B981" />
                    <MiniStat label="اللاعب الثاني" value={String(penaltyState.opponentScore ?? 0)} color="#e11e2a" />
                    <MiniStat label="الجولة" value={`${penaltyState.round ?? 1}/5`} />
                    <MiniStat label="المرحلة" value={penaltyState.phase === 'goalkeeping' ? 'تصدي' : 'تسديد'} />
                  </div>
                )}

                {coinState && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <MiniStat
                      label="نقاطك"
                      value={String((coinState.roundResults as string[] | undefined)?.filter((r) => r === 'challenger').length ?? 0)}
                      color="#10B981"
                    />
                    <MiniStat
                      label="نقاط اللاعب الثاني"
                      value={String((coinState.roundResults as string[] | undefined)?.filter((r) => r === 'opponent').length ?? 0)}
                      color="#EF4444"
                    />
                    <MiniStat label="الجولة" value={`${coinState.round ?? 1}/3`} />
                    <MiniStat label="الحالة" value={demoChallenge.status === 'completed' ? 'انتهت' : 'نشطة'} />
                  </div>
                )}

                {game.id === 'pool' && (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    اسحب ووجّه الضربة على الطاولة. أفرغ الكرات قبل اللاعب الثاني للفوز.
                  </p>
                )}

                <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={resetChallenge}>
                  <RotateCcw size={14} /> إعادة التحدي
                </button>
              </>
            ) : (
              <div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>الرصيد التجريبي للفحص</p>
                <p style={{ fontSize: 24, fontWeight: 900, color: 'var(--gold-dark)' }}>
                  {demoBalance.toLocaleString()} <span style={{ fontSize: 13, fontWeight: 500 }}>كوين</span>
                </p>
                <button className="btn btn-secondary btn-sm" style={{ width: '100%', marginTop: 8 }} onClick={() => setDemoBalance(globalEconomy.demoBalance ?? 50000)}>
                  إعادة شحن الرصيد (50k)
                </button>
              </div>
            )}

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>سجل الأحداث:</p>
              <div style={{ flex: 1, background: '#000', borderRadius: 8, padding: 10, fontFamily: 'monospace', fontSize: 11, color: '#10B981', overflowY: 'auto' }}>
                {logs.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)' }}>بانتظار بدء اللعبة...</p>
                ) : (
                  logs.map((log, i) => <p key={i} style={{ marginBottom: 4 }}>{log}</p>)
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WebViewSimulatorModal({
  testGameId,
  configGames,
  globalEconomy,
  onClose,
}: {
  testGameId: string;
  configGames: ConfigGame[];
  globalEconomy: GamesGlobalEconomy;
  onClose: () => void;
}) {
  const webGame = WEBVIEW_TEST_GAMES.find((g) => g.id === testGameId);
  const configGame = configGames.find((g) => g.id === testGameId);
  const syntheticGame: ConfigGame = configGame ?? {
    id: testGameId,
    name: webGame?.name ?? testGameId,
    enabled: true,
    minBet: 100,
    maxBet: 100_000,
    rtp: 95,
    multipliers: INTELLIGENCE_GAME_IDS.has(testGameId) ? [20] : [2],
  };

  if (!webGame) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-body">
            <p>لا يوجد رابط WebView لهذه اللعبة.</p>
            <button className="btn btn-ghost" onClick={onClose}>إغلاق</button>
          </div>
        </div>
      </div>
    );
  }

  return <GameSimulatorModal game={syntheticGame} webGame={webGame} globalEconomy={globalEconomy} onClose={onClose} />;
}
