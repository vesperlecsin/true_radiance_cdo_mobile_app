/* ============================================================
   admin-bookings.js — Uses shared TR.api
   ============================================================ */
(async function () {
  const BTN = 'px-5 py-2.5 rounded-full bg-primary-container text-white text-sm font-semibold';
  const BTN2 = 'px-5 py-2.5 rounded-full bg-white border border-outline-variant text-on-surface hover:bg-surface-container text-sm font-semibold';
  const PRIMARY = BTN + ' inline-flex items-center gap-2 !py-2';
  const GHOST = BTN2 + ' inline-flex items-center gap-1.5 !py-2 !px-4';
  const MINI = 'px-4 py-1.5 rounded-full text-white text-label-sm font-semibold shadow-[0_4px_12px_rgba(127,24,57,0.25)] hover:shadow-[0_6px_16px_rgba(212,175,55,0.38)] hover:-translate-y-px active:translate-y-0 active:scale-95 transition-all duration-200 bg-gradient-to-br ';

  const app = document.getElementById('app');
  const F = { date: 'upcoming', status: '', payment: '', specialist: '', q: '', page: 1 };

  let specs = [];
  let items = [];
  let sel = null;
  let meta = { total: 0, page: 1, pages: 1 };
  let ov = null;
  let roster = [];

  const opt = (pairs, cur) => pairs.map(([v, t]) => `<option value="${TR.esc(v)}" ${v === cur ? 'selected' : ''}>${TR.esc(t)}</option>`).join('');
  const clock = () => new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' });
  
  const NEXT = {
    pending:      ['confirmed',    'Confirm',    'Booking confirmed.'],
    confirmed:    ['in_treatment', 'Check In',   'Guest checked in.'],
    in_treatment: ['completed',    'Complete',   'Marked as completed.']
  };

  const fail = (e) => e.message !== 'Signed out' && TR.toast(e.message, true);

  try { specs = await TR.getShared(TR.EP.specialists); } catch {}

  app.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-outline-variant/30 no-print">
      <div>
        <span class="text-label-sm font-label-sm tracking-widest text-secondary font-semibold">RESERVATIONS</span>
        <div class="flex flex-wrap items-center gap-3">
          <h1 class="font-headline-lg text-headline-lg text-primary font-semibold">Bookings</h1>
          <span class="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-label-sm bg-surface-container text-primary border border-outline-variant/30 font-semibold">
            <span class="material-symbols-outlined text-xs">schedule</span>PHT (GMT+8) • <span id="clock">${clock()}</span>
          </span>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <button id="bell" class="${GHOST} relative !px-3" title="Bookings awaiting confirmation">
          <span class="material-symbols-outlined text-xl">notifications</span>
          <span id="belldot" class="hidden absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-white"></span>
        </button>
        <button id="csv" class="${GHOST}"><span class="material-symbols-outlined text-lg">download</span>Export CSV</button>
        <button id="wi" class="${PRIMARY}"><span class="material-symbols-outlined text-lg">person_add</span>Walk-in</button>
      </div>
    </div>

    <section id="kpis" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5"></section>

    <section class="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/20 shadow-[0_8px_30px_rgba(158,49,80,0.05)] flex flex-wrap items-center gap-3 no-print">
      <div class="relative flex-1 min-w-[260px]">
        <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary text-xl pointer-events-none">search</span>
        <input id="q" placeholder="Search guest, mobile or booking ID" class="w-full h-11 pl-12 pr-4 rounded-full bg-white border border-outline-variant/50 shadow-sm text-sm placeholder:text-outline focus:outline-none focus:border-secondary focus:ring-2 focus:ring-tertiary-container/40 transition-all"/>
      </div>
      ${TR.select('date', 'calendar_month', opt([
        ['upcoming', 'All upcoming'], ['today', 'Today'], ['recent', 'Newly booked (48h)'],
        ['week', 'Next 7 days'], ['month', 'This month'], ['all', 'All dates']
      ], F.date))}
      ${TR.select('status', 'task_alt', opt([['', 'All statuses'], ...Object.entries(TR.STATUS).map(([v, [t]]) => [v, t])], ''))}
      ${TR.select('payment', 'payments', opt([['', 'All payments'], ['unpaid', 'Unpaid'], ['deposit_paid', 'Deposit paid'], ['paid', 'Paid in full'], ['refunded', 'Refunded']], ''))}
      ${TR.select('specialist', 'person', opt([['', 'All specialists'], ...specs.map((s) => [s.name, s.name])], ''))}
      <button id="reset" class="${GHOST} !h-11" title="Clear all filters"><span class="material-symbols-outlined text-lg">filter_alt_off</span>Clear</button>
    </section>

    <section class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div id="reg" class="lg:col-span-8 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-sm overflow-hidden"></div>
      <div id="side" class="lg:col-span-4 flex flex-col gap-5 no-print"></div>
    </section>`;

  const $ = (id) => document.getElementById(id);

  const kcard = (label, big, badge, icon, foot, cls = '', lc = 'text-outline') => `
    <div class="bg-surface-container-lowest p-5 rounded-2xl border ${cls || 'border-outline-variant/20'} shadow-sm flex flex-col justify-between">
      <div class="flex items-start justify-between">
        <div>
          <span class="text-label-sm uppercase tracking-wider ${lc}">${label}</span>
          <div class="flex items-baseline gap-2 mt-1"><span class="font-headline-md text-headline-md text-primary font-bold">${big}</span>${badge}</div>
        </div>
        <div class="w-10 h-10 rounded-2xl bg-surface-container flex items-center justify-center text-primary"><span class="material-symbols-outlined">${icon}</span></div>
      </div>
      <div class="mt-4 pt-3 border-t border-outline-variant/20 text-label-sm text-on-surface-variant flex flex-wrap items-center justify-between gap-1">${foot}</div>
    </div>`;

  const dot = (c, t) => `<span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full ${c}"></span>${t}</span>`;

  function drawKpis() {
    if (!ov) return;
    const t = ov.today || {};
    const sp = ov.split || {};
    const pct = (v) => (ov.settledToday ? Math.round((v / ov.settledToday) * 100) : 0);
    const peak = ov.week?.peakDay ? new Date(ov.week.peakDay + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }) : '—';

    $('kpis').innerHTML = kcard("TODAY'S APPOINTMENTS", t.total || 0, '', 'event_available', dot('bg-emerald-500', `${t.confirmed || 0} Confirmed`) + dot('bg-secondary', `${t.inTreatment || 0} In treatment`) + dot('bg-outline', `${t.completed || 0} Done`))
      + kcard('NEXT 7 DAYS', ov.week?.count || 0, '<span class="text-label-sm text-outline">Reservations</span>', 'date_range', `<span>Busiest day: <b class="text-primary">${peak}${ov.week?.peakCount ? ` (${ov.week.peakCount})` : ''}</b></span>`)
      + kcard('AWAITING CONFIRMATION', ov.pending || 0, ov.pending ? '<span class="text-label-sm bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-medium">Needs action</span>' : '', 'account_balance_wallet',
        `<span>Pending deposits / approval</span>${ov.pending ? '<button id="review" class="text-primary font-semibold underline">Review</button>' : ''}`, 'border-2 border-amber-200/80', 'text-amber-800 font-semibold')
      + kcard('PAYMENTS RECEIVED TODAY', TR.peso(ov.settledToday || 0), '', 'payments', `<span class="text-xs font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">GCash ${pct(sp.GCash || 0)}%</span><span class="text-xs font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">Maya ${pct(sp.Maya || 0)}%</span><span class="text-xs font-medium text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded">Cash/other ${pct(sp.Other || 0)}%</span>`);

    $('belldot').classList.toggle('hidden', !ov.pending);
    $('bell').title = `${ov.pending || 0} booking(s) awaiting confirmation`;

    const r = $('review');
    if (r) r.onclick = showPending;
  }

  function showPending() {
    F.status = 'pending'; F.date = 'all'; F.page = 1;
    $('status').value = 'pending'; $('date').value = 'all';
    load().catch(fail);
  }

  const chip = (t, c) => `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${c}">${t}</span>`;
  const isNew = (b) => Date.now() - new Date(b.createdAt).getTime() < 24 * 3600e3;
  const tags = (b) => (isNew(b) ? chip('NEW', 'bg-primary text-white') : '') + (b.customer ? chip('ACCOUNT', 'bg-tertiary-fixed text-on-tertiary-fixed') : b.source === 'walk-in' ? chip('WALK-IN', 'bg-slate-100 text-slate-600') : '');
  
  const settle = (b) => {
    const m = {
      unpaid:       [`Awaiting ${TR.peso(b.depositAmount)} ${TR.esc(b.paymentMethod)}`, 'text-amber-900 bg-amber-100 border-amber-300'],
      deposit_paid: [`${TR.peso(b.amountPaid)} ${TR.esc(b.paymentMethod)} paid`,           'text-emerald-800 bg-emerald-50 border-emerald-200'],
      paid:         [`Paid in full (${TR.esc(b.paymentMethod)})`,                          'text-emerald-800 bg-emerald-50 border-emerald-200'],
      refunded:     ['Refunded',                                                           'text-stone-600 bg-stone-100 border-stone-200']
    }[b.paymentStatus] || ['Unknown', 'text-stone-600 bg-stone-100 border-stone-200'];
    return `<span class="text-xs px-2 py-0.5 rounded-full border mt-1 font-medium w-fit ${m[1]}">${m[0]}</span>`;
  };

  function drawTable() {
    const from = meta.total ? (meta.page - 1) * 10 + 1 : 0;
    const today = TR.today();

    $('reg').innerHTML = `<div class="px-6 py-4 bg-surface-container-low border-b border-outline-variant/30 flex items-center gap-3"><span class="material-symbols-outlined text-primary">calendar_month</span>
      <div><h3 class="font-title-lg text-title-lg text-on-surface">Booking Registry</h3><p class="text-label-sm text-outline">Limketkai Center Branch • ${meta.total} booking${meta.total === 1 ? '' : 's'} match your filters</p></div></div>
      <div class="overflow-x-auto"><table class="w-full text-left border-collapse"><thead><tr class="bg-surface-bright border-b border-outline-variant/30 text-label-sm text-outline uppercase tracking-wider">
        <th class="py-3.5 px-4 pl-6">ID &amp; Client</th><th class="px-4">Treatment</th><th class="px-4">Specialist &amp; Time</th><th class="px-4">Settlement</th><th class="px-4">Status</th><th class="px-4 pr-6 text-right">Actions</th></tr></thead>
      <tbody class="divide-y divide-surface-container text-sm">${items.map((b) => {
        const nx = NEXT[b.status], on = sel && sel._id === b._id;
        return `<tr data-id="${b._id}" class="cursor-pointer transition-colors hover:bg-surface-container-low ${on ? 'bg-surface-container-low/70 border-l-4 border-primary' : b.status === 'pending' ? 'bg-amber-50/20' : ''} ${['cancelled', 'no_show'].includes(b.status) ? 'opacity-60' : ''}">
        <td class="py-4 px-4 pl-6 align-top"><div class="flex items-center gap-2"><span class="text-label-sm font-mono font-bold text-primary">#${TR.esc(b.ref)}</span>${tags(b)}</div>
          <p class="font-title-md text-on-surface font-semibold mt-0.5">${TR.esc(b.guest.name)}</p><p class="text-label-sm text-on-surface-variant font-mono mt-0.5">${TR.esc(TR.phone(b.guest.phone))}</p></td>
        <td class="py-4 px-4 align-top"><p class="font-semibold text-primary">${TR.esc(b.serviceName)}</p><p class="text-label-sm text-outline mt-0.5 flex items-center gap-1"><span class="material-symbols-outlined text-xs">hourglass_empty</span>${b.durationMin} mins</p></td>
        <td class="py-4 px-4 align-top"><div class="flex items-center gap-1.5 font-medium"><span class="w-6 h-6 rounded-full bg-secondary text-white text-[10px] flex items-center justify-center font-bold">${TR.initials(b.specialistName)}</span>${TR.esc(b.specialistName)}</div>
          <p class="mt-2 text-label-md font-semibold text-primary flex items-center gap-1"><span class="material-symbols-outlined text-sm">schedule</span>${TR.fmtTime(b.startTime)} – ${TR.fmtTime(b.endTime)}</p><p class="text-label-sm text-outline">${b.date === today ? 'Today' : TR.fmtDate(b.date)}</p></td>
        <td class="py-4 px-4 align-top"><div class="flex flex-col"><span class="font-bold text-primary text-base">${TR.peso(b.totalAmount)}</span>${settle(b)}</div></td>
        <td class="py-4 px-4 align-top">${TR.statusPill(b.status)}</td>
        <td class="py-4 px-4 pr-6 align-top text-right whitespace-nowrap">${nx ? `<button data-act="${b._id}" class="${MINI}${b.status === 'pending' ? 'from-amber-500 to-amber-700' : 'from-primary-container to-primary'}">${nx[1]}</button>` : `<a href="/admin/bookings/${b._id}" class="px-3 py-1.5 rounded-full bg-white border border-outline-variant/30 text-outline hover:text-primary text-label-sm font-medium">Details</a>`}</td></tr>`;
      }).join('') || '<tr><td colspan="6" class="py-14 text-center text-on-surface-variant">No bookings match these filters.</td></tr>'}</tbody></table></div>
      <div class="px-6 py-3.5 bg-surface-bright border-t border-outline-variant/30 flex items-center justify-between text-label-sm text-outline"><span>Showing ${from}–${from + items.length - (meta.total ? 1 : 0)} of ${meta.total}</span>
        <div class="flex items-center gap-3"><button id="prev" class="px-3 py-1 rounded-md bg-white border border-outline-variant/30 disabled:opacity-50" ${meta.page <= 1 ? 'disabled' : ''}>Previous</button><span>Page <b class="text-primary">${meta.page}</b> of ${meta.pages}</span><button id="next" class="px-3 py-1 rounded-md bg-white border border-outline-variant/30 disabled:opacity-50" ${meta.page >= meta.pages ? 'disabled' : ''}>Next</button></div></div>`;
    
    $('prev').onclick = () => { F.page--; load().catch(fail); }; 
    $('next').onclick = () => { F.page++; load().catch(fail); };
  }

  function drawSide() {
    let h = '';
    if (!sel) h += `<div class="bg-surface-container-lowest rounded-2xl border border-dashed border-outline-variant p-8 text-center text-sm text-on-surface-variant"><span class="material-symbols-outlined text-3xl text-outline">touch_app</span><p class="mt-2">Select a booking to see the guest, payment and actions.</p></div>`;
    else {
      const b = sel, nx = NEXT[b.status], bal = Math.max(b.totalAmount - b.amountPaid, 0), live = ['pending', 'confirmed'].includes(b.status);
      h += `<div class="bg-surface-container-lowest rounded-2xl border-2 border-primary/20 shadow-md p-6 flex flex-col gap-4 relative overflow-hidden">
        <div class="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full pointer-events-none"></div>
        <div class="flex items-start justify-between"><div><span class="text-xs font-mono font-bold text-white bg-primary px-2 py-0.5 rounded-full">INSPECTING #${TR.esc(b.ref)}</span>
          <h3 class="font-headline-sm text-headline-sm text-primary mt-2">${TR.esc(b.guest.name)}</h3><p class="text-label-sm text-outline">${b.source === 'walk-in' ? 'Walk-in / phone' : b.customer ? 'Website · customer account' : 'Website · guest'} • booked ${TR.fmtDate(b.createdAt.slice(0, 10))}</p></div>
          <button id="closeSel" class="p-1 rounded-full hover:bg-surface-container text-outline" title="Close"><span class="material-symbols-outlined text-lg">close</span></button></div>
        <div class="flex flex-wrap gap-2 text-xs"><a class="${BTN2} !py-1 !px-3" href="#">Call</a><a class="${BTN2} !py-1 !px-3" href="#">Viber</a>${b.guest.email ? `<a class="${BTN2} !py-1 !px-3" href="#">Email</a>` : ''}</div>
        ${b.notes ? `<div class="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-label-sm"><p class="font-semibold text-amber-900 flex items-center gap-1 mb-1"><span class="material-symbols-outlined text-sm">clinical_notes</span>Guest notes / allergies</p><p class="text-on-surface-variant italic">“${TR.esc(b.notes)}”</p></div>` : ''}
        <div class="grid grid-cols-2 gap-3 text-label-sm"><div class="p-3 bg-surface-bright rounded-xl border border-outline-variant/20"><span class="text-outline block">Treatment</span><span class="font-semibold text-primary mt-0.5 block">${TR.esc(b.serviceName)}</span><span class="text-xs text-outline">${b.durationMin} mins</span></div>
          <div class="p-3 bg-surface-bright rounded-xl border border-outline-variant/20"><span class="text-outline block">Specialist</span><span class="font-semibold text-on-surface mt-0.5 block">${TR.esc(b.specialistName)}</span><span class="text-xs text-outline">${TR.fmtDate(b.date)} · ${TR.fmtTime(b.startTime)}</span></div></div>
        <div class="pt-3 border-t border-outline-variant/30 flex flex-col gap-2 text-label-sm">
          <div class="flex justify-between"><span class="text-outline">Service price</span><span>${TR.peso(b.totalAmount)}</span></div>
          <div class="flex justify-between"><span class="text-emerald-700 font-medium">${TR.esc(b.paymentMethod)} received</span><span class="text-emerald-700 font-medium">−${TR.peso(b.amountPaid)}</span></div>
          <div class="flex justify-between pt-2 border-t border-outline-variant/20 text-title-md font-title-md text-primary"><span>Balance at check-out</span><b>${TR.peso(bal)}</b></div></div>
        <div class="flex gap-2"><select id="pay" class="${TR.INPUT} !rounded-full !h-10 text-xs">${Object.entries(TR.PAY).map(([k, v]) => `<option value="${k}" ${k === b.paymentStatus ? 'selected' : ''}>${v}</option>`).join('')}</select><button id="paybtn" class="${BTN2} !py-2 text-xs whitespace-nowrap">Update payment</button></div>
        <div class="flex flex-col gap-2.5">${nx ? `<button id="primary" class="${PRIMARY} w-full justify-center !py-3">${nx[1]}</button>` : ''}
          <div class="grid grid-cols-2 gap-2"><a href="/admin/bookings/${b._id}" class="${BTN2} !py-2.5 !px-3 text-center flex items-center justify-center gap-1.5"><span class="material-symbols-outlined text-sm">open_in_new</span>Full details</a>
          ${live ? `<button id="cancelBtn" class="py-2.5 px-3 rounded-full bg-white border border-rose-300 text-error font-label-lg font-semibold shadow-sm hover:bg-rose-50 hover:border-error active:scale-95 transition-all duration-200 flex items-center justify-center gap-1.5"><span class="material-symbols-outlined text-sm">cancel</span>Cancel</button>` : `<span class="py-2.5 rounded-full bg-surface-container text-center text-outline text-label-md">${TR.STATUS[b.status][0]}</span>`}</div></div></div>`;
    }
    h += `<div class="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-5 shadow-sm"><div class="flex items-center justify-between mb-3"><div class="flex items-center gap-2 text-primary font-title-md font-semibold"><span class="material-symbols-outlined text-lg">group</span>Specialists today</div><a href="/admin/specialists" class="text-xs text-primary font-semibold hover:underline">Roster →</a></div>
      <div class="space-y-2.5">${roster.filter((s) => s.isActive).map((s) => `<div class="flex items-center justify-between p-2.5 rounded-xl bg-surface-bright border border-outline-variant/20"><div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full ${s.today ? 'bg-primary' : 'bg-emerald-500'}"></span><span class="text-label-md font-semibold">${TR.esc(s.name)}</span></div>
        <span class="text-label-sm ${s.today ? 'text-primary bg-rose-50 border-secondary-container' : 'text-emerald-800 bg-emerald-50 border-emerald-200'} px-2 py-0.5 rounded-full border">${s.today ? s.today + ' booked today' : 'Free today'}</span></div>`).join('') || '<p class="text-sm text-on-surface-variant">No specialists yet.</p>'}</div></div>`;
    $('side').innerHTML = h;
    
    const g = (id) => document.getElementById(id);
    if (g('closeSel')) g('closeSel').onclick = () => { sel = null; drawTable(); drawSide(); };
    if (g('primary')) g('primary').onclick = () => advanceStatus(sel).catch(fail);
    if (g('paybtn')) g('paybtn').onclick = () => updatePayment(sel, g('pay').value).catch(fail);
    if (g('cancelBtn')) g('cancelBtn').onclick = () => cancelBooking(sel).catch(fail);
  }

  async function advanceStatus(b) {
    const nx = NEXT[b.status];
    if (!nx) return;
    await TR.api(`${TR.EP.bookings}/${b._id}`, { method: 'PATCH', body: JSON.stringify({ status: nx[0] }) });
    TR.toast(nx[2]); TR.invalidate('/api/admin/'); await load();
  }

  async function updatePayment(b, paymentStatus) {
    await TR.api(`${TR.EP.bookings}/${b._id}`, { method: 'PATCH', body: JSON.stringify({ paymentStatus }) });
    TR.toast('Payment updated.'); TR.invalidate('/api/admin/'); await load();
  }

  async function cancelBooking(b) {
    if (!confirm(`Cancel booking #${b.ref}?`)) return;
    await TR.api(`${TR.EP.bookings}/${b._id}`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) });
    TR.toast('Booking cancelled.'); TR.invalidate('/api/admin/'); await load();
  }

  function buildBookingsUrl() {
    const qs = new URLSearchParams({ limit: '10', page: String(F.page), date: F.date, status: F.status, payment: F.payment, specialist: F.specialist, q: F.q });
    return `${TR.EP.bookings}?${qs.toString()}`;
  }

  async function load() {
    const [d, o, r] = await Promise.all([
      TR.api(buildBookingsUrl()),
      TR.getShared(TR.EP.overview),
      TR.getShared(TR.EP.roster)
    ]);
    items = d.items || []; meta = { total: d.total || 0, page: d.page || 1, pages: d.pages || 1 };
    ov = o; roster = r || [];
    if (sel) { const fresh = items.find((x) => x._id === sel._id); if (fresh) sel = fresh; }
    drawKpis(); drawTable(); drawSide();
  }

  $('reg').addEventListener('click', (e) => {
    const actBtn = e.target.closest('button[data-act]');
    if (actBtn) {
      const b = items.find((x) => x._id === actBtn.dataset.act);
      if (b) advanceStatus(b).catch(fail); return;
    }
    if (e.target.closest('a,button,select')) return;
    const tr = e.target.closest('tr[data-id]');
    if (tr) { sel = items.find((x) => x._id === tr.dataset.id); drawTable(); drawSide(); }
  });

  let searchTimer;
  $('q').addEventListener('input', (e) => {
    F.q = e.target.value.trim(); F.page = 1;
    clearTimeout(searchTimer); searchTimer = setTimeout(() => load().catch(fail), 300);
  });

  ['date', 'status', 'payment', 'specialist'].forEach((key) => {
    $(key).addEventListener('change', (e) => { F[key] = e.target.value; F.page = 1; load().catch(fail); });
  });

  $('reset').onclick = () => {
    Object.assign(F, { date: 'upcoming', status: '', payment: '', specialist: '', q: '', page: 1 });
    $('q').value = ''; $('date').value = 'upcoming'; $('status').value = ''; $('payment').value = ''; $('specialist').value = '';
    load().catch(fail);
  };

  $('bell').onclick = () => { F.status = 'pending'; F.date = 'all'; F.page = 1; $('status').value = 'pending'; $('date').value = 'all'; load().catch(fail); };
  $('wi').onclick = () => TR.toast('Walk-in flow not implemented yet.');
  $('csv').onclick = () => window.location.href = `${TR.EP.bookings}/export.csv?${new URLSearchParams(F).toString()}`;

  load().catch(fail);
})();