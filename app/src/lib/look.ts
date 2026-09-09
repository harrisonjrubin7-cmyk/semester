/**
 * How the app looks, as data.
 *
 * The palette began as one opinion — sterling on near-black — and the accent
 * and the text size were the only two parts of it anybody could disagree with.
 * This is the rest: the ground it all sits on, how tight the spacing is, how
 * square the corners are, and what the headings are set in.
 *
 * ## Why it is a token set and not a stylesheet per theme
 *
 * Everything here resolves to CSS custom properties written onto the root
 * element by `App.tsx`. There is exactly one stylesheet, and it never learns
 * that themes exist — a rule written against `--app-panel` is right in every
 * ground, forever, including grounds added after it was written. The
 * alternative, a `.theme-light` class with its own cascade, means every new
 * rule is a chance to forget one theme, and the forgetting shows up as white
 * text on white six screens away from where it was introduced.
 *
 * ## The one hard rule
 *
 * Every ground defines every token. Not "the dark ones plus overrides" — all
 * of them, every time. A ground that inherits half its values from whatever
 * was set last is a ground that looks different depending on which theme you
 * were using before, which is the kind of bug nobody can reproduce.
 * `tokensFor` returns a complete set and `look.test.ts` checks that the sets
 * all have the same keys.
 */

import { contrast as wcagContrast } from './contrast';
import type { NavMode } from './types';

export interface Accent {
  id: string;
  label: string;
  /** The accent itself. */
  base: string;
  /** A lighter one for hover and emphasis. */
  bright: string;
  /** A darker one for secondary marks. */
  deep: string;
  /**
   * The same metal, dark enough to be read as text on a light ground.
   *
   * Not a nicety. Section labels and kickers are set in `--app-accent-deep`,
   * and a pale metal at 12px on parchment is a heading you cannot read — which
   * is exactly the failure a light theme ships with when it is built by
   * swapping the background and calling it done.
   */
  shade: string;
}

/**
 * The accents the app will wear.
 *
 * The `deep` step sets section labels and kickers — small uppercase text — and
 * six of these were under WCAG's 4.5:1 against the darker panels, Oxblood
 * worst at 3.23:1 on Graphite. They have been lightened by the smallest amount
 * that clears it. Nothing was chosen by eye: `lib/contrast.test.ts` holds every
 * accent-and-ground combination to the ratio — eleven accents across thirteen
 * grounds, 143 pairings, all but a couple of which nobody has ever looked at.
 *
 * Metals and stones. The look depends on the accent not being a colour — a
 * saturated one turns a drawn interface into a dashboard — so every one of
 * these is desaturated enough to sit under text without fighting it.
 */
export const ACCENTS: Accent[] = [
  { id: 'sterling', label: 'Sterling', base: '#d4d9e2', bright: '#f6f8fb', deep: '#949cab', shade: '#4c5561' },
  { id: 'brass', label: 'Brass', base: '#d8c79a', bright: '#f2e7c8', deep: '#a3936a', shade: '#6b5c34' },
  { id: 'copper', label: 'Copper', base: '#d6a98d', bright: '#f0d3c0', deep: '#b18c76', shade: '#7a4c33' },
  { id: 'jade', label: 'Jade', base: '#a8ccbd', bright: '#d3e9e0', deep: '#7a9a8d', shade: '#3d5f52' },
  { id: 'slate', label: 'Slate', base: '#aebdd0', bright: '#d8e2ee', deep: '#8894a4', shade: '#445466' },
  { id: 'pewter', label: 'Pewter', base: '#b9b9bd', bright: '#e2e2e6', deep: '#929298', shade: '#55555a' },
  /*
   * Industry's blue, taken off its own ramp at the steps that pass.
   *
   * The system states `--color-accent: #5980a6` (accent-600) and that value
   * fails as text: against Industry's own #f2f2f3 page it is 3.71:1, under the
   * 4.5:1 a paragraph needs. Industry gets away with it because it spends the
   * accent on fills and rules; this app puts `--app-accent` in text.
   *
   * So the hue is kept and every role moves to the ramp step that clears its
   * requirement across all thirteen grounds, not just Industry's own — the
   * numbers below are the worst case over the whole set, measured by
   * `contrast.test.ts`:
   *
   *   shade  accent-700  light grounds, all roles   4.93:1 (Fog)
   *   deep   accent-500  dark grounds, small text   5.45:1 (Industry Dark)
   *   base   accent-400  dark grounds, fills        7.81:1
   *   bright accent-300  dark grounds, emphasis    10.58:1
   *
   * accent-600 sits between them and clears neither: 3.65:1 on the darkest
   * ground and 3.24:1 on the lightest. It is the one step of this ramp the app
   * cannot use, which is why the stated accent is the value not present here.
   */
  { id: 'industry', label: 'Industry', base: '#94bce3', bright: '#b5d9fd', deep: '#749dc4', shade: '#416180' },
  { id: 'oxblood', label: 'Oxblood', base: '#c99a9a', bright: '#e8cdcd', deep: '#ab8d8c', shade: '#6f3f3f' },
  { id: 'moss', label: 'Moss', base: '#b6c39b', bright: '#dde5c9', deep: '#8d9776', shade: '#4f5a37' },
  { id: 'ink', label: 'Indigo', base: '#a9aed6', bright: '#d5d8ee', deep: '#8d91b1', shade: '#454a72' },
  { id: 'gold', label: 'Old gold', base: '#d6c089', bright: '#efe1bc', deep: '#a3906a', shade: '#695a2f' },
];

export function accent(id: string | undefined): Accent {
  return ACCENTS.find((a) => a.id === id) ?? ACCENTS[0];
}

/** Text scale, for a phone held at arm's length or a small screen. */
export const SIZES = [
  { id: 'compact', label: 'Compact', scale: 0.94 },
  { id: 'normal', label: 'Normal', scale: 1 },
  { id: 'large', label: 'Large', scale: 1.09 },
  { id: 'largest', label: 'Largest', scale: 1.18 },
];

export function scaleOf(id: string | undefined): number {
  return SIZES.find((s) => s.id === id)?.scale ?? 1;
}

// ── The ground ───────────────────────────────────────────────────────────

