import { useEffect, useRef, useState } from 'react';
import {
  COLOR_NAME, PLAYER_SETS, canMove, emptyTokens, applyMove, computeCellSize
} from './ludoEngine';
import LudoBoard from './LudoBoard';

// Local pass-and-play Ludo — no backend, no ads. Players take turns on the
// same screen/device.
export default function LocalLudo({ onExit }) {
  const [numPlayers, setNumPlayers] = useState(null);
  const [tokens, setTokens] = useState(null);
  const [turnIdx, setTurnIdx] = useState(0);
  const [dice, setDice] = useState(null);
  const [displayFace, setDisplayFace] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [movable, setMovable] = useState([]);
  const [message, setMessage] = useState('');
  const [winner, setWinner] = useState(null);
  const [cellSize, setCellSize] = useState(computeCellSize);
  const rollTimer = useRef(null);

  useEffect(() => () => clearInterval(rollTimer.current), []);

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

  const players = numPlayers ? PLAYER_SETS[numPlayers] : [];
  const currentColor = players[turnIdx];

  const startGame = (n) => {
    setNumPlayers(n);
    setTokens(emptyTokens(PLAYER_SETS[n]));
    setTurnIdx(0);
    setDice(null);
    setMovable([]);
    setWinner(null);
    setMessage(`${COLOR_NAME[PLAYER_SETS[n][0]]}'s turn — roll the dice.`);
  };

  const resetToSetup = () => {
    clearInterval(rollTimer.current);
    setRolling(false);
    setNumPlayers(null);
    setTokens(null);
    setWinner(null);
  };

  const advanceTurn = () => {
    const next = (turnIdx + 1) % players.length;
    setTurnIdx(next);
    setDice(null);
    setMovable([]);
    setMessage(`${COLOR_NAME[players[next]]}'s turn — roll the dice.`);
  };

  const rollDice = () => {
    if (rolling || dice !== null) return;
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
        setDice(roll);
        const moves = tokens[currentColor]
          .map((pos, i) => ({ i, pos }))
          .filter(t => canMove(t.pos, roll));
        setMovable(moves.map(m => m.i));
        setMessage(moves.length === 0 ? `Rolled ${roll} — no valid moves.` : `Rolled ${roll} — pick a token to move.`);
      }
    }, 80);
  };

  const moveToken = (tokenIdx) => {
    if (!movable.includes(tokenIdx)) return;
    const { tokens: next, finishedAll } = applyMove(tokens, players, currentColor, tokenIdx, dice);
    setTokens(next);

    if (finishedAll) {
      setWinner(currentColor);
      setMessage(`${COLOR_NAME[currentColor]} wins!`);
      return;
    }

    if (dice === 6) {
      setDice(null);
      setMovable([]);
      setMessage(`${COLOR_NAME[currentColor]} rolled a 6 — roll again!`);
    } else {
      advanceTurn();
    }
  };

  if (!numPlayers) {
    return (
      <div className="container py-5" style={{ maxWidth: 480 }}>
        {onExit && (
          <button className="btn btn-link px-0 mb-2 text-decoration-none" onClick={onExit}>
            <i className="bi bi-arrow-left me-1"></i>Back
          </button>
        )}
        <h3 className="fw-bold mb-1">LUDOC — local pass-and-play</h3>
        <p className="text-muted mb-4">Take turns on the same screen.</p>
        <div className="card p-4">
          <div className="fw-semibold mb-3">How many players?</div>
          <div className="d-flex gap-2">
            {[2, 3, 4].map(n => (
              <button key={n} className="btn btn-gradient flex-fill" onClick={() => startGame(n)}>
                {n} Players
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <LudoBoard
      players={players}
      tokens={tokens}
      currentColor={currentColor}
      movable={movable}
      turnIdx={turnIdx}
      winner={winner}
      message={message}
      dice={dice}
      displayFace={displayFace}
      rolling={rolling}
      cellSize={cellSize}
      onRoll={rollDice}
      onTokenClick={moveToken}
      onContinue={advanceTurn}
      headerRight={<button className="btn btn-sm btn-pill-outline" onClick={resetToSetup}>New Game</button>}
      winnerActions={<button className="btn btn-gradient" onClick={resetToSetup}>Play Again</button>}
    />
  );
}
