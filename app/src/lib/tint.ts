/**
 * A colour per course, derived from the look rather than chosen beside it.
 *
 * ## The problem
 *
 * Four courses' worth of deadlines, classes, readings and figures all draw
 * themselves in one accent, so every row on Today, every block on the week and
 * every dot on the month is the same silver — and the only way to tell whose
 * is whose is to read the code on it. That is fine with one course and a
 * paragraph of work with four. A colour answers "which class is this" before
 * anything is read, which is the one question asked of every list in the app.
 *
 * ## Why it is derived and not a picker with eleven crayons in it
 *
 * The look is a set of tokens with one accent in it — see `lib/look.ts` — and
 * the reason the app reads as drawn rather than as a dashboard is that the
 * accent is a metal rather than a colour. Bolting four saturated crayons onto
 * it would undo that on the busiest screens, and would look wrong on twelve of
 * the thirteen grounds besides, because a colour picked against Ink is a
 * colour nobody chose against Parchment.
 *
 * So a course's colour is *the reader's own accent, turned*. One hue anchors
 * the wheel — theirs, whether it came from a named accent or the hue slider —
 * and the courses divide the rest of it between them. Every tint is the same
 * saturation and the same lightness as the accent it came from, so the set
 * stays one family on every ground, in both directions, and a reader who moves
 * from Sterling to Copper takes their whole course palette with them.
 *
 * ## What each part is for, and what it is held to
 *
 * `ink` is text — a course code set in 10px uppercase, which is the hardest
 * thing on the screen to read, so it is held to WCAG's 4.5:1 against every
 * surface it is ever set on. `fill` is a mark that carries meaning without
 * being read — a block's edge, a dot, a bar — and is held to 3:1. `wash` is a
 * background and is held to nothing, but `ink` on it is held to 4.5:1 as well,
 * because that pairing is what a chip actually is.
 *
 * All of it is checked by arithmetic over every hue at five-degree steps
 * against all thirteen grounds — see `tint.test.ts`. Nothing here was chosen
 * by looking at it on one screen.
 */

import { rgbOf } from './contrast';
import { ACCENTS, fade, hueToHex } from './look';
import type { CourseId } from './types';

export interface CourseTint {
  /** Where it sits on the wheel, 0–360, or -1 when it is the plain accent. */
  hue: number;
  /** Text: a course code, a label. Legible at the smallest size the app sets. */
  ink: string;
  /** A mark that is seen rather than read: a block's edge, a dot, a bar. */
  fill: string;
  /** The chip's ground, and the tint of a row that belongs to this course. */
  wash: string;
  /** A hairline in the course's colour — a card's edge, a rule under a header. */
  edge: string;
}

/**
 * The saturation every course tint is mixed at.
 *
 * The same figure `hueToHex` defaults to and the same one the event kinds use,
 * which is why a class and a shift sit beside each other on the grid without
 * one of them shouting. Higher and the palette stops being metals; lower and
 * two courses sixty degrees apart stop being tellable apart, which is the
 * whole job.
 */
const SAT = 0.42;

/**
 * Lightness, per role, per direction.
 *
 * Measured rather than picked. On a dark ground a tint at 0.70 — the accent's
 * own `base` — bottoms out at 3.47:1 around pure blue, which is fine for a
 * mark and not for 10px uppercase text; 0.78 clears 4.5:1 for every hue on
 * every dark ground, the worst being Industry Dark at 4.78:1. On a light
 * ground 0.26 clears it the other way, worst 5.15:1 on Fog. The fills sit at
 * the accent's own steps, which are what the rest of the app's marks are drawn
 * at, and clear 3:1 everywhere.
 */
const LUM = {
  darkInk: 0.78,
  darkFill: 0.7,
  lightInk: 0.26,
  lightFill: 0.26,
};

/** The alpha a wash is mixed at — the same as `--app-accent-wash`. */
const WASH = { light: 0.1, dark: 0.12 };

/**
 * The look's own accent, as a tint.
 *
 * Every value is a token rather than a colour, so a course drawn in this is a
 * course drawn exactly as the whole app was before this file existed. It is
 * what "Colour by course" being off resolves to, and what anything with no
 * course at all — a personal task, a university event — is drawn in.
 */
export const ACCENT_TINT: CourseTint = {
  hue: -1,
  ink: 'var(--app-accent)',
  fill: 'var(--app-accent-fill)',
  wash: 'var(--app-accent-wash)',
  edge: 'var(--app-accent-deep)',
};

