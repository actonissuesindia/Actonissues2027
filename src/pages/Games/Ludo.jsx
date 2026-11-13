import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import LocalLudo from './LocalLudo';
import OnlineLudo from './OnlineLudo';
import usePageTitle from '../../hooks/usePageTitle';
import useGamesEnabled from '../../hooks/useGamesEnabled';

// A join code in the URL (from a shared link) skips straight to online mode.
export default function Ludo() {
  usePageTitle('Ludo');
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get('join') ? 'online' : null);
  const gamesEnabled = useGamesEnabled();

  if (!gamesEnabled) {
    return (
      <div className="container py-5 text-center" style={{ maxWidth: 480 }}>
        <h3 className="fw-bold mb-2">Games are currently unavailable</h3>
        <p className="text-muted">Check back later.</p>
      </div>
    );
  }

  if (mode === 'local') return <LocalLudo onExit={() => setMode(null)} />;
  if (mode === 'online') return <OnlineLudo onExit={() => setMode(null)} />;

  return (
    <div className="container py-5" style={{ maxWidth: 480 }}>
      <h3 className="fw-bold mb-1">LUDOC</h3>
      <p className="text-muted mb-4">Play on this device, or online with friends on their own.</p>
      <div className="d-flex flex-column gap-3">
        <button className="card p-4 text-start border-0 bg-white" style={{ boxShadow: '0 4px 16px rgba(17,24,39,0.06)' }} onClick={() => setMode('local')}>
          <div className="d-flex align-items-center gap-3">
            <span className="step-icon"><i className="bi bi-phone"></i></span>
            <div>
              <div className="fw-bold">Play locally</div>
              <div className="text-muted small">Pass-and-play — take turns on this screen.</div>
            </div>
          </div>
        </button>
        <button className="card p-4 text-start border-0 bg-white" style={{ boxShadow: '0 4px 16px rgba(17,24,39,0.06)' }} onClick={() => setMode('online')}>
          <div className="d-flex align-items-center gap-3">
            <span className="step-icon"><i className="bi bi-people-fill"></i></span>
            <div>
              <div className="fw-bold">Play online</div>
              <div className="text-muted small">Create a code and share it, or join a friend's game.</div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
