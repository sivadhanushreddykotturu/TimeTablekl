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

  // ── Fixed position ──
  const posRef = useRef({ x: 0, y: 0 })

  // ── Autonomous life (quiet) ──
  const autoState = useAutonomousLife()

  const finalState = clickState ?? autoState ?? 'idle'
  const finalStateRef = useRef(finalState)
  finalStateRef.current = finalState

  // Place the bot at its home spot, on mount and whenever the window resizes
  const placeBot = useCallback(() => {
    const p = getHomePos()
    posRef.current = p
    if (botRef.current) {
      botRef.current.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`
    }
  }, [])

  useEffect(() => {
    placeBot()
    window.addEventListener('resize', placeBot)
    return () => window.removeEventListener('resize', placeBot)
  }, [placeBot])

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
      lookRef.current = { ...lookRef.current, mix: 0, wander: 1 }
    }
    const onMove = (e) => {
      // Touch has no hovering cursor: a lifted finger would freeze the gaze
      if (e.pointerType === 'touch') return
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
    if (!STATE_BY_ID[finalState]?.baseFace) {
      lookRef.current = { ...lookRef.current, mix: 0, wander: 1 }
    }
  }, [finalState])

  // ── Click reaction: one quick random state, then back to rest ──
  const playClickReaction = useCallback(() => {
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current)
    const s = CLICK_STATES[Math.floor(Math.random() * CLICK_STATES.length)]
    setClickState(s)
    const dur = (STATE_BY_ID[s]?.duration ?? 1.6) * 1000
    clickTimerRef.current = setTimeout(() => setClickState(null), dur)
  }, [])

  return (
    <aside className="np-desktop-companion" aria-hidden="true">
      <div
        ref={botRef}
        className="np-desktop-companion__bot"
        onClick={playClickReaction}
      >
        <BloubBot
          stateId={finalState}
          size={BOT_SIZE}
          lookRef={lookRef}
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
