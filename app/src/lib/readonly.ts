/**
 * Read-only mode: the app-wide switch that stops this device writing to the
 * account while something is being done to the account's side.
 *
 * `docs/LAUNCH-DECISIONS.md` listed it as still to build, and `ROLLBACK.md`
 * says why it is wanted: the database schema cannot be rolled back, a restore
 * of the production project has never been rehearsed against live clients, and
 * a migration that goes wrong is repaired by hand. Every one of those is a
 * window in which a device pushing its copy is writing into a database that
 * is about to be replaced or is mid-repair. The six kill switches in
 * `lib/flags.ts` each stop one feature; none stops the ordinary sync.
 *
 * ## The smallest honest version
 *
 * A build-time switch, `VITE_READ_ONLY=true`, because this app is a static
 * bundle with no server in front of it: the only thing that can change what
 * every open tab does is a deploy, and `ROLLBACK.md` measures a deploy at
 * under five minutes. The gateway has its own copy, `SEMESTER_READ_ONLY=on`,
 * read by `app/server/institution/start.ts`, because a client that ignores a
 * build flag must still be refused at the write.
 *
 * What it does on the device, and nothing more:
 *
 *   - `state/store.tsx` does not push. Edits are saved on the device exactly
 *     as they are offline, `unpushed` remembers them, and the next build
 *     without the flag pushes them — the same path a reconnect takes.
 *   - `lib/cloud.ts`'s `push` refuses even if something else calls it, so the
 *     store's check is not the only one.
 *   - `components/ReadOnlyBanner.tsx` says so, on every screen, for as long as
 *     it lasts. A standing condition, not a toast.
 *
 * What it does not do: reads still happen (a pull is harmless against a
 * database being restored, and the merge is a union), sign-in still works, and
 * the other writes in `cloud.ts` — push devices, calendar feeds, deletion —
 * are not gated here. Deleting an account during a restore window is a
 * decision the person is making on purpose, and stopping the routine sync is
 * the whole of what an incident needs.
 *
 * Registered, with its owner and rollback, in `docs/FEATURE-FLAG-REGISTRY.md`
 * under build switches.
 */

export const READ_ONLY_ENV = 'VITE_READ_ONLY';

/** Whether an environment asks for read-only mode. Only the exact word `true`. */
export function readOnlyMode(env: Record<string, string | undefined>): boolean {
  return (env[READ_ONLY_ENV] ?? '').trim().toLowerCase() === 'true';
}

/** This build's answer, read once. */
export const READ_ONLY = readOnlyMode(import.meta.env as unknown as Record<string, string | undefined>);

/** The banner's one sentence, held here so the test and the screen say the same thing. */
export const READ_ONLY_NOTICE = 'Read-only mode: your changes stay on this device until it ends.';

/** Thrown by `push` under read-only mode. Never reaches `explainSync`; the store checks first. */
export class ReadOnly extends Error {
  constructor() {
    super(READ_ONLY_NOTICE);
    this.name = 'ReadOnly';
  }
}

export function isReadOnly(e: unknown): e is ReadOnly {
  return e instanceof Error && e.name === 'ReadOnly';
}
