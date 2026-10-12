/**
 * Fields a newer build wrote to the account, carried back up unread.
 *
 * `pickPersisted` is a list of the fields this build knows, and `push`
 * replaces the account's `state` row with what it is given. So a device still
 * running last month's build pulled a copy holding a field it had never heard
 * of — repairs, say — left it out of everything it held, and its next push
 * wrote the account without it. Every top-level field a newer build added was
 * one sync on an older device away from being erased, and nothing said so.
 *
 * The fix only holds from this build onward: a build that predates this file
 * still drops what it does not know. Refusing such a write has to happen in
 * the database, which is a separate change.
 *
 * ## What is carried
 *
 * The top-level keys of the last pulled copy that this build does not know
 * and the outgoing copy does not carry. A known key is never carried, because
 * a known key left out of a push was left out on purpose. The outgoing copy
 * wins every key it holds.
 *
 * Kept per account, in localStorage beside the base, because a push after a
 * reload can come before the next pull lands. Forgotten with the rest of the
 * sync memory (`forgetSyncMemory`), on sign-out and account switch.
 */
export const CARRIED_KEY = 'semester.carried';

interface Held {
  account: string;
  fields: Record<string, unknown>;
}

/** This session's copy, which wins: storage is only for after a reload. */
let memory: Held | null = null;

function read(): Held | null {
  // This session's pull is the newest word: a stored copy a failed write
  // could not replace is older, and pushing it would put back stale fields.
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(CARRIED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Held> | null;
      if (parsed && typeof parsed.account === 'string' && parsed.fields && typeof parsed.fields === 'object' && !Array.isArray(parsed.fields)) {
        return { account: parsed.account, fields: parsed.fields as Record<string, unknown> };
      }
    }
  } catch {
    // Unreadable: fall through to memory.
  }
  return memory;
}

/** The pulled copy's fields this build does not know. */
export function unknownFields(remote: Record<string, unknown>, known: ReadonlySet<string>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(remote).filter(([key]) => !known.has(key)));
}

/** Remember, for this account, what the copy just pulled holds that this build cannot read. */
export function rememberCarried(account: string, remote: Record<string, unknown> | null, known: ReadonlySet<string>): void {
  const fields = remote ? unknownFields(remote, known) : {};
  const held: Held = { account, fields };
  memory = held;
  try {
    if (Object.keys(fields).length === 0) localStorage.removeItem(CARRIED_KEY);
    else localStorage.setItem(CARRIED_KEY, JSON.stringify(held));
  } catch {
    // Kept in memory above, for this session's pushes.
  }
}

/** The outgoing copy, with this account's unknown fields put back where it does not hold them. */
export function withCarried<T extends Record<string, unknown>>(account: string, outgoing: T): T {
  const held = read();
  if (!held || held.account !== account) return outgoing;
  const extra = Object.entries(held.fields).filter(([key]) => !(key in outgoing));
  return extra.length === 0 ? outgoing : ({ ...Object.fromEntries(extra), ...outgoing } as T);
}

export function forgetCarried(): void {
  // Not null: a stored copy a blocked removal left behind must not come back.
  memory = { account: '', fields: {} };
  try {
    localStorage.removeItem(CARRIED_KEY);
  } catch {
    // Blocked storage: memory is already clear.
  }
}
