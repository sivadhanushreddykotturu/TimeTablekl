import React, { useEffect, useRef, useState } from 'react';

const CACHE_KEY_DATA = 'latestCommit:data';
const CACHE_KEY_TS = 'latestCommit:ts';
const CACHE_KEY_AVATAR = 'latestCommit:avatarDataUrl';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const GITHUB_ENV = import.meta.env.VITE_GITHUB;
const LATEST_COMMIT_URL = (() => {
  if (GITHUB_ENV && typeof GITHUB_ENV === 'string') {
    const base = GITHUB_ENV.replace(/\/$/, '');
    return base.endsWith('/latest-commit') ? base : `${base}/latest-commit`;
  }
  return '';
})();

const DEFAULT_AVATAR_DATA_URL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
      <rect width="56" height="56" rx="28" fill="#e5e7eb"/>
      <circle cx="28" cy="22" r="10" fill="#cbd5e1"/>
      <path d="M8 50c4-10 14-14 20-14s16 4 20 14" fill="#cbd5e1"/>
    </svg>`
  );

function timeAgo(dateStr) {
  try {
    const then = new Date(dateStr).getTime();
    const now = Date.now();
    const diff = Math.max(0, now - then);
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
    const years = Math.floor(months / 12);
    return `${years} year${years === 1 ? '' : 's'} ago`;
  } catch (_) {
    return '';
  }
}

function RecentContributors() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [latestCommit, setLatestCommit] = useState(null); // {author, message, avatar, url, date}
  const [avatarDataUrl, setAvatarDataUrl] = useState(null);
  const [debug, setDebug] = useState(null);
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return; // prevent double-run in React StrictMode (dev)
    didInit.current = true;

    if (!LATEST_COMMIT_URL) {
      console.error('VITE_GITHUB env var is missing. Cannot fetch latest commit.');
      setDebug({ phase: 'env-missing', url: LATEST_COMMIT_URL, online: navigator.onLine, env: !!GITHUB_ENV });
      try {
        const cached = localStorage.getItem(CACHE_KEY_DATA);
        const cachedAvatar = localStorage.getItem(CACHE_KEY_AVATAR);
        if (cached) {
          setLatestCommit(JSON.parse(cached));
          setAvatarDataUrl(cachedAvatar || null);
          setLoading(false);
          return;
        }
      } catch (_) {}
      setError('Could not load contributors.');
      setLoading(false);
      return;
    }

    // Try cache first
    let hadCached = false;
    try {
      const tsRaw = localStorage.getItem(CACHE_KEY_TS);
      const dataRaw = localStorage.getItem(CACHE_KEY_DATA);
      const avatarRaw = localStorage.getItem(CACHE_KEY_AVATAR);
      const now = Date.now();
      if (tsRaw && dataRaw) {
        const ts = parseInt(tsRaw, 10);
        if (Number.isFinite(ts) && now - ts < CACHE_TTL_MS) {
          console.log('⚡ Using cached contributor data');
          setLatestCommit(JSON.parse(dataRaw));
          setAvatarDataUrl(avatarRaw || null);
          setLoading(false);
          hadCached = true;
          if (!navigator.onLine) return; // stop if offline
        } else if (!navigator.onLine) {
          console.log('⚡ Offline — using expired cached contributor data');
          setLatestCommit(JSON.parse(dataRaw));
          setAvatarDataUrl(avatarRaw || null);
          setLoading(false);
          return;
        }
      } else if (!navigator.onLine) {
        setError('Offline — contributor info unavailable.');
        setLoading(false);
        return;
      }
    } catch (_) {}

    const controller = new AbortController();
    const fetchLatest = async () => {
      if (!hadCached) setLoading(true);
      setError(null);
      setDebug({ phase: 'fetching', url: LATEST_COMMIT_URL, online: navigator.onLine });
      let attempt = 0;
      const MAX_ATTEMPTS = 2; // initial + 1 retry
      const TIMEOUT_MS = 12000;

      while (attempt < MAX_ATTEMPTS) {
        try {
          attempt++;
          console.log('Fetching latest commit from', LATEST_COMMIT_URL, 'attempt', attempt);
          const attemptController = new AbortController();
          const t = setTimeout(() => {
            attemptController.abort();
          }, TIMEOUT_MS);

          const res = await fetch(LATEST_COMMIT_URL, { signal: attemptController.signal });
          clearTimeout(t);

          if (!res.ok) {
            const body = await res.text().catch(() => '');
            setDebug({ phase: 'error', status: res.status, url: LATEST_COMMIT_URL, body: body.slice(0, 300), online: navigator.onLine, attempt });
            throw new Error(`Backend error: ${res.status} ${body}`);
          }
          const data = await res.json();
          setLatestCommit(data);
          setDebug({ phase: data?.cached ? 'server-cache' : 'server-fresh', url: LATEST_COMMIT_URL, online: navigator.onLine, attempt });
          try {
            localStorage.setItem(CACHE_KEY_DATA, JSON.stringify(data));
            localStorage.setItem(CACHE_KEY_TS, String(Date.now()));
          } catch (_) {}

          // Cache avatar as data URL for offline rendering
          if (data?.avatar) {
            try {
              const imgRes = await fetch(data.avatar, { mode: 'cors' });
              if (!imgRes.ok) throw new Error(`Avatar fetch error: ${imgRes.status}`);
              const blob = await imgRes.blob();
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64data = reader.result;
                setAvatarDataUrl(base64data);
                try { localStorage.setItem(CACHE_KEY_AVATAR, String(base64data)); } catch (_) {}
              };
              reader.readAsDataURL(blob);
            } catch (e) {
              console.warn('Avatar cache failed', e);
            }
          }

          // success, break the loop
          break;
        } catch (err) {
          const isAbort = err?.name === 'AbortError';
          console.error('Contributor fetch attempt failed', { attempt, err });
          if (isAbort) {
            setDebug({ phase: 'timeout', url: LATEST_COMMIT_URL, online: navigator.onLine, attempt, timeoutMs: TIMEOUT_MS });
          }
          if (attempt >= MAX_ATTEMPTS) {
            if (!hadCached) setError('Could not load contributors.');
          } else {
            // brief backoff before retry
            await new Promise(r => setTimeout(r, 600));
          }
        } finally {
          if (!hadCached) setLoading(false);
        }
      }
    };

    fetchLatest();
    return () => controller.abort();
  }, []);

  const latestMessage = latestCommit?.message ? latestCommit.message.split('\n')[0] : '';
  const profileUrl = latestCommit?.profile || latestCommit?.url || null;
  const avatarUrl = avatarDataUrl || latestCommit?.avatar || null;

  return (
    <section className="contributors-section" aria-labelledby="contributors-title">
      <h2 id="contributors-title" className="contributors-title">👤 Recent Contributor</h2>

      {latestCommit && (
        <div className="contributors-updated">
          Updated {timeAgo(latestCommit.date)} by <span className="contributors-updated-author">{latestCommit.author}</span>
        </div>
      )}

      {loading ? (
        <div className="contributors-list" aria-busy="true">
          <div className="contributor-avatar skeleton-avatar" />
        </div>
      ) : error ? (
        latestCommit ? (
          <div className="text-center" style={{ color: 'var(--text-muted)' }}>{error}</div>
        ) : (
          <div className="contributors-list" style={{ gap: 16, flexDirection: 'column' }}>
            <img
              src={DEFAULT_AVATAR_DATA_URL}
              alt={'Contributor'}
              className="contributor-avatar"
              width={56}
              height={56}
            />
            <div className="contributors-updated">
              Updated just now by <span className="contributors-updated-author">Community</span>
            </div>
            <div className="text-center" style={{ maxWidth: 520, color: 'var(--text-secondary)' }}>
              Commit: Stay tuned for updates
            </div>
          </div>
        )
      ) : latestCommit ? (
        <div className="contributors-list" style={{ gap: 16, flexDirection: 'column' }}>
          {profileUrl ? (
            <a
              className="contributor-link"
              href={profileUrl}
              target="_blank"
              rel="noreferrer noopener"
              title={latestCommit.author}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={latestCommit.author}
                  className="contributor-avatar"
                  loading="lazy"
                  width={56}
                  height={56}
                  onError={(e) => {
                    if (avatarDataUrl) {
                      e.currentTarget.src = avatarDataUrl;
                    } else {
                      e.currentTarget.src = DEFAULT_AVATAR_DATA_URL;
                    }
                  }}
                />
              ) : (
                <img
                  src={DEFAULT_AVATAR_DATA_URL}
                  alt={latestCommit.author}
                  className="contributor-avatar"
                  width={56}
                  height={56}
                />
              )}
            </a>
          ) : (
            <img
              src={avatarUrl || DEFAULT_AVATAR_DATA_URL}
              alt={latestCommit?.author || 'Contributor'}
              className="contributor-avatar"
              loading="lazy"
              width={56}
              height={56}
              onError={(e) => {
                e.currentTarget.src = DEFAULT_AVATAR_DATA_URL;
              }}
            />
          )}

          {latestMessage && (
            <div className="text-center" style={{ maxWidth: 520, color: 'var(--text-secondary)' }}>
              Commit: {latestMessage}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center" style={{ color: 'var(--text-muted)' }}>No recent contribution found.</div>
      )}

      {/* Debug strip removed */}

      <div className="contributors-cta">
        <a
          className="contributors-cta-btn"
          href={import.meta.env.VITE_GITHUB_REPO_URL || 'https://github.com/sivadhanushreddykotturu/TimeTablekl'}
          target="_blank"
          rel="noreferrer noopener"
        >
          Contribute and get featured ✨
        </a>
      </div>
    </section>
  );
}

export default RecentContributors;
