const mongoose = require('mongoose');

// Backs atomic auto-increment sequences (e.g. Issue.issueNumber).
// A single document per sequence name; $inc is atomic in MongoDB, so
// concurrent requests can never be handed the same value.
const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

// `computeSeed`, if given, is only used the very first time this sequence is
// used in a given database — it lets a brand-new counter start from the
// highest value already in use (e.g. issues created before this counter
// existed) instead of always starting at 0.
CounterSchema.statics.getNextSequence = async function (name, computeSeed) {
  const existing = await this.findById(name);
  if (!existing && computeSeed) {
    const seed = await computeSeed();
    // $setOnInsert avoids clobbering the seq if another request seeded it
    // first in the moment between the check above and this upsert.
    await this.findOneAndUpdate(
      { _id: name },
      { $setOnInsert: { seq: seed } },
      { upsert: true }
    );
  }
  const counter = await this.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
};

module.exports = mongoose.model('Counter', CounterSchema);
