import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { App as AntApp } from 'antd';
import './index.css';
import { t } from './i18n/casinoI18n.js';

const PlinkoGame = lazy(() => import('./exported_games/PlinkoGame/PlinkoGame'));
const CrashGame = lazy(() => import('./exported_games/CrashGame/CrashGame'));
const DinoGame = lazy(() => import('./exported_games/DinoGame/DinoGame'));
const SpinWinGame = lazy(() => import('./exported_games/SpinWinGame/SpinWinGame'));
const MinesGame = lazy(() => import('./exported_games/MinesGame/MinesGame'));

function GameLoader() {
  return (
    <div className="game-loading" role="status" aria-live="polite">
      <div className="game-loading-spinner" />
      <p>{t('loadingGame')}</p>
    </div>
  );
}

function App() {
  return (
    <AntApp>
      <BrowserRouter basename="/games/casino">
        <div className="app-container">
          <main className="app-main">
            <Suspense fallback={<GameLoader />}>
              <Routes>
                <Route path="/" element={<Navigate to="/plinko" replace />} />
                <Route path="/plinko" element={<PlinkoGame />} />
                <Route path="/crash" element={<CrashGame />} />
                <Route path="/dino" element={<DinoGame />} />
                <Route path="/spin-win" element={<SpinWinGame />} />
                <Route path="/mines" element={<MinesGame />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </BrowserRouter>
    </AntApp>
  );
}

export default App;
