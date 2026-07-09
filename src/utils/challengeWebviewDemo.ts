/**
 * محاكاة تحديات 1v1 داخل لوحة التحكم (بدون Firestore).
 */

export const DEMO_CHALLENGER_ID = 'admin-demo-challenger';
export const DEMO_OPPONENT_ID = 'admin-demo-opponent';

export const CHALLENGE_WEBVIEW_IDS = new Set(['penalty-kicks', 'pool', 'coin-challenge', 'coin-flip']);

export type DemoChallenge = {
  id: string;
  challengerId: string;
  challengerName: string;
  challengerAvatar: string;
  challengedId: string;
  challengedName: string;
  challengedAvatar: string;
  gameId: 'penalty' | 'coin-flip' | 'billiards';
  bet: number;
  status: 'active' | 'completed';
  createdAt: number;
  turn: string;
  winnerId?: string | null;
  gameState: Record<string, unknown>;
};

export function isChallengeWebviewGame(id: string): boolean {
  return CHALLENGE_WEBVIEW_IDS.has(id);
}

export function createDemoChallenge(testGameId: string, economy?: { challengeStakeChips?: number[]; billiardsTurnMs?: number }): DemoChallenge {
  const bet = economy?.challengeStakeChips?.[0] ?? 10_000;
  const billiardsMs = economy?.billiardsTurnMs ?? 420_000;
  const base = {
    id: `demo-${testGameId}`,
    challengerId: DEMO_CHALLENGER_ID,
    challengerName: 'أنت',
    challengerAvatar: 'https://i.pravatar.cc/100?img=11',
    challengedId: DEMO_OPPONENT_ID,
    challengedName: 'اللاعب الثاني',
    challengedAvatar: 'https://i.pravatar.cc/100?img=12',
    bet: bet,
    status: 'active' as const,
    createdAt: Date.now(),
    turn: DEMO_CHALLENGER_ID,
  };

  if (testGameId === 'penalty-kicks') {
    return {
      ...base,
      gameId: 'penalty',
      gameState: {
        round: 1,
        phase: 'shooting',
        challengerScore: 0,
        opponentScore: 0,
        lastResult: '',
        challengerChoice: null,
        opponentChoice: null,
        turn: DEMO_CHALLENGER_ID,
      },
    };
  }

  if (testGameId === 'pool') {
    return {
      ...base,
      gameId: 'billiards',
      gameState: {
        challengerTime: billiardsMs,
        opponentTime: billiardsMs,
        currentTurnStartedAt: Date.now(),
        challengerPotted: 0,
        opponentPotted: 0,
        ballsSnapshot: null,
      },
    };
  }

  return {
    ...base,
    gameId: 'coin-flip',
    gameState: {
      round: 1,
      p1Choice: null,
      p2Choice: null,
      roundResults: [] as string[],
      flipResult: null,
      turn: DEMO_CHALLENGER_ID,
    },
  };
}

function pickPenaltySpot(): 'left' | 'center' | 'right' {
  const spots: Array<'left' | 'center' | 'right'> = ['left', 'center', 'right'];
  return spots[Math.floor(Math.random() * spots.length)];
}

function maybeFillPenaltyOpponent(state: Record<string, unknown>): boolean {
  const phase = state.phase as string;
  const hasCh = state.challengerChoice != null;
  const hasOp = state.opponentChoice != null;
  if (hasCh && hasOp) return false;

  if (phase === 'shooting' && hasCh && !hasOp) {
    state.opponentChoice = pickPenaltySpot();
    return true;
  }
  if (phase === 'goalkeeping' && hasOp && !hasCh) {
    state.challengerChoice = pickPenaltySpot();
    return true;
  }
  if (phase === 'shooting' && !hasCh && hasOp) {
    state.challengerChoice = pickPenaltySpot();
    return true;
  }
  if (phase === 'goalkeeping' && !hasOp && hasCh) {
    state.opponentChoice = pickPenaltySpot();
    return true;
  }
  return false;
}

function maybeAutoCoinRound2(challenge: DemoChallenge): DemoChallenge | null {
  const state = { ...challenge.gameState };
  if (state.round !== 2) return null;
  if (state.p2Choice != null || state.flipResult != null) return null;

  const side = Math.random() > 0.5 ? 'heads' : 'tails';
  state.p2Choice = side;
  state.p1Choice = side === 'heads' ? 'tails' : 'heads';
  state.flipResult = Math.random() > 0.5 ? 'heads' : 'tails';
  return { ...challenge, gameState: state };
}

function pushStateUpdate(
  challenge: DemoChallenge,
  postToIframe: (data: object) => void,
  delayMs = 0,
) {
  const payload = {
    type: 'STATE_UPDATE',
    challenge,
    role: 'challenger',
    myRole: 'challenger',
  };
  if (delayMs > 0) {
    setTimeout(() => postToIframe(payload), delayMs);
  } else {
    postToIframe(payload);
  }
}

export type ChallengeDemoHandlers = {
  getChallenge: () => DemoChallenge;
  setChallenge: (c: DemoChallenge) => void;
  postToIframe: (data: object) => void;
  addLog: (msg: string) => void;
  setDemoBalance?: React.Dispatch<React.SetStateAction<number>>;
};

