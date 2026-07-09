import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Trophy, RotateCcw, User, Cpu, Sparkles } from 'lucide-react';

type BoardState = (string | null)[];
type GameMode = 'ai' | 'pvp';
type Difficulty = 'easy' | 'medium' | 'impossible';

export default function XOGame() {
  const [board, setBoard] = useState<BoardState>(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState<boolean>(true);
  const [gameMode, setGameMode] = useState<GameMode>('ai');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [scores, setScores] = useState({ x: 0, o: 0, draws: 0 });
  const [winner, setWinner] = useState<string | null>(null);
  const [winningLine, setWinningLine] = useState<number[] | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);

  const winningCombinations = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  };

  const playClickSound = (isX: boolean) => {
    try {
      initAudio();
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isX ? 520 : 660, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.08);
      
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      
      osc.start(now);
      osc.stop(now + 0.08);
    } catch {}
  };

  const playWinSound = () => {
    try {
      initAudio();
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);
        gain.gain.setValueAtTime(0.12, now + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.25);
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.25);
      });
    } catch {}
  };

  const checkWinner = useCallback((currentBoard: BoardState) => {
    for (const combo of winningCombinations) {
      const [a, b, c] = combo;
      if (currentBoard[a] && currentBoard[a] === currentBoard[b] && currentBoard[a] === currentBoard[c]) {
        return { winner: currentBoard[a], combo };
      }
    }
    if (currentBoard.every(cell => cell !== null)) {
      return { winner: 'draw', combo: null };
    }
    return { winner: null, combo: null };
  }, []);

  const minimax = useCallback((tempBoard: BoardState, depth: number, isMaximizing: boolean): number => {
    const check = checkWinner(tempBoard);
    if (check.winner === 'O') return 10 - depth;
    if (check.winner === 'X') return depth - 10;
    if (check.winner === 'draw') return 0;

    if (isMaximizing) {
      let bestScore = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (tempBoard[i] === null) {
          tempBoard[i] = 'O';
          const score = minimax(tempBoard, depth + 1, false);
          tempBoard[i] = null;
          bestScore = Math.max(score, bestScore);
        }
      }
      return bestScore;
    } else {
      let bestScore = Infinity;
      for (let i = 0; i < 9; i++) {
        if (tempBoard[i] === null) {
          tempBoard[i] = 'X';
          const score = minimax(tempBoard, depth + 1, true);
          tempBoard[i] = null;
          bestScore = Math.min(score, bestScore);
        }
      }
      return bestScore;
    }
  }, [checkWinner]);

  const getAIMove = useCallback((currentBoard: BoardState): number => {
    const availableMoves = currentBoard.map((val, idx) => val === null ? idx : null).filter((v): v is number => v !== null);

    if (difficulty === 'easy') {
      return availableMoves[Math.floor(Math.random() * availableMoves.length)];
    }

    if (difficulty === 'medium' && Math.random() > 0.5) {
      return availableMoves[Math.floor(Math.random() * availableMoves.length)];
    }

    let bestScore = -Infinity;
    let move = availableMoves[0]!;

    for (let i = 0; i < 9; i++) {
      if (currentBoard[i] === null) {
        currentBoard[i] = 'O';
        const score = minimax(currentBoard, 0, false);
        currentBoard[i] = null;
        if (score > bestScore) {
          bestScore = score;
          move = i;
        }
      }
    }
    return move;
  }, [difficulty, minimax]);

  const handleCellClick = (index: number) => {
    if (board[index] || winner) return;

    const newBoard = [...board];
    const player = isXNext ? 'X' : 'O';
    newBoard[index] = player;
    setBoard(newBoard);
    playClickSound(isXNext);

    const result = checkWinner(newBoard);
    if (result.winner) {
      handleGameEnd(result.winner, result.combo);
      return;
    }

    if (gameMode === 'ai') {
      setIsXNext(false);
    } else {
      setIsXNext(!isXNext);
    }
  };

  useEffect(() => {
    if (gameMode === 'ai' && !isXNext && !winner) {
      const timer = setTimeout(() => {
        const aiMove = getAIMove(board);
        if (aiMove !== undefined) {
          const newBoard = [...board];
          newBoard[aiMove] = 'O';
          setBoard(newBoard);
          playClickSound(false);

          const result = checkWinner(newBoard);
          if (result.winner) {
            handleGameEnd(result.winner, result.combo);
          } else {
            setIsXNext(true);
          }
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [board, isXNext, gameMode, winner, getAIMove, checkWinner]);

  const handleGameEnd = (gameWinner: string, line: number[] | null) => {
    setWinner(gameWinner);
    if (line) setWinningLine(line);

    if (gameWinner === 'X') {
      setScores(prev => ({ ...prev, x: prev.x + 1 }));
      playWinSound();
    } else if (gameWinner === 'O') {
      setScores(prev => ({ ...prev, o: prev.o + 1 }));
      playWinSound();
    } else {
      setScores(prev => ({ ...prev, draws: prev.draws + 1 }));
    }
  };

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setIsXNext(true);
    setWinner(null);
    setWinningLine(null);
  };

  const resetScores = () => {
    setScores({ x: 0, o: 0, draws: 0 });
    resetGame();
  };

  return (
    <div style={{ maxWidth: 650, margin: '0 auto', padding: '10px 0' }}>
      <div className="card" style={{ padding: 24, borderRadius: 16 }}>
        {/* هيدر اللعبة */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={18} color="#e11212" /> لعبة XO التفاعلية (Tic-Tac-Toe)
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>اختبر تشغيل وأداء اللعبة ورسوميات الويب قبل نشرها للمستخدمين</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={resetScores} style={{ color: 'var(--danger)' }}>
            تصفير النقاط
          </button>
        </div>

        {/* خيارات التحكم بنمط اللعب */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <button 
            className={`btn ${gameMode === 'ai' ? 'btn-primary' : 'btn-ghost'}`} 
            onClick={() => { setGameMode('ai'); resetGame(); }}
            style={{ justifyContent: 'center', gap: 6 }}
          >
            <Cpu size={16} /> ضد الكمبيوتر (AI)
          </button>
          <button 
            className={`btn ${gameMode === 'pvp' ? 'btn-primary' : 'btn-ghost'}`} 
            onClick={() => { setGameMode('pvp'); resetGame(); }}
            style={{ justifyContent: 'center', gap: 6 }}
          >
            <User size={16} /> لاعب ضد لاعب (محلي)
          </button>
        </div>

        {/* خيار الصعوبة للذكاء الاصطناعي */}
        {gameMode === 'ai' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, background: 'var(--bg-app)', padding: 12, borderRadius: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>مستوى الصعوبة:</span>
            {(['easy', 'medium', 'impossible'] as const).map((diff) => (
              <button
                key={diff}
                className="btn btn-sm"
                onClick={() => { setDifficulty(diff); resetGame(); }}
                style={{
                  padding: '4px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  background: difficulty === diff ? 'rgba(225, 18, 18, 0.15)' : 'transparent',
                  color: difficulty === diff ? '#e11212' : 'var(--text-muted)',
                  border: difficulty === diff ? '1px solid #e11212' : '1px solid transparent',
                }}
              >
                {diff === 'easy' ? 'سهل' : diff === 'medium' ? 'متوسط' : 'مستحيل 🔥'}
              </button>
            ))}
          </div>
        )}

        {/* لوحة النتائج */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24, textAlign: 'center' }}>
          <div style={{ background: 'rgba(236, 72, 153, 0.08)', borderRadius: 12, padding: '12px 6px', border: '1px solid rgba(236, 72, 153, 0.15)' }}>
            <p style={{ fontSize: 12, color: '#d21e2a', fontWeight: 600 }}>اللاعب (X)</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: '#d21e2a' }}>{scores.x}</p>
          </div>
          <div style={{ background: 'rgba(156, 163, 175, 0.08)', borderRadius: 12, padding: '12px 6px', border: '1px solid rgba(156, 163, 175, 0.15)' }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>تعادلات</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{scores.draws}</p>
          </div>
          <div style={{ background: 'rgba(168, 85, 247, 0.08)', borderRadius: 12, padding: '12px 6px', border: '1px solid rgba(168, 85, 247, 0.15)' }}>
            <p style={{ fontSize: 12, color: '#f2454e', fontWeight: 600 }}>
              {gameMode === 'ai' ? 'الكمبيوتر (O)' : 'اللاعب (O)'}
            </p>
            <p style={{ fontSize: 20, fontWeight: 800, color: '#f2454e' }}>{scores.o}</p>
          </div>
        </div>

        {/* دور اللعب الحالي أو إعلان النتيجة */}
        <div style={{ textAlign: 'center', marginBottom: 20, minHeight: 24 }}>
          {winner ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 700, fontSize: 16, color: winner === 'draw' ? 'var(--text-primary)' : winner === 'X' ? '#d21e2a' : '#f2454e' }}>
              <Trophy size={18} />
              {winner === 'draw' ? 'تعادل رائع!' : `الفائز هو اللاعب ${winner}! 🎉`}
            </div>
          ) : (
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>
              دور اللعب الحالي:{' '}
              <span style={{ color: isXNext ? '#d21e2a' : '#f2454e', fontWeight: 800 }}>
                {isXNext ? 'X' : 'O'}
              </span>
            </p>
          )}
        </div>

        {/* لوحة اللعبة XO Grid - شبكة تيتانيوم مصقولة بنيون زجاجي */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 14,
          maxWidth: 330,
          margin: '0 auto 24px auto',
          background: 'linear-gradient(145deg, #1e293b, #0f172a)',
          border: '4px solid #334155',
          borderRadius: 20,
          padding: 16,
          boxShadow: 'inset 0 4px 15px rgba(0,0,0,0.85), 0 12px 24px rgba(0,0,0,0.65)',
          position: 'relative'
        }}>
          {board.map((cell, index) => {
            const isWinningCell = winningLine?.includes(index);
            return (
              <button
                key={index}
                onClick={() => handleCellClick(index)}
                disabled={cell !== null || winner !== null || (gameMode === 'ai' && !isXNext)}
                style={{
                  height: 90,
                  borderRadius: 12,
                  background: 'rgba(15, 23, 42, 0.75)',
                  border: isWinningCell
                    ? `2px solid ${cell === 'X' ? '#d21e2a' : '#f2454e'}`
                    : '1.5px solid rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: cell || winner ? 'default' : 'pointer',
                  boxShadow: isWinningCell 
                    ? `0 0 15px ${cell === 'X' ? '#d21e2a' : '#f2454e'}, inset 0 2px 4px rgba(0,0,0,0.6)`
                    : 'inset 0 4px 6px rgba(0,0,0,0.6), 0 1px 1px rgba(255,255,255,0.05)',
                  transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  transform: isWinningCell ? 'scale(1.05)' : 'scale(1)',
                }}
              >
                {cell && <NeonMarker type={cell as 'X' | 'O'} />}
              </button>
            );
          })}
        </div>

        {/* أزرار التحكم والتشغيل */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
          <button className="btn btn-primary" onClick={resetGame} style={{ gap: 8, background: 'linear-gradient(135deg, #e11212 0%, #d21e2a 100%)', border: 'none' }}>
            <RotateCcw size={16} /> إعادة اللعب
          </button>
        </div>
      </div>
    </div>
  );
}

function NeonMarker({ type }: { type: 'X' | 'O' }) {
  const color = type === 'X' ? '#d21e2a' : '#f2454e';

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {type === 'X' ? (
        <svg width="46" height="46" viewBox="0 0 50 50">
          <line x1="12" y1="12" x2="38" y2="38" stroke={color} strokeWidth="5" strokeLinecap="round" style={{
            filter: `drop-shadow(0 0 4px ${color}) drop-shadow(0 0 8px ${color})`
          }} />
          <line x1="38" y1="12" x2="12" y2="38" stroke={color} strokeWidth="5" strokeLinecap="round" style={{
            filter: `drop-shadow(0 0 4px ${color}) drop-shadow(0 0 8px ${color})`
          }} />
        </svg>
      ) : (
        <svg width="46" height="46" viewBox="0 0 50 50">
          <circle cx="25" cy="25" r="14" fill="none" stroke={color} strokeWidth="5" style={{
            filter: `drop-shadow(0 0 4px ${color}) drop-shadow(0 0 8px ${color})`
          }} />
        </svg>
      )}
    </div>
  );
}
