const LudoRoom = require('../models/LudoRoom');
const SystemSetting = require('../models/SystemSetting');

// Mirrors PLAYER_SETS in src/pages/Games/ludoEngine.js — kept in sync
// manually since it's a tiny, essentially-frozen game rule (which colors
// play in a 2/3/4-player game), not worth sharing a module across the
// frontend/backend boundary for.
const PLAYER_SETS = {
  2: ['red', 'yellow'],
  3: ['red', 'green', 'yellow'],
  4: ['red', 'green', 'yellow', 'blue']
};

const THIRTY_MIN = 30 * 60 * 1000;
const TWO_HOURS = 2 * 60 * 60 * 1000;
const TEN_MIN = 10 * 60 * 1000;

const emptyState = (numPlayers) => {
  const tokens = {};
  PLAYER_SETS[numPlayers].forEach(c => { tokens[c] = [-1, -1, -1, -1]; });
  return { tokens, dice: null, movable: [] };
};

const isMember = (room, userId) => room.players.some(p => String(p.user) === String(userId));

// GET /api/games/ludo/enabled — checked by the Games tab/page before
// showing anything (including local pass-and-play, which never otherwise
// touches the backend) so the Super Admin's GAMES_ENABLED toggle can take
// the whole feature down, not just online multiplayer.
exports.enabled = async (req, res, next) => {
  try {
    const row = await SystemSetting.findOne({ key: 'GAMES_ENABLED' });
    res.json({ success: true, enabled: row?.value !== 'false' });
  } catch (err) {
    next(err);
  }
};

// Defense in depth behind the frontend gate above — rejects room actions
// directly if GAMES_ENABLED was switched off after the page already loaded.
exports.requireGamesEnabled = async (req, res, next) => {
  try {
    const row = await SystemSetting.findOne({ key: 'GAMES_ENABLED' });
    if (row?.value === 'false') {
      return res.status(403).json({ success: false, message: 'Games are currently unavailable' });
    }
    next();
  } catch (err) {
    next(err);
  }
};

// POST /api/games/ludo/rooms
exports.createRoom = async (req, res, next) => {
  try {
    const targetPlayers = Number(req.body.targetPlayers);
    if (![2, 3, 4].includes(targetPlayers)) {
      return res.status(400).json({ success: false, message: 'Choose 2, 3, or 4 players.' });
    }
    const code = await LudoRoom.generateUniqueCode();
    const colors = PLAYER_SETS[targetPlayers];
    const room = await LudoRoom.create({
      code,
      host: req.user._id,
      targetPlayers,
      players: [{ user: req.user._id, name: req.user.name, color: colors[0] }],
      status: 'waiting',
      expiresAt: new Date(Date.now() + THIRTY_MIN)
    });
    res.json({ success: true, room });
  } catch (err) { next(err); }
};

// POST /api/games/ludo/rooms/:code/join
exports.joinRoom = async (req, res, next) => {
  try {
    const code = (req.params.code || '').toUpperCase();

    for (let attempt = 0; attempt < 5; attempt++) {
      const room = await LudoRoom.findOne({ code });
      if (!room) return res.status(404).json({ success: false, message: 'Room not found. Check the code and try again.' });

      if (isMember(room, req.user._id)) return res.json({ success: true, room });
      if (room.status !== 'waiting') return res.status(409).json({ success: false, message: 'This game has already started.' });
      if (room.players.length >= room.targetPlayers) return res.status(409).json({ success: false, message: 'Room is full.' });

      const colors = PLAYER_SETS[room.targetPlayers];
      const newPlayer = { user: req.user._id, name: req.user.name, color: colors[room.players.length] };
      const willStart = room.players.length + 1 === room.targetPlayers;

      const set = { expiresAt: new Date(Date.now() + TWO_HOURS) };
      if (willStart) {
        set.status = 'active';
        set.state = emptyState(room.targetPlayers);
      }

      // Guard on the current player count so two simultaneous joins can't
      // both squeeze into the last slot — a lost race just retries the loop.
      const updated = await LudoRoom.findOneAndUpdate(
        { code, status: 'waiting', players: { $size: room.players.length } },
        { $push: { players: newPlayer }, $set: set },
        { new: true }
      );
      if (updated) return res.json({ success: true, room: updated });
    }
    res.status(409).json({ success: false, message: 'Room changed while joining — try again.' });
  } catch (err) { next(err); }
};

