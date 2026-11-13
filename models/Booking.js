const { Schema, model } = require('mongoose');

const booking = new Schema({
  ref: { type: String, required: true, unique: true },             // e.g. TR-8821
  service: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
  specialist: { type: Schema.Types.ObjectId, ref: 'Specialist', required: true },

  // Snapshots: keep history correct even if prices/names change later
  serviceName: { type: String, required: true },
  serviceCategory: String,
  specialistName: { type: String, required: true },
  durationMin: { type: Number, required: true },
  totalAmount: { type: Number, required: true },

  guest: {
    name: { type: String, required: true },
    phone: { type: String, required: true },   // +639XXXXXXXXX
    email: { type: String, default: '' }          // optional for walk-ins
  },
  notes: { type: String, default: '' },

  date: { type: String, required: true },       // YYYY-MM-DD (Philippine date)
  startTime: { type: String, required: true },  // HH:mm 24h
  endTime: { type: String, required: true },
  startAt: { type: Date, required: true },      // exact instant (UTC) for sorting / reminders

  payOption: { type: String, enum: ['deposit', 'full'], default: 'deposit' },
  paymentMethod: { type: String, required: true },
  depositAmount: { type: Number, required: true },
  amountPaid: { type: Number, default: 0 },
  paymentStatus: { type: String, enum: ['unpaid', 'deposit_paid', 'paid', 'refunded'], default: 'unpaid' },

  status: { type: String, enum: ['pending', 'confirmed', 'in_treatment', 'completed', 'cancelled', 'no_show'], default: 'pending' },
  customer: { type: Schema.Types.ObjectId, ref: 'Customer', index: true },   // set when a signed-in customer books
  cancelledAt: Date,
  cancelReason: { type: String, default: '' },
  staffNotes: [{ by: String, text: String, at: { type: Date, default: Date.now }, _id: false }],
  cancelledBy: { type: String, enum: ['guest', 'admin'] },
  source: { type: String, enum: ['online', 'walk-in'], default: 'online' }
}, { timestamps: true });

booking.index({ date: 1, startTime: 1 });
booking.index({ status: 1 });
booking.index({ 'guest.phone': 1 });
booking.index({ startAt: 1 });

module.exports = model('Booking', booking);