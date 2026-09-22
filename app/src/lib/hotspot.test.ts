/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CANVAS, MIN_SPOTS, SPOTS, askable, type Spot } from './hotspot';
import { DIAGRAM_KINDS, type DiagramKind } from './types';

/**
 * The spots, checked against the drawing they were read off.
 *
 * Two kinds of assertion here and the second is the one that matters.
 *
 * The first kind is about the boxes on their own — inside the canvas, not
 * overlapping each other, big enough for a thumb. Those are real faults and
 * they are cheap to check.
 *
 * The second reads `components/Diagram.tsx` **as text** and asserts that the
 * geometry each spot was taken from is still in it. That is the only check
 * available for the fault that actually matters: a spot in the wrong place is
 * a question whose right answer is somewhere else, and a student who knows the
 * material is marked wrong. Nothing else in this repository knows where the
 * equilibrium is supposed to be, so nothing else can notice. Reading the source
 * cannot be fooled by a render that happened to look right, and it goes red the
 * day somebody moves the circle — which is exactly the day the spot stops being
 * true.
 */

const SOURCE = readFileSync(new URL('../components/Diagram.tsx', import.meta.url), 'utf8');

const entries = Object.entries(SPOTS) as [DiagramKind, Spot[]][];

/** Whether a box takes in a point of the drawing. */
const holds = (s: Spot, x: number, y: number) =>
  x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h;

const spot = (kind: DiagramKind, name: string): Spot => {
  const found = SPOTS[kind]?.find((s) => s.name === name);
  if (!found) throw new Error(`no spot named ${name} on ${kind}`);
  return found;
};

describe('the spots as boxes', () => {
  it('control: there are diagrams with spots, and most have none', () => {
    // Both halves. A zero would make every sweep below pass over nothing; all
    // twenty-one would mean somebody had written spots for the curves that
    // have no marked points, which is the thing the file refuses to do.
    expect(entries.length).toBe(5);
    expect(entries.length).toBeLessThan(DIAGRAM_KINDS.length);
  });

  it('names a real diagram every time', () => {
    for (const [kind] of entries) {
      expect(DIAGRAM_KINDS, `${kind} is not a diagram`).toContain(kind);
    }
  });

  it('gives every diagram enough spots to be a question', () => {
    for (const [kind, spots] of entries) {
      expect(spots.length, kind).toBeGreaterThanOrEqual(MIN_SPOTS);
      expect(askable(kind), kind).toBe(true);
    }
  });

  it('says no to a diagram with no spots', () => {
    expect(askable('funnel')).toBe(false);
    expect(askable('brand-pyramid')).toBe(false);
  });

  it('keeps every box inside the canvas', () => {
    for (const [kind, spots] of entries) {
      for (const s of spots) {
        expect(s.x, `${kind}/${s.name} left`).toBeGreaterThanOrEqual(0);
        expect(s.y, `${kind}/${s.name} top`).toBeGreaterThanOrEqual(0);
        expect(s.x + s.w, `${kind}/${s.name} right`).toBeLessThanOrEqual(CANVAS.w);
        expect(s.y + s.h, `${kind}/${s.name} bottom`).toBeLessThanOrEqual(CANVAS.h);
      }
    }
  });

  /*
   * The one that would ship a question with two right answers. Two boxes that
   * overlap make some clicks ambiguous, and which one wins is then whichever
   * the screen happens to draw last — a rule nobody wrote down and no student
   * can see.
   */
  it('never lets two boxes on one diagram overlap', () => {
    for (const [kind, spots] of entries) {
      for (let i = 0; i < spots.length; i++) {
        for (let j = i + 1; j < spots.length; j++) {
          const a = spots[i];
          const b = spots[j];
          const apart =
            a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
          expect(apart, `${kind}: ${a.name} overlaps ${b.name}`).toBe(true);
        }
      }
    }
  });

  /*
   * Big enough to hit with a thumb. A 320-wide canvas drawn at 390px means one
   * unit is a bit over a pixel, so a 28-unit box is about 34 real pixels —
   * under Apple's 44 and over the point at which a miss is the interface's
   * fault rather than the student's. Below 20 it plainly is.
   */
  it('makes every box big enough to hit', () => {
    for (const [kind, spots] of entries) {
      for (const s of spots) {
        expect(s.w, `${kind}/${s.name} width`).toBeGreaterThanOrEqual(20);
        expect(s.h, `${kind}/${s.name} height`).toBeGreaterThanOrEqual(20);
      }
    }
  });

  it('asks for each thing once, in its own words', () => {
    for (const [kind, spots] of entries) {
      expect(new Set(spots.map((s) => s.ask)).size, `${kind} asks`).toBe(spots.length);
      expect(new Set(spots.map((s) => s.name)).size, `${kind} names`).toBe(spots.length);
      for (const s of spots) {
        expect(s.ask.trim().length, `${kind}/${s.name}`).toBeGreaterThan(0);
        expect(s.name.trim().length, `${kind} ask "${s.ask}"`).toBeGreaterThan(0);
        // Phrased as what the thing means, not what it is called — so the
        // label printed on the curve is an aid rather than the answer.
        expect(s.ask, `${kind}/${s.name} asks by its own name`).not.toContain(s.name);
      }
    }
  });
});

