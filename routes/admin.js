const router = require('express').Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const Admin = require('../models/Admin');
const Booking = require('../models/Booking');
const Specialist = require('../models/Specialist');
const { sign, requireAdmin, cookieOpts, COOKIE } = require('../middleware/auth');
const Service = require('../models/Service');
const mongoose = require('mongoose');
const settings = require('../config/settings');
const R = require('../config/rules');
const { releaseSlots, createBooking, getAvailability, BookingError } = require('../utils/bookingEngine');
const T = require('../utils/time');

const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  if (e instanceof BookingError) return res.status(e.status).json({ error: e.message });
  if (e.name === 'ValidationError' || e.name === 'CastError') return res.status(400).json({ error: e.message });
  if (e.code === 11000) return res.status(409).json({ error: 'That value already exists.' });
  console.error(e); res.status(500).json({ error: 'Server error.' + (process.env.NODE_ENV !== 'production' ? ` [${e.message}]` : '') });
});
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------- auth ----------
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, message: { error: 'Too many attempts. Try again in 15 minutes.' } });

router.post('/login', loginLimiter, wrap(async (req, res) => {
  const admin = await Admin.findOne({ username: String(req.body.username || '').toLowerCase().trim() });
  const ok = admin && await bcrypt.compare(String(req.body.password || ''), admin.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Incorrect username or password.' });
  res.cookie(COOKIE, sign(admin), cookieOpts());
  res.json({ ok: true });
}));
router.post('/logout', (req, res) => { res.clearCookie(COOKIE); res.json({ ok: true }); });
router.get('/me', requireAdmin, (req, res) => res.json({ name: req.admin.name, role: req.admin.role }));

router.use(requireAdmin); // everything below needs a signed-in admin

// ---------- list / filter ----------
function buildFilter(q) {
  const f = {};
  const today = T.todayISO();
  const range = String(q.date || 'today');
  if (range === 'today') f.date = today;
  else if (range === 'week') f.date = { $gte: today, $lte: T.addDaysISO(today, 6) };
  else if (range === 'month') f.date = { $gte: today.slice(0, 8) + '01', $lte: today.slice(0, 8) + '31' };
  else if (range === 'upcoming') f.date = { $gte: today };
  else if (range === 'recent') f.createdAt = { $gte: new Date(Date.now() - 48 * 3600e3) };   // booked in the last 48h, any appointment date
  else if (T.isISODate(range)) f.date = range;               // 'all' => no date filter
  if (q.status) f.status = String(q.status);
  if (q.payment) f.paymentStatus = String(q.payment);
  if (q.specialist) f.specialistName = String(q.specialist);
  if (q.q) {
    const rx = new RegExp(esc(String(q.q).trim().replace(/^#/, '')), 'i');
    f.$or = [{ 'guest.name': rx }, { 'guest.phone': rx }, { ref: rx }, { 'guest.email': rx }];
  }
  return f;
}

router.get('/bookings', wrap(async (req, res) => {
  const filter = buildFilter(req.query);
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const [items, total] = await Promise.all([
    Booking.find(filter).sort(req.query.date === 'recent' ? { createdAt: -1 } : { date: 1, startTime: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Booking.countDocuments(filter)
  ]);
  res.json({ items, total, page, pages: Math.max(Math.ceil(total / limit), 1) });
}));

router.get('/bookings/export.csv', wrap(async (req, res) => {
  const rows = await Booking.find(buildFilter(req.query)).sort({ date: 1, startTime: 1 }).limit(5000).lean();
  const cell = (v) => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; }; // blocks CSV formula injection
  const head = ['Ref', 'Guest', 'Mobile', 'Email', 'Service', 'Specialist', 'Date', 'Start', 'End', 'Total', 'Paid', 'Payment Method', 'Payment Status', 'Status', 'Notes', 'Booked At'];
  const lines = rows.map(b => [b.ref, b.guest.name, b.guest.phone, b.guest.email, b.serviceName, b.specialistName, b.date, b.startTime, b.endTime,
    b.totalAmount, b.amountPaid, b.paymentMethod, b.paymentStatus, b.status, b.notes, b.createdAt.toISOString()].map(cell).join(','));
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="bookings-${T.todayISO()}.csv"` });
  res.send('\uFEFF' + [head.join(','), ...lines].join('\r\n'));
}));

// ---------- KPI cards ----------
router.get('/stats', wrap(async (req, res) => {
  const today = T.todayISO(), monthStart = today.slice(0, 8) + '01';
  const live = { $nin: ['cancelled', 'no_show'] };
  const startOfTodayUTC = new Date(Date.parse(today + 'T00:00:00+08:00'));
  const [todayCount, upcoming, pending, cancelledToday, revenue, split] = await Promise.all([
    Booking.countDocuments({ date: today, status: live }),
    Booking.countDocuments({ date: { $gte: today, $lte: T.addDaysISO(today, 7) }, status: 'confirmed' }),
    Booking.countDocuments({ status: 'pending' }),
    Booking.countDocuments({ status: { $in: ['cancelled', 'no_show'] }, updatedAt: { $gte: startOfTodayUTC } }),
    Booking.aggregate([{ $match: { date: { $gte: monthStart }, status: live } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
    Booking.aggregate([{ $match: { date: { $gte: monthStart }, status: live } }, { $group: { _id: '$paymentMethod', total: { $sum: '$totalAmount' } } }])
  ]);
  res.json({ today: todayCount, upcoming, pending, cancelledToday, revenue: revenue[0]?.total || 0,
    split: Object.fromEntries(split.map(s => [s._id, s.total])) });
}));

router.get('/specialists', wrap(async (req, res) => res.json(await Specialist.find().sort({ sortOrder: 1 }).lean())));

// ---------- update status / payment ----------
router.patch('/bookings/:id', wrap(async (req, res) => {
  const b = await Booking.findById(req.params.id);
  if (!b) return res.status(404).json({ error: 'Booking not found.' });
  const { status, paymentStatus } = req.body || {};
  const STATUSES = Booking.schema.path('status').enumValues, PAY = Booking.schema.path('paymentStatus').enumValues;

  if (paymentStatus) {
    if (!PAY.includes(paymentStatus)) return res.status(400).json({ error: 'Invalid payment status.' });
    b.paymentStatus = paymentStatus;
    b.amountPaid = paymentStatus === 'paid' ? b.totalAmount : paymentStatus === 'deposit_paid' ? b.depositAmount : 0;
    if (b.status === 'pending' && ['paid', 'deposit_paid'].includes(paymentStatus) && !status) b.status = 'confirmed'; // deposit verified => confirm
  }
  if (status) {
    if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    if (status === 'cancelled' && b.status !== 'cancelled') { b.cancelledAt = new Date(); b.cancelledBy = 'admin'; b.cancelReason = String(req.body.cancelReason || '').trim().slice(0, 300); }
    b.status = status;
  }
  await b.save();
  if (['cancelled', 'no_show'].includes(b.status)) await releaseSlots(b._id); // frees the slot for other guests
  res.json({ booking: b });
}));

// =====================================================================
//  Walk-in / phone bookings
// =====================================================================
const isId = (v) => mongoose.isValidObjectId(v);
router.get('/availability', wrap(async (req, res) => {
  const { serviceId, specialistId = 'any', date } = req.query;
  res.json({ slots: await getAvailability({ serviceId: String(serviceId), specialistId: String(specialistId), date: String(date), walkIn: true }) });
}));

router.post('/bookings', wrap(async (req, res) => {
  const payStatus = ['unpaid', 'deposit_paid', 'paid'].includes(req.body.payStatus) ? req.body.payStatus : 'unpaid';
  const b = await createBooking({ ...req.body, payOption: payStatus === 'paid' ? 'full' : 'deposit' }, { source: 'walk-in', walkIn: true });
  b.status = 'confirmed';                                   // staff-entered bookings are confirmed immediately
  b.paymentStatus = payStatus;
  b.amountPaid = payStatus === 'paid' ? b.totalAmount : payStatus === 'deposit_paid' ? b.depositAmount : 0;
  b.staffNotes.push({ by: req.admin.name, text: 'Created by staff (walk-in / phone).' });
  await b.save();
  res.status(201).json({ booking: b });
}));

// =====================================================================
//  Booking details + CRM
// =====================================================================
router.get('/bookings/:id', wrap(async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ error: 'Booking not found.' });
  const b = await Booking.findById(req.params.id).lean();
  if (!b) return res.status(404).json({ error: 'Booking not found.' });
  const all = await Booking.find({ 'guest.phone': b.guest.phone, _id: { $ne: b._id } }).sort({ startAt: -1 }).lean();
  const done = all.filter((x) => x.status === 'completed');
  res.json({ booking: b, history: all.slice(0, 5), visits: done.length, lifetimeSpend: done.reduce((t, x) => t + x.totalAmount, 0) });
}));

router.post('/bookings/:id/notes', wrap(async (req, res) => {
  const text = String(req.body.text || '').trim().slice(0, 500);
  if (!text) return res.status(400).json({ error: 'Please type a note.' });
  const b = await Booking.findByIdAndUpdate(req.params.id, { $push: { staffNotes: { by: req.admin.name, text, at: new Date() } } }, { new: true });
  if (!b) return res.status(404).json({ error: 'Booking not found.' });
  res.json({ staffNotes: b.staffNotes });
}));

// =====================================================================
//  Services & pricing
// =====================================================================
const slugify = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
function cleanService(b) {
  const name = String(b.name || '').trim().replace(/\s+/g, ' ');
  const durationMin = Number(b.durationMin), price = Number(b.price);
  if (name.length < 2 || name.length > 80) throw new BookingError('Service name must be 2–80 characters.');
  if (!R.CATEGORIES.includes(b.category)) throw new BookingError('Please choose a category.');
  if (!Number.isInteger(durationMin) || durationMin < 15 || durationMin > 480 || durationMin % 15) throw new BookingError('Duration must be 15–480 minutes, in steps of 15.');
  if (!Number.isFinite(price) || price < 0 || price > 1000000) throw new BookingError('Please enter a valid price.');
  return { name, category: b.category, durationMin, price, description: String(b.description || '').trim().slice(0, 300), popular: !!b.popular };
}
router.get('/services', wrap(async (req, res) => res.json(await Service.find().sort({ sortOrder: 1, name: 1 }).lean())));
router.post('/services', wrap(async (req, res) => {
  const d = cleanService(req.body);
  let slug = slugify(d.name); if (await Service.exists({ slug })) slug += '-' + Date.now().toString(36).slice(-4);
  const last = await Service.findOne().sort({ sortOrder: -1 }).lean();
  res.status(201).json(await Service.create({ ...d, slug, sortOrder: (last?.sortOrder ?? 0) + 1 }));
}));
router.patch('/services/:id', wrap(async (req, res) => {
  const s = await Service.findById(req.params.id); if (!s) return res.status(404).json({ error: 'Service not found.' });
  if (typeof req.body.isActive === 'boolean' && Object.keys(req.body).length === 1) s.isActive = req.body.isActive;   // quick toggle
  else Object.assign(s, cleanService({ ...s.toObject(), ...req.body }), typeof req.body.isActive === 'boolean' ? { isActive: req.body.isActive } : {});
  await s.save(); res.json(s);
}));

// =====================================================================
//  Specialists
// =====================================================================
function cleanSpecialist(b) {
  const name = String(b.name || '').trim().replace(/\s+/g, ' '), role = String(b.role || '').trim();
  const years = Number(b.yearsExperience || 0), cats = (Array.isArray(b.serviceCategories) ? b.serviceCategories : []).filter((c) => R.CATEGORIES.includes(c));
  if (name.length < 2 || name.length > 60) throw new BookingError('Please enter the specialist\'s name.');
  if (role.length < 2 || role.length > 80) throw new BookingError('Please enter a role / title.');
  if (!Number.isFinite(years) || years < 0 || years > 60) throw new BookingError('Years of experience must be 0–60.');
  if (!cats.length) throw new BookingError('Choose at least one service category.');
  return { name, role, yearsExperience: Math.round(years), serviceCategories: cats };
}
router.get('/roster', wrap(async (req, res) => {
  const today = T.todayISO();
  const [list, todayAgg, upAgg] = await Promise.all([
    Specialist.find().sort({ sortOrder: 1 }).lean(),
    Booking.aggregate([{ $match: { date: today, status: { $nin: ['cancelled', 'no_show'] } } }, { $group: { _id: '$specialist', n: { $sum: 1 } } }]),
    Booking.aggregate([{ $match: { date: { $gte: today }, status: { $in: ['pending', 'confirmed'] } } }, { $group: { _id: '$specialist', n: { $sum: 1 } } }])
  ]);
  const t = Object.fromEntries(todayAgg.map((x) => [String(x._id), x.n])), u = Object.fromEntries(upAgg.map((x) => [String(x._id), x.n]));
  res.json(list.map((s) => ({ ...s, today: t[String(s._id)] || 0, upcoming: u[String(s._id)] || 0 })));
}));
router.post('/specialists', wrap(async (req, res) => {
  const d = cleanSpecialist(req.body); const last = await Specialist.findOne().sort({ sortOrder: -1 }).lean();
  let slug = slugify(d.name); if (await Specialist.exists({ slug })) slug += '-' + Date.now().toString(36).slice(-4);
  res.status(201).json(await Specialist.create({ ...d, slug, sortOrder: (last?.sortOrder ?? 0) + 1 }));
}));
router.patch('/specialists/:id', wrap(async (req, res) => {
  const s = await Specialist.findById(req.params.id); if (!s) return res.status(404).json({ error: 'Specialist not found.' });
  if (typeof req.body.isActive === 'boolean' && Object.keys(req.body).length === 1) s.isActive = req.body.isActive;
  else Object.assign(s, cleanSpecialist({ ...s.toObject(), ...req.body }));
  await s.save(); res.json(s);
}));

// =====================================================================
//  Settings (booking policies)
// =====================================================================
router.get('/settings', wrap(async (req, res) => res.json(await settings.load())));
router.put('/settings', wrap(async (req, res) => {
  try { res.json(await settings.save(req.body || {})); } catch (e) { throw new BookingError(e.message); }
}));

// =====================================================================
//  Revenue analytics
// =====================================================================
router.get('/analytics', wrap(async (req, res) => {
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(req.query.month || '')) ? req.query.month : T.todayISO().slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const rng = (mo) => ({ $gte: mo + '-01', $lte: mo + '-31' });
  const live = { $nin: ['cancelled', 'no_show'] };
  const match = { date: rng(month), status: live };
  const [tot, prevTot, byMethod, daily, top, hours, recent] = await Promise.all([
    Booking.aggregate([{ $match: match }, { $group: { _id: null, gross: { $sum: '$totalAmount' }, collected: { $sum: '$amountPaid' }, count: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } } } }]),
    Booking.aggregate([{ $match: { date: rng(prev), status: live } }, { $group: { _id: null, gross: { $sum: '$totalAmount' } } }]),
    Booking.aggregate([{ $match: match }, { $group: { _id: '$paymentMethod', total: { $sum: '$totalAmount' } } }]),
    Booking.aggregate([{ $match: match }, { $group: { _id: { d: '$date', m: '$paymentMethod' }, total: { $sum: '$totalAmount' } } }]),
    Booking.aggregate([{ $match: match }, { $group: { _id: '$serviceName', count: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } }, { $sort: { revenue: -1 } }, { $limit: 5 }]),
    Booking.aggregate([{ $match: match }, { $group: { _id: { $substr: ['$startTime', 0, 2] }, n: { $sum: 1 } } }]),
    Booking.find(match).sort({ createdAt: -1 }).limit(8).lean()
  ]);
  const t = tot[0] || { gross: 0, collected: 0, count: 0, completed: 0 };
  const grp = (k) => (k === 'GCash' || k === 'Maya' ? k : 'Other');
  const split = { GCash: 0, Maya: 0, Other: 0 }; byMethod.forEach((x) => (split[grp(x._id)] += x.total));
  const days = {}; daily.forEach((x) => { (days[x._id.d] ||= { date: x._id.d, GCash: 0, Maya: 0, Other: 0 })[grp(x._id.m)] += x.total; });
  const buckets = [['9 AM – 12 PM', 9, 11], ['12 – 2 PM', 12, 13], ['2 – 5 PM', 14, 16], ['5 – 7 PM', 17, 18], ['7 – 9 PM', 19, 21]];
  const peak = buckets.map(([label, a, b]) => ({ label, count: hours.filter((h) => +h._id >= a && +h._id <= b).reduce((s, h) => s + h.n, 0) }));
  res.json({
    month, gross: t.gross, collected: t.collected, count: t.count, completed: t.completed, avg: t.count ? Math.round(t.gross / t.count) : 0,
    prevGross: prevTot[0]?.gross || 0, change: prevTot[0]?.gross ? Math.round(((t.gross - prevTot[0].gross) / prevTot[0].gross) * 1000) / 10 : null,
    split, daily: Object.values(days).sort((a, b) => a.date.localeCompare(b.date)), top: top.map((x) => ({ name: x._id, count: x.count, revenue: x.revenue })), peak, recent
  });
}));

// =====================================================================
//  Clients (everyone who has booked, grouped by mobile number)
// =====================================================================
router.get('/clients', wrap(async (req, res) => {
  const today = T.todayISO(), page = Math.max(Number(req.query.page) || 1, 1), limit = 15;
  const SORTS = { recent: { last: -1, bookings: -1 }, spend: { spend: -1, booked: -1 }, visits: { completed: -1, bookings: -1 }, name: { name: 1 } };
  const sort = SORTS[req.query.sort] || SORTS.recent;
  const dead = ['cancelled', 'no_show'];
  const pipeline = [
    { $sort: { createdAt: -1 } },
    { $group: {
      _id: '$guest.phone', name: { $first: '$guest.name' }, email: { $max: '$guest.email' },
      bookings: { $sum: 1 },
      completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
      spend: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalAmount', 0] } },
      booked: { $sum: { $cond: [{ $in: ['$status', dead] }, 0, '$totalAmount'] } },
      last: { $max: { $cond: [{ $or: [{ $in: ['$status', dead] }, { $gt: ['$date', today] }] }, null, '$date'] } },   // last visit = most recent PAST, non-cancelled booking
      next: { $min: { $cond: [{ $and: [{ $gte: ['$date', today] }, { $in: ['$status', ['pending', 'confirmed']] }] }, '$date', null] } },
      hasAccount: { $max: { $cond: [{ $ifNull: ['$customer', false] }, 1, 0] } },
      firstSeen: { $min: '$createdAt' } } }
  ];
  const q = String(req.query.q || '').trim();
  if (q) { const rx = new RegExp(esc(q), 'i'); pipeline.push({ $match: { $or: [{ name: rx }, { _id: rx }, { email: rx }] } }); }
  pipeline.push({ $sort: sort }, { $facet: {
    items: [{ $skip: (page - 1) * limit }, { $limit: limit }],
    stats: [{ $group: { _id: null, total: { $sum: 1 }, accounts: { $sum: '$hasAccount' }, returning: { $sum: { $cond: [{ $gte: ['$bookings', 2] }, 1, 0] } } } }]
  } });
  const [r] = await Booking.aggregate(pipeline);
  const stats = r.stats[0] || { total: 0, accounts: 0, returning: 0 };
  res.json({ items: r.items, page, pages: Math.max(Math.ceil(stats.total / limit), 1), stats });
}));

router.get('/clients/:phone', wrap(async (req, res) => {
  const phone = String(req.params.phone);
  const bookings = await Booking.find({ 'guest.phone': phone }).sort({ startAt: -1 }).limit(100).lean();
  if (!bookings.length) return res.status(404).json({ error: 'Client not found.' });
  const done = bookings.filter((b) => b.status === 'completed');
  res.json({ phone, name: bookings[0].guest.name, email: bookings.map((b) => b.guest.email).find(Boolean) || '', hasAccount: bookings.some((b) => b.customer),
    visits: done.length, spend: done.reduce((t, b) => t + b.totalAmount, 0), bookings });
}));

// =====================================================================
//  Bookings page overview (today's breakdown, next 7 days, settled today)
// =====================================================================
router.get('/overview', wrap(async (req, res) => {
  const today = T.todayISO(), live = { $nin: ['cancelled', 'no_show'] };
  const [byStatus, week, settled, pending] = await Promise.all([
    Booking.aggregate([{ $match: { date: today } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    Booking.aggregate([{ $match: { date: { $gte: today, $lte: T.addDaysISO(today, 6) }, status: live } }, { $group: { _id: '$date', n: { $sum: 1 } } }]),
    Booking.aggregate([{ $match: { date: today, status: live } }, { $group: { _id: '$paymentMethod', total: { $sum: '$amountPaid' } } }]),
    Booking.countDocuments({ status: 'pending' })
  ]);
  const st = Object.fromEntries(byStatus.map((x) => [x._id, x.n]));
  const peak = [...week].sort((a, b) => b.n - a.n)[0];
  const split = { GCash: 0, Maya: 0, Other: 0 }; let settledTotal = 0;
  settled.forEach((x) => { split[x._id === 'GCash' || x._id === 'Maya' ? x._id : 'Other'] += x.total; settledTotal += x.total; });
  res.json({
    today: { total: (st.pending || 0) + (st.confirmed || 0) + (st.in_treatment || 0) + (st.completed || 0), pending: st.pending || 0, confirmed: st.confirmed || 0, inTreatment: st.in_treatment || 0, completed: st.completed || 0 },
    week: { count: week.reduce((t, x) => t + x.n, 0), peakDay: peak ? peak._id : null, peakCount: peak ? peak.n : 0 },
    pending, settledToday: settledTotal, split
  });
}));

// =====================================================================
//  Database health (shown in the admin sidebar)
// =====================================================================
router.get('/health', wrap(async (req, res) => {
  const Customer = require('../models/Customer');
  const [bookings, services, specialists, customers] = await Promise.all([Booking.countDocuments(), Service.countDocuments(), Specialist.countDocuments(), Customer.countDocuments()]);
  res.json({ connected: mongoose.connection.readyState === 1, database: mongoose.connection.name, host: mongoose.connection.host, counts: { bookings, services, specialists, customers } });
}));

module.exports = router;