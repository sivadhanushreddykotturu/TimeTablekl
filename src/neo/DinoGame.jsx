import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { API_CONFIG } from "../config/api.js";
import { getCredentials } from "../../utils/storage.js";

// Minimal neoPOP dino runner. Point per obstacle dodged.
// Online: JWT-verified runs submit to the leaderboard (top 3 shown).
// Offline: casual mode — score is discarded, never saved.
export default function DinoGame({ onPhaseChange }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const tokenRef = useRef(null);      // signed game token for the active run
  const casualRef = useRef(false);    // true = run not eligible for leaderboard
  const startReqRef = useRef(null);   // in-flight /game/start promise
  const jumpRef = useRef(() => {});   // exposed for the full-screen tap layer

  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState("idle"); // idle | run | over
  const [hint, setHint] = useState("");
  const [board, setBoard] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("dino_board") || "[]");
    } catch {
      return [];
    }
  });

  const userId = getCredentials()?.username || "";

  const loadLeaderboard = useCallback(async () => {
    try {
      const res = await axios.get(API_CONFIG.GAME_LEADERBOARD_URL, {
        params: { gameId: "dino", limit: 3 },
        timeout: 8000,
      });
      if (res.data?.success) {
        const lb = res.data.leaderboard || [];
        setBoard(lb);
        localStorage.setItem("dino_board", JSON.stringify(lb));
      }
    } catch {
      // silent — leaderboard is a bonus, never block the game
    }
  }, []);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  // Keep ranks fresh while the app is open (pause when tab is hidden).
  useEffect(() => {
    const tick = setInterval(() => {
      if (!document.hidden) loadLeaderboard();
    }, 30000);
    return () => clearInterval(tick);
  }, [loadLeaderboard]);

  // Request a signed token for a fresh run. Falls back to casual mode on any failure.
  const armRun = useCallback(() => {
    tokenRef.current = null;
    casualRef.current = false;

    if (navigator.onLine === false || !userId) {
      casualRef.current = true;
      return Promise.resolve();
    }

    const form = new FormData();
    form.append("userId", userId);
    form.append("gameId", "dino");

    const req = axios
      .post(API_CONFIG.GAME_START_URL, form, { timeout: 8000 })
      .then((res) => {
        if (res.data?.success && res.data.token) {
          tokenRef.current = res.data.token;
        } else {
          casualRef.current = true;
        }
      })
      .catch(() => {
        casualRef.current = true; // backend unreachable — casual run
      });

    startReqRef.current = req;
    return req;
  }, [userId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const H = 120;
    const GROUND = H - 22;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);

    let W = 0;
    let raf = 0;
    let last = 0;

    const st = {
      dino: { x: 26, y: GROUND, vy: 0, size: 18, grounded: true },
      obs: [],
      speed: 5,
      score: 0,
      over: false,
      running: false,
      spawnIn: 55,
      flap: 0,
    };

    const resize = () => {
      // content-box width: clientWidth includes the section's padding, which
      // would push the canvas (and ground line) past the right edge
      const cs = getComputedStyle(wrapRef.current);
      W = wrapRef.current.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      canvas.width = W * DPR;
      canvas.height = H * DPR;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const reset = () => {
      st.dino.y = GROUND;
      st.dino.vy = 0;
      st.dino.grounded = true;
      st.obs = [];
      st.speed = 5;
      st.score = 0;
      st.over = false;
      st.spawnIn = 55;
      setScore(0);
    };

    const submitScore = async (finalScore) => {
      // Nothing worth submitting.
      if (finalScore <= 0) return;
      // Offline / casual run: discard immediately, never touch local storage.
      if (casualRef.current || !tokenRef.current) {
        setHint(
          navigator.onLine === false
            ? "offline score – connect to internet to submit to leaderboard"
            : "casual run – score not submitted"
        );
        loadLeaderboard(); // still show fresh ranks after the run
        return;
      }
      const token = tokenRef.current;
      tokenRef.current = null; // single use, client-side too

      try {
        const form = new FormData();
        form.append("token", token);
        form.append("score", String(finalScore));
        const res = await axios.post(API_CONFIG.GAME_SUBMIT_URL, form, { timeout: 8000 });
        if (res.data?.success) {
          if (Array.isArray(res.data.leaderboard)) {
            setBoard(res.data.leaderboard);
            localStorage.setItem("dino_board", JSON.stringify(res.data.leaderboard));
          }
          setHint(`submitted · best ${Number(res.data.best || finalScore)}`);
        } else {
          setHint("score rejected by server");
          loadLeaderboard();
        }
      } catch (err) {
        const msg = err?.response?.data?.detail;
        setHint(msg ? `rejected · ${msg}` : "submit failed – network error");
        loadLeaderboard();
      }
    };

    const jump = () => {
      if (st.over) {
        reset();
        st.running = true;
        setPhase("run");
        setHint("");
        armRun();
        return;
      }
      if (!st.running) {
        st.running = true;
        setPhase("run");
        setHint("");
        armRun();
      }
      if (st.dino.grounded) {
        st.dino.vy = -7.4;
        st.dino.grounded = false;
      }
    };

    const onKey = (e) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        jump();
      }
    };
    jumpRef.current = jump;

    const onTap = () => jump();
    const tapTarget = wrapRef.current; // whole card is the jump button (phone-friendly)
    tapTarget.addEventListener("pointerdown", onTap);
    window.addEventListener("keydown", onKey);

    const spawn = () => {
      const s = st.score;
      const roll = Math.random();
      // flyers only appear once you're warmed up
      const flyChance = s < 3 ? 0 : Math.min(0.22 + s * 0.012, 0.45);

      if (roll < flyChance) {
        // flyer: low enough to run under, high enough to die if you jump
        const alt = 30 + Math.random() * 10; // bottom edge height above ground
        st.obs.push({
          x: W + 20, w: 16, h: 12,
          bottom: GROUND - alt,
          fly: true, counted: false,
        });
      } else {
        // ground block — gets taller/wider as score climbs; doubles later
        const tall = Math.random() > 0.45;
        const w = tall ? 12 : 18 + Math.min(s, 14);
        const h = tall ? 26 + Math.min(s * 0.4, 10) : 14;
        st.obs.push({
          x: W + 20, w, h,
          bottom: GROUND,
          fly: false, counted: false,
        });
        // double block trap after 8 points
        if (s >= 8 && Math.random() > 0.6) {
          st.obs.push({
            x: W + 20 + w + 14 + Math.random() * 10,
            w: 12, h: 20,
            bottom: GROUND,
            fly: false, counted: false,
          });
        }
      }

      // tighter gaps as score climbs
      const base = Math.max(34, 62 - s * 1.1);
      st.spawnIn = base + Math.random() * 42;
    };

    const step = (t) => {
      const dt = Math.min((t - last) / 16.7, 2) || 1;
      last = t;
      const d = st.dino;

      if (st.running && !st.over) {
        // physics — snappier gravity for tighter control
        d.y += d.vy * dt;
        d.vy += 0.46 * dt;
        if (d.y >= GROUND) {
          d.y = GROUND;
          d.vy = 0;
          d.grounded = true;
        }

        st.flap += dt * 0.35;

        // obstacles
        st.spawnIn -= dt;
        if (st.spawnIn <= 0) spawn();
        for (const o of st.obs) {
          o.x -= st.speed * dt;
          // point per obstacle dodged
          if (!o.counted && o.x + o.w < d.x) {
            o.counted = true;
            st.score += 1;
            setScore(st.score);
          }
        }
        st.obs = st.obs.filter((o) => o.x + o.w > -10);

        // speed climbs with every point
        st.speed = Math.min(5 + st.score * 0.22, 11);

        // collision (AABB, slightly forgiving)
        for (const o of st.obs) {
          const oTop = o.bottom - o.h;
          if (
            d.x + 3 < o.x + o.w &&
            d.x + d.size - 3 > o.x &&
            d.y - d.size + 3 < o.bottom &&
            d.y - 1 > oTop
          ) {
            st.over = true;
            st.running = false;
            setPhase("over");
            submitScore(st.score);
          }
        }
      }

      // ---- draw ----
      ctx.clearRect(0, 0, W, H);

      // ground
      ctx.fillStyle = "#2a2a30";
      ctx.fillRect(0, GROUND + 1, W, 2);

      // obstacles
      for (const o of st.obs) {
        const oTop = o.bottom - o.h;
        if (o.fly) {
          // pink flyer with flapping wing
          ctx.fillStyle = "#ff2e63";
          ctx.fillRect(o.x, oTop, o.w, o.h);
          ctx.fillStyle = "#cfff04";
          const wingUp = Math.sin(st.flap) > 0;
          ctx.fillRect(
            o.x + 3,
            wingUp ? oTop - 5 : oTop + o.h - 2,
            7, 3
          );
        } else {
          ctx.fillStyle = "#6533f4";
          ctx.fillRect(o.x, oTop, o.w, o.h);
        }
      }

      // dino (acid square, mid-air tilt)
      ctx.save();
      ctx.translate(d.x + d.size / 2, d.y - d.size / 2);
      if (!d.grounded) ctx.rotate(d.vy * 0.03);
      ctx.fillStyle = "#cfff04";
      ctx.fillRect(-d.size / 2, -d.size / 2, d.size, d.size);
      ctx.fillStyle = "#0a0a0c";
      ctx.fillRect(d.size / 4 - 1, -d.size / 4, 3, 3);
      ctx.restore();

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKey);
      tapTarget.removeEventListener("pointerdown", onTap);
    };
  }, [armRun, loadLeaderboard]);

  // let the parent dim the rest of the page during a run
  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  return (
    <section className="np-dino" ref={wrapRef}>
      <div className="np-dino__hud">
        <span className="np-panel__label">bored?</span>
        <span className="np-dino__score">
          {String(score).padStart(4, "0")}
        </span>
      </div>

      <canvas ref={canvasRef} className="np-dino__canvas" />
      <div className="np-dino__hint">
        {hint ||
          (phase === "idle" && "tap to run · jump blocks · dodge flyers") ||
          (phase === "over" && `game over · ${score} dodged · tap to retry`)}
      </div>

      {/* top 3 — below the game, dims while playing */}
      {board.length > 0 && (
        <div className={`np-board${phase === "run" ? " np-board--dim" : ""}`}>
          {board.map((entry, i) => (
            <div className="np-board__row" key={`${entry.userId}-${i}`}>
              <span className={`np-board__rank${i === 0 ? " np-board__rank--top" : ""}`}>
                {i + 1}
              </span>
              <span className="np-board__id">{entry.userId}</span>
              <span className="np-board__score">{entry.score}</span>
            </div>
          ))}
        </div>
      )}

      {/* while running: the entire screen (incl. footer) is the jump button */}
      {phase === "run" && (
        <div
          className="np-jump-layer"
          onPointerDown={(e) => {
            e.preventDefault();
            jumpRef.current();
          }}
        />
      )}
    </section>
  );
}
