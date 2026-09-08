/**
 * Give the website's inner pages a way back to the app.
 *
 * The website is three pages built elsewhere and dropped into `public/web/` as
 * self-contained bundles. Its front door links back to the app; `app.html` and
 * `study.html` do not — they link to each other and nowhere else — so somebody
 * who lands on the term or the study side from a shared link has no way home
 * except the address bar.
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
 * this appends to the copies in `dist/`. Regenerating the website loses
 * nothing, and the return link is code in this repository that can be read and
 * tested rather than a string somebody remembered to paste.
 *
 * ## Why the address is computed in the browser
 *
 * The front door's own link home is written out in full —
 * `https://…github.io/semester/#/home` — which is right for exactly one
 * deployment. The snippet below reads `location.pathname` instead and cuts
 * everything from `/web/` onwards, so it is right under any base: a fork, a
 * local `vite preview`, a repository somebody renamed.
 *
 * The element re-attaches itself on a `MutationObserver`, because the bundler
 * replaces the document as it unpacks and would otherwise take the link with
 * it.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

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
 * ## What it deliberately does not touch
 *
 * `_ds/industry-…/styles.css`, its bundle, and ten `icons/*.svg` are also
 * requested and also 404. Those are not misplaced — nothing in this repository
 * publishes them, so there is no right URL to send them to. They are inert
 * (the pages are styled from inlined CSS and draw no icons), and inventing a
 * destination for a file that does not exist would turn a visible 404 into a
 * silent wrong answer. They are written up in SETUP.md for whoever regenerates.
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

/** Applied to `dist/web/`, after Vite has copied `public/` into it. */
export async function apply(dir: string): Promise<string[]> {
  const done: string[] = [];
  for (const name of PAGES) {
    const file = join(dir, name);
    if (!existsSync(file)) continue;
    const before = await readFile(file, 'utf8');
    const after = NEEDS_BACK.includes(name)
      ? withBackLink(withPathFix(before))
      : withPathFix(before);
    if (after === before) continue;
    await writeFile(file, after);
    done.push(name);
  }
  return done;
}
