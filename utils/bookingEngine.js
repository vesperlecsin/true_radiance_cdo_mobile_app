const mongoose = require('mongoose');
const Service = require('../models/Service');
const Specialist = require('../models/Specialist');
const Booking = require('../models/Booking');
const SlotLock = require('../models/SlotLock');
const Counter = require('../models/Counter');
const R = require('../config/rules');
const T = require('./time');

class BookingError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

const blocksFor = (startMin, dur) =>
  Array.from({ length: Math.ceil(dur / R.BLOCK) }, (_, i) => startMin + i * R.BLOCK);

const isId = (v) => typeof v === 'string' && mongoose.isValidObjectId(v);

// Specialists who can perform this service (optionally a single chosen one)
async function eligibleSpecialists(service, specialistId) {
  const q = { isActive: true, serviceCategories: service.category };
  if (specialistId && specialistId !== 'any') {
    if (!isId(specialistId)) throw new BookingError('Invalid specialist.');
    q._id = specialistId;
  }
  const list = await Specialist.find(q).sort({ sortOrder: 1 });
  if (!list.length) throw new BookingError('That specialist is not available for this service.');
  return list;
}

// Safe numbers: if a setting is missing/invalid we fall back to a default instead of silently allowing everything.
const num = (v, fallback) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : fallback);

/**
 * Is this start time still bookable RIGHT NOW (Philippine time)?
 *  - guests: the start must be at least MIN_LEAD_HOURS from now, and within MAX_ADVANCE_DAYS
 *  - staff walk-ins: the current half-hour slot is allowed, anything earlier is not
 * Compares real timestamps, so a time that has already passed can never be offered or booked.
 */
function slotIsInBookableWindow(date, startMin, walkIn = false) {
  const today = T.todayISO();
  const maxDays = Math.max(1, num(R.MAX_ADVANCE_DAYS, 60));
  if (date < today || date > T.addDaysISO(today, maxDays)) return false;

  const start = T.toInstant(date, T.toHHMM(startMin)).getTime();      // the real moment (PHT, UTC+8)
  if (Number.isNaN(start)) return false;
  if (walkIn) return start > Date.now() - num(R.START_STEP, 30) * 60e3;

  const leadHours = Math.max(0, num(R.MIN_LEAD_HOURS, 2));
  return start >= Date.now() + leadHours * 3600e3;
}

/** Time slots for one date: [{ time:'14:30', label:'2:30 PM', available:true }] */
async function getAvailability({ serviceId, specialistId, date, walkIn = false }) {
  if (!isId(serviceId)) throw new BookingError('Invalid service.');
  if (!T.isISODate(date)) throw new BookingError('Invalid date.');
  const service = await Service.findOne({ _id: serviceId, isActive: true });
  if (!service) throw new BookingError('Service not found.', 404);

  const specs = await eligibleSpecialists(service, specialistId);
  const locks = await SlotLock.find({ specialist: { $in: specs.map(s => s._id) }, date }).lean();
  const busy = new Map(specs.map(s => [String(s._id), new Set()]));
  locks.forEach(l => busy.get(String(l.specialist)).add(l.block));

  const slots = [];
  for (let start = R.OPEN_MIN; start + service.durationMin <= R.CLOSE_MIN; start += R.START_STEP) {
    const blocks = blocksFor(start, service.durationMin);
    const free = slotIsInBookableWindow(date, start, walkIn) &&
      specs.some(s => blocks.every(b => !busy.get(String(s._id)).has(b)));
    const hhmm = T.toHHMM(start);
    slots.push({ time: hhmm, label: T.label12(hhmm), available: free });
  }
  return slots;
}

// ---- input cleaning -------------------------------------------------------
function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('63')) d = d.slice(2);
  else if (d.startsWith('0')) d = d.slice(1);
  if (!/^9\d{9}$/.test(d)) throw new BookingError('Please enter a valid Philippine mobile number (9XX XXX XXXX).');
  return '+63' + d;
}

function cleanGuest(g = {}, emailOptional = false) {
  const name = String(g.name || '').trim().replace(/\s+/g, ' ');
  const email = String(g.email || '').trim().toLowerCase();
  if (name.length < 2 || name.length > 80) throw new BookingError('Please enter your full name.');
  if (!(emailOptional && !email) && (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120)) throw new BookingError('Please enter a valid email address.');
  return { name, email, phone: normalizePhone(g.phone) };
}

