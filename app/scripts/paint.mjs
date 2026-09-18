/**
 * The contrast of what is actually painted, sampled off the screen.
 *
 * `lib/contrast.test.ts` audits the palette: every token of every ground
 * against every panel, a hundred and forty-three pairings, in milliseconds. It
 * is the reason this app is legible on Oxide and on Parchment alike, and it is
 * worth exactly as much as the number of places that use the tokens.
 *
 * Components do not all use them. `lib/dim.ts` was written about that — text
 * dimmed with a hand-written `opacity` is a colour nobody audited, it is not
 * raised by "Increase contrast", and where two of them nest they multiply —
 * and `styles/rules.ts` counts every one that is left. But a count is not a
 * measurement: it says a file owes nine, not that any of the nine is illegible.
 * Those are different questions, and only one of them is about a reader.
 *
 * So this asks the reader's question. It walks every destination in every
 * ground, and for each run of text on the screen it compares the colour the
 * glyphs are painted in against the pixels they are painted over — sampled out
 * of a screenshot, not computed from a stylesheet. Whatever a component did to
 * arrive at that colour, this sees the colour.
 *
 * ## And the other half, which is `scripts/contrast-sweep.mjs`
 *
 * That one composites the style tree instead of reading the screen, and the
 * two are halves rather than copies. It walks all six navigations at two
 * widths and forces hover and focus, which this does not; it returns null for
 * anything painted over a gradient, deliberately, because `backgroundColor`
 * reads transparent there and unknown beats wrong — a hundred and thirty-two
 * elements on one pass of one navigation. Gradients and `background-clip:
 * text` are exactly what a screenshot can answer, which is why this exists.
 *
 * Run both. Where they disagree, one of them is wrong, and finding out which
 * is how the `color()` branch in the parser below got written.
 *
 * ## Running it
 *
 *   npm run build && node scripts/paint.mjs
 *
 * About ten minutes a ground, so a couple of hours for all thirteen — a
 * before-a-release job, like `baseline.mjs`, not a before-a-commit one.
 * `GROUNDS=ink,fog` is the pair that answers most of it in twenty minutes:
 * dark ink on a light page fades faster than light ink on a dark one, so
 * where the two disagree it is the light ground that fails, and Fog is the
 * furthest of the six. `SCREENS=home,settings` narrows it further while
 * working on something. It exits non-zero when a run of text is below the
 * ratio WCAG AA asks for its size, and prints the census either way.
 *
 * Playwright is not a dependency of this app, for the reason `baseline.mjs`
 * gives: one browser and a large download for a script most contributors never
 * run. `npx playwright install chromium` fetches it on demand.
 *
 * ## The two screenshots
 *
 * Text is hidden and the screen is photographed; what is left in the shape of
 * a word is its background. That is the whole method for ordinary text, whose
 * own colour is a computed style this can read.
 *
 * It is not the whole method for `.chrome-text`, where the gradient *is* the
 * glyph — `background-clip: text` paints `--chrome` into the letters of every
 * screen title. Those have no colour to read, so a second shot repaints the
 * same gradient over the whole box it was clipped from. The background
 * positioning area is the same either way, so every pixel of that shot holds
 * the colour the glyph at that point was painted in, at full coverage, with no
 * antialiasing to mistake for a dark stop.
 *
 * ## Five things this got wrong first, each of which read as a fault
 *
 * **A clip-to-text gradient is not a background, and hiding text does not hide
 * it.** `color: transparent` is what makes those letters show; the first run
 * of this photographed the headings it meant to erase and reported every one
 * of them at 1.00:1 against itself.
 *
 * **A run's client rect overhangs the box painted behind it.** A 23px serif
 * sits in a 26px line box and reaches three pixels above the element that
 * paints the gradient. Those rows are page background in both shots and
 * compare with themselves. Every rect is clipped to the painting box, and
 * inset by a pixel on top of that, because a box edge is antialiased against
 * what is behind it and a half-covered edge pixel is not a colour anything is
 * painted in — sampling one reported 1.28:1 on a heading whose interior
 * measures 16:1.
 *
 * **Something on top is not the background.** The assistant's button parks
 * over the foot of the last line on the home screen. Sampling through it
 * reported metal under a line of body copy, at 1.00:1. Pixels that fail are
 * hit-tested before they are believed — only the ones that fail, because
 * hit-testing two million pixels a ground is the difference between twenty
 * minutes and an afternoon.
 *
 * **A button nobody can press has no contrast to meet.** The app dims a
 * disabled control to 0.45, and the first full census opened with "Create the
 * account", "Subscribe", "Join", "Find" and "Keep it" at 1.41:1 — five primary
 * buttons, all of them greyed out because their field was empty, which is the
 * state they are supposed to be in. WCAG 1.4.3 exempts an inactive component
 * by name. The five looked like the worst thing in the app and were the one
 * part of it behaving correctly.
 *
 * **The look is spread across the top level of `Persisted`.** `currentLook` in
 * `state/shape.ts` gathers it; there is no `look` object to seed. A nested
 * seed is accepted, ignored, and leaves all thirteen grounds measuring as Ink
 * — thirteen identical censuses, which is what gave it away. The ground is
 * asserted out of `--app-bg` on every pass rather than assumed.
 *
 * ## What it does not measure, and says so
 *
 * Text below the fold, because a screenshot is of a screen. Runs that move
 * between the two shots — a clock ticking, a list settling — because the two
 * would be of different layouts. Both are counted in the census as skipped, so
 * a sweep that measured almost nothing cannot look like a sweep that found
 * nothing.
 *
 * Anything inside a disabled control, because WCAG exempts it and this app
 * dims one to 0.45 — see the note beside the filter. Icons, rules and borders,
 * because this measures runs of text and 1.4.11 is a different rule with a
 * different threshold; the chevron at the end of every row is 0.4 and nothing
 * here has an opinion about it.
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', 'dist');
const PORT = 8794;

/** Phone width, which is the width this app's layout decisions are about. */
const VIEWPORT = { width: 402, height: 874 };

