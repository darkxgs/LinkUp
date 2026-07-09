import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
    Card,
    Button,
    Space,
    Tag,
    Tooltip,
    Typography,
    message,
    Switch,
    Modal,
    Drawer,
    Statistic,
    Row,
    Col,
    Divider,
    Radio,
    Progress,
    Input
} from 'antd'
import {
    SettingOutlined,
    ExpandOutlined,
    BarChartOutlined,
    AppstoreOutlined,
    SafetyCertificateOutlined,
    SoundOutlined,
    FullscreenOutlined,
    FullscreenExitOutlined,
    TrophyOutlined,
    FireOutlined,
    ThunderboltOutlined,
    CheckCircleOutlined,
    CopyOutlined,
    SyncOutlined,
    RightOutlined,
    StarOutlined,
    LineChartOutlined,
    CloseOutlined,
    ReloadOutlined
} from '@ant-design/icons'
import Chart from 'chart.js/auto'
import BettingPanel from './BettingPanel'
import GameChart from './GameChart'
import GameHistory from './GameHistory'
import PlayerBets from './PlayerBets'
import PlayerResults from './PlayerResults'
import ProvablyFair from '../utils/ProvablyFair'
import { AudioManager } from '../utils/AudioManager'
import { CurrencyIcon, CasinoIcon, currencyName, CURRENCY_SYMBOL } from '../../config/currency'
import { t } from '../../i18n/casinoI18n.js'
import { useLinkUpWallet } from '../../bridge/useLinkUpWallet'
import './CrashGame.css'

const { Text, Title, Paragraph } = Typography

// Game phases
const PHASE = {
    WAITING: 'waiting',
    RUNNING: 'running',
    CRASHED: 'crashed'
}