async function nextRef() {
  const c = await Counter.findOneAndUpdate({ _id: 'booking' }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return `TR-${8800 + c.seq}`;
}

/**
 * Create a booking. Race-safe: we first insert one SlotLock per 15-min block
 * (unique index). If any block is already taken, the insert fails and we roll back.
 */
async function createBooking(input, { source = 'online', customerId = null, walkIn = false } = {}) {
  const { serviceId, specialistId = 'any', date, time, payOption = 'deposit', paymentMethod } = input;
  if (!isId(serviceId)) throw new BookingError('Please choose a service.');
  if (!T.isISODate(String(date))) throw new BookingError('Please choose a date.');
  if (!/^\d{2}:\d{2}$/.test(String(time))) throw new BookingError('Please choose a time.');
  if (![...R.PAYMENT_METHODS, ...(walkIn ? R.WALKIN_EXTRA_METHODS : [])].includes(paymentMethod)) throw new BookingError('Please choose a payment method.');
  if (!['deposit', 'full'].includes(payOption)) throw new BookingError('Invalid payment option.');

  const guest = cleanGuest(input.guest, walkIn);
  const notes = String(input.notes || '').trim().slice(0, 500);

  const service = await Service.findOne({ _id: serviceId, isActive: true });
  if (!service) throw new BookingError('Service not found.', 404);

  const startMin = T.toMin(time);
  const endMin = startMin + service.durationMin;
  if (startMin < R.OPEN_MIN || endMin > R.CLOSE_MIN || (startMin - R.OPEN_MIN) % R.START_STEP !== 0)
    throw new BookingError('That time is outside our opening hours.');
  if (!slotIsInBookableWindow(date, startMin, walkIn))
    throw new BookingError(walkIn
      ? 'That time has already passed.'
      : `Please book at least ${Math.max(0, num(R.MIN_LEAD_HOURS, 2))} hours ahead (and within ${Math.max(1, num(R.MAX_ADVANCE_DAYS, 60))} days).`);

  const specs = await eligibleSpecialists(service, specialistId);
  const blocks = blocksFor(startMin, service.durationMin);
  const _id = new mongoose.Types.ObjectId();

  let chosen = null;
  for (const spec of specs) {
    try {
      await SlotLock.insertMany(blocks.map(block => ({ specialist: spec._id, date, block, booking: _id })), { ordered: true });
      chosen = spec; break;
    } catch (err) {
      await SlotLock.deleteMany({ booking: _id });                // roll back partial locks
      if (err.code !== 11000 && !(err.writeErrors || []).some(e => e.code === 11000)) throw err;
      // that specialist is taken -> try the next one ("Any available")
    }
  }
  if (!chosen) throw new BookingError('Sorry, that time was just taken. Please pick another slot.', 409);

  try {
    const total = service.price;
    const deposit = payOption === 'full' ? total : Math.round(total * num(R.DEPOSIT_RATE, 0.2));
    const booking = await Booking.create({
      _id, ref: await nextRef(),
      service: service._id, specialist: chosen._id,
      serviceName: service.name, serviceCategory: service.category,
      specialistName: chosen.name, durationMin: service.durationMin, totalAmount: total,
      guest, notes, date, startTime: time, endTime: T.toHHMM(endMin), startAt: T.toInstant(date, time),
      payOption, paymentMethod, depositAmount: deposit, source, ...(customerId ? { customer: customerId } : {})
    });
    return booking;
  } catch (err) {
    await SlotLock.deleteMany({ booking: _id });
    throw err;
  }
}

const releaseSlots = (bookingId) => SlotLock.deleteMany({ booking: bookingId });

// ---- guest self-service (needs booking reference + the mobile number used to book) ----
const NOT_FOUND = "We couldn't find a booking with those details. Please check your reference and mobile number.";

async function findGuestBooking(ref, phone) {
  const r = String(ref || '').trim().toUpperCase().replace(/^#/, '');
  let p;
  try { p = normalizePhone(phone); } catch { throw new BookingError(NOT_FOUND, 404); }
  const b = await Booking.findOne({ ref: r, 'guest.phone': p });
  if (!b) throw new BookingError(NOT_FOUND, 404);
  return b;
}

function cancelCheck(b) {
  if (b.status === 'cancelled') return { ok: false, reason: 'This booking is already cancelled.' };
  if (!['pending', 'confirmed'].includes(b.status)) return { ok: false, reason: 'This booking can no longer be cancelled online.' };
  const hours = (b.startAt.getTime() - Date.now()) / 36e5;
  if (hours <= 0) return { ok: false, reason: 'This appointment has already started or passed.' };

  // Booked by mistake? Free cancellation for a short grace period right after booking, even inside the notice window.
  const graceMin = Math.max(0, num(R.CANCEL_GRACE_MINUTES, 60));
  const graceEnds = b.createdAt ? new Date(new Date(b.createdAt).getTime() + graceMin * 60e3) : null;
  if (graceEnds && Date.now() < graceEnds.getTime()) return { ok: true, grace: true, graceEndsAt: graceEnds.toISOString() };

  const noticeHours = num(R.CANCEL_HOURS, 24);
  if (hours < noticeHours)
    return { ok: false, reason: `Online cancellation closes ${noticeHours} hours before your appointment (or ${graceMin} minutes after booking). Please call or message our concierge on Viber at +63 917 892 4561.` };
  return { ok: true };
}

async function cancelBooking(b) {
  const chk = cancelCheck(b);
  if (!chk.ok) throw new BookingError(chk.reason, 400);
  b.status = 'cancelled'; b.cancelledAt = new Date(); b.cancelledBy = 'guest';
  await b.save();
  await releaseSlots(b._id);          // slot becomes bookable again
  return b;
}
async function cancelByGuest(ref, phone) { return cancelBooking(await findGuestBooking(ref, phone)); }

module.exports = { BookingError, getAvailability, createBooking, releaseSlots, findGuestBooking, cancelCheck, cancelByGuest, cancelBooking, normalizePhone };