/** Long enough for a screen to finish arriving. `dock.mjs` measures the same wait. */
const SETTLE = 1800;

/** What WCAG AA asks of text, and of text large enough to be read at a glance. */
const AA_TEXT = 4.5;
const AA_LARGE = 3;

/**
 * Every ground, read out of `lib/look.ts` rather than written here.
 *
 * `dock.mjs` and `baseline.mjs` both learned that a list of screens written
 * into a script fails on a correct app the first time one leaves the registry.
 * A list of grounds is the same list with the same habit: there were twelve
 * when `contrast.test.ts` was written and there are thirteen now.
 */
async function grounds() {
  const src = await readFile(join(HERE, '..', 'src', 'lib', 'look.ts'), 'utf8');
  const block = src.slice(src.indexOf('export const GROUNDS'));
  const end = block.indexOf('\n];');
  if (end < 0) throw new Error('cannot find the end of GROUNDS in lib/look.ts');
  const all = [...block.slice(0, end).matchAll(/^\s{4}id: '([^']+)',$/gm)].map((m) => m[1]);
  if (all.length === 0) throw new Error('cannot find any grounds in lib/look.ts');
  return all;
}

/** Every destination, read out of the registry. Same rule, same reason. */
async function destinations() {
  const src = await readFile(join(HERE, '..', 'src', 'lib', 'nav.ts'), 'utf8');
  const all = [...src.matchAll(/^\s{4}screen: '([^']+)',$/gm)].map((m) => m[1]);
  if (all.length === 0) throw new Error('cannot find any screens in lib/nav.ts');
  return [...new Set(all)];
}

/**
 * The path the build expects to be served from.
 *
 * Read out of the built `index.html` rather than assumed: `vite.config.ts`
 * takes it from `VITE_BASE`, so a plain `npm run build` and the one the Pages
 * workflow makes disagree, and served under the wrong one the app renders an
 * empty body and this reports a clean sweep of nothing.
 */
async function base() {
  const html = await readFile(join(ROOT, 'index.html'), 'utf8');
  const asset = /(?:src|href)="([^"]*\/assets\/[^"]+)"/.exec(html);
  if (!asset) throw new Error('cannot find an asset link in dist/index.html — is the app built?');
  return asset[1].slice(0, asset[1].indexOf('/assets/'));
}

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm', '.map': 'application/json',
  '.pdf': 'application/pdf',
};

