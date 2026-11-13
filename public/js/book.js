/* True Radiance – booking wizard <-> API glue.
   Runs AFTER the page's own inline script, so it reuses its helpers
   (state, selectService, selectSpecialist, selectDate, selectTime, goToStep, updateSummaryUI). */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const B = { service: null, specialist: null, date: null, time: null, services: [], specialists: [], y: 0, m: 0, confirmed: false };

  // ---- Philippine "today" regardless of the guest's device timezone ----
  const phtToday = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  const addDays = (iso, d) => new Date(Date.parse(iso + 'T00:00:00Z') + d * 864e5).toISOString().slice(0, 10);
  const longDate = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const peso = (n) => '₱' + Number(n).toLocaleString('en-PH');
  const dur = (m) => `${m} min` + (m >= 180 ? ` (${m / 60} Hours)` : '');

  async function api(path, opts) {
    const res = await fetch('/api' + path, opts && { headers: { 'Content-Type': 'application/json' }, ...opts });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(data.error || 'Something went wrong.'); e.status = res.status; throw e; }
    return data;
  }

  function toast(msg) {
    let t = $('tr-toast');
    if (!t) {
      t = document.createElement('div'); t.id = 'tr-toast';
      t.className = 'fixed left-1/2 -translate-x-1/2 bottom-6 z-[100] max-w-md px-5 py-3 rounded-full bg-primary text-white text-sm font-semibold shadow-lg transition-opacity';
      document.body.appendChild(t);
    }
    t.textContent = msg; t.style.opacity = 1;
    clearTimeout(t._h); t._h = setTimeout(() => (t.style.opacity = 0), 4500);
  }

  // ---- tag the design's calendar elements (must happen before listeners are attached) ----
  const calTitle = [...document.querySelectorAll('h3')].find((h) => /^\s*[A-Z][a-z]+ \d{4}\s*$/.test(h.textContent));
  const calGrid = document.querySelector('.grid.grid-cols-7.gap-1');
  if (!calTitle || !calGrid) { console.error('Booking calendar markup not found'); return; }
  calTitle.id = 'cal-title'; calGrid.id = 'cal-days';

  // ---- start from an empty selection (remove the design's demo defaults) ----
  Object.assign(state, { serviceName: 'Select a service', servicePrice: 0, serviceDuration: '—', specialistName: 'Not selected', specialistRole: '', selectedDate: 'Select a date', selectedTime: '—' });
  function resetSummary() { updatePricingCalculations(); updateSummaryUI(); }

  // ---- STEP 1: services ----
  function serviceCard(s) {
    return `<div class="service-card p-5 rounded-2xl border border-outline-variant/30 hover:border-primary-container bg-surface-container-lowest cursor-pointer transition-all duration-200 flex flex-col justify-between group relative overflow-hidden" data-category="${esc(s.category)}" data-id="${s._id}">
      ${s.popular ? '<span class="absolute top-0 right-0 bg-primary text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl tracking-wider">MOST REQUESTED</span>' : ''}
      <div class="flex items-start justify-between gap-3"><div>
        <h3 class="font-title-md text-on-surface group-hover:text-primary transition-colors">${esc(s.name)}</h3>
        <p class="text-xs text-on-surface-variant mt-1">${esc(s.description)}</p></div>
        <span class="selection-indicator w-6 h-6 rounded-full border-2 border-outline-variant flex items-center justify-center text-transparent shrink-0"><span class="material-symbols-outlined text-sm font-bold">check</span></span></div>
      <div class="mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-between text-xs">
        <span class="text-on-surface-variant flex items-center gap-1"><span class="material-symbols-outlined text-sm">schedule</span> ${dur(s.durationMin)}</span>
        <span class="text-primary font-bold text-base">${peso(s.price)}</span></div></div>`;
  }

  $('services-grid').addEventListener('click', (e) => {
    const card = e.target.closest('.service-card'); if (!card) return;
    const s = B.services.find((x) => x._id === card.dataset.id);
    if (B.service?._id !== s._id) {                                  // downstream choices may no longer apply
      B.specialist = null; B.date = null; B.time = null; B.renderedFor = null;
      Object.assign(state, { specialistName: 'Not selected', specialistRole: '', selectedDate: 'Select a date', selectedTime: '—' });
    }
    B.service = s;
    selectService(s.name, s.price, dur(s.durationMin), card);
  });

  // ---- STEP 2: specialists (only those who can do the chosen service) ----
  function renderSpecialists() {
    const eligible = B.specialists.filter((p) => p.serviceCategories.includes(B.service.category));
    const initials = (n) => n.split(' ').map((w) => w[0]).join('').slice(0, 2);
    const radio = '<span class="specialist-radio w-6 h-6 rounded-full border-2 border-outline-variant flex items-center justify-center text-transparent shrink-0"><span class="material-symbols-outlined text-sm font-bold">check</span></span>';
    const base = 'specialist-card p-5 rounded-2xl border border-outline-variant/30 hover:border-primary-container bg-surface-container-lowest cursor-pointer transition-all duration-200 flex items-center justify-between group';
    $('specialist-grid').innerHTML =
      `<div class="${base}" data-id="any"><div class="flex items-center gap-4">
        <div class="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center text-primary"><span class="material-symbols-outlined text-2xl">groups</span></div>
        <div><h3 class="font-title-md text-on-surface font-semibold group-hover:text-primary">Any Available Specialist</h3>
        <p class="text-xs text-primary font-medium mt-0.5">Fastest booking confirmation</p>
        <span class="inline-block text-[11px] text-on-surface-variant mt-1">Maximum schedule flexibility</span></div></div>${radio}</div>` +
      eligible.map((p) => `<div class="${base}" data-id="${p._id}"><div class="flex items-center gap-4">
        <div class="w-14 h-14 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-lg">${esc(initials(p.name))}</div>
        <div><h3 class="font-title-md text-on-surface font-semibold group-hover:text-primary">${esc(p.name)}</h3>
        <p class="text-xs text-primary font-medium mt-0.5">${esc(p.role)}</p>
        <span class="inline-block text-[11px] text-on-surface-variant mt-1">★ ${p.rating.toFixed(2)} · ${p.yearsExperience}+ yrs</span></div></div>${radio}</div>`).join('');
    B.specialist = null; state.specialistName = 'Not selected'; state.specialistRole = ''; updateSummaryUI();
  }
  $('specialist-grid').addEventListener('click', (e) => {
    const card = e.target.closest('.specialist-card'); if (!card) return;
    const p = B.specialists.find((x) => x._id === card.dataset.id);
    if (B.specialist !== card.dataset.id) { B.time = null; }
    B.specialist = card.dataset.id;
    selectSpecialist(p ? p.name : 'Any Available Specialist', p ? p.role : 'Assigned on confirmation', card.dataset.id, card);
  });

  // ---- STEP 3: calendar + live time slots ----
  function renderCalendar() {
    const today = phtToday(), max = addDays(today, 60), { y, m } = B;
    $('cal-title').textContent = new Date(Date.UTC(y, m, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const first = new Date(Date.UTC(y, m, 1)).getUTCDay(), days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    let h = '<span></span>'.repeat(first);
    for (let d = 1; d <= days; d++) {
      const iso = `${y}-${pad(m + 1)}-${pad(d)}`;
      if (iso < today || iso > max) h += `<span class="p-2 text-outline/50 text-xs flex items-center justify-center line-through">${d}</span>`;
      else {
        const sel = iso === B.date;
        h += `<button type="button" data-date="${iso}" class="date-btn p-2 rounded-full ${sel ? 'active bg-primary-container text-white font-bold ring-2 ring-primary ring-offset-2 ring-offset-surface-container-lowest' : 'hover:bg-surface-container font-medium text-on-surface'}">${d}</button>`;
      }
    }
    $('cal-days').innerHTML = h;
  }

  async function loadSlots() {
    const box = $('timeslot-container');
    if (!B.date) { box.innerHTML = '<p class="col-span-2 text-xs text-on-surface-variant">Choose a date to see available times.</p>'; return; }
    box.innerHTML = '<p class="col-span-2 text-xs text-on-surface-variant">Loading times…</p>';
    try {
      const { slots } = await api(`/availability?serviceId=${B.service._id}&specialistId=${B.specialist || 'any'}&date=${B.date}`);
      if (B.time && !slots.find((s) => s.time === B.time && s.available)) { B.time = null; state.selectedTime = '—'; updateSummaryUI(); }
      if (!slots.some((s) => s.available)) { box.innerHTML = '<p class="col-span-2 text-xs text-error font-semibold">Fully booked on this date. Please try another day.</p>'; return; }
      box.innerHTML = slots.map((s) => s.available
        ? `<button type="button" data-time="${s.time}" data-label="${s.label}" class="time-slot-btn py-2.5 px-3 rounded-full ${s.time === B.time ? 'active bg-primary-container text-white ring-2 ring-primary ring-offset-1' : 'border border-outline-variant/40 bg-white text-on-surface hover:border-primary'} text-xs font-semibold transition-all">${s.label}</button>`
        : `<button type="button" disabled class="py-2.5 px-3 rounded-full bg-surface-container-high/60 text-xs font-medium text-outline/60 cursor-not-allowed">${s.label}<span class="text-[10px] text-error ml-1">(Booked)</span></button>`).join('');
    } catch (err) { box.innerHTML = `<p class="col-span-2 text-xs text-error">${esc(err.message)}</p>`; }
  }

  $('cal-days').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-date]'); if (!btn) return;
    B.date = btn.dataset.date; B.time = null; state.selectedTime = '—';
    renderCalendar(); selectDate(longDate(B.date), $('cal-days').querySelector(`[data-date="${B.date}"]`)); loadSlots();
  });
  $('timeslot-container').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-time]'); if (!btn) return;
    B.time = btn.dataset.time; selectTime(btn.dataset.label, btn);
  });

  // ---- STEP 4: submit ----
  async function submit() {
    const btn = $('summary-next-btn'), form = $('booking-form');
    if (!form.reportValidity()) return;
    btn.disabled = true;
    try {
      const { booking: b } = await api('/bookings', { method: 'POST', body: JSON.stringify({
        serviceId: B.service._id, specialistId: B.specialist || 'any', date: B.date, time: B.time,
        guest: { name: $('client-name').value, phone: '+63' + $('client-phone').value, email: $('client-email').value },
        notes: $('client-notes').value, payOption: state.isDeposit ? 'deposit' : 'full', paymentMethod: state.paymentMethod
      }) });
      B.confirmed = true;
      state.specialistName = b.specialistName;               // "Any available" resolves to a real person
      $('conf-name').textContent = b.guest.name.split(' ')[0];
      $('conf-ref').textContent = '#' + b.ref;
      $('conf-phone').textContent = b.guest.phone.replace(/^(\+63)(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3 $4');
      $('conf-email').textContent = b.guest.email;
      updateSummaryUI();
      const due = b.payOption === 'full' ? b.totalAmount : b.depositAmount;
      const payText = `${peso(due)} ${b.payOption === 'full' ? 'full payment' : 'deposit'} due via ${b.paymentMethod}`;
      $('conf-balance').textContent = b.totalAmount - due > 0 ? `Balance of ${peso(b.totalAmount - due)} at salon` : 'Nothing further to pay at salon';
      const box = $('conf-ref').closest('.max-w-xl');
      if (box && !$('manage-note')) box.insertAdjacentHTML('afterend', `<p id="manage-note" class="mt-5 text-xs text-on-surface-variant">Plans changed? You can cancel free of charge up to ${b.cancelHours} hours before your appointment. <a class="text-primary font-semibold underline" href="/manage?ref=${encodeURIComponent(b.ref)}">Manage or cancel booking</a></p>`);
      B.last = { ref: b.ref, phone: b.guest.phone };
      const actions = $('step-panel-5').querySelector('.flex.flex-wrap');
      if (actions && !$('cancel-booking-btn')) {
        actions.insertAdjacentHTML('afterbegin', '<button type="button" id="cancel-booking-btn" class="px-5 py-2.5 rounded-full bg-white border-2 border-error text-error hover:bg-error-container text-xs font-label-lg font-semibold flex items-center gap-2 transition-all"><span class="material-symbols-outlined text-base">event_busy</span><span>Cancel Booking</span></button>');
        $('cancel-booking-btn').onclick = cancelThisBooking;
      }
      const startOver = $('start-over-btn'); if (startOver) startOver.remove();
      _goToStep(5);
      $('conf-payment').textContent = payText;     // the design's own code says "Paid"; we haven't charged anything
    } catch (err) {
      toast(err.message);
      if (err.status === 409) { B.time = null; state.selectedTime = '—'; updateSummaryUI(); _goToStep(3); loadSlots(); }
    } finally { btn.disabled = B.confirmed; }
  }
  $('booking-form').onsubmit = (e) => { e.preventDefault(); submit(); };   // replaces the demo handler

  // ---- step navigation guard (wraps the page's goToStep) ----
  const _goToStep = goToStep;
  window.goToStep = function (n) {
    if (B.confirmed && n !== 5) return;                               // booking is done
    if (n >= 2 && !B.service) return toast('Please choose a service first.');
    if (n >= 3 && !B.specialist) return toast('Please choose a specialist (or "Any Available").');
    if (n >= 4 && !(B.date && B.time)) return toast('Please choose a date and time.');
    if (n === 5 && !B.confirmed) { if (state.step === 4) $('booking-form').requestSubmit(); return; }
    if (n === 2 && B.renderedFor !== B.service._id) { renderSpecialists(); B.renderedFor = B.service._id; }
    if (n === 3) { renderCalendar(); loadSlots(); }
    _goToStep(n);
  };

  // ---- cancel the booking just made (from the confirmation screen) ----
  async function cancelThisBooking() {
    if (!B.last || !confirm('Cancel this booking? This cannot be undone.')) return;
    const btn = $('cancel-booking-btn'); btn.disabled = true;
    try {
      const d = await api('/bookings/cancel', { method: 'POST', body: JSON.stringify(B.last) });
      btn.remove();
      const panel = $('step-panel-5');
      panel.querySelector('h2').textContent = 'Booking Cancelled';
      panel.querySelector('h2').nextElementSibling.textContent = d.paidNote
        ? 'Your reservation is cancelled. Because a payment was recorded, our team will contact you about your deposit.'
        : 'Your reservation has been cancelled and the time slot released. You are welcome to book again anytime.';
      const badge = panel.querySelector('.inline-flex'); if (badge) badge.textContent = 'Cancelled';
      toast('Your booking has been cancelled.');
    } catch (err) { toast(err.message); btn.disabled = false; }
  }

  // ---- "Cancel & start over" while still choosing (steps 1-4) ----
  const nextWrap = $('summary-action-container');
  if (nextWrap) {
    nextWrap.insertAdjacentHTML('afterend', '<button type="button" id="start-over-btn" class="mt-3 w-full py-2.5 rounded-full border border-error/50 text-error text-xs font-semibold hover:bg-error-container transition-all">Cancel &amp; start over</button>');
    $('start-over-btn').onclick = () => { if (confirm('Cancel this booking and start over? Nothing has been saved yet.')) location.href = '/book'; };
  }

  // ---- boot ----
  (async function init() {
    const d = new Date(Date.now() + 8 * 3600e3); B.y = d.getUTCFullYear(); B.m = d.getUTCMonth();
    const mv = (delta) => { B.m += delta; if (B.m < 0) { B.m = 11; B.y--; } if (B.m > 11) { B.m = 0; B.y++; } renderCalendar(); };
    document.querySelector('[title="Previous Month"]').onclick = () => mv(-1);
    document.querySelector('[title="Next Month"]').onclick = () => mv(1);
    $('services-grid').innerHTML = '<p class="text-sm text-on-surface-variant">Loading services…</p>';
    try {
      [B.services, B.specialists] = await Promise.all([api('/services'), api('/specialists')]);
      $('services-grid').innerHTML = B.services.map(serviceCard).join('');
    } catch (err) { $('services-grid').innerHTML = `<p class="text-sm text-error">Could not load services. ${esc(err.message)}</p>`; }
    renderCalendar(); loadSlots(); resetSummary();
    try {                                                   // signed-in customers: pre-fill their details
      const me = await (await fetch('/api/auth/me')).json();
      if (me.role === 'customer') {
        $('client-name').value = me.name; $('client-email').value = me.email;
        $('client-phone').value = me.phone.replace(/^\+63(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3');
      }
    } catch {}
  })();
})();