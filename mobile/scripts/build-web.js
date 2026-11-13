#!/usr/bin/env node
/*
 * Builds mobile/www/ — the web files that get packaged inside the Android/iOS app.
 *
 *   ../public/*.html (customer pages only)  ->  www/*.html
 *   Tailwind CDN + inline config            ->  compiled CSS in www/css/ (no CDN needed at runtime)
 *   /book, /login ... links                 ->  /book.html, /login.html ... (the app serves plain files)
 *   src/app-bridge.js                       ->  www/js/app-bridge.js (API base URL + token login)
 *
 * API base URL: env API_BASE wins, otherwise app.config.json.
 * The website in ../public is never modified.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.resolve(ROOT, '..', 'public');
const WWW = path.join(ROOT, 'www');
const TMP = path.join(ROOT, '.tmp');

const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.config.json'), 'utf8'));
const API_BASE = String(process.env.API_BASE || cfg.apiBase || '').replace(/\/+$/, '');
if (!/^https?:\/\/[^\s/]+/.test(API_BASE)) { console.error('apiBase must be a full URL like https://your-app.onrender.com (set it in app.config.json or API_BASE).'); process.exit(1); }
if (/YOUR-BACKEND-URL/.test(API_BASE)) console.warn('\n!! apiBase is still the placeholder. The app will build, but it cannot reach any server until you set it in mobile/app.config.json.\n');

// Customer-facing pages only. The admin portal stays on the website.
const PAGES = ['index', 'services', 'packages', 'about', 'reviews', 'contact', 'book', 'login', 'manage', 'my-account'];
const CUSTOMER_JS = ['account.js', 'book.js'];
const ROUTES = ['about', 'book', 'contact', 'login', 'manage', 'my-account', 'packages', 'reviews', 'services'];

const rm = (p) => fs.rmSync(p, { recursive: true, force: true });
const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };

// "/book" -> "/book.html", "/" (as an href) -> "/index.html". API paths (/api/...) are never touched.
const routeRe = new RegExp('(["\'`=(])/(' + ROUTES.join('|') + ')(?=[?#"\'`)\\s])', 'g');
const homeRe = /(href\s*=\s*["'])\/(["'])/g;
function rewriteRoutes(s) { return s.replace(routeRe, '$1/$2.html').replace(homeRe, '$1/index.html$2'); }

rm(WWW); rm(TMP);
fs.mkdirSync(WWW, { recursive: true }); fs.mkdirSync(TMP, { recursive: true });

// static assets
fs.cpSync(path.join(PUBLIC, 'images'), path.join(WWW, 'images'), { recursive: true });
for (const f of CUSTOMER_JS) write(path.join(WWW, 'js', f), rewriteRoutes(read(path.join(PUBLIC, 'js', f))));
write(path.join(WWW, 'js', 'app-bridge.js'), read(path.join(ROOT, 'src', 'app-bridge.js')).replace('__API_BASE__', API_BASE));

const tailwindCli = require.resolve('tailwindcss/lib/cli.js');
write(path.join(TMP, 'input.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
const jsContent = CUSTOMER_JS.map((f) => path.join(PUBLIC, 'js', f));

for (const page of PAGES) {
  const src = path.join(PUBLIC, page + '.html');
  let html = read(src);

  const cfgRe = /<script id="tailwind-config">([\s\S]*?)<\/script>/;
  const cdnRe = /<script src="https:\/\/cdn\.tailwindcss\.com[^"]*"><\/script>/;
  const m = html.match(cfgRe);
  if (m) {
    const holder = {};
    new Function('tailwind', m[1])(holder);               // the config is plain data: tailwind.config = { ... }
    if (!holder.config) throw new Error(page + ': could not read the Tailwind config');
    const cfgFile = path.join(TMP, `tailwind.${page}.config.js`);
    write(cfgFile, `module.exports = Object.assign(${JSON.stringify(holder.config)}, {
      content: ${JSON.stringify([src, ...jsContent])},
      plugins: [require('@tailwindcss/forms'), require('@tailwindcss/container-queries')]
    });`);
    const out = path.join(WWW, 'css', page + '.css');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    execFileSync(process.execPath, [tailwindCli, '-c', cfgFile, '-i', path.join(TMP, 'input.css'), '-o', out, '--minify'], { stdio: ['ignore', 'ignore', 'pipe'] });
    html = html.replace(cfgRe, '').replace(cdnRe, `<link rel="stylesheet" href="/css/${page}.css">`);
    console.log(`  ${page}.html  tailwind -> css/${page}.css (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
  } else {
    console.log(`  ${page}.html  (no tailwind)`);
  }

  html = html.replace(/<head[^>]*>/i, (h) => h + '\n<script src="/js/app-bridge.js"></script>');
  write(path.join(WWW, page + '.html'), rewriteRoutes(html));
}
rm(TMP);

// ---- self-check: every internal href/src must point at a file that exists in www/ ----
let problems = 0;
for (const page of PAGES) {
  const html = read(path.join(WWW, page + '.html'));
  if (/cdn\.tailwindcss\.com/.test(html)) { console.error(`!! ${page}.html still loads the Tailwind CDN`); problems++; }
  for (const m of html.matchAll(/(?:href|src)=["'](\/[^"'#?]*)/g)) {
    const p = m[1];
    if (p.startsWith('//')) continue;
    if (!fs.existsSync(path.join(WWW, p))) { console.warn(`!! ${page}.html links to ${p}, which does not exist in the app (also missing on the website).`); problems++; }
  }
}
console.log(`\nBuilt ${PAGES.length} pages into mobile/www  ·  API: ${API_BASE}` + (problems ? `  ·  ${problems} warning(s) above` : ''));
