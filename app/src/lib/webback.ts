/**
 * Everything this repository has to repair in the website before it ships.
 *
 * The website is three pages built elsewhere and dropped into `public/web/` as
 * self-contained bundles. The generator that emits them is not in this
 * repository — `docs/data-contract.md` §0 records the search — so none of what
 * follows can be fixed at the source from here. Each one is a build step, and
 * each is dead weight the day the generator is fixed. SETUP.md §4 carries that
 * handover list; the four repairs, in the order they appear below, are:
 *
 * 1. **A way back to the app.** The front door links home; `app.html` and
 *    `study.html` link only to each other, so somebody landing on the term or
 *    the study side from a shared link has no way home but the address bar.
 * 2. **Paths into the repository's own source tree**, which cost the study page
 *    every one of its units.
 * 3. **A countdown that could not read a deadline**, which showed "NaNm left".
 * 4. **Files the pages ask for and nothing published** — the design system, and
 *    twelve icons drawn as CSS masks.
 *
 * ## Why this runs at build time rather than being edited into the files
 *
 * The bundles are generated artefacts: one line of minified HTML wrapping the
 * real document as an escaped string, regenerated whole whenever the website
 * changes. An edit inside one would be correct until the next regeneration and
 * then silently gone — the worst kind of fix, because nothing fails, a link
 * just stops being there.
 *
 * So the committed bundles stay exactly as they arrived, byte for byte, and
 * this works on the copies in `dist/`. Regenerating the website loses nothing,
 * and every repair is code in this repository that can be read and tested
 * rather than a string somebody remembered to paste.
 *
 * ## Why the address is computed in the browser
 *
 * The front door's own link home is written out in full —
 * `https://…github.io/semester/#/home` — which is right for exactly one
 * deployment, and `study.html` streams its audio from the same hard-coded
 * `BASE`. Neither is repaired here; both are item 5 on SETUP.md's list. The
 * snippet below reads `location.pathname` instead and cuts everything from
 * `/web/` onwards, so what this file *does* add is right under any base: a
 * fork, a local `vite preview`, a repository somebody renamed.
 *
 * The element re-attaches itself on a `MutationObserver`, because the bundler
 * replaces the document as it unpacks and would otherwise take the link with
 * it.
 */

import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
// Extension-explicit, unlike the rest of the app: `scripts/webback.mjs` loads
// this file through Node's own TypeScript stripping, which does not guess at
// one. Allowed by `allowImportingTsExtensions` in tsconfig.app.json.
import { writeIcons } from './webicons.ts';

/** The pages that need one. The front door already has two of its own. */
export const NEEDS_BACK = ['app.html', 'study.html'];

/** All three, for the repairs that are not about linking. */
export const PAGES = ['index.html', 'app.html', 'study.html'];

/** So a second run is a no-op rather than a second button. */
export const MARK = 'semester-back-to-app';

export const SNIPPET = `
<script>/* ${MARK} — added by scripts/webback.mjs, see the note there */
(function () {
  var ID = '${MARK}';
  function home() {
    // Everything before /web/ is the deployment's base, whatever it is.
    var path = location.pathname;
    var cut = path.lastIndexOf('/web/');
    return (cut === -1 ? '' : path.slice(0, cut)) + '/#/home';
  }
  function attach() {
    if (document.getElementById(ID) || !document.body) return;
    var a = document.createElement('a');
    a.id = ID;
    a.href = home();
    a.textContent = 'Open the app';
    a.setAttribute('aria-label', 'Open Semester on your phone');
    a.style.cssText = [
      // Bottom right. Bottom left sits on top of the term page's sidebar
      // footer, which is where that page says whether you are signed in —
      // covering it to offer a link is a poor trade.
      'position:fixed', 'right:14px', 'bottom:14px', 'z-index:2147483000',
      'font:600 12px/1 -apple-system,BlinkMacSystemFont,sans-serif',
      'letter-spacing:.06em', 'text-transform:uppercase', 'text-decoration:none',
      'padding:9px 13px', 'border-radius:8px', 'color:#f6f8fb',
      'background:rgba(12,14,18,.88)', 'border:1px solid rgba(236,238,242,.22)',
      'box-shadow:0 2px 10px rgba(0,0,0,.25)',
    ].join(';');
    document.body.appendChild(a);
  }
  // The bundler replaces the document as it unpacks, which takes the link with
  // it. Watching is cheaper and more certain than guessing at a delay.
  attach();
  document.addEventListener('DOMContentLoaded', attach);
  new MutationObserver(attach).observe(document.documentElement, { childList: true, subtree: true });
})();
</script>
`;

