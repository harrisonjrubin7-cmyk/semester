/*
 * Every piece of text in the app, measured against the surface behind it.
 *
 * Not a palette audit. `lib/contrast.test.ts` is the palette audit and it runs
 * in CI over every accent-and-ground pairing; this drives a real browser and
 * reads what Chromium actually painted. The two find different things and
 * neither replaces the other:
 *
 *   the token audit   every accent × every ground, but only surfaces that are
 *                     tokens, and only text it has been told about
 *   this             whatever is really on screen, composited — but one accent
 *                     at a time, and only the screens listed below
 *
 * The bug that made the pair worth keeping: two rules each painting
 * `--app-accent-wash`, one on a row and one on a tag inside it, compounding to
 * a surface that is not any token. The token audit passed it; this did not.
 *
 * ## Running it
 *
 *   npm run dev                  # in another terminal; this expects :5173
 *   npm run sweep:contrast
 *
 * Playwright is deliberately not a dependency of this project — see
 * `.claude/skills/run`. Install it somewhere scratch and name that copy:
 *
 *   mkdir -p /tmp/drive && cd /tmp/drive
 *   echo '{"name":"drive","private":true,"type":"module"}' > package.json
 *   PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install playwright
 *   cd - && SWEEP_PLAYWRIGHT=/tmp/drive/node_modules/playwright npm run sweep:contrast
 *
 * NODE_PATH does not work for this: Node's ESM resolver ignores it, so the
 * import fails exactly as if playwright were absent. Hence the explicit path.
 *
 * ## Four ways this has lied, all fixed, all worth not reintroducing
 *
 * 1. It audited one shell's own container, which exists under one navigation.
 *    Everywhere else it measured nothing and reported zero. Hence the element
 *    counts below: a pass that measured nothing is reported, not counted.
 * 2. Its axes were seeded into `localStorage['semester.v1']`, which the app
 *    never reads the look from. Every pass rendered the default while the
 *    check — reading back the key it had just written — agreed with itself.
 *    Both axes are now set by clicking the app's own pickers and confirmed
 *    from the rendered page.
 * 3. `#/` is not the home route; it leaves the previous screen in place. The
 *    home pass was auditing whatever came before it.
 * 4. Findings were deduplicated on colour and class alone, so the tab bar's
 *    label and the rail's — one class, one pair of colours, two widths —
 *    collapsed into one row and the survivor stood in for both. The rail's
 *    went unreported through an entire round of fixes.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const AUDIT = readFileSync(join(here, 'contrast-audit.js'), 'utf8');
const STATES = readFileSync(join(here, 'contrast-states.js'), 'utf8');
const BASE = process.env.SWEEP_URL || 'http://localhost:5173/';
const CHROME = process.env.SWEEP_CHROMIUM || '/opt/pw-browsers/chromium';
// Narrow the run while working on the sweep itself; unset means everything.
const ONLY_NAVS = process.env.SWEEP_NAVS?.split(',').map(s => s.trim()).filter(Boolean);
const ONLY_GROUNDS = process.env.SWEEP_GROUNDS?.split(',').map(s => s.trim()).filter(Boolean);
const SKIP_STATES = process.env.SWEEP_NO_STATES === '1';

let chromium;
try {
  // An explicit path first, because ESM will not find a package outside this
  // tree on its own and playwright is deliberately not installed inside it.
  //
  // Resolved with `require` rather than `import`: playwright is CommonJS, and
  // ESM refuses a directory outright (ERR_UNSUPPORTED_DIR_IMPORT) instead of
  // reading the package's entry point from its package.json.
  const from = process.env.SWEEP_PLAYWRIGHT;
  if (from) {
    const { createRequire } = await import('node:module');
    ({ chromium } = createRequire(import.meta.url)(from));
  } else {
    ({ chromium } = await import('playwright'));
  }
} catch (e) {
  console.error(
    'playwright is not resolvable, and it is deliberately not a dependency of\n' +
    'this project. Install it in a scratch directory and name that copy:\n\n' +
    '  mkdir -p /tmp/drive && cd /tmp/drive\n' +
    '  echo \'{"name":"drive","private":true,"type":"module"}\' > package.json\n' +
    '  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install playwright\n' +
    '  cd - && SWEEP_PLAYWRIGHT=/tmp/drive/node_modules/playwright npm run sweep:contrast\n\n' +
    'NODE_PATH will not do it — the ESM resolver ignores it.\n' +
    'See .claude/skills/run for why playwright stays out of this project.\n\n' +
    String(e).slice(0, 200),
  );
  process.exit(2);
}

/** Every ground, read from the app's own source so the list cannot drift. */
const parseGrounds = () => {
  const src = readFileSync(join(here, '..', 'src', 'lib', 'look.ts'), 'utf8');
  const start = src.indexOf('export const GROUNDS');
  const body = src.slice(start, src.indexOf('\n];', start));
  const re = /id:\s*'([^']+)',\s*\n\s*label:\s*'([^']+)',\s*\n\s*blurb:\s*'((?:[^'\\]|\\.)*)',\s*\n\s*light:\s*(true|false),\s*\n\s*ramp:\s*\[([^\]]+)\]/g;
  const out = [];
  let m;
  while ((m = re.exec(body))) {
    const ramp = m[5].split(',').map((x) => x.trim().replace(/'/g, ''));
    out.push({ id: m[1], label: m[2], blurb: m[3], light: m[4] === 'true', bg: ramp[1] });
  }
  if (!out.length) throw new Error('parsed no grounds from look.ts — its shape changed');
  return out;
};
const GROUNDS = parseGrounds();

/*
 * Exactly one navigation is drawn at a time (`lib/chrome.ts`), so each is a
 * different app and none is exercised by looking at another. The last column
 * is what proves the one asked for is the one on screen.
 */
const NAVS = [
  ['tabs',        'Tab bar',      '#/home',   { phone: '.app-tabs', desktop: '.rail' }],
  ['feed',        'One feed',     '#/home',   { h1: /Everything/i }],
  ['springboard', 'Home screen',  '#/home',   { any: '.iconshape' }],
  ['shelves',     'Shelves',      '#/home',   { any: '.shelf-nav' }],
  ['workspace',   'Workspace',    '#/search', { any: '.deskwork-body' }],
  ['guides',      'Study guides', '#/home',   { h1: /Guides/i }],
];

const SCREENS = [['search','#/search'], ['courses','#/courses'],
                 ['study','#/study'], ['work','#/work'], ['draw','#/draw']];

/** Chrome only one navigation has; absent elsewhere, so each is guarded. */
const EXTRAS = {
  springboard: [['page2', async (p) => { await p.getByRole('tab',{name:/^Page 2$/i}).click({timeout:4000}); }]],
  shelves:     [['shelf-study', async (p) => { await p.getByRole('tab',{name:'Study'}).click({timeout:4000}); }]],
};

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/*
 * A ground is picked by its label *and* the start of its blurb.
 *
 * The two lists on that screen share names — there is an accent called
 * Industry as well as a ground called Industry, and the accents are drawn
 * first, so `^Industry` clicks the accent and leaves the ground alone. It also
 * separates Industry from Industry Dark. The accessible name joins the label
 * and the blurb with a space (the DOM runs them together; the accessible name
 * does not, which is worth knowing before writing any matcher here).
 */
const groundPattern = (g) => new RegExp('^' + esc(g.label + ' ' + g.blurb.slice(0, 10)), 'i');

/*
 * Hover and focus, measured with the state actually on.
 *
 * A resting sweep cannot see these: `.semester-primary-nav button:hover` sets
 * both a colour and a background, and so do about forty other rules — none of
 * which exist as far as `getComputedStyle` is concerned until something is
 * hovered.
 *
 * The state is forced through CDP rather than by moving the mouse. A real
 * pointer can only be in one place, gets blocked by anything overlapping, and
 * cannot produce `:focus-visible` at all without a keyboard round trip;
 * `CSS.forcePseudoState` sets the state on a named element and is what the
 * DevTools :hov panel uses.
 *
 * The element forced is not always the element measured. `.appicon:hover
 * .appicon-tile` paints the tile and requires the *icon* to be hovered, so
 * `contrast-states.js` returns both selectors and this forces one and audits
 * the other. Forcing the tile would change nothing and report a clean pass.
 */
const forceStates = async (page, cdp) => {
  const out = [];
  let targets = [];
  try { targets = await page.evaluate(STATES); } catch { return out; }
  if (!targets.length) return out;

  // One round trip to find which of them are actually on this screen, and to
  // name the pair so CDP can be pointed at the host.
  let matched = [];
  try {
    matched = await page.evaluate((list) => {
      const hits = [];
      /*
       * Only ids this sweep added are removed again. An earlier version set
       * `host.id` unconditionally and then stripped every id it had marked,
       * which quietly deleted ids the app had put there itself — and an id is
       * not decoration here: `aria-labelledby`, `aria-controls` and every
       * label association are written in terms of it. A measuring tool that
       * edits the thing it measures is measuring its own edit.
       */
      document.querySelectorAll('[data-sweep-added-id]').forEach((el) => {
        el.removeAttribute('id'); el.removeAttribute('data-sweep-added-id');
      });
      list.forEach((t, i) => {
        let measure;
        // A selector this browser will not parse is not worth taking the run down for.
        try { measure = document.querySelector(t.measure); } catch { return; }
        if (!measure) return;
        let host;
        try { host = measure.closest(t.host); } catch { return; }
        if (!host) return;
        const mark = (el, name) => {
          if (el.id) return el.id;
          el.id = name;
          el.setAttribute('data-sweep-added-id', '1');
          return name;
        };
        hits.push({ i, state: t.state,
                    measureId: mark(measure, `__sweepMeasure${i}`),
                    hostId: mark(host, `__sweepHost${i}`) });
      });
      return hits;
    }, targets);
  } catch { return out; }

  for (const m of matched) {
    let nodeId;
    try {
      const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
      ({ nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: `#${m.hostId}` }));
    } catch { continue; }
    if (!nodeId) continue;
    try {
      // `:focus-visible` is forced alongside `:focus`: the app draws its rings
      // on the former, and a forced `:focus` alone would not light them.
      const forced = m.state === 'focus-visible' ? ['focus', 'focus-visible']
                   : m.state === 'focus' ? ['focus'] : ['hover'];
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: forced });
      const res = await page.evaluate(([src, root]) => {
        window.__sweepRoot = root;
        // eslint-disable-next-line no-eval
        const r = eval(src);
        delete window.__sweepRoot;
        return r;
      }, [AUDIT, `#${m.measureId}`]);
      if (res && !res.missingRoot) out.push({ state: m.state, measured: res.measured, rows: res.rows,
        skipped: res.skipped, gradient: res.gradient });
    } catch { /* the element went away mid-pass; nothing measured, nothing claimed */ }
    finally {
      try { await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] }); } catch { /* page gone */ }
    }
  }
  return out;
};

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const findings = [], coverage = [], unverified = [];
const t0 = Date.now();

