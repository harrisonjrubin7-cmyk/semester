/**
 * Turning what a model says it found into a figure the app can draw.
 *
 * A reading that arrives in week six routinely contains the thing a study
 * guide is most useful for: a table of shares, a four-step procedure, the
 * supply-and-demand picture the chapter is about. Until this file existed,
 * none of that survived being added. `readMaterial` returned cards and terms,
 * so a table became either three cards asking for one row each or nothing at
 * all, and the Figures tab showed exactly what it had shown in week one.
 *
 * ## Why the app's own four shapes and nothing else
 *
 * `Figure` is a closed union — bars, steps, diagram, image — and each arm is
 * rendered by a component that already exists. So a figure read out of new
 * material comes out looking like the guide's own figures, because it *is* one
 * of the guide's own figures. There is no second renderer, no HTML from a
 * model, no chart library.
 *
 * The cost of that is honest and worth stating: `diagram` names one of
 * seventeen hand-drawn SVGs, so the app can *recognise* the curve a reading is
 * about but cannot draw a new one. A process becomes `steps`. Anything with
 * labels and numbers becomes `bars`, which is the app's table. Material whose
 * figure is none of those keeps its prose and gets no figure, which is the
 * right answer — an invented chart is worse than no chart, and a chart drawn
 * from numbers the reading did not give is worse still.
 *
 * ## Why validation is this strict
 *
 * Everything here arrives as parsed JSON from a language model, and a figure
 * is the one kind of study material that *looks* authoritative. A bar chart
 * with a plausible axis and a made-up value is read as fact and drilled as
 * fact. So every field is checked, every unusable figure is dropped whole
 * rather than repaired, and `readFigures` returns fewer figures rather than
 * shakier ones. `figure.test.ts` is mostly a list of malformed replies.
 */

import { DIAGRAM_KINDS, type BarRow, type DiagramKind, type Figure, type Step } from './types';
import { MOST as DEFAULT_CAPS, type Caps } from './controls';

/** At most this many figures out of one piece of material. */
export const MOST_FIGURES = DEFAULT_CAPS.figures;

/** A table with one row is not a table; with twenty it is not a figure. */
const BAR_ROWS = { least: 2, most: 12 };

/** Same reasoning for a process. */
const STEPS = { least: 2, most: 8 };

/** Long enough to name the thing, short enough to sit under it. */
const TITLE = 80;
const CAPTION = 200;

/**
 * The vocabulary, written out for the model.
 *
 * Kept here rather than in `claude.ts` so that the description and the
 * validator that enforces it are the same file. They drifted once already in
 * this codebase — a prompt that asked for a field nothing read.
 */
/** The shapes, at a given ceiling. `FIGURE_SHAPES` below is this at the default. */
export function figureShapes(caps: Caps = DEFAULT_CAPS): string {
  return `figures: 0 to ${caps.figures} figures the material actually contains. \
This is not decoration and not a summary — include one only where the text gives you the whole \
thing. Each is one of exactly three shapes:

  {"type":"bars","title":"…","caption":"…","unit":"% of GDP","rows":[{"l":"Label","v":12.4}]}
    A table of quantities. ${BAR_ROWS.least}-${BAR_ROWS.most} rows. Every number must be stated in \
the text — do not compute, estimate, convert, or fill a gap. "unit" is what the numbers are in.

  {"type":"steps","title":"…","caption":"…","steps":[{"n":"1","t":"Name","d":"What happens"}]}
    A process or sequence the material sets out. ${STEPS.least}-${STEPS.most} steps.

  {"type":"diagram","title":"…","caption":"…","kind":"supply-demand"}
    Only when the material is *about* one of these seventeen drawn diagrams, by name or by \
unmistakable description. "kind" must be exactly one of: ${DIAGRAM_KINDS.join(', ')}. There is no \
other diagram available — if the material's picture is not in that list, do not return a diagram \
for it. Return no figure rather than the nearest one.

Return "figures":[] when the material has none. Most material has none.`;
}

/** The shapes at the default ceiling — what every caller used before. */
export const FIGURE_SHAPES = figureShapes();

function text(v: unknown, cap: number): string {
  return typeof v === 'string' ? v.trim().slice(0, cap) : '';
}

