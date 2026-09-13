import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  HOME,
  nearest,
  panned,
  squared,
  step,
  tickText,
  ticks,
  usable,
  zoomed,
  type Drawn,
  type Frame,
  type Point,
} from '../lib/plot';

/**
 * The graph itself: axes, gridlines, curves, and a finger.
 *
 * Drawn as one SVG in pixel coordinates rather than in a stretched `viewBox`.
 * A `viewBox` of 0–100 with `preserveAspectRatio="none"` is how the other
 * small charts in this app are drawn and it is right for them, but it cannot
 * be right here: it stretches the strokes with the picture, so a hairline is
 * thicker one way than the other, and it makes the type on the axis labels
 * whatever width the box happens to be. A graph is a drawing whose *units* are
 * the subject, so the window is measured and the arithmetic done here.
 *
 * ## Why it is square in units
 *
 * `squared` in `lib/plot.ts` stretches the y range to the shape of the box, so
 * one unit across is one unit down. Without it `x^2 + y^2 = 25` is an ellipse
 * and a 45° line is not at 45°, which is the kind of wrong a student does not
 * notice and then reproduces in an exam.
 *
 * ## The gestures
 *
 * Drag to move, wheel or pinch to zoom, tap to trace. Nothing is modal: the
 * same finger does all three, told apart by what it does — a press that moves
 * is a pan, a press that does not is a trace. The buttons do the same jobs for
 * anybody not using a pointer, which is why they are real buttons with names
 * rather than icons drawn into the SVG.
 */

export interface Drawing {
  id: string;
  /** The curve's own colour, from the reader's palette — see `lib/tint.ts`. */
  colour: string;
  drawn: Drawn;
}

/** How close a press has to stay, in pixels, to count as a tap rather than a drag. */
const STILL = 6;