/** Where a hex sits on the colour wheel. Grey has no hue, and answers 0. */
export function hueOf(hex: string): number {
  const rgb = rgbOf(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const span = max - min;
  if (span === 0) return 0;
  const deg =
    max === r ? 60 * (((g - b) / span) % 6) : max === g ? 60 * ((b - r) / span + 2) : 60 * ((r - g) / span + 4);
  return (deg + 360) % 360;
}

/**
 * How saturated a colour is, on the same scale `hueToHex` mixes at.
 *
 * Read back rather than assumed, because not every colour in the app is at
 * the palette's saturation and some are deliberately not: the "Other" event
 * kind is a near-grey on purpose, and a function that re-mixed it at 0.42
 * would turn the one category that means "uncategorised" into a blue.
 */
export function satOf(hex: string): number {
  const rgb = rgbOf(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const span = max - min;
  if (span === 0) return 0;
  const lum = (max + min) / 2;
  return span / (1 - Math.abs(2 * lum - 1));
}

/**
 * The lightness a colour has to be to be seen on a light ground.
 *
 * Exported because the event kinds need it too — their table was mixed for a
 * dark screen, and on Parchment the same seven values are pastels a couple of
 * steps off the page. See `kindTint` in `lib/kinds.ts`.
 */
export const LIGHT_GROUND_LUM = LUM.lightFill;

/**
 * The hue the reader's accent sits on, whichever way they chose it.
 *
 * A dragged hue is already a number. A named accent is a hex, and the hue is
 * read back off it — Brass anchors around 45°, Jade around 155°, Sterling
 * around 218° — so the palette leans the way their accent leans rather than
 * starting from an arbitrary red.
 */
export function anchorHue(accentId: string | undefined, hue: number | undefined): number {
  if (typeof hue === 'number' && hue >= 0) return hue;
  const named = ACCENTS.find((a) => a.id === accentId) ?? ACCENTS[0];
  return hueOf(named.base);
}

/** One hue, as the four values a screen actually draws with. */
export function tintAt(hue: number, light: boolean): CourseTint {
  const h = ((hue % 360) + 360) % 360;
  const ink = hueToHex(h, light ? LUM.lightInk : LUM.darkInk, SAT);
  const fill = hueToHex(h, light ? LUM.lightFill : LUM.darkFill, SAT);
  return {
    hue: h,
    ink,
    fill,
    wash: fade(fill, light ? WASH.light : WASH.dark),
    edge: fade(fill, 0.55),
  };
}

/**
 * Which hue each course gets.
 *
 * The wheel is divided between them from the anchor, so two courses are
 * opposite, three are a triad and five are seventy-two degrees apart — the
 * most separation the set allows, whatever its size, rather than a fixed list
 * of colours that runs out at seven and repeats at eight.
 *
 * ## Why it is keyed on the sorted ids and not on the order they are shown in
 *
 * Course order is the reader's: `state.courseOrder` and Reorder let them drag
 * the list into whatever shape they think in. If the hue came from that
 * position, dragging ECON above BUS would swap their colours — a gesture about
 * *order* silently repainting the semester. Sorting the ids gives an order
 * nobody sees and nobody can disturb, so the colours hold still while the list
 * moves.
 *
 * What does move them is the set changing: adding a fifth course re-divides
 * the wheel and every course shifts a little. That is the deliberate trade —
 * uniqueness and the widest possible separation, for a palette that is not
 * permanent across a course being added. It happens a handful of times a year,
 * at the moment somebody is looking at the course they just added, and anyone
 * who wants a particular course held to a particular colour can say so —
 * Settings → Your courses, your way, which is where naming and ordering them
 * already live. Those arrive here as `pinned` and are kept exactly as given.
 */
export function tintsFor(
  ids: CourseId[],
  {
    accent,
    hue,
    light,
    on = true,
    pinned = {},
  }: {
    accent?: string;
    /** The dragged hue, or -1 when the named accent is in use. */
    hue?: number;
    /** True on a light ground — the resolved one, not the stored setting. */
    light: boolean;
    /** False when "Colour by course" is off: everything is the plain accent. */
    on?: boolean;
    /** Hues somebody chose for a course themselves, in degrees. See above. */
    pinned?: Record<CourseId, number>;
  },
): Record<CourseId, CourseTint> {
  const out: Record<CourseId, CourseTint> = {};
  if (!on) {
    for (const id of ids) out[id] = ACCENT_TINT;
    return out;
  }
  const anchor = anchorHue(accent, hue);
  const order = [...new Set(ids)].sort();
  const step = order.length > 0 ? 360 / order.length : 0;
  order.forEach((id, i) => {
    const own = pinned[id];
    out[id] = tintAt(typeof own === 'number' && own >= 0 ? own : anchor + i * step, light);
  });
  return out;
}

/**
 * The hues a picker offers, in the reader's own palette.
 *
 * Twelve, anchored on their accent like everything else here, so pinning a
 * course to a colour is choosing from the same family rather than opening a
 * crayon box. `-1` — "leave it to the app" — is the picker's own business.
 */
export function tintChoices(accent: string | undefined, hue: number | undefined, light: boolean): CourseTint[] {
  const anchor = anchorHue(accent, hue);
  return Array.from({ length: 12 }, (_, i) => tintAt(anchor + i * 30, light));
}
