# Building the Android App (background location)

This turns the web app into a native Android app that keeps tracking location
**even when the phone is locked**, using Capacitor + a background-geolocation
plugin. The web app is unchanged — these steps only affect the Android build.

You run all of this on your Windows machine.

---

## 0. Prerequisites (one-time)

- **Node.js** (you already have it).
- **Android Studio** — https://developer.android.com/studio (installs the
  Android SDK and an emulator). During setup, let it install the SDK + an
  emulator image, or plan to use a real phone.
- **A real Android phone is strongly recommended** for testing background GPS
  (emulators fake location and don't reflect real battery/background behavior).
  On the phone: enable **Developer Options** → **USB debugging**.

---

## 1. Install Capacitor + the plugin

From your repo (`E:\rave-trakcer\rave-tracker-source`):

```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android
npm install @capacitor-community/background-geolocation
```

(`capacitor.config.json` is already in the repo, so `cap init` is not needed.)

---

## 2. Build the web app and add the Android project

```bash
npm run build
npx cap add android
npx cap sync
```

`cap add android` creates an `android/` folder (a real Android Studio project).
`cap sync` copies your built web app into it and wires up the plugin.

---

## 3. Add the location permissions

Open `android/app/src/main/AndroidManifest.xml` and add these inside the
`<manifest>` tag (above `<application>`):

```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
```

The plugin declares its own foreground-location service, so you don't add a
`<service>` yourself — but double-check the plugin's README for your installed
version in case anything changed.

Re-run `npx cap sync` after editing.

---

## 4. Run it on your phone

```bash
npx cap open android
```

This opens **Android Studio**. Plug in your phone (USB debugging on), pick it as
the run target, and press **Run** (the green ▶). The app installs and launches.

When you create/join a group, Android will ask for location — choose **Allow
all the time** (this is what enables background tracking). You'll see a
persistent "Find Your Crew is using your location" notification while it runs;
that's required by Android for background location and is normal.

**Test the real win:** create a group, lock the phone, wait, then check on
another device that your dot is still updating. That's the thing the web app
couldn't do.

---

## 5. Iterating

Whenever you change the web code:

```bash
npm run build
npx cap sync
```

then re-run from Android Studio. (The web/Netlify deploy is separate and
unaffected — keep pushing to GitHub as normal for the website.)

---

## 6. Shipping to the Play Store (when ready)

- Google Play Developer account: **$25 one-time**.
- In Android Studio: **Build → Generate Signed Bundle / APK** → create a signing
  key (keep it safe — you need it for every future update) → build an **.aab**.
- Upload the `.aab` in the Play Console, fill in the listing, and complete the
  **background-location declaration** — Google reviews apps that use
  `ACCESS_BACKGROUND_LOCATION` and you must justify it (e.g. "shares live
  location with members of a group the user joined"). Be clear and honest;
  vague justifications get rejected.

---

## Notes & gotchas

- **Battery:** background GPS drains batteries. `distanceFilter` is set to 10m in
  `src/locationService.js` so it only updates on real movement — raise it to save
  more battery, lower it for tighter tracking.
- **Privacy:** background tracking is more sensitive than foreground. Keep the
  in-app messaging clear, and the group auto-expiry means tracking only runs
  during an active session.
- **App ID:** `com.findyourcrew.app` (in `capacitor.config.json`). If you want a
  different one, change it **before** `cap add android` — changing it later means
  recreating the android project.
- **iOS:** the same `locationService.js` already handles iOS too, but building it
  needs a Mac. When you're ready, `npm install @capacitor/ios && npx cap add ios`
  on a Mac and follow the equivalent iOS permission steps.
