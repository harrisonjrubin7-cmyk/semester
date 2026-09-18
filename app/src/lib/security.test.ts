import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SUPPORT } from './privacy';

/**
 * An incident-response process is a claim about the project, so it is checked
 * like one — and like `ROLLBACK.md`'s, every way it can go wrong is silent.
 *
 * The failure worth guarding against here is specific and it is not the
 * document rotting in the abstract. It is this: **somebody adds a function, the
 * function reads a new secret, and the incident process does not know that
 * secret exists.** Nothing goes red. The document still reads well. It is
 * discovered during the one hour it was written for, by a person going down a
 * list that is missing the line they need.
 *
 * So the tripwire below is bidirectional — every environment variable an Edge
 * Function reads must appear in `SECURITY.md`, and every variable `SECURITY.md`
 * names must be one something actually reads. A document that lists a secret
 * nothing uses is the same defect pointing the other way: it sends somebody to
 * rotate a key that is not there while the real one is still live.
 *
 * ## What it does not check
 *
 * Whether the response is any good, whether anybody is awake, and whether the
 * legal clocks named in the document are the right ones. That last is flagged
 * in the document as the one part of it nobody in this repository verified,
 * which is the honest treatment of a number that cannot be measured from here
 * — and a test asserting `72` would dress it up as one that had been.
 */

const ROOT = join(process.cwd(), '..');
const DOC = join(ROOT, 'SECURITY.md');
const FUNCTIONS = join(ROOT, 'supabase', 'functions');

const doc = () => readFileSync(DOC, 'utf8');

/**
 * The document with its line breaks taken out.
 *
 * Every assertion below about a *sentence* runs against this rather than the
 * raw text. The first version did not, and two of them went red against
 * wording that was present and correct — the file is wrapped at eighty
 * columns, so "about other people's data" contains a newline between "other"
 * and "people's" and a literal match cannot see it. A guard that fails when
 * somebody reflows a paragraph is a guard people learn to edit around.
 */
const flat = () => doc().replace(/\s+/g, ' ');

/** Every `Deno.env.get('…')` across every Edge Function, by name. */
function secretsRead(): string[] {
  const found = new Set<string>();
  for (const dir of readdirSync(FUNCTIONS)) {
    const file = join(FUNCTIONS, dir, 'index.ts');
    if (!existsSync(file)) continue;
    for (const m of readFileSync(file, 'utf8').matchAll(/Deno\.env\.get\('([A-Z0-9_]+)'\)/g)) {
      found.add(m[1]);
    }
  }
  return [...found].sort();
}

/**
 * Every environment-variable-shaped name the document sets in code voice.
 *
 * The underscore is what separates these from the rest of the backticked
 * things in the file: `ROLLBACK.md`, `CHANGELOG.md` and `invites.check.sql`
 * are links rather than secrets, and none of them has one.
 */
function secretsNamed(): string[] {
  return [
    ...new Set(
      [...doc().matchAll(/`([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)`/g)].map((m) => m[1]),
    ),
  ].sort();
}

describe('the document exists and names somebody', () => {
  it('is there at all', () => {
    expect(existsSync(DOC), 'SECURITY.md is gone').toBe(true);
  });

  it('names an owner, and not a placeholder', () => {
    const said = doc();
    expect(said).toMatch(/@[A-Za-z0-9-]+/);
    for (const placeholder of ['TODO', 'TBD', 'FIXME', '<owner>', 'XXX']) {
      expect(said, `the owner is still ${placeholder}`).not.toContain(placeholder);
    }
  });

  it('commits to a clock for telling people, in a number somebody can hold it to', () => {
    // The old commitment — "the same day" — was a promise about the last step
    // with nothing in front of it. Whatever the number becomes, there has to
    // be one, and it has to be attached to notifying rather than to fixing.
    expect(flat()).toMatch(/[Ww]ithin \d+ hours.{0,200}emailed/);
  });

  it('and says who is told, rather than that people are told', () => {
    expect(flat()).toMatch(/affected account/i);
  });

  it('sends people to the address the privacy page sends them to', () => {
    // Two files naming a mailbox is two files to update; this is the one that
    // notices when only one of them was.
    expect(doc(), 'SECURITY.md names a different mailbox from privacy.ts').toContain(SUPPORT);
  });
});

