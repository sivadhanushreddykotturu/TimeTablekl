import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  FiVolume2,
  FiVolumeX,
  FiChevronUp,
  FiPlus,
  FiFlag,
  FiMusic,
  FiLoader,
  FiSearch,
  FiCheck,
} from "react-icons/fi";
import { API_CONFIG, getRadioFormData } from "../../config/api.js";
import { getCredentials } from "../../../utils/storage.js";
import { NeoModal } from "../Shell.jsx";
import { NeoButton } from "../NeoKit.jsx";

// Format seconds into m:ss
function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

const REPORT_REASONS = [
  { id: "broken", label: "broken audio / silent" },
  { id: "not_music", label: "not a music track / meme" },
  { id: "inappropriate", label: "inappropriate content" },
  { id: "wrong_time", label: "wrong duration" },
];

export default function CampusRadio() {
  const [radioState, setRadioState] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAudioActive, setIsAudioActive] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("broken");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [currentElapsed, setCurrentElapsed] = useState(0);

  // Search & add
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSubmittingSong, setIsSubmittingSong] = useState(false);

  // Feedback message
  const [feedbackMsg, setFeedbackMsg] = useState("");

  // Cooldown countdown
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // YouTube player ref & tracking
  const ytPlayerRef = useRef(null);
  const ytContainerRef = useRef(null);
  const activeVideoIdRef = useRef("");
  const isAudioActiveRef = useRef(false);
  const searchDebounceRef = useRef(null);
  const searchAbortRef = useRef(null);
  const latestQueryRef = useRef("");
  const searchBoxRef = useRef(null);
  const stateSnapshotRef = useRef({ started_at: 0, duration_sec: 0, server_time: 0, local_fetch_at: 0 });
  const audioCtxRef = useRef(null);       // Web Audio API context — keeps OS audio session alive in background
  const silenceNodeRef = useRef(null);    // Silent oscillator node to prevent audio session from being killed

  // Keep audio active ref in sync
  useEffect(() => {
    isAudioActiveRef.current = isAudioActive;
  }, [isAudioActive]);

  // Get student credentials
  const creds = getCredentials();
  const studentId = creds?.username || localStorage.getItem("last_username") || "student";
  const password = creds?.password || "";

  const showNotice = (msg) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(""), 3500);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  // JWT token manager
  const getAuthToken = useCallback(async () => {
    try {
      const existingToken = localStorage.getItem("radio_jwt");
      if (existingToken) {
        try {
          const payload = JSON.parse(atob(existingToken.split(".")[1]));
          if (payload.exp && payload.exp * 1000 > Date.now() + 60000) {
            return existingToken;
          }
        } catch (e) {}
      }

      const formData = getRadioFormData(studentId, password);
      const resp = await fetch(API_CONFIG.RADIO_AUTH_URL, {
        method: "POST",
        body: formData,
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.success && data.token) {
          localStorage.setItem("radio_jwt", data.token);
          return data.token;
        }
      }
    } catch (e) {}
    return localStorage.getItem("radio_jwt") || "";
  }, [studentId, password]);

  // ------------------------------------------------------------
  // 1. Fetch synchronized radio state
  // ------------------------------------------------------------
  const fetchRadioState = useCallback(async (isInitial = false) => {
    try {
      const token = localStorage.getItem("radio_jwt") || "";
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const resp = await fetch(API_CONFIG.RADIO_STATE_URL, { headers });
      if (!resp.ok) throw new Error("Failed to load radio state");
      const data = await resp.json();

      if (data && data.success) {
        setRadioState(data);
        const nowLocal = Date.now();
        const duration = data.current_track?.duration_sec || 0;
        const startedAt = data.started_at || 0;
        const serverTime = data.server_time || nowLocal;

        stateSnapshotRef.current = {
          started_at: startedAt,
          duration_sec: duration,
          server_time: serverTime,
          local_fetch_at: nowLocal,
        };

        if (data.status === "playing" && startedAt > 0 && duration > 0 && data.current_track?.videoId) {
          const elapsed = Math.min(duration, Math.max(0, (serverTime - startedAt) / 1000));
          setCurrentElapsed(elapsed);

          const trackVid = data.current_track.videoId;

          // If YouTube player is initialized
          if (ytPlayerRef.current) {
            if (activeVideoIdRef.current !== trackVid) {
              activeVideoIdRef.current = trackVid;
              try {
                ytPlayerRef.current.loadVideoById({
                  videoId: trackVid,
                  startSeconds: Math.floor(elapsed),
                  suggestedQuality: "small",
                });
                if (!isAudioActiveRef.current) {
                  ytPlayerRef.current.mute?.();
                } else {
                  ytPlayerRef.current.unMute?.();
                  ytPlayerRef.current.setVolume?.(100);
                  ytPlayerRef.current.playVideo?.();
                }
              } catch (e) {
                console.warn("[RADIO] Load track warning:", e);
              }
            } else {
              // Drift correction: only resync when tab is visible
              // Continuous seekTo calls in background tabs cause Chrome to abort the audio stream
              if (document.visibilityState === "visible") {
                try {
                  const currentPlayTime = ytPlayerRef.current.getCurrentTime?.() || 0;
                  if (Math.abs(currentPlayTime - elapsed) > 5.0) {
                    ytPlayerRef.current.seekTo?.(elapsed, true);
                  }
                } catch (e) {}
              }
            }
          }
        } else {
          setCurrentElapsed(0);
          activeVideoIdRef.current = "";
        }
      }
    } catch (err) {
      if (isInitial) {
        console.warn("[RADIO] State fetch error:", err.message);
      }
    } finally {
      if (isInitial) setIsLoading(false);
    }
  }, []);




  // ------------------------------------------------------------
  // 3. Mobile Foreground Resume & Visibility Handler
  // ------------------------------------------------------------
  useEffect(() => {
    const handleForegroundResume = () => {
      if (document.visibilityState === "visible") {
        fetchRadioState(false);

        if (isAudioActiveRef.current && ytPlayerRef.current) {
          try {
            ytPlayerRef.current.unMute?.();
            ytPlayerRef.current.setVolume?.(100);
            ytPlayerRef.current.playVideo?.();

            const snap = stateSnapshotRef.current;
            if (snap.started_at > 0 && snap.duration_sec > 0) {
              const baseElapsed = (snap.server_time - snap.started_at) / 1000;
              const localDelta = (Date.now() - snap.local_fetch_at) / 1000;
              const liveElapsed = Math.min(snap.duration_sec, Math.max(0, baseElapsed + localDelta));
              ytPlayerRef.current.seekTo?.(liveElapsed, true);
            }
          } catch (e) {
            console.warn("[RADIO] Foreground auto-resume warning:", e);
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleForegroundResume);
    window.addEventListener("focus", handleForegroundResume);
    window.addEventListener("pageshow", handleForegroundResume);

    return () => {
      document.removeEventListener("visibilitychange", handleForegroundResume);
      window.removeEventListener("focus", handleForegroundResume);
      window.removeEventListener("pageshow", handleForegroundResume);
    };
  }, [fetchRadioState]);

  // ------------------------------------------------------------
  // 4. Media Session API for Lock Screen & Background Control
  // ------------------------------------------------------------
  useEffect(() => {
    if ("mediaSession" in navigator && radioState?.current_track) {
      const track = radioState.current_track;
      try {
        navigator.mediaSession.metadata = new window.MediaMetadata({
          title: track.title || "KL Campus Radio",
          artist: `${track.artist || "Live Stream"} (added by ${track.added_by || "Student"})`,
          album: "KL Timetable Live Radio",
          artwork: track.thumbnail
            ? [
                { src: track.thumbnail, sizes: "96x96", type: "image/jpeg" },
                { src: track.thumbnail, sizes: "128x128", type: "image/jpeg" },
                { src: track.thumbnail, sizes: "256x256", type: "image/jpeg" },
                { src: track.thumbnail, sizes: "512x512", type: "image/jpeg" },
              ]
            : [],
        });

        // Set playback state so OS knows we're actively streaming
        navigator.mediaSession.playbackState = isAudioActive ? "playing" : "none";

        // Give the OS a scrubber position (lock screen + Android media notification)
        if (navigator.mediaSession.setPositionState && track.duration_sec > 0) {
          try {
            navigator.mediaSession.setPositionState({
              duration: track.duration_sec,
              playbackRate: 1.0,
              position: Math.min(currentElapsed, track.duration_sec),
            });
          } catch (e) {}
        }

        navigator.mediaSession.setActionHandler("play", () => {
          enableAudioPlayback();
        });
        navigator.mediaSession.setActionHandler("pause", () => {
          setIsAudioActive(false);
          isAudioActiveRef.current = false;
          ytPlayerRef.current?.mute?.();
          stopAudioKeepAlive();
          navigator.mediaSession.playbackState = "paused";
        });
        // Stop/previous/next are no-ops (it's a live radio)
        navigator.mediaSession.setActionHandler("stop", () => {
          setIsAudioActive(false);
          isAudioActiveRef.current = false;
          ytPlayerRef.current?.mute?.();
          stopAudioKeepAlive();
          navigator.mediaSession.playbackState = "none";
        });
        navigator.mediaSession.setActionHandler("previoustrack", null);
        navigator.mediaSession.setActionHandler("nexttrack", null);
      } catch (e) {}
    }
  }, [radioState?.current_track, isAudioActive, currentElapsed]);

  // ------------------------------------------------------------
  // 5. Periodic Poll & Smooth Scrubber Ticking
  // Fetch state FIRST, then init the player with correct live timestamp
  // ------------------------------------------------------------
  useEffect(() => {
    let playerInitialized = false;

    const doInitPlayer = () => {
      if (playerInitialized) return;
      if (!window.YT || !window.YT.Player || !ytContainerRef.current) return;
      if (ytPlayerRef.current) return;
      playerInitialized = true;

      try {
        ytPlayerRef.current = new window.YT.Player(ytContainerRef.current, {
          height: "200",
          width: "200",
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
          },
          events: {
            onReady: (event) => {
              try {
                event.target.mute();
                if (event.target.setPlaybackQuality) {
                  event.target.setPlaybackQuality("small");
                }
                // stateSnapshotRef is already populated because fetchRadioState ran before initPlayer
                const snap = stateSnapshotRef.current;
                const vid = activeVideoIdRef.current;
                if (vid && snap.started_at > 0 && snap.duration_sec > 0) {
                  const baseElapsed = (snap.server_time - snap.started_at) / 1000;
                  const localDelta = (Date.now() - snap.local_fetch_at) / 1000;
                  const liveElapsed = Math.min(snap.duration_sec, Math.max(0, baseElapsed + localDelta));
                  event.target.loadVideoById({
                    videoId: vid,
                    startSeconds: Math.floor(liveElapsed),
                    suggestedQuality: "small",
                  });
                }
              } catch (e) {}
            },
            onStateChange: (event) => {
              try {
                if (event.data === window.YT.PlayerState.PLAYING) {
                  if (event.target.setPlaybackQuality) {
                    event.target.setPlaybackQuality("small");
                  }
                  if (!isAudioActiveRef.current) {
                    event.target.mute();
                  } else {
                    event.target.unMute();
                    event.target.setVolume(100);
                  }

                  // Only perform drift seek while tab is active in foreground
                  // Seeking in background tabs causes Chrome to abort audio buffer & pause
                  if (document.visibilityState === "visible") {
                    const snap = stateSnapshotRef.current;
                    if (snap.started_at > 0 && snap.duration_sec > 0) {
                      const baseElapsed = (snap.server_time - snap.started_at) / 1000;
                      const localDelta = (Date.now() - snap.local_fetch_at) / 1000;
                      const liveElapsed = Math.min(snap.duration_sec, Math.max(0, baseElapsed + localDelta));
                      const currentPlayTime = event.target.getCurrentTime() || 0;
                      if (Math.abs(currentPlayTime - liveElapsed) > 4.0) {
                        event.target.seekTo(liveElapsed, true);
                      }
                    }
                  }
                } else if (event.data === window.YT.PlayerState.PAUSED) {
                  // If user has sound ON, auto-resume even in background tabs
                  if (isAudioActiveRef.current) {
                    setTimeout(() => {
                      if (isAudioActiveRef.current && ytPlayerRef.current) {
                        try {
                          ytPlayerRef.current.unMute?.();
                          ytPlayerRef.current.setVolume?.(100);
                          ytPlayerRef.current.playVideo?.();
                        } catch (e) {}
                      }
                    }, 100);
                  }
                } else if (event.data === window.YT.PlayerState.ENDED) {
                  handleTrackEnd();
                }
              } catch (e) {}
            },
          },
        });
      } catch (e) {
        console.error("[RADIO] Player init exception:", e);
      }
    };

    // Step 1: Fetch state first, THEN init player so onReady has correct live timestamp
    fetchRadioState(true).then(() => {
      if (window.YT && window.YT.Player) {
        doInitPlayer();
      } else {
        // YT API not loaded yet — load it, init player when ready
        if (!window.YT) {
          const tag = document.createElement("script");
          tag.src = "https://www.youtube.com/iframe_api";
          const firstScriptTag = document.getElementsByTagName("script")[0];
          firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        }
        const prevCallback = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          if (prevCallback) prevCallback();
          doInitPlayer();
        };
      }
    });

    // Step 2: Keep polling state every 6s
    const stateInterval = setInterval(() => {
      fetchRadioState(false);
    }, 6000);

    const tickInterval = setInterval(() => {
      const snap = stateSnapshotRef.current;
      if (snap.started_at > 0 && snap.duration_sec > 0) {
        const localElapsedDelta = (Date.now() - snap.local_fetch_at) / 1000;
        const baseElapsed = (snap.server_time - snap.started_at) / 1000;
        const totalElapsed = Math.min(snap.duration_sec, Math.max(0, baseElapsed + localElapsedDelta));
        setCurrentElapsed(totalElapsed);

        if (totalElapsed >= snap.duration_sec) {
          handleTrackEnd();
        }
      }
    }, 250);

    return () => {
      clearInterval(stateInterval);
      clearInterval(tickInterval);
      try {
        if (ytPlayerRef.current?.destroy) {
          ytPlayerRef.current.destroy();
          ytPlayerRef.current = null;
        }
      } catch (e) {}
    };
  }, [fetchRadioState]);

  // Cooldown countdown ticker
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  // ------------------------------------------------------------
  // 4. Track Advance Trigger
  // ------------------------------------------------------------
  const handleTrackEnd = async () => {
    try {
      const resp = await fetch(API_CONFIG.RADIO_ADVANCE_URL, { method: "POST" });
      if (resp.ok) {
        const data = await resp.json();
        if (data.success) {
          setRadioState(data);
        }
      }
    } catch (e) {}
  };

  // ------------------------------------------------------------
  // 5. Audio Toggle with Active Classroom Confirmation Check
  // ------------------------------------------------------------
  const handleAudioToggleClick = () => {
    if (isAudioActive) {
      setIsAudioActive(false);
      isAudioActiveRef.current = false;
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.mute?.();
        } catch (e) {}
      }
      // Stop Web Audio keepalive and tell OS we paused
      stopAudioKeepAlive();
      if ("mediaSession" in navigator) {
        try { navigator.mediaSession.playbackState = "paused"; } catch (e) {}
      }
      showNotice("Radio audio muted.");
      return;
    }

    const isSessionConfirmed = sessionStorage.getItem("radio_class_confirmed") === "true";
    if (!isSessionConfirmed) {
      setShowClassModal(true);
    } else {
      enableAudioPlayback();
    }
  };

  // ------------------------------------------------------------
  // Web Audio API keepalive bridge
  // A silent oscillator keeps the OS audio session alive in background
  // Without this, iOS & Android kill the YouTube IFrame audio after ~30s
  // ------------------------------------------------------------
  const startAudioKeepAlive = () => {
    try {
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") return;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      // Create a gain node at 0 volume (truly silent, but audio pipeline stays open)
      const gainNode = ctx.createGain();
      gainNode.gain.value = 0.0001;
      gainNode.connect(ctx.destination);

      // Oscillator at inaudible frequency — just keeps the audio session registered
      const osc = ctx.createOscillator();
      osc.frequency.value = 1; // 1Hz — completely inaudible
      osc.connect(gainNode);
      osc.start(0);
      silenceNodeRef.current = osc;

      // iOS requires AudioContext to be resumed after a user gesture
      if (ctx.state === "suspended") {
        ctx.resume();
      }
    } catch (e) {
      console.warn("[RADIO] AudioContext keepalive failed:", e);
    }
  };

  const stopAudioKeepAlive = () => {
    try {
      if (silenceNodeRef.current) {
        silenceNodeRef.current.stop?.();
        silenceNodeRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close?.();
        audioCtxRef.current = null;
      }
    } catch (e) {}
  };

  const enableAudioPlayback = () => {
    setIsAudioActive(true);
    isAudioActiveRef.current = true;

    // Start Web Audio keepalive — MUST be called synchronously inside user gesture
    startAudioKeepAlive();

    if (ytPlayerRef.current) {
      try {
        const snap = stateSnapshotRef.current;
        if (snap.started_at > 0 && snap.duration_sec > 0) {
          const baseElapsed = (snap.server_time - snap.started_at) / 1000;
          const localDelta = (Date.now() - snap.local_fetch_at) / 1000;
          const liveElapsed = Math.min(snap.duration_sec, Math.max(0, baseElapsed + localDelta));
          ytPlayerRef.current.seekTo?.(liveElapsed, true);
        }
        ytPlayerRef.current.unMute?.();
        ytPlayerRef.current.setVolume?.(100);
        ytPlayerRef.current.playVideo?.();
      } catch (e) {
        console.error("[RADIO] Playback error:", e);
      }
    }

    // Tell the OS we are actively playing media
    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.playbackState = "playing";
      } catch (e) {}
    }

    showNotice("Live audio connected 🎵");
  };

  const handleConfirmClassSafety = () => {
    sessionStorage.setItem("radio_class_confirmed", "true");
    setShowClassModal(false);
    enableAudioPlayback();
  };

  // ------------------------------------------------------------
  // 6. YouTube Song Search (300ms Debounce + Zero-Flicker)
  // ------------------------------------------------------------
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    const cleanQuery = query.trim();
    latestQueryRef.current = cleanQuery;

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (searchAbortRef.current) searchAbortRef.current.abort();

    if (cleanQuery.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      searchAbortRef.current = controller;

      try {
        const searchUrl = `${API_CONFIG.RADIO_SEARCH_URL}?q=${encodeURIComponent(cleanQuery)}`;
        const resp = await fetch(searchUrl, { signal: controller.signal });
        const data = await resp.json();

        if (latestQueryRef.current === cleanQuery) {
          if (data && data.success && Array.isArray(data.results) && data.results.length > 0) {
            setSearchResults(data.results);
            setShowDropdown(true);
          } else {
            setSearchResults([]);
            setShowDropdown(false);
          }
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("[RADIO SEARCH] Error:", err);
        }
      } finally {
        if (latestQueryRef.current === cleanQuery) {
          setIsSearching(false);
        }
      }
    }, 300);
  };

  // ------------------------------------------------------------
  // 7. Add Song to Queue
  // ------------------------------------------------------------
  const handleAddSong = async (song) => {
    if (!song || isSubmittingSong) return;
    setIsSubmittingSong(true);
    setShowDropdown(false);

    try {
      const token = await getAuthToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const formData = getRadioFormData(studentId, password, {
        videoId: song.videoId,
        title: song.title,
        artist: song.artist,
        duration_sec: song.duration_sec,
        duration_text: song.duration_text,
        thumbnail: song.thumbnail,
      });

      const resp = await fetch(API_CONFIG.RADIO_QUEUE_URL, {
        method: "POST",
        headers,
        body: formData,
      });

      const data = await resp.json();
      if (!resp.ok || !data.success) {
        const errDetail = data.detail || "Failed to add song to queue.";
        showNotice(errDetail);
        if (resp.status === 429 && errDetail.includes("Cooldown")) {
          setCooldownSeconds(600);
        }
        return;
      }

      setRadioState(data);
      setSearchQuery("");
      setSearchResults([]);
      showNotice(`Added "${song.title.slice(0, 24)}" to queue!`);
      setCooldownSeconds(600);
    } catch (err) {
      showNotice(err.message || "Failed to queue song.");
    } finally {
      setIsSubmittingSong(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchResults.length > 0) {
      handleAddSong(searchResults[0]);
    } else if (searchQuery.trim().length >= 2) {
      setIsSearching(true);
      fetch(`${API_CONFIG.RADIO_SEARCH_URL}?q=${encodeURIComponent(searchQuery.trim())}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.results?.[0]) {
            handleAddSong(data.results[0]);
          } else {
            showNotice("No suitable songs found (1-10 min limit).");
          }
        })
        .catch(() => showNotice("Search failed."))
        .finally(() => setIsSearching(false));
    }
  };

  // ------------------------------------------------------------
  // 8. Upvote Song
  // ------------------------------------------------------------
  const handleVote = async (queueId, isVoted) => {
    if (isVoted) {
      showNotice("Already upvoted this track.");
      return;
    }

    setRadioState((prev) => {
      if (!prev || !prev.queue) return prev;
      return {
        ...prev,
        queue: prev.queue.map((item) =>
          item.queue_id === queueId
            ? {
                ...item,
                votes_count: (item.votes_count || 0) + 1,
                user_voted: true,
              }
            : item
        ),
      };
    });

    try {
      const token = await getAuthToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const formData = getRadioFormData(studentId, password, {
        queue_id: queueId,
      });

      const resp = await fetch(API_CONFIG.RADIO_VOTE_URL, {
        method: "POST",
        headers,
        body: formData,
      });

      const data = await resp.json();
      if (data.success) {
        setRadioState(data);
      } else {
        showNotice(data.detail || "Vote failed.");
        fetchRadioState(false);
      }
    } catch (err) {
      fetchRadioState(false);
    }
  };

  // ------------------------------------------------------------
  // 9. Report / Flag Track (Using Native NeoModal)
  // ------------------------------------------------------------
  const handleOpenReportModal = () => {
    if (!radioState?.current_track) return;
    setShowReportModal(true);
  };

  const handleSubmitReport = async () => {
    if (!radioState?.current_track || isSubmittingReport) return;
    setIsSubmittingReport(true);

    try {
      const token = await getAuthToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const formData = getRadioFormData(studentId, password, {
        reason: reportReason,
      });

      const resp = await fetch(API_CONFIG.RADIO_REPORT_URL, {
        method: "POST",
        headers,
        body: formData,
      });

      const data = await resp.json();
      if (data.success) {
        setRadioState(data);
        setShowReportModal(false);
        showNotice("Report submitted. Track skips if threshold reached.");
      } else {
        showNotice(data.detail || "Report failed.");
      }
    } catch (err) {
      showNotice("Failed to report track.");
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const currentTrack = radioState?.current_track;
  const isRadioPlaying = radioState?.status === "playing" && !!currentTrack;
  const durationSec = currentTrack?.duration_sec || 0;
  const progressPercent = durationSec > 0 ? Math.min(100, (currentElapsed / durationSec) * 100) : 0;
  const queueList = radioState?.queue || [];

  return (
    <section className="np-radio-panel">
      {/* Invisible YouTube Audio Bridge (Maintains continuous media pipeline) */}
      <div
        id="radio-youtube-wrapper"
        style={{
          position: "fixed",
          bottom: "0px",
          right: "0px",
          width: "200px",
          height: "200px",
          opacity: 0.001,
          pointerEvents: "none",
          zIndex: -1,
          overflow: "hidden",
        }}
        aria-hidden="true"
      >
        <div ref={ytContainerRef} id="youtube-player" />
      </div>

      {/* Section Header */}
      <div className="np-radio-head">
        <div className="np-radio-head__title">
          <span className="np-radio-head__pulse" />
          <span>campus radio<i>.</i></span>
        </div>

        <button
          type="button"
          className={`np-radio-sound-toggle ${isAudioActive ? "is-live" : ""}`}
          onClick={handleAudioToggleClick}
          aria-label="Toggle radio audio"
        >
          {isAudioActive ? <FiVolume2 size={12} /> : <FiVolumeX size={12} />}
          <span>{isAudioActive ? "sound on" : "tap for sound"}</span>
        </button>
      </div>

      {/* Now Playing NeoPOP Hero Card */}
      <div className={`np-radio-card ${isRadioPlaying ? "is-playing" : "is-idle"}`}>
        <div className="np-radio-card__top">
          <span className="np-radio-card__badge">
            {isRadioPlaying ? "now playing" : "stream idle"}
          </span>
          {isRadioPlaying && (
            <button
              type="button"
              className="np-radio-card__flag"
              onClick={handleOpenReportModal}
              title="Report broken or inappropriate song"
              aria-label="Report song"
            >
              <FiFlag size={12} />
              <span>report</span>
            </button>
          )}
        </div>

        {isRadioPlaying ? (
          <>
            <div className="np-radio-card__title" title={currentTrack.title}>
              {currentTrack.title}
            </div>
            <div className="np-radio-card__meta">
              <span className="np-radio-card__artist">{currentTrack.artist}</span>
              <span className="np-radio-card__sep">·</span>
              <span className="np-radio-card__user">added by {currentTrack.added_by || "anonymous"}</span>
            </div>

            {/* Progress Scrubber */}
            <div className="np-radio-card__progress-wrap">
              <div className="np-radio-card__progress-track">
                <div
                  className="np-radio-card__progress-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="np-radio-card__timestamps">
                <span>{formatTime(currentElapsed)}</span>
                <span>{currentTrack.duration_text || formatTime(durationSec)}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="np-radio-card__idle-state">
            <FiMusic size={20} className="np-radio-card__idle-icon" />
            <div className="np-radio-card__idle-text">no song currently playing.</div>
            <div className="np-radio-card__idle-sub">add a song below to start campus playback!</div>
          </div>
        )}
      </div>

      {/* Song Search & Queue Box */}
      <div className="np-radio-search-box" ref={searchBoxRef}>
        <form className="np-radio-search-form" onSubmit={handleSearchSubmit}>
          <div className="np-radio-search-input-wrap">
            <FiSearch size={14} className="np-radio-search-icon" />
            <input
              type="text"
              className="np-radio-search-input"
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
              placeholder="search song to add to queue…"
              autoComplete="off"
            />
            {isSearching && (
              <FiLoader size={14} className="np-radio-search-spin np-spin" />
            )}
          </div>

          <button
            type="submit"
            className="np-radio-add-btn"
            disabled={isSubmittingSong || (!searchQuery.trim() && searchResults.length === 0)}
          >
            {isSubmittingSong ? "adding…" : "add song"}
          </button>
        </form>

        {/* Feedback / Notice Banner */}
        {feedbackMsg && (
          <div className="np-radio-feedback-banner">
            {feedbackMsg}
          </div>
        )}

        {/* Cooldown active warning */}
        {cooldownSeconds > 0 && !feedbackMsg && (
          <div className="np-radio-cooldown-banner">
            cooldown active: wait {Math.floor(cooldownSeconds / 60)}m {cooldownSeconds % 60}s before adding another song
          </div>
        )}

        {/* Search Results Dropdown */}
        {showDropdown && searchResults.length > 0 && (
          <div className="np-radio-dropdown">
            <div className="np-radio-dropdown__head">
              <span>select track to queue</span>
              <button
                type="button"
                className="np-radio-dropdown__close"
                onClick={() => setShowDropdown(false)}
              >
                ✕
              </button>
            </div>
            <div className="np-radio-dropdown__list">
              {searchResults.map((item) => (
                <div
                  key={item.videoId}
                  className="np-radio-dropdown__item"
                  onClick={() => handleAddSong(item)}
                >
                  <img
                    src={item.thumbnail}
                    alt=""
                    className="np-radio-dropdown__thumb"
                    loading="lazy"
                  />
                  <div className="np-radio-dropdown__info">
                    <div className="np-radio-dropdown__title">{item.title}</div>
                    <div className="np-radio-dropdown__meta">
                      {item.artist} · {item.duration_text || formatTime(item.duration_sec)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="np-radio-dropdown__btn"
                    aria-label="Queue song"
                  >
                    <FiPlus size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Up Next Queue Section */}
      <div className="np-radio-queue">
        <div className="np-radio-queue__head">
          <span className="np-panel__label" style={{ marginBottom: 0 }}>up next in queue</span>
          {queueList.length > 0 && (
            <span className="np-radio-queue__count">{queueList.length} tracks</span>
          )}
        </div>

        {queueList.length === 0 ? (
          <div className="np-radio-queue__empty">
            no songs in queue. search and be the first to queue!
          </div>
        ) : (
          <div className="np-radio-queue__board">
            {queueList.map((item, idx) => (
              <div key={item.queue_id} className="np-radio-queue__row">
                <div className={`np-board__rank ${idx === 0 ? "np-board__rank--top" : ""}`}>
                  {idx + 1}
                </div>

                <div className="np-radio-queue__details">
                  <div className="np-radio-queue__song">{item.title}</div>
                  <div className="np-radio-queue__by">
                    <span>{item.added_by}</span>
                    {item.duration_text && (
                      <span style={{ opacity: 0.6 }}> · {item.duration_text}</span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  className={`np-radio-queue__vote-btn ${item.user_voted ? "is-voted" : ""}`}
                  onClick={() => handleVote(item.queue_id, item.user_voted)}
                  aria-label={`Upvote ${item.title}`}
                >
                  <FiChevronUp size={15} />
                  <span>{item.votes_count || 1}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Classroom Safety Confirmation Modal */}
      <NeoModal
        open={showClassModal}
        title="classroom check 🤫"
        onClose={() => setShowClassModal(false)}
      >
        <div style={{ textAlign: "center", padding: "10px 4px" }}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>🎧</div>
          <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "8px", color: "var(--np-cream)" }}>
            are you sure you're not in an active class?
          </h3>
          <p className="np-note" style={{ fontSize: "13px", lineHeight: "1.45", marginBottom: "22px" }}>
            Make sure your earphones are connected or you're on a break so music doesn't blast out loud in the lecture hall!
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <NeoButton type="button" onClick={handleConfirmClassSafety}>
              yes, I'm safe · play sound
            </NeoButton>
            <button
              type="button"
              className="np-btn np-btn--ghost"
              style={{ padding: "10px", width: "100%" }}
              onClick={() => setShowClassModal(false)}
            >
              stay muted
            </button>
          </div>
        </div>
      </NeoModal>

      {/* Report Track Modal (Replaces browser window.confirm) */}
      <NeoModal
        open={showReportModal}
        title="report track 🚩"
        onClose={() => setShowReportModal(false)}
      >
        <div style={{ padding: "8px 2px" }}>
          <div style={{ fontSize: "14px", fontWeight: "700", marginBottom: "4px", color: "var(--np-cream)" }}>
            {currentTrack?.title}
          </div>
          <div className="np-note" style={{ marginBottom: "16px" }}>
            Report inappropriate audio or broken streams. Track will automatically skip when threshold is reached.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
            {REPORT_REASONS.map((r) => (
              <label
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 12px",
                  background: reportReason === r.id ? "var(--np-carbon)" : "var(--np-well)",
                  border: `1px solid ${reportReason === r.id ? "var(--np-acid)" : "var(--np-line)"}`,
                  cursor: "pointer",
                  fontFamily: "var(--np-font-ui)",
                  fontSize: "12.5px",
                  color: reportReason === r.id ? "var(--np-acid)" : "var(--np-cream)",
                }}
              >
                <input
                  type="radio"
                  name="reportReason"
                  value={r.id}
                  checked={reportReason === r.id}
                  onChange={(e) => setReportReason(e.target.value)}
                  style={{ accentColor: "var(--np-acid)" }}
                />
                <span>{r.label}</span>
              </label>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <NeoButton
              type="button"
              onClick={handleSubmitReport}
              loading={isSubmittingReport}
              loadingText="submitting…"
            >
              submit report
            </NeoButton>
            <button
              type="button"
              className="np-btn np-btn--ghost"
              style={{ padding: "10px", width: "100%" }}
              onClick={() => setShowReportModal(false)}
            >
              cancel
            </button>
          </div>
        </div>
      </NeoModal>
    </section>
  );
}
