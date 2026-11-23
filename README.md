# TimeTable Admin

A small installable web app to publish the TimeTable **event background** and **announcements**
without opening GitHub. It commits to the `announcements` branch of
`sivadhanushreddykotturu/TimeTablekl`, which the TimeTable app reads.

## What is in here

- `public/`: the app (paste a Pinterest link; there is no file picker) (static files, no build step)
- `api/pinterest.js`, `api/pinimg.js`: turn a Pinterest link into the picture (same-origin, so the browser can use it)

## Deploy

1. Vercel → Add New Project → import this repo → set the **Production Branch** to `admin-pwa`.
2. Framework preset: **Other**. No build command. Output directory: `public`.
3. Open the deployed URL on your phone or laptop and choose "Install app".

## Token

Make a **fine-grained** GitHub token: repository access to `TimeTablekl` only, permission
**Contents: Read and write**, with an expiry. Paste it on the first screen. It is stored only in that
browser's local storage; "Sign out" removes it.

Note: a fine-grained token limits the *repository*, not the branch. Keep it private, or move the
data into its own small repo so the token cannot reach the app's code.
