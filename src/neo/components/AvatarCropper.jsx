import React, { useCallback, useEffect, useRef, useState } from "react";
import { AVATAR_SIZE } from "../utils/avatar.js";

const VIEW = 260; // crop window, in CSS pixels
const MAX_ZOOM = 4;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Drag to move, pinch / slider / wheel to zoom. The picture always covers the
 * round window. `onSave` receives a small square JPEG data URL.
 */
export default function AvatarCropper({ src, onSave, onCancel }) {
  const imgRef = useRef(null);
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 }); // top-left of the picture inside the window

  // the picture at zoom 1 just covers the window
  const baseScale = () => {
    const img = imgRef.current;
    return img ? Math.max(VIEW / img.naturalWidth, VIEW / img.naturalHeight) : 1;
  };

  const fit = useCallback((x, y, z) => {
    const img = imgRef.current;
    if (!img) return { x, y };
    const scale = baseScale() * z;
    return {
      x: clamp(x, VIEW - img.naturalWidth * scale, 0),
      y: clamp(y, VIEW - img.naturalHeight * scale, 0),
    };
  }, []);

  const center = useCallback((z) => {
    const img = imgRef.current;
    const scale = baseScale() * z;
    return fit((VIEW - img.naturalWidth * scale) / 2, (VIEW - img.naturalHeight * scale) / 2, z);
  }, [fit]);

  const onLoad = () => {
    setPos(center(1));
    setZoom(1);
    setReady(true);
  };

  /** Zooms keeping the point (cx, cy) of the window where it is. */
  const zoomTo = useCallback(
    (next, cx = VIEW / 2, cy = VIEW / 2) => {
      const z = clamp(next, 1, MAX_ZOOM);
      const ratio = z / zoom;
      setPos(fit(cx - (cx - pos.x) * ratio, cy - (cy - pos.y) * ratio, z));
      setZoom(z);
    },
    [fit, zoom, pos]
  );

  const distance = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onPointerDown = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    gesture.current =
      pointers.current.size === 2 ? { pinch: distance(), zoom } : { x: event.clientX, y: event.clientY };
  };

  const onPointerMove = (event) => {
    if (!pointers.current.has(event.pointerId)) return;
    const prev = pointers.current.get(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size === 2 && gesture.current?.pinch) {
      zoomTo(gesture.current.zoom * (distance() / gesture.current.pinch));
      return;
    }
    const dx = event.clientX - prev.x;
    const dy = event.clientY - prev.y;
    setPos((p) => fit(p.x + dx, p.y + dy, zoom));
  };

  const onPointerUp = (event) => {
    pointers.current.delete(event.pointerId);
    gesture.current = null;
  };

  // wheel needs a non-passive listener so the page doesn't scroll
  const viewRef = useRef(null);
  useEffect(() => {
    const el = viewRef.current;
    if (!el) return undefined;
    const onWheel = (event) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomTo(zoom * (event.deltaY < 0 ? 1.08 : 0.92), event.clientX - rect.left, event.clientY - rect.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoom, zoomTo]);

  const save = () => {
    const img = imgRef.current;
    const scale = baseScale() * zoom;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = AVATAR_SIZE;
    canvas.getContext("2d").drawImage(
      img,
      -pos.x / scale,
      -pos.y / scale,
      VIEW / scale,
      VIEW / scale,
      0,
      0,
      AVATAR_SIZE,
      AVATAR_SIZE
    );
    onSave(canvas.toDataURL("image/jpeg", 0.88));
  };

  const scale = imgRef.current ? baseScale() * zoom : 1;

  return (
    <div className="np-crop">
      <div
        ref={viewRef}
        className="np-crop__view"
        style={{ width: VIEW, height: VIEW }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          ref={imgRef}
          src={src}
          alt=""
          draggable={false}
          onLoad={onLoad}
          onError={() => setFailed(true)}
          style={{
            width: imgRef.current?.naturalWidth,
            height: imgRef.current?.naturalHeight,
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
            opacity: ready ? 1 : 0,
          }}
        />
        {!failed && !ready && <span className="np-crop__hint">Loading…</span>}
        {failed && <span className="np-crop__hint">Couldn't open that picture.</span>}
      </div>

      <input
        className="np-crop__zoom"
        type="range"
        min="1"
        max={MAX_ZOOM}
        step="0.01"
        value={zoom}
        disabled={!ready}
        onChange={(e) => zoomTo(Number(e.target.value))}
        aria-label="Zoom"
      />
      <p className="np-note np-crop__tip">Drag to move · pinch or slide to zoom</p>

      <div className="np-modal__actions">
        <button type="button" className="np-btn np-btn--quiet" onClick={onCancel}>
          Back
        </button>
        <button type="button" className="np-btn" onClick={save} disabled={!ready}>
          Save
        </button>
      </div>
    </div>
  );
}
