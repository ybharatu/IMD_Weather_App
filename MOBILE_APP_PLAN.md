# IMD Weather — Mobile App Plan

Port the existing IMD weather web app to iOS + Android using **Capacitor**, with a
hosted Render backend and push notifications.

**Locked-in decisions**
- Wrapper: **Capacitor** (reuses the existing HTML/CSS/JS UI)
- Distribution: personal — just the developer, family & friends
- Hosting: **Render** (Node/Express, HTTPS)
- Push notifications: **warning alerts + daily 7-day forecast summary**
- Subscriptions: **one city per user**
- Storage: **embedded SQLite** (`better-sqlite3`) — free, no external service
- Build machine: **Mac + Xcode** available

---

## Prerequisites

- Upgrade local **Node to 18/20/22 LTS** (Capacitor + current tooling require ≥18;
  Render uses a modern Node anyway). Add an `engines` field to `package.json`.
- **Apple Developer account** ($99/yr) — required to get iOS builds onto
  family/friends' iPhones via TestFlight. Android side-loading needs no store account.

## Cost summary

| Item | Cost |
| ---- | ---- |
| SQLite (better-sqlite3) | **Free** (public domain, embedded) |
| Render web service (free tier) | Free (750 hrs/mo, sleeps after 15 min inactivity) |
| Apple Developer | $99/yr (TestFlight for iOS) |
| Google Play | $0 if side-loading APKs (only for family/friends) |

---

## Phase A — Backend: hostable + CORS + configurable API

**Files:** `server.js`, `package.json`, `.env`

1. Add `cors` middleware — allow app origins
   (`capacitor://localhost`, `https://localhost`, and the Render URL) and `helmet`.
2. Make the API base URL and CORS origin come from env vars
   (`API_BASE`, `CORS_ORIGIN`) so one codebase serves web + mobile.
3. Bind to `0.0.0.0` and honor `process.env.PORT` (Render requirement).
4. Add a `render.yaml` and production start script; set env vars in the Render dashboard.

## Phase B — Capacitor wrapper (reuses existing UI)

**Files:** `capacitor.config.ts`, restructured `assets/`, new `config.js`,
`assets/js/imd_weather.js`, CSS

1. `npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android`
2. `npx cap init` → `appId: com.<you>.imdweather`, `appName: "IMD Weather"`
3. Move `assets/views/index.html` → `assets/index.html` so `webDir: "assets"` has
   `index.html` at the root. Absolute `/css/...` and `/js/...` links keep working.
   Update the server `/` route's `sendFile` path.
4. Add `config.js` holding the Render API URL; switch `imd_weather.js` fetches from
   `/api/weather/...` to `API_BASE + '/api/weather/...'`.
5. iOS safe-area handling via `env(safe-area-inset-*)` in CSS (notch / home indicator).
6. Generate app icons + splash screens (Capacitor assets).

## Phase C — Build & run locally

1. `npx cap sync`
2. `npx cap open ios` → run in Xcode iOS Simulator
3. `npx cap open android` → run in Android Studio emulator
4. Verify both against the Render-hosted API.

## Phase D — Storage (subscriptions)

Subscription row: `{ device_token PK, city, created_at }`.

- Use **embedded SQLite** via `better-sqlite3` (free, zero external infra).
- Note: Render free-tier filesystem is ephemeral and resets on redeploy. This is
  acceptable because subscriptions **self-heal** — each app re-registers its token on
  launch (worst case: everyone re-pairs after a redeploy).
- Durable alternative (optional): a permanent free Postgres on **Neon** or **Supabase**
  (avoid Render free Postgres — it is deleted after 30 days).

## Phase E — Push notifications

**New files:** `lib/pushService.js`, `lib/alertScheduler.js`, `lib/store.js`;
new server endpoints.

1. **Client** — `@capacitor/push-notifications`:
   - Request permission on first open, obtain device token.
   - `POST /api/push/register {token, city}`; persist chosen city via
     `@capacitor/preferences`; add a small "set your city" screen.
   - `POST /api/push/unregister` on token change.
2. **Android** — Firebase project + `google-services.json`, wired into the Android project (FCM).
3. **iOS** — APNs key + Push Notifications entitlement in Xcode.
4. **Server** — `firebase-admin` sends via FCM (covers Android + iOS-via-APNs):
   - `node-cron` job runs daily.
   - Re-scrape subscribed cities' IMD forecasts (reuse existing scraper).
   - If a **new warning** appears (compare severity/color vs last-sent state) → push alert.
   - Send a **daily 7-day summary** push (min/max + condition + warnings) — the README's
     "daily email" idea delivered as a push.
   - Keep in-memory + DB "last sent" cache to avoid duplicate pushes.

## Phase F — Distribute to family/friends

- **Android:** build a signed release APK in Android Studio → side-load
  (enable "install unknown apps").
- **iOS:** connect **TestFlight** (needs $99 Apple account) → invite family/friends as
  external testers (up to ~100). Optional: **Firebase App Distribution** for both platforms.

---

## Suggested build order

The app works end-to-end after Phases **A–C** (search + weather display on a phone),
so you can ship a working app early and add notifications (Phase E) afterwards:

1. Phase A — hostable backend
2. Phase B — Capacitor wrapper
3. Phase C — local simulator/emulator builds
4. Phase D — storage layer
5. Phase E — push notifications
6. Phase F — distribution