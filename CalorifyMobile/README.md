# CALORIFY! — Mobile App (React Native / Expo)

Same features as the web app, now on iOS & Android.

---

## Prerequisites

- **Node.js** 18 or newer
- **Expo Go** app installed on your phone
  - iOS: https://apps.apple.com/app/expo-go/id982107779
  - Android: https://play.google.com/store/apps/details?id=host.exp.exponent
- Your **Flask backend** running (from the calorify_mysql project)

---

## Step 1 — Set your API URL

Open `src/config.js`.

**Simulator (same machine as Flask):** leave it as `http://localhost:5000/api`

**Physical phone:** you must use your computer's local IP address.

Find it:
- Windows: open Command Prompt → run `ipconfig` → look for **IPv4 Address** (e.g. `192.168.1.100`)
- Mac/Linux: run `ifconfig` or `ip addr`

Then update the file:
```js
export const API_BASE = 'http://192.168.1.100:5000/api';
```

> ⚠️ Your phone and computer must be on the **same Wi-Fi network**.

---

## Step 2 — Start the Flask backend

In your `calorify_mysql/backend` folder:
```bash
python app.py
```

---

## Step 3 — Install dependencies

In this folder (CalorifyMobile):
```bash
npm install
```

---

## Step 4 — Run the app

```bash
npx expo start
```

Then:
- **Physical phone:** scan the QR code with Expo Go
- **iOS Simulator:** press `i`
- **Android Emulator:** press `a`

---

## Features

| Feature              | Status |
|----------------------|--------|
| Login / Register     | ✅     |
| Session persistence  | ✅     |
| Dashboard + ring     | ✅     |
| Macro progress bars  | ✅     |
| Smart recommendations| ✅     |
| Food search (USDA)   | ✅     |
| Manual food entry    | ✅     |
| Date selector        | ✅     |
| Meal types           | ✅     |
| History by date      | ✅     |
| Delete meals         | ✅     |
| 7-day bar chart      | ✅     |
| Weekly summary       | ✅     |
| Monthly summary      | ✅     |
| Profile view         | ✅     |
| Pull-to-refresh      | ✅     |

---

## Project Structure

```
CalorifyMobile/
├── App.js                      # Navigation root
├── src/
│   ├── config.js               # ← Set your API_BASE URL here
│   ├── theme.js                # Colors & shared styles
│   ├── api.js                  # Fetch helpers + date utils
│   ├── context/
│   │   └── AppContext.js       # Global state (React Context)
│   └── screens/
│       ├── AuthScreen.js       # Login + Register
│       ├── DashboardScreen.js  # Progress ring, macros, recs
│       ├── LogMealScreen.js    # Search/manual log + date picker
│       ├── HistoryScreen.js    # Browse meals by date
│       ├── AnalyticsScreen.js  # Charts + weekly/monthly summaries
│       └── ProfileScreen.js    # User info + logout
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Cannot reach server" | Check `src/config.js` IP, ensure Flask is running, same Wi-Fi |
| Blank screen on launch | Check Expo CLI version: `npm install -g expo-cli` |
| DatePicker not showing on Android | Works on physical device; may be limited on emulator |
| `localhost` not working on phone | Must use local IP — see Step 1 |
