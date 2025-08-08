

# 📅 KL Timetable PWA
#vibecoded

A minimal Progressive Web App (PWA) for KL University B.Tech students to view their personalized timetable with ease. It scrapes data from the ERP system (using your credentials + CAPTCHA), stores it locally, and shows:

* ✅ Weekly timetable
* 🕒 Current and Next class
* 🔁 Refresh option (only requires CAPTCHA)
* 🔐 Credentials stored locally (offline support)
* 📱 PWA (installable on iOS & Android)

---

## 🔧 Features

* **Clean UI** — Fast, simple, and mobile-friendly interface.
* **No re-login** — Stored credentials (securely) in browser.
* **CAPTCHA-based refresh** — Only CAPTCHA input needed after first login.
* **Fully offline** — Works even when offline (after first load).
* **No backend required** — Uses a pre-deployed backend (FastAPI on Railway).

---

## 🚀 Tech Stack

* **Frontend:** React + Vite (PWA-ready)
* **Backend:** Python FastAPI (hosted via Railway)
* **Storage:** `localStorage` for timetable & credentials
* **CAPTCHA Support:** Manual entry for every refresh
* **Deployment:** Optimized for PWA on iOS & Android

---

## 🔐 How It Works

1. User enters **username, password, and CAPTCHA**.
2. App sends data to backend API.
3. On success:

   * Timetable is parsed and saved to `localStorage`.
   * Credentials are saved for reuse.
4. From now on:

   * You can refresh with just CAPTCHA (no password needed).
   * You can view current & next class instantly.

---

## 📱 How to Use

1. Open the app on your browser.
2. Tap **“Add to Home Screen”** to install it as an app (optional).
3. Log in once using credentials + CAPTCHA.
4. Browse your timetable or see your **Current** / **Next class**.

---

## 🛠 Developer Setup

```bash
git clone https://github.com/your-username/kl-timetable-pwa.git
cd kl-timetable-pwa
npm install
npm run dev
```




## 📦 Hosting / Backend

The Python backend is deployed using **Railway** and handles:

* Login and CAPTCHA
* Timetable scraping
* JSON formatting

---

## ❓ FAQ

**Q:** Why does it ask CAPTCHA on refresh?
**A:** KL ERP always requires CAPTCHA. But password is not asked again.

**Q:** Does it store my password online?
**A:** No. Password is stored **only in your browser’s localStorage** (encrypted by you if you choose).

**Q:** Why does it fail on iOS sometimes?
**A:** iOS Safari restricts some fetch/cookie behavior. Use BrowserStack to debug properly.

---

## ⚠️ Disclaimer

This tool is unofficial and not affiliated with KL University. Use it responsibly. Your credentials are only used to fetch data on your device and are not stored anywhere else.

---

## 🙌 Author

Built with ❤️ by [@sivadhanushreddykotturu](https://github.com/sivadhanushreddykotturu)

