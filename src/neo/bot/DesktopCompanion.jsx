// DesktopCompanion.jsx — Static ambient desktop mascot
// Fixed in place (not draggable): calm bloub port with cursor-following gaze,
// click reactions, a theme-colored body, and random shape-shifting.

import React, { useEffect, useRef, useState, useCallback } from 'react'
import BloubBot from './BloubBot.jsx'
import { useAutonomousLife } from './useAutonomousLife.js'
import { STATE_BY_ID } from './states.js'
import { SHAPES, DEFAULT_SHAPE_INDEX } from './shapes.js'
import { EXPRESSIONS } from './expressions.js'
import { clamp } from './math.js'
import { getCSSColor } from '../utils/themeEngine'

const BOT_SIZE = 190

// Gaze reach in degrees — chosen, not measured (bloub src/ui/gaze.ts)
const YAW_MAX = 16
const PITCH_MAX = 13
const PITCH_BASE = 10

// Single-click reactions — one quick expressive state, picked at random
const CLICK_STATES = ['wink', 'wide', 'egg', 'hexagon', 'burst', 'exclaim']

// Approximate eye positions relative to the bot's center (viewBox 400 → 190px),
// where the projection beams originate
const EYE_OFFSETS = [
  { dx: -15, dy: -12 },
  { dx: 15, dy: -12 }
]

// Every rest expression (expressions.js) is used, but in two tiers:
// CALM faces read well as a held resting face, so they linger;
// QUICK faces (asymmetric or grumpy — a held "suspicious" looks like a stuck
// wink) flash by for a few seconds and always land back on a calm one.
const CALM_FACES = ['neutral', 'attentive', 'surprised', 'excited', 'happy', 'laughing', 'proud']
const QUICK_FACES = ['suspicious', 'confused', 'angry', 'sad', 'scared', 'shy', 'unimpressed', 'sleepy']

function pickFrom(pool, prev) {
  const candidates = pool.filter((id) => id !== prev)
  return candidates[Math.floor(Math.random() * candidates.length)]
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min)
}

/**
 * Fixed resting spot: bottom-left corner, just above the bottom nav (76px).
 * The 190px box carries ~38px of transparent padding around the visible ball
 * (radius 120 of a 400-unit viewBox), so the box sits 10px off the left edge
 * to land the BALL ~28px from it — close to the corner, not glued to it.
 */
const NAV_H = 76
function getHomePos() {
  const h = typeof window !== 'undefined' ? window.innerHeight : 800
  return {
    x: -10,
    y: Math.max(16, h - NAV_H - BOT_SIZE)
  }
}

function readBotColors() {
  return {
    ink: getCSSColor('--np-acid') || '#161622',
    eye: getCSSColor('--np-acid-text') || '#ffffff'
  }
}

