import React from "react";

/* ============================================================
   neoPOP scattered decorations — sparkles, bursts, confetti
   All purely decorative (aria-hidden), absolutely positioned.
   ============================================================ */

/** Four-point sparkle star. */
export function Sparkle({ size = 22, color = "#f4f2ea", style, className }) {
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      aria-hidden="true"
    >
      <path d="M12 0l2.4 9.6L24 12l-9.6 2.4L12 24l-2.4-9.6L0 12l9.6-2.4z" />
    </svg>
  );
}

/** Radiating ray burst — top corner accent from the poster. */
export function Burst({ size = 90, color = "#f4f2ea", style, className }) {
  const rays = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      {rays.map(deg => (
        <line
          key={deg}
          x1="50" y1="50" x2="50" y2="4"
          stroke={color}
          strokeWidth="2.5"
          transform={`rotate(${deg} 50 50)`}
        />
      ))}
      <circle cx="50" cy="50" r="14" fill="#0a0a0c" />
    </svg>
  );
}

/** Tiny rotated confetti square. */
export function Confetti({ size = 10, color = "#cfff04", rotate = 20, style, className }) {
  return (
    <span
      className={className}
      aria-hidden="true"
      style={{
        display: "block",
        width: size,
        height: size,
        background: color,
        transform: `rotate(${rotate}deg)`,
        ...style,
      }}
    />
  );
}

/** Outlined circle. */
export function Ring({ size = 26, color = "rgba(244,242,234,0.5)", style, className }) {
  return (
    <span
      className={className}
      aria-hidden="true"
      style={{
        display: "block",
        width: size,
        height: size,
        border: `1.5px solid ${color}`,
        borderRadius: "50%",
        ...style,
      }}
    />
  );
}

/** Full decorative layer for the login screen. */
export function LoginDecor() {
  return (
    <div className="np-deco" aria-hidden="true">
      <Burst size={110} style={{ top: -34, left: -30, opacity: 0.9 }} />
      <Sparkle className="np-float-1" size={20} color="#cfff04" style={{ top: "12%", right: "8%" }} />
      <Sparkle className="np-float-2 np-sm-hide" size={12} color="#f4f2ea" style={{ top: "34%", left: "3%" }} />
      <Sparkle className="np-float-3 np-sm-hide" size={16} color="#ff2e63" style={{ top: "56%", right: "4%" }} />
      <Sparkle className="np-float-2 np-sm-hide" size={11} color="#f4f2ea" style={{ bottom: "14%", left: "9%" }} />
      <Confetti className="np-float-1 np-sm-hide" size={9} color="#ffa114" rotate={28} style={{ top: "20%", left: "14%", position: "absolute" }} />
      <Confetti className="np-float-3 np-sm-hide" size={8} color="#6533f4" rotate={-15} style={{ bottom: "24%", right: "12%", position: "absolute" }} />
      <Confetti size={7} color="#ff2e63" rotate={45} style={{ top: "8%", left: "42%", position: "absolute" }} />
      <Ring className="np-sm-hide" size={14} color="rgba(207,255,4,0.55)" style={{ top: "70%", left: "4%", position: "absolute" }} />
    </div>
  );
}
