import { useCallback, useEffect, useRef, useState } from 'react';

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
 * every write is blocked from then on. The bad bytes stay exactly where they
 * are, and `recovery()` hands them back so somebody can download them.
 *
 * The alternative — start empty and save over it on the next keystroke — is
 * how a student loses a term of application notes to one malformed character.
 * It is also the behaviour that looks completely fine in testing, because in
 * testing the data is never malformed.
 *
 * ## Every write is validated before it lands
 *
 * `update` runs the same `read` over the *new* value before writing it. A bug
 * in a screen that would store something the reader will later reject is
 * caught on the write that causes it, not on the load three weeks later when
 * the cause is gone. The write returns false rather than throwing, so a caller
 * can say "that did not save" without a boundary.
 *
 * ## Two tabs stay in step
 *
 * `storage` covers another tab; the `semester-device-library` event covers
 * this one, since `storage` does not fire in the tab that wrote. Without the
 * second, two views of the same library in one window silently disagree.
 */
export function useDeviceLibrary<T>(key: string, read: (value: unknown) => T, empty: T) {
  const [initial] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return { value: raw === null ? empty : read(JSON.parse(raw)), error: '' };
    } catch {
      return {
        value: empty,
        error:
          'Saved data could not be read. It has been kept exactly as it is — export a recovery copy before repairing this device’s storage.',
      };
    }
  });

  const [value, setValue] = useState(initial.value);
  const [error, setError] = useState(initial.error);
  const current = useRef(initial.value);
  /*
   * Latched on a bad read, and never unlatched. See the note above.
   *
   * Kept twice on purpose. The ref is what `update` reads, because that check
   * has to see a latch set moments ago by the storage listener — a state
   * value there would still be the previous render's. The state is what the
   * *return* carries, because a ref read during render is a value React never
   * re-renders for, so a screen asking `blocked` would go on drawing its
   * editable form after the latch closed.
   */
  const blocked = useRef(!!initial.error);
  const [locked, setLocked] = useState(!!initial.error);

  const update = useCallback(
    (change: T | ((old: T) => T)) => {
      if (blocked.current) return false;
      try {
        const next = typeof change === 'function' ? (change as (old: T) => T)(current.current) : change;
        read(next);
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
        current.current = next;
        setValue(next);
        setError('');
        window.dispatchEvent(new CustomEvent('semester-device-library', { detail: key }));
        return true;
      } catch (e) {
        setError(`Changes could not be saved: ${(e as Error).message}`);
        return false;
      }
    },
    [key, read],
  );

  useEffect(() => {
    const refresh = () => {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) return;
        const next = read(JSON.parse(raw));
        current.current = next;
        setValue(next);
      } catch {
        blocked.current = true;
        setLocked(true);
        setError('Saved data changed and could not be read. It has been kept as it is.');
      }
    };
    const storage = (e: StorageEvent) => {
      if (e.key === key) refresh();
    };
    const local = (e: Event) => {
      if ((e as CustomEvent).detail === key) refresh();
    };
    window.addEventListener('storage', storage);
    window.addEventListener('semester-device-library', local);
    return () => {
      window.removeEventListener('storage', storage);
      window.removeEventListener('semester-device-library', local);
    };
  }, [key, read]);

  return { value, update, error, blocked: locked, recovery: () => localStorage.getItem(key) || '' };
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