/**
 * The page with the snippet in it, or the page unchanged.
 *
 * Idempotent, and refuses rather than guesses: a bundle with no `</body>` is
 * not one of these three files, and appending to the end of something we do
 * not recognise is how a build step corrupts a deploy.
 */
export function withBackLink(html: string): string {
  if (html.includes(MARK)) return html;
  const at = html.lastIndexOf('</body>');
  if (at === -1) return html;
  return html.slice(0, at) + SNIPPET + html.slice(at);
}

/**
 * ## The other thing wrong with these bundles: they ask for their own source tree
 *
 * The generator wrote paths relative to the directory it was run in rather than
 * to the page it was writing. The clearest one, verbatim out of `study.html`:
 *
 *     fetch('app/public/audio/lessons/' + course + '/lessons.json')
 *
 * Served from `/semester/web/study.html` that resolves to
 * `/semester/web/app/public/audio/…`, which is nothing. The file is really at
 * `/semester/audio/…` — `app/public/` is where it sits in the repository, and
 * Vite publishes the *contents* of `public/`, so the prefix is exactly the part
 * that must not survive into a URL.
 *
 * This is not cosmetic. That fetch is how the study page gets its units, and
 * with it failing every course reads "0 units", the contents list is empty and
 * the script pane is blank — the whole page, silently, because the 404 is
 * swallowed by an `r.ok ? … : null`. The same prefix costs `app.html` its logo.
 *
 * ## Why a runtime shim rather than a search and replace
 *
 * `study.html` has the string literally and could be rewritten. `app.html`
 * does not — its paths are assembled at run time out of pieces, so there is
 * nothing in the file to match on. One mechanism that catches both beats two
 * that each catch half, and this one also catches whatever the next
 * regeneration constructs the same way.
 *
 * It goes in the head, before the bundler unpacks the real document, because a
 * patch applied after the first fetch has already gone out is not a patch.
 *
 * ## What it does not reach, and what answers that instead
 *
 * Only URLs the browser hands to `fetch`, to an XHR, or to a `src`/`href`
 * attribute. The pages also ask for `_ds/industry-…/styles.css`, its bundle,
 * and twelve `icons/*.svg` — and those arrive as a CSS `mask-image`, which is
 * not an attribute and never passes anything this can hook. They were not
 * misplaced either; they simply did not ship. `apply` below puts them where the
 * pages have been asking for them: the design system copied out of `project/`,
 * the glyphs written from the app's own `icons.data.ts`.
 */
export const PATHS = 'semester-source-paths';

/** The prefix the generator leaks: where a file lives, not where it is served. */
export const SOURCE_PREFIX = 'app/public/';

