import React, { useEffect, useLayoutEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

/**
 * JellyNav — floating glass tab bar with a liquid selection pill.
 *
 * Tap a tab and the pill simply glides there, then ripples once as it lands
 * (tapping the tab you are on ripples in place). Hold and drag and the pill
 * swells and follows your finger, stretching with speed, while the whole bar
 * leans after it like a soft body; let go and it settles on the nearest tab.
 *
 * All of it is spring physics stepped in one requestAnimationFrame loop that
 * only writes CSS variables, so React never re-renders while the bar moves.
 * The page itself is swapped once the pill has landed, so rendering the next
 * screen never steals frames from the glide.
 * The component must stay mounted across route changes (it lives in App, not
 * in the pages) or the settle animation would be cut off mid-flight.
 */

const EDGE = 4;        // px between the bar edge and the tabs
const TAP_SLOP = 4;    // px of travel before a press counts as a drag
const REST = 0.0001;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Damped spring, integrated in closed form (stable at any frame rate). */
class Spring {
  constructor(value, stiffness, dampingRatio) {
    this.value = value;
    this.velocity = 0;
    this.stiffness = stiffness;
    this.ratio = dampingRatio;
  }

  atRest(target) {
    return Math.abs(this.value - target) < REST && Math.abs(this.velocity) < REST;
  }

  snap(target) {
    this.value = target;
    this.velocity = 0;
  }

  advance(target, dt) {
    if (this.atRest(target)) return this.snap(target);
    const x = this.value - target;
    const w = Math.sqrt(this.stiffness);

    if (this.ratio === 1) {
      const decay = Math.exp(-w * dt);
      const c = this.velocity + w * x;
      this.value = target + (x + c * dt) * decay;
      this.velocity = (this.velocity - w * c * dt) * decay;
      return;
    }
    const damping = this.ratio * w;
    const wd = w * Math.sqrt(1 - this.ratio * this.ratio);
    const decay = Math.exp(-damping * dt);
    const cos = Math.cos(wd * dt);
    const sin = Math.sin(wd * dt);
    const positionC = (this.velocity + damping * x) / wd;
    const velocityC = (damping * this.velocity + this.stiffness * x) / wd;
    this.value = target + decay * (x * cos + positionC * sin);
    this.velocity = decay * (this.velocity * cos - velocityC * sin);
  }
}

/** The further you pull, the less it gives. */
function rubberBand(distance, dimension) {
  if (distance === 0 || dimension <= 0) return 0;
  const damped = (1 - 1 / ((Math.abs(distance) * 0.14) / dimension + 1)) * dimension;
  return distance < 0 ? -damped : damped;
}

/** Horizontal lean of the whole bar while dragging: eases out to ±4px. */
function panelOffset(raw, width) {
  if (width <= 0 || raw === 0) return 0;
  const fraction = clamp(raw / width, -1, 1);
  const x = Math.abs(fraction);
  let low = 0;
  let high = 1;
  let p = x;
  for (let i = 0; i < 10; i++) {
    const bezierX = p * p * (3 * (1 - p) * 0.58 + p);
    if (bezierX < x) low = p;
    else high = p;
    p = (low + high) / 2;
  }
  const eased = p * p * (3 * (1 - p) + p);
  return (fraction < 0 ? -4 : 4) * eased;
}

// No custom sound or vibration: the system's own touch sound (the one every other
// PWA gets) plays when a tap reaches a real link, so taps are left to the <Link>s.
function haptic() {}

function createMotion(index) {
  const distortion = 18 / (2 * Math.sqrt(240 * 0.9));
  return {
    position: new Spring(index, 1000, 1),      // which tab the pill is on (fractional)
    speed: new Spring(0, 300, 0.5),            // smoothed pill velocity → stretch
    press: new Spring(0, 1000, 1),             // 0 → 1 while held
    scaleX: new Spring(1, 250, 0.6),
    scaleY: new Spring(1, 250, 0.7),
    panel: new Spring(0, 300, 1),              // bar leans sideways with the drag
    trackY: new Spring(0, 240 / 0.9, distortion), // bar follows the finger up/down
    trackX: new Spring(1, 240 / 0.9, distortion), // ...and narrows as it is pulled
    trackPress: new Spring(1, 240 / 0.9, distortion),
    glow: new Spring(0, 240 / 0.9, distortion),
    target: index,
    pressTarget: 0,
    shapeTarget: 1,
    dragging: false,
    releasing: false,
    width: 0,
    height: 64,
    originX: 0,
    downX: 0,
    downY: 0,
    startTarget: index,
    startPanel: 0,
    startY: 0,
    moved: 0,
    hover: index,
    pointerId: null,
    pendingGo: null,   // tab to open once the pill has landed
    ripple: false,     // wobble once on landing (taps, not drags)
    swollen: false,    // the press has turned into a drag
    rect: null,
    raf: 0,
    last: 0,
  };
}

export default function JellyNav({ items, compact = false, onReselect }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const barRef = useRef(null);
  const selectedIndex = items.findIndex((item) => item.to === pathname);
  const count = items.length;
  const maxIndex = Math.max(0, count - 1);

  const motionRef = useRef(null);
  if (!motionRef.current) motionRef.current = createMotion(Math.max(0, selectedIndex));

  const tabWidth = () => Math.max(0, (motionRef.current.width - EDGE * 2) / Math.max(1, count));
  const indexAt = (x) => clamp(Math.floor((x - EDGE) / (tabWidth() || 1)), 0, maxIndex);

  const paint = () => {
    const m = motionRef.current;
    const bar = barRef.current;
    if (!bar || m.width <= 0) return;

    const tw = tabWidth();
    const itemH = m.height - EDGE * 2;
    const speed = m.speed.value / 10;
    const sx = m.scaleX.value / (1 - clamp(speed * 0.75, -0.2, 0.2));
    const sy = m.scaleY.value * (1 - clamp(speed * 0.25, -0.2, 0.2));

    // the pill's box after scaling (it may bulge past the bar)
    const w = tw * sx;
    const h = itemH * sy;
    const left = EDGE + (m.position.value + 0.5) * tw - w / 2;
    const top = m.height / 2 - h / 2;
    const right = left + w;
    const bottom = top + h;
    const radius = Math.min(tw, itemH) / 2;
    const rx = Math.min(radius * sx, w / 2);
    const ry = Math.min(radius * sy, h / 2);
    const n = (v) => v.toFixed(2);

    const style = bar.style;
    style.setProperty("--pill-x", `${n(EDGE + m.position.value * tw)}px`);
    style.setProperty("--pill-w", `${n(tw)}px`);
    style.setProperty("--pill-r", `${n(radius)}px`);
    style.setProperty("--pill-sx", sx.toFixed(4));
    style.setProperty("--pill-sy", sy.toFixed(4));
    // accent-coloured icons show only inside the pill. That layer is magnified
    // around the pill's centre (the pill acts as a lens), so its clip is given
    // in the layer's own, un-magnified coordinates.
    const lens = 1 + 0.22 * m.press.value;
    const cx = (left + right) / 2;
    const cy = m.height / 2;
    const cl = cx + (left - cx) / lens;
    const cr = cx + (right - cx) / lens;
    const ct = cy + (top - cy) / lens;
    const cb = cy + (bottom - cy) / lens;
    style.setProperty("--pill-cx", `${n(cx)}px`);
    style.setProperty(
      "--pill-clip",
      `inset(${n(ct)}px ${n(m.width - cr)}px ${n(m.height - cb)}px ${n(cl)}px round ${n(rx / lens)}px / ${n(ry / lens)}px)`
    );
    // ...and the muted ones everywhere else
    const hole =
      `M-60,-60H${n(m.width + 60)}V${n(m.height + 60)}H-60Z ` +
      `M${n(left + rx)},${n(top)}H${n(right - rx)}A${n(rx)},${n(ry)} 0 0 1 ${n(right)},${n(top + ry)}` +
      `V${n(bottom - ry)}A${n(rx)},${n(ry)} 0 0 1 ${n(right - rx)},${n(bottom)}` +
      `H${n(left + rx)}A${n(rx)},${n(ry)} 0 0 1 ${n(left)},${n(bottom - ry)}` +
      `V${n(top + ry)}A${n(rx)},${n(ry)} 0 0 1 ${n(left + rx)},${n(top)}Z`;
    style.setProperty("--pill-hole", `path(evenodd, "${hole}")`);

    style.setProperty("--content-scale", lens.toFixed(4));
    style.setProperty("--bar-scale", m.trackPress.value.toFixed(4));
    style.setProperty("--track-sx", m.trackX.value.toFixed(4));
    style.setProperty("--track-y", `${n(m.trackY.value)}px`);
    style.setProperty("--panel-x", `${n(panelOffset(m.panel.value, m.width))}px`);
    style.setProperty("--origin-x", `${n(m.originX)}px`);
    style.setProperty("--glow-y", `${n(m.downY)}px`);
    style.setProperty("--glow", clamp(m.glow.value, 0, 1).toFixed(3));
  };

  const step = (now) => {
    const m = motionRef.current;
    const dt = clamp((now - m.last) / 1000, 0, 0.064);
    m.last = now;

    m.target = clamp(m.target, 0, maxIndex);
    m.position.advance(m.target, dt);
    m.speed.advance(m.dragging && maxIndex > 0 ? m.position.velocity / maxIndex : 0, dt);
    if (!m.dragging) m.panel.advance(0, dt);

    // the pill keeps its swollen shape until it has (almost) arrived
    if (m.releasing && Math.abs(m.position.value - m.target) < Math.max(1, maxIndex) * 0.025) {
      m.releasing = false;
      m.pressTarget = 0;
      m.shapeTarget = 1;
      if (m.ripple) {
        // a kick, not a target: the springs ring around their resting size
        m.ripple = false;
        m.scaleX.velocity += 7;
        m.scaleY.velocity += 4.5;
        m.press.velocity += 20;
      }
      if (m.pendingGo !== null) {
        const index = m.pendingGo;
        m.pendingGo = null;
        goRef.current(index);
      }
    }

    m.press.advance(m.pressTarget, dt);
    m.scaleX.advance(m.shapeTarget, dt);
    m.scaleY.advance(m.shapeTarget, dt);
    m.trackPress.advance(m.dragging ? 1.025 : 1, dt);
    m.glow.advance(m.dragging ? 1 : 0, dt);
    if (!m.dragging) {
      m.trackY.advance(0, dt);
      m.trackX.advance(1, dt);
      if (m.trackX.atRest(1)) m.originX = m.width / 2;
    }
    paint();

    const running =
      m.dragging || m.releasing ||
      !m.position.atRest(m.target) || !m.speed.atRest(0) || !m.press.atRest(0) ||
      !m.scaleX.atRest(1) || !m.scaleY.atRest(1) || !m.panel.atRest(0) ||
      !m.trackY.atRest(0) || !m.trackX.atRest(1) || !m.trackPress.atRest(1) || !m.glow.atRest(0);

    m.raf = running ? requestAnimationFrame(step) : 0;
  };

  const run = () => {
    const m = motionRef.current;
    if (m.raf) return;
    m.last = performance.now();
    m.raf = requestAnimationFrame(step);
  };

  const select = (index) => {
    const m = motionRef.current;
    m.dragging = false;
    if (index >= 0) m.target = Math.min(index, maxIndex);
    m.ripple = !m.swollen;
    m.swollen = false;
    m.releasing = true;
    m.pressTarget = 0;
    m.shapeTarget = 1;
    run();
  };

  // measure, and re-measure when the bar resizes (labels folding, rotation)
  useLayoutEffect(() => {
    const bar = barRef.current;
    const measure = () => {
      const m = motionRef.current;
      m.width = bar.offsetWidth;
      m.height = bar.offsetHeight;
      if (!m.dragging) m.originX = m.width / 2;
      paint();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(motionRef.current.raf);
      motionRef.current.raf = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  // the route changed from somewhere else (swipe, link, back button)
  useEffect(() => {
    const m = motionRef.current;
    if (selectedIndex < 0 || m.dragging) return;
    if (m.target !== selectedIndex || !m.position.atRest(selectedIndex)) select(selectedIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex]);

  const go = (index) => {
    const item = items[index];
    if (!item) return;
    if (item.to === pathname) onReselect?.(item);
    else navigate(item.to);
  };
  // the animation loop outlives renders: always call the latest version
  const goRef = useRef(go);
  goRef.current = go;

  const onPointerDown = (event) => {
    if (event.button > 0) return;
    const m = motionRef.current;
    const bar = barRef.current;
    // measured once per gesture: the bar itself moves while it is being dragged
    m.rect = bar.getBoundingClientRect();
    m.pointerId = event.pointerId;
    m.downX = event.clientX - m.rect.left;
    m.downY = clamp(event.clientY - m.rect.top, 0, m.height);
    m.originX = clamp(m.downX, 0, m.width);
    m.startY = m.trackY.value;
    m.startPanel = m.panel.value;
    m.moved = 0;
    m.target = indexAt(m.downX);
    m.startTarget = m.target;
    m.hover = m.target;
    m.dragging = true;
    m.releasing = false;
    m.swollen = false;
    m.ripple = false;
    m.panel.velocity = 0;
    run();
  };

  const onPointerMove = (event) => {
    const m = motionRef.current;
    if (!m.dragging || event.pointerId !== m.pointerId) return;
    const dx = event.clientX - m.rect.left - m.downX;
    const dy = event.clientY - m.rect.top - m.downY;
    const tw = tabWidth();
    if (tw <= 0) return;

    m.target = clamp(m.startTarget + dx / tw, 0, maxIndex);
    m.panel.snap(m.startPanel + dx);
    m.trackY.snap(m.startY + rubberBand(dy, m.height) * 0.25);
    m.trackX.snap(1 - Math.min(Math.abs(dy) / 700, 1) * 0.08);
    m.originX = clamp(m.downX + dx, 0, m.width);
    m.moved = Math.max(m.moved, Math.abs(dx), Math.abs(dy));
    if (!m.swollen && m.moved >= TAP_SLOP) {
      // it is a drag now: the pill swells and magnifies under the finger
      m.swollen = true;
      try {
        // capture only once it is a drag, so plain taps still reach the <Link>
        // as a normal click (that is what triggers the system touch sound)
        barRef.current.setPointerCapture(event.pointerId);
      } catch {
        /* pointer already gone */
      }
      m.pressTarget = 1;
      m.shapeTarget = 1.3;
    }

    const over = Math.round(m.target);
    if (over !== m.hover) {
      m.hover = over;
      haptic();
    }
  };

  const endPointer = (event, cancelled) => {
    const m = motionRef.current;
    if (!m.dragging || event.pointerId !== m.pointerId) return;
    m.pointerId = null;
    m.panel.velocity = 0;

    if (cancelled) {
      m.pendingGo = null;
      select(Math.max(0, selectedIndex));
      return;
    }
    const index = m.moved < TAP_SLOP ? indexAt(m.downX) : clamp(Math.floor(m.target + 0.5), 0, maxIndex);
    m.dragging = false;
    m.target = index;
    m.ripple = !m.swollen;
    m.swollen = false;
    m.releasing = true;
    m.pendingGo = index;
    run();
    if (index !== selectedIndex) haptic();
    // normally the animation loop opens the tab as the pill lands (~120ms);
    // if frames are being throttled, don't leave the tap hanging
    setTimeout(() => {
      if (m.pendingGo !== index) return;
      m.pendingGo = null;
      goRef.current(index);
    }, 280);
  };

  const renderRow = (layer) => (
    <div className={`np-jelly__row np-jelly__row--${layer}`} aria-hidden="true">
      {items.map((item) => (
        <div key={item.to} className="np-jelly__tab">
          <span className="np-jelly__icon">{item.icon}</span>
          <span className="np-jelly__label">{item.label}</span>
        </div>
      ))}
    </div>
  );

  return (
    <nav className={`np-nav no-swipe${compact ? " is-compact" : ""}`} aria-label="Main">
      <div
        ref={barRef}
        className={`np-jelly${selectedIndex < 0 ? " is-unselected" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endPointer(e, false)}
        onPointerCancel={(e) => endPointer(e, true)}
        onLostPointerCapture={(e) => endPointer(e, true)}
      >
        <div className="np-jelly__body">
          <div className="np-jelly__glass" />
          <div className="np-jelly__clip">
            <div className="np-jelly__pill" />
            {renderRow("idle")}
            {renderRow("active")}
          </div>

          {/* real links: keyboard + screen readers (pointer input is handled above) */}
          <div className="np-jelly__targets">
            {items.map((item, index) => (
              <Link
                key={item.to}
                to={item.to}
                aria-label={item.label}
                aria-current={index === selectedIndex ? "page" : undefined}
                draggable={false}
                onClick={(event) => {
                  event.preventDefault();
                  if (event.detail === 0) {
                    select(index);
                    go(index);
                  }
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