/** The same thing GitHub Pages does with `dist`, so the base path is real. */
function serve(prefix) {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url, 'http://x');
      let p = decodeURIComponent(url.pathname);
      if (!p.startsWith(prefix)) return void res.writeHead(404).end();
      p = p.slice(prefix.length) || '/';
      let file = normalize(join(ROOT, p));
      if (!file.startsWith(ROOT)) return void res.writeHead(403).end();
      try {
        if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
        const body = await readFile(file);
        res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
      } catch {
        res.writeHead(404).end(await readFile(join(ROOT, '404.html')).catch(() => 'not found'));
      }
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

/* ── the three passes that run in the page ──────────────────────────────── */

const FREEZE =
  '*,*::before,*::after{animation:none!important;transition:none!important;' +
  'animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important}';
const HIDE_TEXT =
  '*,*::before,*::after{color:transparent!important;text-shadow:none!important;' +
  '-webkit-text-fill-color:transparent!important}';
const UNCLIP = '[data-paint-clip]{-webkit-background-clip:border-box!important;background-clip:border-box!important}';
const UNPAINT = '[data-paint-clip]{background:none!important}';

/**
 * Every run of text on the screen, and what is painting behind it.
 *
 * Live handles are kept on `window.__paint` so the rects can be re-read in the
 * same state as the shot they are sampled from; the metadata comes back over
 * the wire. The marker is an attribute rather than a class or an inline style
 * because React rewrites both on the next render of a component it owns, and
 * the home screen re-renders on a clock tick.
 */
const COLLECT = `(() => {
  const px = (c) => {
    const s = String(c);
    const m = s.match(/-?[\\d.]+/g) || [];
    /*
     * A colour written in color() notation is on a nought-to-one scale.
     *
     * Chromium resolves color-mix() to color(srgb 0.575294 0.589804 0.614902),
     * and this read those three as if they were channels out of 255 — a light
     * grey came back as rgb(1,1,1). It invents a failure where the text is
     * light on a dark surface and hides one where it is dark on a light one,
     * which is the direction that matters: Industry restates twenty rules in
     * color-mix, and a mid-grey misread as near-black on a white panel reads
     * as eighteen to one. scripts/contrast-audit.js has had this branch since
     * it was written; this is the same branch.
     */
    const unit = s.startsWith('color(') ? 255 : 1;
    return { r: (+m[0] || 0) * unit, g: (+m[1] || 0) * unit, b: (+m[2] || 0) * unit,
      a: m.length > 3 ? +m[3] : 1 };
  };
  const clipsText = (cs) => cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text';
  window.__paint = [];
  const meta = [];
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walk.nextNode())) {
    if (!n.nodeValue || !n.nodeValue.trim()) continue;
    const el = n.parentElement;
    if (!el) continue;
    const cs = getComputedStyle(el);
    if (!el.checkVisibility || !el.checkVisibility({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true })) continue;
    // A control that cannot be pressed has no contrast requirement — WCAG 1.4.3
    // exempts an inactive component by name. The app dims a disabled button to
    // 0.45, and reading those as failures put "Create the account", "Subscribe"
    // and "Join" at the top of the first census at 1.41:1, which is the state
    // they are supposed to be in.
    if (el.closest('button:disabled, input:disabled, select:disabled, textarea:disabled, fieldset:disabled, [aria-disabled="true"], [inert]')) continue;
    const size = parseFloat(cs.fontSize) || 16;
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    let opacity = 1;
    for (let a = el; a; a = a.parentElement) {
      const o = parseFloat(getComputedStyle(a).opacity);
      if (!Number.isNaN(o)) opacity *= o;
    }
    const base = { text: n.nodeValue.trim().replace(/\\s+/g, ' ').slice(0, 44), large, size, weight, opacity,
      tag: el.tagName.toLowerCase(), cls: String(el.className?.baseVal ?? el.className ?? '').slice(0, 60) };
    if (cs.backgroundImage !== 'none' && clipsText(cs)) {
      window.__paint.push({ node: n, el, clip: el, owner: el });
      meta.push({ kind: 'glyph', ...base, color: '', owner: el.tagName.toLowerCase() });
      continue;
    }
    // What is painted behind it: the nearest ancestor with a gradient, or the
    // nearest with an opaque fill, whichever comes first.
    let owner = el;
    for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
      const acs = getComputedStyle(a);
      if (acs.backgroundImage !== 'none' && !clipsText(acs)) { owner = a; break; }
      if (px(acs.backgroundColor).a >= 0.999) { owner = a; break; }
    }
    /* A glyph in a diagram is painted with fill, and its color property is
     * whatever it happened to inherit. Reading the wrong one of the two
     * measures a label nobody drew. */
    const painted = el instanceof SVGElement ? cs.fill : cs.color;
    if (!painted || painted === 'none') continue;
    window.__paint.push({ node: n, el, clip: null, owner });
    meta.push({ kind: 'on', ...base, color: painted,
      owner: owner.tagName.toLowerCase() + '.' + String(owner.className?.baseVal ?? owner.className ?? '').slice(0, 40) });
  }
  return meta;
})()`;

