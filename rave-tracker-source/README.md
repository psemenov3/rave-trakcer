# Find Your Crew — Rave Tracker

Real-time group location tracker for festivals & raves. React + Vite frontend,
Firebase Realtime Database backend.

## Run locally

```bash
npm install
npm run dev        # local dev server (note: GPS/compass need HTTPS or localhost)
npm run build      # production build into dist/
npm run preview    # preview the production build
```

## Project layout

```
src/
  main.jsx                  app entry
  App.jsx                   screens: home / setup / tracker + GPS + Firebase sync
  firebase.js               Firebase config + init
  geo.js                    bearing, distance, formatting, code generation
  styles.js                 palette, button styles, screen styles
  useCompass.js             device-orientation compass hook (true-north, smoothed)
  components/
    FriendCard.jsx          per-member arrow + distance
    CalibrationOverlay.jsx  guided figure-8 compass calibration
database.rules.json         Firebase Realtime Database security rules
netlify.toml                Netlify build + SPA redirect config
```

## Deploy (Netlify, continuous deployment)

This repo includes `netlify.toml` (build command `npm run build`, publish `dist`).
Connect the repo to Netlify once and every push auto-deploys. See the chat for
step-by-step setup.

## Firebase security rules

`database.rules.json` blocks listing the whole `/groups` collection (prevents
harvesting every active group code) while still allowing access to a specific
group by its code. Publish via Firebase Console → Realtime Database → Rules.
