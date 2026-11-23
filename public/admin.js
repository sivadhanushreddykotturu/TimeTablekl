/**
 * TimeTable Admin: publish the event background and the announcement without
 * opening GitHub. Everything runs in the browser with the user's own GitHub
 * token (kept in this browser only) and commits to the `announcements` branch,
 * which holds data only. The app itself (main) is never touched.
 */
const REPO = "sivadhanushreddykotturu/TimeTablekl";
const BRANCH = "announcements";
const API = "https://api.github.com";
const RAW = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/`;
const TOKEN_KEY = "tt_admin_token";
const MAX_WIDTH = 1080;

const $ = (id) => document.getElementById(id);

/* ---------------- token ---------------- */

const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
};
const setToken = (value) => {
  try {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
};

/* ---------------- GitHub ---------------- */

const toB64 = (text) => btoa(unescape(encodeURIComponent(text)));
const fromB64 = (b64) => decodeURIComponent(escape(atob(b64.replace(/\n/g, ""))));

function friendly(status, data) {
  if (status === 401) return "GitHub did not accept the token. Make a new one and sign in again.";
  if (status === 403) {
    return /rate/i.test(data?.message || "")
      ? "GitHub rate limit. Try again in a minute."
      : "The token cannot write to this repo. It needs Contents: Read and write.";
  }
  if (status === 404) {
    return "Not found. Check the token only needs the TimeTablekl repo, and that the 'announcements' branch exists.";
  }
  if (status === 409 || status === 422) return "The file changed at the same time. Try again.";
  return data?.message || `GitHub error ${status}`;
}

async function gh(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${getToken()}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Could not reach GitHub. Check your connection.");
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const error = new Error(friendly(res.status, data));
    error.status = res.status;
    throw error;
  }
  return data;
}

const filePath = (path) => `/repos/${REPO}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;

async function readFile(path) {
  try {
    const data = await gh(`${filePath(path)}?ref=${BRANCH}`);
    return { sha: data.sha, text: fromB64(data.content) };
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

async function readJson(path) {
  const file = await readFile(path);
  if (!file) return { sha: null, data: {} };
  try {
    return { sha: file.sha, data: JSON.parse(file.text) };
  } catch {
    return { sha: file.sha, data: {} };
  }
}

/** Writes a JSON file next to what is already there; retries once if it changed meanwhile. */
async function saveJson(path, patch, message) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { sha, data } = await readJson(path);
    const text = `${JSON.stringify({ ...data, ...patch }, null, 2)}\n`;
    try {
      return await gh(filePath(path), {
        method: "PUT",
        body: { message, content: toB64(text), branch: BRANCH, ...(sha ? { sha } : {}) },
      });
    } catch (error) {
      if (attempt === 0 && (error.status === 409 || error.status === 422)) continue;
      throw error;
    }
  }
  return null;
}

async function saveImage(path, base64, message) {
  return gh(filePath(path), { method: "PUT", body: { message, content: base64, branch: BRANCH } });
}

/* ---------------- small UI helpers ---------------- */

let toastTimer;
function toast(text, { error = false, link = "" } = {}) {
  const el = $("toast");
  el.textContent = text;
  el.classList.toggle("is-error", error);
  if (link) {
    const a = document.createElement("a");
    a.href = link;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = "View commit";
    el.appendChild(a);
  }
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), error ? 7000 : 5000);
}

function showError(id, text) {
  const el = $(id);
  el.textContent = text || "";
  el.hidden = !text;
}

function confirmSheet(title, text, okLabel = "Publish") {
  return new Promise((resolve) => {
    $("sheet-title").textContent = title;
    $("sheet-text").textContent = text;
    $("sheet-ok").textContent = okLabel;
    $("sheet").hidden = false;
    $("sheet-ok").focus();
    const done = (value) => {
      $("sheet").hidden = true;
      $("sheet-ok").onclick = null;
      $("sheet-cancel").onclick = null;
      resolve(value);
    };
    $("sheet-ok").onclick = () => done(true);
    $("sheet-cancel").onclick = () => done(false);
  });
}

async function busy(buttons, work) {
  const list = buttons.map((id) => $(id));
  list.forEach((b) => (b.disabled = true));
  try {
    return await work();
  } finally {
    list.forEach((b) => (b.disabled = false));
  }
}

/* ---------------- background tab ---------------- */

const state = {
  blob: null, // the new picture, already resized (JPEG)
  blobUrl: "", // preview link for it
  liveImage: "", // path of the picture that is live now (relative to the branch)
  liveVersion: "",
  liveUrl: "", // full link of the live picture, for the preview
};

const devicesChecked = () => [...document.querySelectorAll("#devices input:checked")].map((i) => i.value);
const focusValue = () => `${$("fx").value}% ${$("fy").value}%`;

