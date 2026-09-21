import { newLayer } from './creations';
import type { DesignData, DesignLayer } from './creations';

/**
 * Somewhere to start, for a canvas that opened empty.
 *
 * The Design editor has had layers, a canvas and an SVG export for as long as
 * it has existed, and every design made in it began the same way: a white
 * rectangle nine hundred by twelve hundred, and a decision about where to put
 * the first word. That is the part of a design tool that is actually hard for
 * somebody who is not a designer, and the build-out plan names it —
 * "templates and layers" — with the layers already built.
 *
 * ## Why these eight
 *
 * They are the things a student is asked to produce that are *designed* rather
 * than written. A research symposium poster, a slide-shaped title card, a
 * study-group flyer, a handout header, a one-page summary board, a square
 * social post, an event invitation and a certificate. Not a general-purpose
 * template gallery: eight arrangements that answer briefs this app already
 * knows its user gets, because a template nobody has a use for is a menu item
 * that makes the menu longer.
 *
 * The last three are the ones somebody making a poster at eleven at night does
 * *not* need and somebody running a club does: the square post is the shape
 * every feed wants, the invitation is the flyer with a date on it, and the
 * certificate is the one thing on this list that is made for somebody else.
 *
 * ## Every template is ordinary layers
 *
 * There is no template *type*. `apply` returns a `DesignData` whose layers are
 * the same shape the editor already moves, recolours and deletes, with fresh
 * ids from `newLayer`. So a template is a starting point and never a mode: the
 * second thing anybody does is drag something, and nothing here has an opinion
 * about that.
 *
 * ## The renderer does not wrap, and the first draft of every one of these
 * ## ignored that
 *
 * `designSvg` draws a text layer as one `<text>` with a `<tspan>` per newline
 * in it. There is no line box, so `w` is where the layer *starts* being wide
 * and not where its words stop: a sentence longer than its box simply runs off
 * the side of the poster. The flyer's first draft did exactly that — "Bring
 * the problem set. We work through it together and nobody expl" and then the
 * edge of the paper — and nothing went red, because every number in it was
 * inside every range the reader checks.
 *
 * So every line here is broken by hand, and `designtemplates.test.ts` measures
 * each one against its box. The measurement is an approximation — Arial's
 * average advance is about half its point size — and it is deliberately
 * generous, because the failure it is for is a line half again too long rather
 * than one two pixels over.
 *
 * ## The other thing a screenshot found
 *
 * Text at `x: 0`. The title card's first draft put its headline flush against
 * the left edge of the slide, which looks like a bug and was one. Nothing in
 * the reader objects to zero — it is inside the canvas — so the guard for that
 * is a margin rule in the test, not a range.
 *
 * That is also what makes them checkable. `readCreations` refuses a design
 * whose numbers are out of range — a layer wider than 2,400, a font under 8, a
 * colour that is not a colour — and a template that produced one would be a
 * project the app could build and then refuse to load. `designtemplates.test.ts`
 * puts every template through that reader rather than trusting the arithmetic
 * here.
 */

export interface Template {
  id: string;
  /** What it is for, in the words somebody would use asking for it. */
  name: string;
  /** The brief it answers, shown under the name. */
  about: string;
  width: number;
  height: number;
  background: string;
  /** Layers without their ids, which `apply` supplies. */
  parts: Omit<DesignLayer, 'id' | 'fileId'>[];
}

/** A text layer, said once rather than five times. */
const words = (
  text: string,
  at: { x: number; y: number; w: number; h: number },
  fontSize: number,
  fill: string,
  bold = true,
  opacity = 1,
): Omit<DesignLayer, 'id' | 'fileId'> => ({ kind: 'text', text, fill, fontSize, bold, opacity, rotation: 0, gradient: null, ...at });

/** A block of colour. */
const block = (
  at: { x: number; y: number; w: number; h: number },
  fill: string,
  kind: 'rectangle' | 'ellipse' | 'triangle' = 'rectangle',
  opacity = 1,
): Omit<DesignLayer, 'id' | 'fileId'> => ({ kind, text: '', fill, fontSize: 48, bold: false, opacity, rotation: 0, gradient: null, ...at });

const INK = '#101418';
const PAPER = '#ffffff';
const ACCENT = '#1a73e8';
const QUIET = '#5f6b7a';

