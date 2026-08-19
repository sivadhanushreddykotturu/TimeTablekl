// useAutonomousLife.js — The companion's soul, calm edition
// Rare, single, non-repeating idle animations on top of a quiet resting face
// (blinking, breathing, gaze wander live in the engine). No sleep drift, no
// chains, no easter-egg spam: the bot waits until you engage.

import { useEffect, useRef, useState, useCallback } from 'react'

// Spontaneous idle animations — expressive but restrained
const IDLE_POOL = [
  { state: 'wink',    duration: 1600 },
  { state: 'wide',    duration: 1800 },
  { state: 'egg',     duration: 1800 },
  { state: 'hexagon', duration: 1600 },
  { state: 'orbit',   duration: 3400 },
  { state: 'comet',   duration: 2400 },
]

function randomBetween(min, max) {
  return min + Math.random() * (max - min)
}

function pickDifferentFrom(lastState) {
  let pick
  let attempts = 0
  do {
    pick = IDLE_POOL[Math.floor(Math.random() * IDLE_POOL.length)]
    attempts++
  } while (pick.state === lastState && attempts < 5)
  return pick
}

/**
 * useAutonomousLife — the companion's quiet personality.
 *
 * @param {{ paused?: boolean }} opts — true while the big stage is open
 * @returns a state string (e.g. 'wink', 'orbit') or null for idle.
 */
export function useAutonomousLife({ paused = false } = {}) {
  const [autoState, setAutoState] = useState(null)
  const timerRef = useRef(null)
  const lastStateRef = useRef(null)
  const pausedRef = useRef(paused)

  useEffect(() => {
    pausedRef.current = paused
    // Entering the stage cuts whatever was playing
    if (paused) setAutoState(null)
  }, [paused])

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const scheduleNext = useCallback((delay) => {
    clearTimer()
    timerRef.current = setTimeout(() => {
      if (pausedRef.current) {
        scheduleNext(randomBetween(8000, 15000))
        return
      }
      const pick = pickDifferentFrom(lastStateRef.current)
      lastStateRef.current = pick.state
      setAutoState(pick.state)
      setTimeout(() => setAutoState(null), pick.duration)
      scheduleNext(randomBetween(24000, 50000))
    }, delay)
  }, [clearTimer])

  useEffect(() => {
    // First one comes a little sooner so it feels alive, then settles down
    scheduleNext(randomBetween(6000, 10000))
    return clearTimer
  }, [scheduleNext, clearTimer])

  return autoState
}
