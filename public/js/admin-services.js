/* ============================================================
   public/js/admin-services.js
   ============================================================ */
(async function () {
  const { api, esc, peso, card, header, BTN } = TR;
  const app = document.getElementById('app');

  app.innerHTML = header('OFFERINGS', 'Services Menu', 'Manage the treatments and prices offered at your branch.',
    `<button id="add-btn" class="${BTN} flex items-center gap-2"><span class="material-symbols-outlined text-lg">add</span>Add Service</button>`)
    + '<div id="list" class="mt-6"></div>';

  async function load() {
    try {
      const services = await api(TR.EP.services);
      document.getElementById('list').innerHTML = card(`
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-surface-bright border-b border-outline-variant/30 text-label-sm text-outline uppercase tracking-wider">
              <th class="py-3 px-4">Service Name</th>
              <th class="py-3 px-4">Category</th>
              <th class="py-3 px-4 text-center">Duration</th>
              <th class="py-3 px-4 text-right">Price</th>
              <th class="py-3 px-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-surface-container text-sm">
            ${services.map(s => `
              <tr class="hover:bg-surface-container-low transition-colors">
                <td class="py-4 px-4 font-semibold text-primary">${esc(s.name)}</td>
                <td class="py-4 px-4"><span class="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-xs font-medium">${esc(s.category)}</span></td>
                <td class="py-4 px-4 text-center text-on-surface-variant">${s.durationMin} min</td>
                <td class="py-4 px-4 text-right font-bold text-primary">${peso(s.price)}</td>
                <td class="py-4 px-4 text-center">
                  <span class="px-2 py-0.5 rounded-full text-xs font-semibold ${s.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}">${s.isActive ? 'Active' : 'Hidden'}</span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `);
    } catch (e) {
      document.getElementById('list').innerHTML = `<div class="p-6 bg-error-container text-on-error-container rounded-xl">Failed to load services: ${e.message}</div>`;
    }
  }

  document.getElementById('add-btn').onclick = () => {
    TR.modal(`<h2 class="font-headline-md text-primary font-semibold mb-4">Add New Service</h2>
      <p class="text-sm text-on-surface-variant mb-4">To fully implement this form, you will need to connect a POST request to <code>/api/admin/services</code>.</p>
      <div class="flex justify-end mt-6"><button data-close class="${BTN}">Close</button></div>
    `);
  };

  load();
})();