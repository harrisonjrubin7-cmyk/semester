#!/usr/bin/env node
/**
 * Fetch the deployed site so it can be driven in a real browser.
 *
 * `npm run build` proves the app compiles. It does not prove that what is on
 * https://harrisonjrubin7-cmyk.github.io/semester/ is that build, serving, and
 * rendering — and those are different claims. This fetches the deployed bytes
 * and lays them out so a browser can be pointed at them:
 *
 *     node scripts/mirror.mjs                       # into ./mirror
 *     python3 -m http.server 8099 -d ./mirror       # then open /semester/
 *
 * It exists as a file rather than as a shell one-liner because four separate
 * things about it are wrong the obvious way, each of them silently. They are
 * written at the point they bite rather than listed here — but the shape they
 * share is worth saying once: **every one of them fails by producing a mirror
 * that boots**. A missing chunk is a screen that renders empty; a wrong root is
 * a 404 body; a redeploy mid-crawl is a tree from two builds. None of them
 * throws, so a browser check on top reports a working screen as broken, and the
 * cost lands on whoever's change is being verified rather than on this file.
 *
 * So it refuses to hand back a tree it cannot vouch for: every specifier in
 * everything it wrote has to resolve to a file on disk, or it exits non-zero
 * and says which.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const BASE = (process.argv[2] ?? 'https://harrisonjrubin7-cmyk.github.io/semester/').replace(
  /\/?$/,
  '/',
);
const ROOT = process.argv[3] ?? join(process.cwd(), 'mirror');

/*
 * The tree is written under the base's own path, not at the root of `ROOT`.
 *
 * The deployed `index.html` loads its bundle from `/semester/assets/…` — an
 * absolute path — so a mirror served at `/` cannot find a single file. Getting
 * this wrong is silent in the worst way: the page returns a 404 body, the
 * browser check sees no chips, and the report is a screen that "does not
 * render" when nothing is wrong with it at all.
 *
 * So `mirror.mjs <base> ./out` writes `./out/semester/index.html`, and
 * `python3 -m http.server -d ./out` serves it at exactly the path the build
 * expects.
 */
const BASE_PATH = new URL(BASE).pathname.replace(/^\/|\/$/g, '');
const OUT = BASE_PATH ? join(ROOT, BASE_PATH) : ROOT;

/**
 * curl rather than `fetch`, deliberately.
 *
 * Node's `fetch` ignores HTTPS_PROXY. Anywhere this is run behind a proxy —
 * CI, a corporate network, an agent sandbox — that is the difference between
 * working and a connection error, and curl reads the variable and the system
 * CA store without being asked.
 */
function get(url) {
  try {
    return execFileSync('curl', ['-sSf', '--compressed', url], {
      maxBuffer: 1 << 28,
      encoding: 'buffer',
    });
  } catch {
    return null;
  }
}

/**
 * Every module specifier a file names, however it spells it.
 *
 * Two rules earned by false positives, and both matter more than they look:
 * a verification tool that cries wolf is one whose red is ignored.
 *
 *   · **A specifier in JavaScript contains a slash.** Matching every quoted
 *     string ending `.css` also caught Leaflet's own runtime sniffing for its
 *     stylesheet — `document.querySelector('link[href$="leaflet.css"]')` — a
 *     CSS attribute selector, not a path, and reported as a missing file. This
 *     build spells every real reference `./x.js` or `assets/x.js`. HTML
 *     attributes are exempt: `icon.svg` and `manifest.webmanifest` are real
 *     there and have no slash.
 *
 *   · **A path the code computes cannot be fetched.** `${e}sw.js` is assembled
 *     at runtime; chasing it produced a phantom 404.
 */
