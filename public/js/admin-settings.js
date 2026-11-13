/* ============================================================
   public/js/admin-settings.js
   ============================================================ */
(async function () {
  const { api, card, header, BTN, INPUT } = TR;
  const app = document.getElementById('app');

  app.innerHTML = header('CONFIGURATION', 'Branch Settings', 'Manage booking policies and branch details.')
    + '<div id="form" class="mt-6"></div>';

  async function load() {
    try {
      const settings = await api(TR.EP.settings);
      document.getElementById('form').innerHTML = card(`
        <form id="settings-form" class="space-y-6 max-w-2xl">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label class="block text-sm font-semibold mb-1">Branch Name</label><input type="text" class="${INPUT}" value="${settings.branchName || 'True Radiance CDO Limketkai'}"></div>
            <div><label class="block text-sm font-semibold mb-1">Contact Number</label><input type="text" class="${INPUT}" value="${settings.phone || '+63 917 892 4561'}"></div>
            <div class="md:col-span-2"><label class="block text-sm font-semibold mb-1">Address</label><input type="text" class="${INPUT}" value="${settings.address || 'Rosario Crescent, Limketkai Center'}"></div>
            <div><label class="block text-sm font-semibold mb-1">Opening Time</label><input type="time" class="${INPUT}" value="${settings.openTime || '09:00'}"></div>
            <div><label class="block text-sm font-semibold mb-1">Closing Time</label><input type="time" class="${INPUT}" value="${settings.closeTime || '21:00'}"></div>
          </div>
          <div class="pt-4 border-t border-outline-variant/30 flex justify-end">
            <button type="button" class="${BTN}">Save Changes</button>
          </div>
        </form>
      `);
    } catch (e) {
      document.getElementById('form').innerHTML = `<div class="p-6 bg-error-container text-on-error-container rounded-xl">Failed to load settings: ${e.message}</div>`;
    }
  }

  load();
})();