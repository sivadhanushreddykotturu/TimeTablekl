import { useCallback, useEffect, useState } from "react";

/** Whether the app can be installed right now, and a function that asks the browser to do it. */
export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(() => Boolean(window.__installPrompt));

  useEffect(() => {
    const update = () => setCanInstall(Boolean(window.__installPrompt));
    window.addEventListener("installprompt_changed", update);
    return () => window.removeEventListener("installprompt_changed", update);
  }, []);

  const install = useCallback(async () => {
    const prompt = window.__installPrompt;
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice.catch(() => {});
    // the event can only be used once
    window.__installPrompt = null;
    setCanInstall(false);
  }, []);

  return { canInstall, install };
}