function specifiers(text, isHtml) {
  const out = new Set();
  // Quoted strings — "…", '…' and the backticks a bundler emits for a
  // dynamic import. Anything ending .js or .css is a candidate.
  for (const m of text.matchAll(/["'`]([^"'`\n]+?\.(?:js|css))["'`]/g)) {
    if (m[1].includes('/')) out.add(m[1]);
  }
  if (isHtml) {
    for (const m of text.matchAll(/(?:src|href)="([^"]+)"/g)) out.add(m[1]);
  }
  return [...out].filter((s) => !s.includes('${'));
}

/**
 * A specifier, as a path under the base — or null if it points outside it.
 *
 * **Two spellings, and getting this wrong is the whole bug twice over.** One
 * build emits both:
 *
 *     import(`./econ-CqocmqyD.js`)        // relative to the file naming it
 *     ["assets/Proof-B4WJcc-Z.js", …]     // relative to the base, in a
 *                                         // preload array
 *
 * Resolving everything against the base misses the first (the original bug:
 * nine chunks uncollected). Resolving everything against the file misses the
 * second, and produces `assets/assets/…` — which is what the first attempt at
 * this fix did. So the leading `./` is load-bearing and is what decides.
 */
function resolve(spec, fromPath) {
  if (/^(?:https?:)?\/\//.test(spec) || spec.startsWith('data:')) return null;
  // `./x` and `../x` are relative to the referring file; a bare `assets/x` is
  // relative to the base; a leading `/` is relative to the origin.
  const against = /^\.{1,2}\//.test(spec) ? new URL(fromPath, BASE) : BASE;
  let url;
  try {
    url = new URL(spec, against);
  } catch {
    return null;
  }
  if (!url.href.startsWith(BASE)) return null;
  return decodeURIComponent(url.href.slice(BASE.length).split(/[?#]/)[0]);
}

/** Which build `index.html` currently names, as a fingerprint to pin. */
function currentBuild() {
  const html = get(BASE + 'index.html');
  return html ? (html.toString('utf8').match(/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0] ?? '') : null;
}

/** One full crawl. Returns what it wrote, what 404'd, and what it could not resolve. */
function crawl() {
  const seen = new Map(); // path -> true when written, false when the fetch failed
  const queue = ['index.html'];
  // Named rather than discovered: a service worker is registered by string and
  // a manifest is referenced from the head, and a mirror without them throws a
  // registration error into every page check.
  for (const extra of ['sw.js', 'manifest.webmanifest']) queue.push(extra);

  while (queue.length) {
    const path = queue.shift();
    if (seen.has(path)) continue;

    const body = get(BASE + path);
    if (!body) {
      seen.set(path, false);
      continue;
    }
    seen.set(path, true);
    const file = join(OUT, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, body);

    if (!/\.(js|css|html|webmanifest)$/.test(path)) continue;
    const text = body.toString('utf8');
    for (const spec of specifiers(text, path.endsWith('.html'))) {
      const next = resolve(spec, path);
      if (next && !seen.has(next)) queue.push(next);
    }
  }

  /*
   * The check that makes this trustworthy.
   *
   * Every specifier in everything written has to resolve to something on disk.
   * Without it the failure mode is a mirror that boots with a screen missing,
   * which is indistinguishable from that screen being broken — and that is a
   * false negative charged to whoever's change is being checked.
   */
  const missing = [];
  for (const [path, ok] of seen) {
    if (!ok || !/\.(js|css|html|webmanifest)$/.test(path)) continue;
    const text = readFileSync(join(OUT, path), 'utf8');
    for (const spec of specifiers(text, path.endsWith('.html'))) {
      const target = resolve(spec, path);
      if (target && !existsSync(join(OUT, target))) missing.push(`${path} → ${target}`);
    }
  }
  return {
    written: [...seen.values()].filter(Boolean).length,
    failed: [...seen].filter(([, ok]) => !ok).map(([p]) => p),
    missing,
  };
}

/*
 * Retried, because the deployment moves underneath this.
 *
 * GitHub Pages replaces the whole artifact atomically and deletes the previous
 * build's hashed chunks. This repo currently lands a deploy every couple of
 * minutes, and a crawl takes about a minute — so a run can straddle two builds
 * and see chunks named by the index it fetched already 404. That is not an
 * incomplete mirror and must not be reported as one: it is a stale index, and
 * the answer is to start again against the new build.
 *
 * Distinguished by pinning: the entry bundle `index.html` named at the start,
 * checked again at the end. Same → the misses are real. Changed → it redeployed
 * and the attempt is void.
 */
let result = null;
for (let attempt = 1; attempt <= 3; attempt += 1) {
  const before = currentBuild();
  if (before === null) {
    console.error(`cannot reach ${BASE}`);
    process.exit(1);
  }
  result = crawl();
  const after = currentBuild();

  if (before !== after) {
    console.log(`attempt ${attempt}: redeployed mid-crawl (${before} → ${after}), starting again`);
    continue;
  }
  console.log(`mirrored ${result.written} files from ${before} into ${OUT}`);
  if (result.failed.length) {
    console.log(`could not fetch (${result.failed.length}): ${result.failed.join(', ')}`);
  }
  if (result.missing.length) {
    console.error(`INCOMPLETE — ${result.missing.length} reference(s) with nothing behind them:`);
    for (const m of result.missing.slice(0, 20)) console.error(`  ${m}`);
    process.exit(1);
  }
  console.log('closed under references: every specifier resolves to a file on disk');
  console.log(`serve it:  python3 -m http.server 8099 -d ${ROOT}`);
  console.log(`then open: http://localhost:8099${new URL(BASE).pathname}`);
  process.exit(0);
}

console.error('gave up after 3 attempts — the site redeployed during every one');
process.exit(1);
