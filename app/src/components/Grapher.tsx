import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { Plot, type Drawing } from './Plot';
import { Surface } from './Surface';
import { heightOf, heights, range } from '../lib/surface';
import { asArrows, asContours } from '../lib/fields';
import { asOde, asSecond, asSystem, rateOf, through } from '../lib/ode';
import { ActionButton, PickChips, SectionLabel, Toggle } from './ui';
import { secondLine } from '../lib/dim';
import { ground as groundOf, resolveGround } from '../lib/look';
import { usePrefersDark } from '../lib/prefers';
import { anchorHue, tintAt } from '../lib/tint';
import { text as showValue, value, type Val } from '../lib/calc';
import { Equation } from './Equation';
import { exactly, latexFn, latexTransform, poleText, poles, transferOf } from '../lib/laplace';
import {
  DETAIL,
  EXAMPLES,
  HOME,
  TURNS,
  answered,
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
  /**
   * How far round θ and t are drawn, in half-turns.
   *
   * On screen rather than in the notation, because it is a property of the
   * *drawing* rather than of the curve: a spiral is the same spiral whether
   * two turns of it or twelve are on the page. It appears only when there is a
   * curve it could apply to — a control for a thing nobody has written yet is
   * a control in the way.
   */
  const [turns, setTurns] = useState<number>(DETAIL.turns);
  /**
   * How a `z =` line is drawn: as the solid thing, or as its contour lines.
   *
   * A control rather than notation, because it is a choice about the drawing
   * and not about the function. A surface is the better picture of a shape;
   * contours are the better one for reading values off, which is why a map has
   * them and an artist's impression does not.
   */
  const [view, setView] = useState<'surface' | 'contours'>('surface');
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

  /*
   * Every `y(a) = b` on the list, as points.
   *
   * Gathered for the whole list rather than per equation: a student writing
   * two initial conditions under one `y' =` means two solutions of the same
   * equation, which is the picture a textbook draws, and nothing about the
   * order they were typed in should change that.
   */
  const said = useMemo(
    () =>
      read
        .filter((line, at) => line.kind === 'start' && lines[at].on)
        .map((line) => {
          if (line.kind !== 'start') return null;
          const one = (node: Parameters<typeof value>[0]) => {
            const got = value(node, scope);
            return Array.isArray(got) ? (got[0] ?? NaN) : got;
          };
          const at = one(line.at);
          const to = one(line.value);
          return Number.isFinite(at) && Number.isFinite(to)
            ? { of: line.of, rate: line.rate, at, to }
            : null;
        })
        .filter((c): c is { of: 'x' | 'y'; rate: boolean; at: number; to: number } => c !== null),
    [read, lines, scope],
  );

  /** `y(a) = b` — where a solution passes, which is a point on the picture. */
  const starts = useMemo(
    () => said.filter((c) => c.of === 'y' && !c.rate).map((c) => ({ x: c.at, y: c.to })),
    [said],
  );

  /**
   * The two halves of a system, where both are on the list.
   *
   * `x' = …` and `y' = …` together are one picture in the plane they share;
   * either on its own is the ordinary first-order kind. Both have to be first
   * order — a second-order equation paired with a first is not a system, it is
   * two equations somebody is part-way through writing.
   */
  const pair = useMemo(() => {
    const across = read.find((line, at) => line.kind === 'ode' && line.of === 'x' && line.order === 1 && lines[at].on);
    const up = read.find((line, at) => line.kind === 'ode' && line.of === 'y' && line.order === 1 && lines[at].on);
    return across && across.kind === 'ode' && up ? { dx: across.body } : null;
  }, [read, lines]);

  /** Where a system starts: `x(0) = a` and `y(0) = b`, or nothing and it fills the plane. */
  const together = useMemo(() => {
    const across = said.find((c) => c.of === 'x' && !c.rate);
    const up = said.find((c) => c.of === 'y' && !c.rate);
    return across && up ? [{ x: across.to, y: up.to }] : [];
  }, [said]);

  /** Where a second-order equation starts: the value and the rate, at the same x. */
  const second = useMemo(() => {
    const at = said.find((c) => c.of === 'y' && !c.rate);
    const speed = said.find((c) => c.of === 'y' && c.rate);
    if (!at) return [];
    return [{ x: at.at, y: at.to, v: speed?.to ?? 0 }];
  }, [said]);

  /**
   * The closed form, where the equation on the line has one.
   *
   * The curve beside it is walked and always has been — `lib/ode.ts` will
   * solve anything that has a slope, which is most of what somebody types. The
   * formula is what a methods course asks for on the page and a walk cannot
   * produce, so where Laplace can get it, it goes under the line as well. It is
   * an addition to the picture and never a replacement for it: an equation
   * that is not linear with constant coefficients simply has no line of text
   * under it, and draws exactly as it did before.
   *
   * Only a lone equation with its conditions at zero. A system is two lines
   * making one picture, and Laplace starts at t = 0 by construction — a
   * `y(3) = 1` is a different problem, and quietly sliding it to zero would be
   * an answer to a question nobody asked.
   */
  const closed = useMemo(() => {
    const out: Record<number, { exact?: string; transfer?: string; poles?: string }> = {};
    if (pair) return out;
    read.forEach((line, index) => {
      if (line.kind !== 'ode' || line.of !== 'y' || !lines[index].on) return;
      /*
       * The transfer function first, because it needs less.
       *
       * It is the equation written as what it does to an input and has
       * nothing to do with where the solution starts — so it is there for an
       * equation with no conditions under it at all, which is the state the
       * list is in for most of the time somebody is typing.
       */
      const system = transferOf({ body: line.body, of: 'x', order: line.order, scope });
      if (system.ok) {
        out[index] = { transfer: latexTransform(system.it, 's'), poles: poleText(poles(system.it)) };
      }
      const start = said.find((c) => c.of === 'y' && !c.rate);
      const speed = said.find((c) => c.of === 'y' && c.rate);
      if (!start || Math.abs(start.at) > 1e-9) return;
      if (line.order === 2 && !speed) return;
      const got = exactly({
        body: line.body,
        of: 'x',
        order: line.order,
        y0: start.to,
        v0: speed?.to ?? 0,
        scope,
      });
      if (got.ok && got.it.terms.length) out[index] = { ...out[index], exact: latexFn(got.it, 'x') };
    });
    return out;
  }, [read, lines, said, scope, pair]);

  /*
   * The contour map, and the levels it was cut at.
   *
   * Worked once and read twice: the lines go on the picture, and the levels go
   * under it in a sentence. A map whose spacing is not stated is a picture
   * rather than a reading — the whole reason to draw contours is to be able to
   * say "every twenty, and this one is zero".
   */
  const flat = useMemo(() => {
    const line = read.find((l, at) => l.kind === 'surface' && lines[at].on);
    if (!line || line.kind !== 'surface' || view !== 'contours') return null;
    return asContours(line.body, scope, frame);
  }, [read, lines, scope, frame, view]);

  const drawings: Drawing[] = useMemo(
    () =>
      lines
        .map((line, i) => ({ line, at: i }))
        .filter(({ line, at }) => line.on && read[at].kind !== 'blank')
        .map(({ line, at }) => {
          const reading = read[at];
          if (reading.kind === 'ode') {
            /*
             * Three pictures wear the same notation, and what else is on the
             * list decides which: an `x' =` beside a `y' =` is a system, drawn
             * in the plane the two quantities share; `y'' =` is a second-order
             * equation; a lone `y' =` is the slope field it has always been.
             *
             * The system is drawn by the `y' =` line of the pair so that it is
             * drawn once — the `x' =` line is half of one picture, not a
             * picture of its own, and it says so in the list.
             */
            if (pair) {
              if (reading.of === 'x') return { id: line.id, colour: colours[at], drawn: { paths: [], points: [] } };
              return {
                id: line.id,
                colour: colours[at],
                drawn: asSystem(pair.dx, reading.body, together, scope, frame),
              };
            }
            if (reading.order === 2) {
              return {
                id: line.id,
                colour: colours[at],
                drawn: asSecond(reading.body, second, scope, frame),
              };
            }
            return { id: line.id, colour: colours[at], drawn: asOde(reading.body, starts, scope, frame) };
          }
          if (reading.kind === 'field') {
            return { id: line.id, colour: colours[at], drawn: asArrows(reading.x, reading.y, scope, frame) };
          }
          if (reading.kind === 'surface') {
            // Nothing on the flat picture while the surface has it; drawn as
            // contours only when the view asks for them.
            return {
              id: line.id,
              colour: colours[at],
              drawn: view === 'contours' && flat ? flat.drawn : { paths: [], points: [] },
            };
          }
          return { id: line.id, colour: colours[at], drawn: draw(reading, scope, frame, { ...DETAIL, turns }) };
        }),
    [lines, read, scope, frame, colours, turns, view, flat, starts, pair, together, second],
  );

  /** Whether anything on the list is drawn by turning or running, rather than across x. */
  const winding = read.some((line) => line.kind === 'polar' || line.kind === 'parametric');

  /*
   * The first surface on the list, and the picture it takes over.
   *
   * A height over the floor and a curve across the page are two different
   * drawings with two different cameras, and putting them in one box would
   * make both unreadable. So a `z =` line shows the surface instead, and the
   * list says as much rather than leaving somebody to wonder where their
   * parabola went. The first, because two surfaces at once is a picture nobody
   * can read either — the second is drawn by turning its own line on.
   */
  const solid = lines
    .map((line, at) => ({ line, at }))
    .find(({ line, at }) => line.on && read[at].kind === 'surface' && view === 'surface');
  /** Whether a `z =` line is on the list at all, which is what the view chips are for. */
  const hasSurface = read.some((line, at) => line.kind === 'surface' && lines[at].on);

  const solidLine = solid ? read[solid.at] : null;
  // Held still across renders that are not about the surface — every new
  // identity here re-samples the whole mesh, and a trace on the flat picture
  // is not a reason to do that.
  const solidAt = useMemo(
    () => (solidLine && solidLine.kind === 'surface' ? heightOf(solidLine.body, scope) : null),
    [solidLine, scope],
  );

  const add = (text = '') => dispatch({ type: 'addPlot', text });

  return (
    <>
      {solidLine && solidLine.kind === 'surface' && solidAt ? (
        <Surface
          at={solidAt}
          frame={frame}
          colour={colours[solid?.at ?? 0]}
          says={`A surface of ${lines[solid?.at ?? 0]?.text}, seen from above and to one side. Drag to turn it.`}
        />
      ) : (
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
      )}

      {solidLine ? (
        <div style={{ ...secondLine(), fontSize: 'var(--type-xs)', marginTop: 'var(--sp-3)' }}>
          A <code>z =</code> line is a surface, so it is drawn on its own. Turn it off, or draw it as
          contours below, to get the flat picture and the curves back.
        </div>
      ) : null}

      {flat && flat.cuts.length > 1 ? (
        <div style={{ ...secondLine(), fontSize: 'var(--type-xs)', marginTop: 'var(--sp-3)' }}>
          A line every {showValue(neat(flat.cuts[1] - flat.cuts[0], 1))}, from{' '}
          {showValue(flat.cuts[0])} to {showValue(flat.cuts[flat.cuts.length - 1])}
          {flat.cuts.includes(0) ? ', with zero drawn heaviest' : ''}. Where they crowd together it is
          steep.
        </div>
      ) : null}

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
            solved={closed[i]}
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

      {hasSurface ? (
        <>
          <SectionLabel>How to draw it</SectionLabel>
          <PickChips
            options={['surface', 'contours'] as const}
            value={view}
            onChange={setView}
            labels={(id) => (id === 'surface' ? 'As a surface' : 'As contours')}
          />
          <div style={{ ...secondLine(), fontSize: 'var(--type-xs)', marginTop: 'var(--sp-3)' }}>
            The same <code>z =</code> line, two pictures: the shape of it, or the lines where it is
            level — which is the one you read values off, and the one a map uses.
          </div>
        </>
      ) : null}

      {winding ? (
        <>
          <SectionLabel>How far round</SectionLabel>
          <PickChips
            options={TURNS}
            value={turns}
            onChange={setTurns}
            labels={(n) => (n === 1 ? 'Half a turn' : `${n / 2} turn${n > 2 ? 's' : ''}`)}
          />
          <div style={{ ...secondLine(), fontSize: 'var(--type-xs)', marginTop: 'var(--sp-3)' }}>
            θ and t run from 0 to {turns === 1 ? 'π' : `${turns}π`}. A circle closes in one turn; a
            spiral and a Lissajous figure want more.
          </div>
        </>
      ) : null}

      <Sliders lines={lines} read={read} scope={scope} />

      {solidLine && solidLine.kind === 'surface' ? (
        <Heights body={solidLine.body} scope={scope} frame={frame} />
      ) : null}

      {(() => {
        const ode = read.find((line, at) => line.kind === 'ode' && lines[at].on);
        return ode && ode.kind === 'ode' ? (
          <Solutions body={ode.body} starts={starts} scope={scope} frame={frame} />
        ) : null;
      })()}

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
        slider, and <code>(2, 3)</code> is a point. An <code>r =</code> line with the angle in it is a polar
        curve — <code>{'r = 2 + 2\\cos(\\theta)'}</code> — and a pair with <code>t</code> in it is the
        path a moving point takes — <code>{'(\\cos(t), \\sin(t))'}</code>. A <code>z =</code> line is a
        surface — <code>z = x^2 - y^2</code> — drawn over the window the axes are set to, as the solid
        thing or as its contour lines. A pair with <code>x</code> or <code>y</code> in it is a field
        of arrows — <code>(y, -x)</code>, which is every phase diagram. And{' '}
        <code>{"y' = x + y"}</code> is a differential equation: the slope field, and the solution
        through every <code>y(0) = 1</code> you write under it. <code>{"y'' = -y"}</code> is a
        second-order one, which wants a <code>{"y'(0) = 0"}</code> as well; an{' '}
        <code>{"x' = …"}</code> beside a <code>{"y' = …"}</code> is a system, drawn as the path the
        two make in the plane they share — and where an equation is linear with
        constant coefficients, the exact solution is printed under it as well.{' '}
        <code>{'L{t^2 e^{-t}}'}</code> is a Laplace transform, read and drawn against{' '}
        <code>s</code>, and <code>{'L^{-1}{1/(s^2 + 4)}'}</code> is the way back.{' '}
        <code>{'conv(t, e^{-t})'}</code> convolves two functions — the awkward integral, done as
        the product it is in <code>s</code> — and an <code>H =</code> line with an <code>s</code>{' '}
        in it is a transfer function, which says where its poles are and whether it settles. It
        takes the same notation the Write tab draws, so a formula you kept can be pasted in as it is.
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
  solved,
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
  /** What Laplace makes of the equation on this line, where it can make anything of it. */
  solved?: { exact?: string; transfer?: string; poles?: string };
  onText: (text: string) => void;
  onShow: () => void;
  onDrop: () => void;
}) {
  const unset = missing(reading, scope);
  /*
   * Whether this line puts anything on the picture — which decides whether its
   * dot is a switch or an empty ring. A surface belongs on the list: the note
   * beside it says to turn it off to get the curves back, and a disabled
   * switch would make that sentence a lie.
   */
  const drawn =
    reading.kind === 'curve' ||
    reading.kind === 'relation' ||
    reading.kind === 'point' ||
    reading.kind === 'polar' ||
    reading.kind === 'parametric' ||
    reading.kind === 'field' ||
    reading.kind === 'ode' ||
    // An initial condition draws no line of its own — it picks which solution
    // the equation above it draws — but its switch is live, because turning it
    // off is how you get the whole family back.
    reading.kind === 'start' ||
    reading.kind === 'transform' ||
    reading.kind === 'inverse' ||
    reading.kind === 'convolution' ||
    reading.kind === 'transfer' ||
    reading.kind === 'surface';
  /** Whether it puts ink of its own on the picture — see the swatch below. */
  const inked = drawn && reading.kind !== 'start';

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
            /*
             * Filled where the line has ink of its own on the picture.
             *
             * An initial condition switches on and off like anything else —
             * turning it off gets the family back — but it draws nothing in
             * its own colour, and a filled swatch would promise a curve
             * somewhere on the picture that nobody can find.
             */
            border: `2px solid ${inked ? colour : 'var(--app-line)'}`,
            background: on && inked ? colour : 'transparent',
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
      ) : (
        <Answer reading={reading} scope={scope} solved={solved} />
      )}
    </div>
  );
}

