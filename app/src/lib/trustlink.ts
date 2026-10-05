/**
 * A procurement-room link, read off the address bar.
 *
 * The account team sends a reviewer at a university a link of the form
 *
 *     https://…/semester/#room=<64 hex characters>
 *
 * The token is in the **fragment**, not the query string, on purpose: a
 * browser never sends the fragment to any server, so it does not appear in
 * GitHub Pages' logs, in a proxy's, or in the `Referer` of anything the page
 * loads. `?form=` can ride in the query because a form id only lets somebody
 * answer; this token opens NDA material.
 *
 * A leaf with no imports, like `ltiarrival.ts`, because `main.tsx` asks it on
 * every load before anything else, and the answer is almost always null.
 */

/** The fragment key a room link arrives on. */
export const ROOM_KEY = 'room';

const TOKEN = /^[0-9a-f]{64}$/;

/** The token in `#room=<token>`, or null. Anything else in the fragment is not a room link. */
export function askedRoom(hash: string): string | null {
  if (!hash.startsWith('#')) return null;
  const params = new URLSearchParams(hash.slice(1));
  if ([...params.keys()].length !== 1) return null;
  const token = params.get(ROOM_KEY);
  return token && TOKEN.test(token) ? token : null;
}
