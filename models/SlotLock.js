const { Schema, model } = require('mongoose');

const lock = new Schema({
  specialist: { type: Schema.Types.ObjectId, required: true },
  date: { type: String, required: true },
  block: { type: Number, required: true },   // minutes since midnight (e.g. 870 = 14:30)
  booking: { type: Schema.Types.ObjectId, required: true }
});
lock.index({ specialist: 1, date: 1, block: 1 }, { unique: true });
lock.index({ booking: 1 });

module.exports = model('SlotLock', lock);
