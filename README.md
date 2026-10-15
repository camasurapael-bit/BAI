# bai Hotel Cebu — Appointment Website

Single-page hotel site (Mandaue, Cebu) with online appointment booking.
Visitors must create an account (Google or email/password) before an appointment can be confirmed.

- Plain HTML/CSS/JS, one file: `index.html` (no build step)
- Login: Firebase Authentication (Google + Email/Password)
- Hosting: Vercel (static)

## Files

| File | Purpose |
|------|---------|
| `index.html` | The whole website. Must be named `index.html` for Vercel. |
| `README.md` | This guide. |

## Run locally

Google sign-in does NOT work from `file://`. Use a local server:

```
py -m http.server 8080 --bind 127.0.0.1
```

Then open http://localhost:8080/

## Firebase setup (project: `bai-hotel-cebu`)

1. Firebase console > Project settings > Your apps > Web app. The config is already pasted in `index.html`, in the `firebaseConfig` object near the bottom.
   - If login says `api-key-not-valid`, re-copy `apiKey` from the console into `firebaseConfig`.
2. Security > Authentication > Sign-in method: enable **Google** (set a public name such as "bai Hotel" and a support email) and **Email/Password**.
3. Authentication > Settings > **Authorized domains**: add every domain the site runs on, without `https://`:
   - `localhost` (already there by default)
   - your Vercel domain, e.g. `bai-hotel-appointment.vercel.app`
   - any custom domain
   Missing domain = `auth/unauthorized-domain` error.

## Deploy to Vercel

1. Create a GitHub repo (e.g. `bai-hotel-appointment`) and upload `index.html` and `README.md` to the repo root.
2. Vercel > Add New > Project > import the repo.
   - Project name must be lowercase: `bai-hotel-appointment`.
   - Framework preset: **Other**. Leave build command and output directory empty.
3. Deploy, then add the resulting domain to Firebase Authorized domains (step 3 above).

## How the booking flow works

- Any "Book Appointment" / "Reserve" button opens the account modal if the visitor is not signed in.
- Pressing **Confirm Appointment** without an account also opens it; after login the appointment is submitted automatically.
- Name and email are pre-filled from the account.

## Account creation and email verification

- Creating an account does NOT log the visitor in. A verification link is emailed, the visitor is signed out, and must open the link and then log in.
- Logging in with an unverified email is refused (a new link is sent). Google sign-in counts as verified. Only the admin account is exempt.
- `firestore.rules` also requires a verified email to create a booking, so republish the rules after updating.
- Optional: Firebase console > Authentication > Templates > Email address verification lets you customise the email text and sender name.

## My Appointment page (guests)

- The site menu has a **My Appointment** button (it replaced "Install App"; hidden for the admin). A logged-out visitor is asked to log in first, then lands on `my-appointments.html`.
- The page lists the guest's own bookings live (Upcoming / Past & closed), shows each booking's QR code, and lets the guest **reschedule**:
  - only Pending or Confirmed bookings, at least **2 hours** before the appointment, up to **2 times**;
  - the new time must be 7:00 AM - 8:00 PM and at least 2 hours from now;
  - a rescheduled booking goes back to **Pending** so the admin re-confirms it; the guest gets an email and the admin sees a notice.
- These limits are constants at the top of `js/my.js` (`CUTOFF_HOURS`, `MAX_RESCHEDULES`). `firestore.rules` also restricts what a guest may change (date, time, status back to pending) - **republish the rules** after updating.

## Receipt QR code and emails

- After **Confirm Appointment** the receipt shows a QR code (it opens `admin.html?ref=BAI-XXXXXX`, so the admin scans it and lands on that booking). **Save receipt** downloads the receipt as a PNG. `js/qr.js` generates the QR in the browser (no internet needed).
- Emails are sent by `api/notify.js` (a Vercel serverless function) through **Brevo**:
  - guest gets a receipt email (with the QR) right after booking;
  - when the admin sets a booking to **Confirmed**, **Cancelled** (declined) or **Completed**, the guest gets an email. The detail window has an optional "Message to guest" that is added to the email. Phone / walk-in bookings with an email are emailed as Confirmed.
- Setup:
  1. Brevo account > SMTP & API > create an **API key**. Brevo > Senders, Domains & IPs > add and verify a **sender email**.
  2. Vercel > Project > Settings > Environment Variables: `BREVO_API_KEY`, `SENDER_EMAIL`, and optionally `SITE_URL` (e.g. `https://baihotel-app.vercel.app`). Redeploy.
  3. Keep the `api/` folder in the repo root next to `index.html`.
- Only the admin session can trigger status emails, and the receipt email always goes to the signed-in guest's own verified address.

## Appointments are saved to Firestore

When a signed-in visitor presses Confirm Appointment, the booking is written to the Firestore collection `appointments` (with their `uid` and a server timestamp) before the confirmation is shown. If saving fails, an error is shown and the form is kept.

Setup:
1. Firebase console > Build > Firestore Database > Create database (production mode, region e.g. `asia-southeast1`).
2. Firestore > Rules tab > paste the contents of `firestore.rules` > Publish.
3. Upload the new `index.html`, `firestore.rules` and `README.md` to GitHub; Vercel redeploys.
4. See bookings in Firebase console > Firestore Database > Data > `appointments`.

## Admin page

`admin.html`. There is no public Admin button on the website. After the admin logs in, a "Dashboard" button appears in the site menu (admin only) so they can go back to the dashboard without logging in again; the dashboard menu has a "Website" button to view the site. Otherwise: the admin signs in with the normal "Log in" form on `index.html` (email + password of `admin@gmail.com`) and is sent to the dashboard automatically. When already signed in, a "Dashboard" link shows in the signed-in bar (visible to the admin only). Anyone else who opens `admin.html` is sent back to the website; sign out returns to the website too. Features: live list of bookings (updates by itself), charts (per day, by service, status, busiest times), stats, search / filters / sorting, status per booking (Pending, Confirmed, Completed, Cancelled), details with internal note, delete, add a phone / walk-in booking, change password, CSV export and print.

1. Firebase console > Authentication > Users > **Add user**: `admin@gmail.com` + password. Do this first, before anyone can sign up with that email on the site.
2. Firestore > Rules > paste the latest `firestore.rules` > Publish (only `admin@gmail.com` can read all, edit or delete; guests can only create and read their own).
3. The admin email is set in `js/admin.js` (`ADMIN_EMAIL`) and in `firestore.rules`. The rules are what really protect the data.
4. Use a strong password (the Password button in the dashboard changes it). The sign-in form is public, so a guessable password exposes every guest's name, phone and email.

## Install as an app (PWA)

`manifest.webmanifest`, `sw.js`, `js/pwa.js`, `favicon.ico` and the `icons/` folder make the site installable (white bai logo on orange). It needs HTTPS, which Vercel provides.
- Android / Chrome / Edge: open the site > "Install App" in the menu (or the browser's install option).
- iPhone: Safari > Share > Add to Home Screen.
After a change to the site, bump `CACHE` in `sw.js` (e.g. `bai-hotel-v2`) only if old files seem stuck; HTML/CSS/JS are loaded network-first.

## Notes

- The Firebase web `apiKey` is not a secret; access is protected by Authentication and Firestore rules.
- Pinch/double-tap zoom is disabled on mobile by design (viewport + gesture handlers in `index.html`).
- Fonts load from Google Fonts; images are embedded in the HTML.
