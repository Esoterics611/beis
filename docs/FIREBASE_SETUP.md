# Firebase project setup (Beis)

Beis uses its own Firebase project — **do not** reuse `vanguard-dao` (that
project belongs to the chayolei instance and is kept as reference only).

One-time console checklist (~10 minutes):

1. **Create the project** — [console.firebase.google.com](https://console.firebase.google.com)
   → Add project → name it (e.g. `beis-app`). Analytics optional.
2. **Add a Web app** — Project overview → Add app → Web. Copy the config
   values into `.env` (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
   `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`,
   `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`).
3. **Enable Firestore** — Build → Firestore Database → Create database
   (production mode; pick a region close to your users, e.g. `europe-west1`
   or `me-west1` Tel Aviv).
4. **Enable auth providers** — Build → Authentication → Sign-in method:
   - **Email/Password** — enable.
   - **Google** — enable (set the support email).
5. **Service account** — Project settings → Service accounts → Generate new
   private key. From the JSON, fill `.env`: `FIREBASE_PROJECT_ID`,
   `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (keep the `\n` escapes,
   wrap in quotes).
6. **Admin bootstrap** — set `ADMIN_EMAILS` in `.env` to your email
   (comma-separated list). The first time that account signs in, it gets the
   `admin` role; from there, assign `mashpia`/`admin` to others via
   `PATCH /api/chaverim/{id}/role`.

Notes:

- Sign-in flow: Google/email is primary (`/api/auth/register` creates the
  chaver doc and stamps `role`/`chaverId`/`makomId` custom claims). A wallet
  is an optional linked credential (`/api/auth/link-wallet`, from the
  Settings page); legacy wallet sign-in still works via `/api/auth/nonce` +
  `/api/auth/verify`.
- `BOOTSTRAP_ADMIN_WALLET` (optional) grants admin via wallet sign-in — a
  legacy dev path; prefer `ADMIN_EMAILS`.
- Firestore collections are created lazily on first write; to seed demo
  data, sign in as admin and `POST /api/seed/minimal`.
