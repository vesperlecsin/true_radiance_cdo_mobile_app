/* ============================================================
   public/js/admin-dashboard.js
   ============================================================ */
(async function () {
  const { api, getShared, esc, peso, card, kpi, header, BTN2 } = TR;
  const app = document.getElementById('app');

  app.innerHTML = header('OVERVIEW', 'Dashboard', 'Here is what is happening at your Limketkai branch today.')
    + '<section id="kpis" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"></section>'
    + '<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6"><div class="lg:col-span-2" id="recent"></div><div id="roster"></div></div>';

  async function load() {
    try {
      const [ov, recent, roster] = await Promise.all([
        getShared(TR.EP.overview),
        api(TR.EP.bookings + '?limit=5&date=today'),
        getShared(TR.EP.roster)
      ]);

      const t = ov.today || {};
      document.getElementById('kpis').innerHTML = 
        kpi("TODAY'S APPOINTMENTS", t.total || 0, `${t.confirmed || 0} Confirmed · ${t.completed || 0} Done`, 'event_available') +
        kpi('NEXT 7 DAYS', ov.week?.count || 0, 'Upcoming reservations', 'date_range') +
        kpi('AWAITING CONFIRMATION', ov.pending || 0, 'Needs action', 'account_balance_wallet') +
        kpi('REVENUE TODAY', peso(ov.settledToday || 0), 'Payments received', 'payments');

      document.getElementById('recent').innerHTML = card(`
        <h3 class="font-title-lg text-primary mb-4">Today's Schedule</h3>
        <div class="space-y-3">
          ${recent.items.map(b => `
            <div class="flex items-center justify-between p-3 rounded-xl bg-surface-container-low border border-outline-variant/20">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-primary-container text-white flex items-center justify-center text-xs font-bold">${TR.fmtTime(b.startTime)}</div>
                <div>
                  <p class="font-semibold text-on-surface">${esc(b.guest.name)}</p>
                  <p class="text-xs text-on-surface-variant">${esc(b.serviceName)}</p>
                </div>
              </div>
              <div class="text-right">
                <span class="text-xs font-semibold px-2 py-1 rounded-full bg-surface-container">${esc(b.specialistName)}</span>
              </div>
            </div>
          `).join('') || '<p class="text-sm text-outline">No appointments today.</p>'}
        </div>
      `);

      document.getElementById('roster').innerHTML = card(`
        <h3 class="font-title-lg text-primary mb-4">Specialists</h3>
        <div class="space-y-2">
          ${roster.filter(s => s.isActive).map(s => `
            <div class="flex items-center justify-between p-2 rounded-lg bg-surface-bright border border-outline-variant/20">
              <span class="text-sm font-medium">${esc(s.name)}</span>
              <span class="text-xs ${s.today ? 'text-primary bg-rose-50' : 'text-emerald-700 bg-emerald-50'} px-2 py-0.5 rounded-full">${s.today ? s.today + ' booked' : 'Free'}</span>
            </div>
          `).join('')}
        </div>
      `);

    } catch (e) {
      app.innerHTML = `<div class="p-6 bg-error-container text-on-error-container rounded-xl">Failed to load dashboard: ${e.message}</div>`;
    }
  }

  load();
})();