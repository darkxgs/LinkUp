import { useState, useEffect } from 'react';
import { SoundOutlined, SettingOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { Modal, Tabs, Slider, message } from 'antd';
import './PlayerBets.css';

// Mock player data for the exact image clone look
const generatePlayers = () => {
    return [
        { id: '2****1', bet: 37.79, x: null, win: null },
        { id: '2****2', bet: 9.85, x: 1.21, win: 11.92 },
        { id: '2****2', bet: 9.85, x: null, win: null },
        { id: '2****5', bet: 7.55, x: null, win: null },
        { id: '1****2', bet: 6.67, x: null, win: null },
        { id: '1****2', bet: 6.67, x: null, win: null },
        { id: '2****5', bet: 3.08, x: null, win: null },
        { id: '2****5', bet: 3.06, x: null, win: null },
        { id: '4****3', bet: 2.68, x: null, win: null },
        { id: '4****8', bet: 2.68, x: null, win: null },
        { id: '4****3', bet: 2.68, x: null, win: null },
        { id: '3****8', bet: 2.6, x: null, win: null },
        { id: '0****1', bet: 1.62, x: null, win: null },
    ];
};

function PlayerBets({ phase, multiplier, onPlayerCashout, userBetData, balance = 0, casinoCoins = 0, avatar, minBet = 100, maxBet = 100000 }) {
    const [players, setPlayers] = useState(generatePlayers());
    const [showOptions, setShowOptions] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    
    // Sliders state
    const [musicVolume, setMusicVolume] = useState(15);
    const [soundVolume, setSoundVolume] = useState(80);

    const [activeTab, setActiveTab] = useState('Live Bets');

    const historyPlayers = [
        { id: '1****8', bet: 50.00, x: 2.50, win: 125.00 },
        { id: '2****1', bet: 10.00, x: 1.50, win: 15.00 },
        { id: '0****5', bet: 5.00, x: null, win: null },
        { id: '3****4', bet: 25.00, x: 3.10, win: 77.50 },
        { id: '4****9', bet: 100.00, x: 1.10, win: 110.00 },
        { id: '8****1', bet: 15.00, x: null, win: null },
        { id: '7****2', bet: 20.00, x: 5.00, win: 100.00 },
    ];

    const topWinnerPlayers = [
        { id: '9****9', bet: 500.00, x: 10.50, win: 5250.00 },
        { id: '8****1', bet: 200.00, x: 15.00, win: 3000.00 },
        { id: '7****2', bet: 150.00, x: 12.00, win: 1800.00 },
        { id: '6****3', bet: 50.00, x: 25.00, win: 1250.00 },
        { id: '5****4', bet: 10.00, x: 100.00, win: 1000.00 },
        { id: '4****5', bet: 5.00, x: 500.00, win: 2500.00 },
    ];

    // Sync music volume with global App.jsx audio
    useEffect(() => {
        window.dispatchEvent(new CustomEvent('musicVolumeChange', { detail: musicVolume / 100 }));
    }, [musicVolume]);

    // Sync sound volume with global AudioManager
    useEffect(() => {
        window.dispatchEvent(new CustomEvent('soundVolumeChange', { detail: soundVolume / 100 }));
    }, [soundVolume]);

    const infoTabs = [
        {
            key: 'about',
            label: 'عن اللعبة',
            children: (
                <div className="clone-info-content">
                    <h3>عن اللعبة</h3>
                    <p>لعبة Aviabet هي لعبة مستمرة يمكن للاعبين الانضمام إليها في أي وقت. في بداية جولة اللعبة، تبدأ الطائرة في التحليق لأعلى، بينما يبدأ مضاعف اللعبة في الازدياد من x1.00 ويمكن أن يتوقف في أي وقت بشكل عشوائي. يتم تحديد مضاعف اللعبة بواسطة مُولد أرقام عشوائية معتمد (RNG).</p>
                    <p>الهدف من اللعبة هو الضغط على زر "سحب الأرباح" (Cashout) قبل نهاية الجولة. تعتبر الجولة منتهية عندما يتوقف مضاعف اللعبة وتخرج الطائرة من اللعبة.</p>
                    <h3>كيف تلعب؟</h3>
                    <p>للمشاركة في اللعبة، يجب على اللاعبين دفع رسوم المشاركة قبل بدء الجولة، ثم الانتظار حتى تبدأ اللعبة.</p>
                    <ul>
                        <li>الحد الأدنى للرهان: {minBet.toLocaleString()} كوين</li>
                        <li>الحد الأقصى للرهان: {maxBet.toLocaleString()} كوين</li>
                        <li>الحد الأقصى للربح: 20000</li>
                        <li>الحد الأدنى للمضاعف الذي يمكن للاعب السحب عنده هو x1.01</li>
                    </ul>
                    <p>يمكن أن يختلف الحد الأقصى لمضاعف السحب بين x100 إلى x400,000 اعتماداً على مبلغ رهان اللاعب.</p>
                    <p>يفوز اللاعب إذا تمكن من إجراء "سحب الأرباح" قبل أن يتوقف مضاعف اللعبة. يخسر اللاعب إذا لم يتمكن من ذلك.</p>
                </div>
            )
        },
        {
            key: 'autobet',
            label: 'الرهان التلقائي',
            children: (
                <div className="clone-info-content">
                    <h3>الرهان التلقائي (Auto Bet)</h3>
                    <p>يمكن للاعبين أيضاً استخدام ميزة "الرهان التلقائي". للعب في وضع "الرهان التلقائي"، يجب على اللاعب إدخال مبلغ الرهان المطلوب، والنقر على زر "الرهان التلقائي"، واختيار عدد الجولات والنقر على زر "بدء"، وبعد ذلك سيقوم النظام تلقائياً بخصم رسوم المشاركة للاعب خلال كل جولة تساوي المبلغ الذي أدخله اللاعب.</p>
                    <p>يمتلك اللاعب أيضاً فرصة التفعيل المسبق لوظيفة السحب التلقائي من الجولة ("السحب التلقائي") في وضع "الرهان التلقائي".</p>
                </div>
            )
        },
        {
            key: 'autocashout',
            label: 'السحب التلقائي',
            children: (
                <div className="clone-info-content">
                    <h3>السحب التلقائي (Auto Cashout)</h3>
                    <p>يتمتع اللاعب بفرصة التفعيل المسبق لميزة السحب التلقائي من جولة اللعبة عن طريق إدخال المضاعف المطلوب، والذي يمكن أن يتراوح من x1.01 إلى x250,000 اعتماداً على حجم الرهان.</p>
                    <p>عند اللعب بهذه الميزة، يقوم النظام تلقائياً بإخراج اللاعب من جولة اللعبة عندما تصل احتمالات اللعبة إلى الحد الذي حدده اللاعب مسبقاً، ولكن يمكن للاعب أيضاً النقر على زر سحب الأرباح في أي وقت والخروج من جولة اللعبة بربح عند المضاعف الحالي.</p>
                    <p>إذا توقف المضاعف قبل الوصول إلى المضاعف الذي اختاره اللاعب، يخسر اللاعب.</p>
                </div>
            )
        },
        {
            key: 'fairness',
            label: 'النزاهة',
            children: (
                <div className="clone-info-content">
                    <h3>النزاهة (Fairness)</h3>
                    <p>قبل بدء جولة اللعبة، يتم تزويد اللاعبين بـ "رمز التشفير" (Hash Code) - وهو تركيبة نصية مشفرة. يحتوي هذا الرمز على المضاعف الذي سيمثل نتيجة اللعبة. أي أن المضاعف لا يتم تحديده أثناء اللعبة، بل مسبقاً لـ 5 جولات، ويتم إعطاؤه للاعبين بشكل مشفر.</p>
                    <p>في نهاية جولة اللعبة، يتم إعطاء اللاعبين "مفتاح" (Key) ومعلمة إدخال إضافية "الملح" (Salt) للحصول على "رمز التشفير".</p>
                    <p>يمكن لكل لاعب تكرار وتشفير هذه التركيبة للتأكد من أن "المفتاح" المشفر يطابق "رمز التشفير" المقدم من النظام مسبقاً. تثبت هذه التكنولوجيا نزاهة اللعبة وتؤكد للاعبين أن نتيجة اللعبة محددة مسبقاً.</p>
                </div>
            )
        }
    ];

    // Update dynamically if game is running (simple simulation)
    useEffect(() => {
        if (phase === 'waiting') {
            setPlayers(generatePlayers().map(p => ({...p, x: null, win: null})));
        } else if (phase === 'running') {
            // randomly cash out people as multiplier goes up
            setPlayers(prev => prev.map(p => {
                if (!p.x && Math.random() < 0.02) {
                    return { ...p, x: multiplier, win: (p.bet * multiplier).toFixed(2) };
                }
                return p;
            }));
        }
    }, [phase, multiplier]);

    return (
        <div className="clone-sidebar-container">
            {/* Top Profile Bar */}
            <div className="clone-sidebar-header">
                <div className="clone-profile">
                    <div className="clone-avatar">
                        <img src={avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"} alt="Avatar" />
                    </div>
                    <span className="clone-balance" title="رصيد اللعب">{balance.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                    {casinoCoins > 0 && (
                        <span style={{ fontSize: 10, color: '#10b981', fontWeight: 700 }}>
                            كازينو: {casinoCoins.toLocaleString()}
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '8px', position: 'relative', alignItems: 'center' }}>
                    <div className={`clone-options-menu ${showOptions ? 'open' : ''}`}>
                        <SoundOutlined onClick={() => setIsSettingsOpen(true)} />
                        <div className="clone-divider" />
                        <SettingOutlined onClick={() => setIsSettingsOpen(true)} />
                        <div className="clone-divider" />
                        <InfoCircleOutlined onClick={() => setIsInfoOpen(true)} />
                    </div>

                    <button className="clone-more-btn" onClick={() => setShowOptions(!showOptions)}>•••</button>

                    {/* Settings Modal (Popup Tooltip Style) */}
                    {isSettingsOpen && (
                        <div className="clone-settings-popup">
                            <div className="popup-arrow" />
                            <div className="setting-row">
                                <div className="setting-label">Music</div>
                                <div className="setting-slider-container">
                                    <Slider 
                                        value={musicVolume} 
                                        onChange={(val) => {
                                            setMusicVolume(val);
                                            window.dispatchEvent(new CustomEvent('musicVolumeChange', { detail: val / 100 }));
                                        }} 
                                        tooltip={{ open: false }} 
                                        className="custom-slider music-slider" 
                                    />
                                </div>
                            </div>
                            <div className="setting-row">
                                <div className="setting-label">Sound</div>
                                <div className="setting-slider-container">
                                    <Slider 
                                        value={soundVolume} 
                                        onChange={(val) => {
                                            setSoundVolume(val);
                                            window.dispatchEvent(new CustomEvent('soundVolumeChange', { detail: val / 100 }));
                                        }} 
                                        tooltip={{ open: false }} 
                                        className="custom-slider sound-slider" 
                                    />
                                </div>
                            </div>
                            <button className="close-popup" onClick={() => setIsSettingsOpen(false)}>×</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="clone-tabs">
                <div className={`clone-tab ${activeTab === 'Live Bets' ? 'active' : ''}`} onClick={() => setActiveTab('Live Bets')}>Live Bets</div>
                <div className={`clone-tab ${activeTab === 'History' ? 'active' : ''}`} onClick={() => setActiveTab('History')}>History</div>
                <div className={`clone-tab ${activeTab === 'Top Winners' ? 'active' : ''}`} onClick={() => setActiveTab('Top Winners')}>Top Winners</div>
            </div>

            {/* Table Headers */}
            <div className="clone-table-header">
                <span>Player ID</span>
                <span>Bet</span>
                <span>x</span>
                <span style={{ textAlign: 'right' }}>Win</span>
            </div>

            {/* Table List */}
            <div className="clone-table-list">
                {(activeTab === 'Live Bets' ? players : activeTab === 'History' ? historyPlayers : topWinnerPlayers).map((p, i) => (
                    <div key={i} className={`clone-table-row ${p.win ? 'won' : ''}`}>
                        <span>{p.id}</span>
                        <span>{p.bet}</span>
                        <span className={p.win ? 'clone-win-text' : ''}>{p.x ? `x${p.x.toFixed(2)}` : '--'}</span>
                        <span style={{ textAlign: 'right' }} className={p.win ? 'clone-win-text' : ''}>
                            {p.win ? p.win : '...'}
                        </span>
                    </div>
                ))}
            </div>

            {/* Info Modal */}
            <Modal
                title="معلومات اللعبة (Info)"
                open={isInfoOpen}
                onCancel={() => setIsInfoOpen(false)}
                footer={null}
                width={800}
                className="clone-info-modal"
                closeIcon={<span style={{ color: '#fff', fontSize: '20px' }}>×</span>}
                centered
            >
                <Tabs 
                    tabPosition="left" 
                    items={infoTabs} 
                    className="clone-info-tabs"
                />
            </Modal>
        </div>
    );
}

export default PlayerBets;
