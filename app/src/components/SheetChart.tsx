import { useMemo } from 'react';
import {
  axisText,
  bands,
  baselineFor,
  chartNote,
  describeChart,
  needsLegend,
  readChart,
  scaleFor,
  slices,
  wedge,
  type ChartRead,
  type SheetChart as ChartSpec,
} from '../lib/chart';
import { anchorHue, tintAt } from '../lib/tint';
import { ground as groundOf, resolveGround } from '../lib/look';
import { usePrefersDark } from '../lib/prefers';
import { useStore } from '../state/store';
import { secondLine } from '../lib/dim';
import type { Cells } from '../lib/sheet';

/**
 * The picture itself.
 *
 * One SVG, drawn in its own pixel grid and scaled to whatever width it is
 * given. A `viewBox` of 0–100 stretched with `preserveAspectRatio="none"` is
 * how the small charts on the report screens are drawn, and it is right for
 * them — they are one shape with no type on them. It cannot be right here: a
 * chart has words along two edges, and stretching the box stretches the
 * letters with it, so the same chart is condensed on a phone and extended on a
 * laptop.
 *
 * ## The colours are the reader's own
 *
 * Series are hues spread around the accent, exactly as the grapher's curves
 * are — see `lib/tint.ts`. Nothing here picks a colour, so a chart on
 * Parchment and the same chart on Ink are one family each, and a reader who
 * has turned their accent to copper takes the whole chart with them.
 *
 * ## The legend is HTML, not SVG
 *
 * Text in an SVG does not wrap and does not take the app's type scale. Six
 * series named after six assignments overflow the box silently at 390px. So
 * the drawing is the SVG and every word that is not an axis label is a real
 * element under it, which wraps, scales with the reader's text size, and can
 * be selected.
 */

/** The drawing's own grid. Everything below is in these units. */
const W = 640;
const H = 360;
const PAD = { top: 10, right: 14, bottom: 46, left: 56 };

const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

/** Axis and category type, in the drawing's units — about 11px at full width. */
const AXIS_TYPE = 13;

export function SheetChart({ cells, chart }: { cells: Cells; chart: ChartSpec }) {
  const { state } = useStore();
  const light = groundOf(resolveGround(state.ground, usePrefersDark())).light;

  const read = useMemo(() => readChart(cells, chart), [cells, chart]);

  const colours = useMemo(() => {
    const anchor = anchorHue(state.accent, state.hue);
    const count = chart.kind === 'pie' ? Math.max(1, read.labels.length) : Math.max(1, read.series.length);
    return Array.from({ length: count }, (_, i) => tintAt(anchor + (i * 360) / count, light).fill);
  }, [state.accent, state.hue, light, chart.kind, read.labels.length, read.series.length]);

  const note = chartNote(chart, read);

  if (read.trouble) {
    return (
      <div
        style={{
          padding: 'var(--sp-6)',
          borderRadius: 'var(--r-lg)',
          border: '1px solid var(--app-line)',
          background: 'var(--app-panel)',
          fontSize: 'var(--type-sm)',
          ...secondLine(),
          textWrap: 'pretty',
        }}
      >
        {read.trouble}
      </div>
    );
  }

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={describeChart(chart, read)}
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
          borderRadius: 'var(--r-lg)',
          border: '1px solid var(--app-line)',
          background: 'var(--app-panel)',
        }}
      >
        {chart.kind === 'pie' ? (
          <Pie read={read} colours={colours} />
        ) : (
          <Axes read={read} kind={chart.kind} colours={colours} />
        )}
      </svg>
      {needsLegend(read, chart.kind) ? (
        <Legend
          names={chart.kind === 'pie' ? read.labels : read.series.map((s) => s.name)}
          colours={colours}
        />
      ) : null}
      {note ? (
        <div
          style={{
            fontSize: 'var(--type-xs)',
            ...secondLine(),
            marginTop: 'var(--sp-4)',
            textWrap: 'pretty',
          }}
        >
          {note}
        </div>
      ) : null}
    </div>
  );
}

