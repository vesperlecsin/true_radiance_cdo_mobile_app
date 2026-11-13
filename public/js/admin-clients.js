/* ============================================================
   public/js/admin-clients.js
   ============================================================ */
(async function () {
  const { api, esc, peso, card, kpi, header, BTN2, INPUT } = TR;
  const app = document.getElementById('app');
  const S = { q: '', sort: 'recent', page: 1 };

  app.innerHTML = header('CLIENT RECORDS', 'Clients', 'Everyone who has booked, grouped by mobile number. Spend counts completed visits only.',
    `<input id="q" placeholder="Search name, mobile or email…" class="${INPUT} !w-64"/><select id="sort" class="${INPUT} !w-auto"><option value="recent">Most recent visit</option><option value="spend">Highest spend</option><option value="visits">Most visits</option><option value="name">Name A–Z</option></select>`)
    + '<section id="kpis" class="grid grid-cols-1 sm:grid-cols-3 gap-5"></section><div id="list"></div>';

  async function load() {
    try {
      const d = await api('/clients?' + new URLSearchParams(S));
      
      document.getElementById('kpis').innerHTML = 
        kpi('CLIENTS', d.stats.total, 'Unique mobile numbers', 'groups') + 
        kpi('RETURNING CLIENTS', d.stats.returning, '2 or more bookings', 'repeat') + 
        kpi('WITH AN ACCOUNT', d.stats.accounts, 'Registered on the website', 'how_to_reg');
        
      document.getElementById('list').innerHTML = card(`
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead>
              <tr class="text-label-md text-on-surface-variant border-b border-outline-variant/30">
                <th class="py-3 pr-4">Client</th>
                <th class="pr-4">Mobile</th>
                <th class="pr-4 text-center">Bookings</th>
                <th class="pr-4 text-center">Completed</th>
                <th class="pr-4 text-right">Lifetime spend</th>
                <th class="pr-4">Last visit</th>
                <th class="pr-4">Next appointment</th>
                <th></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-outline-variant/20">
              ${d.items.map((c) => `
                <tr class="hover:bg-surface-container-low/40">
                  <td class="py-4 pr-4">
                    <div class="flex items-center gap-3">
                      <span class="w-9 h-9 rounded-full bg-surface-container-high text-primary flex items-center justify-center text-xs font-bold shrink-0">${TR.initials(c.name)}</span>
                      <div>
                        <p class="font-title-md text-on-surface">${esc(c.name)} ${c.hasAccount ? '<span class="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">ACCOUNT</span>' : ''}</p>
                        <p class="text-xs text-on-surface-variant">${esc(c.email || 'no email')}</p>
                      </div>
                    </div>
                  </td>
                  <td class="pr-4 whitespace-nowrap font-mono">${esc(TR.phone(c._id))}</td>
                  <td class="pr-4 text-center">${c.bookings}</td>
                  <td class="pr-4 text-center">${c.completed}</td>
                  <td class="pr-4 text-right font-bold text-primary whitespace-nowrap">${peso(c.spend)}</td>
                  <td class="pr-4 whitespace-nowrap">${c.last ? TR.fmtDate(c.last) : '—'}</td>
                  <td class="pr-4 whitespace-nowrap">${c.next ? `<b class="text-primary">${TR.fmtDate(c.next)}</b>` : '—'}</td>
                  <td class="text-right"><button data-v="${esc(c._id)}" class="px-3 py-1 rounded-full text-primary text-xs font-semibold hover:bg-surface-container">View</button></td>
                </tr>
              `).join('') || '<tr><td colspan="8" class="py-12 text-center text-on-surface-variant">No clients found.</td></tr>'}
            </tbody>
          </table>
        </div>
        <div class="mt-4 flex items-center justify-between text-xs text-on-surface-variant">
          <span>Page ${d.page} of ${d.pages}</span>
          <div class="flex gap-2">
            <button id="prev" class="${BTN2} !py-1.5 text-xs" ${d.page <= 1 ? 'disabled' : ''}>Previous</button>
            <button id="next" class="${BTN2} !py-1.5 text-xs" ${d.page >= d.pages ? 'disabled' : ''}>Next</button>
          </div>
        </div>
      `);
      
      document.getElementById('prev').onclick = () => { S.page--; load(); };
      document.getElementById('next').onclick = () => { S.page++; load(); };
      document.querySelectorAll('[data-v]').forEach((b) => (b.onclick = () => view(b.dataset.v)));
      
    } catch (e) {
      document.getElementById('list').innerHTML = `
        <div class="p-8 text-center bg-error-container text-on-error-container rounded-2xl border border-error/20">
          <span class="material-symbols-outlined text-4xl mb-2">database_off</span>
          <h3 class="font-title-lg font-bold">Error loading clients</h3>
          <p class="text-sm mt-1">${e.message}</p>
        </div>
      `;
    }
  }

  async function view(phone) {
    let c; try { c = await api('/clients/' + encodeURIComponent(phone)); } catch (e) { return TR.toast(e.message, true); }
    const m = TR.modal(`
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-xs text-outline uppercase tracking-wider">Client</p>
          <h2 class="font-headline-md text-primary font-semibold text-2xl">${esc(c.name)}</h2>
          <p class="text-xs text-on-surface-variant mt-1">${c.visits} completed visit${c.visits === 1 ? '' : 's'} · lifetime spend ${peso(c.spend)} · ${c.hasAccount ? 'has a website account' : 'guest (no account)'}</p>
        </div>
        <button data-close class="w-9 h-9 rounded-full hover:bg-surface-container text-outline"><span class="material-symbols-outlined">close</span></button>
      </div>
      <div class="mt-4 flex flex-wrap gap-2 text-sm">
        <a class="${BTN2} !py-1.5 text-xs" href="tel:${esc(c.phone)}">Call ${esc(TR.phone(c.phone))}</a>
        <a class="${BTN2} !py-1.5 text-xs" href="viber://chat?number=${encodeURIComponent(c.phone)}">Viber</a>
        ${c.email ? `<a class="${BTN2} !py-1.5 text-xs" href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ''}
      </div>
      <h3 class="mt-6 mb-2 font-title-md text-primary">Booking history</h3>
      <ul class="space-y-2">
        ${c.bookings.map((b) => `
          <li class="p-3 rounded-xl bg-surface-container-low/70 flex items-center justify-between gap-3 text-sm">
            <div class="min-w-0">
              <a class="font-semibold text-primary underline" href="/admin/bookings/${b._id}">${esc(b.serviceName)}</a>
              <p class="text-xs text-on-surface-variant">${TR.fmtDate(b.date)} · ${TR.fmtTime(b.startTime)} · ${esc(b.specialistName)} · #${esc(b.ref)}</p>
              ${b.notes ? `<p class="text-xs text-amber-800 mt-1">Note: ${esc(b.notes)}</p>` : ''}
            </div>
            <div class="text-right shrink-0">
              <b>${peso(b.totalAmount)}</b>
              <div class="mt-1">${TR.statusPill(b.status)}</div>
            </div>
          </li>
        `).join('')}
      </ul>
    `, true);
  }

  let t;
  document.getElementById('q').oninput = (e) => { 
    clearTimeout(t); 
    t = setTimeout(() => { S.q = e.target.value.trim(); S.page = 1; load(); }, 300); 
  };
  document.getElementById('sort').onchange = (e) => { S.sort = e.target.value; S.page = 1; load(); };
  
  const fail = (e) => e.message !== 'Signed out' && TR.toast(e.message, true);
  window.TR_refresh = () => load().catch(fail);
  
  load().catch(fail);
})();