for (const [nav, navLabel, firstScreen, proof] of NAVS.filter(n => !ONLY_NAVS || ONLY_NAVS.includes(n[0]))) {
  for (const [vp, tag] of [[{width:420,height:900},'phone'], [{width:1280,height:900},'desktop']]) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e)));
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const skip = page.getByRole('button', { name: /skip/i }).first();
    if (await skip.count()) { await skip.click(); await page.waitForTimeout(1200); }

    /*
     * The navigation is set once and holds for every ground below it: changing
     * the ground repaints, it does not change which elements are drawn. That
     * is what makes thirteen grounds affordable — the page load, the adoption
     * prompt and the navigation are paid once per (navigation, width) rather
     * than once per pass.
     */
    await page.evaluate(()=>{ location.hash='#/setNav'; }); await page.waitForTimeout(1600);
    const nBtn = page.getByRole('button', { name: new RegExp('^' + esc(navLabel), 'i') }).first();
    if (await nBtn.count()) { await nBtn.click(); await page.waitForTimeout(1600); }
    await page.evaluate(h=>{ location.hash=h; }, firstScreen); await page.waitForTimeout(1800);

    let navOk = false, how = '';
    const sel = proof.any || proof[tag];
    if (sel) { navOk = await page.evaluate(s => document.querySelectorAll(s).length > 0, sel); how = sel; }
    else if (proof.h1) {
      const h1 = await page.evaluate(()=>document.querySelector('h1')?.textContent || '');
      navOk = proof.h1.test(h1); how = `h1 ~ ${proof.h1} (saw "${h1.slice(0,30)}")`;
    }

    const states = [['home', async (p) => { await p.evaluate(h=>{location.hash=h;}, firstScreen); }],
                    ...SCREENS.map(([name, hash]) =>
                      [name, async (p) => { await p.evaluate(h => { location.hash = h; }, hash); }]),
                    ...(EXTRAS[nav] || [])];

    for (const g of GROUNDS.filter(x => !ONLY_GROUNDS || ONLY_GROUNDS.includes(x.id))) {
      await page.evaluate(()=>{ location.hash='#/setLook'; }); await page.waitForTimeout(1500);
      const gBtn = page.getByRole('button', { name: groundPattern(g) });
      /*
       * Counted, because "the colour is already the one I wanted" is not the
       * same as "I set it". The default ground is the first in the list, so a
       * pattern that matched nothing still read as a pass on that one and as a
       * failure on every other — one true-looking row hiding a picker that was
       * never clicked.
       */
      const clicked = await gBtn.count();
      if (clicked) { await gBtn.first().click(); await page.waitForTimeout(1100); }
      const gotBg = await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--app-bg').trim());
      const groundOk = clicked > 0 && gotBg.toLowerCase() === g.bg.toLowerCase();
      if (!groundOk || !navOk) unverified.push({ nav, ground: g.id, width: tag, groundOk, navOk, gotBg, want: g.bg, how, clicked });

      for (const [state, go] of states) {
        let reached = true;
        try { await go(page); } catch { reached = false; }
        await page.waitForTimeout(1200);
        let res = null;
        try { res = await page.evaluate(AUDIT); }
        catch (e) { console.log('AUDIT FAILED', nav, g.id, state, String(e).slice(0,110)); }
        coverage.push({ nav, ground: g.id, width: tag, state, reached, verified: groundOk && navOk,
                        measured: res ? res.measured : 0,
                        skipped: res ? res.skipped : 0, gradient: res ? res.gradient : 0 });
        for (const r of (res ? res.rows : [])) findings.push({ nav, ground: g.id, width: tag, state, ...r });

        if (!SKIP_STATES) {
          const hits = await forceStates(page, cdp);
          for (const h of hits) {
            coverage.push({ nav, ground: g.id, width: tag, state: `${state}:${h.state}`, reached: true,
                            verified: groundOk && navOk, measured: h.measured,
                            skipped: h.skipped, gradient: h.gradient });
            for (const r of h.rows) findings.push({ nav, ground: g.id, width: tag, state: `${state}:${h.state}`, ...r });
          }
        }
      }
    }
    if (errs.length) console.log('pageerrors', nav, tag, errs.slice(0,2));
    await ctx.close();
    console.log(`[${Math.round((Date.now()-t0)/1000)}s] done ${nav}/${tag}`);
  }
}
await browser.close();

