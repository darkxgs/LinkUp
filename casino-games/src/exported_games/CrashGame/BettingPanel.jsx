import { useState, useEffect } from 'react';
import { Typography } from 'antd';
import { MinusOutlined, PlusOutlined } from '@ant-design/icons';
import { currencyName } from '../../config/currency';
import { t } from '../../i18n/casinoI18n.js';
import './BettingPanel.css';

const { Text } = Typography;

function BettingPanel({
    phase,
    betPlaced,
    roundActive = false,
    multiplier,
    onBet,
    onCashout,
    onCancelBet,
    minBet = 100,
    maxBet = 100000,
    presets = [100, 500, 1000, 5000],
    defaultBet = 100,
    balance = 0,
    ready = true,
}) {
    const [betAmount, setBetAmount] = useState(defaultBet);

    useEffect(() => {
        setBetAmount((prev) => {
            const n = Math.floor(Number(prev) || defaultBet);
            return Math.min(maxBet, Math.max(minBet, n || defaultBet));
        });
    }, [defaultBet, minBet, maxBet]);

    const clampBet = (value) => {
        const n = Math.floor(Number(value) || minBet);
        return Math.min(maxBet, Math.max(minBet, n));
    };

    const adjustBet = (delta) => {
        setBetAmount((prev) => clampBet((Number(prev) || minBet) + delta));
    };

    const handleBetClick = () => {
        const stake = clampBet(betAmount);
        if (phase === 'waiting' && betPlaced && roundActive) {
            onCancelBet?.();
            return;
        }
        if (phase === 'waiting' && !betPlaced && !roundActive) {
            onBet(stake);
            return;
        }
        if (phase === 'running' && betPlaced) {
            onCashout();
        }
    };

    const getButtonText = () => {
        if (phase === 'running' && betPlaced) {
            return t('cashOutAt', { mult: multiplier.toFixed(2) });
        }
        if (phase === 'waiting' && betPlaced && roundActive) {
            return t('cancelBet');
        }
        if (phase === 'waiting' && roundActive && !betPlaced) {
            return t('watchLaunch');
        }
        if (phase === 'crashed') {
            return t('waitRoundEnd');
        }
        return t('startBet');
    };

    const getHintText = () => {
        if (phase === 'running' && betPlaced) {
            return t('betActiveCashOut');
        }
        if (phase === 'waiting' && betPlaced && roundActive) {
            return t('canCancelBeforeLaunch');
        }
        if (!roundActive && !betPlaced) {
            return t('rocketNeedsBet');
        }
        return '';
    };

    const stake = clampBet(betAmount);
    const canBet = ready && stake <= balance;
    const isCashout = phase === 'running' && betPlaced;
    const isCancel = phase === 'waiting' && betPlaced && roundActive;
    const controlsLocked = roundActive || betPlaced || phase === 'running' || phase === 'crashed';
    const mainDisabled =
        (phase === 'waiting' && !betPlaced && !roundActive && !canBet) ||
        (phase === 'waiting' && roundActive && !betPlaced) ||
        phase === 'crashed';

    return (
        <div className="clone-betting-panel">
            <div className="clone-betting-controls">
                <div className="clone-input-row">
                    <button
                        type="button"
                        className="clone-icon-btn"
                        disabled={controlsLocked}
                        onClick={() => adjustBet(-Math.max(1, Math.floor(minBet / 2)))}
                    >
                        <MinusOutlined />
                    </button>
                    <input
                        type="number"
                        min={minBet}
                        max={maxBet}
                        step={1}
                        value={betAmount}
                        disabled={controlsLocked}
                        onChange={(e) => setBetAmount(clampBet(e.target.value))}
                        className="clone-amount-input"
                    />
                    <button
                        type="button"
                        className="clone-icon-btn"
                        disabled={controlsLocked}
                        onClick={() => adjustBet(Math.max(1, Math.floor(minBet / 2)))}
                    >
                        <PlusOutlined />
                    </button>
                </div>

                <div className="clone-preset-grid">
                    {presets.map((preset) => (
                        <button
                            key={preset}
                            type="button"
                            className={`clone-preset-btn${stake === preset ? ' active' : ''}`}
                            disabled={controlsLocked}
                            onClick={() => setBetAmount(preset)}
                        >
                            {preset >= 1000 ? `${Math.round(preset / 1000)}k` : preset}
                        </button>
                    ))}
                </div>

                {getHintText() ? (
                    <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, textAlign: 'center', display: 'block' }}>
                        {getHintText()}
                    </Text>
                ) : null}
            </div>

            <div className="clone-betting-action">
                <button
                    type="button"
                    className={`clone-main-btn${isCashout ? ' cashout' : ''}${isCancel ? ' cancel' : ''}`}
                    onClick={handleBetClick}
                    disabled={mainDisabled}
                >
                    <div className="btn-text">{getButtonText()}</div>
                    {!betPlaced && phase === 'waiting' && !roundActive && (
                        <div className="btn-amount">{stake.toLocaleString()} {currencyName()}</div>
                    )}
                </button>
            </div>
        </div>
    );
}

export default BettingPanel;
