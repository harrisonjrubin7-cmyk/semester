// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { STORAGE_KEY } from './shape';

/**
 * A field the store keeps is a field something reads.
 *
 * This repository already guards the *other* direction, thoroughly. Every
 * persisted field must be accounted for in the backup (`lib/export.test.ts`),
 * assigned a merge strategy (`lib/merge.test.ts`) and named in the privacy
 * disclosure (`lib/privacy.test.ts`), and each of those three reads the field
 * list out of `pickPersisted` so it cannot drift from a copy.
 *
 * Nothing asked whether the app ever *uses* one. So a field could be written
 * on every navigation, persisted, migrated, merged across devices, described
 * in the data export and disclosed on the privacy screen — passing all three
 * guards, because every one of them is a guard about being *carried* — and be
 * read by nothing at all.
 *
 * `lastOpened` was. The day each screen was opened, written on every `go`,
 * synced between devices with a merge strategy of its own, and **no screen or
 * component in this repository's history has ever contained the word**
 * (`git log -S lastOpened -- app/src/screens app/src/components` is empty).
 * Its docblock said what it was for — *the Everything directory wanted to say
 * "three weeks ago" beside a row* — and named the principle that condemned
 * it in the same paragraph: *what a feature does not need is not stored*.
 * Lately is built on `recent`, which is an order and not a date; Not-opened-
 * yet is built on `visited`, which is a boolean. The third record was never
 * wired to anything.
 *
 * ## The carriers, and why the list is exactly this
 *
 * These five touch every field by construction — the shape, the migration
 * ladder, the cross-device merge, the backup and the privacy list. A hit in
 * any of them says only that the field is carried, which is the thing that
 * hid `lastOpened` and, one pass earlier, `showAll`.
 *
 * `state/slices/` is deliberately **not** here. A reducer reading a field to
 * decide what the next state is, is the app using it: `liveSession` is read
 * five times in `slices/study.ts` and nowhere else, and it is not dead. An
 * earlier draft of this probe excluded the slices and reported it as a
 * finding — the exclusion list was the fault, not the field.
 */
const CARRIERS = /state\/shape\.ts$|lib\/(merge|export|privacy|migrate)\.ts$/;

/*
 * `process.cwd()`, which is what `lib/export.test.ts` uses for the same job.
 * `new URL('..', import.meta.url)` is the idiom in the structural tests that
 * run under node, and it does not survive the jsdom environment this file
 * needs for the storage case — it resolved to `/src` and the run died on
 * ENOENT before a single field was checked.
 */
const SRC = join(process.cwd(), 'src') + '/';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    if (!/\.tsx?$/.test(name) || /\.test\.tsx?$/.test(name)) return [];
    return [full];
  });
}

/** The field list, read out of the store rather than copied from it. */
function persistedFields(): string[] {
  const code = readFileSync(join(SRC, 'state/shape.ts'), 'utf8');
  const body = code.split('export function pickPersisted')[1]?.split('\n}')[0] ?? '';
  return [...body.matchAll(/^\s{4}(\w+): state\.\w+,/gm)].map((m) => m[1]);
}

/**
 * Where a field is read, by property access or by destructuring.
 *
 * `.field` rather than a bare `field`, because a bare name would report every
 * key whose name is an ordinary word — `notes`, `term`, `scale`, `progress`,
 * `people` — as read by whichever file happens to use the word, which is a
 * probe that can only ever pass. The access form is what the three cases the
 * first run of this turned up all needed: `state.liveSession` in a reducer,
 * `persisted.seenOnboarding` in the store (off the persisted object, not off
 * state), and `lastOpened` nowhere.
 */
function readersOf(field: string, read: [string, string][]): string[] {
  const access = new RegExp(`\\.${field}\\b`);
  const destructured = new RegExp(`\\{[^}]*\\b${field}\\b[^}]*\\}\\s*=\\s*(state|persisted|saved|useStore\\(\\))`);
  return read
    .filter(([, code]) => access.test(code) || destructured.test(code))
    .map(([f]) => f.slice(SRC.length));
}

/**
 * The tree, read once.
 *
 * A hundred fields against seven hundred files is seventy thousand reads if
 * the file is opened per field, and the first version of this did exactly
 * that and timed out at five seconds — a guard slow enough to be deleted is
 * a guard that will be.
 */
function readable(files: string[]): [string, string][] {
  return files.filter((f) => !CARRIERS.test(f)).map((f) => [f, readFileSync(f, 'utf8')]);
}

describe('every field the store persists', () => {
  const files = sources(SRC);
  const fields = persistedFields();
  const read = readable(files);

  it('found the store and the tree, or the rest of this proves nothing', () => {
    expect(fields.length).toBeGreaterThan(50);
    expect(files.length).toBeGreaterThan(300);
    // The probe, pointed at what it is meant to see. A field that is only
    // carried must read as unread — this is the shape `lastOpened` had.
    expect(readersOf('notAFieldAnythingReads', read)).toEqual([]);
  });

  it('is read by something that is not merely carrying it', () => {
    const unread = fields.filter((f) => readersOf(f, read).length === 0);
    expect(unread).toEqual([]);
  });
});

describe('a saved copy from before a field was cut', () => {
  it('loads, and does not write the field back out', async () => {
    /*
     * Cutting a persisted field needs no migration step — and the mechanism
     * is not the one this test first asserted.
     *
     * `loadPersisted` spreads `...saved` before it names any field, so a key
     * the shape no longer knows **does** ride back in and sits on the object
     * until the next write. It is `pickPersisted` that drops it, by naming
     * what it takes rather than by removing what it does not want. The first
     * version of this expected `loadPersisted` to have dropped it already and
     * failed — which is the useful direction for an assumption to fail in.
     *
     * So: it opens, it carries, and it does not survive the next save. No
     * migration step, for a reason worth stating rather than assuming.
     */
    const { loadPersisted, pickPersisted } = await import('./shape');
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ schemaVersion: 6, seenOnboarding: true, lastOpened: { home: 20_400 } }),
    );
    const persisted = loadPersisted();
    // It opens, rather than throwing on a field the shape no longer knows.
    expect(persisted.seenOnboarding).toBe(true);
    // It rides in on the spread — the part that was assumed away.
    expect(JSON.stringify(persisted)).toContain('lastOpened');
    // And the way out names what it takes, so it goes on the next save.
    const out = pickPersisted(persisted as unknown as Parameters<typeof pickPersisted>[0]);
    expect(JSON.stringify(out)).not.toContain('lastOpened');
    localStorage.clear();
  });
});
