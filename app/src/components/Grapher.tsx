import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { Plot, type Drawing } from './Plot';
import { ActionButton, SectionLabel, Toggle } from './ui';
import { secondLine } from '../lib/dim';
import { ground as groundOf, resolveGround } from '../lib/look';
import { usePrefersDark } from '../lib/prefers';
import { anchorHue, tintAt } from '../lib/tint';
import { text as showValue, type Val } from '../lib/calc';
import {
  EXAMPLES,
  HOME,
  area,
  asFunction,
  draw,
  features,
  fitted,
  meet,
  missing,
  neat,
  readLine,
  scopeOf,
  slopeAt,
  type Feature,
  type Frame,
  type Line,
  type Point,
} from '../lib/plot';

/**
 * The graph, and the list of things on it.
 *
 * Every graphing calculator ever sold has this shape — a column of expressions
 * beside a picture — and it is the right one: the list is the document, the
 * picture is the view of it, and editing a line redraws without a button
 * anywhere. What this one adds is the part a calculator leaves you to do by
 * hand: the zeros, the turning points, the price where supply meets demand and
 * the area under the curve are read off and written out, because those are the
 * numbers a problem set asks for and hunting them with a cursor is the bit
 * that goes wrong at midnight.
 *
 * ## Why it is the same box for everything
 *
 * `y = 2x + 3`, `a = 2`, `f(x) = x^2`, `x^2 + y^2 = 25` and `(2, 3)` all go in
 * the same field, and `lib/plot.ts` works out which is which. A student
 * drawing a curve and a student defining a parameter are doing one thing —
 * writing down what is true — and a screen that makes them choose a kind first
 * is a screen that has to be learned before it can be used.
 *
 * ## Where the colours come from
 *
 * `lib/tint.ts`, the same wheel the courses divide between them, anchored on
 * whatever accent the reader chose. Not a fixed palette of six: a colour
 * picked against Ink is a colour nobody chose against Parchment, and this app
 * has thirteen grounds.
 */
