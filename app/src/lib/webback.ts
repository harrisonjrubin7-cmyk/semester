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

/** Applied to `dist/web/`, after Vite has copied `public/` into it. */
export async function apply(dir: string): Promise<string[]> {
  const done: string[] = [];
  for (const name of NEEDS_BACK) {
    const file = join(dir, name);
    if (!existsSync(file)) continue;
    const before = await readFile(file, 'utf8');
    const after = withBackLink(before);
    if (after === before) continue;
    await writeFile(file, after);
    done.push(name);
  }
  return done;
}