export const PATH_SNIPPET = `
<script>/* ${PATHS} — added by scripts/webback.mjs, see the note there */
(function () {
  var PRE = '${SOURCE_PREFIX}';
  function root() {
    // Everything before /web/ is the deployment's base, whatever it is.
    var path = location.pathname;
    var cut = path.lastIndexOf('/web/');
    return (cut === -1 ? '' : path.slice(0, cut)) + '/';
  }
  function fix(u) {
    if (typeof u !== 'string') return u;
    if (u.slice(0, PRE.length) === PRE) return root() + u.slice(PRE.length);
    // The same mistake after the browser has already resolved it against the
    // page — an absolute URL, or a src the page read back out of the DOM.
    var at = u.indexOf('/web/' + PRE);
    if (at !== -1) return u.slice(0, at) + '/' + u.slice(at + 5 + PRE.length);
    return u;
  }
  var fetched = window.fetch;
  if (fetched) {
    window.fetch = function (input, init) {
      if (typeof input === 'string') return fetched.call(this, fix(input), init);
      if (input && typeof input.url === 'string' && fix(input.url) !== input.url) {
        return fetched.call(this, new Request(fix(input.url), input), init);
      }
      return fetched.call(this, input, init);
    };
  }
  var opened = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    var args = Array.prototype.slice.call(arguments);
    args[1] = fix(url);
    return opened.apply(this, args);
  };
  // The term page's logo is set on an element before it is in the document —
  // React builds the node, sets src, and attaches it after. The request has
  // gone out by the time anything watching the document could see it, so these
  // two are caught on the way in rather than after the fact.
  var setAttr = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name, value) {
    return setAttr.call(this, name, name === 'src' || name === 'href' ? fix(value) : value);
  };
  var srcOf = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  if (srcOf && srcOf.set) {
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      configurable: true,
      enumerable: srcOf.enumerable,
      get: srcOf.get,
      set: function (value) {
        return srcOf.set.call(this, fix(value));
      },
    });
  }
  function mend(node) {
    if (!node || node.nodeType !== 1 || !node.getAttribute) return;
    ['src', 'href'].forEach(function (name) {
      var was = node.getAttribute(name);
      // Setting it back to itself would re-trigger the observer forever.
      if (was && fix(was) !== was) node.setAttribute(name, fix(was));
    });
  }
  function sweep(node) {
    mend(node);
    if (node && node.querySelectorAll) {
      Array.prototype.forEach.call(node.querySelectorAll('[src],[href]'), mend);
    }
  }
  sweep(document.documentElement);
  new MutationObserver(function (records) {
    records.forEach(function (r) {
      if (r.type === 'attributes') mend(r.target);
      Array.prototype.forEach.call(r.addedNodes || [], sweep);
    });
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'href'],
  });
})();
</script>
`;

/**
 * The page with the path repair in it, or the page unchanged.
 *
 * Before the one closing head tag rather than the last one: these files carry
 * the real document as an escaped string, so the outer head is the only one
 * that is really a head, and it closes before the script that unpacks the rest.
 * Anything later would run after the first fetch had already 404'd.
 */
export function withPathFix(html: string): string {
  if (html.includes(PATHS)) return html;
  const at = html.indexOf('</head>');
  if (at === -1) return html;
  return html.slice(0, at) + PATH_SNIPPET + html.slice(at);
}

/**
 * ## "NaNm left": the term page cannot read its own deadlines
 *
 * The countdown for something due today, verbatim out of `app.html`:
 *
 *     const hh = parseInt(it.time, 10) + (/PM/.test(it.time) && … ? 12 : 0);
 *
 * `it.time` is the deadline as the syllabus words it — "Before class, 1:15p",
 * "In class", "Window is Sep 8–17". `parseInt` of any of those is `NaN`, which
 * makes an Invalid Date, which makes `Math.max(0, NaN)` — `NaN`, not 0 — and
 * the row reads "NaNm left".
 *
 * Of the thirteen wordings in the data the page carries, three survive that
 * expression: `9:00–11:00 AM` and `3:00–5:00 PM` by luck, and `11:59 PM`
 * because the hard-coded `, 59` in the next line happens to be its minutes.
 * Nine produce `NaN`. `5:00p` is the worst of them — `/PM/` does not match a
 * lowercase `p`, so it reads as five in the morning and counts down to a
 * deadline twelve hours before the real one. Weighted by the items that carry
 * each wording, 44 of 50 deadlines show `NaN` on the day they are due.
 *
 * ## Why this one is a source patch and not a shim
 *
 * The bad value is computed and rendered inside the bundle; nothing at a
 * boundary can see it, and the only thing reachable afterwards is the text
 * "NaNm left" in the DOM, which no longer knows which deadline it belongs to.
 * Replacing that with "today" would hide the `NaN` and still lose the
 * countdown — and would leave `5:00p` quietly wrong, because a wrong number
 * has no marker to key off.
 *
 * So the expression itself is replaced, at build time, in `dist/`, anchored on
 * a long literal. If a regeneration changes that code the anchor stops
 * matching, nothing is patched, and the build says so — a repair that silently
 * stops applying is the failure mode this whole file exists to avoid.
 *
 * The replacement calls a reader injected into the head, which is `readDue`
 * from `lib/duetime.ts` written out as browser JavaScript. That duplication is
 * real, and `webback.test.ts` holds it honest: the two must agree on every
 * wording in the data, `readDue` being the one with the reasoning behind it.
 */