/**
 * What a line comes to, under it.
 *
 * A transform has an answer rather than only a curve — the whole reason to
 * write `L{t^2}` is to read `\frac{2}{s^3}` — and an equation that Laplace can
 * solve has one too. Both are drawn as equations rather than printed as text,
 * by the same component the Write tab uses, because `\frac{2}{s^{3}}` in a
 * monospace line is the thing this screen exists to stop people writing.
 */
function Answer({
  reading,
  scope,
  solved,
}: {
  reading: Line;
  scope: ReturnType<typeof scopeOf>;
  solved?: { exact?: string; transfer?: string; poles?: string };
}) {
  const got = answered(reading, scope);
  if (got && 'says' in got) {
    return (
      <div style={{ fontSize: 'var(--type-xs)', color: 'var(--app-warn)', marginTop: 'var(--sp-2)' }}>
        {got.says}
      </div>
    );
  }
  if (!got && !solved) return null;
  return (
    <div style={{ ...secondLine(), fontSize: 'var(--type-xs)', marginTop: 'var(--sp-2)' }}>
      {got ? (
        <>
          <div>{got.lead}</div>
          <Wide latex={got.latex} />
          <div>
            Drawn against {got.over}.{got.note ? ` ${got.note}` : ''}
          </div>
        </>
      ) : null}
      {solved?.exact ? (
        <>
          <div>Exactly, by Laplace:</div>
          <Wide latex={`y = ${solved.exact}`} />
        </>
      ) : null}
      {solved?.transfer ? (
        <>
          <div>As a system, it is</div>
          <Wide latex={`H(s) = ${solved.transfer}`} />
          <div>{solved.poles}</div>
        </>
      ) : null}
    </div>
  );
}