export interface Ground {
  id: string;
  label: string;
  blurb: string;
  /** True when text is dark on light, which several other choices key off. */
  light: boolean;
  /** Five steps of surface, void first. */
  ramp: [string, string, string, string, string];
  /** Text, at three strengths of presence. */
  fg: string;
  dimAlpha: number;
  faintAlpha: number;
  /**
   * The corner style this ground was drawn for, when it has an opinion.
   *
   * A suggestion, not a lock. Industry's square corners are part of what makes
   * it Industry, but `corners` is the reader's own setting and a ground must
   * not overwrite a choice somebody made — so this is consulted only when they
   * have never set one. See `resolveCorners`.
   */
  corners?: string;
}

/**
 * Thirteen grounds — eight dark, five light.
 *
 * Ink is the original and stays the default. The rest are the ways a dark
 * screen can actually differ: how light it is, and which way the shadows lean.
 * Graphite is Ink two steps up for a bright room. Midnight leans the blue Ink
 * only hints at; Basalt leans the other way, into a warm charcoal; Oxide is
 * dark enough for an OLED to switch pixels off entirely, which is both the
 * blackest and the cheapest on battery; Forest and Wine are the two hues that
 * still read as neutral at this darkness, and are there because a whole app in
 * one of them is a different room to sit in.
 *
 * The light five are ordered the same way. Parchment is warm; Paper is the
 * cooler, plainer one; Bone is warmer than Paper and lighter than Parchment,
 * drawn to have cards lifted off it; Fog is grey enough that a phone in direct
 * sun still shows the panel edges, which a white ground does not.
 *
 * Industry and Industry Dark are the pair the design system arrived as, and
 * the only two here that carry a `corners` opinion — everything else leaves
 * that entirely to the reader.
 *
 * Every one of them defines every token — see `tokensFor`.
 */
export const GROUNDS: Ground[] = [
  {
    id: 'ink',
    label: 'Ink',
    blurb: 'Near-black, cooled slightly. The original.',
    light: false,
    ramp: ['#040507', '#090a0e', '#12141a', '#191c23', '#22262f'],
    fg: '#eceef2',
    dimAlpha: 0.64,
    faintAlpha: 0.42,
  },
  {
    id: 'graphite',
    label: 'Graphite',
    blurb: 'The same, lifted — easier in a bright room.',
    light: false,
    ramp: ['#0e0f12', '#16181c', '#1f2229', '#282c34', '#333843'],
    fg: '#eceef2',
    dimAlpha: 0.66,
    faintAlpha: 0.44,
  },
  {
    id: 'midnight',
    label: 'Midnight',
    blurb: 'Blue-black, for the evening.',
    light: false,
    ramp: ['#04060d', '#080b15', '#101524', '#171d31', '#212942'],
    fg: '#e8ecf4',
    dimAlpha: 0.64,
    faintAlpha: 0.42,
  },
  {
    id: 'basalt',
    label: 'Basalt',
    blurb: 'Warm charcoal — the other way from Midnight.',
    light: false,
    ramp: ['#0b0a09', '#131211', '#1c1a18', '#252220', '#302c29'],
    fg: '#eeebe6',
    dimAlpha: 0.65,
    faintAlpha: 0.43,
  },
  {
    id: 'oxide',
    label: 'Oxide',
    blurb: 'True black. On an OLED the pixels are off, and the battery notices.',
    light: false,
    ramp: ['#000000', '#000000', '#0b0d10', '#14171c', '#1e2229'],
    fg: '#eceef2',
    dimAlpha: 0.62,
    faintAlpha: 0.4,
  },
  {
    id: 'forest',
    label: 'Forest',
    blurb: 'Very dark green. Still neutral enough to read all evening.',
    light: false,
    ramp: ['#030705', '#070d0a', '#0e1712', '#141f19', '#1d2b23'],
    fg: '#e7efe9',
    dimAlpha: 0.64,
    faintAlpha: 0.42,
  },
  {
    id: 'wine',
    label: 'Wine',
    blurb: 'Very dark red-brown. Warm without being brown.',
    light: false,
    ramp: ['#080405', '#0e090a', '#171012', '#201618', '#2c1f21'],
    fg: '#f0e9ea',
    dimAlpha: 0.64,
    faintAlpha: 0.42,
  },
  {
    id: 'parchment',
    label: 'Parchment',
    blurb: 'Dark on warm light, for daylight and for printing.',
    light: true,
    ramp: ['#e8e4dc', '#f4f1ea', '#fbf9f4', '#ffffff', '#ffffff'],
    fg: '#1b1a17',
    dimAlpha: 0.68,
    faintAlpha: 0.47,
  },
  {
    id: 'paper',
    label: 'Paper',
    blurb: 'Cooler and plainer than Parchment. Nearly white.',
    light: true,
    ramp: ['#dfe2e8', '#f2f4f7', '#fbfcfd', '#ffffff', '#ffffff'],
    fg: '#15181d',
    dimAlpha: 0.68,
    faintAlpha: 0.47,
  },
  {
    /*
     * Bone, and why it is not called Brass.
     *
     * The surface system this ground comes from is described in its
     * references as bone-and-brass: a warm off-white page, white cards
     * lifted off it, and an antique gold for the ink that matters. Brass is
     * already taken — it is one of the accent ramps, and `look.accent` is
     * persisted, so renaming it would quietly move somebody who had chosen
     * it onto whatever sorted into that slot instead. So the ground takes
     * the half of the name that was free, and the brass ramp is what it
     * wears: `shade` #6b5c34 for ink, which is the reference's #8B7332 by
     * another two per cent.
     *
     * Warmer than Paper and lighter than Parchment, which is the gap it
     * fills — Parchment is a ground to read a long page on, this one is a
     * ground to lift cards off.
     */
    id: 'bone',
    label: 'Bone',
    blurb: 'Warm off-white, with cards lifted off it. Made for the soft shell.',
    light: true,
    ramp: ['#e4e0d9', '#ece9e3', '#faf9f7', '#ffffff', '#ffffff'],
    fg: '#1a1a18',
    // 0.62 puts dim text at #6b6862 over the card, which is the muted ink the
    // references name — derived rather than written down twice, so it stays
    // true if the ground is ever retuned.
    dimAlpha: 0.62,
    faintAlpha: 0.47,
  },
  /*
   * Industry, as one ground among many.
   *
   * The design system is defined light-only: #f2f2f3 page, #1d1f20 text, one
   * blue accent. Adopting it wholesale would flip every existing user to a
   * light technical look and delete the theming system, so it arrives as a
   * ground instead — its structure applies to all of them, its colour to this
   * one.
   *
   * The ramp runs recessed to raised like every other ground here, which means
   * it starts *below* Industry's page colour: `--color-surface` #e9e9ea is
   * darker than `--color-bg` #f2f2f3, so the surface is the void step and the
   * page sits above it. The upper steps come from Industry's own neutral ramp
   * rather than being invented.
   */
  {
    id: 'industry',
    label: 'Industry',
    blurb: 'The technical light ground — square, hairline-ruled, one blue.',
    light: true,
    ramp: ['#e7e7ea', '#f2f2f3', '#f5f5f8', '#fafafb', '#ffffff'],
    fg: '#1d1f20',
    /*
     * Higher than the dark grounds', and it has to be. Industry's text is
     * #1d1f20 on a #f5f5f8 panel — a very light panel, so a given alpha buys
     * less separation here than the same alpha does on near-black. 0.45, the
     * value the dark grounds use, measures 2.76:1 and fails the 3:1 a faint
     * label needs; 0.52 measures 3.35:1.
     */
    dimAlpha: 0.66,
    faintAlpha: 0.52,
    corners: 'square',
  },
  /*
   * The same system at night.
   *
   * Industry ships light-only, and a light-only default on a phone at 11pm is
   * wrong — which is when this app is most used. So the relationships are kept
   * and the lightness inverted: Industry's text colour becomes the ground, its
   * page colour becomes the text, and the top of the ramp is its own
   * neutral-900 and -800 rather than a grey picked to look about right.
   *
   * Not a tint of Ink. Ink is cooled near-black; Industry's neutrals are
   * near-achromatic, and keeping that is what makes this read as the same
   * system rather than as Ink with a different accent.
   */
  {
    id: 'industry-dark',
    label: 'Industry Dark',
    blurb: 'The same square structure, inverted for a dark room.',
    light: false,
    ramp: ['#141516', '#1b1c1e', '#232426', '#2b2b2d', '#424244'],
    fg: '#f2f2f3',
    dimAlpha: 0.64,
    faintAlpha: 0.42,
    corners: 'square',
  },
  {
    id: 'fog',
    label: 'Fog',
    blurb: 'Grey enough that panel edges still show in direct sun.',
    light: true,
    ramp: ['#c9cdd4', '#dde1e7', '#e9ecf1', '#f4f6f9', '#fdfdfe'],
    fg: '#14171c',
    dimAlpha: 0.7,
    faintAlpha: 0.48,
  },
];