function renderPreview() {
  const url = state.blobUrl || state.liveUrl;
  for (const id of ["pv-phone", "pv-laptop"]) {
    const el = $(id);
    el.style.setProperty("--img", url ? `url("${url}")` : "none");
    el.style.setProperty("--strength", String(Number($("strength").value) / 100));
    el.style.setProperty("--focus", focusValue());
    el.classList.toggle("hero--glow", $("glow").checked);
  }
  $("strength-val").textContent = `${$("strength").value}%`;
  $("fx-val").textContent = `${$("fx").value}%`;
  $("fy-val").textContent = `${$("fy").value}%`;
}

async function toJpeg(blob) {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const out = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
  return { blob: out, width: bitmap.width, height: bitmap.height, outWidth: canvas.width, outHeight: canvas.height };
}

async function setPicture(source) {
  showError("pin-error", "");
  const result = await toJpeg(source);
  if (!result.blob) throw new Error("Could not read that picture.");
  if (state.blobUrl) URL.revokeObjectURL(state.blobUrl);
  state.blob = result.blob;
  state.blobUrl = URL.createObjectURL(result.blob);

  $("img-info").hidden = false;
  $("img-info").textContent = `${result.outWidth} × ${result.outHeight} · ${Math.round(result.blob.size / 1024)} KB`;

  const warnings = [];
  if (result.width < 800) warnings.push("Small picture: it can look soft on laptops.");
  if (result.width / result.height < 1.3) {
    warnings.push("Square or tall pictures are cropped to a strip on laptops. They suit phones best.");
  }
  $("img-warn").hidden = warnings.length === 0;
  $("img-warn").textContent = warnings.join(" ");
  renderPreview();
}

async function downloadVia(src) {
  if (!src) return null;
  try {
    const res = await fetch(`/api/pinimg?src=${encodeURIComponent(src)}`);
    if (!res.ok) return null;
    const blob = await res.blob();
    return blob.type.startsWith("image/") ? blob : null;
  } catch {
    return null;
  }
}

