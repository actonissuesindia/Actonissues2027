const mongoose = require('mongoose');

// No ambiguous characters (0/O, 1/I) — the code is read aloud/typed by hand
// on a phone to join a friend's game.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;

function generateCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

const PlayerSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Snapshot of the name at join time — avoids a populate() on every poll.
  name: { type: String, required: true },
  color: { type: String, enum: ['red', 'green', 'yellow', 'blue'], required: true },
  joinedAt: { type: Date, default: Date.now }
}, { _id: false });

const LudoRoomSchema = new mongoose.Schema({
  // A room code is a security boundary (guessable codes let someone join a
  // private game) — deliberately random+retry rather than Issue.js's
  // sequential issueNumber pattern.
  code: { type: String, required: true, unique: true, index: true },
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetPlayers: { type: Number, enum: [2, 3, 4], required: true },
  players: [PlayerSchema],
  status: { type: String, enum: ['waiting', 'active', 'finished'], default: 'waiting' },
  turnIdx: { type: Number, default: 0 },
  // { tokens: {red:[-1,-1,-1,-1], ...}, dice, movable: [], message }
  state: { type: mongoose.Schema.Types.Mixed, default: null },
  winner: { type: String, default: null },
  // Optimistic concurrency — a PATCH must match this to be accepted.
  version: { type: Number, default: 0 },
  lastMoveAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

// TTL cleanup — same idiom as models/Otp.js. expiresAt is a sliding window,
// bumped forward on join/move so an active game never gets swept mid-play.
LudoRoomSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

LudoRoomSchema.statics.generateUniqueCode = async function () {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const existing = await this.exists({ code });
    if (!existing) return code;
  }
  throw new Error('Could not generate a unique room code — try again.');
};

module.exports = mongoose.model('LudoRoom', LudoRoomSchema);
