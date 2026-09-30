/**
 * The `delete-account` function's request handling, with no `Deno.env` and no
 * database of its own, so `app/src/lib/deleteaccount.test.ts` can walk every
 * answer it gives — the same arrangement as `integrationtick.ts`.
 *
 * ## The order, and why it is this one
 *
 *   1. **Who is asking**, from their own access token and nothing else. There
 *      is no account id in the body to aim this at somebody else.
 *   2. **Their rows**, in one transaction: `public.erase_account(uuid)`
 *      (`supabase/migrations/20260929010000_account_erasure_and_export.sql`).
 *      A failure there rolls the whole thing back, so the answer is exactly
 *      "nothing was deleted".
 *   3. **The sign-in**, through the Admin API. Last, because once it is gone
 *      the token that proves who is asking is gone with it, and a retry of
 *      step 2 would have nobody to act for.
 *
 * Step 3 can fail after step 2 succeeded. That is the one partial state, and
 * the answer says so in those words — the rows are gone, the sign-in is not —
 * with `erased: true` so the page does not claim otherwise. Pressing the
 * button again is safe: step 2 on an emptied account removes nothing and
 * succeeds, and step 3 is tried again.
 *
 * Every answer carries `erased` and `signInRemoved`, and the page reads those
 * rather than the status code, so what a student is told is what happened.
 */

export interface DeleteAccountDeps {
  /** The account id this access token belongs to, or null if it is not valid. */
  whoIs(token: string): Promise<string | null>;
  /** `erase_account` for this id. Resolves with its summary; throws on any failure. */
  erase(userId: string): Promise<unknown>;
  /** The auth user's deletion. Throws on any failure. */
  deleteUser(userId: string): Promise<void>;
}

export interface DeleteAccountAnswer {
  erased: boolean;
  signInRemoved: boolean;
  message: string;
  removed?: unknown;
}

/**
 * Thrown by `deps.erase` when the database refused because the account is under
 * a legal hold (`erase_account` raises SQLSTATE 55006 before it touches a row).
 * It is its own type so a hold is never reported as the fault it is not.
 */
export class AccountHeldError extends Error {
  constructor() {
    super('account under a legal hold');
    this.name = 'AccountHeldError';
  }
}

/** What the student is told, spelled once so the tests and the page agree. */
export const SAID = {
  unconfigured: 'Account deletion is not set up on this server yet. Nothing was deleted.',
  method: 'POST only. Nothing was deleted.',
  signedOut: 'Sign in again to delete your account. Nothing was deleted.',
  unconfirmed: 'Deleting an account needs the word DELETE. Nothing was deleted.',
  eraseFailed:
    'Your account could not be deleted, and nothing was: every row is exactly where it was. Try again in a minute; if it keeps failing, email support.',
  // No reason is given, on purpose: why a hold exists is not the student's to be
  // told by an error message, and it is not a fault, so there is nothing to retry.
  held:
    'Your account cannot be deleted right now, and nothing was deleted. This is not a fault. Ask your school, or email support, if you want to know more.',
  signInKept:
    'Your data is deleted, but the sign-in itself could not be removed yet. Press Delete my account again to finish — it is safe to repeat.',
  done: 'Your account is deleted: every row the server held about you, and the sign-in itself.',
} as const;

export async function serveDeleteAccount(
  req: Request,
  deps: DeleteAccountDeps | null,
  cors: Record<string, string> = {},
): Promise<Response> {
  const answer = (status: number, body: DeleteAccountAnswer) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  const nothing = (status: number, message: string) =>
    answer(status, { erased: false, signInRemoved: false, message });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return nothing(405, SAID.method);
  if (!deps) return nothing(503, SAID.unconfigured);

  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get('Authorization') ?? '')?.[1] ?? '';
  if (!token) return nothing(401, SAID.signedOut);

  // The typed word travels with the request, so a stray POST carrying a
  // stolen-but-live session is still not enough on its own to empty an
  // account: it has to have been asked for in these words.
  let confirm: unknown;
  try {
    confirm = ((await req.json()) as { confirm?: unknown } | null)?.confirm;
  } catch {
    confirm = undefined;
  }
  if (confirm !== 'DELETE') return nothing(400, SAID.unconfirmed);

  let userId: string | null;
  try {
    userId = await deps.whoIs(token);
  } catch {
    userId = null;
  }
  if (!userId) return nothing(401, SAID.signedOut);

  let removed: unknown;
  try {
    removed = await deps.erase(userId);
  } catch (error) {
    if (error instanceof AccountHeldError) return nothing(409, SAID.held);
    return nothing(500, SAID.eraseFailed);
  }

  try {
    await deps.deleteUser(userId);
  } catch {
    return answer(500, { erased: true, signInRemoved: false, message: SAID.signInKept, removed });
  }

  return answer(200, { erased: true, signInRemoved: true, message: SAID.done, removed });
}
