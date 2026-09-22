import type { DiagramKind, FigureMap } from './types';

/**
 * Where the answer is on a picture, for the questions that ask you to point.
 *
 * `docs/STUDY_REQUIREMENTS.md` lists **diagram labeling** among the practice
 * questions this app should ask, and it is the one kind that cannot be built
 * out of text. A question that says "click the equilibrium" needs to know where
 * the equilibrium *is*, in the picture, in pixels.
 *
 * ## Read off the drawing, never invented
 *
 * Every rectangle below was taken from the geometry in `components/Diagram.tsx`
 * — the same file that draws the picture, on the same 320×200 canvas, using the
 * coordinates its paths and circles are actually written with. The equilibrium
 * box on `supply-demand` is around `<circle cx={172.5} cy={90}>` because that
 * is the circle the diagram draws; the ceiling box on `price-ceiling` sits on
 * `M40 126 L300 126` because that is the line.
 *
 * That constraint is the whole design. The obvious alternative — describe the
 * regions from what the picture *ought* to look like — produces a question
 * whose right answer is in the wrong place, and a student who knows the
 * material is told they do not. There is no test that can catch that, because
 * nothing else in the repository knows where the equilibrium should be. Taking
 * the numbers from the drawing means the two cannot disagree without somebody
 * editing one of them.
 *
 * ## Only five diagrams, and that is the point
 *
 * There are twenty-one in `DIAGRAM_KINDS` and five have spots. The other
 * sixteen are curves without marked points, or pictures whose parts are too
 * close together to click apart on a phone, and a question about one of them
 * would be a question this app cannot mark honestly. `targetFrom` asks nothing
 * of a diagram with no spots, which is the same rule the rest of `lib/quiz.ts`
 * follows: a question that cannot be asked honestly is dropped rather than
 * asked badly.
 *
 * ## What the labels give away, stated rather than glossed
 *
 * The curves carry their own labels — `D`, `S`, `MC`, `MSC` — and a student who
 * knows that `D` means demand can find the demand curve without knowing what a
 * demand curve does. So the asks are phrased in terms of **what the thing
 * means** rather than what it is called: *"the curve showing how much buyers
 * want at each price"* rather than *"the demand curve"*. The label is then an
 * aid to somebody who has learned the notation, which is a thing worth having
 * learned, rather than the answer printed beside the question.
 *
 * The points — equilibrium, the monopolist's price, the social optimum — carry
 * no such hint, and they are the ones worth asking.
 */

/** The canvas every diagram is drawn on. Matches `components/Diagram.tsx`. */
export const CANVAS = { w: 320, h: 200 } as const;

