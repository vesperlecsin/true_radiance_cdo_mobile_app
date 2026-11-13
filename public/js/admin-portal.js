/* True Radiance admin portal — ONE script for every admin page (shared helpers + 7 page modules + router). */
/* True Radiance admin – shared helpers, sidebar wiring, walk-in booking form */
(function () {
  const TR = (window.TR = {});
  const $ = (s, r = document) => r.querySelector(s);
  TR.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  TR.peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH');
  TR.fmtDate = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  TR.fmtLong = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  TR.fmtTime = (h) => { const [a, m] = h.split(':').map(Number); return `${a % 12 || 12}:${String(m).padStart(2, '0')} ${a < 12 ? 'AM' : 'PM'}`; };
  TR.stamp = (iso) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' }) + ' PHT';
  TR.initials = (n) => String(n).split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  TR.phone = (p) => String(p).replace(/^(\+63)(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3 $4');
  TR.today = () => new Date(Date.now() + 8 * 36e5).toISOString().slice(0, 10);

  TR.api = async (path, opts) => {
    const res = await fetch('/api/admin' + path, opts && { headers: { 'Content-Type': 'application/json' }, ...opts });
    if (res.status === 401) { location.href = '/login'; throw new Error('Signed out'); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  };
  const send = (method) => (path, body) => TR.api(path, { method, body: JSON.stringify(body || {}) });
  TR.post = send('POST'); TR.patch = send('PATCH'); TR.put = send('PUT');

  TR.toast = (msg, bad) => {
    let t = $('#tr-toast');
    if (!t) { t = document.createElement('div'); t.id = 'tr-toast'; document.body.appendChild(t); }
    t.className = `fixed left-1/2 -translate-x-1/2 bottom-6 z-[200] max-w-md px-5 py-3 rounded-full text-white text-sm font-semibold shadow-lg transition-opacity ${bad ? 'bg-error' : 'bg-primary'}`;
    t.textContent = msg; t.style.opacity = 1; clearTimeout(t._h); t._h = setTimeout(() => (t.style.opacity = 0), 4500);
  };

  // ---------- look & feel ----------
  const PILL = 'inline-flex items-center gap-1 px-3 py-1 rounded-full text-label-sm font-label-sm font-semibold border ';
  TR.STATUS = {
    pending: ['Pending', 'bg-amber-50 text-amber-800 border-amber-200'], confirmed: ['Confirmed', 'bg-emerald-50 text-emerald-800 border-emerald-200'],
    in_treatment: ['In Treatment', 'bg-rose-100 text-rose-800 border-rose-200'], completed: ['Completed', 'bg-pink-50 text-pink-800 border-pink-200'],
    cancelled: ['Cancelled', 'bg-slate-100 text-slate-600 border-slate-200'], no_show: ['No-show', 'bg-slate-100 text-slate-600 border-slate-200']
  };
  TR.PAY = { unpaid: 'Unpaid', deposit_paid: 'Deposit Paid', paid: 'Paid in Full', refunded: 'Refunded' };
  TR.statusPill = (s) => `<span class="${PILL}${TR.STATUS[s][1]}">${TR.STATUS[s][0]}</span>`;
  TR.payPill = (b) => {
    const m = { unpaid: ['Awaiting ' + (b.payOption === 'full' ? 'Payment' : 'Deposit') + ` (${TR.peso(b.depositAmount)})`, 'bg-rose-50 text-rose-800 border-rose-200'],
      deposit_paid: [`Deposit Paid (${TR.peso(b.amountPaid)})`, 'bg-amber-50 text-amber-800 border-amber-200'], paid: ['Paid in Full', 'bg-emerald-50 text-emerald-800 border-emerald-200'], refunded: ['Refunded', 'bg-slate-100 text-slate-600 border-slate-200'] }[b.paymentStatus];
    return `<span class="${PILL}${m[1]}">${TR.esc(m[0])}</span>`;
  };
  TR.INPUT = 'w-full h-11 rounded-xl border border-outline-variant/50 bg-white px-3 text-sm text-on-surface focus:outline-none focus:border-secondary focus:ring-2 focus:ring-tertiary-container/40';
  TR.BTN = 'px-6 py-2.5 rounded-full bg-gradient-to-br from-primary-container to-primary text-on-primary text-label-lg font-label-lg font-semibold shadow-[0_6px_18px_rgba(127,24,57,0.25)] hover:shadow-[0_8px_24px_rgba(212,175,55,0.38)] hover:-translate-y-px active:translate-y-0 active:scale-95 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed';
  TR.BTN2 = 'px-5 py-2.5 rounded-full bg-white border border-secondary/40 text-primary text-label-lg font-label-lg font-semibold shadow-sm hover:border-tertiary-container hover:bg-surface-container-low hover:shadow-[0_6px_18px_rgba(212,175,55,0.2)] active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
  // premium pill dropdown: icon on the left, custom chevron on the right (no overlapping native arrow)
  TR.select = (id, icon, options, cls = '') => `<div class="relative ${cls}"><span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-primary text-lg pointer-events-none">${icon}</span>
    <select id="${id}" class="appearance-none bg-none h-11 pl-10 pr-10 min-w-[150px] rounded-full bg-white border border-outline-variant/50 text-sm font-semibold text-on-surface shadow-sm hover:border-secondary hover:shadow-[0_6px_18px_rgba(212,175,55,0.18)] focus:outline-none focus:border-secondary focus:ring-2 focus:ring-tertiary-container/40 cursor-pointer transition-all duration-200">${options}</select>
    <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-lg pointer-events-none">expand_more</span></div>`;
  TR.card = (inner, cls = '') => `<div class="p-6 bg-surface-container-lowest rounded-lg border border-outline-variant/30 shadow-[0_8px_30px_rgba(158,49,80,0.04)] ${cls}">${inner}</div>`;
  TR.header = (kicker, title, desc, actions = '') => `<header class="flex flex-col lg:flex-row lg:items-end justify-between gap-5 pb-5 border-b border-outline-variant/30 no-print">
    <div>${kicker ? `<span class="text-label-sm font-label-sm tracking-widest text-secondary font-semibold">${kicker}</span>` : ''}
    <h1 class="font-headline-lg text-headline-lg text-primary font-semibold">${title}</h1><p class="text-body-md text-on-surface-variant mt-1">${desc}</p></div>
    <div class="flex flex-wrap gap-3">${actions}</div></header>`;
  TR.kpi = (label, value, sub, icon) => TR.card(`<div class="flex items-center justify-between mb-3"><span class="text-label-md font-label-md text-on-surface-variant tracking-wider font-medium">${label}</span>
    <div class="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-primary"><span class="material-symbols-outlined text-lg">${icon}</span></div></div>
    <div class="text-headline-md font-headline-md font-bold text-primary tracking-tight">${value}</div><div class="mt-2 text-label-sm font-label-sm text-on-surface-variant">${sub}</div>`);
  TR.field = (label, inner) => `<label class="block text-xs font-semibold text-on-surface">${label}<div class="mt-1 font-normal">${inner}</div></label>`;

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

  // ---------- walk-in / phone booking ----------
  TR.openWalkIn = async (onDone) => {
    let services, specs;
    try { [services, specs] = await Promise.all([TR.api('/services'), TR.api('/specialists')]); } catch (e) { return TR.toast(e.message, true); }
    services = services.filter((s) => s.isActive); specs = specs.filter((s) => s.isActive);
    const m = TR.modal(`<div class="flex items-start justify-between"><div><p class="text-xs text-outline uppercase tracking-wider">Staff entry</p><h2 class="font-headline-md text-primary font-semibold text-2xl">New Walk-in / Phone Booking</h2></div>
      <button data-close class="w-9 h-9 rounded-full hover:bg-surface-container text-outline"><span class="material-symbols-outlined">close</span></button></div>
      <form id="wi" class="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        ${TR.field('Guest name', `<input id="wi-name" class="${TR.INPUT}" required minlength="2"/>`)}
        ${TR.field('Mobile (+63)', `<input id="wi-phone" class="${TR.INPUT}" placeholder="9XX XXX XXXX" required/>`)}
        ${TR.field('Email (optional)', `<input id="wi-email" type="email" class="${TR.INPUT}"/>`)}
        ${TR.field('Service', `<select id="wi-svc" class="${TR.INPUT}" required><option value="">Choose…</option>${services.map((s) => `<option value="${s._id}">${TR.esc(s.name)} – ${TR.peso(s.price)} (${s.durationMin} min)</option>`).join('')}</select>`)}
        ${TR.field('Specialist', `<select id="wi-spec" class="${TR.INPUT}"><option value="any">Any available</option></select>`)}
        ${TR.field('Date', `<input id="wi-date" type="date" class="${TR.INPUT}" min="${TR.today()}" value="${TR.today()}" required/>`)}
        ${TR.field('Time', `<select id="wi-time" class="${TR.INPUT}" required><option value="">Choose a service first</option></select>`)}
        ${TR.field('Payment method', `<select id="wi-method" class="${TR.INPUT}"><option>Cash at Counter</option><option>GCash</option><option>Maya</option><option>Card / POS</option><option>Pay at the Salon</option></select>`)}
        ${TR.field('Payment received', `<select id="wi-pay" class="${TR.INPUT}"><option value="unpaid">Not yet paid</option><option value="deposit_paid">Deposit paid</option><option value="paid">Paid in full</option></select>`)}
        <div class="sm:col-span-2">${TR.field('Notes / allergies', `<textarea id="wi-notes" rows="2" class="${TR.INPUT} h-auto py-2" maxlength="500"></textarea>`)}</div>
        <div id="wi-err" class="sm:col-span-2 text-xs text-error min-h-[1em]"></div>
        <div class="sm:col-span-2 flex justify-end gap-3"><button type="button" data-close class="${TR.BTN2}">Cancel</button><button class="${TR.BTN}" id="wi-save">Create booking</button></div></form>`, true);
    const g = (id) => m.querySelector('#' + id);
    const fillSpecs = () => {
      const svc = services.find((s) => s._id === g('wi-svc').value);
      g('wi-spec').innerHTML = '<option value="any">Any available</option>' + specs.filter((p) => !svc || p.serviceCategories.includes(svc.category)).map((p) => `<option value="${p._id}">${TR.esc(p.name)}</option>`).join('');
    };
    async function loadSlots() {
      if (!g('wi-svc').value || !g('wi-date').value) return;
      try {
        const { slots } = await TR.api(`/availability?serviceId=${g('wi-svc').value}&specialistId=${g('wi-spec').value}&date=${g('wi-date').value}`);
        g('wi-time').innerHTML = slots.map((s) => `<option value="${s.time}" ${s.available ? '' : 'disabled'}>${s.label}${s.available ? '' : ' (taken)'}</option>`).join('');
        const first = slots.find((s) => s.available); g('wi-time').value = first ? first.time : '';
        if (!first) g('wi-err').textContent = 'No free times for that date and specialist.'; else g('wi-err').textContent = '';
      } catch (e) { g('wi-err').textContent = e.message; }
    }
    g('wi-svc').onchange = () => { fillSpecs(); loadSlots(); }; g('wi-spec').onchange = loadSlots; g('wi-date').onchange = loadSlots;
    g('wi').onsubmit = async (e) => {
      e.preventDefault(); g('wi-err').textContent = ''; g('wi-save').disabled = true;
      try {
        const { booking } = await TR.post('/bookings', { serviceId: g('wi-svc').value, specialistId: g('wi-spec').value, date: g('wi-date').value, time: g('wi-time').value,
          guest: { name: g('wi-name').value, phone: '+63' + g('wi-phone').value, email: g('wi-email').value }, notes: g('wi-notes').value, paymentMethod: g('wi-method').value, payStatus: g('wi-pay').value });
        m.close(); TR.toast(`Booking #${booking.ref} created for ${booking.guest.name}.`); if (onDone) onDone(booking);
      } catch (err) { g('wi-err').textContent = err.message; g('wi-save').disabled = false; }
    };
  };

  // ---------- sidebar: logo, links, active page, walk-in button, logout ----------
  const ROUTES = { dashboard: '/admin/dashboard', bookings: '/admin', 'services menu': '/admin/services', clients: '/admin/clients', specialists: '/admin/specialists', settings: '/admin/settings' };
  const path = location.pathname.replace(/\/$/, '') || '/';
  const activeKey = path.startsWith('/admin/dashboard') ? 'dashboard' : path.startsWith('/admin/services') ? 'services menu' : path.startsWith('/admin/specialists') ? 'specialists' : path.startsWith('/admin/clients') ? 'clients'
    : path.startsWith('/admin/settings') ? 'settings' : 'bookings';
  // Sidebar normalisation (same result on every admin page): your logo instead of the text block, and no fake "POS active" badge.
  // Written to work whatever the exact wrapper markup is, and re-run after the page has fully loaded.
  function fixSidebar() {
    const side = document.querySelector('aside'); if (!side) return;
    if (!side.querySelector('img[src="/images/logo.png"]')) {
      const label = [...side.querySelectorAll('span')].find((x) => x.textContent.trim() === 'True Radiance');
      const block = label && label.closest('div.flex.items-center');
      if (block && side.contains(block) && block.textContent.replace(/\s+/g, ' ').length < 90)
        block.outerHTML = '<a href="/admin/dashboard" class="block pb-4 border-b border-outline-variant/30"><img src="/images/logo.png" alt="True Radiance Beauty Salon &amp; Spa Logo" class="h-16 w-auto object-contain"/></a>';
    }
    // the design's fake "BDO POS & API Active" badge becomes a REAL database indicator
    const badge = [...side.querySelectorAll('span')].find((x) => /BDO POS|API Active/i.test(x.textContent));
    if (badge) {
      badge.textContent = 'Checking database…'; const dot = badge.previousElementSibling;
      const paint = (ok, text) => { badge.textContent = text; if (dot) dot.className = 'w-2.5 h-2.5 rounded-full ' + (ok ? 'bg-emerald-500' : 'bg-error'); };
      fetch('/api/admin/health').then((r) => r.json()).then((h) => paint(!!h.connected, h.connected ? `Database connected · ${h.database}` : 'Database NOT connected'))
        .catch(() => paint(false, 'Database status unavailable'));
    }
  }
  fixSidebar(); window.addEventListener('load', fixSidebar);
  const aside = $('aside');
  if (aside) {
    const brand = aside.querySelector(':scope > div:first-child > div:first-child');
    if (brand && /True Radiance/.test(brand.textContent) && !brand.querySelector('img'))
      brand.outerHTML = '<a href="/admin/dashboard" class="block pb-4 border-b border-outline-variant/30"><img src="/images/logo.png" alt="True Radiance Beauty Salon &amp; Spa Logo" class="h-16 w-auto object-contain"/></a>';
    aside.querySelectorAll('a').forEach((a) => {
      const label = (a.querySelector('span:last-of-type') || a).textContent.replace(/\s+/g, ' ').trim();
      const key = label.toLowerCase();
      if (ROUTES[key]) {
        a.href = ROUTES[key];
        const on = key === activeKey;
        a.classList.toggle('bg-surface-container-high', on); a.classList.toggle('text-primary', on); a.classList.toggle('font-semibold', on);
        a.classList.toggle('text-on-surface-variant', !on); a.classList.toggle('font-medium', !on);
      } else if (key.includes('log out')) a.onclick = async (e) => { e.preventDefault(); await fetch('/api/admin/logout', { method: 'POST' }); location.href = '/login'; };
      else if (key.includes('help')) a.onclick = (e) => { e.preventDefault(); TR.toast('Need help? Contact your website developer.'); };
    });
  }
  document.querySelectorAll('button').forEach((b) => {
    const t = b.textContent.replace(/\s+/g, ' ');
    if (/New Booking|New Walk-in/.test(t)) b.onclick = () => TR.openWalkIn(() => window.TR_refresh && window.TR_refresh());
  });
  // ---------- burger menu (phones & tablets: the sidebar slides in from a top bar; desktop is unchanged) ----------
  (function burger() {
    const side = document.querySelector('aside'), main = document.querySelector('main');
    if (!side || !main || document.getElementById('tr-topbar')) return;
    const css = document.createElement('style');
    css.textContent = `
      #tr-topbar,#tr-scrim{display:none}
      @media (max-width:1023px){
        #tr-topbar{display:flex;position:fixed;top:0;left:0;right:0;height:60px;z-index:45;align-items:center;gap:12px;padding:0 14px;
          background:rgba(255,255,255,.96);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border-bottom:1px solid rgba(160,120,130,.22);padding-top:env(safe-area-inset-top)}
        #tr-burger{width:44px;height:44px;border-radius:9999px;display:flex;align-items:center;justify-content:center;color:#7f1839;background:transparent;border:0;cursor:pointer}
        #tr-burger:active{background:rgba(127,24,57,.08)}
        #tr-topbar img{height:36px;width:auto;object-fit:contain}
        #tr-topbar .tr-title{margin-left:auto;font-weight:600;font-size:14px;color:#7f1839;letter-spacing:.02em;white-space:nowrap}
        aside{width:min(84vw,320px)!important;transform:translateX(-102%);transition:transform .28s ease;z-index:60!important;overflow-y:auto;overscroll-behavior:contain;box-shadow:none}
        body.tr-nav-open aside{transform:translateX(0);box-shadow:0 0 40px rgba(0,0,0,.28)}
        #tr-scrim{display:block;position:fixed;inset:0;z-index:55;background:rgba(40,12,22,.45);opacity:0;pointer-events:none;transition:opacity .28s ease}
        body.tr-nav-open #tr-scrim{opacity:1;pointer-events:auto}
        body.tr-nav-open{overflow:hidden}
        main{margin-left:0!important;padding-top:calc(60px + 1.25rem)!important;padding-left:1rem!important;padding-right:1rem!important;max-width:100vw}
      }
      @media print{#tr-topbar,#tr-scrim{display:none!important}}`;
    document.head.appendChild(css);
    const bar = document.createElement('header'); bar.id = 'tr-topbar'; bar.className = 'no-print';
    bar.innerHTML = '<button id="tr-burger" type="button" aria-label="Open menu" aria-controls="tr-aside" aria-expanded="false"><span class="material-symbols-outlined" style="font-size:28px">menu</span></button>'
      + '<img src="/images/logo.png" alt="True Radiance"/><span class="tr-title">' + ({ dashboard: 'Dashboard', 'services menu': 'Services Menu', specialists: 'Specialists', clients: 'Clients', settings: 'Settings', bookings: 'Bookings' }[activeKey] || '') + '</span>';
    const scrim = document.createElement('div'); scrim.id = 'tr-scrim'; scrim.className = 'no-print';
    document.body.prepend(scrim); document.body.prepend(bar);
    side.id = side.id || 'tr-aside';
    const burgerBtn = document.getElementById('tr-burger');
    const set = (open) => { document.body.classList.toggle('tr-nav-open', open); burgerBtn.setAttribute('aria-expanded', open); burgerBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu'); burgerBtn.firstChild.textContent = open ? 'close' : 'menu'; };
    burgerBtn.onclick = () => set(!document.body.classList.contains('tr-nav-open'));
    scrim.onclick = () => set(false);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
    side.addEventListener('click', (e) => { const a = e.target.closest('a,button'); if (a) set(false); });   // close after choosing a page / New Booking
    window.matchMedia('(min-width:1024px)').addEventListener('change', (m) => { if (m.matches) set(false); });
  })();
  const st = document.createElement('style'); st.textContent = '@media print{aside,.no-print{display:none!important}main{margin-left:0!important;padding:0!important}} select{padding-right:2.5rem!important;text-overflow:ellipsis} button:focus-visible,a:focus-visible,select:focus-visible{outline:2px solid rgba(212,175,55,.7);outline-offset:2px}'; document.head.appendChild(st);
})();

const PAGES = {};

/* ===== page: bookings ===== */
PAGES.bookings = async function () {
  const { api, esc, peso, BTN, BTN2, INPUT } = TR;
  const SELECT = TR.select || ((id, icon, options) => `<div class="relative"><span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-primary text-lg pointer-events-none">${icon}</span><select id="${id}" class="appearance-none bg-none h-11 pl-10 pr-10 min-w-[150px] rounded-full bg-white border border-outline-variant/50 text-sm font-semibold shadow-sm cursor-pointer">${options}</select><span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-lg pointer-events-none">expand_more</span></div>`);
  const PRIMARY = BTN + ' inline-flex items-center gap-2 !py-2';
  const GHOST = BTN2 + ' inline-flex items-center gap-1.5 !py-2 !px-4';
  const MINI = 'px-4 py-1.5 rounded-full text-white text-label-sm font-semibold shadow-[0_4px_12px_rgba(127,24,57,0.25)] hover:shadow-[0_6px_16px_rgba(212,175,55,0.38)] hover:-translate-y-px active:translate-y-0 active:scale-95 transition-all duration-200 bg-gradient-to-br ';
  const app = document.getElementById('app');
  const F = { date: 'upcoming', status: '', payment: '', specialist: '', q: '', page: 1 };
  const qs = () => new URLSearchParams(Object.entries(F).filter(([, v]) => v !== '' && v != null)).toString();
  let specs = []; try { specs = await api('/specialists'); } catch {}
  let warned = false;
  let items = [], sel = null, meta = { total: 0, page: 1, pages: 1 }, ov = null, roster = [];
  const opt = (pairs, cur) => pairs.map(([v, t]) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(t)}</option>`).join('');
  const clock = () => new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' });
  const NEXT = { pending: ['confirmed', 'Confirm', 'Booking confirmed.'], confirmed: ['in_treatment', 'Check In', 'Guest checked in.'], in_treatment: ['completed', 'Complete', 'Marked as completed.'] };
  const fail = (e) => e.message !== 'Signed out' && TR.toast(e.message, true);

  app.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-outline-variant/30 no-print">
      <div><span class="text-label-sm font-label-sm tracking-widest text-secondary font-semibold">RESERVATIONS</span>
        <div class="flex flex-wrap items-center gap-3"><h1 class="font-headline-lg text-headline-lg text-primary font-semibold">Bookings</h1>
        <span class="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-label-sm bg-surface-container text-primary border border-outline-variant/30 font-semibold"><span class="material-symbols-outlined text-xs">schedule</span>PHT (GMT+8) • <span id="clock">${clock()}</span></span></div></div>
      <div class="flex flex-wrap items-center gap-3">
        <button id="bell" class="${GHOST} relative !px-3" title="Bookings awaiting confirmation"><span class="material-symbols-outlined text-xl">notifications</span><span id="belldot" class="hidden absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-white"></span></button>
        <button id="pr" class="${GHOST}"><span class="material-symbols-outlined text-lg">print</span>Print Schedule</button>
        <button id="csv" class="${GHOST}"><span class="material-symbols-outlined text-lg">download</span>Export CSV</button>
        <button id="wi" class="${PRIMARY}"><span class="material-symbols-outlined text-lg">person_add</span>Walk-in</button></div></div>
    <section id="kpis" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5"></section>
    <section class="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/20 shadow-[0_8px_30px_rgba(158,49,80,0.05)] flex flex-wrap items-center gap-3 no-print">
      <div class="relative flex-1 min-w-[260px]"><span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary text-xl pointer-events-none">search</span>
        <input id="q" placeholder="Search guest, mobile or booking ID" class="w-full h-11 pl-12 pr-4 rounded-full bg-white border border-outline-variant/50 shadow-sm text-sm placeholder:text-outline focus:outline-none focus:border-secondary focus:ring-2 focus:ring-tertiary-container/40 transition-all"/></div>
      ${SELECT('date', 'calendar_month', opt([['upcoming', 'All upcoming'], ['today', 'Today'], ['recent', 'Newly booked (48h)'], ['week', 'Next 7 days'], ['month', 'This month'], ['all', 'All dates']], F.date))}
      ${SELECT('status', 'task_alt', opt([['', 'All statuses'], ...Object.entries(TR.STATUS).map(([v, [t]]) => [v, t])], ''))}
      ${SELECT('payment', 'payments', opt([['', 'All payments'], ['unpaid', 'Unpaid'], ['deposit_paid', 'Deposit paid'], ['paid', 'Paid in full'], ['refunded', 'Refunded']], ''))}
      ${SELECT('specialist', 'person', opt([['', 'All specialists'], ...specs.map((s) => [s.name, s.name])], ''))}
      <button id="reset" class="${GHOST} !h-11" title="Clear all filters"><span class="material-symbols-outlined text-lg">filter_alt_off</span>Clear</button></section>
    <section class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"><div id="reg" class="lg:col-span-8 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-sm overflow-hidden"></div><div id="side" class="lg:col-span-4 flex flex-col gap-5 no-print"></div></section>`;
  const $ = (id) => document.getElementById(id);

  // ---------- KPI cards ----------
  const kcard = (label, big, badge, icon, foot, cls = '', lc = 'text-outline') => `<div class="bg-surface-container-lowest p-5 rounded-2xl border ${cls || 'border-outline-variant/20'} shadow-sm flex flex-col justify-between">
    <div class="flex items-start justify-between"><div><span class="text-label-sm uppercase tracking-wider ${lc}">${label}</span><div class="flex items-baseline gap-2 mt-1"><span class="font-headline-md text-headline-md text-primary font-bold">${big}</span>${badge}</div></div>
    <div class="w-10 h-10 rounded-2xl bg-surface-container flex items-center justify-center text-primary"><span class="material-symbols-outlined">${icon}</span></div></div>
    <div class="mt-4 pt-3 border-t border-outline-variant/20 text-label-sm text-on-surface-variant flex flex-wrap items-center justify-between gap-1">${foot}</div></div>`;
  const dot = (c, t) => `<span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full ${c}"></span>${t}</span>`;
  function drawKpis() {
    if (!ov) return;
    const t = ov.today, sp = ov.split, pct = (v) => (ov.settledToday ? Math.round((v / ov.settledToday) * 100) : 0);
    const peak = ov.week.peakDay ? new Date(ov.week.peakDay + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }) : '—';
    $('kpis').innerHTML = kcard("TODAY'S APPOINTMENTS", t.total, '', 'event_available', dot('bg-emerald-500', `${t.confirmed} Confirmed`) + dot('bg-secondary', `${t.inTreatment} In treatment`) + dot('bg-outline', `${t.completed} Done`))
      + kcard('NEXT 7 DAYS', ov.week.count, '<span class="text-label-sm text-outline">Reservations</span>', 'date_range', `<span>Busiest day: <b class="text-primary">${peak}${ov.week.peakCount ? ` (${ov.week.peakCount})` : ''}</b></span>`)
      + kcard('AWAITING CONFIRMATION', ov.pending, ov.pending ? '<span class="text-label-sm bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-medium">Needs action</span>' : '', 'account_balance_wallet',
        `<span>Pending deposits / approval</span>${ov.pending ? '<button id="review" class="text-primary font-semibold underline">Review</button>' : ''}`, 'border-2 border-amber-200/80', 'text-amber-800 font-semibold')
      + kcard('PAYMENTS RECEIVED TODAY', peso(ov.settledToday), '', 'payments', `<span class="text-xs font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">GCash ${pct(sp.GCash)}%</span><span class="text-xs font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">Maya ${pct(sp.Maya)}%</span><span class="text-xs font-medium text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded">Cash/other ${pct(sp.Other)}%</span>`);
    $('belldot').classList.toggle('hidden', !ov.pending); $('bell').title = `${ov.pending} booking(s) awaiting confirmation`;
    const r = $('review'); if (r) r.onclick = showPending;
  }
  function showPending() { F.status = 'pending'; F.date = 'all'; F.page = 1; $('status').value = 'pending'; $('date').value = 'all'; load().catch(fail); }

  // ---------- registry table ----------
  const chip = (t, c) => `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${c}">${t}</span>`;
  const isNew = (b) => Date.now() - new Date(b.createdAt).getTime() < 24 * 3600e3;
  const tags = (b) => (isNew(b) ? chip('NEW', 'bg-primary text-white') : '') + (b.customer ? chip('ACCOUNT', 'bg-tertiary-fixed text-on-tertiary-fixed') : b.source === 'walk-in' ? chip('WALK-IN', 'bg-slate-100 text-slate-600') : '');
  const settle = (b) => {
    const m = { unpaid: [`Awaiting ${peso(b.depositAmount)} ${esc(b.paymentMethod)}`, 'text-amber-900 bg-amber-100 border-amber-300'], deposit_paid: [`${peso(b.amountPaid)} ${esc(b.paymentMethod)} paid`, 'text-emerald-800 bg-emerald-50 border-emerald-200'],
      paid: [`Paid in full (${esc(b.paymentMethod)})`, 'text-emerald-800 bg-emerald-50 border-emerald-200'], refunded: ['Refunded', 'text-stone-600 bg-stone-100 border-stone-200'] }[b.paymentStatus];
    return `<span class="text-xs px-2 py-0.5 rounded-full border mt-1 font-medium w-fit ${m[1]}">${m[0]}</span>`;
  };
  function drawTable() {
    const from = meta.total ? (meta.page - 1) * 10 + 1 : 0, today = TR.today();
    $('reg').innerHTML = `<div class="px-6 py-4 bg-surface-container-low border-b border-outline-variant/30 flex items-center gap-3"><span class="material-symbols-outlined text-primary">calendar_month</span>
      <div><h3 class="font-title-lg text-title-lg text-on-surface">Booking Registry</h3><p class="text-label-sm text-outline">Limketkai Center Branch • ${meta.total} booking${meta.total === 1 ? '' : 's'} match your filters</p></div></div>
      <div class="overflow-x-auto"><table class="w-full text-left border-collapse"><thead><tr class="bg-surface-bright border-b border-outline-variant/30 text-label-sm text-outline uppercase tracking-wider">
        <th class="py-3.5 px-4 pl-6">ID &amp; Client</th><th class="px-4">Treatment</th><th class="px-4">Specialist &amp; Time</th><th class="px-4">Settlement</th><th class="px-4">Status</th><th class="px-4 pr-6 text-right">Actions</th></tr></thead>
      <tbody class="divide-y divide-surface-container text-sm">${items.map((b) => {
        const nx = NEXT[b.status], on = sel && sel._id === b._id;
        return `<tr data-id="${b._id}" class="cursor-pointer transition-colors hover:bg-surface-container-low ${on ? 'bg-surface-container-low/70 border-l-4 border-primary' : b.status === 'pending' ? 'bg-amber-50/20' : ''} ${['cancelled', 'no_show'].includes(b.status) ? 'opacity-60' : ''}">
        <td class="py-4 px-4 pl-6 align-top"><div class="flex items-center gap-2"><span class="text-label-sm font-mono font-bold text-primary">#${esc(b.ref)}</span>${tags(b)}</div>
          <p class="font-title-md text-on-surface font-semibold mt-0.5">${esc(b.guest.name)}</p><p class="text-label-sm text-on-surface-variant font-mono mt-0.5">${esc(TR.phone(b.guest.phone))}</p></td>
        <td class="py-4 px-4 align-top"><p class="font-semibold text-primary">${esc(b.serviceName)}</p><p class="text-label-sm text-outline mt-0.5 flex items-center gap-1"><span class="material-symbols-outlined text-xs">hourglass_empty</span>${b.durationMin} mins</p></td>
        <td class="py-4 px-4 align-top"><div class="flex items-center gap-1.5 font-medium"><span class="w-6 h-6 rounded-full bg-secondary text-white text-[10px] flex items-center justify-center font-bold">${TR.initials(b.specialistName)}</span>${esc(b.specialistName)}</div>
          <p class="mt-2 text-label-md font-semibold text-primary flex items-center gap-1"><span class="material-symbols-outlined text-sm">schedule</span>${TR.fmtTime(b.startTime)} – ${TR.fmtTime(b.endTime)}</p><p class="text-label-sm text-outline">${b.date === today ? 'Today' : TR.fmtDate(b.date)}</p></td>
        <td class="py-4 px-4 align-top"><div class="flex flex-col"><span class="font-bold text-primary text-base">${peso(b.totalAmount)}</span>${settle(b)}</div></td>
        <td class="py-4 px-4 align-top">${TR.statusPill(b.status)}</td>
        <td class="py-4 px-4 pr-6 align-top text-right whitespace-nowrap">${nx ? `<button data-act="${b._id}" class="${MINI}${b.status === 'pending' ? 'from-amber-500 to-amber-700' : 'from-primary-container to-primary'}">${nx[1]}</button>` : `<a href="/admin/bookings/${b._id}" class="px-3 py-1.5 rounded-full bg-white border border-outline-variant/30 text-outline hover:text-primary text-label-sm font-medium">Details</a>`}</td></tr>`;
      }).join('') || '<tr><td colspan="6" class="py-14 text-center text-on-surface-variant">No bookings match these filters.</td></tr>'}</tbody></table></div>
      <div class="px-6 py-3.5 bg-surface-bright border-t border-outline-variant/30 flex items-center justify-between text-label-sm text-outline"><span>Showing ${from}–${from + items.length - (meta.total ? 1 : 0)} of ${meta.total}</span>
        <div class="flex items-center gap-3"><button id="prev" class="px-3 py-1 rounded-md bg-white border border-outline-variant/30 disabled:opacity-50" ${meta.page <= 1 ? 'disabled' : ''}>Previous</button><span>Page <b class="text-primary">${meta.page}</b> of ${meta.pages}</span><button id="next" class="px-3 py-1 rounded-md bg-white border border-outline-variant/30 disabled:opacity-50" ${meta.page >= meta.pages ? 'disabled' : ''}>Next</button></div></div>`;
    $('prev').onclick = () => { F.page--; load().catch(fail); }; $('next').onclick = () => { F.page++; load().catch(fail); };
  }

  // ---------- right pane: inspector + specialists today ----------
  function drawSide() {
    let h = '';
    if (!sel) h += `<div class="bg-surface-container-lowest rounded-2xl border border-dashed border-outline-variant p-8 text-center text-sm text-on-surface-variant"><span class="material-symbols-outlined text-3xl text-outline">touch_app</span><p class="mt-2">Select a booking to see the guest, payment and actions.</p></div>`;
    else {
      const b = sel, nx = NEXT[b.status], bal = Math.max(b.totalAmount - b.amountPaid, 0), live = ['pending', 'confirmed'].includes(b.status);
      h += `<div class="bg-surface-container-lowest rounded-2xl border-2 border-primary/20 shadow-md p-6 flex flex-col gap-4 relative overflow-hidden">
        <div class="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full pointer-events-none"></div>
        <div class="flex items-start justify-between"><div><span class="text-xs font-mono font-bold text-white bg-primary px-2 py-0.5 rounded-full">INSPECTING #${esc(b.ref)}</span>
          <h3 class="font-headline-sm text-headline-sm text-primary mt-2">${esc(b.guest.name)}</h3><p class="text-label-sm text-outline">${b.source === 'walk-in' ? 'Walk-in / phone' : b.customer ? 'Website · customer account' : 'Website · guest'} • booked ${TR.fmtDate(b.createdAt.slice(0, 10))}</p></div>
          <button id="closeSel" class="p-1 rounded-full hover:bg-surface-container text-outline" title="Close"><span class="material-symbols-outlined text-lg">close</span></button></div>
        <div class="flex flex-wrap gap-2 text-xs"><a class="${BTN2} !py-1 !px-3" href="tel:${esc(b.guest.phone)}">Call</a><a class="${BTN2} !py-1 !px-3" href="viber://chat?number=${encodeURIComponent(b.guest.phone)}">Viber</a>${b.guest.email ? `<a class="${BTN2} !py-1 !px-3" href="mailto:${esc(b.guest.email)}">Email</a>` : ''}</div>
        ${b.notes ? `<div class="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-label-sm"><p class="font-semibold text-amber-900 flex items-center gap-1 mb-1"><span class="material-symbols-outlined text-sm">clinical_notes</span>Guest notes / allergies</p><p class="text-on-surface-variant italic">“${esc(b.notes)}”</p></div>` : ''}
        <div class="grid grid-cols-2 gap-3 text-label-sm"><div class="p-3 bg-surface-bright rounded-xl border border-outline-variant/20"><span class="text-outline block">Treatment</span><span class="font-semibold text-primary mt-0.5 block">${esc(b.serviceName)}</span><span class="text-xs text-outline">${b.durationMin} mins</span></div>
          <div class="p-3 bg-surface-bright rounded-xl border border-outline-variant/20"><span class="text-outline block">Specialist</span><span class="font-semibold text-on-surface mt-0.5 block">${esc(b.specialistName)}</span><span class="text-xs text-outline">${TR.fmtDate(b.date)} · ${TR.fmtTime(b.startTime)}</span></div></div>
        <div class="pt-3 border-t border-outline-variant/30 flex flex-col gap-2 text-label-sm">
          <div class="flex justify-between"><span class="text-outline">Service price</span><span>${peso(b.totalAmount)}</span></div>
          <div class="flex justify-between"><span class="text-emerald-700 font-medium">${esc(b.paymentMethod)} received</span><span class="text-emerald-700 font-medium">−${peso(b.amountPaid)}</span></div>
          <div class="flex justify-between pt-2 border-t border-outline-variant/20 text-title-md font-title-md text-primary"><span>Balance at check-out</span><b>${peso(bal)}</b></div></div>
        <div class="flex gap-2"><select id="pay" class="${INPUT} !rounded-full !h-10 text-xs">${Object.entries(TR.PAY).map(([k, v]) => `<option value="${k}" ${k === b.paymentStatus ? 'selected' : ''}>${v}</option>`).join('')}</select><button id="paybtn" class="${BTN2} !py-2 text-xs whitespace-nowrap">Update payment</button></div>
        <div class="flex flex-col gap-2.5">${nx ? `<button id="primary" class="${PRIMARY} w-full justify-center !py-3">${nx[1]}</button>` : ''}
          <div class="grid grid-cols-2 gap-2"><a href="/admin/bookings/${b._id}" class="${BTN2} !py-2.5 !px-3 text-center flex items-center justify-center gap-1.5"><span class="material-symbols-outlined text-sm">open_in_new</span>Full details</a>
          ${live ? `<button id="cancelBtn" class="py-2.5 px-3 rounded-full bg-white border border-rose-300 text-error font-label-lg font-semibold shadow-sm hover:bg-rose-50 hover:border-error active:scale-95 transition-all duration-200 flex items-center justify-center gap-1.5"><span class="material-symbols-outlined text-sm">cancel</span>Cancel booking</button>` : `<span class="py-2.5 rounded-full bg-surface-container text-center text-outline text-label-md">${TR.STATUS[b.status][0]}</span>`}</div></div></div>`;
    }
    h += `<div class="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-5 shadow-sm"><div class="flex items-center justify-between mb-3"><div class="flex items-center gap-2 text-primary font-title-md font-semibold"><span class="material-symbols-outlined text-lg">group</span>Specialists today</div><a href="/admin/specialists" class="text-xs text-primary font-semibold hover:underline">Roster →</a></div>
      <div class="space-y-2.5">${roster.filter((s) => s.isActive).map((s) => `<div class="flex items-center justify-between p-2.5 rounded-xl bg-surface-bright border border-outline-variant/20"><div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full ${s.today ? 'bg-primary' : 'bg-emerald-500'}"></span><span class="text-label-md font-semibold">${esc(s.name)}</span></div>
        <span class="text-label-sm ${s.today ? 'text-primary bg-rose-50 border-secondary-container' : 'text-emerald-800 bg-emerald-50 border-emerald-200'} px-2 py-0.5 rounded-full border">${s.today ? s.today + ' booked today' : 'Free today'}</span></div>`).join('') || '<p class="text-sm text-on-surface-variant">No specialists yet.</p>'}</div></div>`;
    $('side').innerHTML = h;
    const g = (id) => $(id);
    if (g('closeSel')) g('closeSel').onclick = () => { sel = null; drawTable(); drawSide(); };
    if (g('primary')) g('primary').onclick = () => patch(sel, { status: NEXT[sel.status][0] }, NEXT[sel.status][2]);
    if (g('paybtn')) g('paybtn').onclick = () => patch(sel, { paymentStatus: g('pay').value }, 'Payment status updated.');
    if (g('cancelBtn')) g('cancelBtn').onclick = () => openCancel(sel);
  }

  // ---------- actions ----------
  async function patch(b, body, msg) {
    try { const r = await TR.patch('/bookings/' + b._id, body); sel = r.booking; TR.toast(msg); await load(); } catch (e) { TR.toast(e.message, true); }
  }
  function openCancel(b) {
    const m = TR.modal(`<div class="flex items-center justify-between"><div class="w-10 h-10 rounded-full bg-rose-100 text-error flex items-center justify-center"><span class="material-symbols-outlined">warning</span></div>
      <button data-close class="p-1 rounded-full hover:bg-surface-container text-outline"><span class="material-symbols-outlined text-lg">close</span></button></div>
      <h4 class="font-title-lg text-on-surface font-semibold mt-3">Cancel this booking?</h4>
      <p class="text-sm text-on-surface-variant mt-1">You are about to cancel <b class="text-primary">#${esc(b.ref)}</b> for <b class="text-on-surface">${esc(b.guest.name)}</b>. The time slot is released immediately.</p>
      <div class="mt-4 p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/30 flex flex-col gap-2"><label class="text-label-sm text-outline">Cancellation reason</label>
        <select id="rs" class="${INPUT}"><option>Client requested (Viber / phone call)</option><option>Client emergency / unwell</option><option>Branch schedule conflict</option><option>Deposit not received</option><option>Other</option></select>
        <input id="rn" class="${INPUT}" placeholder="Optional note" maxlength="150"/></div>
      ${b.amountPaid > 0 ? `<p class="mt-3 text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3"><b>${peso(b.amountPaid)} was already paid.</b> Refunds aren't automatic — send the money back via ${esc(b.paymentMethod)}, then set payment to “Refunded”.</p>` : ''}
      <div class="mt-5 flex justify-end gap-3"><button data-close class="${BTN2}">Keep booking</button><button id="go" class="px-6 py-2.5 rounded-full bg-gradient-to-br from-rose-600 to-error text-white text-label-lg font-semibold shadow-[0_6px_18px_rgba(186,26,26,0.3)] hover:shadow-[0_8px_24px_rgba(186,26,26,0.4)] active:scale-95 transition-all">Confirm cancellation</button></div>`);
    m.querySelector('#go').onclick = async () => {
      const reason = m.querySelector('#rs').value + (m.querySelector('#rn').value.trim() ? ': ' + m.querySelector('#rn').value.trim() : '');
      m.close(); await patch(b, { status: 'cancelled', cancelReason: reason }, 'Booking cancelled and slot released.');
    };
  }

  // ---------- data ----------
  async function load() {
    const [d, o, r] = await Promise.all([api('/bookings?limit=10&' + qs()), api('/overview').catch(() => null), api('/roster').catch(() => [])]);
    if (!o && !warned) { warned = true; TR.toast('Summary cards need the latest routes/admin.js — restart the server after replacing it.', true); }
    items = d.items; meta = d; roster = r;
    ov = o || { today: { total: '—', pending: 0, confirmed: 0, inTreatment: 0, completed: 0 }, week: { count: '—', peakDay: null, peakCount: 0 }, pending: 0, settledToday: 0, split: { GCash: 0, Maya: 0, Other: 0 } };
    if (sel) { const f = items.find((x) => x._id === sel._id); if (f) sel = f; }
    drawKpis(); drawTable(); drawSide();
  }

  $('reg').addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]');
    if (a) { e.stopPropagation(); const b = items.find((x) => x._id === a.dataset.act); return patch(b, { status: NEXT[b.status][0] }, NEXT[b.status][2]); }
    if (e.target.closest('a,button,select')) return;
    const tr = e.target.closest('tr[data-id]'); if (tr) { sel = items.find((x) => x._id === tr.dataset.id); drawTable(); drawSide(); }
  });
  ['date', 'status', 'payment', 'specialist'].forEach((k) => ($(k).onchange = (e) => { F[k] = e.target.value; F.page = 1; load().catch(fail); }));
  let t; $('q').oninput = (e) => { clearTimeout(t); t = setTimeout(() => { F.q = e.target.value.trim(); F.page = 1; load().catch(fail); }, 300); };
  $('reset').onclick = () => { Object.assign(F, { date: 'upcoming', status: '', payment: '', specialist: '', q: '', page: 1 }); $('date').value = 'upcoming'; ['status', 'payment', 'specialist', 'q'].forEach((k) => ($(k).value = '')); load().catch(fail); };
  $('csv').onclick = () => { location.href = '/api/admin/bookings/export.csv?' + qs(); };
  $('pr').onclick = () => window.print();
  $('bell').onclick = showPending;
  $('wi').onclick = () => TR.openWalkIn(() => load().catch(fail));
  window.TR_refresh = () => load().catch(fail);
  setInterval(() => { $('clock').textContent = clock(); }, 30000);
  setInterval(() => load().catch(() => {}), 60000);          // new online bookings appear without reloading
  load().catch(fail);
};

/* ===== page: dashboard ===== */
PAGES.dashboard = async function () {
  const { api, esc, peso, card, kpi, header, BTN, BTN2, INPUT, fmtDate } = TR;
  const app = document.getElementById('app');
  const monthNow = TR.today().slice(0, 7);
  let month = monthNow;

  async function draw() {
    const d = await api('/analytics?month=' + month);
    const label = new Date(month + '-01T00:00:00Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const max = Math.max(1, ...d.daily.map((x) => x.GCash + x.Maya + x.Other));
    const bars = d.daily.map((x) => {
      const h = (v) => Math.round((v / max) * 180);
      return `<div class="flex-1 min-w-[14px] flex flex-col items-center gap-1" title="${fmtDate(x.date)}: ${peso(x.GCash + x.Maya + x.Other)}">
        <div class="w-full flex flex-col justify-end h-[180px]"><div class="bg-surface-container-highest rounded-t" style="height:${h(x.Other)}px"></div><div class="bg-secondary-container" style="height:${h(x.Maya)}px"></div><div class="bg-primary rounded-b" style="height:${h(x.GCash)}px"></div></div>
        <span class="text-[10px] text-on-surface-variant">${+x.date.slice(8)}</span></div>`;
    }).join('');
    const pk = d.peak, pmax = Math.max(1, ...pk.map((x) => x.count)), ptotal = pk.reduce((s, x) => s + x.count, 0) || 1;
    const pct = (v) => (d.gross ? Math.round((v / d.gross) * 100) : 0);
    app.innerHTML = header('FISCAL LEDGER', 'Revenue &amp; Analytics', 'Bookings revenue for the Limketkai branch. Figures come from live bookings (cancelled and no-show excluded).',
      `<input id="mon" type="month" value="${month}" max="${monthNow}" class="${INPUT} !w-auto"/><a href="/api/admin/bookings/export.csv?date=all" class="${BTN}">Export bookings (CSV)</a>`) + `
      <section class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        ${kpi('BOOKED REVENUE', peso(d.gross), d.change === null ? 'No previous-month data' : `<span class="${d.change >= 0 ? 'text-emerald-700 bg-emerald-50' : 'text-error bg-error-container'} px-2 py-0.5 rounded-full font-semibold">${d.change >= 0 ? '▲' : '▼'} ${Math.abs(d.change)}%</span> vs previous month`, 'payments')}
        ${kpi('PAYMENTS COLLECTED', peso(d.collected), `GCash ${pct(d.split.GCash)}% · Maya ${pct(d.split.Maya)}% · Other ${pct(d.split.Other)}%`, 'account_balance_wallet')}
        ${kpi('BOOKINGS', d.count, `${d.completed} completed`, 'event_available')}
        ${kpi('AVERAGE PER BOOKING', peso(d.avg), 'Booked revenue ÷ bookings', 'sell')}
      </section>
      <section class="grid grid-cols-1 xl:grid-cols-3 gap-5">
        ${card(`<h2 class="font-headline-sm text-headline-sm text-primary font-semibold">Daily revenue — ${label}</h2>
          <div class="flex gap-4 text-xs text-on-surface-variant mt-2"><span><i class="inline-block w-3 h-3 rounded bg-primary align-middle"></i> GCash ${peso(d.split.GCash)}</span><span><i class="inline-block w-3 h-3 rounded bg-secondary-container align-middle"></i> Maya ${peso(d.split.Maya)}</span><span><i class="inline-block w-3 h-3 rounded bg-surface-container-highest align-middle"></i> Cash/other ${peso(d.split.Other)}</span></div>
          <div class="mt-5 flex items-end gap-1 overflow-x-auto">${bars || '<p class="text-sm text-on-surface-variant py-16 mx-auto">No bookings in this month yet.</p>'}</div>`, 'xl:col-span-2')}
        ${card(`<h2 class="font-headline-sm text-headline-sm text-primary font-semibold">Peak booking hours</h2><p class="text-xs text-on-surface-variant mt-1">Share of appointments by start time</p>
          <div class="mt-5 space-y-4">${pk.map((x) => `<div><div class="flex justify-between text-xs mb-1"><span>${x.label}</span><b class="text-primary">${Math.round((x.count / ptotal) * 100)}%</b></div><div class="h-2.5 rounded-full bg-surface-container"><div class="h-2.5 rounded-full bg-primary-container" style="width:${(x.count / pmax) * 100}%"></div></div></div>`).join('')}</div>`)}
      </section>
      <section class="grid grid-cols-1 xl:grid-cols-3 gap-5">
        ${card(`<h2 class="font-headline-sm text-headline-sm text-primary font-semibold">Top services</h2><p class="text-xs text-on-surface-variant">By revenue</p>
          <ol class="mt-4 space-y-3">${d.top.length ? d.top.map((x, i) => `<li class="flex items-center gap-3 p-3 rounded-2xl bg-surface-container-low/60"><span class="w-7 h-7 rounded-full bg-primary-container text-on-primary flex items-center justify-center text-xs font-bold">${i + 1}</span>
            <div class="flex-1 min-w-0"><p class="font-title-md text-sm truncate">${esc(x.name)}</p><p class="text-xs text-on-surface-variant">${x.count} booking${x.count > 1 ? 's' : ''}</p></div><b class="text-primary text-sm">${peso(x.revenue)}</b></li>`).join('') : '<p class="text-sm text-on-surface-variant">Nothing yet.</p>'}</ol>`)}
        ${card(`<h2 class="font-headline-sm text-headline-sm text-primary font-semibold">Latest bookings &amp; payments</h2>
          <div class="mt-4 overflow-x-auto"><table class="w-full text-left text-sm"><thead><tr class="text-label-md text-on-surface-variant border-b border-outline-variant/30"><th class="py-2 pr-3">Ref</th><th class="pr-3">Guest</th><th class="pr-3">Service</th><th class="pr-3">Method</th><th class="pr-3 text-right">Amount</th><th>Payment</th></tr></thead>
          <tbody class="divide-y divide-outline-variant/20">${d.recent.length ? d.recent.map((b) => `<tr class="hover:bg-surface-container-low/40"><td class="py-3 pr-3 font-mono text-primary"><a href="/admin/bookings/${b._id}">#${esc(b.ref)}</a></td><td class="pr-3">${esc(b.guest.name)}</td><td class="pr-3 max-w-[200px] truncate">${esc(b.serviceName)}</td><td class="pr-3">${esc(b.paymentMethod)}</td><td class="pr-3 text-right font-semibold">${peso(b.totalAmount)}</td><td>${TR.payPill(b)}</td></tr>`).join('') : '<tr><td colspan="6" class="py-8 text-center text-on-surface-variant">No bookings this month.</td></tr>'}</tbody></table></div>`, 'xl:col-span-2')}
      </section>`;
    document.getElementById('mon').onchange = (e) => { month = e.target.value || monthNow; draw().catch(fail); };
  }
  const fail = (e) => e.message !== 'Signed out' && (app.innerHTML = `<p class="text-error">${esc(e.message)}</p>`);
  window.TR_refresh = () => draw().catch(fail);
  draw().catch(fail);
};

/* ===== page: services ===== */
PAGES.services = async function () {
  const { api, esc, peso, card, header, BTN, BTN2, INPUT, field } = TR;
  const app = document.getElementById('app');
  const CATS = ['Hair Artistry', 'Facial & Skin', 'Nails & Care', 'Therapeutic Massage', 'Spa Packages'];
  let services = [], specs = [], cat = 'All', q = '';

  async function load() { [services, specs] = await Promise.all([api('/services'), api('/specialists')]); draw(); }
  const who = (s) => specs.filter((p) => p.isActive && p.serviceCategories.includes(s.category));

  function draw() {
    const rows = services.filter((s) => (cat === 'All' || s.category === cat) && (!q || (s.name + s.description).toLowerCase().includes(q)));
    const count = (c) => services.filter((s) => c === 'All' || s.category === c).length;
    app.innerHTML = header('MENU MANAGEMENT', 'Services &amp; Treatment Catalog', 'Prices (₱), durations and visibility. Changes appear on the booking page immediately.',
      `<button id="add" class="${BTN}">+ Add service</button>`) + card(`
      <div class="flex flex-wrap gap-2 mb-4">${['All', ...CATS].map((c) => `<button data-cat="${c}" class="px-4 py-2 rounded-full text-xs font-semibold border ${c === cat ? 'bg-primary-container text-on-primary border-primary-container' : 'bg-white border-outline-variant/50 text-on-surface hover:border-secondary'}">${c} (${count(c)})</button>`).join('')}</div>
      <input id="q" placeholder="Search services…" value="${esc(q)}" class="${INPUT} max-w-sm mb-4"/>
      <div class="overflow-x-auto"><table class="w-full text-left text-sm"><thead><tr class="text-label-md text-on-surface-variant border-b border-outline-variant/30"><th class="py-3 pr-4">Service</th><th class="pr-4">Category</th><th class="pr-4">Duration</th><th class="pr-4 text-right">Price</th><th class="pr-4">Specialists</th><th class="pr-4 text-center">Active</th><th></th></tr></thead>
      <tbody class="divide-y divide-outline-variant/20">${rows.map((s) => `<tr class="hover:bg-surface-container-low/40 ${s.isActive ? '' : 'opacity-50'}">
        <td class="py-4 pr-4 max-w-xs"><p class="font-title-md text-primary">${esc(s.name)} ${s.popular ? '<span class="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-tertiary-fixed text-on-tertiary-fixed">MOST LOVED</span>' : ''}</p><p class="text-xs text-on-surface-variant line-clamp-2">${esc(s.description)}</p></td>
        <td class="pr-4 whitespace-nowrap">${esc(s.category)}</td><td class="pr-4 whitespace-nowrap">${s.durationMin} min</td><td class="pr-4 text-right font-bold text-primary whitespace-nowrap">${peso(s.price)}</td>
        <td class="pr-4"><div class="flex -space-x-2">${who(s).map((p) => `<span title="${esc(p.name)}" class="w-8 h-8 rounded-full bg-primary-container text-on-primary border-2 border-white flex items-center justify-center text-[10px] font-bold">${TR.initials(p.name)}</span>`).join('') || '<span class="text-xs text-error">none</span>'}</div></td>
        <td class="pr-4 text-center"><button data-toggle="${s._id}" class="relative w-11 h-6 rounded-full transition-colors ${s.isActive ? 'bg-primary-container' : 'bg-outline-variant'}" title="${s.isActive ? 'Visible on booking page' : 'Hidden'}"><span class="absolute top-0.5 ${s.isActive ? 'left-[22px]' : 'left-0.5'} w-5 h-5 rounded-full bg-white transition-all"></span></button></td>
        <td class="text-right"><button data-edit="${s._id}" class="px-3 py-1 rounded-full text-primary text-xs font-semibold hover:bg-surface-container">Edit</button></td></tr>`).join('') || '<tr><td colspan="7" class="py-10 text-center text-on-surface-variant">No services found.</td></tr>'}</tbody></table></div>
      <p class="mt-4 text-xs text-on-surface-variant">${services.filter((s) => s.isActive).length} of ${services.length} services are visible to guests.</p>`);
    app.querySelector('#add').onclick = () => form();
    app.querySelector('#q').oninput = (e) => { q = e.target.value.toLowerCase(); const p = e.target.selectionStart; draw(); const i = app.querySelector('#q'); i.focus(); i.setSelectionRange(p, p); };
    app.querySelectorAll('[data-cat]').forEach((b) => (b.onclick = () => { cat = b.dataset.cat; draw(); }));
    app.querySelectorAll('[data-toggle]').forEach((b) => (b.onclick = async () => {
      const s = services.find((x) => x._id === b.dataset.toggle);
      try { await TR.patch('/services/' + s._id, { isActive: !s.isActive }); TR.toast(s.isActive ? 'Hidden from booking page.' : 'Now visible to guests.'); load(); } catch (e) { TR.toast(e.message, true); }
    }));
    app.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => form(services.find((x) => x._id === b.dataset.edit))));
  }

  function form(s) {
    const m = TR.modal(`<h2 class="font-headline-md text-primary font-semibold text-2xl">${s ? 'Edit service' : 'Add service'}</h2>
      <form id="f" class="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="sm:col-span-2">${field('Service name', `<input id="n" class="${INPUT}" required value="${esc(s?.name || '')}"/>`)}</div>
        ${field('Category', `<select id="c" class="${INPUT}">${CATS.map((c) => `<option ${s?.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select>`)}
        ${field('Duration (minutes, steps of 15)', `<input id="d" type="number" min="15" max="480" step="15" class="${INPUT}" required value="${s?.durationMin || 60}"/>`)}
        ${field('Price (₱)', `<input id="p" type="number" min="0" step="1" class="${INPUT}" required value="${s?.price ?? ''}"/>`)}
        <label class="flex items-center gap-2 text-sm mt-6"><input id="pop" type="checkbox" ${s?.popular ? 'checked' : ''}/> Mark as “Most loved / requested”</label>
        <div class="sm:col-span-2">${field('Description', `<textarea id="ds" rows="3" maxlength="300" class="${INPUT} h-auto py-2">${esc(s?.description || '')}</textarea>`)}</div>
        <div id="err" class="sm:col-span-2 text-xs text-error min-h-[1em]"></div>
        <div class="sm:col-span-2 flex justify-end gap-3"><button type="button" data-close class="${BTN2}">Cancel</button><button class="${BTN}">Save</button></div></form>`);
    m.querySelector('#f').onsubmit = async (e) => {
      e.preventDefault();
      const body = { name: m.querySelector('#n').value, category: m.querySelector('#c').value, durationMin: +m.querySelector('#d').value, price: +m.querySelector('#p').value, popular: m.querySelector('#pop').checked, description: m.querySelector('#ds').value };
      try { await (s ? TR.patch('/services/' + s._id, body) : TR.post('/services', body)); m.close(); TR.toast('Service saved.'); load(); } catch (err) { m.querySelector('#err').textContent = err.message; }
    };
  }
  window.TR_refresh = load;
  load().catch((e) => e.message !== 'Signed out' && (app.innerHTML = `<p class="text-error">${esc(e.message)}</p>`));
};

/* ===== page: specialists ===== */
PAGES.specialists = async function () {
  const { api, esc, card, kpi, header, BTN, BTN2, INPUT, field } = TR;
  const app = document.getElementById('app');
  const CATS = ['Hair Artistry', 'Facial & Skin', 'Nails & Care', 'Therapeutic Massage', 'Spa Packages'];
  let roster = [], todays = [];

  async function load() {
    [roster, { items: todays }] = await Promise.all([api('/roster'), api('/bookings?date=today&limit=50')]);
    const active = roster.filter((s) => s.isActive);
    const bookedToday = roster.reduce((t, s) => t + s.today, 0), upcoming = roster.reduce((t, s) => t + s.upcoming, 0);
    app.innerHTML = header('TEAM', 'Specialist Roster', 'Your aestheticians and what they can be booked for. “Any available” bookings are assigned from this list.', `<button id="add" class="${BTN}">+ Add specialist</button>`) + `
      <section class="grid grid-cols-1 sm:grid-cols-3 gap-5">${kpi('TOTAL SPECIALISTS', roster.length, `${active.length} bookable`, 'badge')}${kpi('BOOKINGS TODAY', bookedToday, 'Across all specialists', 'today')}${kpi('UPCOMING BOOKINGS', upcoming, 'Pending + confirmed', 'event_upcoming')}</section>
      <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">${roster.map((s) => card(`
        <div class="flex items-start gap-4"><div class="w-14 h-14 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-lg shrink-0">${TR.initials(s.name)}</div>
          <div class="flex-1 min-w-0"><h3 class="font-headline-sm text-headline-sm text-primary font-semibold leading-tight">${esc(s.name)}</h3><p class="text-xs text-secondary font-medium">${esc(s.role)}</p>
          <p class="text-xs text-on-surface-variant mt-1">★ ${s.rating.toFixed(2)} · ${s.yearsExperience}+ yrs</p></div>
          <button data-toggle="${s._id}" class="relative w-11 h-6 rounded-full shrink-0 ${s.isActive ? 'bg-primary-container' : 'bg-outline-variant'}" title="${s.isActive ? 'Bookable' : 'Not bookable'}"><span class="absolute top-0.5 ${s.isActive ? 'left-[22px]' : 'left-0.5'} w-5 h-5 rounded-full bg-white transition-all"></span></button></div>
        <div class="mt-4 flex flex-wrap gap-1.5">${s.serviceCategories.map((c) => `<span class="px-3 py-1 rounded-full bg-surface-container text-[11px] text-on-surface-variant">${esc(c)}</span>`).join('')}</div>
        <div class="mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-between text-xs"><span><b class="text-primary">${s.today}</b> today · <b class="text-primary">${s.upcoming}</b> upcoming</span><button data-edit="${s._id}" class="px-3 py-1 rounded-full text-primary font-semibold hover:bg-surface-container">Edit</button></div>`, s.isActive ? '' : 'opacity-60')).join('')}</section>
      ${card(`<h2 class="font-headline-sm text-headline-sm text-primary font-semibold">Today’s schedule</h2><div class="mt-4 overflow-x-auto"><table class="w-full text-left text-sm"><thead><tr class="text-label-md text-on-surface-variant border-b border-outline-variant/30"><th class="py-2 pr-3">Time</th><th class="pr-3">Specialist</th><th class="pr-3">Guest</th><th class="pr-3">Service</th><th>Status</th></tr></thead>
        <tbody class="divide-y divide-outline-variant/20">${todays.filter((b) => !['cancelled', 'no_show'].includes(b.status)).map((b) => `<tr class="hover:bg-surface-container-low/40"><td class="py-3 pr-3 whitespace-nowrap font-semibold text-primary">${TR.fmtTime(b.startTime)} – ${TR.fmtTime(b.endTime)}</td><td class="pr-3">${esc(b.specialistName)}</td><td class="pr-3"><a class="underline" href="/admin/bookings/${b._id}">${esc(b.guest.name)}</a></td><td class="pr-3">${esc(b.serviceName)}</td><td>${TR.statusPill(b.status)}</td></tr>`).join('') || '<tr><td colspan="5" class="py-8 text-center text-on-surface-variant">No appointments today.</td></tr>'}</tbody></table></div>
        <p class="mt-3 text-xs text-on-surface-variant">Shift hours and room assignments aren’t tracked yet — availability follows the branch opening hours in Settings.</p>`)}`;
    app.querySelector('#add').onclick = () => form();
    app.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => form(roster.find((x) => x._id === b.dataset.edit))));
    app.querySelectorAll('[data-toggle]').forEach((b) => (b.onclick = async () => {
      const s = roster.find((x) => x._id === b.dataset.toggle);
      try { await TR.patch('/specialists/' + s._id, { isActive: !s.isActive }); load(); } catch (e) { TR.toast(e.message, true); }
    }));
  }

  function form(s) {
    const m = TR.modal(`<h2 class="font-headline-md text-primary font-semibold text-2xl">${s ? 'Edit specialist' : 'Add specialist'}</h2>
      <form id="f" class="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        ${field('Full name', `<input id="n" class="${INPUT}" required value="${esc(s?.name || '')}"/>`)}${field('Role / title', `<input id="r" class="${INPUT}" required value="${esc(s?.role || '')}" placeholder="e.g. Senior Esthetician"/>`)}
        ${field('Years of experience', `<input id="y" type="number" min="0" max="60" class="${INPUT}" value="${s?.yearsExperience ?? 0}"/>`)}
        <div class="sm:col-span-2"><p class="text-xs font-semibold mb-2">Can be booked for</p><div class="flex flex-wrap gap-3">${CATS.map((c) => `<label class="flex items-center gap-2 text-sm"><input type="checkbox" value="${c}" ${s?.serviceCategories.includes(c) ? 'checked' : ''}/> ${c}</label>`).join('')}</div></div>
        <div id="err" class="sm:col-span-2 text-xs text-error min-h-[1em]"></div>
        <div class="sm:col-span-2 flex justify-end gap-3"><button type="button" data-close class="${BTN2}">Cancel</button><button class="${BTN}">Save</button></div></form>`);
    m.querySelector('#f').onsubmit = async (e) => {
      e.preventDefault();
      const body = { name: m.querySelector('#n').value, role: m.querySelector('#r').value, yearsExperience: +m.querySelector('#y').value, serviceCategories: [...m.querySelectorAll('input[type=checkbox]:checked')].map((c) => c.value) };
      try { await (s ? TR.patch('/specialists/' + s._id, body) : TR.post('/specialists', body)); m.close(); TR.toast('Specialist saved.'); load(); } catch (err) { m.querySelector('#err').textContent = err.message; }
    };
  }
  window.TR_refresh = load;
  load().catch((e) => e.message !== 'Signed out' && (app.innerHTML = `<p class="text-error">${esc(e.message)}</p>`));
};

/* ===== page: clients ===== */
PAGES.clients = async function () {
  const { api, esc, peso, card, kpi, header, BTN2, INPUT } = TR;
  const app = document.getElementById('app');
  const S = { q: '', sort: 'recent', page: 1 };

  app.innerHTML = header('CLIENT RECORDS', 'Clients', 'Everyone who has booked, grouped by mobile number. Lifetime spend counts completed visits; booked value includes upcoming bookings.',
    `<input id="q" placeholder="Search name, mobile or email…" class="${INPUT} !w-64"/><select id="sort" class="${INPUT} !w-auto"><option value="recent">Most recent visit</option><option value="spend">Highest spend</option><option value="visits">Most visits</option><option value="name">Name A–Z</option></select>`)
    + '<section id="kpis" class="grid grid-cols-1 sm:grid-cols-3 gap-5"></section><div id="list"></div>';

  async function load() {
    const d = await api('/clients?' + new URLSearchParams(S));
    document.getElementById('kpis').innerHTML = kpi('CLIENTS', d.stats.total, 'Unique mobile numbers', 'groups') + kpi('RETURNING CLIENTS', d.stats.returning, '2 or more bookings', 'repeat') + kpi('WITH AN ACCOUNT', d.stats.accounts, 'Registered on the website', 'how_to_reg');
    document.getElementById('list').innerHTML = card(`<div class="overflow-x-auto"><table class="w-full text-left text-sm"><thead><tr class="text-label-md text-on-surface-variant border-b border-outline-variant/30">
      <th class="py-3 pr-4">Client</th><th class="pr-4">Mobile</th><th class="pr-4 text-center">Bookings</th><th class="pr-4 text-center">Completed</th><th class="pr-4 text-right" title="Total price of completed visits">Lifetime spend</th><th class="pr-4 text-right" title="Total price of all non-cancelled bookings, including upcoming">Booked value</th><th class="pr-4">Last visit</th><th class="pr-4">Next appointment</th><th></th></tr></thead>
      <tbody class="divide-y divide-outline-variant/20">${d.items.map((c) => `<tr class="hover:bg-surface-container-low/40">
        <td class="py-4 pr-4"><div class="flex items-center gap-3"><span class="w-9 h-9 rounded-full bg-surface-container-high text-primary flex items-center justify-center text-xs font-bold shrink-0">${TR.initials(c.name)}</span>
          <div><p class="font-title-md text-on-surface">${esc(c.name)} ${c.hasAccount ? '<span class="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">ACCOUNT</span>' : ''}</p><p class="text-xs text-on-surface-variant">${esc(c.email || 'no email')}</p></div></div></td>
        <td class="pr-4 whitespace-nowrap font-mono">${esc(TR.phone(c._id))}</td><td class="pr-4 text-center">${c.bookings}</td><td class="pr-4 text-center">${c.completed}</td>
        <td class="pr-4 text-right font-bold text-primary whitespace-nowrap">${peso(c.spend)}</td><td class="pr-4 text-right whitespace-nowrap">${peso(c.booked)}</td><td class="pr-4 whitespace-nowrap">${c.last ? TR.fmtDate(c.last) : '—'}</td>
        <td class="pr-4 whitespace-nowrap">${c.next ? `<b class="text-primary">${TR.fmtDate(c.next)}</b>` : '—'}</td><td class="text-right"><button data-v="${esc(c._id)}" class="px-3 py-1 rounded-full text-primary text-xs font-semibold hover:bg-surface-container">View</button></td></tr>`).join('')
        || '<tr><td colspan="9" class="py-12 text-center text-on-surface-variant">No clients found.</td></tr>'}</tbody></table></div>
      <div class="mt-4 flex items-center justify-between text-xs text-on-surface-variant"><span>Page ${d.page} of ${d.pages}</span><div class="flex gap-2">
        <button id="prev" class="${BTN2} !py-1.5 text-xs" ${d.page <= 1 ? 'disabled' : ''}>Previous</button><button id="next" class="${BTN2} !py-1.5 text-xs" ${d.page >= d.pages ? 'disabled' : ''}>Next</button></div></div>`);
    document.getElementById('prev').onclick = () => { S.page--; load(); };
    document.getElementById('next').onclick = () => { S.page++; load(); };
    document.querySelectorAll('[data-v]').forEach((b) => (b.onclick = () => view(b.dataset.v)));
  }

  async function view(phone) {
    let c; try { c = await api('/clients/' + encodeURIComponent(phone)); } catch (e) { return TR.toast(e.message, true); }
    const m = TR.modal(`<div class="flex items-start justify-between gap-4"><div><p class="text-xs text-outline uppercase tracking-wider">Client</p><h2 class="font-headline-md text-primary font-semibold text-2xl">${esc(c.name)}</h2>
        <p class="text-xs text-on-surface-variant mt-1">${c.visits} completed visit${c.visits === 1 ? '' : 's'} · lifetime spend ${peso(c.spend)} · ${c.hasAccount ? 'has a website account' : 'guest (no account)'}</p></div>
      <button data-close class="w-9 h-9 rounded-full hover:bg-surface-container text-outline"><span class="material-symbols-outlined">close</span></button></div>
      <div class="mt-4 flex flex-wrap gap-2 text-sm"><a class="${BTN2} !py-1.5 text-xs" href="tel:${esc(c.phone)}">Call ${esc(TR.phone(c.phone))}</a><a class="${BTN2} !py-1.5 text-xs" href="viber://chat?number=${encodeURIComponent(c.phone)}">Viber</a>${c.email ? `<a class="${BTN2} !py-1.5 text-xs" href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ''}</div>
      <h3 class="mt-6 mb-2 font-title-md text-primary">Booking history</h3>
      <ul class="space-y-2">${c.bookings.map((b) => `<li class="p-3 rounded-xl bg-surface-container-low/70 flex items-center justify-between gap-3 text-sm"><div class="min-w-0"><a class="font-semibold text-primary underline" href="/admin/bookings/${b._id}">${esc(b.serviceName)}</a>
        <p class="text-xs text-on-surface-variant">${TR.fmtDate(b.date)} · ${TR.fmtTime(b.startTime)} · ${esc(b.specialistName)} · #${esc(b.ref)}</p>${b.notes ? `<p class="text-xs text-amber-800 mt-1">Note: ${esc(b.notes)}</p>` : ''}</div>
        <div class="text-right shrink-0"><b>${peso(b.totalAmount)}</b><div class="mt-1">${TR.statusPill(b.status)}</div></div></li>`).join('')}</ul>`, true);
  }

  let t; document.getElementById('q').oninput = (e) => { clearTimeout(t); t = setTimeout(() => { S.q = e.target.value.trim(); S.page = 1; load().catch(fail); }, 300); };
  document.getElementById('sort').onchange = (e) => { S.sort = e.target.value; S.page = 1; load().catch(fail); };
  const fail = (e) => e.message !== 'Signed out' && TR.toast(e.message, true);
  window.TR_refresh = () => load().catch(fail);
  load().catch(fail);
};

/* ===== page: settings ===== */
PAGES.settings = async function () {
  const { api, card, header, BTN, BTN2, INPUT, field } = TR;
  const app = document.getElementById('app');
  let s;
  const hours = (sel) => Array.from({ length: 25 }, (_, h) => `<option value="${h}" ${h === sel ? 'selected' : ''}>${h === 0 || h === 24 ? '12:00 AM' : TR.fmtTime(h + ':00')}</option>`).join('');

  async function draw() {
    s = await api('/settings');
    const row = (title, desc, inner) => `<div class="p-5 rounded-2xl bg-surface-container-low/60 border border-outline-variant/20"><p class="font-title-md text-primary">${title}</p><p class="text-xs text-on-surface-variant mt-1 mb-3">${desc}</p>${inner}</div>`;
    app.innerHTML = header('CONFIGURATION', 'Booking Settings &amp; Policies', 'These rules apply to the website booking page right away — no restart needed.', `<button id="save" class="${BTN}">Save changes</button>`) + `
      ${card(`<h2 class="font-headline-sm text-headline-sm text-primary font-semibold">Opening hours &amp; notice <span class="text-xs font-normal text-on-surface-variant">(Philippine Time)</span></h2>
        <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          ${row('Operating hours', 'Guests can book start times inside this window, in 30-minute steps. A treatment must finish by closing time.', `<div class="grid grid-cols-2 gap-3">${field('Opens', `<select id="open" class="${INPUT}">${hours(s.openHour)}</select>`)}${field('Closes', `<select id="close" class="${INPUT}">${hours(s.closeHour)}</select>`)}</div>`)}
          ${row('Booking lead time', 'How far ahead guests can book. Walk-ins entered by staff skip the minimum notice.', `<div class="grid grid-cols-2 gap-3">${field('Minimum notice (hours)', `<input id="lead" type="number" min="0" max="72" class="${INPUT}" value="${s.minLeadHours}"/>`)}${field('Maximum days ahead', `<input id="adv" type="number" min="1" max="365" class="${INPUT}" value="${s.maxAdvanceDays}"/>`)}</div>`)}
          ${row('Deposit', 'Share of the price shown as “due now” when a guest chooses to pay a deposit.', field('Deposit (%)', `<input id="dep" type="number" min="0" max="100" class="${INPUT}" value="${Math.round(s.depositRate * 100)}"/>`))}
          ${row('Cancellation window', 'Guests can cancel online until this many hours before the appointment. Staff can cancel any time.', field('Hours before appointment', `<input id="can" type="number" min="0" max="168" class="${INPUT}" value="${s.cancelHours}"/>`))}
        </div><div id="err" class="mt-3 text-xs text-error min-h-[1em]"></div>`)}
      ${card(`<h2 class="font-headline-sm text-headline-sm text-primary font-semibold">Not connected yet</h2>
        <ul class="mt-3 text-sm text-on-surface-variant space-y-2 list-disc pl-5"><li><b>Online payments</b> (GCash / Maya / cards via PayMongo) — payments are currently marked manually by staff.</li><li><b>Automatic SMS / Viber reminders</b> and email confirmations.</li><li><b>Staff roles &amp; two-factor sign-in</b> — all staff accounts currently have full access.</li></ul>`)}`;
    document.getElementById('save').onclick = async () => {
      const v = (id) => document.getElementById(id).value;
      try {
        await TR.put('/settings', { openHour: +v('open'), closeHour: +v('close'), minLeadHours: +v('lead'), maxAdvanceDays: +v('adv'), depositRate: +v('dep') / 100, cancelHours: +v('can') });
        TR.toast('Settings saved. The booking page now uses them.'); draw();
      } catch (e) { document.getElementById('err').textContent = e.message; TR.toast(e.message, true); }
    };
  }
  draw().catch((e) => e.message !== 'Signed out' && (app.innerHTML = `<p class="text-error">${TR.esc(e.message)}</p>`));
};

/* ===== page: booking ===== */
PAGES.booking = async function () {
  const { api, esc, peso, card, header, BTN, BTN2, INPUT } = TR;
  const app = document.getElementById('app');
  const id = location.pathname.split('/').pop();
  let data;

  async function load() { data = await api('/bookings/' + id); draw(); }
  const act = async (body, msg, extra) => { try { await TR.patch('/bookings/' + id, body); TR.toast(msg); if (extra) alert(extra); load(); } catch (e) { TR.toast(e.message, true); } };

  function draw() {
    const { booking: b, history, visits, lifetimeSpend } = data;
    const bal = Math.max(b.totalAmount - b.amountPaid, 0), dead = ['cancelled', 'no_show', 'completed'].includes(b.status);
    const btn = (key, label, cls) => `<button data-a="${key}" class="${cls}">${label}</button>`;
    const actions = [
      b.status === 'pending' && btn('confirm', 'Confirm booking', BTN),
      ['pending', 'confirmed'].includes(b.status) && btn('checkin', 'Check in guest', BTN),
      ['confirmed', 'in_treatment'].includes(b.status) && btn('done', 'Mark completed', BTN2),
      ['pending', 'confirmed'].includes(b.status) && btn('noshow', 'No-show', BTN2),
      ['pending', 'confirmed'].includes(b.status) && btn('cancel', 'Cancel booking', 'px-5 py-2.5 rounded-full border border-error text-error text-label-lg font-semibold hover:bg-error-container'),
      btn('print', 'Print receipt', BTN2)
    ].filter(Boolean).join('');
    const line = (k, v) => `<div><p class="text-[11px] uppercase tracking-wider text-outline">${k}</p><p class="font-semibold text-on-surface mt-0.5 break-words">${v}</p></div>`;
    app.innerHTML = `<p class="text-xs text-on-surface-variant no-print"><a href="/admin" class="underline">Bookings</a> › #${esc(b.ref)}</p>` +
      header('', `Booking #${esc(b.ref)}`, `${TR.statusPill(b.status)} ${TR.payPill(b)} <span class="ml-2 text-xs">${b.source === 'walk-in' ? 'Walk-in / phone' : b.customer ? 'Website · customer account' : 'Website · guest'} · booked ${TR.stamp(b.createdAt)}</span>`, `<div class="flex flex-wrap gap-3">${actions}</div>`) + `
      ${b.status === 'cancelled' ? `<div class="p-4 rounded-2xl bg-slate-100 text-sm text-slate-700">Cancelled ${b.cancelledAt ? TR.stamp(b.cancelledAt) : ''} by ${b.cancelledBy === 'guest' ? 'the customer' : 'staff'}${b.cancelReason ? ` — “${esc(b.cancelReason)}”` : ''}.${b.amountPaid > 0 ? ` <b>${peso(b.amountPaid)} was paid — refund the guest manually, then set payment to “Refunded”.</b>` : ''}</div>` : ''}
      <div class="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div class="xl:col-span-2 flex flex-col gap-5">
          ${card(`<div class="flex items-start justify-between gap-4"><div><h2 class="font-headline-sm text-primary font-semibold">${esc(b.guest.name)}</h2><p class="text-xs text-on-surface-variant mt-1">${visits} completed visit${visits === 1 ? '' : 's'} · lifetime spend ${peso(lifetimeSpend)}</p></div>
              <div class="flex gap-2 no-print"><a class="${BTN2} !py-1.5 text-xs" href="tel:${esc(b.guest.phone)}">Call</a><a class="${BTN2} !py-1.5 text-xs" href="viber://chat?number=${encodeURIComponent(b.guest.phone)}">Viber</a></div></div>
            <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">${line('Mobile', esc(TR.phone(b.guest.phone)))}${line('Email', b.guest.email ? `<a class="text-primary underline" href="mailto:${esc(b.guest.email)}">${esc(b.guest.email)}</a>` : '—')}</div>
            ${b.notes ? `<div class="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm"><p class="text-[11px] uppercase tracking-wider text-amber-800 mb-1">Guest notes / allergies</p>${esc(b.notes)}</div>` : ''}`)}
          ${card(`<h2 class="font-headline-sm text-primary font-semibold">Appointment</h2><div class="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">${line('Date', TR.fmtLong(b.date))}${line('Time (PHT)', `${TR.fmtTime(b.startTime)} – ${TR.fmtTime(b.endTime)}`)}${line('Specialist', esc(b.specialistName))}</div>
            <table class="w-full text-sm mt-5"><thead><tr class="text-label-md text-on-surface-variant border-b border-outline-variant/30"><th class="py-2 text-left">Treatment</th><th class="text-left">Duration</th><th class="text-right">Price</th></tr></thead>
            <tbody><tr><td class="py-3 font-title-md">${esc(b.serviceName)}</td><td>${b.durationMin} mins</td><td class="text-right font-semibold">${peso(b.totalAmount)}</td></tr></tbody>
            <tfoot><tr class="border-t border-outline-variant/30"><td colspan="2" class="py-3 font-title-md">Total appointment value</td><td class="text-right font-bold text-primary text-lg">${peso(b.totalAmount)}</td></tr></tfoot></table>`)}
          ${card(`<h2 class="font-headline-sm text-primary font-semibold">Staff notes <span class="text-xs font-normal text-on-surface-variant">(internal only)</span></h2>
            <ul class="mt-3 space-y-2">${(b.staffNotes || []).map((n) => `<li class="p-3 rounded-xl bg-surface-container-low/70 text-sm"><p class="text-[11px] text-on-surface-variant">${esc(n.by)} · ${TR.stamp(n.at)}</p>${esc(n.text)}</li>`).join('') || '<li class="text-sm text-on-surface-variant">No notes yet.</li>'}</ul>
            <div class="mt-3 no-print"><textarea id="note" rows="2" maxlength="500" class="${INPUT} h-auto py-2" placeholder="Add a confidential treatment or guest preference note…"></textarea><div class="mt-2 text-right"><button id="addnote" class="${BTN}">Save internal note</button></div></div>`)}
        </div>
        <div class="flex flex-col gap-5">
          ${card(`<h2 class="font-headline-sm text-primary font-semibold">Payment</h2><div class="mt-4 space-y-2 text-sm">
            <div class="flex justify-between"><span class="text-on-surface-variant">Method</span><b>${esc(b.paymentMethod)}</b></div>
            <div class="flex justify-between"><span class="text-on-surface-variant">Total</span><b>${peso(b.totalAmount)}</b></div>
            <div class="flex justify-between"><span class="text-on-surface-variant">${b.payOption === 'full' ? 'Full payment' : 'Deposit'} due</span><b>${peso(b.depositAmount)}</b></div>
            <div class="flex justify-between"><span class="text-on-surface-variant">Paid so far</span><b class="text-emerald-700">${peso(b.amountPaid)}</b></div>
            <div class="flex justify-between border-t border-outline-variant/30 pt-2"><span class="text-on-surface-variant">Balance at counter</span><b class="text-primary">${peso(bal)}</b></div></div>
            <div class="mt-4 no-print"><select id="pay" class="${INPUT}">${Object.entries(TR.PAY).map(([k, v]) => `<option value="${k}" ${k === b.paymentStatus ? 'selected' : ''}>${v}</option>`).join('')}</select><button id="paybtn" class="${BTN2} w-full mt-2">Update payment status</button>
            <p class="text-[11px] text-on-surface-variant mt-2">Setting a pending booking to Deposit Paid or Paid confirms it automatically.</p></div>`)}
          ${card(`<h2 class="font-headline-sm text-primary font-semibold">Other visits</h2><ul class="mt-3 space-y-3">${history.map((h) => `<li class="text-sm"><a class="font-semibold text-primary underline" href="/admin/bookings/${h._id}">${esc(h.serviceName)}</a><p class="text-xs text-on-surface-variant">${TR.fmtDate(h.date)} · ${esc(h.specialistName)} · ${peso(h.totalAmount)} · ${TR.STATUS[h.status][0]}</p></li>`).join('') || '<li class="text-sm text-on-surface-variant">First visit with this mobile number.</li>'}</ul>`)}
        </div></div>`;

    app.querySelectorAll('[data-a]').forEach((el) => (el.onclick = () => ({
      confirm: () => act({ status: 'confirmed' }, 'Booking confirmed.'),
      checkin: () => act({ status: 'in_treatment' }, 'Guest checked in.'),
      done: () => act({ status: 'completed' }, 'Marked as completed.'),
      noshow: () => confirm('Mark as no-show? The time slot will be released.') && act({ status: 'no_show' }, 'Marked as no-show.'),
      print: () => window.print(),
      cancel: () => {
        const reason = prompt(`Cancel booking #${b.ref} for ${b.guest.name}?\n\nOptional reason (saved in the record):`, '');
        if (reason === null) return;
        act({ status: 'cancelled', cancelReason: reason }, 'Booking cancelled and slot released.', b.amountPaid > 0 ? `${peso(b.amountPaid)} was already paid. Please refund the guest manually.` : '');
      }
    }[el.dataset.a])()));
    const pb = app.querySelector('#paybtn'); if (pb) pb.onclick = () => act({ paymentStatus: app.querySelector('#pay').value }, 'Payment status updated.');
    const nb = app.querySelector('#addnote'); if (nb) nb.onclick = async () => {
      try { await TR.post(`/bookings/${id}/notes`, { text: app.querySelector('#note').value }); TR.toast('Note saved.'); load(); } catch (e) { TR.toast(e.message, true); }
    };
  }
  load().catch((e) => e.message !== 'Signed out' && (app.innerHTML = `<p class="text-error">${esc(e.message)}</p>`));
};

/* ===== router: pick the page from the address ===== */
(function () {
  const p = location.pathname.replace(/\/$/, '') || '/';
  const page = p === '/admin/dashboard' ? 'dashboard' : p.startsWith('/admin/bookings/') ? 'booking' : p === '/admin/services' ? 'services'
    : p === '/admin/specialists' ? 'specialists' : p === '/admin/clients' ? 'clients' : p === '/admin/settings' ? 'settings' : 'bookings';
  const TITLES = { dashboard: 'Revenue & Analytics', bookings: 'Bookings', booking: 'Booking Details', services: 'Services Menu', specialists: 'Specialists', clients: 'Clients', settings: 'Settings' };
  document.title = TITLES[page] + ' | True Radiance Admin';
  Promise.resolve(PAGES[page]()).catch((e) => {
    console.error(e);
    const app = document.getElementById('app');
    if (app) app.innerHTML = '<p class="text-error">This page failed to load: ' + String(e.message).replace(/</g, '&lt;') + '</p>';
  });
})();