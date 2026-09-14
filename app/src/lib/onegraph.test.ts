import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { sources, withoutComments } from '../styles/rules';

/**
 * One grapher, and one thing that turns an expression into a curve.
 *
 * `SIMPLIFY-AUDIT.md` E1. A port arrived carrying `lib/graphing.ts` and
 * `components/GraphCalculator.tsx` — a second expression parser and a second
 * plotter — and hung them on `screens/Draw.tsx` as a tab called "Graphing
 * calculator". The app already had `lib/calc.ts` and `lib/plot.ts`, which are
 * what it computes grades with, drawn by `components/Grapher.tsx` on the
 * `equations` destination whose blurb ends "and draw its curve".
 *
 * Neither knew about the other. That is the expensive kind of duplication:
 * not two screens saying the same thing, which a reader notices, but two
 * implementations of the same arithmetic, which only diverge.
 *
 * ## Why this is not covered by `onehome.test.ts`
 *
 * That rule asks whether a *destination's whole body* is rendered inside
 * another screen. `GraphCalculator` was never a destination — it was a second
 * implementation of one, which is invisible to a rule about screens. So this
 * asks the narrower question the recurrence actually takes: is there still
 * exactly one grapher, and exactly one module that turns an expression into
 * something drawable?
 *
 * ## What it does not try to do
 *
 * It does not attempt to detect "this file plots things" in general — a rule
 * that vague is one people satisfy by renaming. It pins the two joints a
 * second stack has to pass through to be reachable: something has to render a
 * grapher, and something has to compile an expression to a path.
 */

const SCREENS = join(process.cwd(), 'src', 'screens');
const COMPONENTS = join(process.cwd(), 'src', 'components');

/** Files rendering `<Name …>`, by the same JSX-not-a-type-argument rule as `onehome`. */
function rendering(dir: string, name: string): string[] {
  return sources(dir)
    .filter((f) => !f.path.includes('.test.'))
    .filter((f) => new RegExp(`<${name}(\\s*/>|\\s+[a-zA-Z-]+[=\\s]|\\s*>)`).test(withoutComments(f.text)))
    .map((f) => f.path.slice(f.path.lastIndexOf('/') + 1));
}

describe('one grapher', () => {
  it('is rendered by exactly one screen, and that screen is Equations', () => {
    // Not "no screen but Equations" — the count matters too. A second screen
    // rendering the *same* component is still two homes for one job, which is
    // what `onehome.test.ts` exists for one level up.
    expect(rendering(SCREENS, 'Grapher')).toEqual(['Equations.tsx']);
  });

  it('draws through the one plot component', () => {
    expect(rendering(COMPONENTS, 'Plot')).toEqual(['Grapher.tsx']);
  });
});

/*
 * `modules()` was here.
 *
 * It existed because `sources()` kept `.tsx` only, and the rule below needs
 * `lib/`, where almost everything is `.ts` — the whole of E1's mistake. That
 * walker takes the extensions it should keep now (`SIMPLIFY-AUDIT.md` G2), so
 * the need is expressed as an argument at the call rather than as a seventh
 * copy of a directory walk.
 */


/**
 * The names a second stack needs, whatever it calls its files.
 *
 * `lib/plot.ts` turns a read line into points and `lib/calc.ts` evaluates the
 * notation; `lib/maths.ts` parses what the Write tab draws. Those three are
 * the app's own and are listed rather than pattern-matched, so adding a
 * fourth is a decision somebody makes here rather than a file that appears.
 */
const ALLOWED = new Set(['plot.ts', 'calc.ts', 'maths.ts']);
const COMPILER = /^export (?:async )?function (compile|graphPath|plotPath|parseExpression)/m;

describe('one thing that turns an expression into a curve', () => {
  it('has no second compiler under lib/', () => {
    const offenders = sources(join(process.cwd(), 'src', 'lib'), { ext: ['.ts', '.tsx'] })
      .concat(sources(COMPONENTS, { ext: ['.ts', '.tsx'] }))
      .filter((f) => !f.path.includes('.test.'))
      .filter((f) => !ALLOWED.has(f.path.slice(f.path.lastIndexOf('/') + 1)))
      .filter((f) => COMPILER.test(withoutComments(f.text)))
      .map((f) => f.path.slice(f.path.indexOf('/src/') + 5));
    expect(offenders).toEqual([]);
  });
});

describe('what it catches', () => {
  // Written against strings, so the shape is still checked now that the files
  // are deleted — otherwise this passes because the code is gone rather than
  // because the rule works.
  it('catches the tab Draw had', () => {
    const tab =
      `return <div className="drawing-workspace"><div role="tablist">` +
      `<button>Graphing calculator</button></div>{mode==='graph'?<GraphCalculator/>:<DiagramBuilder/>}</div>;`;
    expect(/<GraphCalculator(\s*\/>|\s+[a-zA-Z-]+[=\s]|\s*>)/.test(tab)).toBe(true);
  });

  it('catches the exports the ported library had', () => {
    expect(COMPILER.test('export function compileGraph(source:string):GraphFunction {')).toBe(true);
    expect(COMPILER.test('export function compileExpression(source:string):GraphFunction {')).toBe(true);
    expect(COMPILER.test('export function graphPath(fn: Fn, w: GraphWindow): string {')).toBe(true);
  });

  it('leaves the app’s own names alone', () => {
    // `lib/plot.ts` is allowed by name, but the pattern should not be fishing
    // for ordinary words either: `draw`, `series` and `contour` are its API.
    expect(COMPILER.test('export function draw(line: Line, scope: Scope, frame: Frame): Drawn {')).toBe(false);
    expect(COMPILER.test('export function contour(at: (x: number) => number): Point[][] {')).toBe(false);
    expect(COMPILER.test('export function readLine(source: string): Line {')).toBe(false);
  });
});