/*
 * Keyed by where it was seen as well as what it was. Without the navigation
 * and the width, two places sharing a class and a colour collapse into one row
 * and the survivor stands in for both — which is how the rail's labels went
 * unreported while the tab bar's were being fixed.
 */
const uniq = new Map();
for (const f of findings) {
  const k = [f.nav, f.width, f.ground, f.kind, f.cls, f.colour, f.groundColour].join('|');
  if (!uniq.has(k) || uniq.get(k).ratio > f.ratio) uniq.set(k, f);
}
const rows = [...uniq.values()].sort((a,b) => a.ratio - b.ratio);

const total = coverage.reduce((n,c)=>n+c.measured, 0);
/*
 * And what it could not measure, which `contrast-audit.js` has always counted
 * and this has always thrown away.
 *
 * That file's own header says why the counts matter as much as the rows — "a
 * pass that measured nothing is not a pass that found nothing" — and
 * `groundOf` returns null on anything painted over a gradient, deliberately,
 * because unknown beats wrong. Both numbers came back on every pass and were
 * dropped on the floor here, so a screen whose text all sits on gradients
 * printed a confident FINDINGS: 0 with nothing to say it had looked away.
 *
 * `scripts/paint.mjs` is the half that can measure those: it samples the
 * screenshot rather than compositing the style tree, so a gradient and a
 * `background-clip: text` heading are exactly what it reads. This number is
 * the size of the hole it fills.
 */