export function ground(id: string | undefined): Ground {
  return GROUNDS.find((g) => g.id === id) ?? GROUNDS[0];
}

/**
 * The ground that means "whichever one matches the rest of my device".
 *
 * Not a ground itself — it resolves to one. Kept out of `GROUNDS` so nothing
 * that renders a swatch has to know about it, and so `ground('device')` cannot
 * quietly return a palette nobody chose.
 */
export const MATCH_DEVICE = 'device';

/** Ink after dark, Parchment in daylight. The two the app started with. */
export const DEVICE_DARK = 'ink';
export const DEVICE_LIGHT = 'parchment';

/** A stored ground id turned into one that names a real palette. */
export function resolveGround(id: string | undefined, prefersDark: boolean): string {
  if (id !== MATCH_DEVICE) return id ?? GROUNDS[0].id;
  return prefersDark ? DEVICE_DARK : DEVICE_LIGHT;
}

// ── Spacing, corners, type ───────────────────────────────────────────────

export const DENSITIES = [
  { id: 'comfortable', label: 'Comfortable', scale: 1 },
  { id: 'snug', label: 'Snug', scale: 0.86 },
  { id: 'tight', label: 'Tight', scale: 0.74 },
];

export function densityOf(id: string | undefined): number {
  return DENSITIES.find((d) => d.id === id)?.scale ?? 1;
}

export const CORNERS = [
  { id: 'drawn', label: 'Drawn', radii: [3, 6, 10] },
  { id: 'square', label: 'Square', radii: [0, 0, 0] },
  { id: 'soft', label: 'Soft', radii: [6, 12, 18] },
  { id: 'round', label: 'Round', radii: [10, 18, 28] },
];

/**
 * "Whatever the ground was drawn for" — the same idea as `MATCH_DEVICE`, one
 * setting down.
 *
 * Kept out of `CORNERS` for the same reason `MATCH_DEVICE` is kept out of
 * `GROUNDS`: it is not a corner style, it resolves to one, and `cornersOf`
 * must not be able to return radii for it.
 *
 * It is the default for a look that has never had corners set, which is the
 * only way a ground's own opinion can ever apply. Somebody who has picked a
 * style has `drawn` or `round` stored and keeps it through every ground —
 * including the two that would rather be square.
 */
export const MATCH_GROUND = 'auto';

/**
 * A stored corner setting turned into one that names real radii.
 *
 * The ground is consulted only when nothing was chosen. Every ground but
 * Industry and Industry Dark declines to have an opinion, so for the other ten
 * this returns `drawn` — the value it has always returned.
 */
export function resolveCorners(id: string | undefined, groundId: string | undefined): string {
  if (id !== MATCH_GROUND && id !== undefined) {
    return CORNERS.find((c) => c.id === id)?.id ?? CORNERS[0].id;
  }
  return CORNERS.find((c) => c.id === ground(groundId).corners)?.id ?? CORNERS[0].id;
}

export function cornersOf(id: string | undefined): number[] {
  return CORNERS.find((c) => c.id === id)?.radii ?? CORNERS[0].radii;
}

/**
 * What headings are set in.
 *
 * Every stack ends in a system font, so a face that fails to load degrades to
 * something with the same proportions rather than to Times New Roman. Only the
 * first two are loaded by the app; the rest are asking for faces the device
 * already has, which is why they cost nothing.
 */