export const COUNTDOWN = 'semester-countdown';

/**
 * The expression to replace, exactly as it sits in the file.
 *
 * Long on purpose. A short anchor might match somewhere else in a bundle this
 * size, and a build step that patches the wrong line is worse than one that
 * patches nothing.
 */
export const BROKEN =
  'const hh = parseInt(it.time, 10) + (/PM/.test(it.time) && parseInt(it.time, 10) !== 12 ? 12 : 0);' +
  // A literal backslash-n: the real document is carried as an escaped string,
  // so what looks like two lines in the page is one line in the file.
  '\\n      ' +
  'const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, 59);';

/**
 * What goes in its place: the real time, or nothing to count down to.
 *
 * Both lines, because the minutes are the other half of the bug. The page
 * hard-codes `, 59` — right for `11:59 PM` and for nothing else, so even a
 * deadline whose hour it read correctly was counted to the wrong minute.
 *
 * The two lines *after* this are untouched and still work: `target` is a Date
 * and they subtract `now` from it. A wording holding no clock time returns
 * early with "today", beside the page's own "tomorrow", rather than a
 * countdown to a time nobody stated.
 */
export const MENDED =
  "const at = window.__semesterDue(it.time); if (at === null) return 'today';" +
  '\\n      ' +
  'const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(),' +
  ' Math.floor(at / 60), at % 60);';

/** `readDue` from `lib/duetime.ts`, as browser JavaScript. Kept in step by test. */
export const CLOCK_SNIPPET = `
<script>/* ${COUNTDOWN} — added by scripts/webback.mjs, see the note there */
window.__semesterDue = function (text) {
  if (typeof text !== 'string') return null;
  var s = text.trim();
  if (!s) return null;
  function clock(hour, mins, pm) {
    if (hour < 1 || hour > 12 || mins > 59) return null;
    var h = hour === 12 ? 0 : hour;
    return (h + (pm ? 12 : 0)) * 60 + mins;
  }
  // Every clock-shaped thing, in order. A bare number is only a time when it
  // carries a meridiem: 'Sep 8-17' is two dates and '1:15p' is a time.
  var re = /(\\d{1,2})(?::(\\d{2}))?\\s*([ap])\\.?m?\\.?\\b/gi;
  var found = [];
  var m;
  while ((m = re.exec(s)) !== null) {
    found.push({ hour: Number(m[1]), mins: Number(m[2] || 0), pm: m[3].toLowerCase() === 'p' });
  }
  // A range whose first half states no meridiem: '3:00-5:00 PM'. The colon is
  // required, so 'Sep 29 - Oct 8' is not mistaken for one.
  var range = /(\\d{1,2}):(\\d{2})\\s*[-\\u2013\\u2014]\\s*(\\d{1,2})(?::(\\d{2}))?\\s*([ap])\\.?m?\\.?/i.exec(s);
  if (range !== null) {
    var hour = Number(range[1]);
    var end = Number(range[3]);
    var pm = range[5].toLowerCase() === 'p';
    // The meridiem governs both halves, unless the range crosses noon —
    // '11:00-1:00 PM' starts in the morning, because it has to.
    return clock(hour, Number(range[2]), pm && hour <= end);
  }
  if (found.length === 0) {
    // A lone H:MM with no meridiem, which a 24-hour syllabus can produce.
    var bare = /\\b(\\d{1,2}):(\\d{2})\\b/.exec(s);
    if (bare === null) return null;
    if (Number(bare[1]) > 23 || Number(bare[2]) > 59) return null;
    return Number(bare[1]) * 60 + Number(bare[2]);
  }
  return clock(found[0].hour, found[0].mins, found[0].pm);
};
</script>
`;

