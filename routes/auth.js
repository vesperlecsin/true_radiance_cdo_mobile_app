const router = require('express').Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const Customer = require('../models/Customer');
const Admin = require('../models/Admin');
const Booking = require('../models/Booking');
const A = require('../middleware/auth');
const { BookingError, normalizePhone, cancelCheck, cancelBooking } = require('../utils/bookingEngine');
const { label12 } = require('../utils/time');

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
  if (err instanceof BookingError) return res.status(err.status).json({ error: err.message });
  console.error(err); res.status(500).json({ error: 'Something went wrong. Please try again.' + (process.env.NODE_ENV !== 'production' ? ` [${err.message}]` : '') });
});
const DUMMY = bcrypt.hashSync('not-a-real-password', 10);   // keeps login timing similar when the user doesn't exist
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in a few minutes.' } });

// ---- create customer account ----
router.post('/register', limiter, wrap(async (req, res) => {
  const name = String(req.body.name || '').trim().replace(/\s+/g, ' ');
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (name.length < 2 || name.length > 80) throw new BookingError('Please enter your full name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) throw new BookingError('Please enter a valid email address.');
  const phone = normalizePhone(req.body.phone);
  if (password.length < 8 || password.length > 72) throw new BookingError('Password must be 8–72 characters.');
  const taken = new BookingError('An account with this email already exists. Please sign in instead.', 409);
  if (await Customer.exists({ email })) throw taken;
  let c;
  try { c = await Customer.create({ name, email, phone, passwordHash: await bcrypt.hash(password, 12) }); }
  catch (e) { if (e.code === 11000) throw taken; throw e; }
  const token = A.signCustomer(c);
  res.cookie(A.CUSTOMER_COOKIE, token, A.customerCookieOpts());
  res.status(201).json({ role: 'customer', redirect: '/my-account', ...(A.isAppClient(req) && { token }) });
}));

// ---- one sign-in for customers (email) and staff (username) ----
router.post('/login', limiter, wrap(async (req, res) => {
  const id = String(req.body.identifier || '').trim().toLowerCase();
  const pw = String(req.body.password || '');
  let user = null, role = null;
  if (id.includes('@')) { user = await Customer.findOne({ email: id }); role = 'customer'; }
  if (!user) { const a = await Admin.findOne({ username: id }); if (a) { user = a; role = 'admin'; } }
  const ok = (await bcrypt.compare(pw, user ? user.passwordHash : DUMMY)) && user;
  if (!ok) return res.status(401).json({ error: 'Incorrect email/username or password.' });
  if (role === 'admin') { res.cookie(A.COOKIE, A.sign(user), A.cookieOpts()); return res.json({ role, redirect: '/admin' }); }
  const token = A.signCustomer(user);
  res.cookie(A.CUSTOMER_COOKIE, token, A.customerCookieOpts());
  res.json({ role, redirect: '/my-account', ...(A.isAppClient(req) && { token }) });
}));

router.post('/logout', (req, res) => { res.clearCookie(A.COOKIE); res.clearCookie(A.CUSTOMER_COOKIE); res.json({ ok: true }); });

router.get('/me', wrap(async (req, res) => {
  const admin = A.readAdmin(req);
  if (admin) return res.json({ role: 'admin', name: admin.name });
  const c = A.readCustomer(req);
  const doc = c && await Customer.findById(c.id).lean();
  if (!doc) return res.json({ role: null });
  res.json({ role: 'customer', name: doc.name, email: doc.email, phone: doc.phone });
}));

// ---- my bookings ----
const view = (b) => ({
  id: b._id, ref: b.ref, status: b.status, serviceName: b.serviceName, specialistName: b.specialistName,
  date: b.date, timeLabel: label12(b.startTime), totalAmount: b.totalAmount, depositAmount: b.depositAmount,
  amountPaid: b.amountPaid, paymentStatus: b.paymentStatus, past: b.startAt < new Date(), cancel: cancelCheck(b)
});
router.get('/my/bookings', A.requireCustomer, wrap(async (req, res) => {
  const list = await Booking.find({ customer: req.customer.id }).sort({ startAt: -1 }).limit(100);
  res.json({ bookings: list.map(view) });
}));
router.post('/my/bookings/:id/cancel', A.requireCustomer, wrap(async (req, res) => {
  const b = await Booking.findOne({ _id: req.params.id, customer: req.customer.id });
  if (!b) throw new BookingError('Booking not found.', 404);
  await cancelBooking(b);
  res.json({ booking: view(b), paidNote: b.amountPaid > 0 });
}));

module.exports = router;