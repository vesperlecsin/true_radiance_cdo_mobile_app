// Run:  node check-install.js
// Tells you which project files are missing / outdated / in the wrong folder, and which OLD admin files to delete.
const fs = require('fs'), path = require('path');
const checks = [
  ['server.js', /adminShell/, 'newest server.js'],
  ['routes/public.js', /readCustomer/, 'newest routes/public.js'],
  ['routes/auth.js', /require\('express'\)\.Router/, 'routes/auth.js (sign-in routes)'],
  ['routes/admin.js', /\/health/, 'newest routes/admin.js (must start with const router = require...)'],
  ['middleware/auth.js', /readCustomer/, 'newest middleware/auth.js'],
  ['utils/bookingEngine.js', /walkIn/, 'newest utils/bookingEngine.js'],
  ['models/Customer.js', /Customer/, 'models/Customer.js'],
  ['models/Booking.js', /staffNotes/, 'newest models/Booking.js'],
  ['models/Setting.js', /Setting/, 'models/Setting.js'],
  ['config/settings.js', /function apply/, 'config/settings.js'],
  ['views/admin-portal.html', /admin-portal\.js/, 'views/admin-portal.html  (the ONE admin page)'],
  ['public/js/admin-portal.js', /PAGES\.clients/, 'public/js/admin-portal.js  (the ONE admin script)'],
  ['public/js/book.js', /calGrid/, 'public/js/book.js'],
  ['public/js/account.js', /account_circle/, 'public/js/account.js'],
  ['public/book.html', /js\/book\.js/, 'public/book.html'],
  ['public/login.html', /api\/auth\/login/, 'public/login.html'],
  ['public/my-account.html', /my\/bookings/, 'public/my-account.html'],
  ['public/manage.html', /bookings\/lookup/, 'public/manage.html'],
  ['.env', /MONGODB_URI=mongodb/, '.env with your MONGODB_URI']
];
let bad = 0;
for (const [f, rx, what] of checks) {
  const p = path.join(__dirname, f);
  if (!fs.existsSync(p)) { console.log('MISSING   ', f, ' -> add', what); bad++; continue; }
  if (!rx.test(fs.readFileSync(p, 'utf8'))) { console.log('WRONG/OLD ', f, ' -> replace with', what); bad++; continue; }
  console.log('ok        ', f);
}
// old admin files from earlier versions: harmless now, but they cause confusion -> list them
const stale = [];
for (const [dir, keep] of [['views', 'admin-portal.html'], ['public/js', 'admin-portal.js']]) {
  const d = path.join(__dirname, dir);
  if (fs.existsSync(d)) fs.readdirSync(d).filter((f) => f.startsWith('admin') && f !== keep && /\.(html|js)$/.test(f)).forEach((f) => stale.push(dir + '/' + f));
}
if (stale.length) { console.log('\nOLD FILES (not used any more - delete them):'); stale.forEach((f) => console.log('   delete  ', f)); }
try {
  const a = require('./middleware/auth');
  ['readCustomer', 'readAdmin', 'signCustomer', 'requireCustomer'].forEach((k) => { if (typeof a[k] !== 'function') { console.log('BROKEN    middleware/auth.js is missing', k); bad++; } });
  ['./utils/bookingEngine', './routes/public', './routes/auth', './routes/admin'].forEach((m) => require(m));
  console.log('ok        all server modules load');
} catch (e) { console.log('LOAD ERROR:', e.message); bad++; }
console.log(bad ? `\n${bad} problem(s) found - fix the lines above, then run npm start.` : '\nEverything looks installed correctly.' + (stale.length ? ' (Delete the old files listed above for a clean project.)' : ''));
process.exit(0);