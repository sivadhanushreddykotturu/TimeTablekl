// useMascot.js — Context-aware mascot state selector hook

import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

const CLICK_CYCLE = ['wink', 'burst', 'exclaim', 'egg']

export function useMascot({ gamePhase, gameNewBest } = {}) {
  const location = useLocation()
  const path = location.pathname

  const [attendancePct, setAttendancePct] = useState(null)
  const [cgpa, setCgpa] = useState(null)
  const [hasClasses, setHasClasses] = useState(true)
  const [classActive, setClassActive] = useState(false)
  const [minutesToClass, setMinutesToClass] = useState(null)

  const clickIndexRef = useRef(0)
  const [clickState, setClickState] = useState(null)
  const clickTimerRef = useRef(null)
  const [doubleClickState, setDoubleClickState] = useState(null)
  const doubleClickTimerRef = useRef(null)

  // Read attendance percentage from cache
  useEffect(() => {
    try {
      const cached = localStorage.getItem('cached_attendance')
      if (cached) {
        const data = JSON.parse(cached)
        if (Array.isArray(data) && data.length) {
          const total = data.reduce((s, c) => s + (parseFloat(c.attendance_percentage) || 0), 0)
          setAttendancePct(Math.round(total / data.length))
        }
      }
    } catch { /* ignore */ }

    // Detect if there are classes today
    try {
      const tt = JSON.parse(localStorage.getItem('timetable') || '{}')
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const today = days[new Date().getDay()]
      const todaySlots = tt[today] || {}
      const hasCls = Object.values(todaySlots).some(v => v && v !== '-')
      setHasClasses(hasCls)
    } catch { /* ignore */ }
  }, [path])

  // Poll for current class status
  useEffect(() => {
    const check = () => {
      try {
        const tt = JSON.parse(localStorage.getItem('timetable') || '{}')
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const today = days[new Date().getDay()]
        const slots = tt[today] || {}
        const now = new Date()
        const nowMin = now.getHours() * 60 + now.getMinutes()

        const SLOT_START = [480, 535, 590, 645, 700, 755, 810, 865]
        const SLOT_END   = [535, 590, 645, 700, 755, 810, 865, 920]

        let inClass = false
        let minsToNext = null

        for (let i = 0; i < SLOT_START.length; i++) {
          const slotNum = String(i + 1)
          if (slots[slotNum] && slots[slotNum] !== '-') {
            if (nowMin >= SLOT_START[i] && nowMin < SLOT_END[i]) {
              inClass = true
              break
            }
            if (nowMin < SLOT_START[i]) {
              const m = SLOT_START[i] - nowMin
              if (minsToNext === null || m < minsToNext) minsToNext = m
            }
          }
        }

        setClassActive(inClass)
        setMinutesToClass(minsToNext)
      } catch { /* ignore */ }
    }
    check()
    const id = setInterval(check, 30000)
    return () => clearInterval(id)
  }, [path])

  // Click handler
  const handleClick = () => {
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current)
    const state = CLICK_CYCLE[clickIndexRef.current % CLICK_CYCLE.length]
    clickIndexRef.current++
    setClickState(state)
    clickTimerRef.current = setTimeout(() => setClickState(null), 1200)
  }

  const handleDoubleClick = () => {
    if (doubleClickTimerRef.current) clearTimeout(doubleClickTimerRef.current)
    setDoubleClickState('orbit')
    setClickState(null)
    doubleClickTimerRef.current = setTimeout(() => setDoubleClickState(null), 3000)
  }

  // Compute final state ID
  const computeState = () => {
    if (doubleClickState) return doubleClickState
    if (clickState) return clickState

    // Games
    if (path === '/home' || path === '/') {
      if (gamePhase === 'run') return 'play'
      if (gamePhase === 'over') return 'wide'
      if (gameNewBest) return 'burst'
    }

    if (path.startsWith('/games')) {
      if (gamePhase === 'run') return 'play'
      if (gamePhase === 'over') return 'wide'
      if (gameNewBest) return 'burst'
    }

    // Exam mode
    if (path === '/exam') return 'orbit'

    // Profile & Customization
    if (path === '/profile' || path === '/customize') return 'egg'

    // Grades
    if (path === '/grades') {
      if (cgpa !== null && cgpa >= 9.0) return 'burst'
      if (cgpa !== null && cgpa < 6.0) return 'exclaim'
      if (cgpa !== null && cgpa < 7.0) return 'wide'
      return 'hexagon'
    }

    // Attendance
    if (path === '/attendance') {
      if (attendancePct !== null && attendancePct >= 85) return 'burst'
      if (attendancePct !== null && attendancePct < 60) return 'exclaim'
      if (attendancePct !== null && attendancePct < 75) return 'wide'
      return 'idle'
    }

    // Subjects
    if (path === '/subjects') return 'hexagon'

    // Maddys / friends
    if (path.startsWith('/maddys')) return 'wink'

    // Timetable weekly view
    if (path === '/timetable') return 'orbit'

    // Home page logic
    if (path === '/home') {
      const hour = new Date().getHours()
      const day = new Date().getDay()

      // Weekend
      if (day === 0 || day === 6) return 'sleep'

      // Late night
      if (hour >= 22 || hour < 6) return 'sleep'

      // No classes today
      if (!hasClasses) return 'sleep'

      // Class in session
      if (classActive) return 'orbit'

      // Class starting very soon
      if (minutesToClass !== null && minutesToClass < 5) return 'exclaim'
      if (minutesToClass !== null && minutesToClass < 15) return 'alert'

      // Monday / Friday vibes
      if (day === 1) return 'alert'
      if (day === 5) return 'wink'

      return 'idle'
    }

    return 'idle'
  }

  return {
    stateId: computeState(),
    handleClick,
    handleDoubleClick
  }
}
