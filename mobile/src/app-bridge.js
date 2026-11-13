/*
 * App bridge — loaded first on every page inside the mobile app.
 *
 * The website's pages call relative URLs like fetch('/api/services') and rely on cookies.
 * Inside the app the pages are served from the phone (capacitor://localhost or https://localhost),
 * so this script:
 *   1. sends every '/api/...' request to the real backend (API_BASE),
 *   2. logs customers in with a Bearer token (stored on the device) instead of cookies,
 *   3. keeps staff out: admin accounts sign in on the website, not in the app.
 */
(function () {
  var API_BASE = '__API_BASE__';
  var KEY = 'tr_token';
  var nativeFetch = window.fetch.bind(window);

  function prefs() {
    try { return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences; } catch (e) { return null; }
  }
  function getToken() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function setToken(t) {
    try { if (t) localStorage.setItem(KEY, t); else localStorage.removeItem(KEY); } catch (e) {}
    try { var p = prefs(); if (p) { if (t) p.set({ key: KEY, value: t }); else p.remove({ key: KEY }); } } catch (e) {}
  }

  // Native storage survives better than the webview's localStorage; restore from it if localStorage was cleared.
  var ready = (async function () {
    try {
      if (getToken()) return;
      var p = prefs();
      if (p) { var r = await p.get({ key: KEY }); if (r && r.value) localStorage.setItem(KEY, r.value); }
    } catch (e) {}
  })();

  function json(body, status) {
    return new Response(JSON.stringify(body), { status: status || 200, headers: { 'Content-Type': 'application/json' } });
  }

  window.fetch = async function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.indexOf('/api/') !== 0) return nativeFetch(input, init);   // anything else (images, external) is untouched
    await ready;

    var path = url.split('?')[0];
    if (path === '/api/auth/logout') { setToken(null); return json({ ok: true }); }

    init = Object.assign({}, init);
    var headers = new Headers(init.headers || {});
    headers.set('X-Client', 'app');
    var token = getToken();
    if (token) headers.set('Authorization', 'Bearer ' + token);
    init.headers = headers;
    init.credentials = 'omit';

    var res;
    try { res = await nativeFetch(API_BASE + url, init); }
    catch (e) { throw new TypeError('Can’t reach the salon server. Please check your internet connection and try again.'); }

    if (path === '/api/auth/login' || path === '/api/auth/register') {
      var d = await res.clone().json().catch(function () { return null; });
      if (res.ok && d && d.role === 'customer' && d.token) {
        setToken(d.token);
        delete d.token;
        d.redirect = '/my-account.html';
        return json(d, res.status);
      }
      if (res.ok && d && d.role === 'admin') {
        return json({ error: 'Staff accounts sign in on the website admin portal, not in the app.' }, 403);
      }
    }
    if (res.status === 401 && path.indexOf('/api/auth/my/') === 0) setToken(null);   // expired/invalid token
    return res;
  };
})();