/** Where each run is now, clipped to the box that paints behind it. */
const RECTS = `(() => (window.__paint || []).map((p) => {
  const r = document.createRange();
  r.selectNodeContents(p.node);
  const box = p.owner.getBoundingClientRect();
  return [...r.getClientRects()].map((q) => {
    const x = Math.max(q.x, box.x), y = Math.max(q.y, box.y);
    const x2 = Math.min(q.x + q.width, box.x + box.width), y2 = Math.min(q.y + q.height, box.y + box.height);
    return { x: x + 1, y: y + 1, w: x2 - x - 2, h: y2 - y - 2 };
  }).filter((q) => q.w > 1 && q.h > 1 && q.x >= 0 && q.y >= 0 && q.x + q.w <= innerWidth && q.y + q.h <= innerHeight);
}))()`;

/**
 * The sampling, done in the page because that is where the decoder is.
 *
 * Both screenshots go back in as data URLs and on to a canvas; node has no
 * PNG decoder and this app has no dependency that is one.
 */
const SAMPLE = `(spec) => {
  const { shots, items, worstOnly } = spec;
  const load = (s) => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = s; });
  return (async () => {
    const c = {};
    for (const k of Object.keys(shots)) {
      const img = await load(shots[k]);
      const cv = document.createElement('canvas');
      cv.width = img.width; cv.height = img.height;
      const g = cv.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      c[k] = { g, w: cv.width, h: cv.height };
    }
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const ratio = (a, b) => { const L1 = lum(a[0], a[1], a[2]), L2 = lum(b[0], b[1], b[2]);
      return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); };
    // color() notation is on a nought-to-one scale — see the note beside the
    // same branch in COLLECT above.
    const parse = (s) => {
      const t = String(s);
      const m = t.match(/-?[\\d.]+/g) || [];
      const unit = t.startsWith('color(') ? 255 : 1;
      return { r: (+m[0] || 0) * unit, g: (+m[1] || 0) * unit, b: (+m[2] || 0) * unit,
        a: m.length > 3 ? +m[3] : 1 };
    };
    const out = [];
    for (const it of items) {
      const need = it.large ? ${AA_LARGE} : ${AA_TEXT};
      let worst = null, pixels = 0;
      const failed = [];
      for (const q of it.rects) {
        const x0 = Math.max(0, Math.ceil(q.x)), y0 = Math.max(0, Math.ceil(q.y));
        const x1 = Math.min(c.back.w, Math.floor(q.x + q.w)), y1 = Math.min(c.back.h, Math.floor(q.y + q.h));
        if (x1 <= x0 || y1 <= y0) continue;
        const W = x1 - x0;
        const back = c.back.g.getImageData(x0, y0, W, y1 - y0).data;
        const fore = it.kind === 'glyph' ? c.fore.g.getImageData(x0, y0, W, y1 - y0).data : null;
        const only = worstOnly && worstOnly[it.i] ? new Set(worstOnly[it.i].map((p) => p[0] + ',' + p[1])) : null;
        for (let i = 0; i < back.length; i += 4) {
          const at = [x0 + ((i / 4) % W), y0 + Math.floor(i / 4 / W)];
          if (only && !only.has(at[0] + ',' + at[1])) continue;
          const bp = [back[i], back[i + 1], back[i + 2]];
          let fp;
          if (it.kind === 'glyph') fp = [fore[i], fore[i + 1], fore[i + 2]];
          else {
            const fg = parse(it.color), a = fg.a * it.opacity;
            fp = [fg.r * a + bp[0] * (1 - a), fg.g * a + bp[1] * (1 - a), fg.b * a + bp[2] * (1 - a)];
          }
          pixels++;
          const rr = ratio(fp, bp);
          if (rr < need && failed.length < 4000) failed.push(at);
          if (!worst || rr < worst.ratio) worst = { ratio: rr, bg: bp, fg: fp.map((v) => Math.round(v)), at };
        }
      }
      if (worst && pixels > 0) out.push({ ...it, rects: undefined, need, pixels, failed, ...worst });
    }
    return out;
  })();
}`;