// GET /api/games/ludo/rooms/:code — the poll endpoint
exports.getRoom = async (req, res, next) => {
  try {
    const code = (req.params.code || '').toUpperCase();
    const room = await LudoRoom.findOne({ code });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });
    if (!isMember(room, req.user._id)) return res.status(403).json({ success: false, message: 'You are not in this game.' });
    res.json({ success: true, room });
  } catch (err) { next(err); }
};

// PATCH /api/games/ludo/rooms/:code — the active player pushes a new state
exports.patchRoom = async (req, res, next) => {
  try {
    const code = (req.params.code || '').toUpperCase();
    const { expectedVersion, state, turnIdx, winner } = req.body;

    const room = await LudoRoom.findOne({ code });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });
    if (room.status !== 'active') return res.status(409).json({ success: false, message: 'Game is not active.' });

    const currentPlayer = room.players[room.turnIdx];
    if (!currentPlayer || String(currentPlayer.user) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: "It's not your turn." });
    }
    if (!Number.isInteger(turnIdx) || turnIdx < 0 || turnIdx >= room.players.length) {
      return res.status(400).json({ success: false, message: 'Invalid turn index.' });
    }

    const set = {
      state,
      turnIdx,
      winner: winner || null,
      version: room.version + 1,
      lastMoveAt: new Date(),
      expiresAt: new Date(Date.now() + TWO_HOURS)
    };
    if (winner) {
      set.status = 'finished';
      set.expiresAt = new Date(Date.now() + TEN_MIN);
    }

    // The expectedVersion + turn-ownership match is the whole race guard —
    // a stale or duplicate PATCH (e.g. a slow request racing a newer one)
    // simply fails to match and comes back 409 rather than clobbering state.
    const updated = await LudoRoom.findOneAndUpdate(
      { code, version: Number(expectedVersion), [`players.${room.turnIdx}.user`]: req.user._id },
      { $set: set },
      { new: true }
    );
    if (!updated) return res.status(409).json({ success: false, message: 'State changed — refresh and try again.' });
    res.json({ success: true, room: updated });
  } catch (err) { next(err); }
};

// POST /api/games/ludo/rooms/:code/leave — pre-game only
exports.leaveRoom = async (req, res, next) => {
  try {
    const code = (req.params.code || '').toUpperCase();
    const room = await LudoRoom.findOne({ code });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });
    if (room.status !== 'waiting') {
      return res.status(400).json({ success: false, message: 'The game has already started — you can\'t leave now.' });
    }

    const remaining = room.players.filter(p => String(p.user) !== String(req.user._id));
    if (remaining.length === room.players.length) return res.json({ success: true, room });

    if (remaining.length === 0) {
      await LudoRoom.deleteOne({ _id: room._id });
      return res.json({ success: true, room: null });
    }

    const colors = PLAYER_SETS[room.targetPlayers];
    const reindexed = remaining.map((p, i) => ({
      user: p.user, name: p.name, joinedAt: p.joinedAt, color: colors[i]
    }));
    const updated = await LudoRoom.findOneAndUpdate(
      { _id: room._id },
      { $set: { players: reindexed } },
      { new: true }
    );
    res.json({ success: true, room: updated });
  } catch (err) { next(err); }
};

// GET /api/games/ludo/active — resume after a refresh
exports.getActiveRoom = async (req, res, next) => {
  try {
    const room = await LudoRoom.findOne({
      'players.user': req.user._id,
      status: { $in: ['waiting', 'active'] }
    }).sort({ updatedAt: -1 });
    res.json({ success: true, room: room || null });
  } catch (err) { next(err); }
};