export const TYPEFACES = [
  {
    id: 'condensed',
    label: 'Condensed',
    blurb: 'Barlow Condensed. The original — drawing-office lettering.',
    heading: '"Barlow Condensed", system-ui, sans-serif',
    weight: '600',
  },
  {
    id: 'grotesk',
    label: 'Grotesk',
    blurb: 'Plainer and wider. Easier at small sizes.',
    heading: 'Barlow, system-ui, sans-serif',
    weight: '600',
  },
  {
    id: 'system',
    label: 'System',
    blurb: 'Whatever your device uses everywhere else.',
    heading: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    weight: '600',
  },
  {
    id: 'serif',
    label: 'Serif',
    blurb: 'Headings with serifs. Reads like a document.',
    heading: 'Georgia, "Times New Roman", serif',
    weight: '600',
  },
  {
    id: 'mono',
    label: 'Mono',
    blurb: 'Monospaced headings. Technical, and unmistakably deliberate.',
    heading: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
    weight: '600',
  },
];

export function typefaceOf(id: string | undefined) {
  return TYPEFACES.find((t) => t.id === id) ?? TYPEFACES[0];
}

/**
 * The body face, chosen separately from the heading face.
 *
 * These were one control, which meant somebody who wanted the drawing-office
 * headings had to accept Barlow for every paragraph, and somebody who found
 * Barlow hard to read had to give up the headings to escape it. They are
 * different jobs: a heading is glanced at, a paragraph is read for ten minutes.
 *
 * Atkinson Hyperlegible is here because it exists for exactly this — it was
 * designed at the Braille Institute to keep characters apart for low vision,
 * and it is the single most useful thing this list can offer somebody who is
 * struggling. It is not buried under an "accessibility" heading, because a
 * font somebody finds easier to read is just a font they prefer.
 */