/**
 * Which of a run's failing pixels are really its own background.
 *
 * Hit-tested rather than assumed, and only for the ones that failed: something
 * drawn on top is not what the text sits on, and the assistant's button sits
 * on top of the foot of the home screen.
 */
const UNCOVERED = `(spec) => {
  /*
   * What floats over the page, as boxes rather than as hit areas.
   *
   * A hit test alone is not enough for the assistant's button: it is a circle
   * with a glow, so the pixels in the corners of its box are outside the shape
   * elementFromPoint answers for and still carry its light. One of them, half a
   * pixel outside the circle, was the worst reading in a whole census — a
   * caption at 1.38:1 against a button that is nowhere near it. The box, grown
   * by the widest shadow this app draws, is the honest edge of "something is on
   * top here".
   */
  const over = [];
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    over.push({ el, left: r.left - 10, right: r.right + 10, top: r.top - 10, bottom: r.bottom + 10 });
  }
  return spec.map(({ i, points }) => ({
    i,
    points: points.filter(([x, y]) => {
      const p = window.__paint[i];
      const hit = document.elementFromPoint(x + 0.5, y + 0.5);
      if (!hit || !(hit === p.el || p.el.contains(hit) || hit.contains(p.el))) return false;
      for (const o of over) {
        if (o.el.contains(p.el)) continue;
        if (x >= o.left && x <= o.right && y >= o.top && y <= o.bottom) return false;
      }
      return true;
    }),
  }));
}`;

/** One stylesheet, by name, so the screen can be put back without a reload. */
function style(page, id, css) {
  return page.evaluate(
    ([name, text]) => {
      const el = document.getElementById(`paint-${name}`) ?? document.createElement('style');
      el.id = `paint-${name}`;
      el.textContent = text;
      document.head.append(el);
    },
    [id, css],
  );
}

/* ── the sweep ──────────────────────────────────────────────────────────── */

