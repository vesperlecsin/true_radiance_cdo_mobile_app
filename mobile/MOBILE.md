# True Radiance — Mobile App (Android & iOS)

The app is your existing website's **customer pages** packaged with [Capacitor](https://capacitorjs.com).
Guests can browse services, book, sign in, see **My Account**, and manage/cancel bookings.
Staff keep using the **web admin portal** (the app deliberately refuses admin sign-in).

```
Phone app (pages stored on the phone) ──HTTPS──►  Your hosted Express API ──► MongoDB Atlas
```

## What changed in your project
| File | Change |
|---|---|
| `middleware/auth.js` | Customers can also authenticate with an `Authorization: Bearer` token (the app uses this instead of cookies). Admins stay cookie-only. |
| `routes/auth.js` | Login/register return a token **only** when the request has `X-Client: app`. The website is unaffected. |
| `server.js` | CORS for the app origins (`capacitor://localhost`, `https://localhost`). Add more with `CORS_ORIGINS` in `.env` if ever needed. |
| `mobile/` (new) | The Capacitor project. The website in `public/` is **not modified**. |

---

## Step 1 — Put the backend online (required)
A phone cannot reach `localhost:3000` on your computer, so the API must be hosted.
Follow **"Going live (example: Render.com)"** in the main `README.md`, then note your address, e.g. `https://true-radiance.onrender.com`.

- Set `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET` and the admin values as environment variables.
- Atlas → Network Access must allow `0.0.0.0/0`.
- Render's free plan **sleeps** after inactivity, so the first request can take ~30–60 s. Use a paid plan before launch.

## Step 2 — Point the app at it
Edit `mobile/app.config.json`:
```json
{
  "appName": "True Radiance",
  "appId": "ph.trueradiance.app",
  "apiBase": "https://true-radiance.onrender.com"
}
```
`appId` is the app's permanent store identity. Change it now if you want something else; it can't be changed after publishing.

## Step 3 — Build
You need **Node 22+**. Then:
```bash
cd mobile
npm install
npm run android      # builds the pages, syncs, opens Android Studio  → press ▶ Run
npm run ios          # Mac only: opens Xcode                          → press ▶ Run
```
The `android/` and `ios/` folders are already generated. Run `npm run sync` after any change to `../public` or `app.config.json`.

- **Android:** install [Android Studio](https://developer.android.com/studio). To publish: *Build → Generate Signed Bundle/APK* and upload the `.aab` to Google Play (one-time US$25 developer fee).
- **iOS:** needs a Mac with Xcode and an Apple Developer account (US$99/year).

## Testing before you host (optional)
Run the backend locally (`npm start` in the project folder) and use your computer's address:
```bash
# Android emulator reaches your computer at 10.0.2.2
API_BASE=http://10.0.2.2:3000 DEV_CLEARTEXT=1 npm run sync
# real phone on the same Wi-Fi: use your PC's IP, e.g. http://192.168.1.20:3000
```
`DEV_CLEARTEXT=1` allows plain `http` for testing only. **Never** use it for a release build.

## How it works (if you need to change things)
- `scripts/build-web.js` copies the customer pages into `www/`, turns the Tailwind CDN into compiled CSS (so no CDN is needed), and changes links like `/book` to `/book.html`.
- `src/app-bridge.js` runs first on every page. It sends `/api/...` calls to `apiBase`, stores the login token on the device, and shows a friendly message if the server can't be reached.

## Known limits
- **Needs internet.** Pages are on the phone, but all data comes from your server, and the Google Fonts/icons and photo URLs your designs use are loaded online.
- **Missing pages (already missing on the website):** `/forgot-password`, `/terms`, `/privacy` are linked from the sign-in page. Create them before submitting to the stores. Apple and Google require a privacy policy.
- **Default icon and splash screen.** Use `@capacitor/assets` with your logo to generate proper ones.
- **App Store review:** Apple can reject apps that feel like a plain website. Native touches (push notifications, e.g. booking reminders) help.
- **Not yet tested on a device or emulator.** The server changes and the app bridge are tested against the real server code, and the native projects generate and sync cleanly, but I couldn't run an emulator here. Do one full booking test on a phone first.
- Payments are still recorded, not processed, exactly as on the website.