async function fetchPin() {
  const link = $("pin").value.trim();
  if (!link) {
    showError("pin-error", "Paste a Pinterest link first.");
    return;
  }
  await busy(["fetch-pin"], async () => {
    try {
      const res = await fetch(`/api/pinterest?url=${encodeURIComponent(link)}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Could not read that link.");
      // the original is sharper; fall back to the smaller one if it is too big to fetch
      const blob = (await downloadVia(data.original)) || (await downloadVia(data.image));
      if (!blob) throw new Error("Could not download that picture.");
      await setPicture(blob);
    } catch (error) {
      showError("pin-error", error.message || "Something went wrong.");
    }
  });
}

function themeFromControls(extra = {}) {
  return {
    active: $("active").checked,
    strength: Number((Number($("strength").value) / 100).toFixed(2)),
    focus: focusValue(),
    glow: $("glow").checked,
    devices: devicesChecked(),
    expires: $("expires").value || "",
    ...extra,
  };
}

function describeTheme(theme) {
  const names = { mobile: "phones", tablet: "tablets", desktop: "laptops" };
  const where = theme.devices.map((d) => names[d]).join(", ");
  return [
    theme.active ? `On for ${where}` : "Switched off",
    `strength ${Math.round(theme.strength * 100)}%`,
    theme.expires ? `ends ${theme.expires}` : "",
    state.blob ? "with the new picture" : "keeping the current picture",
  ]
    .filter(Boolean)
    .join(" · ");
}

async function publishBackground() {
  showError("bg-error", "");
  const devices = devicesChecked();
  if (devices.length === 0) {
    showError("bg-error", "Pick at least one kind of device.");
    return;
  }
  if (!state.blob && !state.liveImage) {
    showError("bg-error", "Pick a picture first.");
    return;
  }
  const theme = themeFromControls();
  if (!(await confirmSheet("Publish this background?", describeTheme(theme)))) return;

  await busy(["publish", "turnoff"], async () => {
    try {
      const stamp = Date.now();
      let image = state.liveImage;
      if (state.blob) {
        image = `theme/event-${stamp}.jpg`;
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(state.blob);
        });
        await saveImage(image, base64, "theme: add event image");
      }
      const result = await saveJson(
        "theme.json",
        { ...theme, image, version: String(stamp) },
        theme.active ? "theme: publish event background" : "theme: switch event background off"
      );
      toast(theme.active ? "Published. Users get it within a few minutes." : "Switched off.", {
        link: result?.commit?.html_url || "",
      });
      state.blob = null;
      await loadLive();
    } catch (error) {
      showError("bg-error", error.message);
      toast(error.message, { error: true });
    }
  });
}

async function turnOff() {
  showError("bg-error", "");
  if (!(await confirmSheet("Turn it off for everyone?", "The normal header comes back within a few minutes.", "Turn off"))) return;
  await busy(["publish", "turnoff"], async () => {
    try {
      const result = await saveJson("theme.json", { active: false }, "theme: switch event background off");
      toast("Switched off.", { link: result?.commit?.html_url || "" });
      await loadLive();
    } catch (error) {
      showError("bg-error", error.message);
      toast(error.message, { error: true });
    }
  });
}

/* ---------------- announcement tab ---------------- */

async function publishAnnouncement() {
  showError("a-error", "");
  const active = $("a-active").checked;
  const title = $("a-title").value.trim();
  const message = $("a-message").value.trim();
  if (active && !title) {
    showError("a-error", "Add a title first.");
    return;
  }
  const summary = active ? `Show: "${title}"` : "Hide the announcement";
  if (!(await confirmSheet("Publish this announcement?", summary))) return;

  await busy(["a-publish"], async () => {
    try {
      const result = await saveJson(
        "announcements.json",
        { active, type: $("a-type").value, title, message },
        active ? "announcement: publish" : "announcement: switch off"
      );
      toast(active ? "Published. Users get it within a few minutes." : "Hidden.", { link: result?.commit?.html_url || "" });
      await loadLive();
    } catch (error) {
      showError("a-error", error.message);
      toast(error.message, { error: true });
    }
  });
}

/* ---------------- what is live now ---------------- */

async function loadLive() {
  try {
    const [{ data: theme }, { data: ann }] = await Promise.all([readJson("theme.json"), readJson("announcements.json")]);

    // background
    const hasImage = typeof theme.image === "string" && theme.image.trim() !== "";
    state.liveImage = hasImage ? theme.image : "";
    state.liveVersion = theme.version || "";
    state.liveUrl = hasImage ? `${RAW}${theme.image}${theme.version ? `?v=${encodeURIComponent(theme.version)}` : ""}` : "";
    $("active").checked = theme.active === true;
    if (Number.isFinite(Number(theme.strength))) $("strength").value = String(Math.round(Number(theme.strength) * 100));
    const match = /^(\d{1,3})%\s+(\d{1,3})%$/.exec(theme.focus || "");
    if (match) {
      $("fx").value = match[1];
      $("fy").value = match[2];
    }
    $("glow").checked = theme.glow === true;
    $("expires").value = theme.expires || "";
    const devices = Array.isArray(theme.devices) ? theme.devices : ["mobile", "tablet", "desktop"];
    document.querySelectorAll("#devices input").forEach((i) => (i.checked = devices.includes(i.value)));
    $("bg-status").textContent = theme.active
      ? `Live now: on${hasImage ? ` · ${theme.image}` : ""}`
      : hasImage
      ? "Live now: off (the last picture is kept)"
      : "Live now: off, no picture yet";
    renderPreview();

    // announcement
    $("a-active").checked = ann.active === true;
    $("a-type").value = ["info", "warning", "critical", "success"].includes(ann.type) ? ann.type : "warning";
    $("a-title").value = ann.title || "";
    $("a-message").value = ann.message || "";
    $("a-status").textContent = ann.active ? "Live now: showing" : "Live now: hidden";
  } catch (error) {
    $("bg-status").textContent = error.message;
    $("a-status").textContent = error.message;
    if (error.status === 401) signOut();
  }
}

/* ---------------- sign in / out ---------------- */

function showApp() {
  $("login").hidden = true;
  $("app").hidden = false;
  $("signout").hidden = false;
  loadLive();
}

function signOut() {
  setToken("");
  $("app").hidden = true;
  $("signout").hidden = true;
  $("login").hidden = false;
  $("token").value = "";
}

async function connect() {
  const token = $("token").value.trim();
  showError("login-error", "");
  if (!token) {
    showError("login-error", "Paste the token first.");
    return;
  }
  await busy(["connect"], async () => {
    setToken(token);
    try {
      const repo = await gh(`/repos/${REPO}`);
      if (repo.permissions && repo.permissions.push === false) {
        throw new Error("This token can read the repo but not write. Give it Contents: Read and write.");
      }
      showApp();
    } catch (error) {
      setToken("");
      showError("login-error", error.message);
    }
  });
}

/* ---------------- wiring ---------------- */

function selectTab(name) {
  const bg = name === "bg";
  $("tab-bg").hidden = !bg;
  $("tab-ann").hidden = bg;
  $("tab-bg-btn").classList.toggle("is-on", bg);
  $("tab-ann-btn").classList.toggle("is-on", !bg);
  $("tab-bg-btn").setAttribute("aria-selected", String(bg));
  $("tab-ann-btn").setAttribute("aria-selected", String(!bg));
}

$("connect").onclick = connect;
$("token").addEventListener("keydown", (e) => e.key === "Enter" && connect());
$("signout").onclick = signOut;
$("tab-bg-btn").onclick = () => selectTab("bg");
$("tab-ann-btn").onclick = () => selectTab("ann");
$("fetch-pin").onclick = fetchPin;
$("pin").addEventListener("keydown", (e) => e.key === "Enter" && fetchPin());
for (const id of ["strength", "fx", "fy", "glow"]) $(id).addEventListener("input", renderPreview);
document.querySelectorAll("[data-preset]").forEach((chip) => {
  chip.onclick = () => {
    const all = chip.dataset.preset === "all";
    document.querySelectorAll("#devices input").forEach((i) => (i.checked = all || i.value === "mobile"));
  };
});
$("publish").onclick = publishBackground;
$("turnoff").onclick = turnOff;
$("a-publish").onclick = publishAnnouncement;

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
}

renderPreview();
if (getToken()) showApp();
else $("login").hidden = false;
