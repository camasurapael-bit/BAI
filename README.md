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
- Currently the confirmation is shown on screen only. Saving to a database (Firestore) is the next step.

## Appointments are saved to Firestore

When a signed-in visitor presses Confirm Appointment, the booking is written to the Firestore collection `appointments` (with their `uid` and a server timestamp) before the confirmation is shown. If saving fails, an error is shown and the form is kept.

Setup:
1. Firebase console > Build > Firestore Database > Create database (production mode, region e.g. `asia-southeast1`).
2. Firestore > Rules tab > paste the contents of `firestore.rules` > Publish.
3. Upload the new `index.html`, `firestore.rules` and `README.md` to GitHub; Vercel redeploys.
4. See bookings in Firebase console > Firestore Database > Data > `appointments`.

## Notes

- The Firebase web `apiKey` is not a secret; access is protected by Authentication and Firestore rules.
- Pinch/double-tap zoom is disabled on mobile by design (viewport + gesture handlers in `index.html`).
- Fonts load from Google Fonts; images are embedded in the HTML.
