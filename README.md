# New Attendance Monitoring (Application + Website)

This project is a clean attendance system with:

- Employee app: `/employee`
- Admin website: `/admin`
- Register only (no login)
- No photo capture
- No GPS/location capture
- Office-based admin view (example: ICT office)
- Per employee visibility of time in/time out and submitted reports
- Admin date filter (`From` and `To`) for attendance and reports
- Printable office report from admin website
- Late/On-Time status with late minutes and worked hours
- Monthly office export (`CSV` and `PDF`)
- Monthly auto-backup per office/month
- **Android APK wrapper (Capacitor) for employee app**
- **iOS App wrapper (Capacitor) for employee app**

## Run

1. Open terminal in this folder:
   - `c:\\Users\\Asus\\Desktop\\new application`
2. Install dependencies:
   - `npm install`
3. Start server:
   - `npm start`
4. Open:
   - Admin website: `http://localhost:5173/admin/`
   - Employee app: `http://localhost:5173/employee/`

## Admin Features

- Click office (example: `ICT Unit`) to view only employees of that office.
- Use date range filter for accurate office records.
- Print current office report using **Print Office Report**.
- View computed attendance status:
  - `On Time`
  - `Late`
  - `On Time - Incomplete`
  - `Late - Incomplete`
- Export per office and month:
  - **Export CSV**
  - **Export PDF**
- Run **Auto Backup Monthly** to store CSV/PDF/JSON backup files.

### Official Office List

- Office of the SDS
- Office of the ASDS
- Legal Unit
- ICT Unit
- Administrative Unit
- Personnel Section
- Supply Section
- Cash Section
- Records Section
- Procurement Section
- Curriculum Implementation Division
- School Governance and Operations Division
- Finance Unit (displayed in admin list, not selectable in register)
- Accounting Section (under Finance Unit for registration)
- Budget Section (under Finance Unit for registration)

## Employee App Features

- Register employee account.
- Record Time In and Time Out.
- Submit daily report.
- Configure API server URL in **Server Connection** (important for APK/iOS use).

## Data Storage

All records are stored in:

- `data/db.json`
- Automatic export backups:
  - `data/backups/<office>/<YYYY-MM>/...`

## Accuracy Rule For Late/On-Time

- Default cutoff for on-time is `08:00:59` (Asia/Manila server time).
- Configure cutoff via environment variable:
  - `ON_TIME_CUTOFF=08:00:59`

## Core Flow

1. Employee opens `/employee/` and registers.
2. Employee records Time In and Time Out.
3. Employee submits daily report.
4. Admin opens `/admin/`, clicks office (like ICT), and sees employees of that office with attendance + reports.

## Deploy To Hostinger (Node.js)

Use this setup so both web (`/admin`, `/employee`) and API (`/api/*`) run in one Hostinger app.

1. Push this project to GitHub.
2. In Hostinger hPanel, create/connect a **Node.js application** to this repo.
3. Set startup command/file:
   - `npm start`
   - entry file: `index.js`
4. Set environment variables in Hostinger:
   - `DB_MODE=json`
   - `DB_PATH=../persistent-data/db.json`
   - `DB_MIRROR_PATH=../persistent-data/db-mirror.json`
   - `ALLOW_SEED=false`
   - `BREVO_API_KEY=<your-brevo-api-key>`
   - `BREVO_FROM=<verified-sender@yourdomain.com>`
   - `BREVO_FROM_NAME=SDO Marinduque Attendance`
   - `OTP_EMAIL_REQUIRED=true`
   - `ALLOW_DEV_OTP_FALLBACK=false`
   - Optional performance tuning:
   - `REQUEST_TIMEOUT_MS=25000`
   - `MAX_INFLIGHT_REQUESTS=200`
   - `EXTERNAL_FETCH_TIMEOUT_MS=4500`
5. Ensure Node version is `18+`.
6. Restart the Node app after saving env vars.

Important:
- Use `../persistent-data/...` (with `../`), not `./persistent-data/...`.
- `./persistent-data` can point inside deploy files and may be reset on redeploy.
- For higher concurrency (many simultaneous users), prefer `DB_MODE=postgres` with a managed PostgreSQL database.

### Hostinger Persistence Notes

- Server now auto-detects Hostinger-like runtime and defaults to persistent storage path.
- Health check endpoint:
  - `https://your-domain.com/api/db-health`
- Verify these fields:
  - `dataPath` points to `../persistent-data/...`
  - `counts.attendance` and `counts.reports` persist after restart/redeploy

## Android APK Setup

1. Install dependencies:
   - `npm install`
2. Add/sync Android project:
   - `npm run cap:add:android`
   - `npm run cap:sync:android`
3. Open Android Studio:
   - `npm run cap:open:android`
4. In the app, set **Server Base URL** to your running server:
   - Android emulator: `http://10.0.2.2:5173`
   - Example: `http://192.168.1.26:5173`
5. Build APK from Android Studio:
   - `Build > Build Bundle(s) / APK(s) > Build APK(s)`
6. Debug APK output path:
   - `android/app/build/outputs/apk/debug/app-debug.apk`

### Auto-update design for Android/iPhone

- Capacitor is configured to load the hosted employee page directly:
  - `https://wfh.depedmarinduque.com/employee/`
- This means any design/UI changes you push and deploy to Hostinger are reflected automatically in both Android and iPhone apps (no rebuild needed for UI-only changes).
- You only need to rebuild app binaries when changing native plugins, app permissions, icons/splash, or app store metadata.

## iOS App Setup (iPhone)

**Requires Mac with Xcode 15+ installed.**

1. Install dependencies:
   - `npm install`
2. Add/sync iOS project:
   - `npm run cap:add:ios` (if not already)
   - `npm run cap:sync:ios`
3. Open Xcode:
   - `npm run cap:open:ios`
4. In Xcode:
   - Select device/simulator
   - Build/Run (Cmd+R)
   - For App Store: Product > Archive > Distribute App
5. In the app, set **Server Base URL** to your server IP (e.g. `http://192.168.1.26:5173`).

Now the app works on both **Android** and **iPhone** via Capacitor (same employee/ web code wrapped natively)!