export default function DesktopCompanion() {
  const botRef = useRef(null)

  // ── Gaze target (caught up with inertia inside BloubBot) ──
  const lookRef = useRef({ yaw: 0, pitch: PITCH_BASE, mix: 0, wander: 1 })

  // ── Live eye centers (viewBox units), fed by BloubBot every frame ──
  const eyePosRef = useRef(null)

  // ── Theme-colored body/eyes (follows the customization theme) ──
  const [botColors, setBotColors] = useState(readBotColors)

  // ── Random shape-shifting ──
  const [shapeIdx, setShapeIdx] = useState(DEFAULT_SHAPE_INDEX)

  // ── Random rest-expression drift ──
  const [expressionId, setExpressionId] = useState('neutral')
  const expressionRef = useRef('neutral')

  // ── Click reactions ──
  const [clickState, setClickState] = useState(null)
  const clickTimerRef = useRef(null)

  // ── Announcement: the bot carries the dot while one is active, and a
  //    click projects it — reopenable any number of times ──
  const [announcement, setAnnouncement] = useState(null)
  const [projecting, setProjecting] = useState(false)
  const projectingRef = useRef(false)
  const [winH, setWinH] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 800))

  // ── Fixed position ──
  const posRef = useRef(getHomePos())

  // ── Autonomous life (quiet) ──
  const autoState = useAutonomousLife()

  const hasAnnouncement = Boolean(announcement)

  const finalState = projecting || hasAnnouncement ? 'notify' : (clickState ?? autoState ?? 'idle')
  const finalStateRef = useRef(finalState)
  finalStateRef.current = finalState

  // Place the bot at its home spot, on mount and whenever the window resizes
  const placeBot = useCallback(() => {
    const p = getHomePos()
    posRef.current = p
    setWinH(window.innerHeight)
    if (botRef.current) {
      botRef.current.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`
    }
  }, [])

  useEffect(() => {
    placeBot()
    window.addEventListener('resize', placeBot)
    return () => window.removeEventListener('resize', placeBot)
  }, [placeBot])

  // ── Fetch the active announcement (same source as the old banner) ──
  useEffect(() => {
    let cancelled = false
    fetch(`/announcements.json?t=${Date.now()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && data.active) setAnnouncement(data)
      })
      .catch(() => { /* no announcement reachability — bot just stays calm */ })
    return () => { cancelled = true }
  }, [])

  // ── Repaint when the theme changes (CSS vars are set on <html>) ──
  useEffect(() => {
    const update = () => setBotColors(readBotColors())
    const obs = new MutationObserver(update)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
    update()
    return () => obs.disconnect()
  }, [])

  // ── Shape-shift on its own every 25–45 s (never repeats back-to-back) ──
  useEffect(() => {
    let timer
    const tick = () => {
      setShapeIdx((prev) => {
        let next = prev
        while (next === prev && SHAPES.length > 1) {
          next = Math.floor(Math.random() * SHAPES.length)
        }
        return next
      })
      timer = setTimeout(tick, randomBetween(25000, 45000))
    }
    timer = setTimeout(tick, randomBetween(12000, 20000))
    return () => clearTimeout(timer)
  }, [])

  // ── Mood drift: random rest expressions — calm ones hold 10–20 s,
  //    awkward ones flash by in ~3 s and always settle back on a calm face ──
  useEffect(() => {
    let timer
    const tick = () => {
      const prev = expressionRef.current
      const next =
        QUICK_FACES.includes(prev) || Math.random() >= 0.35
          ? pickFrom(CALM_FACES, prev)
          : pickFrom(QUICK_FACES, prev)
      expressionRef.current = next
      setExpressionId(next)
      timer = setTimeout(
        tick,
        QUICK_FACES.includes(next) ? randomBetween(2500, 3500) : randomBetween(10000, 20000)
      )
    }
    timer = setTimeout(tick, randomBetween(5000, 9000))
    return () => clearTimeout(timer)
  }, [])

  // ── Gaze tracking: follow the cursor, measured from the bot's own center ──
  useEffect(() => {
    let idleTimer
    const release = () => {
      if (projectingRef.current) return // the projection holds the gaze on the panel
      lookRef.current = { ...lookRef.current, mix: 0, wander: 1 }
    }
    const onMove = (e) => {
      // Touch has no hovering cursor: a lifted finger would freeze the gaze
      if (e.pointerType === 'touch') return
      if (projectingRef.current) return // eyes stay locked on the projection
      const bcx = posRef.current.x + BOT_SIZE / 2
      const bcy = posRef.current.y + BOT_SIZE / 2
      const nx = clamp((e.clientX - bcx) / (window.innerWidth / 2), -1, 1)
      const ny = clamp((e.clientY - bcy) / (window.innerHeight / 2), -1, 1)
      // Only rest-face states take the cursor: elsewhere the gaze IS the
      // measured animation (orbit's flying eyes), and mixing would blur it
      const canFollow = Boolean(STATE_BY_ID[finalStateRef.current]?.baseFace)
      if (canFollow) {
        lookRef.current = {
          yaw: nx * YAW_MAX,
          pitch: PITCH_BASE - ny * PITCH_MAX,
          mix: 1,
          wander: 0
        }
      }
      clearTimeout(idleTimer)
      idleTimer = setTimeout(release, 4000)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      clearTimeout(idleTimer)
    }
  }, [])

  // Leaving a rest-face state releases the cursor's hold on the gaze
  useEffect(() => {
    if (!projecting && !STATE_BY_ID[finalState]?.baseFace) {
      lookRef.current = { ...lookRef.current, mix: 0, wander: 1 }
    }
  }, [finalState, projecting])

  // ── Click reaction: one quick random state, then back to rest ──
  const playClickReaction = useCallback(() => {
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current)
    const s = CLICK_STATES[Math.floor(Math.random() * CLICK_STATES.length)]
    setClickState(s)
    const dur = (STATE_BY_ID[s]?.duration ?? 1.6) * 1000
    clickTimerRef.current = setTimeout(() => setClickState(null), dur)
  }, [])

  // ── Projection open/close ──
  const openProjection = useCallback(() => {
    projectingRef.current = true
    setProjecting(true)
    // Eyes lock onto the panel — the beams line up with where it looks
    lookRef.current = { yaw: 14, pitch: 8, mix: 1, wander: 0 }
  }, [])

  const closeProjection = useCallback(() => {
    projectingRef.current = false
    setProjecting(false)
    lookRef.current = { ...lookRef.current, mix: 0, wander: 1 }
  }, [])

  const handleBotClick = useCallback(() => {
    if (projecting) {
      closeProjection()
      return
    }
    if (hasAnnouncement) {
      openProjection()
      return
    }
    playClickReaction()
  }, [projecting, hasAnnouncement, openProjection, closeProjection, playClickReaction])

  // Esc leaves the projection
  useEffect(() => {
    if (!projecting) return
    const onKey = (e) => { if (e.key === 'Escape') closeProjection() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [projecting, closeProjection])

  // While projecting, re-render slowly so the beams stay glued to the eyes
  // (they shift with gaze catch-up, blinks and shape morphs)
  const [, setBeamTick] = useState(0)
  useEffect(() => {
    if (!projecting) return
    const id = setInterval(() => setBeamTick((t) => t + 1), 400)
    return () => clearInterval(id)
  }, [projecting])

  // Beam geometry: from each eye → the panel's bottom-left corner.
  // Prefer the live eye centers reported by the engine; fall back to
  // approximate offsets for the first frames.
  const botCx = posRef.current.x + BOT_SIZE / 2
  const botCy = posRef.current.y + BOT_SIZE / 2
  const VB_SCALE = BOT_SIZE / 400 // viewBox is 400 units wide
  const liveEyes = eyePosRef.current
  const eyePoints =
    liveEyes && liveEyes.length >= 2
      ? liveEyes.map((p) => ({
          x: posRef.current.x + (p.x + 200) * VB_SCALE,
          y: posRef.current.y + (p.y + 200) * VB_SCALE
        }))
      : EYE_OFFSETS.map((o) => ({ x: botCx + o.dx, y: botCy + o.dy }))
  const PANEL_LEFT = 232
  const PANEL_BOTTOM = NAV_H + 96
  const beamX2 = PANEL_LEFT + 8
  const beamY2 = winH - PANEL_BOTTOM

  return (
    <aside className="np-desktop-companion" aria-hidden="true">
      {projecting && announcement && (
        <>
          <div className="np-companion-projection__backdrop" onClick={closeProjection} />
          <svg className="np-companion-projection__beam" aria-hidden="true">
            {eyePoints.map((eye, i) => {
              const y2 = beamY2 + (i === 0 ? -10 : 4)
              return (
                <line
                  key={i}
                  className="np-companion-projection__beam-line"
                  x1={eye.x}
                  y1={eye.y}
                  x2={beamX2}
                  y2={y2}
                  style={{ '--beam-len': Math.hypot(beamX2 - eye.x, y2 - eye.y) }}
                />
              )
            })}
            {eyePoints.map((eye, i) => (
              <circle
                key={`src-${i}`}
                className="np-companion-projection__beam-src"
                cx={eye.x}
                cy={eye.y}
                r={3}
              />
            ))}
          </svg>
          <div
            className="np-companion-projection__panel"
            style={{ left: PANEL_LEFT, bottom: PANEL_BOTTOM }}
            onClick={closeProjection}
          >
            <div className="np-companion-projection__title">
              {announcement.title || 'ANNOUNCEMENT'}
            </div>
            <div className="np-companion-projection__msg">{announcement.message}</div>
            <div className="np-companion-projection__hint">click anywhere to close</div>
          </div>
        </>
      )}
      <div
        ref={botRef}
        className="np-desktop-companion__bot"
        onClick={handleBotClick}
      >
        <BloubBot
          stateId={finalState}
          size={BOT_SIZE}
          lookRef={lookRef}
          eyePosRef={eyePosRef}
          expression={EXPRESSIONS[expressionId]}
          shapeRadii={SHAPES[shapeIdx].radii}
          ink={botColors.ink}
          eyeColor={botColors.eye}
          decorColor="#ffffff"
        />
      </div>
    </aside>
  )
}
