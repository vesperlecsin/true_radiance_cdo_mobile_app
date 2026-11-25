require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const SlotLock = require('./models/SlotLock');
const MODELS = ['Service', 'Specialist', 'Booking', 'SlotLock', 'Customer', 'Admin', 'Counter'].map((m) => require('./models/' + m));
const { requireAdminPage } = require('./middleware/auth');

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '20kb' }));

// CORS for the mobile app (Capacitor serves the app from capacitor://localhost, http(s)://localhost).
// The app authenticates with a Bearer token, so cookies/credentials are NOT allowed cross-origin.
// Add more origins with CORS_ORIGINS="https://a.com,https://b.com" in .env.
const APP_ORIGINS = new Set(['capacitor://localhost', 'ionic://localhost', 'http://localhost', 'https://localhost',
  ...(process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean)]);
app.use('/api', (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && APP_ORIGINS.has(origin)) {
    res.set({ 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client', 'Access-Control-Max-Age': '600' });
    if (req.method === 'OPTIONS') return res.sendStatus(204);
  }
  next();
});
app.use(cookieParser());

// API Routes
app.use('/api', require('./routes/public'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));

app.get('/admin-login', (req, res) => res.redirect('/login'));

// Admin: ONE page shell for every admin address. /js/admin-portal.js decides which page to draw.
const adminShell = (req, res) => res.sendFile(path.join(__dirname, 'views', 'admin-portal.html'));
app.get(
  ['/admin', '/admin/dashboard', '/admin/bookings', '/admin/bookings/:id', '/admin/services', '/admin/specialists', '/admin/clients', '/admin/settings'],
  requireAdminPage,
  adminShell
);

// Serve JS files explicitly and public folder for images
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));
// PWA: the service worker must never be cached hard, or phones won't pick up updates.
app.get('/sw.js', (req, res) => {
  res.set({ 'Cache-Control': 'no-cache', 'Service-Worker-Allowed': '/' });
  res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// 404 Handlers
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
app.use((req, res) => res.status(404).send('Page not found'));

const PORT = process.env.PORT || 3000;
connectDB()
  .then(() => require('./config/settings').load())
  .then(async () => {
    for (const M of MODELS) { try { await M.syncIndexes(); } catch (e) { console.warn('Index sync warning for', M.modelName + ':', e.message); } }
  })
  .then(() => app.listen(PORT, () => console.log(`True Radiance running -> http://localhost:${PORT}`)))
  .catch((e) => { console.error('Startup failed:', e.message); process.exit(1); });