describe('the spots against the drawing', () => {
  /*
   * The control for this whole block, and the one this repository keeps
   * relearning: a source scan that matches nothing passes every assertion
   * about what it found. If `Diagram.tsx` moves or is renamed, this says so
   * instead of the rest quietly checking an empty string.
   */
  it('control: the drawing is there and is the one being checked', () => {
    expect(SOURCE.length).toBeGreaterThan(5_000);
    expect(SOURCE).toContain('function SupplyDemand()');
    expect(SOURCE).toContain('viewBox={`0 0 ${W} ${H}`}');
    expect(SOURCE).toContain('const W = 320;');
    expect(SOURCE).toContain('const H = 200;');
  });

  it('puts the equilibrium on the circle supply-demand draws', () => {
    expect(SOURCE).toContain('<circle cx={172.5} cy={90} r={3.5} fill={accent} />');
    expect(holds(spot('supply-demand', 'Equilibrium'), 172.5, 90)).toBe(true);
  });

  /*
   * The curves are lines rather than points, so the assertion is that the box
   * sits on the line: the path is in the source, and the y the line has at the
   * box's own centre is inside the box.
   */
  it('puts the curve boxes on the curves supply-demand draws', () => {
    expect(SOURCE).toContain('<path d="M60 30 L285 150"');
    expect(SOURCE).toContain('<path d="M60 150 L285 30"');
    const at = (x: number, x1: number, y1: number, x2: number, y2: number) =>
      y1 + ((x - x1) / (x2 - x1)) * (y2 - y1);

    const d = spot('supply-demand', 'Demand');
    expect(holds(d, d.x + d.w / 2, at(d.x + d.w / 2, 60, 30, 285, 150))).toBe(true);

    const s = spot('supply-demand', 'Supply');
    expect(holds(s, s.x + s.w / 2, at(s.x + s.w / 2, 60, 150, 285, 30))).toBe(true);
  });

  it('puts the ceiling on the line price-ceiling draws', () => {
    expect(SOURCE).toContain('<path d="M40 126 L300 126"');
    const c = spot('price-ceiling', 'The ceiling');
    expect(holds(c, c.x + c.w / 2, 126)).toBe(true);
    // And on the stretch of it clear of the quantity circles, or the question
    // would have two answers within a thumb of each other.
    expect(c.x + c.w).toBeLessThan(105);
  });

  it('puts the quantities under the circles price-ceiling draws', () => {
    expect(SOURCE).toContain('<circle cx={105} cy={126} r={3} fill={accent} />');
    expect(SOURCE).toContain('<circle cx={240} cy={126} r={3} fill={accent} />');
    // Below the ceiling, on each dashed drop to the axis — the circles
    // themselves sit on the ceiling line, which is a different answer.
    const qs = spot('price-ceiling', 'Quantity supplied');
    const qd = spot('price-ceiling', 'Quantity demanded');
    expect(holds(qs, 105, qs.y + qs.h / 2)).toBe(true);
    expect(holds(qd, 240, qd.y + qd.h / 2)).toBe(true);
    expect(qs.y).toBeGreaterThan(126);
    expect(qd.y).toBeGreaterThan(126);
  });

  it('puts the monopolist’s two decisions on the circles monopoly draws', () => {
    expect(SOURCE).toContain('<circle cx={128} cy={117} r={3} fill={dim} />');
    expect(SOURCE).toContain('<circle cx={128} cy={68} r={3.5} fill={accent} />');
    expect(holds(spot('monopoly', 'MR = MC'), 128, 117)).toBe(true);
    expect(holds(spot('monopoly', 'Price off demand'), 128, 68)).toBe(true);
  });

  it('puts the two quantities on the circles externality draws', () => {
    expect(SOURCE).toContain('<circle cx={175} cy={94} r={3} fill={dim} />');
    expect(SOURCE).toContain('<circle cx={135} cy={74} r={3.5} fill={accent} />');
    expect(holds(spot('externality', 'Market quantity'), 175, 94)).toBe(true);
    expect(holds(spot('externality', 'Socially optimal quantity'), 135, 74)).toBe(true);
  });

  it('puts the standard deviations on the marks normal-curve draws', () => {
    // The diagram lists its own x positions, so this reads them back out
    // rather than restating them.
    for (const [x, name] of [
      [168, 'μ'],
      [211, '+1σ'],
      [125, '−1σ'],
      [254, '+2σ'],
    ] as const) {
      const s = spot('normal-curve', name);
      expect(holds(s, x, s.y + s.h / 2), `${name} at x=${x}`).toBe(true);
    }
    expect(SOURCE).toContain("{ x: 168, l: 'μ' }");
    expect(SOURCE).toContain("{ x: 211, l: '+1' }");
    expect(SOURCE).toContain("{ x: 125, l: '−1' }");
    expect(SOURCE).toContain("{ x: 254, l: '+2' }");
  });

  /*
   * And clear of the band the diagram prints across the middle. The 68% rule
   * is drawn at y=148 with its figure above it; a box that took that in would
   * be a question about standard deviations with the answer written inside the
   * target.
   */
  it('keeps the normal-curve boxes clear of the printed 68% band', () => {
    expect(SOURCE).toContain('<path d="M125 148 L211 148"');
    for (const s of SPOTS['normal-curve'] ?? []) {
      expect(s.y, s.name).toBeGreaterThan(148);
    }
  });
});