export function Grapher() {
  const { state, dispatch, say } = useStore();
  const light = groundOf(resolveGround(state.ground, usePrefersDark())).light;
  const [frame, setFrame] = useState<Frame>(HOME);
  /** See `Plot`: one unit across is one unit down, until a fit says otherwise. */
  const [square, setSquare] = useState(true);
  const [trace, setTrace] = useState<Point | null>(null);
  const [degrees, setDegrees] = useState(false);
  const [from, setFrom] = useState('0');
  const [to, setTo] = useState('1');

  const lines = state.plots;
  const read = useMemo(() => lines.map((l) => readLine(l.text)), [lines]);
  const scope = useMemo(() => scopeOf(read, degrees), [read, degrees]);

  // A hue each, spread around the reader's own wheel, so two curves are
  // opposite and five are seventy-two degrees apart.
  const colours = useMemo(() => {
    const anchor = anchorHue(state.accent, state.hue);
    const spread = Math.max(1, lines.length);
    return lines.map((_, i) => tintAt(anchor + (i * 360) / spread, light).fill);
  }, [lines, state.accent, state.hue, light]);

  const drawings: Drawing[] = useMemo(
    () =>
      lines
        .map((line, i) => ({ line, at: i }))
        .filter(({ line, at }) => line.on && read[at].kind !== 'blank')
        .map(({ line, at }) => ({ id: line.id, colour: colours[at], drawn: draw(read[at], scope, frame) })),
    [lines, read, scope, frame, colours],
  );

  const add = (text = '') => dispatch({ type: 'addPlot', text });

  return (
    <>
      <Plot
        drawings={drawings}
        frame={frame}
        onFrame={(next) => {
          setFrame(next);
          // The home button hands back the ten-by-ten window, and that window
          // is a square one whatever a fit did before it.
          if (next === HOME) setSquare(true);
        }}
        square={square}
        onFit={() => {
          setFrame(fitted(frame, drawings.map((d) => d.drawn)));
          setSquare(false);
        }}
        trace={trace}
        onTrace={setTrace}
        says={saying(lines.filter((l) => l.on).map((l) => l.text))}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', marginTop: 'var(--sp-6)' }}>
        {lines.map((line, i) => (
          <Row
            key={line.id}
            index={i}
            colour={colours[i]}
            line={line.text}
            on={line.on}
            reading={read[i]}
            scope={scope}
            onText={(text) => dispatch({ type: 'writePlot', id: line.id, patch: { text } })}
            onShow={() => dispatch({ type: 'writePlot', id: line.id, patch: { on: !line.on } })}
            onDrop={() => dispatch({ type: 'dropPlot', id: line.id })}
          />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-5)' }}>
        <ActionButton onClick={() => add()} style={{ flex: 1 }}>
          Add a line
        </ActionButton>
        {lines.length > 0 ? (
          <ActionButton
            onClick={() => {
              dispatch({ type: 'setPlot', lines: [] });
              setTrace(null);
              say('The graph is clear.');
            }}
            style={{ flex: 1 }}
          >
            Clear
          </ActionButton>
        ) : null}
      </div>

      {lines.length === 0 ? (
        <>
          <SectionLabel>Start from one of these</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            {EXAMPLES.map((example) => (
              <button
                key={example.name}
                type="button"
                className="bare tappable"
                onClick={() => {
                  dispatch({ type: 'setPlot', lines: example.lines });
                  setFrame(HOME);
                }}
                style={{
                  textAlign: 'left',
                  padding: 'var(--sp-5) var(--sp-6)',
                  borderRadius: 'var(--r-md)',
                  border: '1px solid var(--app-line)',
                }}
              >
                <span style={{ display: 'block', fontSize: 'var(--type-md)' }}>{example.name}</span>
                <span style={{ display: 'block', fontSize: 'var(--type-sm)', color: 'var(--app-dim)', marginTop: 'var(--sp-1)' }}>
                  {example.says}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      <Sliders lines={lines} read={read} scope={scope} />

      <Readings
        lines={lines}
        read={read}
        scope={scope}
        colours={colours}
        frame={frame}
        trace={trace}
        from={from}
        to={to}
        onFrom={setFrom}
        onTo={setTo}
      />

      <SectionLabel>How it reads what you type</SectionLabel>
      <div style={{ ...secondLine(), fontSize: 'var(--type-sm)', lineHeight: 'var(--leading-relaxed)' }}>
        A bare expression is a <code>y =</code>. <code>x = 4</code> is a vertical line, and an
        equation with both letters in it — <code>x^2 + y^2 = 25</code> — is drawn wherever it holds.{' '}
        <code>f(x) = …</code> defines something every line below can use, <code>a = 2</code> gets a
        slider, and <code>(2, 3)</code> is a point. It takes the same notation the Write tab draws,
        so a formula you kept can be pasted in as it is.
      </div>
      <div style={{ marginTop: 'var(--sp-6)' }}>
        <Toggle on={degrees} label="Work in degrees rather than radians" onChange={() => setDegrees(!degrees)} />
      </div>
    </>
  );
}

/** What the picture says, for a screen reader — the curves on it, in order. */
function saying(texts: string[]): string {
  if (texts.length === 0) return 'An empty graph, with the axes crossing at zero.';
  return `A graph of ${texts.join(', ')}. Press it to read a point off it.`;
}

// ── One line of the list ─────────────────────────────────────────────────

function Row({
  index,
  colour,
  line,
  on,
  reading,
  scope,
  onText,
  onShow,
  onDrop,
}: {
  index: number;
  colour: string;
  line: string;
  on: boolean;
  reading: Line;
  scope: ReturnType<typeof scopeOf>;
  onText: (text: string) => void;
  onShow: () => void;
  onDrop: () => void;
}) {
  const unset = missing(reading, scope);
  const drawn = reading.kind === 'curve' || reading.kind === 'relation' || reading.kind === 'point';

  return (
    <div
      style={{
        border: '1px solid var(--app-line)',
        borderRadius: 'var(--r-md)',
        padding: 'var(--sp-3) var(--sp-4)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
        <button
          type="button"
          className="bare tappable"
          aria-pressed={on}
          aria-label={on ? `Hide line ${index + 1}` : `Show line ${index + 1}`}
          onClick={onShow}
          disabled={!drawn}
          style={{
            width: 22,
            height: 22,
            flex: '0 0 auto',
            borderRadius: '50%',
            border: `2px solid ${drawn ? colour : 'var(--app-line)'}`,
            background: on && drawn ? colour : 'transparent',
          }}
        />
        <input
          className="input"
          value={line}
          onChange={(e) => onText(e.target.value)}
          aria-label={`Line ${index + 1}`}
          placeholder="y = 2x + 3"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          style={{
            flex: 1,
            minWidth: 0,
            height: 38,
            fontSize: 'var(--type-md)',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}
        />
        <button
          type="button"
          className="bare tappable"
          aria-label={`Remove line ${index + 1}`}
          onClick={onDrop}
          style={{ width: 26, flex: '0 0 auto', fontSize: 'var(--type-md)', color: 'var(--app-dim)' }}
        >
          ×
        </button>
      </div>
      {reading.kind === 'fault' ? (
        <div style={{ fontSize: 'var(--type-xs)', color: 'var(--app-warn)', marginTop: 'var(--sp-2)' }}>
          {reading.says}
        </div>
      ) : unset.length > 0 ? (
        <div style={{ ...secondLine(), fontSize: 'var(--type-xs)', marginTop: 'var(--sp-2)' }}>
          {unset.join(', ')} {unset.length === 1 ? 'has' : 'have'} no value yet — add a line like{' '}
          <code>{unset[0]} = 1</code>.
        </div>
      ) : null}
    </div>
  );
}

// ── The sliders ──────────────────────────────────────────────────────────

/**
 * A slider for every plain number in the list.
 *
 * This is the thing a graphing calculator does that a printed page cannot:
 * drag `r` and watch the discount curve flatten, drag `μ` and watch the bell
 * walk. Only plain numbers get one — a parameter defined as an expression is
 * derived from something else, and a slider that silently overwrote it would
 * lose the definition somebody wrote.
 */
function Sliders({
  lines,
  read,
  scope,
}: {
  lines: { id: string; text: string }[];
  read: Line[];
  scope: ReturnType<typeof scopeOf>;
}) {
  const { dispatch } = useStore();
  const sliders = read
    .map((line, at) => ({ line, at }))
    .filter(({ line }) => line.kind === 'value' && line.body.kind === 'num');

  if (sliders.length === 0) return null;

  return (
    <>
      <SectionLabel>Move a value</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
        {sliders.map(({ line, at }) => {
          if (line.kind !== 'value') return null;
          const now = Number(scope.vars?.[line.name] ?? 0);
          /*
           * A range around the size of the value it already holds.
           *
           * A fixed ±10 is useless for the value this feature exists for: a
           * discount rate of 0.05 on a slider from −10 to 10 moves in steps of
           * 0.05, so the first nudge doubles it and the second triples it.
           * The decade above the value gives `r` a range of ±0.1 and `n` a
           * range of ±10, from one rule and with no slider settings to open.
           */
          const size = Math.abs(now);
          const decade = size === 0 ? 10 : 10 ** Math.ceil(Math.log10(size));
          const reach = size > decade / 2 ? decade * 2 : decade;
          return (
            <div key={lines[at].id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--type-sm)' }}>
                <span>{line.name}</span>
                <span style={{ color: 'var(--app-dim)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                  {showValue(now)}
                </span>
              </div>
              <input
                type="range"
                aria-label={`${line.name}, now ${showValue(now)}`}
                min={-reach}
                max={reach}
                step={reach / 200}
                value={now}
                onChange={(e) =>
                  dispatch({
                    type: 'writePlot',
                    id: lines[at].id,
                    // `Number(…)` rather than trimming the zeros off the
                    // string: `toPrecision(4)` of 1500 is "1500", and a regex
                    // that strips trailing zeros turns that into 15.
                    patch: { text: `${line.name} = ${Number(Number(e.target.value).toPrecision(4))}` },
                  })
                }
                style={{ width: '100%', accentColor: 'var(--app-accent)' }}
              />
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── What the graph says ──────────────────────────────────────────────────

/**
 * The numbers somebody came for.
 *
 * A graph is rarely the answer; the answer is where it crosses, where it turns
 * or what is under it. A calculator makes you hunt those with a cursor — and
 * hunting is where the slip happens, because a cursor landing near a zero
 * reads out a number that is nearly right and looks exactly right. These are
 * found by arithmetic: bisection for a crossing, thirds for a turning point,
 * Simpson for an area, all in `lib/plot.ts` with the tests that hold them.
 *
 * Only what is on screen is reported, and it says so: a zero outside the
 * window is not missing, it is not being looked at.
 */
function Readings({
  lines,
  read,
  scope,
  colours,
  frame,
  trace,
  from,
  to,
  onFrom,
  onTo,
}: {
  lines: { id: string; text: string; on: boolean }[];
  read: Line[];
  scope: ReturnType<typeof scopeOf>;
  colours: string[];
  frame: Frame;
  trace: Point | null;
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}) {
  const curves = read
    .map((line, at) => ({ fn: asFunction(line, scope), at }))
    .filter((c): c is { fn: (x: number) => number; at: number } => !!c.fn && lines[c.at].on);

  const crossings = useMemo(() => {
    if (curves.length < 2) return [];
    return meet(curves[0].fn, curves[1].fn, frame).slice(0, 4);
  }, [curves, frame]);

  const found = useMemo(
    () => curves.map((c) => ({ at: c.at, marks: features(c.fn, frame).slice(0, 6) })),
    [curves, frame],
  );

  const under = useMemo(() => {
    const a = Number(from);
    const b = Number(to);
    if (!curves[0] || !Number.isFinite(a) || !Number.isFinite(b)) return null;
    return area(curves[0].fn, a, b);
  }, [curves, from, to]);

  /** How wide the window is, which is the precision every reading off it has. */
  const span = frame.x1 - frame.x0;

  if (curves.length === 0 && !trace) return null;

  const traced = trace && curves[0] ? slopeAt(curves[0].fn, trace.x) : null;

  return (
    <>
      <SectionLabel>What it says</SectionLabel>

      {trace ? (
        <Fact
          says="Where you pressed"
          value={`x = ${showValue(neat(trace.x, span))},  y = ${showValue(neat(trace.y, span))}`}
          note={
            traced !== null && Number.isFinite(traced)
              ? `slope of the first curve there: ${showValue(neat(traced, 1))}`
              : ''
          }
        />
      ) : (
        <div style={{ ...secondLine(), fontSize: 'var(--type-sm)' }}>
          Press the graph to read a point off it. Drag to move, pinch or scroll to zoom.
        </div>
      )}

      {found.map(({ at, marks }) =>
        marks.length === 0 ? null : (
          <div key={lines[at].id} style={{ marginTop: 'var(--sp-6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', fontSize: 'var(--type-sm)' }}>
              <span
                aria-hidden
                style={{ width: 10, height: 10, borderRadius: '50%', background: colours[at], flex: '0 0 auto' }}
              />
              <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{lines[at].text}</span>
            </div>
            <ul
              style={{
                ...secondLine(),
                fontSize: 'var(--type-sm)',
                margin: 'var(--sp-2) 0 0',
                paddingLeft: 'var(--sp-7)',
                lineHeight: 'var(--leading-relaxed)',
              }}
            >
              {marks.map((mark) => (
                <li key={`${mark.kind}${mark.x}`}>{markSays(mark, frame.x1 - frame.x0)}</li>
              ))}
            </ul>
          </div>
        ),
      )}

      {crossings.length > 0 ? (
        <div style={{ marginTop: 'var(--sp-6)' }}>
          <Fact
            says="The first two curves cross at"
            value={crossings
              .map((p) => `(${showValue(neat(p.x, span))}, ${showValue(neat(p.y, span))})`)
              .join('   ')}
            note="Where supply meets demand, or where two costs come out the same."
          />
        </div>
      ) : null}

      {curves.length > 0 ? (
        <div style={{ marginTop: 'var(--sp-6)' }}>
          <div style={{ fontSize: 'var(--type-sm)' }}>Area under the first curve</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', marginTop: 'var(--sp-3)' }}>
            <input
              className="input"
              aria-label="Area from"
              value={from}
              onChange={(e) => onFrom(e.target.value)}
              inputMode="decimal"
              style={{ width: 80, height: 36, fontSize: 'var(--type-sm)' }}
            />
            <span style={{ ...secondLine(), fontSize: 'var(--type-sm)' }}>to</span>
            <input
              className="input"
              aria-label="Area to"
              value={to}
              onChange={(e) => onTo(e.target.value)}
              inputMode="decimal"
              style={{ width: 80, height: 36, fontSize: 'var(--type-sm)' }}
            />
            <span style={{ fontSize: 'var(--type-md)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
              {under === null ? '—' : showValue(neat(under, Math.abs(under) || 1) as Val)}
            </span>
          </div>
          <div style={{ ...secondLine(), fontSize: 'var(--type-xs)', marginTop: 'var(--sp-2)' }}>
            Signed: below the axis counts against it, which is what makes a surplus a surplus.
          </div>
        </div>
      ) : null}
    </>
  );
}

function markSays(mark: Feature, span: number): string {
  const x = showValue(neat(mark.x, span));
  if (mark.kind === 'zero') return `crosses zero at x = ${x}`;
  const where = `x = ${x}, y = ${showValue(neat(mark.y, span))}`;
  return mark.kind === 'peak' ? `turns over at ${where}` : `turns up at ${where}`;
}

function Fact({ says, value, note }: { says: string; value: string; note?: string }) {
  return (
    <div>
      <div style={{ ...secondLine(), fontSize: 'var(--type-xs)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {says}
      </div>
      <div
        style={{
          fontSize: 'var(--type-md)',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          marginTop: 'var(--sp-1)',
        }}
      >
        {value}
      </div>
      {note ? (
        <div style={{ ...secondLine(), fontSize: 'var(--type-xs)', marginTop: 'var(--sp-1)' }}>{note}</div>
      ) : null}
    </div>
  );
}
