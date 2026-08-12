import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowLeft, FiAward, FiPlay, FiRefreshCw, FiZap, FiWifiOff } from "react-icons/fi";
import NeoShell from "../Shell.jsx";
import { NeoButton } from "../NeoKit.jsx";
import Toast from "../../components/Toast.jsx";
import { API_CONFIG } from "../../config/api.js";
import { getCredentials } from "../../../utils/storage.js";
import { getCSSColor } from "../utils/themeEngine";

function getCampus(userId) {
  if (!userId || userId.length < 5) return null;
  return userId.slice(2, 5) === "000" ? "VIJ" : "HYD";
}

// Web Audio API synthesized sound generator (100% offline cache compatible)
class SoundFx {
  constructor() {
    this.ctx = null;
  }
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }
  jump() {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(400, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    } catch (e) { /* ignore */ }
  }
  score() {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(900, this.ctx.currentTime);
      osc.frequency.setValueAtTime(1400, this.ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.2);
    } catch (e) { /* ignore */ }
  }
  hit() {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.15);
    } catch (e) { /* ignore */ }
  }
}

const sfx = new SoundFx();

export default function FlappyBirdPage() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);

  const [tab, setTab] = useState("game"); // "game" | "leaderboard"
  const [gameState, setGameState] = useState("IDLE"); // "IDLE" | "PLAYING" | "GAMEOVER"
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [mode, setMode] = useState("RANKED"); // "RANKED" | "CASUAL"
  const [gameToken, setGameToken] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [rankInfo, setRankInfo] = useState(null);
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLb, setLoadingLb] = useState(false);

  const creds = getCredentials();
  const username = creds?.username || "Player";

  // Game loop state refs
  const gameRef = useRef({
    birdY: 200,
    velocity: 0,
    gravity: 0.42,
    jumpForce: -7.2,
    pipes: [],
    frameCount: 0,
    score: 0,
    passedPipeIds: new Set(),
    animId: null,
  });

  const fetchLeaderboard = async () => {
    setLoadingLb(true);
    try {
      const res = await fetch(`${API_CONFIG.GAME_LEADERBOARD_URL}?gameId=flappy-bird`);
      const data = await res.json();
      if (data.success) {
        setLeaderboard(data.leaderboard || []);
      }
    } catch {
      // offline fallback
    } finally {
      setLoadingLb(false);
    }
  };

  useEffect(() => {
    if (tab === "leaderboard") {
      fetchLeaderboard();
    }
  }, [tab]);

  // Start game session (Online JWT or Offline Casual)
  const startGame = async () => {
    sfx.init();
    setGameState("PLAYING");
    setScore(0);
    setRankInfo(null);
    setGameToken(null);

    const isOnline = navigator.onLine;

    if (isOnline) {
      setMode("RANKED");
      try {
        const res = await fetch(API_CONFIG.GAME_START_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: username, gameId: "flappy-bird" }),
        });
        const data = await res.json();
        if (data.success && data.gameToken) {
          setGameToken(data.gameToken);
        } else {
          setMode("CASUAL");
        }
      } catch {
        setMode("CASUAL");
      }
    } else {
      setMode("CASUAL");
      setToast({
        show: true,
        message: "Playing in Offline Casual Mode. Connect to internet to submit scores.",
        type: "info",
      });
    }

    // Reset physics
    gameRef.current = {
      birdY: 200,
      velocity: 0,
      gravity: 0.42,
      jumpForce: -7.2,
      pipes: [],
      frameCount: 0,
      score: 0,
      passedPipeIds: new Set(),
      animId: null,
    };

    sfx.jump();
    runGameLoop();
  };

  const handleFlap = () => {
    if (gameState === "IDLE") {
      startGame();
    } else if (gameState === "PLAYING") {
      gameRef.current.velocity = gameRef.current.jumpForce;
      sfx.jump();
    } else if (gameState === "GAMEOVER") {
      startGame();
    }
  };

  // Main canvas render loop
  const runGameLoop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const GROUND_H = 60;
    const PLAY_H = H - GROUND_H;

    const loop = () => {
      const g = gameRef.current;
      g.frameCount++;

      // Physics update
      g.velocity += g.gravity;
      g.birdY += g.velocity;

      // Spawn pipes
      if (g.frameCount % 95 === 0) {
        const gap = 120;
        const minTop = 50;
        const maxTop = PLAY_H - gap - 50;
        const topH = Math.floor(Math.random() * (maxTop - minTop + 1)) + minTop;
        g.pipes.push({
          id: g.frameCount,
          x: W,
          topH: topH,
          bottomY: topH + gap,
          passed: false,
        });
      }

      // Move pipes & update score
      g.pipes.forEach((p) => {
        p.x -= 2.2;
        if (!p.passed && p.x + 48 < 90) {
          p.passed = true;
          g.score += 1;
          setScore(g.score);
          sfx.score();
        }
      });

      // Remove offscreen pipes
      g.pipes = g.pipes.filter((p) => p.x > -60);

      // Collision checks
      const birdX = 90;
      const birdR = 14;
      let hit = false;

      // Sky / Ground collision
      if (g.birdY - birdR <= 0 || g.birdY + birdR >= PLAY_H) {
        hit = true;
      }

      // Pipe collisions
      for (let p of g.pipes) {
        if (birdX + birdR > p.x && birdX - birdR < p.x + 48) {
          if (g.birdY - birdR < p.topH || g.birdY + birdR > p.bottomY) {
            hit = true;
            break;
          }
        }
      }

      if (hit) {
        sfx.hit();
        endGame(g.score);
        return;
      }

      // --- RENDER ---
      // Sky backdrop
      ctx.fillStyle = "#0d0e15";
      ctx.fillRect(0, 0, W, H);

      // Grid background pattern
      ctx.strokeStyle = "rgba(42, 42, 49, 0.4)";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, PLAY_H);
        ctx.stroke();
      }
      for (let y = 0; y < PLAY_H; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      // Draw Pipes (Neo-brutalist style with acid green & thick black borders)
      g.pipes.forEach((p) => {
        // Top pipe
        ctx.fillStyle = getCSSColor("--np-acid");
        ctx.fillRect(p.x, 0, 48, p.topH);
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 3;
        ctx.strokeRect(p.x, 0, 48, p.topH);

        // Top pipe rim
        ctx.fillStyle = getCSSColor("--np-acid-mid");
        ctx.fillRect(p.x - 3, p.topH - 16, 54, 16);
        ctx.strokeRect(p.x - 3, p.topH - 16, 54, 16);

        // Bottom pipe
        const botH = PLAY_H - p.bottomY;
        ctx.fillStyle = getCSSColor("--np-acid");
        ctx.fillRect(p.x, p.bottomY, 48, botH);
        ctx.strokeRect(p.x, p.bottomY, 48, botH);

        // Bottom pipe rim
        ctx.fillStyle = getCSSColor("--np-acid-mid");
        ctx.fillRect(p.x - 3, p.bottomY, 54, 16);
        ctx.strokeRect(p.x - 3, p.bottomY, 54, 16);
      });

      // Draw Ground
      ctx.fillStyle = getCSSColor("--np-panel");
      ctx.fillRect(0, PLAY_H, W, GROUND_H);
      ctx.strokeStyle = getCSSColor("--np-acid");
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, PLAY_H);
      ctx.lineTo(W, PLAY_H);
      ctx.stroke();

      // Ground pattern lines
      ctx.strokeStyle = getCSSColor("--np-line");
      ctx.lineWidth = 2;
      const groundOffset = (g.frameCount * 2.2) % 20;
      for (let x = -20; x < W + 20; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x - groundOffset, PLAY_H);
        ctx.lineTo(x - groundOffset + 10, H);
        ctx.stroke();
      }

      // Draw Bird
      ctx.save();
      ctx.translate(birdX, g.birdY);
      const angle = Math.min(Math.max(g.velocity * 0.06, -0.5), 0.7);
      ctx.rotate(angle);

      // Bird body (Neon Acid / Gold)
      ctx.fillStyle = getCSSColor("--np-pink");
      ctx.beginPath();
      ctx.arc(0, 0, birdR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Eye
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(5, -4, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(6.5, -4, 2, 0, Math.PI * 2);
      ctx.fill();

      // Beak
      ctx.fillStyle = getCSSColor("--np-acid");
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(18, 3);
      ctx.lineTo(10, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Wing
      ctx.fillStyle = "#ff577f";
      ctx.beginPath();
      ctx.ellipse(-4, 3, 6, 4, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.restore();

      // HUD Score display
      ctx.fillStyle = getCSSColor("--np-cream");
      ctx.font = "bold 32px 'Archivo Black', sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = "#000";
      ctx.shadowBlur = 4;
      ctx.fillText(g.score.toString(), W / 2, 50);
      ctx.shadowBlur = 0;

      g.animId = requestAnimationFrame(loop);
    };

    gameRef.current.animId = requestAnimationFrame(loop);
  };

  // Game Over Handler
  const endGame = async (finalScore) => {
    if (gameRef.current.animId) {
      cancelAnimationFrame(gameRef.current.animId);
    }
    setGameState("GAMEOVER");
    setScore(finalScore);

    if (finalScore > highScore) {
      setHighScore(finalScore);
    }

    const isOnline = navigator.onLine;

    // RULE ENFORCEMENT: Offline Mode vs Online Leaderboard Submission
    if (!isOnline || mode === "CASUAL" || !gameToken) {
      setToast({
        show: true,
        message: "Offline score – connect to internet to submit to leaderboard",
        type: "error",
      });
      // DISCARD SCORE LOCALLY: Zero local storage score queues!
      return;
    }

    // Online submission with JWT anti-cheat verification
    setSubmitting(true);
    try {
      const res = await fetch(API_CONFIG.GAME_SUBMIT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameToken: gameToken,
          score: finalScore,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRankInfo({ rank: data.rank, message: data.message });
        setToast({
          show: true,
          message: `Rank #${data.rank} achieved on global leaderboard!`,
          type: "success",
        });
      } else {
        setToast({
          show: true,
          message: data.detail || "Score verification failed.",
          type: "error",
        });
      }
    } catch {
      setToast({
        show: true,
        message: "Network error submitting score.",
        type: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <NeoShell>
      <div className="np-pagehead">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="np-minibtn" onClick={() => navigate("/home")} aria-label="Back to Home">
            <FiArrowLeft size={14} /> home
          </button>
          <span className="np-eyebrow">break time arcade</span>
        </div>
        <div className="np-pagehead__row" style={{ marginTop: 8 }}>
          <h1 className="np-pagehead__title">flappy bird<i>.</i></h1>
          <span className={`np-chip ${mode === "RANKED" ? "np-chip--acid" : "np-chip--pink"}`}>
            {mode === "RANKED" ? "RANKED MODE" : "CASUAL (OFFLINE)"}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="np-row" style={{ marginBottom: 16 }}>
        <button
          className={`np-minibtn ${tab === "game" ? "primary" : "secondary"}`}
          style={{ flex: 1, padding: "10px 0" }}
          onClick={() => setTab("game")}
        >
          <FiPlay size={13} style={{ marginRight: 6 }} /> play game
        </button>
        <button
          className={`np-minibtn ${tab === "leaderboard" ? "primary" : "secondary"}`}
          style={{ flex: 1, padding: "10px 0" }}
          onClick={() => setTab("leaderboard")}
        >
          <FiAward size={13} style={{ marginRight: 6 }} /> leaderboard
        </button>
      </div>

      {tab === "game" && (
        <div className="np-game-wrapper">
          <div className="np-game-canvas-box" onClick={handleFlap}>
            <canvas ref={canvasRef} width={360} height={480} className="np-game-canvas" />

            {/* Overlays */}
            {gameState === "IDLE" && (
              <div className="np-game-overlay">
                <div style={{ fontSize: 44, marginBottom: 8 }}>🐤</div>
                <h2 className="np-game-overlay__title">flappy bird</h2>
                <p className="np-game-overlay__sub">
                  Tap screen or press Spacebar to flap wing and navigate pipes.
                </p>
                {!navigator.onLine && (
                  <div className="np-chip np-chip--pink" style={{ marginBottom: 14 }}>
                    <FiWifiOff size={11} style={{ marginRight: 4 }} /> OFFLINE CASUAL MODE
                  </div>
                )}
                <NeoButton type="button" onClick={startGame}>
                  tap to play
                </NeoButton>
              </div>
            )}

            {gameState === "GAMEOVER" && (
              <div className="np-game-overlay">
                <h2 className="np-game-overlay__title" style={{ color: "var(--np-pink)" }}>
                  game over
                </h2>
                <div className="np-game-score-badge">{score}</div>
                <p className="np-game-overlay__sub">
                  {rankInfo
                    ? `Leaderboard Rank #${rankInfo.rank}`
                    : mode === "CASUAL"
                    ? "Offline score – connect to internet to submit to leaderboard"
                    : submitting
                    ? "verifying score…"
                    : "Tap below to try again"}
                </p>
                <NeoButton type="button" onClick={startGame}>
                  play again
                </NeoButton>
              </div>
            )}
          </div>

          <div
            className="np-note"
            style={{
              marginTop: 14,
              textAlign: "center",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <FiZap size={13} color="var(--np-acid)" />
            <span>Anti-cheat secured JWT session loop · 60 FPS Canvas</span>
          </div>
        </div>
      )}

      {tab === "leaderboard" && (
        <section className="np-panel">
          <div
            className="np-panel__label"
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
          >
            <span>top 3 leaderboard</span>
            <button className="np-minibtn" onClick={fetchLeaderboard} disabled={loadingLb}>
              <FiRefreshCw size={11} className={loadingLb ? "np-spin" : undefined} />
            </button>
          </div>

          {leaderboard.length === 0 ? (
            <p className="np-note" style={{ padding: "20px 0", textAlign: "center" }}>
              {loadingLb ? "fetching leaderboard…" : "No leaderboard records found yet. Play and be #1!"}
            </p>
          ) : (
            <div className="np-leaderboard-list">
              {leaderboard.slice(0, 3).map((item, index) => {
                const badges = ["🥇", "🥈", "🥉"];
                const idDisplay = item.userId || item.username || "Player";
                return (
                  <div
                    key={index}
                    className="np-leaderboard-row np-leaderboard-row--top"
                  >
                    <span className="np-leaderboard-rank" style={{ fontSize: 16 }}>
                      {badges[index] || `#${index + 1}`}
                    </span>
                    <span className="np-leaderboard-user" style={{ fontFamily: "var(--np-font-ui)", letterSpacing: "0.05em" }}>
                      ID: {idDisplay}
                      {(() => {
                        const campus = getCampus(idDisplay);
                        if (!campus) return null;
                        const isVij = campus === "VIJ";
                        return (
                          <span style={{
                            marginLeft: 5,
                            fontSize: "0.7em",
                            fontFamily: "var(--np-font-ui)",
                            letterSpacing: "0.12em",
                            fontWeight: 700,
                            color: isVij ? getCSSColor("--np-acid") : getCSSColor("--np-pink"),
                            opacity: 0.85,
                            verticalAlign: "middle",
                          }}>{campus}</span>
                        );
                      })()}
                    </span>
                    <span className="np-leaderboard-score">{item.score} pts</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />
    </NeoShell>
  );
}