describe('every secret a function reads is a secret this process can rotate', () => {
  /*
   * The tripwire. If this goes red, `SECURITY.md` is wrong rather than this
   * test being wrong: a function has started reading something the incident
   * process has never heard of, and the list somebody works down during an
   * incident is short by one.
   */
  it('names every environment variable the Edge Functions read', () => {
    const missing = secretsRead().filter((name) => !doc().includes(name));
    expect(missing, 'read by a function, absent from SECURITY.md').toEqual([]);
  });

  it('and names nothing that no longer exists to be rotated', () => {
    /*
     * The same defect pointing the other way, and the more dangerous of the
     * two during an incident: a row in that table for a key nothing reads
     * sends somebody to rotate something harmless while the live one is still
     * out. `VITE_VAPID_PUBLIC_KEY` is the deliberate exception — it is a build
     * variable rather than a function secret, and rotating the VAPID pair is
     * not finished until it is set, which is exactly the kind of second step
     * that gets forgotten.
     */
    const read = new Set([...secretsRead(), 'VITE_VAPID_PUBLIC_KEY']);
    const stale = secretsNamed().filter((name) => !read.has(name));
    expect(stale, 'named in SECURITY.md, read by nothing').toEqual([]);
  });

  it('and the probe reads the functions rather than reporting an empty tree', () => {
    /*
     * The control, and the reason the two clean sweeps above mean anything. A
     * scanner that finds nothing passes both of them: no missing names and no
     * stale ones is also what a broken `readdirSync` looks like. So both ends
     * are pinned to something that is certainly there.
     */
    const read = secretsRead();
    expect(read.length, 'the scan found no environment variables at all').toBeGreaterThan(5);
    expect(read, 'the service key is no longer read, or the scan is broken').toContain(
      'SUPABASE_SERVICE_ROLE_KEY',
    );
    expect(secretsNamed().length, 'the document names no secrets at all').toBeGreaterThan(5);
  });

  it('and reads them out of the code rather than out of the deploy comments', () => {
    /*
     * The second control, and the one that caught a real habit in this
     * repository three times: every function's header comment contains
     * `supabase secrets set VAPID_PRIVATE_KEY=…` as deploy instructions, so a
     * probe scanning the file for capitalised words would find the names
     * whether or not any code read them. Pinned to a name that appears in a
     * comment and in no `Deno.env.get` call.
     */
    const raw = readFileSync(join(FUNCTIONS, 'push', 'index.ts'), 'utf8');
    expect(raw, 'the deploy instructions have moved out of the header').toContain(
      'supabase secrets set VAPID_PUBLIC_KEY',
    );
    expect(raw, 'DATABASE_URL is now read rather than only documented').not.toMatch(
      /Deno\.env\.get\('DATABASE_URL'\)/,
    );
    expect(secretsRead(), 'the scan is picking up prose').not.toContain('DATABASE_URL');
  });

  it('and separates the ones worth something from the ones that are not', () => {
    // The table's whole use during an incident is triage: rotating four
    // secrets in the wrong order costs the hour. The service key is the only
    // one whose leak is about somebody else's rows, and the document has to
    // say so rather than listing five keys flat.
    expect(flat()).toMatch(/only one whose leak is an incident about other people/i);
  });
});

describe('the levers it tells you to pull are there to pull', () => {
  it('the invite gate it names is a function in the schema', () => {
    const sql = readdirSync(join(ROOT, 'supabase', 'migrations'))
      .map((f) => readFileSync(join(ROOT, 'supabase', 'migrations', f), 'utf8'))
      .join('\n');
    const called = [...doc().matchAll(/select\s+public\.(\w+)\(/g)].map((m) => m[1]);
    expect(called.length, 'the document tells you to call nothing').toBeGreaterThan(0);
    for (const fn of new Set(called)) {
      expect(
        sql.includes(`function public.${fn}(`),
        `SECURITY.md calls public.${fn}(), which no migration creates`,
      ).toBe(true);
    }
  });

  it('and it does not claim a lever this repository has never exercised', () => {
    /*
     * Signing every session out is the obvious next move and nothing here
     * does it. The document says so in those words on purpose: a step with no
     * time attached, presented beside two that have been measured, is the one
     * somebody reaches for first and discovers cold.
     */
    expect(flat()).toMatch(/no lever for.{0,400}never been exercised here/i);
  });
});

describe('what the document points at exists', () => {
  it('every repository file it links to is a file that is there', () => {
    const linked = [...doc().matchAll(/\]\((?!https?:)([^)#]+)\)/g)].map((m) => m[1]);
    expect(linked.length, 'the document links to no files').toBeGreaterThan(3);
    for (const path of new Set(linked)) {
      expect(existsSync(join(ROOT, path)), `${path} is linked but not there`).toBe(true);
    }
  });

  it('and hands the deploy-broke-it case to the document that owns it', () => {
    // The two documents overlap in one place and the boundary is the useful
    // part of both. A copy of the rollback procedure here would be a second
    // copy to drift.
    expect(doc()).toContain('ROLLBACK.md');
    expect(doc(), 'SECURITY.md has grown its own rollback procedure').not.toMatch(
      /workflow_dispatch|Run workflow/,
    );
  });
});
