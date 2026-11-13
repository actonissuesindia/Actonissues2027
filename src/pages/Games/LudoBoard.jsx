import {
  COLOR_ORDER, COLOR_HEX, COLOR_NAME, GRID, YARD_SPANS, RING, START_INDEX,
  HOME_CELLS, LAST_RING_POS, FINISH, SAFE_CELLS, DICE_PIPS, ringIndex, lighten
} from './ludoEngine';

function Die({ face, rolling, onClick, clickable }) {
  const lit = new Set(DICE_PIPS[face] || []);
  return (
    <button
      className="ludo-die"
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      title={clickable ? 'Roll the dice' : undefined}
      style={{
        width: 60,
        height: 60,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'repeat(3, 1fr)',
        gap: 5,
        padding: 10,
        background: 'linear-gradient(160deg, #ffffff 0%, #f3f4f8 100%)',
        border: '1px solid #e5e7eb',
        borderRadius: 16,
        boxShadow: rolling
          ? '0 3px 8px rgba(17,24,39,0.18)'
          : '0 8px 18px rgba(17,24,39,0.12), inset 0 1px 0 rgba(255,255,255,0.8)',
        cursor: clickable ? 'pointer' : 'default',
        transform: rolling ? 'rotate(8deg) scale(0.96)' : 'none',
        transition: 'transform 120ms ease, box-shadow 120ms ease'
      }}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <span
          key={i}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: lit.has(i) ? 'radial-gradient(circle at 35% 30%, #4b5563, #111827)' : 'transparent',
            boxShadow: lit.has(i) ? 'inset 0 1px 1px rgba(255,255,255,0.2)' : 'none'
          }}
        />
      ))}
    </button>
  );
}

