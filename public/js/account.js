/* Makes the header's account icon open Sign in / Create account (or My account / Admin when signed in) */
(async function () {
  const icons = [...document.querySelectorAll('span.material-symbols-outlined')].filter((s) => s.textContent.trim() === 'account_circle');
  let me = { role: null };
  try { me = await (await fetch('/api/auth/me')).json(); } catch {}
  const dest = me.role === 'admin' ? '/admin' : me.role === 'customer' ? '/my-account' : '/login';
  const title = me.role ? `My account (${me.name})` : 'Sign in / Create account';
  icons.forEach((s) => {
    const el = s.closest('a,button'); if (!el) return;
    el.classList.remove('hidden'); el.classList.add('flex');            // some pages hide it on small screens
    el.title = title; el.setAttribute('aria-label', title);
    if (el.tagName === 'A') el.href = dest; else el.onclick = () => (location.href = dest);
    if (me.role) { el.style.position = 'relative'; el.insertAdjacentHTML('beforeend', '<span style="position:absolute;top:6px;right:6px;width:9px;height:9px;border-radius:50%;background:#2e9e6b;border:2px solid #fff"></span>'); }
  });
})();