import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * A store that lives on this device, for the workspaces that are not the term.
 *
 * Athletics, Career, Family and Pathway each hold a body of work that is
 * genuinely the student's own and genuinely not academic record: a résumé, a
 * list of programmes being applied to, a plan for what a parent may see, a
 * season's travel. None of it belongs in `state/shape.ts` — that is the term,
 * it syncs, and it is shaped by `@semester/contract`. So each of these gets a
 * library of its own under a key of its own.
 *
 * That is a real limitation and the screens say so. It also means this module
 * has to be careful in ways the main store does not, because there is no
 * server copy to fall back on.
 *
 * ## A failed read is never replaced with empty data
 *
 * The single most important line in this file. If the stored JSON cannot be
 * parsed or fails its validator, the value goes to `empty` *for display* and
 * every write is refused. The bad bytes stay exactly where they are, and
 * `recovery()` hands them back so somebody can download them.
 *
 * The alternative — start empty and save over it on the next keystroke — is
 * how a student loses a term of application notes to one malformed character.
 * It is also the behaviour that looks completely fine in testing, because in
 * testing the data is never malformed.
 *
 * ## Every write reads first
 *
 * `update` re-reads the stored record at the moment of the change rather than
 * trusting what this hook last saw. Two things follow, and both are the reason
 * it is written this way:
 *
 * - A refusal is decided against what is *on disk now*, not a flag set at
 *   mount. Another tab can corrupt the record a millisecond earlier and this
 *   write still declines to flatten it.
 * - A functional update is applied to the current record, so a save from
 *   another tab is built on rather than silently discarded.
 *
 * The new value then goes through the same `read` before it lands, and the
 * *validated* result is what is stored — a screen that hands over something
 * the reader would later normalise stores the normal form immediately rather
 * than a shape that only survives until the next load. The write returns false
 * rather than throwing, so a caller can say "that did not save" without a
 * boundary.
 *
 * ## Nothing from the previous key is ever shown
 *
 * The key carries the account and the term, and it changes while this hook
 * stays mounted. The snapshot records which key produced it, and a snapshot
 * from the old one is not drawn — the freshly loaded value is, on the same
 * render that the key changed. Otherwise switching account shows the previous
 * account's plans for a frame, which is a disclosure, not a flicker.
 *
 * ## Two tabs stay in step
 *
 * `storage` covers another tab; the `semester-device-library` event covers
 * this one, since `storage` does not fire in the tab that wrote. Without the
 * second, two views of the same library in one window silently disagree. A
 * `storage` event with a null key is the whole store being cleared, and counts
 * as a change to every key.
 */
export function useDeviceLibrary<T>(key: string, read: (value: unknown) => T, empty: T) {
  /*
   * One read of storage, carrying the key it came from.
   *
   * `blocked` is derived from this read rather than latched in a ref: the
   * question "may this write" is a question about the bytes on disk, and a
   * ref answers it with whatever was true when it was last assigned. The
   * refusal is no weaker for being derived — `update` calls this again before
   * every write, so the check is against storage as it is at that moment.
   */
  const load = useCallback(() => {
    try {
      const raw = localStorage.getItem(key);
      return { key, value: raw === null ? empty : read(JSON.parse(raw)), error: '', blocked: false };
    } catch {
      return {
        key,
        value: empty,
        error:
          'Saved data could not be read. It has been kept exactly as it is — export a recovery copy before repairing this device’s storage.',
        blocked: true,
      };
    }
  }, [key, read, empty]);

  const initial = useMemo(() => load(), [load]);
  const [snapshot, setSnapshot] = useState(initial);
  // The effect below catches up a render later, and a render is long enough
  // to show one account's work to the next. Prefer the fresh read until it does.
  const visible = snapshot.key === key ? snapshot : initial;

  const update = useCallback(
    (change: T | ((old: T) => T)) => {
      const before = load();
      if (before.blocked) {
        setSnapshot(before);
        return false;
      }
      try {
        const next = read(typeof change === 'function' ? (change as (old: T) => T)(before.value) : change);
        const raw = JSON.stringify(next);
        /*
         * Ahead of the quota rather than into it. `localStorage` throws when
         * it is full, and the throw arrives on whichever keystroke happens to
         * cross the line — so the message would blame an innocent edit. Three
         * megabytes is well inside every browser's limit and leaves room for
         * the rest of the app's keys.
         */
        if (raw.length > 3_000_000) {
          throw new Error('This workspace is full. Export and archive older work first.');
        }
        localStorage.setItem(key, raw);
        setSnapshot({ key, value: next, error: '', blocked: false });
        window.dispatchEvent(new CustomEvent('semester-device-library', { detail: key }));
        return true;
      } catch (e) {
        // `before`, not the attempted value: the failed write changed nothing.
        setSnapshot({ ...before, error: `Changes could not be saved: ${e instanceof Error ? e.message : String(e)}` });
        return false;
      }
    },
    [key, read, load],
  );

  useEffect(() => {
    const refresh = () => setSnapshot(load());
    // A null key is `localStorage.clear()` — every key changed, including this one.
    const storage = (e: StorageEvent) => {
      if (e.key === key || e.key === null) refresh();
    };
    const local = (e: Event) => {
      if ((e as CustomEvent).detail === key) refresh();
    };
    refresh();
    window.addEventListener('storage', storage);
    window.addEventListener('semester-device-library', local);
    return () => {
      window.removeEventListener('storage', storage);
      window.removeEventListener('semester-device-library', local);
    };
  }, [key, load]);

  return {
    value: visible.value,
    update,
    error: visible.error,
    blocked: visible.blocked,
    // Guarded too: the read that blocked this library can be the one that throws.
    recovery: () => {
      try {
        return localStorage.getItem(key) || '';
      } catch {
        return '';
      }
    },
  };
}

/*
 * The four checks every library validator is built out of.
 *
 * Small enough to look like they do not need to be shared, and shared anyway:
 * four modules each writing their own `isString(v, max)` is four chances to
 * get the boundary wrong, and a validator that is wrong at the boundary is a
 * validator that passes its tests.
 */

/** A plain object — not null, not an array. */
export const obj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/** A string no longer than `max`. Empty is allowed; callers check `.trim()`. */
export const textValue = (v: unknown, max = 20_000): v is string => typeof v === 'string' && v.length <= max;

/** A real number in range. Rejects NaN and both infinities, which `>=` alone does not. */
export const finite = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

/**
 * A `YYYY-MM-DD` day, or empty.
 *
 * The round-trip at the end is the part that matters: `2026-02-31` matches the
 * pattern and parses, and comes back out of `toISOString` as `2026-03-03`. A
 * date that is not the date it says it is would sit in a deadline field and
 * sort wrong for a term.
 */
export const isoDay = (v: unknown): v is string =>
  typeof v === 'string' &&
  (!v ||
    (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
      Number.isFinite(Date.parse(`${v}T00:00:00Z`)) &&
      new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v));
