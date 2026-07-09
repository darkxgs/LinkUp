import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import {
    SettingOutlined,
    SafetyCertificateOutlined,
    SoundOutlined,
    TrophyOutlined,
    FireOutlined,
    LineChartOutlined,
    CloseOutlined,
    ReloadOutlined,
    RightOutlined,
    ExpandOutlined,
    FullscreenExitOutlined,
    CheckCircleOutlined,
    BugOutlined
} from '@ant-design/icons'
import { Modal, Tooltip, Statistic, Row, Col, Space, Button, Typography, Tag, Divider, Input, InputNumber } from 'antd'
import Chart from 'chart.js/auto'

const { Title, Text, Paragraph } = Typography;
import { message } from 'antd';
import ProvablyFair from '../utils/ProvablyFair'
import { useLinkUpWallet } from '../../bridge/useLinkUpWallet'
import { useCasinoBetLimits } from '../../bridge/useCasinoBetLimits'
import { CurrencyIcon, CasinoIcon, currencyName } from '../../config/currency'
import { t } from '../../i18n/casinoI18n.js'
import { casinoAsset } from '../../config/assets.js';
import './MinesGame.css'

const MINES_IMG = casinoAsset('/images/mines')
const CURRENCY_SYMBOL = currencyName

const HOUSE_EDGE = 0.99; // 1% edge

const calculateMultiplier = (mines, hits) => {
    if (hits === 0) return 1.00;
    let mult = 1;
    for (let i = 0; i < hits; i++) {
        mult *= (25 - i) / (25 - mines - i);
    }
    return mult * HOUSE_EDGE;
};

// SVG Icons inline to avoid ant-design missing ones if any
const HistoryIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
    </svg>
)

const StatsIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16 11.78l4.24-7.33 1.73 1-5.23 9.05-6.51-3.75L5.46 19H22v2H2V3h2v14.54L9.5 8z" />
    </svg>
)

