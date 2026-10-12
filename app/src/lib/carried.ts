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
 *
 * Also in memory, and whichever copy was pulled later wins (`at`): this
 * session's memory over a stored copy a refused write left behind, and a
 * copy another open tab stored after a newer pull over this tab's memory.
 * A pull that finds nothing unknown is stored too, as empty, so that other
 * tabs learn the field is gone rather than pushing it back.
 */
export const CARRIED_KEY = 'semester.carried';

interface Held {
  account: string;
  fields: Record<string, unknown>;
  /** When the pull it came from landed, so the later of two copies wins. */
  at: number;
}

/** This session's copy. Storage wins only when something pulled later wrote it. */
let memory: Held | null = null;

function stored(): Held | null {
  try {
    const raw = localStorage.getItem(CARRIED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Held> | null;
    if (parsed && typeof parsed.account === 'string' && parsed.fields && typeof parsed.fields === 'object' && !Array.isArray(parsed.fields)) {
      return { account: parsed.account, fields: parsed.fields as Record<string, unknown>, at: typeof parsed.at === 'number' ? parsed.at : 0 };
    }
  } catch {
    // Unreadable: memory, if any, is all there is.
  }
  return null;
}

function read(): Held | null {
  const disk = stored();
  if (!memory) return disk;
  // A stored copy a refused write could not replace is older than memory; one
  // another tab wrote after a newer pull is newer. The later pull is right.
  return disk && disk.at > memory.at ? disk : memory;
}

/** Strictly after anything this session already holds, so a same-millisecond pull still wins. */
const stamp = () => Math.max(Date.now(), (memory?.at ?? 0) + 1);

/** The pulled copy's fields this build does not know. */
export function unknownFields(remote: Record<string, unknown>, known: ReadonlySet<string>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(remote).filter(([key]) => !known.has(key)));
}

/** Remember, for this account, what the copy just pulled holds that this build cannot read. */
export function rememberCarried(account: string, remote: Record<string, unknown> | null, known: ReadonlySet<string>): void {
  const fields = remote ? unknownFields(remote, known) : {};
  const held: Held = { account, fields, at: stamp() };
  memory = held;
  try {
    // Even when empty: another tab holding the field must learn it is gone.
    localStorage.setItem(CARRIED_KEY, JSON.stringify(held));
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
  memory = { account: '', fields: {}, at: stamp() };
  try {
    localStorage.removeItem(CARRIED_KEY);
  } catch {
    // Blocked storage: memory is already clear.
  }
}