function CrashGame() {
    const { balance, casinoCoins, avatar, ready, gameConfig, placeBet: bridgePlaceBet, cancelBet: bridgeCancelBet, recordResult } = useLinkUpWallet();
    const placeBet = useCallback(async (amount) => {
        await bridgePlaceBet(amount);
    }, [bridgePlaceBet]);
    const cancelBet = useCallback(async (amount) => {
        await bridgeCancelBet(amount);
    }, [bridgeCancelBet]);

    const minBet = Math.max(1, Number(gameConfig?.minBet) || 100);
    const maxBet = Math.max(minBet, Number(gameConfig?.maxBet) || 100000);
    const betPresets = useMemo(() => {
        const candidates = [minBet, minBet * 5, minBet * 10, minBet * 50, maxBet];
        const unique = [];
        candidates.forEach((v) => {
            const n = Math.min(maxBet, Math.max(minBet, Math.floor(v)));
            if (!unique.includes(n)) unique.push(n);
        });
        return unique.slice(0, 4);
    }, [minBet, maxBet]);

    const showToast = useCallback((type, title, description) => {
        const text = description ? `${title} — ${description}` : title;
        message[type === 'error' ? 'error' : 'success'](text);
    }, []);
    const [phase, setPhase] = useState(PHASE.WAITING)
    const [multiplier, setMultiplier] = useState(1.00)
    const [countdown, setCountdown] = useState(5)
    const [crashPoint, setCrashPoint] = useState(0)
    const [elapsedTime, setElapsedTime] = useState(0)
    const [history, setHistory] = useState([
        3.21, 1.47, 2.89, 5.84, 169.00, 1.06, 9.47, 5.75, 1.43, 1.22,
        4.77, 1.31, 2.15, 8.34, 1.89, 3.67, 12.45, 1.02, 6.23, 1.78,
        2.44, 4.12, 1.56, 7.89, 2.33
    ])
    const [betPlaced, setBetPlaced] = useState(false)
    const [betAmount, setBetAmount] = useState(0)
    const [userBetData, setUserBetData] = useState(null)
    /** الجولة تعمل فقط بعد رهان يدوي — لا عدّاد تلقائي ولا جولات متتابعة */
    const [roundActive, setRoundActive] = useState(false)
    const [soundEnabled, setSoundEnabled] = useState(true)

    // Audio Manager
    const audioManagerRef = useRef(null);
    useEffect(() => {
        audioManagerRef.current = new AudioManager();
    }, []);
    useEffect(() => {
        if (audioManagerRef.current) {
            audioManagerRef.current.enabled = soundEnabled;
        }
    }, [soundEnabled]);

    // Settings for optional features
    const [showPlayerBets, setShowPlayerBets] = useState(true)
    const [showPlayerResults, setShowPlayerResults] = useState(true)
    const [playerCashouts, setPlayerCashouts] = useState([])

    // UI States
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [statsDrawerOpen, setStatsDrawerOpen] = useState(false)
    const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false)
    const [fairnessModalOpen, setFairnessModalOpen] = useState(false)
    const [layout, setLayout] = useState('default') // 'default', 'compact', 'wide'

    // History and Stats logic
    const [gameRecords, setGameRecords] = useState([])
    const widgetRef = useRef(null)
    const chartCanvasRef = useRef(null)
    const chartInstanceRef = useRef(null)
    const [hoveredProfitValue, setHoveredProfitValue] = useState(null)

    // Derived Stats
    const totalProfit = useMemo(() => gameRecords.reduce((sum, r) => sum + r.profit, 0), [gameRecords])
    const winsCount = useMemo(() => gameRecords.filter(r => r.profit >= 0).length, [gameRecords])
    const lossesCount = useMemo(() => gameRecords.filter(r => r.profit < 0).length, [gameRecords])
    const maxStreak = useMemo(() => {
        let max = 0
        let current = 0
        for (const record of gameRecords) {
            if (record.profit >= 0) {
                current++
                if (current > max) max = current
            } else {
                current = 0
            }
        }
        return max
    }, [gameRecords])

    // Provably Fair state
    const fairnessRef = useRef(null)
    const [fairnessData, setFairnessData] = useState({
        serverSeedHash: 'Loading...',
        clientSeed: 'Loading...',
        nonce: 0,
    })
    const [revealedSeed, setRevealedSeed] = useState(null)
    const [clientSeedInput, setClientSeedInput] = useState('')

    // Initialize ProvablyFair
    useEffect(() => {
        const pf = new ProvablyFair()
        fairnessRef.current = pf
        pf.waitReady().then(async () => {
            const data = await pf.getFairnessData()
            setFairnessData(data)
            setClientSeedInput(data.clientSeed)
        })
    }, [])

    const startTimeRef = useRef(null)
    const animationRef = useRef(null)
    const gameDisplayRef = useRef(null)
    // Performance: use refs for high-frequency values, throttle React state updates
    const multiplierRef = useRef(1.00)
    const elapsedTimeRef = useRef(0)
    const lastStateUpdateRef = useRef(0)
    const [messageApi, contextHolder] = message.useMessage()

    // Calculate statistics
    const stats = {
        totalGames: history.length,
        avgMultiplier: (history.reduce((a, b) => a + b, 0) / history.length).toFixed(2),
        maxMultiplier: Math.max(...history).toFixed(2),
        under2x: history.filter(x => x < 2).length,
        over2x: history.filter(x => x >= 2 && x < 10).length,
        over10x: history.filter(x => x >= 10).length,
        over100x: history.filter(x => x >= 100).length
    }

    // Fullscreen toggle
    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            if (gameDisplayRef.current) {
                gameDisplayRef.current.requestFullscreen().then(() => {
                    setIsFullscreen(true)
                    messageApi.success('Entered fullscreen mode')
                }).catch(err => {
                    messageApi.error('Could not enter fullscreen')
                })
            }
        } else {
            document.exitFullscreen().then(() => {
                setIsFullscreen(false)
                messageApi.info('Exited fullscreen mode')
            })
        }
    }, [messageApi])

    // Listen for fullscreen changes
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement)
        }
        document.addEventListener('fullscreenchange', handleFullscreenChange)
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }, [])

    // Draggable Live Stats logic
    const handleDragStart = useCallback((e) => {
        const widget = widgetRef.current
        if (!widget) return

        const startX = e.clientX
        const startY = e.clientY
        const rect = widget.getBoundingClientRect()
        const offsetX = startX - rect.left
        const offsetY = startY - rect.top

        const handleMouseMove = (moveEvent) => {
            let newX = moveEvent.clientX - offsetX
            let newY = moveEvent.clientY - offsetY

            newX = Math.max(0, Math.min(newX, window.innerWidth - rect.width))
            newY = Math.max(0, Math.min(newY, window.innerHeight - rect.height))

            widget.style.left = `${newX}px`
            widget.style.top = `${newY}px`
            widget.style.right = 'auto'
            widget.style.bottom = 'auto'
        }

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
    }, [])

    // Live Stats Chart Update
    useEffect(() => {
        if (!statsDrawerOpen || !chartCanvasRef.current) return

        const WIN_COLOR = 'rgb(74, 222, 128)';
        const WIN_COLOR_FILL = 'rgba(74, 222, 128, 0.3)';
        const LOSS_COLOR = 'rgb(248, 113, 113)';
        const LOSS_COLOR_FILL = 'rgba(248, 113, 113, 0.3)';
        const X_AXIS_COLOR = '#2a3f4d';
        const POINT_HOVER_COLOR = '#fff';

        let runProfit = 0;
        const profitHistory = [0, ...gameRecords.map(r => {
            runProfit += r.profit;
            return runProfit;
        })];

        if (chartInstanceRef.current) {
            // Update existing chart
            chartInstanceRef.current.data.labels = Array(profitHistory.length).fill(0);
            chartInstanceRef.current.data.datasets[0].data = profitHistory;
            chartInstanceRef.current.update('none'); // Update without animation for smooth flow
        } else {
            // Initialize new chart
            chartInstanceRef.current = new Chart(chartCanvasRef.current, {
                type: 'line',
                data: {
                    labels: Array(profitHistory.length).fill(0),
                    datasets: [
                        {
                            label: 'Profit',
                            data: profitHistory,
                            fill: {
                                target: 'origin',
                                above: WIN_COLOR_FILL,
                                below: LOSS_COLOR_FILL,
                            },
                            cubicInterpolationMode: 'monotone',
                            segment: {
                                borderColor: (ctx) => {
                                    if (!ctx.p0 || !ctx.p1) return WIN_COLOR;
                                    const y0 = ctx.p0.parsed.y;
                                    const y1 = ctx.p1.parsed.y;
                                    if (y1 === 0) {
                                        return y0 < 0 ? LOSS_COLOR : WIN_COLOR;
                                    }
                                    return y1 < 0 ? LOSS_COLOR : WIN_COLOR;
                                },
                            },
                            pointRadius: 0,
                            pointHoverRadius: 5,
                            pointHoverBackgroundColor: POINT_HOVER_COLOR,
                            pointHoverBorderColor: POINT_HOVER_COLOR,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animations: {
                        y: {
                            duration: 0,
                        },
                    },
                    interaction: {
                        intersect: false,
                        mode: 'index',
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: { enabled: false },
                    },
                    scales: {
                        x: {
                            border: { display: false },
                            grid: { display: false },
                            ticks: { display: false },
                        },
                        y: {
                            border: { display: false },
                            grid: {
                                color: (ctx) => (ctx.tick.value === 0 ? X_AXIS_COLOR : 'transparent'),
                                lineWidth: 2,
                            },
                            ticks: { display: false },
                            grace: '1%',
                        },
                    },
                    onHover: (_, elements) => {
                        if (elements.length) {
                            const idx = elements[0].index;
                            const val = profitHistory[idx];
                            setHoveredProfitValue(val !== undefined ? val : null);
                        } else {
                            setHoveredProfitValue(null);
                        }
                    },
                },
            });
        }
    }, [statsDrawerOpen, gameRecords]);

    // Generate crash point using ProvablyFair
    const generateCrashPoint = useCallback(async () => {
        const pf = fairnessRef.current
        if (!pf) return 2.00 // Fallback
        const point = await pf.generateCrashPoint()
        // Update fairness data for UI
        const data = await pf.getFairnessData()
        setFairnessData(data)
        return point
    }, [])

    // Handle crash
    const handleCrash = useCallback((crashMultiplier) => {
        setHistory(prev => [crashMultiplier, ...prev].slice(0, 30))

        let profit = 0;
        let didPlay = false;

        if (userBetData) {
            didPlay = true;
            if (betPlaced) {
                // User didn't cash out in time, lost bet
                profit = -userBetData.amount
                showToast('error', t('youLost'), t('lostAt', { amount: userBetData.amount.toLocaleString(), currency: currencyName(), mult: crashMultiplier.toFixed(2) }))
                void recordResult({
                    stake: userBetData.amount,
                    winAmount: 0,
                    isWin: false,
                    result: { crashMultiplier, cashedOut: false },
                }).catch(() => {});
            } else {
                // User cashed out
                profit = parseFloat(userBetData.profit) - userBetData.amount
            }
        }

        if (didPlay) {
            setGameRecords(prev => [...prev, {
                id: Date.now(),
                multiplier: crashMultiplier,
                cashedOutAt: betPlaced ? null : (userBetData.cashoutAt ? parseFloat(userBetData.cashoutAt) : null),
                bet: userBetData.amount,
                profit: profit
            }])
        }

        audioManagerRef.current?.playCrashEnd();

        setBetPlaced(false)
        setRoundActive(false)
        setPhase(PHASE.CRASHED)
        setTimeout(() => {
            setPhase(PHASE.WAITING)
            setMultiplier(1.00)
            setElapsedTime(0)
            multiplierRef.current = 1.00
            elapsedTimeRef.current = 0
            setCountdown(5)
        }, 2500)
    }, [userBetData, betPlaced, showToast, recordResult])

    // Handle player cashout notification
    const handlePlayerCashout = useCallback((cashoutData) => {
        if (showPlayerResults) {
            setPlayerCashouts(prev => [...prev, cashoutData])
        }
    }, [showPlayerResults])

    // OPTIMIZED Game loop: use refs for high-freq updates, throttle setState to ~30fps
    useEffect(() => {
        if (phase === PHASE.RUNNING) {
            const tick = () => {
                const now = Date.now()
                const elapsed = (now - startTimeRef.current) / 1000
                const currentMultiplier = Math.pow(Math.E, 0.1 * elapsed)

                // Always update refs (used by Canvas directly)
                multiplierRef.current = currentMultiplier
                elapsedTimeRef.current = elapsed

                if (currentMultiplier >= crashPoint) {
                    // Crash! Update state immediately
                    setMultiplier(crashPoint)
                    setElapsedTime(elapsed)
                    setPhase(PHASE.CRASHED)
                    handleCrash(crashPoint)
                } else {
                    // Throttle React state updates to every ~33ms (≈30fps for UI)
                    // Canvas still renders at 60fps via requestAnimationFrame
                    if (now - lastStateUpdateRef.current >= 33) {
                        setMultiplier(currentMultiplier)
                        setElapsedTime(elapsed)
                        lastStateUpdateRef.current = now
                        audioManagerRef.current?.playCrashTick(currentMultiplier)
                    }
                    animationRef.current = requestAnimationFrame(tick)
                }
            }
            lastStateUpdateRef.current = Date.now()
            animationRef.current = requestAnimationFrame(tick)

            return () => {
                if (animationRef.current) {
                    cancelAnimationFrame(animationRef.current)
                }
            }
        }
    }, [phase, crashPoint, handleCrash])

    // Countdown timer — يعمل فقط بعد رهان يدوي
    useEffect(() => {
        if (!roundActive) return
        if (phase === PHASE.WAITING && countdown > 0) {
            const timer = setTimeout(() => {
                setCountdown(prev => prev - 0.1)
            }, 100)
            return () => clearTimeout(timer)
        } else if (phase === PHASE.WAITING && countdown <= 0) {
            generateCrashPoint().then(point => {
                setCrashPoint(point)
                setPhase(PHASE.RUNNING)
                startTimeRef.current = Date.now()
            })
        }
    }, [roundActive, phase, countdown, generateCrashPoint])

    const handleBet = async (amount) => {
        audioManagerRef.current?.resume();
        const stake = Math.floor(Number(amount));
        if (!stake || stake < minBet) {
            showToast('error', t('invalidBet'), t('minBetToast', { min: minBet.toLocaleString(), currency: currencyName() }));
            return;
        }
        if (stake > maxBet) {
            showToast('error', t('invalidBet'), t('maxBetToast', { max: maxBet.toLocaleString(), currency: currencyName() }));
            return;
        }
        if (stake > balance) {
            showToast('error', t('insufficientBalance'), t('needCoins', { amount: stake.toLocaleString(), currency: currencyName() }));
            return;
        }
        if (phase !== PHASE.WAITING) {
            showToast('error', t('waitRound'), t('betOnlyBeforeLaunch'));
            return;
        }
        if (betPlaced) return;
        try {
            await placeBet(stake);
        } catch (e) {
            showToast('error', t('error'), e?.message || t('deductBetFailed'));
            return;
        }
        setBetAmount(stake);
        setBetPlaced(true);
        setRoundActive(true);
        setCountdown(5);
        setPhase(PHASE.WAITING);
        setUserBetData({
            name: 'You',
            amount: stake,
            currency: { symbol: CURRENCY_SYMBOL, color: '#f7931a', name: currencyName() },
            active: true,
            cashoutAt: null,
            profit: null
        });
        showToast('success', t('betConfirmed'), `${stake.toLocaleString()} ${currencyName()}`);
    }

    const handleCancelBet = async () => {
        if (phase !== PHASE.WAITING || !betPlaced || !betAmount) return;
        try {
            await cancelBet(betAmount);
        } catch (e) {
            showToast('error', t('error'), e?.message || t('cancelBetFailed'));
            return;
        }
        setBetPlaced(false);
        setBetAmount(0);
        setUserBetData(null);
        setRoundActive(false);
        setCountdown(5);
        showToast('success', t('betCancelled'), t('betRefunded'));
    }

    // Handle cashout — استخدم أحدث مضاعف من ref
    const handleCashout = useCallback(() => {
        if (phase !== PHASE.RUNNING || !betPlaced) return;
        const liveMultiplier = multiplierRef.current || multiplier;
        const stake = betAmount;
        const winAmount = Math.floor(stake * liveMultiplier);
        const profit = winAmount - stake;
        void recordResult({
            stake,
            winAmount,
            isWin: true,
            multiplier: liveMultiplier,
            result: { cashedOut: true, multiplier: liveMultiplier },
        }).catch(() => {});
        setBetPlaced(false);
        setUserBetData(prev => prev ? {
            ...prev,
            active: false,
            cashoutAt: liveMultiplier.toFixed(2),
            profit: winAmount.toFixed(0)
        } : null);

        audioManagerRef.current?.playCashout();

        showToast(
            'success',
            t('cashOutSuccess'),
            t('cashOutProfit', { profit: profit.toLocaleString(), currency: currencyName(), mult: liveMultiplier.toFixed(2) }),
        );
    }, [phase, betPlaced, betAmount, multiplier, showToast, recordResult]);

    // Copy to clipboard
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text)
        messageApi.success('Copied to clipboard!')
    }

    // Handle client seed change
    const handleChangeClientSeed = useCallback(async () => {
        const pf = fairnessRef.current
        if (!pf || !clientSeedInput) return
        await pf.setClientSeed(clientSeedInput)
        const data = await pf.getFairnessData()
        setFairnessData(data)
    }, [clientSeedInput])

    // Handle seed rotation (reveals current seed)
    const handleRotateSeed = useCallback(async () => {
        const pf = fairnessRef.current
        if (!pf) return
        const revealed = await pf.rotateSeed()
        setRevealedSeed(revealed)
        const data = await pf.getFairnessData()
        setFairnessData(data)
        setClientSeedInput(data.clientSeed)
    }, [])

    return (
        <div className={`crash-game layout-${layout}`}>
            {contextHolder}

            <div className="game-container clone-layout">
                {/* Left Sidebar: Player Bets & Tabs */}
                <div className="crash-sidebar-left">
                    <PlayerBets
                        phase={phase}
                        multiplier={multiplier}
                        onPlayerCashout={handlePlayerCashout}
                        userBetData={userBetData}
                        balance={balance}
                        casinoCoins={casinoCoins}
                        avatar={avatar}
                        minBet={minBet}
                        maxBet={maxBet}
                    />
                </div>

                {/* Right Main Area */}
                <div className="crash-main-area" ref={gameDisplayRef}>
                    {/* Top: Chart */}
                    <div className="crash-chart-section">
                        <GameChart
                            phase={phase}
                            multiplier={multiplier}
                            elapsedTime={elapsedTime}
                            countdown={countdown}
                            history={history}
                            roundActive={roundActive}
                        />
                        {showPlayerResults && (
                            <PlayerResults cashouts={playerCashouts} />
                        )}
                    </div>

                    {/* Bottom: Betting Panel */}
                    <div className="crash-betting-section" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <BettingPanel
                            phase={phase}
                            betPlaced={betPlaced}
                            roundActive={roundActive}
                            multiplier={multiplier}
                            onBet={handleBet}
                            onCashout={handleCashout}
                            onCancelBet={handleCancelBet}
                            minBet={minBet}
                            maxBet={maxBet}
                            presets={betPresets}
                            defaultBet={minBet}
                            balance={balance}
                            ready={ready}
                            panelId="1"
                        />
                    </div>
                </div>



            </div>

            {/* Statistics Mini Window / Profit Chart */}
            {statsDrawerOpen && (
                <div className="fixed-widget fade-in-scale" ref={widgetRef}>
                    <div className="widget-header" onMouseDown={handleDragStart}>
                        <div className="widget-title">
                            <LineChartOutlined style={{ fontSize: 20, color: '#94a3b8' }} />
                            <span>Live Stats</span>
                        </div>
                        <div className="widget-actions">
                            <Tooltip title="Reset Live Stats" placement="topRight">
                                <button className="widget-btn-icon" onMouseDown={(e) => e.stopPropagation()} onClick={() => setGameRecords([])}>
                                    <ReloadOutlined />
                                </button>
                            </Tooltip>
                            <button className="widget-btn-icon" onMouseDown={(e) => e.stopPropagation()} onClick={() => setStatsDrawerOpen(false)}>
                                <CloseOutlined />
                            </button>
                        </div>
                    </div>

                    <div className="widget-content">
                        {/* Profit Overview */}
                        <div className="profit-box">
                            <div className="profit-main">
                                <p className="label">Profit</p>
                                <div className={`stat-value ${totalProfit >= 0 ? 'profit-up' : 'profit-down'}`} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <CasinoIcon size={14} />{totalProfit.toFixed(2)}
                                </div>
                            </div>
                            <div className="profit-divider"></div>
                            <div className="profit-stats">
                                <div className="stat-row">
                                    <p className="label">Wins</p>
                                    <p className="value" style={{ color: '#4ade80' }}>{winsCount.toLocaleString()}</p>
                                </div>
                                <div className="stat-row">
                                    <p className="label">Losses</p>
                                    <p className="value" style={{ color: '#f87171' }}>{lossesCount.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>

                        {/* Chart.js Container */}
                        <div className="chart-box" onMouseLeave={() => setHoveredProfitValue(null)}>
                            <p className="label">Profit History</p>
                            {hoveredProfitValue !== null && (
                                <div className={`stat-value ${hoveredProfitValue >= 0 ? 'profit-up' : 'profit-down'}`} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    {hoveredProfitValue >= 0 ? '' : '-'}
                                    <CasinoIcon size={14} />
                                    {Math.abs(hoveredProfitValue).toFixed(2)}
                                </div>
                            )}
                            <div className="canvas-wrapper">
                                <canvas ref={chartCanvasRef}></canvas>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* History Window - sleek modern dashboard style */}
            <Modal
                title={
                    <Space className="history-window-header-title">
                        <div className="icon-wrapper"><ThunderboltOutlined /></div>
                        <span>Play History & Dashboard</span>
                    </Space>
                }
                centered
                footer={null}
                onCancel={() => setHistoryDrawerOpen(false)}
                open={historyDrawerOpen}
                width={460}
                className="history-window box-modal-3d"
                closeIcon={<CloseOutlined style={{ color: '#94a3b8' }} />}
            >
                <div className="history-window-content">
                    {/* Achievements */}
                    <div className="dashboard-section">
                        <div className="section-title">Milestones</div>
                        <div className="achievements-row">
                            {(() => {
                                const achievements = [
                                    { id: 'first-drop', title: 'First Drop', unlocked: gameRecords.length > 0, icon: <StarOutlined /> },
                                    { id: 'big-win', title: 'Big Win 20×', unlocked: gameRecords.some(w => w.multiplier >= 20 && w.profit >= 0), icon: <TrophyOutlined /> },
                                    { id: 'hot-streak', title: 'Hot streak 5+', unlocked: maxStreak >= 5, icon: <FireOutlined /> },
                                ];
                                return achievements.map(a => (
                                    <div key={a.id} className={`achievement-badge ${a.unlocked ? 'unlocked' : 'locked'}`}>
                                        <div className="achievement-icon">{a.icon}</div>
                                        <div className="achievement-title">{a.title}</div>
                                    </div>
                                ));
                            })()}
                        </div>
                    </div>

                    {/* Streak timeline (last 20 results) */}
                    <div className="dashboard-section">
                        <div className="section-title">Streak Timeline (Last 20)</div>
                        <div className="streak-timeline glass-panel">
                            {gameRecords.slice(-20).map((r, idx) => (
                                <div key={r.id || idx} className={`timeline-dot ${r.profit >= 0 ? 'win' : 'loss'}`} title={`Crash: ${r.multiplier.toFixed(2)}x ${r.cashedOutAt ? `• Cashed out: ${r.cashedOutAt.toFixed(2)}x` : ''}`} />
                            ))}
                        </div>
                    </div>

                    {/* History list */}
                    <div className="dashboard-section">
                        <div className="section-title">Recent Transactions</div>
                        <div className="history-list">
                            {gameRecords.length === 0 ? (
                                <div className="empty-state">No transaction history yet</div>
                            ) : (
                                gameRecords.slice().reverse().map((r) => {
                                    const isWin = r.profit >= 0;
                                    return (
                                        <div key={r.id} className="history-card glass-panel">
                                            <div className="history-card-icon">
                                                <div className="ball-color-circle medium" style={{ background: isWin ? 'linear-gradient(135deg, #00f0ff, #00a000)' : 'linear-gradient(135deg, #ff4d4f, #cf1322)' }}>
                                                    {isWin ? <TrophyOutlined style={{ color: '#fff' }} /> : <CloseOutlined style={{ color: '#fff' }} />}
                                                </div>
                                            </div>
                                            <div className="history-card-info">
                                                <div className="history-card-name">{isWin ? 'Win' : 'Loss'}</div>
                                                <div className="history-card-multiplier" style={{ color: isWin ? '#00f0ff' : '#ff4d4f' }}>
                                                    {r.cashedOutAt ? r.cashedOutAt.toFixed(2) : r.multiplier.toFixed(2)}×
                                                </div>
                                            </div>
                                            <div className={`history-card-profit ${isWin ? 'profit-up' : 'profit-down'}`} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                {isWin ? '+' : '-'}
                                                <CasinoIcon size={14} />
                                                {Math.abs(r.profit).toFixed(2)}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Fairness Modal */}
            <Modal
                title={
                    <Space>
                        <SafetyCertificateOutlined style={{ color: '#00f0ff' }} />
                        <span>Provably Fair</span>
                    </Space>
                }
                open={fairnessModalOpen}
                onCancel={() => setFairnessModalOpen(false)}
                footer={null}
                width={480}
                className="fairness-modal"
                centered
            >
                {/* Header Card */}
                <div className="fairness-header">
                    <Title level={5}>
                        <CheckCircleOutlined style={{ marginRight: 8 }} />
                        This game is provably fair
                    </Title>
                    <Paragraph>
                        Uses HMAC-SHA256 to generate results from server seed + client seed + nonce.
                        Rotate the seed to reveal and verify past results.
                    </Paragraph>
                </div>

                {/* Active Seed Data */}
                <div className="fairness-item">
                    <span className="fairness-label">Server Seed (Hash)</span>
                    <div className="fairness-value">
                        <Text copyable={{ text: fairnessData.serverSeedHash }} style={{ fontSize: 11, wordBreak: 'break-all' }}>
                            {fairnessData.serverSeedHash?.slice(0, 24)}...
                        </Text>
                    </div>
                </div>

                <div className="fairness-item">
                    <span className="fairness-label">Client Seed</span>
                    <div className="fairness-value" style={{ display: 'flex', gap: 6 }}>
                        <Input
                            size="small"
                            value={clientSeedInput}
                            onChange={e => setClientSeedInput(e.target.value)}
                            style={{ background: '#1c1f2e', border: 'none', color: '#fff', flex: 1, fontSize: 12 }}
                        />
                        <Button size="small" onClick={handleChangeClientSeed} icon={<CheckCircleOutlined />} />
                    </div>
                </div>

                <div className="fairness-item">
                    <span className="fairness-label">Nonce</span>
                    <div className="fairness-value">
                        <Text style={{
                            background: 'rgba(47, 69, 83, 0.5)',
                            padding: '4px 12px',
                            borderRadius: 6,
                            color: '#fff'
                        }}>
                            {fairnessData.nonce}
                        </Text>
                    </div>
                </div>

                <div className="fairness-item">
                    <span className="fairness-label">Last Result</span>
                    <div className="fairness-value">
                        <Tag
                            color={(history[0] || 1) < 2 ? 'error' : (history[0] || 1) < 10 ? 'success' : 'gold'}
                            style={{ margin: 0, fontSize: 14, fontWeight: 600 }}
                        >
                            {(history[0] || 1).toFixed(2)}×
                        </Tag>
                    </div>
                </div>

                <Divider style={{ borderColor: 'rgba(255,255,255,0.06)', margin: '12px 0' }} />

                {/* Revealed Seed (after rotation) */}
                {revealedSeed && (
                    <div style={{ marginBottom: 12 }}>
                        <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Previous Server Seed (Revealed)
                        </Text>
                        <div className="fairness-item" style={{ marginTop: 6 }}>
                            <span className="fairness-label">Seed</span>
                            <div className="fairness-value">
                                <Text copyable={{ text: revealedSeed.serverSeed }} style={{ fontSize: 10, wordBreak: 'break-all' }}>
                                    {revealedSeed.serverSeed.slice(0, 20)}...
                                </Text>
                            </div>
                        </div>
                        <div className="fairness-item">
                            <span className="fairness-label">Hash</span>
                            <div className="fairness-value">
                                <Text style={{ fontSize: 10, wordBreak: 'break-all', color: '#00f0ff' }}>
                                    {revealedSeed.serverSeedHash?.slice(0, 20)}...
                                </Text>
                            </div>
                        </div>
                    </div>
                )}

                {/* Rotate Button */}
                <Button
                    type="primary"
                    block
                    className="fairness-verify-btn"
                    icon={<SyncOutlined />}
                    onClick={handleRotateSeed}
                >
                    Rotate Seed (Reveal Current)
                </Button>
            </Modal>
        </div>
    )
}

export default CrashGame
