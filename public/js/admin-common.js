/* ============================================================
   public/js/admin-common.js
   ============================================================ */
window.TR = window.TR || {};

/* ---------- Helpers ---------- */
TR.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

TR.peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH');

TR.fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
};

TR.fmtTime = (h) => {
  if (!h) return '';
  const [a, m] = h.split(':').map(Number);
  return `${a % 12 || 12}:${String(m).padStart(2, '0')} ${a < 12 ? 'AM' : 'PM'}`;
};

TR.initials = (n) => String(n).split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
TR.phone = (p) => String(p).replace(/^(\+63)(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3 $4');
TR.today = () => new Date(Date.now() + 8 * 36e5).toISOString().slice(0, 10);

TR.toast = (msg, bad) => {
  alert(msg); 
};

/* ---------- UI Components ---------- */
TR.STATUS = {
  pending:      ['Pending',      'bg-amber-50 text-amber-800 border-amber-200'],
  confirmed:    ['Confirmed',    'bg-emerald-50 text-emerald-800 border-emerald-200'],
  in_treatment: ['In Treatment', 'bg-rose-100 text-rose-800 border-rose-200'],
  completed:    ['Completed',    'bg-pink-50 text-pink-800 border-pink-200'],
  cancelled:    ['Cancelled',    'bg-slate-100 text-slate-600 border-slate-200'],
  no_show:      ['No-show',      'bg-slate-100 text-slate-600 border-slate-200']
};

TR.PAY = { unpaid: 'Unpaid', deposit_paid: 'Deposit Paid', paid: 'Paid in Full', refunded: 'Refunded' };

const PILL = 'inline-flex items-center gap-1 px-3 py-1 rounded-full text-label-sm font-label-sm font-semibold border ';
TR.statusPill = (s) => `<span class="${PILL}${TR.STATUS[s]?.[1] || ''}">${TR.STATUS[s]?.[0] || s}</span>`;

TR.INPUT = 'w-full h-11 rounded-xl border border-outline-variant/50 bg-white px-3 text-sm focus:outline-none focus:border-secondary focus:ring-2 focus:ring-tertiary-container/40';
TR.BTN = 'px-5 py-2.5 rounded-full bg-primary-container text-on-primary text-label-lg font-label-lg font-semibold shadow-sm hover:shadow-md transition-all active:scale-95 disabled:opacity-60';
TR.BTN2 = 'px-5 py-2.5 rounded-full border border-secondary text-primary text-label-lg font-label-lg font-semibold hover:bg-surface-container-low transition-all';
TR.card = (inner, cls = '') => `<div class="p-6 bg-surface-container-lowest rounded-lg border border-outline-variant/30 shadow-[0_8px_30px_rgba(158,49,80,0.04)] ${cls}">${inner}</div>`;
TR.kpi = (label, value, sub, icon) => TR.card(`<div class="flex items-center justify-between mb-3"><span class="text-label-md font-label-md text-on-surface-variant tracking-wider font-medium">${label}</span><div class="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-primary"><span class="material-symbols-outlined text-lg">${icon}</span></div></div><div class="text-headline-md font-headline-md font-bold text-primary tracking-tight">${value}</div><div class="mt-2 text-label-sm font-label-sm text-on-surface-variant">${sub}</div>`);
TR.header = (kicker, title, desc, actions = '') => `<header class="flex flex-col lg:flex-row lg:items-end justify-between gap-5 pb-5 border-b border-outline-variant/30 no-print"><div>${kicker ? `<span class="text-label-sm font-label-sm tracking-widest text-secondary font-semibold">${kicker}</span>` : ''}<h1 class="font-headline-lg text-headline-lg text-primary font-semibold">${title}</h1><p class="text-body-md text-on-surface-variant mt-1">${desc}</p></div><div class="flex flex-wrap gap-3">${actions}</div></header>`;

TR.select = (id, icon, options) => `<div class="relative"><span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary text-lg pointer-events-none">${icon}</span><select id="${id}" class="h-11 pl-10 pr-8 rounded-full bg-white border border-outline-variant/50 text-sm appearance-none focus:outline-none focus:border-secondary cursor-pointer">${options}</select></div>`;

TR.modal = (html, wide) => {
  const el = document.createElement('div');
  el.className = 'fixed inset-0 z-[100] bg-on-surface/40 backdrop-blur-sm flex items-center justify-center p-4';
  el.innerHTML = `<div class="bg-white rounded-3xl ${wide ? 'max-w-2xl' : 'max-w-lg'} w-full max-h-[92vh] overflow-y-auto p-6 sm:p-8 shadow-2xl border border-tertiary-fixed-dim/30">${html}</div>`;
  document.body.appendChild(el);
  el.close = () => el.remove();
  el.addEventListener('mousedown', (e) => { if (e.target === el) el.close(); });
  el.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) el.close(); });
  return el;
};

/* ---------- API Client & Cache ---------- */
TR.api = async (path, opts = {}) => {
  try {
    const res = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      ...opts
    });

    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("text/html")) {
      location.href = '/login';
      throw new Error('Session expired. Please log in again.');
    }

    if (res.status === 401 || res.status === 403) {
      location.href = '/login';
      throw new Error('Signed out');
    }
    
    if (!res.ok) {
      const msg = await res.text().catch(() => 'Request failed');
      throw new Error(msg || `Request failed (${res.status})`);
    }
    
    return res.status === 204 ? null : res.json();
  } catch (err) {
    console.error(err);
    throw err;
  }
};

TR.cache = {};
TR.cacheTTL = 30000; // 30 seconds

// ✅ THIS IS THE MISSING FUNCTION CAUSING THE DASHBOARD ERROR
TR.getShared = async (path) => {
  const hit = TR.cache[path];
  if (hit && Date.now() - hit.at < TR.cacheTTL) return hit.value;
  const value = await TR.api(path);
  TR.cache[path] = { value, at: Date.now() };
  return value;
};

TR.invalidate = (prefix) => {
  Object.keys(TR.cache).forEach((k) => {
    if (!prefix || k.startsWith(prefix)) delete TR.cache[k];
  });
};

TR.EP = {
  overview:    '/api/admin/overview',
  bookings:    '/api/admin/bookings',
  specialists: '/api/admin/specialists',
  roster:      '/api/admin/roster',
  services:    '/api/admin/services',
  clients:     '/api/admin/clients',
  settings:    '/api/admin/settings'
};

/* ---------- Sidebar Auto-Highlight ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const path = location.pathname;
  document.querySelectorAll('aside nav a').forEach(a => {
    const href = a.getAttribute('href');
    if (path.startsWith(href) || (path === '/admin' && href === '/admin/bookings')) {
      a.className = "flex items-center gap-3 px-4 py-3 bg-surface-container-high text-primary rounded-full font-semibold transition-all duration-150";
      const icon = a.querySelector('.material-symbols-outlined');
      if(icon) icon.style.fontVariationSettings = "'FILL' 1";
    }
  });
});