export function Plot({
  drawings,
  frame,
  onFrame,
  square,
  onFit,
  trace,
  onTrace,
  height = 300,
  says,
}: {
  drawings: Drawing[];
  frame: Frame;
  onFrame: (next: Frame) => void;
  /**
   * Whether one unit across is one unit down.
   *
   * True is right for a circle and wrong for a normal density, whose peak is
   * 0.4 on a window ten units tall — a flat line along the axis, which is the
   * correct picture of the wrong thing. Fit turns it off; the home button
   * turns it back on.
   */
  square: boolean;
  /** Set the window to what is actually drawn. */
  onFit: () => void;
  /** The point being read off, in graph units, or nothing. */
  trace: Point | null;
  onTrace: (at: Point | null) => void;
  height?: number;
  /** What the whole picture says, for anybody who cannot see it. */
  says: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

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

  // One unit across is one unit down, whatever shape the box is. The window
  // the parent holds is the x range; the y range follows the pixels.
  const shown = useMemo(
    () => (square && width > 0 ? squared(frame, width, height) : frame),
    [square, frame, width, height],
  );

  const spanX = shown.x1 - shown.x0;
  const spanY = shown.y1 - shown.y0;
  const px = useCallback((x: number) => ((x - shown.x0) / spanX) * width, [shown.x0, spanX, width]);
  const py = useCallback(
    (y: number) => height - ((y - shown.y0) / spanY) * height,
    [shown.y0, spanY, height],
  );
  /** A place on the page, as a place on the graph. */
  const at = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = box.current?.getBoundingClientRect();
      const x = rect ? clientX - rect.left : 0;
      const y = rect ? clientY - rect.top : 0;
      return { x: shown.x0 + (x / Math.max(1, width)) * spanX, y: shown.y0 + (1 - y / height) * spanY };
    },
    [shown.x0, shown.y0, spanX, spanY, width, height],
  );

  const gapX = step(spanX, Math.max(2, Math.round(width / 80)));
  const gapY = step(spanY, Math.max(2, Math.round(height / 60)));
  const down = useRef<{ id: number; x: number; y: number; moved: number; frame: Frame } | null>(null);
  const pinch = useRef<Map<number, { x: number; y: number }>>(new Map());
  const apart = useRef(0);

  const move = (next: Frame) => {
    if (usable(next)) onFrame(next);
  };

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    pinch.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current.size === 2) {
      const [a, b] = [...pinch.current.values()];
      apart.current = Math.hypot(a.x - b.x, a.y - b.y);
      down.current = null;
      return;
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    down.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, frame };
  };

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pinch.current.has(e.pointerId)) pinch.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current.size === 2) {
      const [a, b] = [...pinch.current.values()];
      const now = Math.hypot(a.x - b.x, a.y - b.y);
      if (apart.current > 0 && now > 0) {
        const about = at((a.x + b.x) / 2, (a.y + b.y) / 2);
        move(zoomed(frame, apart.current / now, about));
      }
      apart.current = now;
      return;
    }
    const start = down.current;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start.moved = Math.max(start.moved, Math.hypot(dx, dy));
    if (start.moved < STILL) return;
    // Against the drag, as a map does: the window moves the other way from the
    // hand, which is what makes the curve feel like paper under a finger.
    move(panned(start.frame, (-dx / Math.max(1, width)) * spanX, (dy / height) * spanY));
  };

  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pinch.current.delete(e.pointerId);
    const start = down.current;
    down.current = null;
    if (!start || start.id !== e.pointerId) return;
    if (start.moved >= STILL) return;
    // A press that did not move is a question about a point rather than a pan.
    const want = at(e.clientX, e.clientY);
    const paths = drawings.flatMap((d) => d.drawn.paths);
    const points = drawings.flatMap((d) => d.drawn.points);
    const found = nearest([...paths, points], want, { x: spanX, y: spanY });
    if (!found) return onTrace(null);
    // In pixels, not units: "near enough to have meant it" is a distance on
    // the glass, and 44 is the same fingertip the rest of the app is drawn to.
    const far = Math.hypot(px(found.x) - px(want.x), py(found.y) - py(want.y));
    onTrace(far < 44 ? found : null);
  };

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY === 0) return;
    move(zoomed(frame, e.deltaY > 0 ? 1.12 : 1 / 1.12, at(e.clientX, e.clientY)));
  };

  const path = (points: Point[]) =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.x).toFixed(2)} ${py(p.y).toFixed(2)}`).join(' ');

  // Where the axes sit when the origin is off the window: pinned to the edge,
  // so the labels stay on the screen rather than scrolling off with the axis.
  const axisY = Math.min(height - 1, Math.max(1, py(0)));
  const axisX = Math.min(width - 1, Math.max(1, px(0)));

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={box}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={onWheel}
        style={{
          width: '100%',
          height,
          touchAction: 'none',
          cursor: 'crosshair',
          borderRadius: 'var(--r-lg)',
          border: '1px solid var(--app-line)',
          background: 'var(--app-panel)',
          overflow: 'hidden',
        }}
      >
        <svg width={width} height={height} role="img" aria-label={says}>
          {ticks(shown.x0, shown.x1, Math.max(2, Math.round(width / 80))).map((t) => (
            <line
              key={`vx${t}`}
              x1={px(t)}
              y1={0}
              x2={px(t)}
              y2={height}
              stroke="var(--app-line)"
              strokeWidth={t === 0 ? 1.4 : 0.6}
              opacity={t === 0 ? 1 : 0.55}
            />
          ))}
          {ticks(shown.y0, shown.y1, Math.max(2, Math.round(height / 60))).map((t) => (
            <line
              key={`hz${t}`}
              x1={0}
              y1={py(t)}
              x2={width}
              y2={py(t)}
              stroke="var(--app-line)"
              strokeWidth={t === 0 ? 1.4 : 0.6}
              opacity={t === 0 ? 1 : 0.55}
            />
          ))}

          {/*
            A label within a few pixels of the edge is drawn half off it — the
            `-10` on the left comes out as `0`, which is not a smaller label,
            it is a wrong number on an axis. Dropped rather than nudged: a tick
            whose label has been moved to fit is a tick pointing at the wrong
            gridline.
          */}
          {ticks(shown.x0, shown.x1, Math.max(2, Math.round(width / 80)))
            .filter((t) => t !== 0 && px(t) > 16 && px(t) < width - 16)
            .map((t) => (
              <text
                key={`tx${t}`}
                x={px(t)}
                y={Math.min(height - 4, axisY + 12)}
                textAnchor="middle"
                fontSize={9}
                fill="var(--app-dim)"
              >
                {tickText(t, gapX)}
              </text>
            ))}
          {ticks(shown.y0, shown.y1, Math.max(2, Math.round(height / 60)))
            .filter((t) => t !== 0 && py(t) > 12 && py(t) < height - 6)
            .map((t) => (
              <text
                key={`ty${t}`}
                /*
                 * To the left of the axis where there is room for it, and to
                 * the right where there is not. Against the axis on the same
                 * side always, the numbers sit on top of the line they are
                 * labelling and read as struck through.
                 */
                x={axisX > 40 ? axisX - 5 : axisX + 5}
                textAnchor={axisX > 40 ? 'end' : 'start'}
                y={py(t) - 3}
                fontSize={9}
                fill="var(--app-dim)"
              >
                {tickText(t, gapY)}
              </text>
            ))}

          {drawings.map((d) => (
            <g key={d.id}>
              {d.drawn.paths.map((points, i) => (
                <path
                  key={i}
                  d={path(points)}
                  fill="none"
                  stroke={d.colour}
                  strokeWidth={1.9}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {d.drawn.points.map((p, i) => (
                <circle key={`p${i}`} cx={px(p.x)} cy={py(p.y)} r={3.6} fill={d.colour} />
              ))}
            </g>
          ))}

          {trace ? (
            <g>
              <circle
                cx={px(trace.x)}
                cy={py(trace.y)}
                r={5}
                fill="var(--app-bg)"
                stroke="var(--app-fg)"
                strokeWidth={1.6}
              />
            </g>
          ) : null}
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
        <Knob label="Zoom in" onPress={() => move(zoomed(frame, 1 / 1.6))}>+</Knob>
        <Knob label="Zoom out" onPress={() => move(zoomed(frame, 1.6))}>−</Knob>
        <Knob label="Fit the window to the curves" onPress={onFit}>⤢</Knob>
        <Knob
          label="Back to ten by ten"
          onPress={() => {
            onTrace(null);
            onFrame(HOME);
          }}
        >
          ⌂
        </Knob>
      </div>
    </div>
  );
}

/** One of the three controls over the corner of the graph. */
function Knob({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      className="bare tappable"
      aria-label={label}
      title={label}
      onClick={onPress}
      style={{
        width: 30,
        height: 30,
        borderRadius: 'var(--r-sm)',
        border: '1px solid var(--app-line)',
        background: 'var(--app-bg)',
        fontSize: 'var(--type-md)',
      }}
    >
      {children}
    </button>
  );
}
