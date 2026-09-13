/**
 * The link for a code, against wherever this copy of the app is served from.
 *
 * `linkTo` in `lib/call.ts` is the pure half and takes the origin as an
 * argument, which is what makes it testable. This is the one line that reads
 * the browser, kept apart so that neither the screens nor the library has to
 * be about both.
 *
 * `location.pathname` rather than the origin alone: this app is served from a
 * subpath on GitHub Pages, and a link to the origin is a link to somebody
 * else's front page.
 */
import { linkTo } from '../../lib/call';

export function shareLink(code: string): string {
  if (typeof location === 'undefined') return '';
  return linkTo(code, `${location.origin}${location.pathname}`);
}

/**
 * Put it on the clipboard, and say whether that worked.
 *
 * The clipboard is refused in more situations than people expect — an
 * insecure origin, a browser that wants a user gesture it did not see — and a
 * button that says "Copied" when nothing was copied sends somebody to a call
 * with an empty paste.
 */
export async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
