// Philippine Time helpers (UTC+8 all year)
const PHT_OFFSET_MS = 8 * 60 * 60 * 1000;
const pad = (n) => String(n).padStart(2, '0');

const phtNow = () => new Date(Date.now() + PHT_OFFSET_MS);               // read with getUTC* methods
const todayISO = () => phtNow().toISOString().slice(0, 10);
const addDaysISO = (iso, d) => new Date(Date.parse(iso + 'T00:00:00Z') + d * 864e5).toISOString().slice(0, 10);
const isISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));
const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const toHHMM = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
const label12 = (hhmm) => { const m = toMin(hhmm), h = Math.floor(m / 60); return `${h % 12 || 12}:${pad(m % 60)} ${h < 12 ? 'AM' : 'PM'}`; };
// "2025-10-25" + "14:30" (PHT)  ->  real instant
const toInstant = (iso, hhmm) => new Date(Date.parse(`${iso}T${hhmm}:00+08:00`));

module.exports = { phtNow, todayISO, addDaysISO, isISODate, toMin, toHHMM, label12, toInstant, pad };