// Presentational Ludo board — takes game state + action callbacks as props
// and has no idea whether it's driven by local useState (LocalLudo) or
// polled server state (OnlineLudo). headerRight/winnerActions are slots for
// whatever mode-specific controls belong there (e.g. local mode's "New
// Game" button has no equivalent once a server-tracked game exists).
export default function LudoBoard({
  title = 'LUDOC', players, tokens, currentColor, movable, turnIdx, winner, message,
  dice, displayFace, rolling, cellSize, canAct = true,
  onRoll, onTokenClick, onContinue, headerRight, winnerActions
}) {
  const boardPx = GRID * cellSize;
  const scale = cellSize / 24;

  const ringOccupantsAt = (idx) => players.flatMap(color =>
    tokens[color]
      .map((pos, i) => ({ color, i, pos }))
      .filter(t => t.pos >= 0 && t.pos <= LAST_RING_POS && ringIndex(t.color, t.pos) === idx)
  );
  const homeLaneOccupantsAt = (color, laneIdx) => {
    if (!players.includes(color)) return [];
    const relPos = LAST_RING_POS + 1 + laneIdx;
    return tokens[color]
      .map((pos, i) => ({ color, i, pos }))
      .filter(t => t.pos === relPos);
  };
  const finishedOccupants = players.flatMap(color =>
    tokens[color].map((pos, i) => ({ color, i, pos })).filter(t => t.pos === FINISH)
  );

  const renderTokenDot = (o, small) => {
    const isMovable = canAct && o.color === currentColor && movable.includes(o.i);
    const size = Math.round((small ? 10 : 16) * scale);
    return (
      <button
        key={`${o.color}-${o.i}`}
        className={isMovable ? 'ludo-token ludo-token-movable' : 'ludo-token'}
        onClick={() => isMovable && onTokenClick(o.i)}
        title={`${COLOR_NAME[o.color]} token ${o.i + 1}`}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: `radial-gradient(circle at 32% 28%, ${lighten(COLOR_HEX[o.color])}, ${COLOR_HEX[o.color]})`,
          border: isMovable ? '2px solid #111827' : '1px solid rgba(0,0,0,0.25)',
          padding: 0,
          cursor: isMovable ? 'pointer' : 'default',
          boxShadow: isMovable ? undefined : '0 1px 2px rgba(0,0,0,0.25)'
        }}
      />
    );
  };

  return (
    <div className="container py-4 d-flex flex-column align-items-center">
      <style>{`
        .ludo-token { transition: transform 120ms ease, box-shadow 120ms ease; }
        .ludo-token-movable { animation: ludoPulse 1.1s ease-in-out infinite; }
        .ludo-token-movable:hover { transform: scale(1.15); }
        @keyframes ludoPulse {
          0%, 100% { box-shadow: 0 0 0 2px rgba(17,24,39,0.18); }
          50% { box-shadow: 0 0 0 6px rgba(17,24,39,0.05); }
        }
        .ludo-die:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 12px 22px rgba(17,24,39,0.16), inset 0 1px 0 rgba(255,255,255,0.8); }
        .ludo-die:active:not(:disabled) { transform: translateY(0) scale(0.97); }
        .ludo-yard { transition: box-shadow 150ms ease; }
      `}</style>

      <div className="card p-2 p-sm-4" style={{ boxShadow: '0 10px 30px rgba(17,24,39,0.07)' }}>
        <div className="d-flex align-items-center justify-content-between w-100 mb-1" style={{ maxWidth: boardPx }}>
          <h4 className="fw-bold mb-0">{title}</h4>
          {headerRight}
        </div>

        <div className="d-flex align-items-center gap-2 my-3 flex-wrap">
          {players.map((c, i) => (
            <span
              key={c}
              className="d-inline-flex align-items-center gap-1 px-3 py-1 rounded-pill"
              style={{
                background: i === turnIdx && !winner ? COLOR_HEX[c] + '1f' : '#f7f7fb',
                border: i === turnIdx && !winner ? `2px solid ${COLOR_HEX[c]}` : '2px solid transparent',
                fontWeight: i === turnIdx ? 700 : 500,
                boxShadow: i === turnIdx && !winner ? `0 2px 8px ${COLOR_HEX[c]}33` : 'none'
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLOR_HEX[c], display: 'inline-block' }} />
              {COLOR_NAME[c]}
              {tokens[c].filter(p => p === FINISH).length > 0 && ` (${tokens[c].filter(p => p === FINISH).length}/4 home)`}
            </span>
          ))}
        </div>

        <div
          className="position-relative mb-3 mx-auto"
          style={{
            width: boardPx, height: boardPx, display: 'grid',
            gridTemplateColumns: `repeat(${GRID}, ${cellSize}px)`,
            gridTemplateRows: `repeat(${GRID}, ${cellSize}px)`,
            border: '1px solid #e5e7eb',
            borderRadius: 18,
            overflow: 'hidden',
            boxShadow: '0 4px 16px rgba(17,24,39,0.08)'
          }}
        >
          {COLOR_ORDER.map(color => {
            const { rows, cols } = YARD_SPANS[color];
            const colorTokens = tokens[color] || [-1, -1, -1, -1];
            return (
              <div
                key={color}
                className="ludo-yard"
                style={{
                  gridRow: `${rows[0] + 1} / ${rows[1] + 2}`,
                  gridColumn: `${cols[0] + 1} / ${cols[1] + 2}`,
                  background: `linear-gradient(150deg, ${COLOR_HEX[color]}26 0%, ${COLOR_HEX[color]}0d 100%)`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8
                }}
              >
                <div
                  className="bg-white d-grid"
                  style={{ gridTemplateColumns: '1fr 1fr', gap: Math.round(10 * scale), padding: Math.round(12 * scale), borderRadius: 12, boxShadow: '0 2px 10px rgba(17,24,39,0.08)' }}
                >
                  {colorTokens.map((pos, i) => {
                    if (pos !== -1) return <span key={i} />;
                    const isMovable = canAct && color === currentColor && movable.includes(i);
                    return (
                      <button
                        key={i}
                        className={isMovable ? 'ludo-token ludo-token-movable' : 'ludo-token'}
                        onClick={() => isMovable && onTokenClick(i)}
                        title={`${COLOR_NAME[color]} token ${i + 1} (in yard)`}
                        style={{
                          width: Math.round(20 * scale),
                          height: Math.round(20 * scale),
                          borderRadius: '50%',
                          background: `radial-gradient(circle at 32% 28%, ${lighten(COLOR_HEX[color])}, ${COLOR_HEX[color]})`,
                          border: isMovable ? '2px solid #111827' : '1px solid rgba(0,0,0,0.25)',
                          cursor: isMovable ? 'pointer' : 'default',
                          boxShadow: isMovable ? undefined : '0 1px 2px rgba(0,0,0,0.25)'
                        }}
                      />
                    );
                  })}
                </div>
                <span className="small fw-bold" style={{ color: COLOR_HEX[color], letterSpacing: '0.02em' }}>{COLOR_NAME[color]}</span>
              </div>
            );
          })}

          {RING.map(([r, c], idx) => {
            const isSafe = SAFE_CELLS.has(idx);
            const startColor = COLOR_ORDER.find(k => START_INDEX[k] === idx);
            const occupants = ringOccupantsAt(idx);
            return (
              <div
                key={`ring-${idx}`}
                style={{
                  gridRow: r + 1,
                  gridColumn: c + 1,
                  borderRight: '1px solid #eef0f4',
                  borderBottom: '1px solid #eef0f4',
                  background: startColor ? COLOR_HEX[startColor] + '4d' : isSafe ? '#f6f7fb' : '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                  gap: 1
                }}
              >
                {isSafe && !startColor && occupants.length === 0 && <span style={{ fontSize: 11, color: '#c4c9d4' }}>★</span>}
                {occupants.map(o => renderTokenDot(o, occupants.length > 1))}
              </div>
            );
          })}

          {COLOR_ORDER.map(color =>
            HOME_CELLS[color].map(([r, c], laneIdx) => {
              const occupants = homeLaneOccupantsAt(color, laneIdx);
              return (
                <div
                  key={`home-${color}-${laneIdx}`}
                  style={{
                    gridRow: r + 1,
                    gridColumn: c + 1,
                    background: `linear-gradient(160deg, ${lighten(COLOR_HEX[color])} 0%, ${COLOR_HEX[color]} 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {occupants.map(o => renderTokenDot(o, false))}
                </div>
              );
            })
          )}

          <div
            style={{
              gridRow: 8,
              gridColumn: 8,
              borderRadius: '50%',
              margin: 2,
              background: `conic-gradient(${COLOR_HEX.red} 0deg 90deg, ${COLOR_HEX.green} 90deg 180deg, ${COLOR_HEX.yellow} 180deg 270deg, ${COLOR_HEX.blue} 270deg 360deg)`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: 1
            }}
          >
            {finishedOccupants.map(o => renderTokenDot(o, true))}
          </div>
        </div>

        {winner ? (
          <div className="text-center">
            <div className="fs-4 fw-bold mb-2" style={{ color: COLOR_HEX[winner] }}>
              🎉 {COLOR_NAME[winner]} wins!
            </div>
            {winnerActions}
          </div>
        ) : (
          <div className="d-flex flex-column align-items-center gap-2">
            <Die
              face={dice !== null ? dice : displayFace}
              rolling={rolling}
              clickable={canAct && dice === null && !rolling}
              onClick={onRoll}
            />
            <div className="text-muted small">{message || 'Tap the dice to roll.'}</div>
            {canAct && dice !== null && movable.length === 0 && (
              <button className="btn btn-gradient px-4" onClick={onContinue}>Continue</button>
            )}
            {canAct && dice !== null && movable.length > 0 && (
              <div className="text-muted small">Tap a highlighted token to move it.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
