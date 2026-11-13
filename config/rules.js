// Central booking rules (all times are Philippine Time, UTC+8, no DST)
module.exports = {
  OPEN_MIN: Number(process.env.OPEN_HOUR || 9) * 60,
  CLOSE_MIN: Number(process.env.CLOSE_HOUR || 21) * 60,
  START_STEP: 30,   // guests can start at :00 and :30
  BLOCK: 15,        // internal lock granularity (service durations are multiples of 15)
  MIN_LEAD_HOURS: Number(process.env.MIN_LEAD_HOURS || 2),
  MAX_ADVANCE_DAYS: Number(process.env.MAX_ADVANCE_DAYS || 60),
  CANCEL_HOURS: Number(process.env.CANCEL_HOURS || 24),   // guests may self-cancel up to this many hours before
  DEPOSIT_RATE: Number(process.env.DEPOSIT_RATE || 0.2),
  PAYMENT_METHODS: ['GCash', 'Maya', 'Online Bank Transfer', 'Pay at the Salon'],
  WALKIN_EXTRA_METHODS: ['Cash at Counter', 'Card / POS'],
  CATEGORIES: ['Hair Artistry', 'Facial & Skin', 'Nails & Care', 'Therapeutic Massage', 'Spa Packages']
};