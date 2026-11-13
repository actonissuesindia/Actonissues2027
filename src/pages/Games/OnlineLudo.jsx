import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { COLOR_NAME, canMove, applyMove, computeCellSize } from './ludoEngine';
import LudoBoard from './LudoBoard';

const POLL_MS = 2000;

export default function OnlineLudo({ onExit }) {
  const { user } = useAuth();
  const [params] = useSearchParams();

  const [screen, setScreen] = useState('loading'); // loading | menu | join | waiting | playing
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [joinCode, setJoinCode] = useState((params.get('join') || '').toUpperCase());
  const [copied, setCopied] = useState(false);
  const [pushing, setPushing] = useState(false);

  const [displayFace, setDisplayFace] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [cellSize, setCellSize] = useState(computeCellSize);

  const pollTimer = useRef(null);
  const rollTimer = useRef(null);
  const pushingRef = useRef(false);

  useEffect(() => {
    let raf = null;
    const onResize = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        setCellSize(computeCellSize());
        raf = null;
      });
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Resume a live game on mount (e.g. after an accidental refresh) instead
  // of dropping the player back to the menu.
  useEffect(() => {
    let cancelled = false;
    api.get('/games/ludo/active').then(res => {
      if (cancelled) return;
      const active = res.data.room;
      if (active) {
        setRoom(active);
        setScreen(active.status === 'waiting' ? 'waiting' : 'playing');
      } else {
        setScreen(params.get('join') ? 'join' : 'menu');
      }
    }).catch(() => setScreen('menu'));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll while a room exists and the game hasn't finished.
  useEffect(() => {
    if (!room?.code || room.status === 'finished') return undefined;
    pollTimer.current = setInterval(() => {
      if (pushingRef.current) return; // don't let a stale poll clobber an in-flight optimistic move
      api.get(`/games/ludo/rooms/${room.code}`).then(res => {
        setRoom(res.data.room);
        if (res.data.room.status === 'active') setScreen('playing');
      }).catch(() => {});
    }, POLL_MS);
    return () => clearInterval(pollTimer.current);
  }, [room?.code, room?.status]);

  useEffect(() => () => clearInterval(rollTimer.current), []);

  const createRoom = async (targetPlayers) => {
    setError(''); setBusy(true);
    try {
      const res = await api.post('/games/ludo/rooms', { targetPlayers });
      setRoom(res.data.room);
      setScreen('waiting');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create a game.');
    } finally {
      setBusy(false);
    }
  };

  const joinRoom = async (e) => {
    e?.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setError(''); setBusy(true);
    try {
      const res = await api.post(`/games/ludo/rooms/${code}/join`);
      setRoom(res.data.room);
      setScreen(res.data.room.status === 'active' ? 'playing' : 'waiting');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not join that game.');
    } finally {
      setBusy(false);
    }
  };

  const leaveWaitingRoom = async () => {
    if (!room) return;
    try { await api.post(`/games/ludo/rooms/${room.code}/leave`); } catch { /* ignore */ }
    setRoom(null);
    setScreen('menu');
  };

  const shareCode = async () => {
    const url = `${window.location.origin}/games?join=${room.code}`;
    const text = `Join my LUDOC game on Act On Issues! Code: ${room.code}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Play LUDOC', text, url }); return; } catch { /* user cancelled, fall through */ }
    }
    navigator.clipboard?.writeText(`${text} ${url}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ---- Playing screen ----
  const players = room?.players?.map(p => p.color) || [];
  const myPlayer = room?.players?.find(p => String(p.user) === String(user._id));
  const myColor = myPlayer?.color;
  const currentColor = players[room?.turnIdx] || null;
  const isMyTurn = !!room && room.status === 'active' && currentColor === myColor;
  const tokens = room?.state?.tokens;
  const dice = room?.state?.dice ?? null;
  const movable = room?.state?.movable || [];

  const pushUpdate = async (patch) => {
    pushingRef.current = true;
    setPushing(true);
    // Optimistic local update — instant feedback while the request is in
    // flight. Note this does NOT bump `version`, so any further action must
    // stay disabled (see canAct below) until the confirmed response lands —
    // otherwise a fast second action would read this stale version and get
    // rejected by the server's optimistic-concurrency check.
    setRoom(prev => ({ ...prev, ...patch }));
    try {
      const res = await api.patch(`/games/ludo/rooms/${room.code}`, { expectedVersion: room.version, ...patch });
      setRoom(res.data.room);
    } catch (err) {
      // Stale/conflicting update (or connectivity blip) — refetch the real state.
      try {
        const fresh = await api.get(`/games/ludo/rooms/${room.code}`);
        setRoom(fresh.data.room);
      } catch { /* next poll will recover */ }
      setError(err.response?.data?.message || '');
    } finally {
      pushingRef.current = false;
      setPushing(false);
    }
  };

  const rollDice = () => {
    if (!isMyTurn || pushing || rolling || dice !== null) return;
    setRolling(true);
    let ticks = 0;
    rollTimer.current = setInterval(() => {
      setDisplayFace(1 + Math.floor(Math.random() * 6));
      ticks++;
      if (ticks >= 6) {
        clearInterval(rollTimer.current);
        const roll = 1 + Math.floor(Math.random() * 6);
        setDisplayFace(roll);
        setRolling(false);
        const moves = tokens[currentColor]
          .map((pos, i) => ({ i, pos }))
          .filter(t => canMove(t.pos, roll));
        pushUpdate({
          state: { ...room.state, dice: roll, movable: moves.map(m => m.i) },
          turnIdx: room.turnIdx,
          winner: null
        });
      }
    }, 80);
  };

  const moveToken = (tokenIdx) => {
    if (!isMyTurn || pushing || !movable.includes(tokenIdx)) return;
    const { tokens: next, finishedAll } = applyMove(tokens, players, currentColor, tokenIdx, dice);
    const nextTurnIdx = finishedAll || dice !== 6 ? (room.turnIdx + 1) % players.length : room.turnIdx;
    pushUpdate({
      state: { ...room.state, tokens: next, dice: null, movable: [] },
      turnIdx: finishedAll ? room.turnIdx : nextTurnIdx,
      winner: finishedAll ? currentColor : null
    });
  };

  const continueTurn = () => {
    if (!isMyTurn || pushing) return;
    pushUpdate({
      state: { ...room.state, dice: null, movable: [] },
      turnIdx: (room.turnIdx + 1) % players.length,
      winner: null
    });
  };

  const message = !room ? '' : room.winner
    ? `${COLOR_NAME[room.winner]} wins!`
    : isMyTurn
      ? (dice !== null ? (movable.length === 0 ? `Rolled ${dice} — no valid moves.` : `Rolled ${dice} — pick a token to move.`) : "Your turn — roll the dice.")
      : `Waiting for ${COLOR_NAME[currentColor] || '...'}...`;

  if (screen === 'loading') {
    return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>;
  }

  if (screen === 'menu' || screen === 'join') {
    return (
      <div className="container py-5" style={{ maxWidth: 480 }}>
        {onExit && (
          <button className="btn btn-link px-0 mb-2 text-decoration-none" onClick={onExit}>
            <i className="bi bi-arrow-left me-1"></i>Back
          </button>
        )}
        <h3 className="fw-bold mb-1">LUDOC — play online</h3>
        <p className="text-muted mb-4">Create a game and share the code, or join one with a code a friend sent you.</p>
        {error && <div className="alert alert-danger py-2">{error}</div>}

        <div className="card p-4 mb-3">
          <div className="fw-semibold mb-3">Create a game</div>
          <div className="d-flex gap-2">
            {[2, 3, 4].map(n => (
              <button key={n} className="btn btn-gradient flex-fill" disabled={busy} onClick={() => createRoom(n)}>
                {n} Players
              </button>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <div className="fw-semibold mb-3">Join a game</div>
          <form onSubmit={joinRoom} className="d-flex gap-2">
            <input
              className="form-control text-uppercase"
              placeholder="Enter code"
              maxLength={5}
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
            />
            <button className="btn btn-gradient" disabled={busy || !joinCode.trim()}>Join</button>
          </form>
        </div>
      </div>
    );
  }

  if (screen === 'waiting') {
    return (
      <div className="container py-5" style={{ maxWidth: 480 }}>
        <button className="btn btn-link px-0 mb-2 text-decoration-none" onClick={leaveWaitingRoom}>
          <i className="bi bi-arrow-left me-1"></i>Leave
        </button>
        <div className="card p-4 text-center">
          <div className="text-muted small mb-1">Share this code</div>
          <div className="fw-bold display-6 mb-3" style={{ letterSpacing: '0.15em' }}>{room.code}</div>
          <button className="btn btn-gradient mb-3" onClick={shareCode}>
            <i className="bi bi-share me-1"></i>{copied ? 'Copied!' : 'Share'}
          </button>
          <div className="text-start">
            <div className="fw-semibold small mb-2">
              Players ({room.players.length}/{room.targetPlayers})
            </div>
            <div className="d-flex flex-column gap-2">
              {room.players.map(p => (
                <div key={String(p.user)} className="d-flex align-items-center gap-2 px-3 py-2 rounded-3" style={{ background: '#f7f7fb' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'currentColor' }} className={`text-${p.color === 'red' ? 'danger' : p.color === 'green' ? 'success' : p.color === 'yellow' ? 'warning' : 'primary'}`} />
                  <span className="fw-semibold small">{p.name}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="text-muted small mt-3">
            Waiting for {room.targetPlayers - room.players.length} more player{room.targetPlayers - room.players.length === 1 ? '' : 's'}…
          </div>
        </div>
      </div>
    );
  }

  // playing
  if (!room || !tokens) return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>;

  return (
    <LudoBoard
      title={`LUDOC — ${room.code}`}
      players={players}
      tokens={tokens}
      currentColor={currentColor}
      movable={movable}
      turnIdx={room.turnIdx}
      winner={room.winner}
      message={message}
      dice={dice}
      displayFace={displayFace}
      rolling={rolling}
      cellSize={cellSize}
      canAct={isMyTurn && !pushing}
      onRoll={rollDice}
      onTokenClick={moveToken}
      onContinue={continueTurn}
      headerRight={onExit && <button className="btn btn-sm btn-pill-outline" onClick={onExit}>Back to menu</button>}
      winnerActions={onExit && <button className="btn btn-gradient" onClick={onExit}>Back to menu</button>}
    />
  );
}