/**
 * The page counting down from a time it can actually read, or unchanged.
 *
 * Unchanged in two cases that mean opposite things and are told apart by the
 * caller: already done, and the anchor is gone. The second is what a
 * regeneration looks like, and the build reports it.
 */
export function withCountdown(html: string): string {
  if (html.includes(COUNTDOWN)) return html;
  if (!html.includes(BROKEN)) return html;
  const fixed = html.replace(BROKEN, MENDED);
  const at = fixed.indexOf('</head>');
  if (at === -1) return html;
  return fixed.slice(0, at) + CLOCK_SNIPPET + fixed.slice(at);
}

/** What a page still needs, for a build that should say when a repair lapsed. */
export function stillBroken(html: string): boolean {
  return !html.includes(COUNTDOWN) && !html.includes(BROKEN);
}

/**
 * ## The design system the pages ask for, which is in the repository
 *
 * The term page's `<sc-helmet>` block links two more files:
 *
 *     <link rel="stylesheet" href="_ds/industry-…/styles.css">
 *     <script src="_ds/industry-…/_ds_bundle.js"></script>
 *
 * Both exist, at `project/_ds/industry-…/` — outside `app/`, so Vite never saw
 * them and they never shipped. Nothing was invented to satisfy these: they are
 * the real files, copied to where the page has been asking for them all along.
 *
 * The stylesheet changes nothing visible, which is the point rather than a
 * disappointment. It is the Industry token sheet; the page carries its own
 * styles inline, after the link, and they win. It is here so the page loads
 * what it says it loads, and so a later regeneration that leans on a token
 * finds one.
 */
export const DESIGN = 'industry-ec2ca40c-1b5d-43d4-b745-e12440ac38fa';

/** What the helmet asks for by name. The bundle is 300 bytes and inert. */
export const DESIGN_FILES = ['styles.css', '_ds_bundle.js'];

export interface Applied {
  /** Pages written. */
  patched: string[];
  /** Files put where the pages were asking for them. */
  added: string[];
  /** Repairs that no longer match, which is what a regeneration looks like. */
  lapsed: string[];
}

/**
 * Applied to `dist/web/`, after Vite has copied `public/` into it.
 *
 * `from` is the repository root, for the two design-system files that live
 * outside `app/`. Absent, they are skipped rather than guessed at — the same
 * rule the rest of this file follows.
 */
export async function apply(dir: string, from?: string): Promise<Applied> {
  const patched: string[] = [];
  const lapsed: string[] = [];
  for (const name of PAGES) {
    const file = join(dir, name);
    if (!existsSync(file)) continue;
    const before = await readFile(file, 'utf8');
    let after = withPathFix(before);
    if (NEEDS_BACK.includes(name)) after = withBackLink(after);
    if (name === 'app.html') {
      if (stillBroken(after)) lapsed.push(`${name}: the deadline countdown`);
      after = withCountdown(after);
    }
    if (after === before) continue;
    await writeFile(file, after);
    patched.push(name);
  }

  const added = (await writeIcons(join(dir, 'icons'))).map((n) => `icons/${n}`);

  const source = from ? join(from, 'project', '_ds', DESIGN) : '';
  if (source && existsSync(source)) {
    await mkdir(join(dir, '_ds', DESIGN), { recursive: true });
    for (const name of DESIGN_FILES) {
      if (!existsSync(join(source, name))) continue;
      await copyFile(join(source, name), join(dir, '_ds', DESIGN, name));
      added.push(`_ds/${name}`);
    }
  } else {
    lapsed.push(`the Industry design system: no project/_ds/${DESIGN}`);
  }

  return { patched, added, lapsed };
}
