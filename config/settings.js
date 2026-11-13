// Booking policies editable from Admin > Settings. They are applied onto the shared rules object (config/rules.js)
// so the booking engine picks up changes immediately, with no restart.
const Setting = require('../models/Setting');
const R = require('./rules');

const DEFAULTS = {
  openHour: R.OPEN_MIN / 60, closeHour: R.CLOSE_MIN / 60, minLeadHours: R.MIN_LEAD_HOURS,
  maxAdvanceDays: R.MAX_ADVANCE_DAYS, depositRate: R.DEPOSIT_RATE, cancelHours: R.CANCEL_HOURS
};
function apply(s) {
  R.OPEN_MIN = s.openHour * 60; R.CLOSE_MIN = s.closeHour * 60; R.MIN_LEAD_HOURS = s.minLeadHours;
  R.MAX_ADVANCE_DAYS = s.maxAdvanceDays; R.DEPOSIT_RATE = s.depositRate; R.CANCEL_HOURS = s.cancelHours;
}
async function load() {
  const doc = await Setting.findById('main').lean();
  const s = { ...DEFAULTS };
  if (doc) for (const k of Object.keys(DEFAULTS)) if (typeof doc[k] === 'number') s[k] = doc[k];
  apply(s); return s;
}
async function save(input) {
  const n = (v, lo, hi, name, int = true) => {
    v = Number(v);
    if (!Number.isFinite(v) || v < lo || v > hi || (int && !Number.isInteger(v))) throw new Error(`${name} must be ${int ? 'a whole number ' : ''}between ${lo} and ${hi}.`);
    return v;
  };
  const s = {
    openHour: n(input.openHour, 0, 23, 'Opening hour'), closeHour: n(input.closeHour, 1, 24, 'Closing hour'),
    minLeadHours: n(input.minLeadHours, 0, 72, 'Minimum notice'), maxAdvanceDays: n(input.maxAdvanceDays, 1, 365, 'Maximum days ahead'),
    depositRate: n(input.depositRate, 0, 1, 'Deposit', false), cancelHours: n(input.cancelHours, 0, 168, 'Cancellation window')
  };
  if (s.closeHour <= s.openHour) throw new Error('Closing hour must be later than opening hour.');
  await Setting.findByIdAndUpdate('main', { $set: s }, { upsert: true });
  apply(s); return s;
}
module.exports = { load, save };