/**
 * A number as the material stated it.
 *
 * Strings are accepted because a model asked for JSON returns `"12.4"` about
 * as often as `12.4`, and refusing the string would drop a correct row over
 * quoting. What is not accepted is anything that is not a plain finite number
 * once read: no NaN, no Infinity, no `"about 12"`, no percentages that arrive
 * as `"12%"` — that last one deliberately, because whether the axis is already
 * a percentage is exactly the thing that must not be guessed.
 */
function number_(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function rows(v: unknown): BarRow[] {
  if (!Array.isArray(v)) return [];
  const out: BarRow[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as { l?: unknown; v?: unknown };
    const label = text(r.l, TITLE);
    const value = number_(r.v);
    // A row missing either half is dropped rather than defaulted to zero: a
    // bar of length zero is a claim the material did not make.
    if (label && value !== null) out.push({ l: label, v: value });
  }
  return out.slice(0, BAR_ROWS.most);
}

function steps(v: unknown): Step[] {
  if (!Array.isArray(v)) return [];
  const out: Step[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== 'object') continue;
    const s = raw as { n?: unknown; t?: unknown; d?: unknown };
    const t = text(s.t, TITLE);
    const d = text(s.d, CAPTION);
    if (!t || !d) continue;
    // The step number is the one field worth supplying when it is missing,
    // because it is positional and the position is not in doubt. Counted from
    // what survived, so dropping a malformed step three does not leave the
    // rendered list going 1, 2, 4.
    out.push({ n: text(s.n, 4) || String(out.length + 1), t, d });
  }
  return out.slice(0, STEPS.most);
}

function diagramKind(v: unknown): DiagramKind | null {
  const found = DIAGRAM_KINDS.find((k) => k === v);
  return found ?? null;
}

/**
 * One figure, or null.
 *
 * Null is the ordinary outcome and not an error: most material has no figure
 * in it, and a model asked for figures will occasionally offer one anyway.
 */
export function readFigure(raw: unknown): Figure | null {
  if (!raw || typeof raw !== 'object') return null;
  const f = raw as Record<string, unknown>;
  const title = text(f.title, TITLE);
  const caption = text(f.caption, CAPTION);
  if (!title) return null;

  switch (f.type) {
    case 'bars': {
      const r = rows(f.rows);
      if (r.length < BAR_ROWS.least) return null;
      const unit = text(f.unit, 40);
      if (!unit) return null;
      // The axis is computed rather than trusted. A stated max below the
      // tallest row clips it, and a max far above flattens every bar to a
      // stub — both of which misdraw numbers that are themselves correct.
      const tallest = Math.max(...r.map((row) => Math.abs(row.v)));
      const stated = number_(f.max);
      const max = stated !== null && stated >= tallest ? stated : tallest;
      if (max <= 0) return null;
      return { type: 'bars', title, caption, unit, max, rows: r };
    }
    case 'steps': {
      const s = steps(f.steps);
      if (s.length < STEPS.least) return null;
      return { type: 'steps', title, caption, steps: s };
    }
    case 'diagram': {
      const kind = diagramKind(f.kind);
      if (!kind) return null;
      return { type: 'diagram', title, caption, kind };
    }
    // `image` is deliberately absent. Its `fileId` points into this device's
    // IndexedDB, so a model naming one is either guessing or pointing at
    // somebody else's file, and neither should render.
    default:
      return null;
  }
}

/** Every figure in a reply that survives {@link readFigure}, capped. */
export function readFigures(raw: unknown, caps: Caps = DEFAULT_CAPS): Figure[] {
  if (!Array.isArray(raw)) return [];
  const out: Figure[] = [];
  for (const one of raw) {
    const f = readFigure(one);
    if (f) out.push(f);
    if (out.length === caps.figures) break;
  }
  return out;
}

/** How a figure reads in a line, for the confirmation before it is saved. */
export function describeFigure(f: Figure): string {
  switch (f.type) {
    case 'bars':
      return `${f.title} — a table, ${f.rows.length} rows in ${f.unit}`;
    case 'steps':
      return `${f.title} — ${f.steps.length} steps`;
    case 'diagram':
      return `${f.title} — the ${f.kind.replace(/-/g, ' ')} diagram`;
    case 'image':
      return `${f.title} — an image`;
  }
}