const skipped = coverage.reduce((n,c)=>n+(c.skipped||0), 0);
const gradient = coverage.reduce((n,c)=>n+(c.gradient||0), 0);
console.log(`\nPASSES: ${coverage.length}   ELEMENTS MEASURED: ${total}   GROUNDS: ${GROUNDS.length}`);
console.log(`NOT MEASURED: ${gradient} on a gradient (see scripts/paint.mjs), ${skipped} with no text or no colour`);
for (const g of GROUNDS) {
  const mine = coverage.filter(c => c.ground === g.id);
  const bad = mine.filter(c => !c.verified).length;
  const empty = mine.filter(c => c.measured === 0).length;
  console.log(`  ${(g.id + (g.light ? ' (light)' : '')).padEnd(22)} ${String(mine.reduce((n,c)=>n+c.measured,0)).padStart(6)} elements over ${String(mine.length).padStart(3)} passes` +
              (bad ? `   ⚠ ${bad} UNVERIFIED` : '') + (empty ? `   ⚠ ${empty} measured nothing` : ''));
}
/*
 * Resting and forced states, counted apart.
 *
 * Without this the state work is invisible in the output: a run with the
 * forcing silently broken looks identical to a run where every hover rule
 * happened to pass.
 */
const kindOf = (c) => (c.state.includes(':') ? c.state.split(':')[1] : 'resting');
const kinds = [...new Set(coverage.map(kindOf))];
console.log('\nBY STATE');
for (const k of kinds) {
  const mine = coverage.filter(c => kindOf(c) === k);
  const found = rows.filter(r => kindOf(r) === k).length;
  console.log(`  ${k.padEnd(14)} ${String(mine.length).padStart(5)} passes  ${String(mine.reduce((n,c)=>n+c.measured,0)).padStart(6)} elements  ${found} findings`);
}
if (!kinds.some(k => k !== 'resting') && !SKIP_STATES) {
  console.log('  ⚠ no hover or focus pass ran — the state rules found nothing to force,');
  console.log('    which is a result about this sweep, not about the app.');
}

if (unverified.length) {
  console.log(`\nSETUP NOT CONFIRMED (${unverified.length}) — these prove nothing:`);
  for (const u of unverified.slice(0, 40)) console.log(`  ${u.nav}/${u.ground}/${u.width}  ground=${u.groundOk} (saw ${u.gotBg}, wanted ${u.want}, picker matched ${u.clicked})  nav=${u.navOk}`);
}
console.log('\nFINDINGS: ' + rows.length);
for (const r of rows) {
  console.log(r.ratio.toFixed(2) + ':1 (need ' + r.need + ')  ' + r.nav + '/' + r.ground + '/' + r.width + '/' + r.state +
    '  ' + r.kind + '  .' + r.cls + '  "' + r.text + '"  ' + r.colour + ' on ' + r.groundColour);
}

// A sweep that could not confirm its own setup has not cleared anything.
process.exit(rows.length || unverified.length ? 1 : 0);