export function handleChallengeIframeMessage(
  data: Record<string, unknown>,
  testGameId: string,
  handlers: ChallengeDemoHandlers,
): boolean {
  const { getChallenge, setChallenge, postToIframe, addLog, setDemoBalance } = handlers;

  if (data.type === 'INIT_GAME') {
    /* التهيئة تتم من GameSimulatorModal عبر onLoad / sendInitToIframe */
    return true;
  }

  if (data.type === 'MAKE_MOVE') {
    const incoming = (data.gameState ?? {}) as Record<string, unknown>;
    const prev = getChallenge();
    const merged: DemoChallenge = {
      ...prev,
      gameState: { ...prev.gameState, ...incoming },
      turn: typeof data.nextTurn === 'string' && data.nextTurn ? data.nextTurn : prev.turn,
    };

    if (testGameId === 'penalty-kicks') {
      const state = { ...merged.gameState };
      const hasCh = state.challengerChoice != null;
      const hasOp = state.opponentChoice != null;
      const onePick = (hasCh && !hasOp) || (!hasCh && hasOp);

      if (onePick) {
        if (maybeFillPenaltyOpponent(state)) {
          addLog('اللاعب الثاني اختار: ' + String(state.opponentChoice ?? state.challengerChoice));
        }
        merged.gameState = state;
        setChallenge(merged);
        pushStateUpdate(merged, postToIframe, 450);
        addLog('مزامنة حركة الجزاء');
        return true;
      }

      // بعد انتهاء الأنيميشن: مزامنة الجولة التالية دون إعادة تشغيل الأنيميشن
      if (!hasCh && !hasOp) {
        merged.gameState = state;
        setChallenge(merged);
        pushStateUpdate(merged, postToIframe);
        addLog(
          `الجولة ${String(state.round ?? 1)}/5 — ${state.phase === 'goalkeeping' ? 'تصدي' : 'تسديد'}`,
        );
        return true;
      }

      setChallenge(merged);
      return true;
    }

    if (testGameId === 'coin-challenge' || testGameId === 'coin-flip') {
      setChallenge(merged);

      if (incoming.flipResult != null) {
        pushStateUpdate(merged, postToIframe);
        addLog('رمي العملة');
        return true;
      }

      const autoRound2 = maybeAutoCoinRound2(merged);
      if (autoRound2) {
        addLog('الجولة 2: دور اللاعب الثاني...');
        setTimeout(() => {
          setChallenge(autoRound2);
          pushStateUpdate(autoRound2, postToIframe);
        }, 1600);
      }
      return true;
    }

    if (testGameId === 'pool') {
      setChallenge(merged);

      // إذا أصبح دور الخصم، نقوم بمحاكاة تسديدة الكمبيوتر بعد مهلة زمنية قصيرة
      if (merged.turn === DEMO_OPPONENT_ID) {
        addLog('الخصم (الكمبيوتر) يحدد زاوية التسديدة...');
        setTimeout(() => {
          const current = getChallenge();
          if (current.turn !== DEMO_OPPONENT_ID || current.status === 'completed') return;

          const state = { ...current.gameState };
          const ballsState = (state.ballsState ?? []) as any[];
          const cue = ballsState.find((b: any) => b.isCue);
          const targets = ballsState.filter((b: any) => !b.isCue);

          let angle = Math.random() * Math.PI * 2;
          if (cue && targets.length > 0) {
            // استهداف كرة عشوائية وحساب الزاوية نحوها
            const target = targets[Math.floor(Math.random() * targets.length)];
            const dx = target.x - cue.x;
            const dy = target.y - cue.y;
            // إضافة نسبة خطأ عشوائية لواقعية اللعب
            angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.22;
          }

          // قوة ضرب عشوائية معقولة
          const force = 6 + Math.random() * 8;
          if (cue) {
            cue.vx = Math.cos(angle) * force;
            cue.vy = Math.sin(angle) * force;
          }

          state.ballsState = ballsState;
          state.currentTurnStartedAt = Date.now();

          const shotMerged: DemoChallenge = {
            ...current,
            gameState: state,
            turn: DEMO_CHALLENGER_ID, // إعادة الدور للاعب الأول
          };

          setChallenge(shotMerged);
          pushStateUpdate(shotMerged, postToIframe);
          addLog(`الخصم (الكمبيوتر) سدد الكرة البيضاء بزاوية ${Math.round(angle * 180 / Math.PI)}° وقوة ${force.toFixed(1)}`);
        }, 2500);
      } else {
        // إعادة إرسال الحالة كما هي لتحديث WebView بالسرعات الفيزيائية للكرات
        pushStateUpdate(merged, postToIframe);
      }
      return true;
    }

    setChallenge(merged);
    return true;
  }

  if (data.type === 'GAME_OVER') {
    const winnerId = data.winnerId as string | null | undefined;
    const challenge = getChallenge();
    const completed = {
      ...challenge,
      status: 'completed' as const,
      winnerId: winnerId ?? null,
    };
    setChallenge(completed);

    const bet = challenge.bet;

    if (winnerId === DEMO_CHALLENGER_ID) {
      addLog('🏆 فزت بالتحدي!');
      if (setDemoBalance) {
        setDemoBalance((prev) => prev + bet * 2);
        addLog(`تم إضافة أرباح التحدي: +${bet * 2} كوين`);
      }
    } else if (winnerId === DEMO_OPPONENT_ID) {
      addLog('💔 خسارة التحدي');
      addLog(`خسرت الرهان بقيمة: -${bet} كوين`);
    } else {
      addLog('🤝 تعادل في التحدي');
      if (setDemoBalance) {
        setDemoBalance((prev) => prev + bet);
        addLog(`تم إرجاع قيمة الرهان: +${bet} كوين`);
      }
    }
    pushStateUpdate(completed, postToIframe);
    return true;
  }

  return false;
}

export function appendCacheBust(url: string, cacheKey: number | string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}demo=1&cb=${cacheKey}`;
}
