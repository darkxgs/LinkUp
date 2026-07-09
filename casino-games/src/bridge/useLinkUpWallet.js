import { useState, useEffect, useCallback, useRef } from 'react';
import { setLang, t } from '../i18n/casinoI18n.js';

const DEMO_BALANCE = 50000;

function isEmbedded() {
  return !!(window.ReactNativeWebView || (window.parent && window.parent !== window));
}

function postToApp(data) {
  const payload = JSON.stringify(data);
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(payload);
  } else if (window.parent && window.parent !== window) {
    window.parent.postMessage(payload, '*');
  }
}

export function useLinkUpWallet() {
  const [balance, setBalance] = useState(isEmbedded() ? 0 : DEMO_BALANCE);
  const [casinoCoins, setCasinoCoins] = useState(0);
  const [avatar, setAvatar] = useState(isEmbedded() ? '' : 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix');
  const [ready, setReady] = useState(!isEmbedded());
  const [gameConfig, setGameConfig] = useState(null);
  const pendingRef = useRef(null);

  useEffect(() => {
    function onMsg(event) {
      try {
        const raw = event?.data;
        if (typeof raw !== 'string' || !raw.length) return;
        const data = JSON.parse(raw);

        if (data.type === 'INIT_DATA') {
          if (data.locale || data.lang) setLang(data.locale || data.lang);
          setBalance(Number(data.balance) || 0);
          setCasinoCoins(Number(data.casinoCoins) || 0);
          setAvatar(data.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix');
          setGameConfig(data.config || null);
          setReady(true);
        } else if (data.type === 'UPDATE_BALANCE') {
          if (data.balance != null) setBalance(Number(data.balance) || 0);
          if (data.casinoCoins != null) setCasinoCoins(Number(data.casinoCoins) || 0);
          if (data.avatar != null) setAvatar(data.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix');
        } else if (data.type === 'BET_CONFIRMED' || data.type === 'BET_CANCELLED') {
          pendingRef.current?.resolve?.();
          pendingRef.current = null;
        } else if (data.type === 'RESULT_RECORDED') {
          pendingRef.current?.resolve?.();
          pendingRef.current = null;
        } else if (data.type === 'ERROR') {
          const err = new Error(data.message || t('walletError'));
          pendingRef.current?.reject?.(err);
          pendingRef.current = null;
        }
      } catch {
        // ignore parse errors
      }
    }

    window.addEventListener('message', onMsg);
    document.addEventListener('message', onMsg);

    if (isEmbedded()) {
      postToApp({ type: 'INIT_GAME' });
    }

    return () => {
      window.removeEventListener('message', onMsg);
      document.removeEventListener('message', onMsg);
    };
  }, []);

  const waitForBridge = useCallback((send) => {
    return new Promise((resolve, reject) => {
      if (!isEmbedded()) {
        send();
        resolve();
        return;
      }
      pendingRef.current = { resolve, reject };
      send();
      setTimeout(() => {
        if (pendingRef.current) {
          pendingRef.current.reject(new Error(t('connectionTimeout')));
          pendingRef.current = null;
        }
      }, 15000);
    });
  }, []);

  const placeBet = useCallback(async (stake) => {
    const amount = Math.floor(Number(stake));
    if (!amount || amount <= 0) throw new Error(t('invalidStake'));
    if (!isEmbedded()) {
      if (balance < amount) throw new Error(t('insufficientBalance'));
      setBalance((b) => b - amount);
      return;
    }
    await waitForBridge(() => postToApp({ type: 'PLACE_BET', stake: amount }));
  }, [balance, waitForBridge]);

  const cancelBet = useCallback(async (stake) => {
    const amount = Math.floor(Number(stake));
    if (!amount || amount <= 0) throw new Error(t('invalidStake'));
    if (!isEmbedded()) {
      setBalance((b) => b + amount);
      return;
    }
    await waitForBridge(() => postToApp({ type: 'CANCEL_BET', stake: amount }));
  }, [waitForBridge]);

  const recordResult = useCallback(async ({ stake, winAmount, isWin, multiplier, result }) => {
    const s = Math.floor(Number(stake) || 0);
    const win = Math.floor(Number(winAmount) || 0);
    if (!isEmbedded()) {
      if (isWin && win > 0) setBalance((b) => b + win);
      return;
    }
    await waitForBridge(() =>
      postToApp({
        type: 'GAME_RESULT',
        stake: s,
        winAmount: win,
        isWin: !!isWin,
        multiplier: Number(multiplier) || (s > 0 && win > 0 ? win / s : 0),
        result: result || {},
      }),
    );
  }, [waitForBridge]);

  /** في WebView — الرصيد يُحدَّث عبر UPDATE_BALANCE من التطبيق فقط */
  const addWinnings = useCallback((amount) => {
    if (isEmbedded()) return;
    const v = Number(amount) || 0;
    if (v > 0) setBalance((b) => b + v);
  }, []);

  return {
    balance,
    casinoCoins,
    avatar,
    ready,
    gameConfig,
    placeBet,
    cancelBet,
    recordResult,
    addWinnings,
    isEmbedded: isEmbedded(),
  };
}