export const BODYFACES = [
  {
    id: 'barlow',
    label: 'Barlow',
    blurb: 'The original. Narrow, even, and quiet at small sizes.',
    body: 'Barlow, system-ui, sans-serif',
  },
  {
    id: 'system',
    label: 'System',
    blurb: 'Whatever your device uses everywhere else. The safest choice.',
    body: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
  {
    id: 'hyperlegible',
    label: 'Hyperlegible',
    blurb: 'Atkinson Hyperlegible. Built to keep letters apart — try it if reading is tiring.',
    body: '"Atkinson Hyperlegible", system-ui, sans-serif',
  },
  {
    id: 'serif',
    label: 'Serif',
    blurb: 'Georgia. Longer readings feel less like a screen.',
    body: 'Georgia, "Times New Roman", serif',
  },
  {
    id: 'mono',
    label: 'Mono',
    blurb: 'Monospaced throughout. Every character the same width.',
    body: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  },
];

export function bodyfaceOf(id: string | undefined) {
  return BODYFACES.find((b) => b.id === id) ?? BODYFACES[0];
}

/**
 * How far apart the lines sit.
 *
 * Separate from text size on purpose. Making the type bigger and making it
 * airier are two different complaints — "I cannot see this" and "this is a
 * wall" — and one slider for both means neither is fixed properly.
 */
export const LINE_HEIGHTS = [
  { id: 'tight', label: 'Tight', value: 1.35, blurb: 'More on screen at once.' },
  { id: 'normal', label: 'Normal', value: 1.55, blurb: 'The default.' },
  { id: 'airy', label: 'Airy', value: 1.75, blurb: 'Easier to keep your place in a long reading.' },
  { id: 'loose', label: 'Loose', value: 1.95, blurb: 'As open as it goes.' },
];

export function lineHeightOf(id: string | undefined): number {
  return LINE_HEIGHTS.find((l) => l.id === id)?.value ?? 1.55;
}

/**
 * How wide a paragraph is allowed to get.
 *
 * Only on the long-form screens — a guide, a note, a reading. Typographers put
 * the comfortable measure at 45–75 characters and the reason is mechanical
 * rather than aesthetic: past that, the eye loses the start of the next line on
 * the return sweep. On a laptop the app's column is well past it.
 *
 * "Full" is kept because somebody with a small window and large type will hit
 * the limit before the measure matters, and a cap that makes their screen
 * narrower for no gain is a cap they want off.
 */
export const READING_WIDTHS = [
  { id: 'narrow', label: 'Narrow', ch: 52, blurb: 'About 52 characters. Book-like.' },
  { id: 'normal', label: 'Normal', ch: 66, blurb: 'About 66 characters — the usual comfortable measure.' },
  { id: 'wide', label: 'Wide', ch: 82, blurb: 'Longer lines, less scrolling.' },
  { id: 'full', label: 'Full', ch: 0, blurb: 'No limit — use the whole column.' },
];

export function readingWidthOf(id: string | undefined): number {
  const found = READING_WIDTHS.find((w) => w.id === id);
  return found ? found.ch : 66;
}

/** The shape behind a tab or list icon. Cosmetic, and asked for often. */
export const ICON_SHAPES = [
  { id: 'none', label: 'None', radius: -1, blurb: 'Just the glyph.' },
  { id: 'round', label: 'Round', radius: 50, blurb: 'A circle behind it.' },
  { id: 'squircle', label: 'Squircle', radius: 30, blurb: 'Rounded square, like an app icon.' },
  { id: 'square', label: 'Square', radius: 6, blurb: 'Barely rounded.' },
];

export function iconShapeOf(id: string | undefined) {
  return ICON_SHAPES.find((i) => i.id === id) ?? ICON_SHAPES[0];
}

/** Whether the tab bar spells its tabs out. */
export const LABELS = [
  { id: 'on', label: 'Show labels', blurb: 'Words under every icon.' },
  { id: 'off', label: 'Icons only', blurb: 'Quieter, and taller screens. Learn the icons first.' },
];

/**
 * How much the app is allowed to shout with a number.
 *
 * A badge is a claim on attention, and an app that puts one on everything has
 * made them all mean nothing. "Only what is due" is the honest middle: a count
 * you can act on today, not a tally of everything unread.
 */
export const BADGES = [
  { id: 'due', label: 'Only what is due', blurb: 'A count you can act on today.' },
  { id: 'all', label: 'Everything', blurb: 'Every list that has something in it.' },
  { id: 'none', label: 'None', blurb: 'No numbers anywhere.' },
];

/**
 * How the feed on Today is drawn.
 *
 * Three genuinely different readings of the same day, not three skins. Cards
 * separate things and are easiest to tap; rows fit roughly twice as much on a
 * screen, which matters on a heavy Tuesday; the timeline puts everything on one
 * vertical line in time order, which is the only one that shows the *gaps*.
 */
export const FEEDS = [
  { id: 'cards', label: 'Cards', blurb: 'Separated, roomy, easiest to tap.' },
  { id: 'rows', label: 'Compact rows', blurb: 'About twice as much on a screen.' },
  { id: 'timeline', label: 'Timeline', blurb: 'One line down the day. Shows the gaps as well as the work.' },
];

export function feedStyleOf(id: string | undefined): string {
  return FEEDS.find((f) => f.id === id)?.id ?? 'cards';
}

/**
 * The two axes the app is arranged on, named once, here.
 *
 * `NAVS` is **how you move**: which single navigation is drawn. `SHELLS` is
 * **how a screen is drawn** once you are on it. They are independent — every
 * one of the twelve pairings is a working app — and neither may quietly do
 * the other's job.
 *
 * That last sentence is the whole reason these two lists now sit together.
 * The soft layout used to draw its own two rows of pills, so choosing it put
 * a second navigation on top of the tab bar or the rail that was already
 * there: one app, two live navigations, each unaware of the other. The rows
 * were good; being a layout's side effect was not. They are a navigation now,
 * choosable in every layout, and a layout adds no navigation at all.
 *
 * Both lists are read by the Appearance screen that renders the pickers, by
 * the guidebook that documents them, and by the readers below that validate
 * what comes back from storage — so an option added here appears everywhere
 * without a second edit, and an option that never existed cannot strand
 * somebody on a screen with no way off.
 */

/**
 * The four navigations. Exactly one of them is on screen at any time.
 *
 * Genuinely different habits rather than four skins: the bar suits somebody
 * who lives in four screens, the feed somebody who wants the day in one
 * scroll, the springboard somebody who has forty-six screens and would rather
 * see them than remember which shelf they are on, the shelves somebody who
 * wants the shelf and its screens visible at once.
 */
export const NAVS = [
  {
    id: 'tabs',
    label: 'Tab bar',
    blurb: 'A fixed bar of seven you choose. Every thing has one home you can learn.',
    /** What the first screen is called in this navigation. See `homeTitle`. */
    home: 'Today',
  },
  {
    id: 'feed',
    label: 'One feed',
    blurb: 'Classes and deadlines interleaved in a single scroll, sliced by a filter row.',
    home: 'Everything',
  },
  {
    id: 'springboard',
    label: 'Home screen',
    blurb: 'Three pages of icons with a dock that does not move. Everything visible rather than remembered.',
    home: 'Semester',
  },
  {
    id: 'shelves',
    label: 'Shelves',
    blurb: 'Two rows of pills — the shelf you are on, and the screens on it — with a line saying what this screen is for.',
    home: 'Today',
  },
];

/**
 * What the header calls the first screen, per navigation.
 *
 * A lookup rather than the chain of ternaries this was, in `App.tsx`, which
 * had to be found and extended every time a navigation was added — and which
 * silently fell through to "Today" for anything it did not recognise, so a
 * new mode looked finished while wearing the wrong name.
 */
export function homeTitle(nav: string | undefined): string {
  return NAVS.find((n) => n.id === nav)?.home ?? 'Today';
}

/**
 * A navigation id, read back safely.
 *
 * Storage is not a trusted input: it holds whatever an older build, a newer
 * build, or a half-finished sync wrote. An unrecognised value used to reach
 * `App.tsx` untouched, where every branch tested for a name it did not match
 * — so the app drew no navigation at all and the only way out was to clear
 * the site's data. Falling back to the bar is a worse app for a moment; no
 * navigation is not an app.
 */
export function navOf(id: string | undefined): NavMode {
  return (NAVS.find((n) => n.id === id)?.id as NavMode | undefined) ?? 'tabs';
}

/**
 * Three ways of laying out every screen in the app.
 *
 * `plain` is what this app has always looked like: framed cards with
 * registration marks, headings with air around them, rows that belong to the
 * screen that drew them. `grouped` is the inset-list arrangement people know
 * from a phone's own settings — one rounded container per section, hairlines
 * between rows, the explanation under the group rather than inside a row.
 * `soft` lifts each card off the page and puts the one figure worth reading
 * first at the top of the screen.
 *
 * None is a skin. They are different readings of the same screens, in the
 * same way `feed` is three readings of the same day, and a screen shows every
 * control it shows today in all three.
 *
 * `plain` is the default and stays the default. Nobody's app changes until
 * they choose otherwise.
 */
export const SHELLS = [
  {
    id: 'plain',
    label: 'Drawn',
    blurb: 'Framed cards with registration marks, and room between them. The app as it is.',
  },
  {
    id: 'grouped',
    label: 'Grouped',
    blurb: 'One inset panel per section, with hairlines between the rows. What a phone’s own settings look like.',
  },
  {
    id: 'soft',
    label: 'Soft',
    blurb: 'Cards lifted off the page, light from the top-left, and one figure per screen worth reading first.',
  },
];

/**
 * How the directory of everything the app can do is drawn.
 *
 * Two readings of the same fifty-five rows. The list says what each screen is
 * for, in words, in shelf order — the right shape for reading, and the wrong
 * one for a place you come back to daily, because a column has no positions.
 * The tiles have positions: bottom-left is Data whether or not Data has
 * anything in it this week.
 *
 * A setting rather than a consequence of the layout. The tiles arrived gated
 * on `shell === 'soft'`, so the only way to have them was to accept a
 * different set of colours, cards and type along with them, and the only way
 * to keep the drawn look was to give the tiles up. Two good ideas soldered
 * together, and the same mistake the shelves made when they were a layout's
 * side effect rather than a navigation.
 */
export const DIRECTORIES = [
  {
    id: 'list',
    label: 'A list',
    blurb: 'Every screen with the sentence saying what it is for, by shelf. Reads.',
  },
  {
    id: 'tiles',
    label: 'Tiles',
    blurb: 'Nine tiles, one per shelf, each in the same place every time. Found by position.',
  },
];

/**
 * A directory style, resolved against the layout for anybody who has not
 * chosen one.
 *
 * Three states, not two. `list` and `tiles` are choices and are kept exactly
 * as given, in every layout — somebody on soft who asked for the list keeps
 * the list. Anything else, empty string included, is *nobody has chosen*, and
 * then the shell answers: soft gets the tiles, the other two get the list.
 *
 * Soft is the layout the tiles were drawn for. Its cards, its light and its
 * one-figure-per-screen heroes are the same idea as a grid of nine tiles each
 * showing one figure, and a soft account landing on a column of fifty-five
 * rows is being shown the one part of the app that did not come along. So the
 * layout answers until the question is actually asked.
 *
 * ## Resolved here, on every read
 *
 * This used to resolve once, in `readLook`, on the way out of storage. That
 * made it dead code: `pickPersisted` writes `directory` every save, so the
 * first save stamped a literal `list` on accounts that had never opened the
 * setting, and switching to soft afterwards could no longer reach this. The
 * empty string is what makes the unchosen state storable, and resolving at
 * the point of use is what makes it keep working after the shell changes.
 *
 * The setting is still a setting. Choosing on **Layout and navigation** stores
 * `list` or `tiles`, and from then on the shell has no say — which is the
 * whole reason the tiles stopped being `shell === 'soft'` in the first place.
 */
export function directoryOf(id: string | undefined, shell?: string): string {
  const known = DIRECTORIES.find((d) => d.id === id)?.id;
  if (known) return known;
  return shell === 'soft' ? 'tiles' : 'list';
}

export function shellOf(id: string | undefined): string {
  return SHELLS.find((s) => s.id === id)?.id ?? 'plain';
}

// ── Contrast, checked rather than promised ──────────────────────────────

/**
 * The contrast ratio between two colours, 1 to 21, rounded for display.
 *
 * This exists because the accent is now a hue somebody can drag, and a hue
 * picker without a contrast readout is a way to let people make their own app
 * unreadable and then wonder why. Better to show the number as it moves.
 *
 * The arithmetic is `lib/contrast.ts` and is not repeated here. It was, once:
 * the same WCAG luminance transfer function written out a second time in this
 * file, agreeing with the first by luck rather than by construction. Two
 * copies of a formula are two places to fix a rounding rule, and the pair that
 * disagrees is the pair nobody is looking at. This is a display wrapper —
 * rounding to two places, and reading an unparseable colour as the worst case
 * rather than as `null`, because a readout in the settings screen has to print
 * something.
 */
export function contrast(a: string, b: string): number {
  const ratio = wcagContrast(a, b);
  if (ratio === null) return 1;
  return Math.round(ratio * 100) / 100;
}

/** What a ratio means, in words rather than a standard's number. */
export function contrastVerdict(ratio: number): { ok: boolean; label: string } {
  if (ratio >= 7) return { ok: true, label: 'Easy to read' };
  if (ratio >= 4.5) return { ok: true, label: 'Readable' };
  if (ratio >= 3) return { ok: false, label: 'Hard work at small sizes' };
  return { ok: false, label: 'Too faint to read' };
}

/** One hue at one lightness, as a hex. */
export function hueToHex(deg: number, lum: number, sat = 0.42): string {
  const h = ((deg % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * lum - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lum - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] :
    h < 120 ? [x, c, 0] :
    h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] :
    h < 300 ? [x, 0, c] : [c, 0, x];
  const hex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/**
 * A whole accent from one hue.
 *
 * All four shades, not just the main one. `shade` in particular is not a
 * nicety — section labels are set in it, and a pale metal at 12px on parchment
 * is a heading nobody can read. Deriving it from the same hue is what keeps a
 * dragged colour as usable as a chosen one, and `contrast()` is what proves it
 * on screen while the slider moves.
 */
export function accentFromHue(deg: number, light: boolean): Accent {
  const h = ((deg % 360) + 360) % 360;
  return {
    id: 'hue',
    label: `Hue ${Math.round(h)}°`,
    base: hueToHex(h, light ? 0.42 : 0.7),
    bright: hueToHex(h, light ? 0.55 : 0.84),
    deep: hueToHex(h, light ? 0.32 : 0.56),
    // Dark on a light ground, light on a dark one — the reverse of `base`,
    // because this is the one that has to be legible as small text.
    shade: hueToHex(h, light ? 0.28 : 0.78),
  };
}

// ── The whole thing, as tokens ───────────────────────────────────────────

export interface Look {
  accent?: string;
  textSize?: string;
  ground?: string;
  density?: string;
  corners?: string;
  /** The heading face. The body face is chosen separately — see `bodyface`. */
  typeface?: string;
  bodyface?: string;
  lineHeight?: string;
  readingWidth?: string;
  iconShape?: string;
  labels?: string;
  badges?: string;
  feed?: string;
  /** Which of the three layouts every screen is drawn in. See `SHELLS`. */
  shell?: string;
  /** Whether the directory of everything is a list or tiles. See `DIRECTORIES`. */
  directory?: string;
  /**
   * How the tiles inside each shelf are arranged, where somebody has said.
   *
   * A serialised map — see `lib/launcher.ts`, which owns the format and the
   * parsing. Here because arrangement is a preference like corners and
   * density, and belongs with them rather than in a slice of its own.
   */
  groupOrder?: string;
  /**
   * How the home screen's own icons are arranged, where somebody has dragged
   * one.
   *
   * The same kind of string, owned and parsed by `lib/springboard.ts`. A
   * second key rather than more names inside `groupOrder`: the two arrange
   * different things — shelves of screens against pages of icons — and one
   * string holding both would make a shelf called `dock` a real possibility.
   */
  boardOrder?: string;
  /**
   * A hue for the accent, 0–360, or -1 for "use the named accent".
   *
   * Kept alongside `accent` rather than replacing it: the named accents are
   * chosen colours with a ground behind them, and somebody who has picked
   * Copper should not lose it the moment they open the hue slider to look.
   */
  hue?: number;
}

/** `rgba()` from a hex and an alpha, so one ink colour makes three strengths. */
export function fade(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const n = Number.parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Every custom property the look decides, as one flat map.
 *
 * Written whole on every change rather than diffed, which is what makes a
 * ground switch atomic: no frame where the new panel colour has landed and the
 * new text colour has not.
 */
/**
 * The floor "Increase contrast" puts under the quiet parts of the interface.
 *
 * This app is built out of very low-alpha hairlines and dimmed text, which is
 * the look and is also invisible to somebody who has turned that setting on.
 * Raising the alphas is the whole fix — no layout moves, no colour changes
 * hue, and the app is the same app with its edges and its secondary text
 * brought up to where they can be read.
 *
 * It lives here rather than in a media query in the stylesheet because these
 * tokens are written as inline styles on the root element, so a `:root` rule
 * in CSS would never win.
 */
const LOUD = {
  dim: 0.9,
  faint: 0.76,
  line: 0.34,
  lineSoft: 0.2,
  track: 0.24,
  lineTop: 0.24,
};

export function tokensFor(look: Look, moreContrast = false): Record<string, string> {
  const named = accent(look.accent);
  const g = ground(look.ground);
  /*
   * A dragged hue beats the named accent, and only while it is set.
   *
   * Overlaid rather than replacing, so opening the hue slider to look at it
   * and closing it again leaves somebody's chosen Copper where it was. -1 is
   * "none set"; 0 would be red.
   */
  const a =
    typeof look.hue === 'number' && look.hue >= 0
      ? accentFromHue(look.hue, g.light)
      : named;
  const [void_, bg, panel, hero, raise] = g.ramp;
  const [sm, md, lg] = cornersOf(resolveCorners(look.corners, look.ground));
  const face = typefaceOf(look.typeface);
  const d = densityOf(look.density);

  // On a light ground the hairlines have to be dark or they vanish, and the
  // washes have to be stronger to be visible at all. Same tokens, opposite ink.
  const edge = g.light ? '17, 17, 17' : '236, 238, 242';

  return {
    '--app-void': void_,
    '--app-bg': bg,
    '--app-panel': panel,
    '--app-hero': hero,
    '--app-raise': raise,

    '--app-fg': g.fg,
    '--app-dim': fade(g.fg, moreContrast ? Math.max(g.dimAlpha, LOUD.dim) : g.dimAlpha),
    '--app-faint': fade(g.fg, moreContrast ? Math.max(g.faintAlpha, LOUD.faint) : g.faintAlpha),

    // On a light ground the accent has to darken to stay legible as text —
    // the same metal, three steps down — and the wash has to be mixed from
    // that darker shade or it is a selection state you cannot see.
    '--app-accent': g.light ? a.shade : a.base,
    '--app-accent-bright': g.light ? a.shade : a.bright,
    '--app-accent-deep': g.light ? a.shade : a.deep,
    '--app-accent-wash': g.light ? fade(a.shade, 0.1) : fade(a.base, 0.12),
    // The accent as a fill rather than as ink — a dot, a bar, a meter.
    //
    // This used to stay the bright metal on every ground, with a comment
    // saying a fill is not read. A fill is not read and it still has to be
    // seen: on Parchment the pale metals came out at 1.26:1 against the
    // surface behind them, which is a progress meter you cannot find. WCAG
    // asks 3:1 of meaningful non-text marks for exactly this reason, and
    // `lib/contrast.test.ts` now holds all hundred combinations to it.
    '--app-accent-fill': g.light ? a.shade : a.base,

    '--app-line': `rgba(${edge}, ${moreContrast ? LOUD.line : g.light ? 0.16 : 0.11})`,
    '--app-line-top': moreContrast
      ? `rgba(${g.light ? '0, 0, 0' : '255, 255, 255'}, ${LOUD.lineTop})`
      : g.light
        ? 'rgba(0, 0, 0, 0.06)'
        : 'rgba(255, 255, 255, 0.07)',
    '--app-line-soft': `rgba(${edge}, ${moreContrast ? LOUD.lineSoft : g.light ? 0.09 : 0.06})`,
    '--app-track': `rgba(${edge}, ${moreContrast ? LOUD.track : g.light ? 0.12 : 0.09})`,

    /*
     * The soft shell's elevation, derived rather than written once.
     *
     * Two shadows, light from the top-left: a lifted half and a cast half.
     * The obvious version hard-codes white for the lift, which is right on
     * Bone and wrong everywhere else — on Ink a white bloom is a smear, and
     * the reference sheets that do this are all one-ground sheets. So the
     * lift is white only on a light ground; on a dark one it is a lifted
     * neutral at low alpha, which reads as the same gesture without the
     * glow. The cast half is a warm near-black on light and a true black on
     * dark, because a warm shadow on Ink turns brown.
     *
     * Taking the shadow away under "Increase contrast" is app.css's job, not
     * this function's. The dimmed text and the hairlines are adjusted here
     * because the tokens are inline on the root element and a media query
     * cannot override them; `box-shadow` on `.surface` is an ordinary
     * property on a class, which a media query overrides perfectly well. Two
     * mechanisms for one preference is how they drift apart.
     *
     * Nothing is ever identified by shadow alone. These are for depth, and
     * `.surface` in app.css carries a hairline underneath them.
     */
    /*
     * The dark tile's gradient, which is dark on every ground.
     *
     * The references give two near-black stops and mean them literally: the
     * dark tile is the one deliberate piece of contrast on a bone page, and
     * making it "dark relative to the ground" would turn it into a slightly
     * darker grey on Ink — the same tile, saying nothing. So the stops are
     * fixed on light grounds, and on dark ones they lift *above* the page
     * instead, because a near-black tile on a near-black ground is invisible
     * for the opposite reason. Either way the tile is the thing that differs
     * from its surroundings, which is the only property that matters.
     */
    '--tile-top': g.light ? '#232320' : raise,
    '--tile-bottom': g.light ? '#131311' : hero,
    /** Glyphs on the dark tile: the accent's readable stop against it. */
    '--tile-glyph': g.light ? a.base : a.bright,
    /** Text on the dark tile, which is light on a light ground and vice versa. */
    '--tile-ink': g.light ? '#f4f2ee' : g.fg,

    '--shadow-soft-out': g.light
      ? '-2px -2px 6px rgba(255, 255, 255, 0.7), 4px 6px 14px rgba(90, 84, 72, 0.14)'
      : '-2px -2px 6px rgba(255, 255, 255, 0.045), 4px 6px 14px rgba(0, 0, 0, 0.5)',
    '--shadow-soft-in': g.light
      ? 'inset 2px 2px 5px rgba(90, 84, 72, 0.16), inset -2px -2px 5px rgba(255, 255, 255, 0.65)'
      : 'inset 2px 2px 5px rgba(0, 0, 0, 0.5), inset -2px -2px 5px rgba(255, 255, 255, 0.04)',

    '--r-sm': `${sm}px`,
    '--r-md': `${md}px`,
    '--r-lg': `${lg}px`,

    '--font-heading': face.heading,
    '--font-heading-weight': face.weight,
    // The body face is its own choice. It was fixed in CSS before this, which
    // meant the typeface picker changed headings only and somebody who found
    // the body text hard to read had nothing to change.
    '--font-body': bodyfaceOf(look.bodyface).body,
    '--line-height': String(lineHeightOf(look.lineHeight)),
    // Zero means no cap. Used only by the long-form screens.
    '--reading-width': readingWidthOf(look.readingWidth)
      ? `${readingWidthOf(look.readingWidth)}ch`
      : 'none',
    '--icon-radius': iconShapeOf(look.iconShape).radius < 0
      ? '0'
      : `${iconShapeOf(look.iconShape).radius}%`,
    '--density': String(d),

    // The brushed-metal gradient is the one token that cannot simply be
    // recoloured: on a light ground a white-to-transparent sweep is invisible.
    // Inverted rather than dropped, so display type keeps its lustre.
    // Text sitting ON the brushed metal — the primary button, an active chip.
    // It has to invert with the sweep or it is dark on dark.
    '--chrome-ink': g.light ? '#f7f5f0' : '#08090c',
    '--chrome-glint': g.light ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.35)',

    '--chrome': g.light
      ? 'linear-gradient(172deg, rgba(0,0,0,.86), rgba(0,0,0,.62) 46%, rgba(0,0,0,.5) 52%, rgba(0,0,0,.78) 65%, rgba(0,0,0,.88))'
      : 'linear-gradient(172deg, #f7f8fa, #c9ced8 46%, #aeb4c0 52%, #dfe3ea 65%, #f4f6f9)',
  };
}

/**
 * What a saved look is, made safe to render from.
 *
 * Anything unrecognised falls back to the default rather than being written
 * through — a stored theme from a future version reaching an older build
 * should look plain, not broken.
 */
export function readLook(saved: Look | undefined): Required<Look> {
  return {
    accent: accent(saved?.accent).id,
    textSize: SIZES.find((s) => s.id === saved?.textSize)?.id ?? 'normal',
    // `MATCH_DEVICE` is not in `GROUNDS`, so it has to be allowed through
    // explicitly — `ground()` would fall it back to Ink and the setting could
    // never be stored at all.
    ground: saved?.ground === MATCH_DEVICE ? MATCH_DEVICE : ground(saved?.ground).id,
    density: DENSITIES.find((d) => d.id === saved?.density)?.id ?? 'comfortable',
    // `MATCH_GROUND` is not in `CORNERS`, so like `MATCH_DEVICE` above it has
    // to be allowed through explicitly. It is also the fallback, which is what
    // makes it the state of a look nobody has set corners on — the only state
    // in which a ground's own opinion is allowed to count.
    corners:
      saved?.corners === MATCH_GROUND
        ? MATCH_GROUND
        : (CORNERS.find((c) => c.id === saved?.corners)?.id ?? MATCH_GROUND),
    typeface: typefaceOf(saved?.typeface).id,
    bodyface: bodyfaceOf(saved?.bodyface).id,
    lineHeight: LINE_HEIGHTS.find((l) => l.id === saved?.lineHeight)?.id ?? 'normal',
    readingWidth: READING_WIDTHS.find((w) => w.id === saved?.readingWidth)?.id ?? 'normal',
    iconShape: iconShapeOf(saved?.iconShape).id,
    labels: LABELS.find((l) => l.id === saved?.labels)?.id ?? 'on',
    badges: BADGES.find((b) => b.id === saved?.badges)?.id ?? 'due',
    feed: feedStyleOf(saved?.feed),
    shell: shellOf(saved?.shell),
    // Kept unresolved on purpose, unlike every other key here. An unrecognised
    // value falls back to empty rather than to a style, because empty is a
    // state this one has — nobody has chosen — and resolving it here would
    // spend it: the next save would write the resolved answer back as though
    // it had been asked for. `directoryOf` does the resolving, at the two
    // places that draw the directory. See its note.
    directory: DIRECTORIES.find((d) => d.id === saved?.directory)?.id ?? '',
    // Not validated here: the names inside are screens and shelves, which
    // this file knows nothing about. `readOrder` checks them against the
    // registry every time it reads, so a stale string can only arrange
    // things oddly — never hide one.
    groupOrder: typeof saved?.groupOrder === 'string' ? saved.groupOrder : '',
    // Unvalidated for the same reason, and read back the same way.
    boardOrder: typeof saved?.boardOrder === 'string' ? saved.boardOrder : '',
    // -1 rather than 0, because 0 is red.
    hue: typeof saved?.hue === 'number' && saved.hue >= 0 && saved.hue <= 360 ? saved.hue : -1,
  };
}

/** How the current look reads in one line, for a settings row. */
export function lookLine(look: Look): string {
  const parts = [accent(look.accent).label, ground(look.ground).label];
  const face = typefaceOf(look.typeface);
  if (face.id !== TYPEFACES[0].id) parts.push(face.label);
  // Resolved, not raw: on Industry this line should say Square, because that
  // is what the reader is looking at.
  const corners = CORNERS.find((c) => c.id === resolveCorners(look.corners, look.ground));
  if (corners && corners.id !== CORNERS[0].id) parts.push(corners.label);
  return parts.join(' · ');
}