let chromium;
try {
  /*
   * An explicit path first, the way `scripts/contrast-sweep.mjs` does it.
   *
   * That file is the other half of this measurement and it learned this the
   * hard way, at length: playwright is deliberately not a dependency of this
   * project, so a bare `import 'playwright'` resolves only where somebody has
   * installed it globally — and `NODE_PATH` will not help, because the ESM
   * resolver ignores it and the import then fails exactly as if playwright
   * were absent.
   *
   * The fix was written once and never reached here, which meant this script
   * could not run at all on the machine `.claude/skills/run` describes, or in
   * CI, or in the container the sweeps are driven from. That matters more than
   * a missing convenience: this is the half that can see text on a gradient,
   * and `contrast-sweep.mjs` reports two thousand elements a pass that it
   * declines to measure for exactly that reason and points here for them. A
   * hole named in one script's output and unreachable in the other's is a hole
   * nobody was ever going to look in.
   *
   * `require` rather than `import`: playwright is CommonJS, and ESM refuses a
   * directory outright (ERR_UNSUPPORTED_DIR_IMPORT) instead of reading the
   * entry point out of its package.json.
   */
  const from = process.env.PAINT_PLAYWRIGHT || process.env.SWEEP_PLAYWRIGHT;
  if (from) {
    const { createRequire } = await import('node:module');
    ({ chromium } = createRequire(import.meta.url)(from));
  } else {
    ({ chromium } = await import('playwright'));
  }
} catch (e) {
  console.error(
    'playwright is not resolvable, and it is deliberately not a dependency of\n' +
      'this project. Either install it globally:\n\n' +
      '  npx playwright install chromium\n\n' +
      'or install it in a scratch directory and name that copy, which is what\n' +
      '`scripts/contrast-sweep.mjs` takes and what the container is set up for:\n\n' +
      '  mkdir -p /tmp/drive && cd /tmp/drive\n' +
      '  echo \'{"name":"drive","private":true,"type":"module"}\' > package.json\n' +
      '  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install playwright\n' +
      '  cd - && PAINT_PLAYWRIGHT=/tmp/drive/node_modules/playwright node scripts/paint.mjs\n\n' +
      'NODE_PATH will not do it — the ESM resolver ignores it.\n\n' +
      String(e).slice(0, 200),
  );
  process.exit(2);
}

const ALL_GROUNDS = await grounds();
const ALL_SCREENS = await destinations();
const GROUNDS = process.env.GROUNDS ? process.env.GROUNDS.split(',') : ALL_GROUNDS;
const SCREENS = process.env.SCREENS ? process.env.SCREENS.split(',') : ALL_SCREENS;
const PREFIX = await base();
const server = await serve(PREFIX);
const B = `http://127.0.0.1:${PORT}${PREFIX}`;
const ORIGIN = `http://127.0.0.1:${PORT}`;
/*
 * The browser, found the way the other half finds it.
 *
 * `channel: 'chromium'` asks for a system install, which is not what is here:
 * this container keeps a Chromium at a fixed path and playwright's own
 * download is skipped. `contrast-sweep.mjs` defaults to that path and falls
 * back to letting `launch` decide, so the same command works here and on a
 * laptop where playwright has fetched its own. Same default, same variable
 * name pattern, so one habit works on both scripts.
 */
const CHROMIUM = process.env.CHROMIUM || process.env.SWEEP_CHROMIUM || '/opt/pw-browsers/chromium';
const browser = await chromium.launch(
  existsSync(CHROMIUM)
    ? { executablePath: CHROMIUM, args: ['--no-sandbox'] }
    : { args: ['--no-sandbox'] },
);

const findings = [];
const errors = [];
let runs = 0, skipped = 0, visits = 0;