/**
 * An equation as long as it is.
 *
 * A forced spring's solution is four terms and runs past the width of a phone
 * twice over, and there is no shortening it that is still the answer. So it
 * scrolls sideways inside its own box — the one place in this app that is
 * allowed to — rather than pushing the page out from under everything else.
 */
function Wide({ latex }: { latex: string }) {
  return (
    <div style={{ overflowX: 'auto', maxWidth: '100%', paddingBottom: 'var(--sp-1)' }}>
      <Equation latex={latex} inline />
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

/**
 * What a surface says, which is not what a curve says.
 *
 * Zeros and turning points are questions about a line. A height field is
 * asked three things instead — how high, how low, and where — and those are
 * the three worth writing out, because finding them by turning the picture is
 * exactly the hunting this screen exists to save.
 */
function Heights({
  body,
  scope,
  frame,
}: {
  body: Parameters<typeof heightOf>[0];
  scope: Parameters<typeof heightOf>[1];
  frame: Frame;
}) {
  const found = useMemo(() => range(heights(heightOf(body, scope), frame, 48), frame), [body, scope, frame]);
  if (!found.highest || !found.lowest) {
    return (
      <div style={{ ...secondLine(), fontSize: 'var(--type-sm)', marginTop: 'var(--sp-5)' }}>
        This has no height anywhere on the window you are looking at.
      </div>
    );
  }
  const place = (spot: { x: number; y: number; z: number }) =>
    `${showValue(neat(spot.z, found.high - found.low || 1))} at x = ${showValue(neat(spot.x, frame.x1 - frame.x0))}, y = ${showValue(neat(spot.y, frame.y1 - frame.y0))}`;

  return (
    <>
      <SectionLabel>What it says</SectionLabel>
      <Fact says="Highest" value={place(found.highest)} />
      <div style={{ marginTop: 'var(--sp-5)' }}>
        <Fact
          says="Lowest"
          value={place(found.lowest)}
          note="Over the window the axes are set to — drag or zoom the flat view to change it."
        />
      </div>
    </>
  );
}

/**
 * What a differential equation's picture says.
 *
 * Where the solution has got to by the edge of the window, which is the
 * question asked of one: how much is left after ten years, how big does the
 * population get, where does it settle. And where it *stops*, when it stops
 * early — a solution that runs to infinity before the edge is the interesting
 * case and the one a picture alone makes look like a steep line.
 */
function Solutions({
  body,
  starts,
  scope,
  frame,
}: {
  body: Parameters<typeof rateOf>[0];
  starts: Point[];
  scope: Parameters<typeof rateOf>[1];
  frame: Frame;
}) {
  const ends = useMemo(() => {
    const f = rateOf(body, scope);
    return starts.slice(0, 3).map((start) => {
      const curve = through(f, start, frame);
      const last = curve[curve.length - 1];
      return { start, last, whole: !!last && last.x >= frame.x1 - (frame.x1 - frame.x0) / 200 };
    });
  }, [body, starts, scope, frame]);

  if (starts.length === 0) {
    return (
      <>
        <SectionLabel>What it says</SectionLabel>
        <div style={{ ...secondLine(), fontSize: 'var(--type-sm)', lineHeight: 'var(--leading-relaxed)' }}>
          Every point has a solution through it, so the whole family is drawn over the slope field.
          Write <code>y(0) = 1</code> on a line of its own to pick one out — as many as you like, and
          each gets its own curve.
        </div>
      </>
    );
  }

  const span = frame.x1 - frame.x0;
  return (
    <>
      <SectionLabel>What it says</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
        {ends.map(({ start, last, whole }) =>
          !last ? null : (
            <Fact
              key={`${start.x},${start.y}`}
              says={`From y(${showValue(neat(start.x, span))}) = ${showValue(neat(start.y, span))}`}
              value={
                whole
                  ? `y = ${showValue(neat(last.y, Math.abs(last.y) || 1))} at x = ${showValue(neat(last.x, span))}`
                  : `runs away before the edge — last a number at x = ${showValue(neat(last.x, span))}`
              }
              note={
                whole
                  ? 'Solved by walking the equation, not by rearranging it — see lib/ode.ts.'
                  : 'The curve ends there because the solution does, rather than being drawn past it.'
              }
            />
          ),
        )}
      </div>
    </>
  );
}
