# True Radiance Beauty Salon & Spa — Booking System

Guests book on the website (your 5-step wizard). Every booking is saved in **MongoDB Atlas**.
Staff sign in to the **Admin Portal** and see who booked, when, with whom, and what they owe.

```
Guest browser ──► Express API ──► MongoDB Atlas
 /book              /api/*          services · specialists · bookings
Admin browser ──► /api/admin/* ──►  slotlocks · admins · counters
 /admin
```

---

## Step 1 — Install the tools
1. Install **Node.js 18+** from https://nodejs.org (check: `node -v`).
2. Unzip this project and open a terminal inside the folder.

## Step 2 — Create your MongoDB Atlas database (free)
1. Sign up at https://www.mongodb.com/cloud/atlas/register.
2. **Create a cluster** → choose **M0 (Free)**. Provider AWS, region **Singapore (ap-southeast-1)** is closest to Cagayan de Oro.
3. **Database Access** (left menu) → *Add New Database User* → username + a strong password (letters/numbers only avoids URL-encoding problems) → role **Read and write to any database**.
4. **Network Access** → *Add IP Address*:
   - For local testing: *Add Current IP Address*.
   - For hosting (Render, Railway…): you'll need `0.0.0.0/0` (allow from anywhere); the DB user password is then your protection, so keep it strong.
5. **Database** → *Connect* → *Drivers* → copy the connection string. It looks like  
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
6. Insert the database name `true_radiance` before the `?`:  
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/true_radiance?retryWrites=true&w=majority`

## Step 3 — Configure the project
```bash
npm install
cp .env.example .env        # Windows: copy .env.example .env
```
Open `.env` and set:
- `MONGODB_URI` – the string from Step 2 (with your real password).
- `JWT_SECRET` – run `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` and paste the result.
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_NAME` – your first admin login. **Use a real password.**

## Step 4 — Load the starter data
```bash
npm run seed
```
Creates the 10 services, 4 specialists (Elena, Maria, Grace, Camille) and your admin account.  
Safe to re-run — it updates rather than duplicates. Edit `seed/seed.js` to change prices or add services.

## Step 5 — Run it
```bash
npm start          # or: npm run dev   (auto-restarts on changes)
```
| URL | What |
|---|---|
| http://localhost:3000/ | Home page (all your designs: /services /packages /about /reviews /contact) |
| http://localhost:3000/book | Guest booking wizard |
| http://localhost:3000/admin | Admin dashboard (redirects to `/admin-login`) |

## Step 6 — Test the full flow
1. Open `/book`, pick a service → specialist → date/time → enter details → **Confirm**.
2. In Atlas: **Database → Browse Collections → true_radiance → bookings**. Your booking is there.
3. Open `/admin-login`, sign in. The booking appears; click **View** to see the guest's mobile, email, notes/allergies.
4. Try to book the **same specialist and time** again → that slot is now shown as *(Booked)*.
5. In the admin, set Payment to **Deposit Paid** → the booking auto-changes to **Confirmed**.
   Set status to **Cancelled** → the slot is freed for other guests.

---

## How it works

**Collections**
| Collection | Purpose |
|---|---|
| `services` | Name, category, duration, price (₱) |
| `specialists` | Staff + which service categories they can perform |
| `bookings` | Guest details, service/specialist/time, payment + booking status (snapshots of price/name are stored, so history never changes) |
| `slotlocks` | One record per 15-minute block per specialist, with a **unique index** |
| `admins` | Staff logins (bcrypt-hashed passwords) |
| `counters` | Generates `TR-8801, TR-8802…` references |

**No double-booking.** Before saving, the server inserts a lock for every 15-min block of the appointment. If another guest got there first, the unique index rejects it, partial locks are rolled back, and the guest sees "that time was just taken". With **Any Available Specialist**, the server tries each eligible specialist until one is free.

**Booking rules** (`.env`): hours 9 AM–9 PM PHT, start times every 30 min, ≥2 hours' notice, up to 60 days ahead, 20% deposit.

**Security**: phone/email/name validated server-side; PH mobile normalised to `+639XXXXXXXXX`; booking endpoint rate-limited (10/hour/IP); admin uses an httpOnly cookie (8h) with rate-limited login; the admin page is served only after login; CSV export is protected against spreadsheet formula injection.

## Project layout
```
server.js              app entry
config/                db connection + booking rules
models/                Service, Specialist, Booking, SlotLock, Counter, Admin
utils/bookingEngine.js availability + race-safe booking creation
routes/public.js       /api/services, /specialists, /availability, /bookings
routes/admin.js        login, bookings list/filter/CSV, stats, status updates
public/                your designs + js/book.js, js/admin.js, admin-login.html
views/admin.html       dashboard (only served to signed-in staff)
seed/seed.js           starter data
```

## Going live (example: Render.com)
1. Push the project to GitHub (`.env` is git-ignored — never commit it).
2. Render → *New Web Service* → connect repo. Build: `npm install`, Start: `npm start`.
3. Add the `.env` values as **Environment Variables**, plus `NODE_ENV=production`.
4. In Atlas *Network Access*, allow `0.0.0.0/0`.
5. Run `npm run seed` once (Render Shell, or locally pointing at the same Atlas DB).
6. Use HTTPS (Render provides it). Admin cookies are `secure` in production.

## Honest limits & next steps
- **Payments are recorded, not processed.** The guest chooses GCash/Maya/etc. and the booking is saved as *Pending / Awaiting deposit*; staff verify the payment and mark it in the admin. To charge online, integrate **PayMongo** (GCash, Maya, cards) and set `paymentStatus` from its webhook.
- **No automatic SMS/Viber/email reminders yet.** Add a nightly job (e.g. node-cron + Semaphore/Twilio/Resend) using `startAt`.
- **Unpaid pending bookings hold a slot** until staff cancel them. A simple auto-release after a few hours is an easy addition.
- Not wired yet: *New Walk-in* button (the engine supports it: `createBooking(data, { source: 'walk-in' })`), Calendar View toggle, the Contact-page form, and the "Book Package" buttons on the Packages page.
- Tailwind runs from the CDN as in your exported designs. Before launch, build it locally for speed, then turn on a strict Content-Security-Policy in `server.js`.
- This project was assembled without access to npm/Atlas in my environment, so I could only syntax-check it. Run Step 6 once and tell me if anything misbehaves.

## Troubleshooting
| Message | Fix |
|---|---|
| `bad auth : Authentication failed` | Wrong DB username/password in `MONGODB_URI` (special characters must be URL-encoded). |
| `Could not connect … IP isn't whitelisted` / timeout | Add your current IP in Atlas → Network Access. |
| `ENOTFOUND _mongodb._tcp…` | Typo in cluster host, or your network blocks SRV DNS (try another network). |
| Services list empty on `/book` | You haven't run `npm run seed`. |
| Admin login fails | Re-run `npm run seed` after editing the admin values in `.env`. |
