/**
 * The signed-in session's token, on its own, away from the client that uses it.
 *
 * `setSessionToken` lived in `lib/claude.ts` — six lines at the top of a
 * 1,600-line Anthropic client — and `state/store.tsx` called it on sign-in.
 * That one import put the whole client, and `lib/figure.ts` and `lib/study.ts`
 * behind it, into the chunk the store is in, which is fetched before anything
 * paints. Measured in the built `store` chunk before this file existed:
 * `api.anthropic.com`, `anthropic-version` and `x-api-key` were all in it, on
 * every first load, for a screen most people never open.
 *
 * So the variable moved here and the client reads it from here. Two modules
 * that share one word, rather than a first paint that carries an API client.
 *
 * It is deliberately a getter rather than an exported binding: the client
 * reads it at the moment it asks a question, and a value read once at import
 * time would be the `null` it held before anybody signed in.
 */

let token: string | null = null;

/**
 * Set by the store on sign-in, which is what makes the shared key available.
 *
 * An empty string is stored as `null`, and that is the point rather than
 * tidiness. `state/store.tsx` reads the token off the session with
 * `s?.access_token ?? null`, and `??` catches null and undefined but not `''`
 * — so a session carrying a user and an empty token would leave this module
 * holding `''`. Every reader in the app tests truthiness, so `''` and `null`
 * behave alike everywhere but here, where the difference is the difference
 * between "nobody is signed in" and "somebody is signed in with a token that
 * is not one". `lib/claude.ts` is the reader that would notice: it builds
 * `Bearer ${sessionToken()}` for the shared route, and `Bearer ` is a header
 * that fails at the far end rather than near here.
 *
 * Normalising in the setter rather than at the call site makes it a property
 * of this module, which is what stops the next caller reintroducing it.
 */
export function setSessionToken(next: string | null): void {
  token = next || null;
}

/** The token as it stands now, or null when nobody is signed in. */
export function sessionToken(): string | null {
  return token;
}
