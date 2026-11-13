/* ============================================================
   public/js/admin-specialists.js
   ============================================================ */
(async function () {
  const { api, esc, card, header, BTN } = TR;
  const app = document.getElementById('app');

  app.innerHTML = header('TEAM', 'Specialists', 'Manage your aestheticians and therapists.',
    `<button id="add-btn" class="${BTN} flex items-center gap-2"><span class="material-symbols-outlined text-lg">person_add</span>Add Specialist</button>`)
    + '<div id="list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mt-6"></div>';

  async function load() {
    try {
      const roster = await api(TR.EP.roster);
      document.getElementById('list').innerHTML = roster.map(s => `
        <div class="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/30 shadow-sm flex flex-col items-center text-center">
          <div class="w-16 h-16 rounded-full bg-primary-container text-white flex items-center justify-center text-xl font-bold mb-3 shadow-sm">
            ${TR.initials(s.name)}
          </div>
          <h3 class="font-title-lg text-on-surface font-bold">${esc(s.name)}</h3>
          <p class="text-xs text-primary font-medium mt-0.5">${esc(s.role)}</p>
          <div class="mt-4 pt-4 border-t border-outline-variant/20 w-full flex justify-between items-center">
            <span class="text-xs text-outline font-medium">Today</span>
            <span class="px-2 py-0.5 rounded-full text-xs font-bold ${s.today > 0 ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant'}">${s.today} booked</span>
          </div>
          <div class="mt-4 w-full">
            <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${s.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}">
              <span class="w-1.5 h-1.5 rounded-full ${s.isActive ? 'bg-emerald-500' : 'bg-rose-500'}"></span>
              ${s.isActive ? 'Active' : 'On Leave'}
            </span>
          </div>
        </div>
      `).join('');
    } catch (e) {
      document.getElementById('list').innerHTML = `<div class="p-6 bg-error-container text-on-error-container rounded-xl col-span-4">Failed to load roster: ${e.message}</div>`;
    }
  }

  load();
})();