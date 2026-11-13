const jwt = require('jsonwebtoken');
const COOKIE = 'tr_admin';
const CUSTOMER_COOKIE = 'tr_customer';

const sign = (admin) => jwt.sign({ id: admin._id, name: admin.name, role: admin.role, kind: 'admin' }, process.env.JWT_SECRET, { expiresIn: '8h' });
const signCustomer = (c) => jwt.sign({ id: c._id, name: c.name, kind: 'customer' }, process.env.JWT_SECRET, { expiresIn: '30d' });

function readKind(req, cookie, kind) {
  try { const p = jwt.verify(req.cookies[cookie], process.env.JWT_SECRET); return p.kind === kind ? p : null; } catch { return null; }
}
const readAdmin = (req) => readKind(req, COOKIE, 'admin');

// Customers can authenticate with the cookie (website) OR an "Authorization: Bearer <token>" header (mobile app).
// Admins are cookie-only on purpose: the mobile app is for customers.
function readBearerCustomer(req) {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '');
  if (!m) return null;
  try { const p = jwt.verify(m[1], process.env.JWT_SECRET); return p.kind === 'customer' ? p : null; } catch { return null; }
}
const readCustomer = (req) => readKind(req, CUSTOMER_COOKIE, 'customer') || readBearerCustomer(req);
const isAppClient = (req) => req.get('x-client') === 'app';

function requireAdmin(req, res, next) {
  const user = readAdmin(req);
  if (!user) return res.status(401).json({ error: 'Not signed in.' });
  req.admin = user; next();
}
function requireAdminPage(req, res, next) { if (!readAdmin(req)) return res.redirect('/login'); next(); }
function requireCustomer(req, res, next) {
  const user = readCustomer(req);
  if (!user) return res.status(401).json({ error: 'Please sign in.' });
  req.customer = user; next();
}
const base = { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' };
const cookieOpts = () => ({ ...base, maxAge: 8 * 3600e3 });
const customerCookieOpts = () => ({ ...base, maxAge: 30 * 864e5 });

module.exports = { COOKIE, CUSTOMER_COOKIE, sign, signCustomer, readAdmin, readCustomer, isAppClient, requireAdmin, requireAdminPage, requireCustomer, cookieOpts, customerCookieOpts };