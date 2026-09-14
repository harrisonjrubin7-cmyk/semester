import { useEffect, useMemo, useRef, useState } from 'react';
import {
  EYE,
  MESH,
  facets,
  floor,
  heights,
  marks,
  range,
  turned,
  type Camera,
  type Spot,
} from '../lib/surface';
import { neat, type Frame } from '../lib/plot';

/**
 * The surface, turned by a finger.
 *
 * One SVG of a few hundred quadrilaterals drawn back to front — see
 * `lib/surface.ts` for why that rather than WebGL. What is here is the part
 * that has to touch the screen: measuring the box, turning the camera on a
 * drag, and painting the pieces in the order they arrive.
 *
 * ## The one thing worth knowing about the drag
 *
 * A horizontal drag turns the model and a vertical drag lifts the eye, and
 * the vertical is clamped so the camera never goes under the floor. A surface
 * seen from below is not wrong, exactly, but it reads as a different function
 * — the peaks become pits — and nobody drags there on purpose.
 */
export function Surface({
  at,
  frame,
  colour,
  height = 320,
  says,
}: {
  /** The height over a point of the floor. */
  at: (x: number, y: number) => number;
  frame: Frame;
  /** The line's own colour, from the reader's palette. */
  colour: string;
  height?: number;
  says: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [eye, setEye] = useState<Camera>(EYE);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const read = () => setWidth(el.clientWidth);
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(read);
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  const { pieces, edges, letters, low, high } = useMemo(() => {
    const zs = heights(at, frame, MESH);
    const bounds = range(zs, frame);
    return {
      pieces: facets(zs, frame, bounds.low, bounds.high, eye),
      edges: floor(frame, bounds.low, bounds.high, eye),
      letters: marks(frame, bounds.low, bounds.high, eye),
      low: bounds.low,
      high: bounds.high,
    };
  }, [at, frame, eye]);

  // The cube is two units across, and a corner of it reaches √3 — so the
  // picture is scaled to the smaller side with room for the worst rotation.
  const scale = Math.min(width, height) * 0.31;
  const px = (p: { x: number; y: number }) => `${(width / 2 + p.x * scale).toFixed(1)},${(height / 2 + p.y * scale).toFixed(1)}`;

  const drag = useRef<{ id: number; x: number; y: number; eye: Camera } | null>(null);

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={box}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, eye };
        }}
        onPointerMove={(e) => {
          const from = drag.current;
          if (!from || from.id !== e.pointerId) return;
          setEye(
            turned(from.eye, ((e.clientX - from.x) / Math.max(1, width)) * 3, ((e.clientY - from.y) / height) * 2),
          );
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        style={{
          width: '100%',
          height,
          touchAction: 'none',
          cursor: 'grab',
          borderRadius: 'var(--r-lg)',
          border: '1px solid var(--app-line)',
          background: 'var(--app-panel)',
          overflow: 'hidden',
        }}
      >
        <svg width={width} height={height} role="img" aria-label={says}>
          {edges.map((line, i) => (
            <line
              key={`e${i}`}
              x1={width / 2 + line.a.x * scale}
              y1={height / 2 + line.a.y * scale}
              x2={width / 2 + line.b.x * scale}
              y2={height / 2 + line.b.y * scale}
              stroke="var(--app-line)"
              strokeWidth={1}
            />
          ))}
          {pieces.map((piece, i) => (
            <polygon
              key={i}
              points={piece.corners.map(px).join(' ')}
              fill={colour}
              /*
               * Two things at once, and both are the shape rather than
               * decoration: how the piece faces the light, and how high it
               * sits. Height alone gives a flat map of contours; light alone
               * loses a peak that happens to face away. The product reads as a
               * solid object on every one of this app's grounds, because it is
               * one colour at one hue with only its strength moving.
               */
              fillOpacity={0.2 + 0.55 * piece.light + 0.25 * piece.height}
              stroke={colour}
              strokeOpacity={0.35}
              strokeWidth={0.4}
            />
          ))}
          {letters.map((mark) => (
            <text
              key={mark.label}
              x={width / 2 + mark.at.x * scale}
              y={height / 2 + mark.at.y * scale}
              fontSize={10}
              fill="var(--app-dim)"
              textAnchor="middle"
            >
              {mark.label}
            </text>
          ))}
        </svg>
      </div>

      <div
        style={{
          position: 'absolute',
          top: 'var(--sp-4)',
          right: 'var(--sp-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--sp-2)',
        }}
      >
        <button
          type="button"
          className="bare tappable"
          aria-label="Back to the first view"
          title="Back to the first view"
          onClick={() => setEye(EYE)}
          style={{
            width: 30,
            height: 30,
            borderRadius: 'var(--r-sm)',
            border: '1px solid var(--app-line)',
            background: 'var(--app-bg)',
            fontSize: 'var(--type-md)',
          }}
        >
          ⌂
        </button>
      </div>

      <div style={{ fontSize: 'var(--type-xs)', color: 'var(--app-dim)', marginTop: 'var(--sp-3)' }}>
        Drag to turn it. z runs from {short(low, high - low)} to {short(high, high - low)} over the
        window you set on the axes.
      </div>
    </div>
  );
}

/**
 * A height as a label, at the precision the picture was measured to.
 *
 * `neat` rather than `toPrecision` alone because the interesting case is the
 * one that reads worst: a Gaussian's floor samples at 1.787e-9, which is zero
 * for every purpose this label serves and looks like a fault in the app.
 */
function short(v: number, span: number): string {
  if (!Number.isFinite(v)) return '—';
  return String(neat(v, span || 1));
}

export type { Spot };
