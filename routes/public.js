const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const Service = require('../models/Service');
const Specialist = require('../models/Specialist');
const { createBooking, getAvailability, BookingError, findGuestBooking, cancelCheck, cancelByGuest } = require('../utils/bookingEngine');
const R = require('../config/rules');
const { readCustomer } = require('../middleware/auth');
const { label12 } = require('../utils/time');

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
  if (err instanceof BookingError) return res.status(err.status).json({ error: err.message });
  console.error(err); res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

// Public settings the booking page needs (payment method names must match what createBooking accepts)
router.get('/config', (req, res) => {
  res.json({ paymentMethods: R.PAYMENT_METHODS });
});

router.get('/services', wrap(async (req, res) => {
  res.json(await Service.find({ isActive: true }).sort({ sortOrder: 1 }).lean());
}));

router.get('/specialists', wrap(async (req, res) => {
  res.json(await Specialist.find({ isActive: true }).sort({ sortOrder: 1 }).lean());
}));

router.get('/availability', wrap(async (req, res) => {
  const { serviceId, specialistId = 'any', date } = req.query;
  res.json({ slots: await getAvailability({ serviceId: String(serviceId), specialistId: String(specialistId), date: String(date) }) });
}));

// Anti-spam: max bookings per hour per IP (default 20). Not applied while NODE_ENV is not "production", so testing never locks you out.
const bookingLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: Number(process.env.BOOKING_LIMIT_PER_HOUR || 20),
  skip: () => process.env.NODE_ENV !== 'production', standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many booking attempts. Please try again later or contact us on Viber.' } });

router.post('/bookings', bookingLimiter, wrap(async (req, res) => {
  const b = await createBooking(req.body || {}, { customerId: readCustomer(req)?.id });
  // Only return what the guest needs to see
  res.status(201).json({ booking: {
    ref: b.ref, serviceName: b.serviceName, specialistName: b.specialistName,
    date: b.date, startTime: b.startTime, timeLabel: label12(b.startTime),
    totalAmount: b.totalAmount, depositAmount: b.depositAmount, payOption: b.payOption,
    paymentMethod: b.paymentMethod, guest: b.guest, cancelHours: R.CANCEL_HOURS
  } });
}));

// ---- guest manage / cancel (ref + mobile number) ----
const manageLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in a few minutes.' } });
const guestView = (b) => ({
  ref: b.ref, status: b.status, serviceName: b.serviceName, specialistName: b.specialistName,
  date: b.date, startTime: b.startTime, timeLabel: label12(b.startTime), totalAmount: b.totalAmount,
  depositAmount: b.depositAmount, amountPaid: b.amountPaid, paymentStatus: b.paymentStatus, guestName: b.guest.name,
  cancel: cancelCheck(b)
});

router.post('/bookings/lookup', manageLimiter, wrap(async (req, res) => {
  res.json({ booking: guestView(await findGuestBooking(req.body.ref, req.body.phone)) });
}));

router.post('/bookings/cancel', manageLimiter, wrap(async (req, res) => {
  const b = await cancelByGuest(req.body.ref, req.body.phone);
  res.json({ booking: guestView(b), paidNote: b.amountPaid > 0 });
}));

module.exports = router;