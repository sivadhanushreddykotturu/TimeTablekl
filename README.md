

# 📅 KL Timetable PWA
#vibecoded

A minimal Progressive Web App (PWA) for KL University B.Tech students to view their personalized timetable with ease. It scrapes data from the ERP system (using your credentials + CAPTCHA), stores it locally, and shows:

- ✅ **Weekly timetable** — clean week view of your classes  
- 🕒 **Current & Next class** — what’s happening now and next in your day  
- 📊 **Attendance** — view your attendance summary by course & overall percentage  
- 👥 **Friends** — add friends to see their timetable & attendance (opt-in only)  
- 🔁 **Refresh** — manual refresh flow that requires completing the CAPTCHA (to respect ERP limits)  
- 🔐 **Local-first credentials** — credentials are stored locally for offline use; nothing is sent to external servers  
- 📱 **PWA** — installable on Android & iOS (home-screen install), works offline via service worker

---

## 🔧 Features

* **Clean UI** — Fast, simple, and mobile-friendly interface.
* **No re-login** — Stored credentials (securely) in browser.
* **CAPTCHA-based refresh** — Only CAPTCHA input needed after first login.
* **Fully offline** — Works even when offline (after first load), except for attendance feature.

---

## 🚀 Tech Stack

* **Frontend:** React + Vite (PWA-ready)
* **Backend:** Python FastAPI (hosted via Railway)
* **Storage:** `localStorage` for timetable & credentials
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
git clone https://github.com/sivadhanushreddykotturu/TimeTablekl.git
cd TimeTablekl
npm install
npm run dev
```




## 📦 Hosting / Backend

The Python backend is deployed using **Render** and handles:

* Login and CAPTCHA
* Timetable scraping
* Attendence scraping
* JSON formatting

---

## ❓ FAQ

**Q:** Why does it ask CAPTCHA on refresh?
**A:** KL ERP always requires CAPTCHA. But password is not asked again.

**Q:** Does it store my password online?
**A:** No. Password is stored **only in your browser’s localStorage** .


---

## ⚠️ Disclaimer

This tool is unofficial and not affiliated with KL University. Use it responsibly. Your credentials are only used to fetch data on your device and are not stored anywhere else.

---

## 🙌 Author

Built with ❤️ by [@sivadhanushreddykotturu](https://github.com/sivadhanushreddykotturu)