function MinesGame() {
    const { balance, ready, gameConfig, placeBet: bridgePlaceBet, recordResult } = useLinkUpWallet();
    const showToast = (type, title, desc) => {
        if (type === 'error') message.error(`${title}: ${desc}`);
        else if (type === 'win') message.success(`${title}: ${desc}`);
        else message.info(`${title}: ${desc}`);
    };
    const [isPlaying, setIsPlaying] = useState(false);
    const [betAmount, setBetAmount] = useState(100);
    const { minBet, maxBet } = useCasinoBetLimits(gameConfig, setBetAmount);
    const [minesCount, setMinesCount] = useState(3);
    const [revealedTiles, setRevealedTiles] = useState([]);
    const [mineLocations, setMineLocations] = useState([]);
    const [gameOverState, setGameOverState] = useState(null) // 'win', 'loss', or null
    const [isHovering, setIsHovering] = useState(null);
    const [fairnessModalOpen, setFairnessModalOpen] = useState(false);

    // Bottom Controls State
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(true);

    // Debug & Fairness State
    const [isDebugMode, setIsDebugMode] = useState(false);
    const [debugData, setDebugData] = useState(null);

    // Provably Fair
    const fairnessRef = useRef(null);
    const [fairnessData, setFairnessData] = useState({
        serverSeedHash: 'Loading...',
        clientSeed: 'Loading...',
        nonce: 0,
    });
    const [revealedSeed, setRevealedSeed] = useState(null);
    const [clientSeedInput, setClientSeedInput] = useState('');

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch((err) => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    // Stats states
    const [statsDrawerOpen, setStatsDrawerOpen] = useState(false);
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [winRecords, setWinRecords] = useState([]);
    const [totalProfit, setTotalProfit] = useState(0);
    const [winsCount, setWinsCount] = useState(0);
    const [lossesCount, setLossesCount] = useState(0);
    const [hoveredProfitValue, setHoveredProfitValue] = useState(null);

    // Refs
    const widgetRef = useRef(null);
    const isDragging = useRef(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const chartCanvasRef = useRef(null);
    const chartInstanceRef = useRef(null);
    const profitHistoryRef = useRef([0]);

    // Debug Widget Refs
    const debugWidgetRef = useRef(null);
    const isDebugDragging = useRef(false);
    const debugDragOffset = useRef({ x: 0, y: 0 });

    // Initialize ProvablyFair
    useEffect(() => {
        const pf = new ProvablyFair();
        fairnessRef.current = pf;
        pf.waitReady().then(async () => {
            const data = await pf.getFairnessData();
            setFairnessData(data);
            setClientSeedInput(data.clientSeed);
        });
    }, []);

    // Fetch peek data for Fairness Debug whenever conditions change
    useEffect(() => {
        const pf = fairnessRef.current;
        // Don't update debug data while game is playing, so it matches the current game.
        if (isDebugMode && pf && pf._hashReady && !isPlaying) {
            pf.peekMinesPositions(minesCount).then(data => {
                setDebugData(data);
            }).catch(err => console.error('Peek info error:', err));
        }
    }, [isDebugMode, fairnessData, minesCount, isPlaying]);

    // Handle client seed change
    const handleChangeClientSeed = useCallback(async () => {
        const pf = fairnessRef.current;
        if (!pf || !clientSeedInput) return;
        await pf.setClientSeed(clientSeedInput);
        const data = await pf.getFairnessData();
        setFairnessData(data);
    }, [clientSeedInput]);

    // Handle seed rotation (reveals current seed)
    const handleRotateSeed = useCallback(async () => {
        const pf = fairnessRef.current;
        if (!pf) return;
        const revealed = await pf.rotateSeed();
        setRevealedSeed(revealed);
        const data = await pf.getFairnessData();
        setFairnessData(data);
        setClientSeedInput(data.clientSeed);
    }, []);

    // Drag handler for debug widget
    const handleDebugDragStart = useCallback((e) => {
        if (!debugWidgetRef.current) return;
        isDebugDragging.current = true;
        const rect = debugWidgetRef.current.getBoundingClientRect();
        debugDragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };

        const handleMouseMove = (moveEvt) => {
            if (!isDebugDragging.current || !debugWidgetRef.current) return;
            const newX = moveEvt.clientX - debugDragOffset.current.x;
            const newY = moveEvt.clientY - debugDragOffset.current.y;

            const maxX = window.innerWidth - debugWidgetRef.current.offsetWidth;
            const maxY = window.innerHeight - debugWidgetRef.current.offsetHeight;
            debugWidgetRef.current.style.left = `${Math.max(0, Math.min(newX, maxX))}px`;
            debugWidgetRef.current.style.top = `${Math.max(0, Math.min(newY, maxY))}px`;
            debugWidgetRef.current.style.right = 'auto';
            debugWidgetRef.current.style.bottom = 'auto';
            debugWidgetRef.current.style.transform = 'none';
        };

        const handleMouseUp = () => {
            isDebugDragging.current = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, []);

    // Live Stats Drag Logic
    const handleDragStart = (e) => {
        if (!widgetRef.current) return;
        isDragging.current = true;
        const rect = widgetRef.current.getBoundingClientRect();
        dragOffset.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        document.addEventListener('mousemove', handleDrag);
        document.addEventListener('mouseup', handleDragEnd);
    };

    const handleDrag = (e) => {
        if (!isDragging.current || !widgetRef.current) return;
        const newX = e.clientX - dragOffset.current.x;
        const newY = e.clientY - dragOffset.current.y;

        // Boundaries
        const maxX = window.innerWidth - widgetRef.current.offsetWidth;
        const maxY = window.innerHeight - widgetRef.current.offsetHeight;

        const boundedX = Math.max(0, Math.min(newX, maxX));
        const boundedY = Math.max(0, Math.min(newY, maxY));

        widgetRef.current.style.left = `${boundedX}px`;
        widgetRef.current.style.top = `${boundedY}px`;
        widgetRef.current.style.right = 'auto';
        widgetRef.current.style.bottom = 'auto';
    };

    const handleDragEnd = () => {
        isDragging.current = false;
        document.removeEventListener('mousemove', handleDrag);
        document.removeEventListener('mouseup', handleDragEnd);
    };

    // Chart Update Logic
    useEffect(() => {
        if (!statsDrawerOpen || !chartCanvasRef.current) return;

        const WIN_COLOR = 'rgb(74, 222, 128)';
        const WIN_COLOR_FILL = 'rgba(74, 222, 128, 0.3)';
        const LOSS_COLOR = 'rgb(248, 113, 113)';
        const LOSS_COLOR_FILL = 'rgba(248, 113, 113, 0.3)';
        const X_AXIS_COLOR = '#2a3f4d';
        const POINT_HOVER_COLOR = '#fff';

        const profitHistory = profitHistoryRef.current.length > 0 ? profitHistoryRef.current : [0];

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
                            const val = profitHistoryRef.current[idx];
                            setHoveredProfitValue(val !== undefined ? val : null);
                        } else {
                            setHoveredProfitValue(null);
                        }
                    },
                },
            });
        }
    }, [statsDrawerOpen, winRecords]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
                chartInstanceRef.current = null;
            }
        };
    }, []);

    // Audio setup using Web Audio API
    const audioCtxRef = useRef(null);
    const bgAudioRef = useRef(null);

    const initAudio = () => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume();
        }
        
        // Setup BGM
        if (!bgAudioRef.current) {
            bgAudioRef.current = new Audio('/audio/bg-music.mp3');
            bgAudioRef.current.loop = true;
            bgAudioRef.current.volume = 0.2; // Softer bgm
        }
        
        if (soundEnabled && bgAudioRef.current.paused) {
            bgAudioRef.current.play().catch(e => console.log('BGM Autoplay blocked'));
        }
    };

    useEffect(() => {
        if (bgAudioRef.current) {
            if (soundEnabled) {
                bgAudioRef.current.play().catch(e => console.log('BGM Play blocked'));
            } else {
                bgAudioRef.current.pause();
            }
        }
    }, [soundEnabled]);

    useEffect(() => {
        return () => {
            if (bgAudioRef.current) {
                bgAudioRef.current.pause();
            }
        }
    }, []);

    const playSound = (type, pitchMultiplier = 1) => {
        initAudio();
        if (!soundEnabled) return;
        
        const ctx = audioCtxRef.current;
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        const now = ctx.currentTime;

        if (type === 'gem') {
            osc.type = 'sine';
            const baseFreq = 800 + (pitchMultiplier * 100); 
            const peakFreq = baseFreq * 1.5;
            osc.frequency.setValueAtTime(baseFreq, now);
            osc.frequency.exponentialRampToValueAtTime(peakFreq, now + 0.05);
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.05, now + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
        } else if (type === 'loss') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(100, now);
            osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.1, now + 0.05);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        } else if (type === 'win') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.setValueAtTime(500, now + 0.08);
            osc.frequency.setValueAtTime(600, now + 0.16);
            osc.frequency.setValueAtTime(800, now + 0.24);
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.08, now + 0.04);
            gainNode.gain.setValueAtTime(0.08, now + 0.3);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
            osc.start(now);
            osc.stop(now + 0.5);
        }
    }

    const currentMultiplier = useMemo(() => {
        return calculateMultiplier(minesCount, revealedTiles.length);
    }, [minesCount, revealedTiles.length]);

    const potentialWin = useMemo(() => {
        return betAmount * currentMultiplier;
    }, [betAmount, currentMultiplier]);

    const handleBetAmountChange = (e) => {
        let val = parseInt(e.target.value, 10);
        if (isNaN(val)) val = minBet;
        setBetAmount(Math.min(maxBet, Math.max(minBet, val)));
    };

    const handleBetAmountHalf = () => setBetAmount(prev => Math.max(minBet, Math.floor(Number(prev || minBet) / 2)));
    const handleBetAmountDouble = () => setBetAmount(prev => Math.min(maxBet, Math.floor(Number(prev || minBet) * 2)));

    const handleMinesChange = (e) => {
        const count = parseInt(e.target.value, 10);
        if (count >= 1 && count <= 24) {
            setMinesCount(count);
        }
    };

    const startGame = async () => {
        const stake = Math.floor(Number(betAmount) || 0);
        if (!ready || stake < minBet || stake > maxBet) {
            showToast('error', 'رهان غير صالح', `الحد الأدنى ${minBet.toLocaleString()} كوين`);
            return;
        }
        if (balance < stake) {
            showToast('error', 'رصيد غير كافٍ', `أنت بحاجة إلى ${stake.toLocaleString()} كوين`);
            return;
        }

        try {
            await bridgePlaceBet(stake);
        } catch (err) {
            showToast('error', 'رصيد غير كافٍ', err?.message || 'تعذر خصم الرهان');
            return;
        }

        // Generate mines using provably fair system
        const pf = fairnessRef.current;
        if (!pf) return;
        const result = await pf.generateMinesPositions(minesCount);
        const mines = new Set(result.minePositions);

        // Update fairness data after nonce advances
        const data = await pf.getFairnessData();
        setFairnessData(data);

        setMineLocations(Array.from(mines));
        setRevealedTiles([]);
        setGameOverState(null);
        setIsPlaying(true);
        showToast('bet', 'بدأت اللعبة', `تم وضع رهان بقيمة ${stake.toLocaleString()} كوين`);
    };

    const endGame = async (reason) => {
        setIsPlaying(false);
        setGameOverState(reason);
        if (reason === 'win') {
            const profit = potentialWin - betAmount;
            try {
                await recordResult({
                    stake: betAmount,
                    winAmount: Math.floor(potentialWin),
                    isWin: true,
                    multiplier: currentMultiplier,
                    result: { mines: minesCount, gems: revealedTiles.length, reason: 'cashout' },
                });
            } catch (err) {
                showToast('error', 'خطأ', err?.message || 'تعذر تسجيل الفوز');
            }

            // Update stats
            setTotalProfit(prev => prev + profit);
            setWinsCount(prev => prev + 1);
            setWinRecords(prev => [...prev, profit]);
            profitHistoryRef.current.push(profitHistoryRef.current[profitHistoryRef.current.length - 1] + profit);

            showToast('win', 'تم سحب الأرباح!', `+₿${profit.toFixed(2)} بمضاعف ${currentMultiplier.toFixed(2)}×`, 4000);
            playSound('win');
        } else if (reason === 'loss') {
            try {
                await recordResult({
                    stake: betAmount,
                    winAmount: 0,
                    isWin: false,
                    result: { hitMine: true, mines: minesCount },
                });
            } catch (err) {
                showToast('error', 'خطأ', err?.message || 'تعذر تسجيل الخسارة');
            }
            // Update stats
            setTotalProfit(prev => prev - betAmount);
            setLossesCount(prev => prev + 1);
            setWinRecords(prev => [...prev, -betAmount]);
            profitHistoryRef.current.push(profitHistoryRef.current[profitHistoryRef.current.length - 1] - betAmount);

            showToast('loss', 'انفجار!', `-₿${betAmount.toFixed(2)}`, 3000);
            playSound('loss');
        }
    };

    const cashout = () => {
        if (!isPlaying || revealedTiles.length === 0) return;
        endGame('win');
    };

    const pickRandom = () => {
        if (!isPlaying) return;
        const unrevealedSafe = [];
        for (let i = 0; i < 25; i++) {
            if (!revealedTiles.includes(i)) {
                unrevealedSafe.push(i);
            }
        }
        if (unrevealedSafe.length > 0) {
            const randomPick = unrevealedSafe[Math.floor(Math.random() * unrevealedSafe.length)];
            handleTileClick(randomPick);
        }
    };

    const handleTileClick = (index) => {
        if (!isPlaying || revealedTiles.includes(index) || gameOverState) return;

        if (mineLocations.includes(index)) {
            // Hit a mine
            setRevealedTiles(prev => [...prev, index]);
            endGame('loss');
        } else {
            // Hit a gem
            const newRevealed = [...revealedTiles, index];
            setRevealedTiles(newRevealed);
            playSound('gem', newRevealed.length);

            // Check if user found all gems
            if (newRevealed.length === 25 - minesCount) {
                // Auto win
                setIsPlaying(false);
                setGameOverState('win');
                const finalMult = calculateMultiplier(minesCount, newRevealed.length);
                const finalWin = betAmount * finalMult;
                const profit = finalWin - betAmount;
                void recordResult({
                    stake: betAmount,
                    winAmount: Math.floor(finalWin),
                    isWin: true,
                    multiplier: finalMult,
                    result: { mines: minesCount, gems: newRevealed.length, reason: 'all_gems' },
                }).catch(() => {});

                // Update stats
                setTotalProfit(prev => prev + profit);
                setWinsCount(prev => prev + 1);
                setWinRecords(prev => [...prev, profit]);
                profitHistoryRef.current.push(profitHistoryRef.current[profitHistoryRef.current.length - 1] + profit);

                showToast('win', 'تم العثور على كل الجواهر!', `+₿${profit.toFixed(2)} بمضاعف ${finalMult.toFixed(2)}×`, 4000);
            }
        }
    };

    const renderGrid = () => {
        const tiles = [];
        for (let i = 0; i < 25; i++) {
            const isRevealed = revealedTiles.includes(i);
            const isMine = mineLocations.includes(i);
            const isGameOver = !isPlaying && gameOverState;

            let statusClass = '';
            let content = null;

            if (isRevealed) {
                statusClass = `revealed ${isMine ? 'bomb-tile' : 'gem-tile'}`;
                content = isMine ? (
                    <>
                        <img src={`${MINES_IMG}/bomb.svg`} alt="Bomb" className="reveal-anim" />
                    </>
                ) : (
                    <img src={`${MINES_IMG}/diamond.svg`} alt="Gem" className="reveal-anim" />
                );
            } else if (isGameOver) {
                // Show remaining tiles semi-transparently
                statusClass = `revealed game-over-reveal`;
                content = isMine ? (
                    <img src={`${MINES_IMG}/bomb.svg`} alt="Bomb" style={{ filter: 'grayscale(100%) opacity(0.5)' }} />
                ) : (
                    <img src={`${MINES_IMG}/diamond.svg`} alt="Gem" style={{ filter: 'grayscale(100%) opacity(0.5)' }} />
                );
            }

            tiles.push(
                <button
                    key={i}
                    className={`mine-tile ${statusClass} ${(!isPlaying || isRevealed) ? 'inactive' : ''}`}
                    onClick={() => {
                        if (!isPlaying || isRevealed) return;
                        handleTileClick(i);
                    }}
                    onMouseEnter={() => setIsHovering(i)}
                    onMouseLeave={() => setIsHovering(null)}
                >
                    <div className="mine-tile-inner">
                        {content}
                    </div>
                </button>
            );
        }
        return tiles;
    };

    // Profit Display Logic
    let profitBg = '#0f1b29';
    let profitBorder = '1px solid transparent';
    let profitColor = '#fff';
    let profitText = potentialWin.toFixed(2);
    let profitMult = currentMultiplier.toFixed(2);

    if (gameOverState === 'loss') {
        profitBg = 'rgba(255, 0, 63, 0.08)';
        profitBorder = '1px solid rgba(255, 0, 63, 0.3)';
        profitColor = '#ff003f';
        profitText = '0.00';
        profitMult = '0.00';
    } else if (gameOverState === 'win') {
        profitBg = 'rgba(0, 231, 1, 0.15)';
        profitBorder = '1px solid #00e701';
        profitColor = '#00e701';
    } else if (revealedTiles.length > 0) {
        profitBg = 'rgba(0, 231, 1, 0.1)';
        profitBorder = '1px solid rgba(0, 231, 1, 0.2)';
        profitColor = '#00e701';
    }

    return (
        <div className="mines-game" dir="rtl">
            <div className="game-container">
                {/* Sidebar Controls */}
                <div className="mines-sidebar">
                    <div className="mines-sidebar-content">
                        {/* Balance Display */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f1b29', padding: '12px 16px', borderRadius: 8, marginBottom: 12 }}>
                            <span style={{ color: '#b1bad3', fontSize: 14, fontWeight: 500 }}>{t('balance')}</span>
                            <span className="lu-balance-value" style={{ color: '#fff', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }} dir="ltr">
                                <CurrencyIcon /> {balance >= 1e9 ? (balance / 1e9).toFixed(2) + 'B' : balance >= 1e6 ? (balance / 1e6).toFixed(2) + 'M' : balance.toFixed(2)}
                            </span>
                        </div>

                        <div className="mines-bet-panel">
                            {/* Action Buttons */}
                            {!isPlaying ? (
                                <button className="btn-bet-mines" onClick={startGame} disabled={!ready || betAmount < minBet || betAmount > balance}>
                                    {t('startBet')}
                                </button>
                            ) : (
                                <>
                                    <button
                                        className="btn-bet-mines"
                                        onClick={cashout}
                                        disabled={revealedTiles.length === 0}
                                    >
                                        {t('cashOut')}
                                    </button>
                                    <button
                                        className="btn-random-pick"
                                        onClick={pickRandom}
                                    >
                                        {t('randomPick')}
                                    </button>
                                </>
                            )}

                            {/* Prominent Profit Display */}
                            <div className="form-group" style={{ background: profitBg, padding: '16px 12px', borderRadius: 8, border: profitBorder, marginBottom: 16, transition: 'all 0.3s' }}>
                                <div style={{ textAlign: 'center', color: '#b1bad3', fontSize: 14, marginBottom: 8, fontWeight: 500 }}>
                                    {t('totalProfit', { mult: profitMult })}
                                </div>
                                <div style={{ textAlign: 'center', color: profitColor, fontSize: 24, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} dir="ltr">
                                    <CasinoIcon /> {profitText}
                                </div>
                            </div>

                            {/* Bet Amount */}
                            <div className="form-group">
                                <div className="form-header">
                                    <label className="form-label" style={{ margin: 0 }}>مبلغ الرهان</label>
                                    <Text type="secondary" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 4 }} dir="ltr">
                                        <CurrencyIcon />{(betAmount ?? 0).toFixed(2)}
                                    </Text>
                                </div>
                                <div className="input-row" dir="ltr">
                                    <InputNumber
                                        value={betAmount === 0 ? null : betAmount}
                                        onChange={(val) => setBetAmount(Math.min(maxBet, Math.max(minBet, Math.floor(Number(val) || minBet))))}
                                        min={minBet}
                                        max={maxBet}
                                        step={1}
                                        disabled={isPlaying}
                                        style={{ flex: 1 }}
                                        controls={false}
                                        formatter={(v) => `${v}`}
                                        parser={(v) => v.replace(/\$\s?|(,*)/g, '')}
                                        addonBefore={
                                            <div className="dino-currency-icon"><CurrencyIcon /></div>
                                        }
                                    />
                                    <Button.Group className="dino-btn-group">
                                        <Button
                                            onClick={handleBetAmountHalf}
                                            disabled={isPlaying}
                                        >
                                            ½
                                        </Button>
                                        <Button
                                            onClick={handleBetAmountDouble}
                                            disabled={isPlaying}
                                        >
                                            2×
                                        </Button>
                                    </Button.Group>
                                </div>
                            </div>

                            {/* Mines Selection */}
                            <div className="form-group">
                                <label className="form-label">الألغام</label>
                                <div className="mines-select-wrapper">
                                    <select
                                        className="mines-select"
                                        value={minesCount}
                                        onChange={handleMinesChange}
                                        disabled={isPlaying}
                                    >
                                        {[...Array(24)].map((_, i) => (
                                            <option key={i + 1} value={i + 1}>{i + 1}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Gems Display */}
                            <div className="form-group">
                                <label className="form-label">الجواهر</label>
                                <div className="input-with-controls">
                                    <input
                                        type="text"
                                        className="mines-input"
                                        value={25 - minesCount}
                                        readOnly
                                        disabled={isPlaying}
                                    />
                                </div>
                            </div>

                            {/* Total Profit Display moved to top */}
                        </div>
                    </div>

                    {/* Left Sidebar Footer */}
                    <div className="sidebar-footer">
                        <div className="footer-buttons">
                            <button
                                className={`footer-btn ${statsDrawerOpen ? 'active' : ''}`}
                                onClick={() => setStatsDrawerOpen(true)}
                                title="الإحصائيات المباشرة"
                            >
                                <StatsIcon />
                            </button>
                            <button
                                className={`footer-btn ${historyModalOpen ? 'active' : ''}`}
                                onClick={() => setHistoryModalOpen(true)}
                                title="سجل اللعب ولوحة التحكم"
                            >
                                <HistoryIcon />
                            </button>
                            <button
                                className="footer-btn"
                                onClick={() => setFairnessModalOpen(true)}
                                title="النزاهة"
                            >
                                <SafetyCertificateOutlined style={{ fontSize: 18 }} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Game Display Wrapper */}
                <div className="mines-display-wrapper">
                    <div className="mines-display">
                        <div className="mines-grid">
                            {renderGrid()}
                        </div>
                    </div>

                    {/* Debug Overlay */}
                    {isDebugMode && debugData && (
                        <div className="fixed-widget debug-widget fade-in-scale" ref={debugWidgetRef}>
                            <div className="widget-header debug-widget-header" onMouseDown={handleDebugDragStart}>
                                <div className="widget-title">
                                    <BugOutlined style={{ color: '#00f0ff', fontSize: 18 }} />
                                    <span style={{ color: '#00f0ff' }}>تصحيح النزاهة</span>
                                </div>
                                <div className="widget-actions">
                                    <button className="widget-btn-icon" onMouseDown={(e) => e.stopPropagation()} onClick={() => setIsDebugMode(false)}>
                                        <CloseOutlined />
                                    </button>
                                </div>
                            </div>
                            <div className="widget-content debug-widget-content">
                                <div className="debug-row">
                                    <span className="debug-label">الهاش التالي:</span>
                                    <span className="debug-value">{debugData.hash.substring(0, 16)}...</span>
                                </div>
                                <div className="debug-row">
                                    <span className="debug-label">سيد اللاعب:</span>
                                    <span className="debug-value">{fairnessData.clientSeed?.substring(0, 10)}...</span>
                                </div>
                                <div className="debug-row">
                                    <span className="debug-label">الرقم (Nonce):</span>
                                    <span className="debug-value">{debugData.nonce}</span>
                                </div>
                                <div className="debug-target">
                                    الألغام: <span className="target-bin">{minesCount}</span>
                                    <div style={{ fontSize: 13, color: '#fff', marginTop: 4, textShadow: 'none' }}>
                                        المواقع: <span style={{ color: '#ff4d4f' }}>[{debugData.minePositions.join(', ')}]</span>
                                    </div>
                                </div>
                                <div className="mines-debug-grid">
                                    {Array.from({ length: 25 }, (_, i) => (
                                        <div key={i} className={`mines-debug-cell ${debugData.minePositions.includes(i) ? 'is-mine' : 'is-gem'}`}>
                                            {debugData.minePositions.includes(i) ? '💣' : '💎'}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Bottom Controls */}
                    <div className="game-controls">
                        <Space>
                            <Tooltip title={soundEnabled ? "كتم الصوت" : "تشغيل الصوت"}>
                                <Button type="text" icon={<SoundOutlined />} className={`control-btn ${!soundEnabled ? 'muted' : ''}`} onClick={() => {
                                    initAudio();
                                    setSoundEnabled(!soundEnabled);
                                }} />
                            </Tooltip>
                            <Tooltip title={isDebugMode ? "إلغاء التصحيح" : "تفعيل التصحيح (كشف النزاهة)"}>
                                <Button
                                    type="text"
                                    icon={<BugOutlined />}
                                    className={`control-btn ${isDebugMode ? 'active-debug' : ''}`}
                                    style={{ color: isDebugMode ? '#00f0ff' : undefined }}
                                    onClick={() => setIsDebugMode(!isDebugMode)}
                                />
                            </Tooltip>
                        </Space>
                        <span className="logo" style={{ color: 'var(--text-primary)' }}>Linkup</span>
                        <Button type="text" icon={<SafetyCertificateOutlined />} className="fairness-btn" onClick={() => setFairnessModalOpen(true)}>
                            النزاهة
                        </Button>
                    </div>
                </div>
            </div>

            <Modal
                title={
                    <Space>
                        <SafetyCertificateOutlined style={{ color: '#00f0ff' }} />
                        <span>النزاهة</span>
                    </Space>
                }
                open={fairnessModalOpen}
                onCancel={() => setFairnessModalOpen(false)}
                footer={null}
                width={480}
                className="fairness-modal box-modal-3d"
                centered
                styles={{
                    content: { background: '#0a0b10', padding: 0 }
                }}
            >
                <div className="fairness-header">
                    <Title level={5}>
                        <CheckCircleOutlined style={{ marginRight: 8 }} />
                        هذه اللعبة تتمتع بنظام نزاهة مُثبت
                    </Title>
                    <Paragraph>تستخدم نظام HMAC-SHA256 لتحديد مواقع الألغام بدقة بناءً على السيد الخاص بالسيرفر والسيد الخاص بك.</Paragraph>
                </div>

                <div className="fairness-item">
                    <span className="fairness-label">سيد السيرفر (الهاش)</span>
                    <div className="fairness-value">
                        <Text copyable={{ text: fairnessData.serverSeedHash }} style={{ fontSize: 11, wordBreak: 'break-all' }}>
                            {fairnessData.serverSeedHash?.slice(0, 24)}...
                        </Text>
                    </div>
                </div>

                <div className="fairness-item">
                    <span className="fairness-label">سيد اللاعب</span>
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
                    <span className="fairness-label">الرقم (Nonce)</span>
                    <div className="fairness-value">
                        <Text style={{ background: 'rgba(47, 69, 83, 0.5)', padding: '4px 12px', borderRadius: 6, color: '#fff' }}>
                            {fairnessData.nonce}
                        </Text>
                    </div>
                </div>

                <div className="fairness-item">
                    <span className="fairness-label">عدد الألغام</span>
                    <div className="fairness-value">
                        <Tag color="error">{minesCount} ألغام</Tag>
                    </div>
                </div>

                <Divider style={{ borderColor: 'rgba(255,255,255,0.06)', margin: '12px 0' }} />

                {revealedSeed && (
                    <div style={{ marginBottom: 12 }}>
                        <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            سيد السيرفر السابق (مكشوف)
                        </Text>
                        <div style={{ background: '#12141d', borderRadius: 6, padding: '8px 12px', marginTop: 4 }}>
                            <Text copyable={{ text: revealedSeed.serverSeed }} style={{ fontSize: 10, wordBreak: 'break-all', color: '#4ade80' }}>
                                {revealedSeed.serverSeed}
                            </Text>
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                    <Button onClick={handleRotateSeed} style={{ flex: 1, background: '#1c1f2e', border: 'none', color: '#fff' }}>
                        <ReloadOutlined /> تغيير السيد
                    </Button>
                    <Button type="primary" onClick={() => setFairnessModalOpen(false)} style={{ flex: 1, background: '#00f0ff', border: 'none', color: '#000', fontWeight: 'bold' }}>
                        إغلاق
                    </Button>
                </div>
            </Modal>

            {/* Play History & Dashboard Modal */}
            <Modal
                title={null}
                open={historyModalOpen}
                onCancel={() => setHistoryModalOpen(false)}
                footer={null}
                width={700}
                centered
                closable={true}
                className="box-modal-3d"
                closeIcon={<CloseOutlined />}
            >
                <div className="history-window-header-title">
                    <div className="icon-wrapper">
                        <HistoryIcon />
                    </div>
                    سجل اللعب ولوحة التحكم
                </div>

                <div className="history-window-content" style={{ marginTop: '24px' }}>

                    <div className="dashboard-section">
                        <h3 className="section-title">إحصائيات كاملة</h3>
                        <div className="glass-panel">
                            <Row gutter={[24, 24]}>
                                <Col span={8}>
                                    <Statistic
                                        title={<span style={{ color: '#94a3b8' }}>إجمالي الربح</span>}
                                        value={totalProfit}
                                        precision={2}
                                        prefix="₿"
                                        valueStyle={{ color: totalProfit >= 0 ? '#4ade80' : '#f87171', fontWeight: 'bold' }}
                                    />
                                </Col>
                                <Col span={8}>
                                    <Statistic
                                        title={<span style={{ color: '#94a3b8' }}>إجمالي الرهانات</span>}
                                        value={winsCount + lossesCount}
                                        valueStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
                                    />
                                </Col>
                                <Col span={8}>
                                    <Statistic
                                        title={<span style={{ color: '#94a3b8' }}>نسبة الفوز</span>}
                                        value={winsCount + lossesCount > 0 ? (winsCount / (winsCount + lossesCount) * 100) : 0}
                                        precision={1}
                                        suffix="%"
                                        valueStyle={{ color: '#fbbf24', fontWeight: 'bold' }}
                                    />
                                </Col>
                            </Row>
                        </div>
                    </div>

                    <div className="dashboard-section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 className="section-title" style={{ margin: 0 }}>اللعبات الأخيرة</h3>
                            <Tooltip title="تصفير الإحصائيات">
                                <Button
                                    type="text"
                                    icon={<ReloadOutlined style={{ color: '#94a3b8' }} />}
                                    onClick={() => {
                                        setWinRecords([]);
                                        setWinsCount(0);
                                        setLossesCount(0);
                                        setTotalProfit(0);
                                        profitHistoryRef.current = [0];
                                    }}
                                />
                            </Tooltip>
                        </div>
                        <div className="glass-panel" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                            {winRecords.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                                    <HistoryIcon style={{ fontSize: 48, opacity: 0.2, marginBottom: 16 }} />
                                    <p>لا يوجد سجل حديث. ضع رهانك لتبدأ اللعب!</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {[...winRecords].reverse().map((record, i) => (
                                        <div key={i} style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '12px 16px',
                                            background: 'rgba(0,0,0,0.2)',
                                            borderRadius: '8px'
                                        }}>
                                            <span style={{ color: '#94a3b8', fontSize: '13px' }}>
                                                {record > 0 ? 'فوز' : 'خسارة'}
                                            </span>
                                            <span style={{
                                                color: record > 0 ? '#4ade80' : '#f87171',
                                                fontWeight: 'bold',
                                                fontFamily: 'monospace',
                                                fontSize: '15px'
                                            }}>
                                                {record > 0 ? '+' : ''}₿{record.toFixed(2)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Live Stats Draggable Widget */}
            {statsDrawerOpen && (
                <div className="fixed-widget fade-in-scale" ref={widgetRef}>
                    <div className="widget-header" onMouseDown={handleDragStart}>
                        <div className="widget-title">
                            <LineChartOutlined style={{ fontSize: 20, color: '#94a3b8' }} />
                            <span>الإحصائيات المباشرة</span>
                        </div>
                        <div className="widget-actions">
                            <Tooltip title="تصفير الإحصائيات" placement="topRight">
                                <button className="widget-btn-icon" onMouseDown={(e) => e.stopPropagation()} onClick={() => {
                                    setWinRecords([]);
                                    setWinsCount(0);
                                    setLossesCount(0);
                                    setTotalProfit(0);
                                    profitHistoryRef.current = [0];
                                }}>
                                    <ReloadOutlined />
                                </button>
                            </Tooltip>
                            <Tooltip title="عرض السجل" placement="topRight">
                                <button className="widget-btn-icon" onMouseDown={(e) => e.stopPropagation()} onClick={() => { setHistoryModalOpen(true); setStatsDrawerOpen(false); }}>
                                    <RightOutlined />
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
                                <p className="label">الربح</p>
                                <p className="value" style={{ color: totalProfit >= 0 ? '#4ade80' : '#f87171' }}>
                                    {totalProfit >= 0 ? '+' : ''}₿{totalProfit.toFixed(2)}
                                </p>
                            </div>
                            <div className="profit-divider"></div>
                            <div className="profit-stats">
                                <div className="stat-row">
                                    <p className="label">فوز</p>
                                    <p className="value" style={{ color: '#4ade80' }}>{winsCount.toLocaleString()}</p>
                                </div>
                                <div className="stat-row">
                                    <p className="label">خسارة</p>
                                    <p className="value" style={{ color: '#f87171' }}>{lossesCount.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>

                        {/* Chart.js Container */}
                        <div className="chart-box" onMouseLeave={() => setHoveredProfitValue(null)}>
                            <p className="label">سجل الأرباح</p>
                            {hoveredProfitValue !== null && (
                                <p className="hovered-value" style={{ color: hoveredProfitValue >= 0 ? '#4ade80' : '#f87171' }}>
                                    {hoveredProfitValue >= 0 ? '+' : ''}₿{hoveredProfitValue.toFixed(2)}
                                </p>
                            )}
                            <div className="canvas-wrapper">
                                <canvas ref={chartCanvasRef}></canvas>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MinesGame;