/** The swatches and their names, under the drawing. */
function Legend({ names, colours }: { names: string[]; colours: string[] }) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--sp-4) var(--sp-6)',
        marginTop: 'var(--sp-4)',
        fontSize: 'var(--type-xs)',
      }}
    >
      {names.map((name, i) => (
        <span key={`${name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <span
            aria-hidden="true"
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: colours[i % colours.length],
              flex: '0 0 auto',
            }}
          />
          <span style={secondLine()}>{name}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * Columns, bars and a line — one function, because they are one picture.
 *
 * A bar chart is a column chart with the two axes swapped, and writing them
 * apart means two copies of the gridlines, two copies of the tick labels and
 * two places for an off-by-one in the band arithmetic to hide. So the value
 * axis and the category axis are named rather than called x and y, and which
 * screen direction each one runs in is the one thing that differs.
 */
function Axes({
  read,
  kind,
  colours,
}: {
  read: ChartRead;
  kind: 'column' | 'bar' | 'line';
  colours: string[];
}) {
  const flat = read.series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const scale = scaleFor(flat, baselineFor(kind));
  const sideways = kind === 'bar';

  /** A value, as a distance along the value axis from its zero end. */
  const along = (v: number) => {
    const share = scale.max === scale.min ? 0 : (v - scale.min) / (scale.max - scale.min);
    return share * (sideways ? PLOT_W : PLOT_H);
  };
  /** The same value as a screen coordinate on the axis it is drawn against. */
  const valueAt = (v: number) => (sideways ? PAD.left + along(v) : PAD.top + PLOT_H - along(v));

  const catLength = sideways ? PLOT_H : PLOT_W;
  const { band, width, offset } = bands(catLength, read.labels.length, kind === 'line' ? 1 : read.series.length);
  const catAt = (i: number) => (sideways ? PAD.top : PAD.left) + i * band;
  /** The middle of a category's block — where a line's point and its label sit. */
  const catMid = (i: number) => catAt(i) + band / 2;

  const zero = valueAt(Math.min(Math.max(0, scale.min), scale.max));

  // Every nth label, so twenty categories do not draw twenty overlapping
  // words. The first is always drawn, which is what makes the stride readable.
  const stride = Math.max(1, Math.ceil(read.labels.length / (sideways ? 12 : 8)));

  return (
    <>
      {/* Gridlines and their figures, behind everything. */}
      {scale.ticks.map((t) => {
        const at = valueAt(t);
        return (
          <g key={t}>
            <line
              x1={sideways ? at : PAD.left}
              y1={sideways ? PAD.top : at}
              x2={sideways ? at : PAD.left + PLOT_W}
              y2={sideways ? PAD.top + PLOT_H : at}
              stroke="var(--app-line)"
              strokeWidth={t === 0 ? 1.5 : 1}
              opacity={t === 0 ? 0.9 : 0.45}
            />
            <text
              x={sideways ? at : PAD.left - 8}
              y={sideways ? PAD.top + PLOT_H + 18 : at + 4}
              textAnchor={sideways ? 'middle' : 'end'}
              fontSize={AXIS_TYPE}
              fill="var(--app-fg)"
              opacity="0.6"
            >
              {axisText(t)}
            </text>
          </g>
        );
      })}

      {/* The marks. */}
      {kind === 'line'
        ? read.series.map((s, si) => (
            <Line
              key={s.name + si}
              values={s.values}
              colour={colours[si % colours.length]}
              at={catMid}
              valueAt={valueAt}
            />
          ))
        : read.series.map((s, si) =>
            s.values.map((v, ci) => {
              if (v === null) return null;
              const start = catAt(ci) + offset(si);
              const near = valueAt(v);
              const far = zero;
              const thick = Math.max(1, Math.abs(near - far));
              return (
                <rect
                  key={`${si}-${ci}`}
                  x={sideways ? Math.min(near, far) : start}
                  y={sideways ? start : Math.min(near, far)}
                  width={sideways ? thick : width}
                  height={sideways ? width : thick}
                  fill={colours[si % colours.length]}
                  opacity="0.9"
                >
                  <title>{`${read.labels[ci]} · ${s.name}: ${v}`}</title>
                </rect>
              );
            }),
          )}

      {/* The category names, along the other edge. */}
      {read.labels.map((label, i) =>
        i % stride === 0 ? (
          <text
            key={`${label}-${i}`}
            x={sideways ? PAD.left - 8 : catMid(i)}
            y={sideways ? catMid(i) + 4 : PAD.top + PLOT_H + 20}
            textAnchor={sideways ? 'end' : 'middle'}
            fontSize={AXIS_TYPE}
            fill="var(--app-fg)"
            opacity="0.75"
          >
            {clip(label, sideways ? 9 : Math.max(4, Math.floor(band * stride / 8)))}
          </text>
        ) : null,
      )}
    </>
  );
}

/**
 * One series as a line.
 *
 * Broken at a gap rather than drawn across it: joining the two sides of a
 * missing week states a value for that week, and the value stated is always
 * the average of its neighbours, which is a number nobody measured.
 */
function Line({
  values,
  colour,
  at,
  valueAt,
}: {
  values: (number | null)[];
  colour: string;
  at: (i: number) => number;
  valueAt: (v: number) => number;
}) {
  const runs: { x: number; y: number }[][] = [];
  let run: { x: number; y: number }[] = [];
  values.forEach((v, i) => {
    if (v === null) {
      if (run.length) runs.push(run);
      run = [];
      return;
    }
    run.push({ x: at(i), y: valueAt(v) });
  });
  if (run.length) runs.push(run);

  return (
    <>
      {runs.map((points, i) => (
        <polyline
          key={i}
          points={points.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={colour}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {runs.flat().map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={colour} />
      ))}
    </>
  );
}

function Pie({ read, colours }: { read: ChartRead; colours: string[] }) {
  const cut = slices(read.labels, read.series[0]?.values ?? []);
  const r = Math.min(PLOT_W, PLOT_H) / 2 - 4;
  const cx = PAD.left + PLOT_W / 2;
  const cy = PAD.top + PLOT_H / 2;

  if (!cut.length) {
    return (
      <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={AXIS_TYPE} fill="var(--app-fg)" opacity="0.6">
        Nothing in that range is a positive number.
      </text>
    );
  }

  return (
    <>
      {cut.map((s, i) => (
        <path
          key={s.label + i}
          d={wedge(cx, cy, r, s.from, s.to)}
          fill={colours[read.labels.indexOf(s.label) % colours.length]}
          stroke="var(--app-panel)"
          strokeWidth="1.5"
        >
          <title>{`${s.label}: ${s.value} (${Math.round(s.share * 100)}%)`}</title>
        </path>
      ))}
    </>
  );
}

/** A label short enough for the space it has, with an ellipsis when it is not. */
function clip(text: string, chars: number): string {
  return text.length > chars ? `${text.slice(0, Math.max(1, chars - 1))}…` : text;
}
