// Sidebar Component - Direct port from Sidebar.svelte
import { useState } from 'react';
import { ROW_COUNT_OPTIONS, getBinColors } from './constants';
import { CurrencyIcon, currencyName } from '../../config/currency';
import { t } from '../../i18n/casinoI18n.js';
import './Sidebar.css';
import { Tooltip, Tag, InputNumber, Button, Typography } from 'antd';
import { TrophyOutlined, StarOutlined, FireOutlined } from '@ant-design/icons';

const { Text } = Typography;

function Sidebar({
    balance,
    betAmount,
    setBetAmount,
    minBet = 100,
    maxBet = 100000,
    ready = true,
    rowCount,
    setRowCount,
    riskLevel,
    setRiskLevel,
    hasOutstandingBalls,
    onDropBall,
    onSettingsClick,
    onStatsClick,
    isSettingsOpen,
    isStatsOpen,
    // Plinko-specific props
    selectedBallType,
    setSelectedBallType,
    ballTypes,
    currentBall,
    lastWin,
    winRecords,
    currentStreak,
    maxStreak,
}) {
    const [isBallSelectorExpanded, setIsBallSelectorExpanded] = useState(false);

    const isBetAmountNegative = betAmount < minBet;
    const isBetExceedBalance = betAmount > balance;
    const isDropBallDisabled = !ready || isBetAmountNegative || isBetExceedBalance || hasOutstandingBalls;

    const riskLevels = [
        { value: 'low', label: t('riskLow') },
        { value: 'medium', label: t('riskMedium') },
        { value: 'high', label: t('riskHigh') },
    ];

    return (
        <div className="sidebar">
            <div className="sidebar-balance-compact">
                <span className="sidebar-balance-label">{t('balance')}</span>
                <span className="sidebar-balance-value">
                    <CurrencyIcon size={14} />
                    {Math.floor(balance).toLocaleString('en-US')}
                </span>
            </div>

            <button
                className="bet-button"
                onClick={() => onDropBall?.()}
                disabled={isDropBallDisabled}
                style={{ marginBottom: '16px' }}
            >
                {hasOutstandingBalls ? t('waitBallLand') : t('dropBall')}
            </button>

            <p className="sidebar-hint" style={{ margin: '-8px 0 12px', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>
                {t('manualDropHint')}
            </p>

            {/* Bet Amount */}
            <div className="form-group">
                <div className="form-header">
                    <label htmlFor="betAmount" className="form-label" style={{ margin: 0 }}>{t('betAmount')}</label>
                    <Text type="secondary" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CurrencyIcon size={14} />
                        {(betAmount ?? 0).toFixed(2)}
                    </Text>
                </div>
                <div className="input-row">
                    <InputNumber
                        id="betAmount"
                        value={betAmount}
                        onChange={(val) => setBetAmount(Math.min(maxBet, Math.max(minBet, Math.floor(Number(val) || minBet))))}
                        min={minBet}
                        max={maxBet}
                        step={1}
                        disabled={hasOutstandingBalls}
                        style={{ flex: 1 }}
                        controls={false}
                        formatter={(v) => `${v}`}
                        parser={(v) => v.replace(/\$\s?|(,*)/g, '')}
                        addonBefore={<div className="btc-icon" style={{display:'flex', alignItems:'center', justifyContent:'center'}}><CurrencyIcon size={16} /></div>}
                    />
                    <Button.Group>
                        <Button
                            onClick={() => setBetAmount(prev => parseFloat((Number(prev || 0) / 2).toFixed(2)))}
                            disabled={hasOutstandingBalls}
                        >
                            ½
                        </Button>
                        <Button
                            onClick={() => setBetAmount(prev => parseFloat((Number(prev || 0) * 2).toFixed(2)))}
                            disabled={hasOutstandingBalls}
                        >
                            2×
                        </Button>
                    </Button.Group>
                </div>
                {isBetAmountNegative && (
                    <p className="error-text">{t('minBetError', { min: minBet.toLocaleString(), currency: currencyName() })}</p>
                )}
                {isBetExceedBalance && (
                    <p className="error-text">{t('cannotBetMoreThanBalance')}</p>
                )}
            </div>

            <div className="plinko-settings-pair">
                {/* Risk Level */}
                <div className="form-group">
                    <label htmlFor="riskLevel" className="form-label">{t('risk')}</label>
                    <select
                        id="riskLevel"
                        value={riskLevel}
                        onChange={(e) => setRiskLevel(e.target.value)}
                        disabled={hasOutstandingBalls}
                        className="form-select"
                    >
                        {riskLevels.map(({ value, label }) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                </div>

                {/* Row Count */}
                <div className="form-group">
                    <label htmlFor="rowCount" className="form-label">{t('rows')}</label>
                    <select
                        id="rowCount"
                        value={rowCount}
                        onChange={(e) => setRowCount(parseInt(e.target.value))}
                        disabled={hasOutstandingBalls}
                        className="form-select"
                    >
                        {ROW_COUNT_OPTIONS.map((value) => (
                            <option key={value} value={value}>{value}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Footer */}
            <div className="sidebar-footer">
                <div className="footer-buttons">
                    <button
                        className={`footer-btn ${isStatsOpen ? 'active' : ''}`}
                        onClick={onStatsClick}
                        title={t('liveStats')}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M16 11.78l4.24-7.33 1.73 1-5.23 9.05-6.51-3.75L5.46 19H22v2H2V3h2v14.54L9.5 8z" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* --- Plinko extra: Ball Selector, Last Win, Streak --- */}
            <div className="ball-selector-card sidebar-card">
                <div 
                    className="ball-selector-header" 
                    onClick={() => setIsBallSelectorExpanded(!isBallSelectorExpanded)}
                    style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <StarOutlined />
                        <span>{t('ballType')}</span>
                        {!isBallSelectorExpanded && selectedBallType && (
                            <span style={{ fontSize: '12px', background: '#2a3f4d', padding: '2px 8px', borderRadius: '10px', color: '#10b981' }}>
                                {ballTypes[selectedBallType]?.name}
                            </span>
                        )}
                    </div>
                    <span>{isBallSelectorExpanded ? '▲' : '▼'}</span>
                </div>
                {isBallSelectorExpanded && (
                <div className="ball-types-grid">
                    {Object.values(ballTypes || {}).map(ball => (
                        <Tooltip
                            key={ball.id}
                            title={
                                <div>
                                    <div style={{ fontWeight: 600 }}>{ball.name}</div>
                                    <div>{ball.description}</div>
                                    <div style={{ color: 'var(--text-secondary)' }}>{t('ballCost', { cost: ball.cost })}</div>
                                </div>
                            }
                        >
                            <div
                                className={`ball-type-option ${selectedBallType === ball.id ? 'selected' : ''}`}
                                onClick={() => setSelectedBallType?.(ball.id)}
                                style={{ '--ball-color': ball.color }}
                            >
                                <div
                                    className="ball-color-circle"
                                    style={{ backgroundImage: `url(${ball.image})`, backgroundSize: 'cover', backgroundColor: 'transparent' }}
                                ></div>
                                <div className="ball-type-content">
                                    <div className="ball-type-name">{ball.name}</div>
                                    <div className="ball-type-cost">{ball.cost}×</div>
                                </div>
                            </div>
                        </Tooltip>
                    ))}
                </div>
                )}
            </div>

            {/* Last Win card removed as requested */}

            {/* Streak UI moved to History & Statistics */}
        </div>
    );
}

export default Sidebar;