export const TEMPLATES: Template[] = [
  {
    id: 'poster',
    name: 'Research poster',
    about: 'A symposium board — title, your name, and three columns to fill.',
    width: 1600,
    height: 1200,
    background: PAPER,
    parts: [
      block({ x: 0, y: 0, w: 1600, h: 210 }, ACCENT),
      words('Your research question, in one line', { x: 60, y: 46, w: 1480, h: 78 }, 56, PAPER),
      words('Your name · Department · Vanderbilt University', { x: 60, y: 132, w: 1480, h: 44 }, 28, PAPER, false),
      words('Background', { x: 60, y: 270, w: 460, h: 48 }, 38, INK),
      words('What the question is,\nand why it is still open.', { x: 60, y: 334, w: 460, h: 560 }, 24, QUIET, false),
      words('Method', { x: 570, y: 270, w: 460, h: 48 }, 38, INK),
      words('What you did, in the\norder you did it.', { x: 570, y: 334, w: 460, h: 560 }, 24, QUIET, false),
      words('What we found', { x: 1080, y: 270, w: 460, h: 48 }, 38, INK),
      words('The result — and what\nit does not show.', { x: 1080, y: 334, w: 460, h: 560 }, 24, QUIET, false),
      block({ x: 60, y: 1030, w: 1480, h: 3 }, QUIET),
      words('References and acknowledgements', { x: 60, y: 1060, w: 1480, h: 40 }, 22, QUIET, false),
    ],
  },
  {
    id: 'title',
    name: 'Title card',
    about: 'The first slide of a talk, at slide proportions.',
    width: 1600,
    height: 900,
    background: INK,
    parts: [
      block({ x: 120, y: 360, w: 220, h: 8 }, ACCENT),
      words('The talk’s title', { x: 120, y: 402, w: 1360, h: 120 }, 84, PAPER),
      words('Your name · the course · the date', { x: 120, y: 556, w: 1360, h: 50 }, 30, QUIET, false),
    ],
  },
  {
    id: 'flyer',
    name: 'Study group flyer',
    about: 'Something to pin up or post — when, where, and which course.',
    width: 900,
    height: 1200,
    background: PAPER,
    parts: [
      block({ x: 0, y: 0, w: 900, h: 420 }, ACCENT),
      words('Study group', { x: 60, y: 130, w: 780, h: 90 }, 72, PAPER),
      words('ECON 1020 · Thursdays', { x: 60, y: 248, w: 780, h: 60 }, 34, PAPER, false),
      words('7pm, Central Library', { x: 60, y: 500, w: 780, h: 56 }, 40, INK),
      words('room 418', { x: 60, y: 566, w: 780, h: 56 }, 40, INK),
      words('Bring the problem set.\nWe work through it together\nand nobody explains twice.', { x: 60, y: 680, w: 780, h: 180 }, 28, QUIET, false),
      block({ x: 60, y: 900, w: 240, h: 240 }, '#eef2f7'),
      words('Room here for a QR\ncode or a photo.', { x: 340, y: 960, w: 500, h: 120 }, 24, QUIET, false),
    ],
  },
  {
    id: 'header',
    name: 'Handout header',
    about: 'The top of a one-page handout, sized to letter paper.',
    width: 1275,
    height: 1650,
    background: PAPER,
    parts: [
      words('What this handout is about', { x: 90, y: 96, w: 1095, h: 80 }, 50, INK),
      words('Course · week · your name', { x: 90, y: 190, w: 1095, h: 44 }, 26, QUIET, false),
      block({ x: 90, y: 252, w: 1095, h: 3 }, ACCENT),
      words('The first thing to say', { x: 90, y: 304, w: 1095, h: 50 }, 34, INK),
      words('Leave this to the writer.\nA handout is mostly space.', { x: 90, y: 370, w: 1095, h: 160 }, 24, QUIET, false),
      block({ x: 90, y: 1540, w: 1095, h: 3 }, QUIET),
      words('Page 1 of 1 · sources on the back', { x: 90, y: 1566, w: 1095, h: 40 }, 20, QUIET, false),
    ],
  },
  {
    id: 'board',
    name: 'One-page summary',
    about: 'A single board that says the finding and the caveat, for a review.',
    width: 1200,
    height: 1200,
    background: '#f7f9fc',
    parts: [
      words('The one sentence', { x: 80, y: 120, w: 1040, h: 90 }, 58, INK),
      block({ x: 80, y: 280, w: 1040, h: 3 }, QUIET),
      words('What it rests on', { x: 80, y: 330, w: 480, h: 50 }, 32, INK),
      words('The evidence, named —\nnot summarised.', { x: 80, y: 396, w: 480, h: 480 }, 24, QUIET, false),
      words('What it does not show', { x: 640, y: 330, w: 480, h: 50 }, 32, INK),
      words('The caveat, in the same\nsize type as the claim.', { x: 640, y: 396, w: 480, h: 480 }, 24, QUIET, false),
      block({ x: 80, y: 1000, w: 1040, h: 110 }, '#e8eef7'),
      words('Where this came from', { x: 112, y: 1038, w: 980, h: 40 }, 24, QUIET, false),
    ],
  },
  {
    id: 'social',
    name: 'Social post',
    about: 'A square post for a feed — one claim, big, and where to find you.',
    width: 1080,
    height: 1080,
    background: INK,
    parts: [
      // Faded, and behind everything because it is first in the list: layer
      // order here is paint order, the same rule the editor's To front is.
      block({ x: 600, y: 600, w: 480, h: 480 }, ACCENT, 'triangle', 0.35),
      block({ x: 80, y: 96, w: 160, h: 8 }, ACCENT),
      words('The one thing\nyou want seen', { x: 80, y: 150, w: 920, h: 260 }, 82, PAPER),
      words('Said once, in the size\nsomebody reads at arm’s length.', { x: 80, y: 460, w: 920, h: 120 }, 30, QUIET, false),
      words('@yourhandle · the course', { x: 80, y: 920, w: 920, h: 44 }, 26, ACCENT, false),
    ],
  },
  {
    id: 'invitation',
    name: 'Event invitation',
    about: 'A club or society invitation — what, when, where, and reply by.',
    width: 1080,
    height: 1350,
    background: PAPER,
    parts: [
      block({ x: 0, y: 0, w: 1080, h: 520 }, INK),
      words('You are invited', { x: 80, y: 150, w: 920, h: 90 }, 64, PAPER),
      words('Econ Society · end-of-term social', { x: 80, y: 270, w: 920, h: 50 }, 30, QUIET, false),
      words('Friday 12 December', { x: 80, y: 620, w: 920, h: 70 }, 52, INK),
      words('6pm · Sarratt 216', { x: 80, y: 706, w: 920, h: 60 }, 40, INK, false),
      block({ x: 80, y: 820, w: 920, h: 3 }, ACCENT),
      words('Food at six, the talk at seven,\nand the room is ours until ten.', { x: 80, y: 870, w: 920, h: 140 }, 28, QUIET, false),
      block({ x: 820, y: 1120, w: 180, h: 160 }, ACCENT, 'triangle', 0.25),
      words('Reply by the Wednesday before.', { x: 80, y: 1150, w: 640, h: 44 }, 26, QUIET, false),
    ],
  },
  {
    id: 'certificate',
    name: 'Certificate',
    about: 'A landscape certificate — a name, what it was for, and two signature lines.',
    width: 1600,
    height: 1200,
    background: PAPER,
    parts: [
      // A wash rather than a border: at 0.12 the accent reads as tinted paper,
      // which is what a printed certificate's panel actually looks like.
      block({ x: 60, y: 60, w: 1480, h: 1080 }, ACCENT, 'rectangle', 0.12),
      words('Certificate of completion', { x: 200, y: 200, w: 1200, h: 80 }, 58, INK),
      words('awarded to', { x: 200, y: 330, w: 1200, h: 50 }, 28, QUIET, false),
      words('Your name here', { x: 200, y: 410, w: 1200, h: 120 }, 88, ACCENT),
      block({ x: 200, y: 580, w: 1200, h: 3 }, QUIET),
      words('for finishing the reading group on\nmonetary policy, autumn 2026.', { x: 200, y: 630, w: 1200, h: 120 }, 32, QUIET, false),
      words('Signed', { x: 200, y: 900, w: 420, h: 44 }, 24, QUIET, false),
      block({ x: 200, y: 960, w: 420, h: 3 }, QUIET),
      words('Date', { x: 980, y: 900, w: 420, h: 44 }, 24, QUIET, false),
      block({ x: 980, y: 960, w: 420, h: 3 }, QUIET),
    ],
  },
];

/** A template by id, or null. */
export const templateFor = (id: string): Template | null => TEMPLATES.find((t) => t.id === id) ?? null;

/**
 * The canvas a template starts you with.
 *
 * `newLayer` supplies the id, so two designs from one template never share
 * one — the reader refuses a duplicate id inside a design, and would have
 * been right to.
 *
 * Nothing is carried over from the canvas being replaced. A template is a
 * fresh start and a half-applied one — new layers over an old background at
 * the old size — is the confusing state this avoids by not having it.
 */
export function apply(template: Template): DesignData {
  const canvas: DesignData = {
    width: template.width,
    height: template.height,
    background: template.background,
    layers: [],
  };
  canvas.layers = template.parts.map((part) => ({ ...newLayer(part.kind, canvas), ...part, fileId: '' }));
  return canvas;
}