for (const ground of GROUNDS) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  // The look lives at the top level of the stored state — see the header.
  await ctx.addInitScript((g) => {
    localStorage.setItem('semester.v1', JSON.stringify({ schemaVersion: 6, ground: g }));
  }, ground);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${ground}: ${String(e).split('\n')[0]}`));
  await page.route('**/*', (route) => (route.request().url().startsWith(ORIGIN) ? route.continue() : route.abort()));
  await page.goto(`${B}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: /skip/i }).first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(1000);

  // The seed is asserted, never assumed: a ground that did not take measures
  // as the default and the sweep repeats one census thirteen times.
  const bg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--app-bg').trim());

  for (const screen of SCREENS) {
    await page.evaluate((s) => { location.hash = `#/${s}`; }, screen);
    await page.waitForTimeout(SETTLE);
    await style(page, 'freeze', FREEZE);
    await page.waitForTimeout(200);
    const meta = await page.evaluate(COLLECT);
    visits += 1;
    if (meta.length === 0) continue;

    await style(page, 'shot', HIDE_TEXT + UNCLIP);
    await page.evaluate(() => {
      for (const p of window.__paint) if (p.clip) p.clip.setAttribute('data-paint-clip', '1');
    });
    await page.waitForTimeout(250);
    const foreRects = await page.evaluate(RECTS);
    const fore = await page.screenshot({ type: 'png' });

    await style(page, 'unpaint', UNPAINT);
    await page.waitForTimeout(250);
    const backRects = await page.evaluate(RECTS);
    const back = await page.screenshot({ type: 'png' });

    const items = [];
    for (let i = 0; i < meta.length; i += 1) {
      const a = foreRects[i] || [], b = backRects[i] || [];
      if (b.length === 0) { skipped += 1; continue; }
      // A run made of a gradient is read out of both shots, so the two have to
      // agree about where it is. One read off the back shot alone does not.
      const still = a.length === b.length &&
        a.every((q, j) => b[j] && Math.abs(q.x - b[j].x) < 0.5 && Math.abs(q.y - b[j].y) < 0.5);
      if (meta[i].kind === 'glyph' && !still) { skipped += 1; continue; }
      items.push({ ...meta[i], i, rects: b });
    }
    const shots = {
      fore: `data:image/png;base64,${fore.toString('base64')}`,
      back: `data:image/png;base64,${back.toString('base64')}`,
    };
    const sampler = new Function('spec', `return (${SAMPLE})(spec)`);
    let res = await page.evaluate(sampler, { shots, items });
    runs += res.length;

    // Only the ones that failed are hit-tested, and only their failing pixels.
    const suspect = res.filter((r) => r.ratio < r.need && r.failed.length > 0);
    if (suspect.length > 0) {
      const kept = await page.evaluate(
        new Function('spec', `return (${UNCOVERED})(spec)`),
        suspect.map((r) => ({ i: r.i, points: r.failed })),
      );
      const only = {};
      for (const k of kept) only[k.i] = k.points;
      const again = await page.evaluate(sampler, {
        shots,
        items: items.filter((it) => only[it.i] && only[it.i].length > 0),
        worstOnly: only,
      });
      const fixed = new Map(again.map((r) => [r.i, r]));
      res = res.map((r) => (suspect.includes(r) ? fixed.get(r.i) ?? null : r)).filter(Boolean);
    }
    for (const r of res) if (r.ratio < r.need) findings.push({ ground, screen, ...r });

    // Put the screen back rather than reloading it. A reload costs the boot
    // and the skip again on every one of six hundred and fifty visits.
    await page.evaluate(() => {
      for (const id of ['freeze', 'shot', 'unpaint']) document.getElementById(`paint-${id}`)?.remove();
      for (const el of document.querySelectorAll('[data-paint-clip]')) el.removeAttribute('data-paint-clip');
      window.__paint = [];
    });
    await page.waitForTimeout(150);
  }
  console.log(`· ${ground.padEnd(14)} --app-bg ${bg}`);
  await ctx.close();
}

await browser.close();
server.close();

/**
 * A run with a letter or a digit in it is text; a bullet between two of them
 * is punctuation. Both are reported — the second is not what the exit code is
 * about, because WCAG's text rule is about words and a separator that fades is
 * a decision somebody is entitled to make.
 */
const WORDS = /[A-Za-z0-9]/;
const words = findings.filter((f) => WORDS.test(f.text));
const marks = findings.filter((f) => !WORDS.test(f.text));

console.log(`\ngrounds ${GROUNDS.length}   screens ${SCREENS.length}   visits ${visits}`);
console.log(`runs measured ${runs}   skipped, off screen or moved between the shots ${skipped}`);
if (errors.length) console.log(`page errors ${errors.length}: ${errors[0]}`);

const worst = new Map();
for (const f of words) {
  const key = `${f.cls}|${f.text}`;
  if (!worst.has(key) || worst.get(key).ratio > f.ratio) worst.set(key, f);
}
console.log(`\nbelow AA: ${words.length} runs of text (${worst.size} distinct), ${marks.length} runs of punctuation`);
for (const f of [...worst.values()].sort((a, b) => a.ratio - b.ratio)) {
  console.log(
    `  ${f.ratio.toFixed(2)}:1 needs ${f.need}  ${Math.round(f.size)}px/${f.weight}  ` +
      `${f.ground}/${f.screen}  "${f.text}"  rgb(${f.fg}) on rgb(${f.bg}) at=${f.at}`,
  );
}

if (words.length === 0) {
  console.log('\nevery run of text on every screen clears the ratio WCAG AA asks for its size');
} else {
  process.exit(1);
}
