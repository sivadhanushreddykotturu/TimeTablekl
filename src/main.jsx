import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// iOS Safari ignores user-scalable=no, so block its pinch gestures directly.
["gesturestart", "gesturechange", "gestureend"].forEach((name) =>
  document.addEventListener(name, (event) => event.preventDefault())
);

// The browser offers "install" once, early. Keep the event so the Profile
// screen can show an Install row whenever the user gets there.
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  window.__installPrompt = event;
  window.dispatchEvent(new Event("installprompt_changed"));
});

window.addEventListener("appinstalled", () => {
  window.__installPrompt = null;
  window.dispatchEvent(new Event("installprompt_changed"));
});