/** One clickable part of a diagram. */
export interface Spot {
  /**
   * What the student is asked to find, phrased as the thing's meaning.
   *
   * Read as "Click …", which the screen supplies, so these are noun phrases
   * rather than sentences.
   */
  ask: string;
  /** What it is called, shown once the answer is in. */
  name: string;
  /** The box, in the diagram's own coordinate space. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The spots, by diagram.
 *
 * Boxes are deliberately generous — around 28×28 on a 320×200 canvas, which is
 * about 9% of the width. At phone size that is a comfortable thumb target, and
 * a question that is right about the concept and lost on a two-pixel miss is a
 * mark taken by the interface. `hotspot.test.ts` holds the two invariants that
 * makes safe: every box is inside the canvas, and no two boxes on one diagram
 * overlap — an overlap being a click with two right answers.
 */
export const SPOTS: Partial<Record<DiagramKind, Spot[]>> = {
  /*
   * Demand `M60 30 L285 150`, supply `M60 150 L285 30`, crossing at the circle
   * on (172.5, 90). The curve boxes are taken at x≈250, where the two lines
   * are far apart and well clear of the crossing.
   */
  'supply-demand': [
    { ask: 'the price and quantity the market settles at', name: 'Equilibrium', x: 158, y: 76, w: 29, h: 28 },
    { ask: 'the curve showing how much buyers want at each price', name: 'Demand', x: 235, y: 117, w: 30, h: 29 },
    { ask: 'the curve showing how much sellers offer at each price', name: 'Supply', x: 235, y: 34, w: 30, h: 29 },
  ],

  /*
   * The ceiling is the accent line `M40 126 L300 126`; the box sits on its
   * left end, clear of the `Qs` circle at (105, 126). The equilibrium circle
   * is at (172.5, 90) and the two quantity circles at (105, 126) and
   * (240, 126), each boxed below the line where its dashed drop runs.
   */
  'price-ceiling': [
    { ask: 'the highest price the law allows', name: 'The ceiling', x: 48, y: 116, w: 38, h: 20 },
    { ask: 'the price the market would have settled at', name: 'Equilibrium price', x: 158, y: 76, w: 29, h: 26 },
    { ask: 'how much sellers offer at the capped price', name: 'Quantity supplied', x: 91, y: 138, w: 28, h: 28 },
    { ask: 'how much buyers want at the capped price', name: 'Quantity demanded', x: 226, y: 138, w: 28, h: 28 },
  ],

  /*
   * `MR = MC` is the dim circle at (128, 117); the price is read up onto demand
   * at the accent circle (128, 68). Demand `M55 26 L285 160` and marginal cost
   * `M55 130 L285 106` are boxed at x≈250, where they are furthest apart.
   */
  monopoly: [
    { ask: 'where the monopolist chooses its quantity', name: 'MR = MC', x: 114, y: 103, w: 28, h: 28 },
    { ask: 'the price it charges for that quantity', name: 'Price off demand', x: 114, y: 54, w: 28, h: 28 },
    { ask: 'the curve it reads its price off', name: 'Demand', x: 236, y: 126, w: 30, h: 28 },
    { ask: 'what one more unit costs it to make', name: 'Marginal cost', x: 236, y: 96, w: 30, h: 26 },
  ],

  /*
   * Market quantity is the dim circle at (175, 94), the optimum the accent one
   * at (135, 74). The three curves — `MPB M55 34 L290 150`, `MPC M55 150
   * L290 44`, `MSC M55 112 L290 12` — are boxed at x≈80, near the left edge
   * where they are furthest from each other and from both circles.
   */
  externality: [
    { ask: 'how much gets traded when the cost to others is ignored', name: 'Market quantity', x: 161, y: 80, w: 28, h: 28 },
    { ask: 'how much should be traded once that cost is counted', name: 'Socially optimal quantity', x: 121, y: 60, w: 28, h: 28 },
    { ask: 'the cost including the harm to everyone else', name: 'Marginal social cost', x: 66, y: 88, w: 28, h: 26 },
    { ask: 'the cost the producer alone pays', name: 'Marginal private cost', x: 66, y: 125, w: 28, h: 26 },
  ],

  /*
   * The axis marks, whose x positions the diagram lists outright: μ at 168,
   * ±1 at 211 and 125, ±2 at 254 and 82. The boxes sit between the 68% band
   * (drawn at y=148) and the tick labels (y=178), so each takes in its own
   * tick and label and none of them takes in the band.
   */
  'normal-curve': [
    { ask: 'the mean', name: 'μ', x: 154, y: 150, w: 28, h: 32 },
    { ask: 'one standard deviation above the mean', name: '+1σ', x: 197, y: 150, w: 28, h: 32 },
    { ask: 'one standard deviation below the mean', name: '−1σ', x: 111, y: 150, w: 28, h: 32 },
    { ask: 'two standard deviations above the mean', name: '+2σ', x: 240, y: 150, w: 28, h: 32 },
  ],
};

/** The least a diagram needs before pointing at something is a question. */
export const MIN_SPOTS = 2;

/** Which diagrams can be asked about at all. */
export function askable(kind: DiagramKind): boolean {
  return (SPOTS[kind]?.length ?? 0) >= MIN_SPOTS;
}

/**
 * The diagrams in a course's figures that can be asked about.
 *
 * Here rather than in `lib/quiz.ts` because it is this file that knows which
 * diagrams have spots, and a caller assembling the list itself would be a
 * second opinion about that — the kind that agrees until somebody adds a
 * diagram and then does not.
 *
 * De-duplicated, because a course that illustrates the same picture in two
 * units would otherwise be twice as likely to be asked about it, for a reason
 * that is about the guide's layout rather than about the material.
 */
export function diagramsIn(figures: FigureMap | undefined): DiagramKind[] {
  const out: DiagramKind[] = [];
  for (const figure of Object.values(figures ?? {})) {
    if (figure?.type !== 'diagram') continue;
    if (!askable(figure.kind) || out.includes(figure.kind)) continue;
    out.push(figure.kind);
  }
  return out;
}
