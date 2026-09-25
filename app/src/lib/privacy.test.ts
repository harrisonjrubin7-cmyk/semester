import { describe, expect, it } from 'vitest';
import {
  CLAIMS,
  NEVER_SYNCED,
  SUPPORT,
  SYNCED_FIELDS,
  SYNC_GROUPS,
  whatDeletionLeaves,
  whatSyncs,
  region,
} from './privacy';
import { USAGE_KEY } from './usage';
import { DEFAULT_PERSISTED, initialEphemeral, pickPersisted, type State } from '../state/shape';

/**
 * A privacy page that drifts from what the code does is worse than none — it
 * is a false statement somebody relied on when deciding to hand over their
 * academic record. These are the claims that can be checked.
 */

const state = (): State => ({ ...DEFAULT_PERSISTED, ...initialEphemeral() });

describe('the claims match what the app actually does', () => {
  it('names only fields the app really uploads', () => {
    // A page that names a field the sync does not send is a page nobody should
    // trust about the fields it does.
    const sent = new Set(Object.keys(pickPersisted(state())));
    for (const field of SYNCED_FIELDS) {
      expect(sent.has(field), field).toBe(true);
    }
  });

  it('proves the API key is not in what syncs', () => {
    // The one promise in here that a person would be angriest about.
    const sent = JSON.stringify(pickPersisted(state()));
    const keys = Object.keys(pickPersisted(state()));
    for (const forbidden of NEVER_SYNCED) {
      expect(keys, forbidden).not.toContain(forbidden);
    }
    expect(sent).not.toMatch(/sk-ant-/);
  });

  it('says the key stays on the device, in the page itself', () => {
    const said = CLAIMS.map((c) => c.body).join(' ');
    expect(said).toContain('API key');
    expect(said).toMatch(/not in the database/i);
  });
});

describe('how it is written', () => {
  it('never says the empty thing every privacy page says', () => {
    const said = CLAIMS.map((c) => `${c.heading} ${c.body}`).join(' ').toLowerCase();
    for (const filler of [
      'we take your privacy seriously',
      'industry-standard',
      'from time to time',
      'may share',
      'as necessary',
    ]) {
      expect(said, filler).not.toContain(filler);
    }
  });

  it('says what does not happen, not only what does', () => {
    // The part somebody is actually worried about.
    // Headings as well as bodies — "What never leaves the device" is a heading
    // and it is the most important line on the page.
    const said = CLAIMS.map((c) => `${c.heading} ${c.body}`).join(' ').toLowerCase();
    expect(said).toContain('never leaves');
    expect(said).toContain('nothing is used to train');
    expect(said).toContain('no third-party analytics');
  });

  it('covers every heading the obligations name', () => {
    const headings = CLAIMS.map((c) => c.heading.toLowerCase()).join(' | ');
    for (const need of ['syncs', 'never leaves', 'kept', 'deleting']) {
      expect(headings, need).toContain(need);
    }
  });

  it('gives each claim a real paragraph rather than a label', () => {
    for (const c of CLAIMS) {
      expect(c.body.length, c.heading).toBeGreaterThan(80);
      expect(c.heading.length, c.heading).toBeGreaterThan(4);
    }
  });

  it('names the storage the screen counts live in, so it can be checked', () => {
    // A disclosure that says "we collect anonymous usage data" tells nobody
    // anything they can act on. Naming the key means they can go and look.
    const counting = CLAIMS.find((c) => c.heading.toLowerCase().includes('screens you open'));
    expect(counting?.body).toContain(USAGE_KEY);
    expect(counting?.body).toContain('not uploaded');
  });

  it('does not hide consented support behind a blanket only-you promise', () => {
    const visibility = CLAIMS.find((c) => c.heading === 'Who can see your rows');
    expect(visibility?.body).not.toMatch(/^Only you/i);
    expect(visibility?.body).toMatch(/verified university supporter/i);
    expect(visibility?.body).toMatch(/one-to-seven-day window/i);
    expect(visibility?.body).toMatch(/every read is recorded/i);
    expect(visibility?.body).toMatch(/raw notes, sources, recordings and mistake detail remain private/i);
  });

  it('keeps those counts out of everything that syncs', () => {
    // The claim above is only true while this is. `pickPersisted` is what the
    // push sends, so a count that appeared in it would make the page a lie.
    const sent = JSON.stringify(pickPersisted(state()));
    expect(sent).not.toContain(USAGE_KEY);
    expect(Object.keys(pickPersisted(state()))).not.toContain('usage');
  });

  it('offers a person rather than a form', () => {
    expect(SUPPORT).toContain('@');
  });
});

describe('where the account lives', () => {
  it('reports the host it is actually pointed at', () => {
    expect(region('https://abcdefg.supabase.co')).toBe('abcdefg.supabase.co');
  });

  it('says nothing rather than guessing a country', () => {
    // A wrong region is worse than an unspecific one.
    expect(region('')).toBe('');
    expect(region('not a url')).toBe('');
  });
});

describe('"delete my account" really means every row', () => {
  /*
   * Every module, not just `cloud.ts`.
   *
   * The first version of this guard read one file. `cloud.ts`'s own comment
   * says "a table added later and forgotten here leaves rows behind —
   * `privacy.test.ts` is what catches that", and it would have, for a table
   * added to `cloud.ts`. Two other modules grew their own tables and were
   * invisible to it: `classmates.ts` writes nine and `formshare.ts` two, none
   * of them in `OWNED_TABLES`, so a student's display name, their enrolments,
   * their group memberships and every message they had sent all survived
   * "Delete my account". The guard was not wrong about what it checked. It
   * checked one file out of three.
   *
   * What a table *is* comes off the migrations rather than a list here, for
   * the same reason: a hand-kept list of tables is the thing that went stale.
   */
  const repo = new URL('../../../', import.meta.url);

  /** Every `.from('x')` in the app's own source, with the file that wrote it. */
  function tablesUsedByTheClient(): Map<string, string[]> {
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const root = path.join(repo.pathname, 'app/src');
    const found = new Map<string, string[]>();
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(e.name) || /\.test\.tsx?$/.test(e.name)) continue;
        const src = fs.readFileSync(full, 'utf8');
        for (const m of src.matchAll(/\.from\('([a-z_]+)'\)/g)) {
          const where = path.relative(path.join(repo.pathname, 'app'), full);
          found.set(m[1], [...(found.get(m[1]) ?? []), where]);
        }
      }
    };
    walk(root);
    return found;
  }

  /** What the database actually has, read off the migrations. */
  function schema(): { tables: Set<string>; views: Set<string> } {
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const dir = path.join(repo.pathname, 'supabase/migrations');
    const tables = new Set<string>();
    const views = new Set<string>();
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.sql'))) {
      const sql = fs.readFileSync(path.join(dir, f), 'utf8');
      for (const m of sql.matchAll(/create table (?:if not exists )?public\.([a-z_]+)/g)) {
        tables.add(m[1]);
      }
      for (const m of sql.matchAll(/create (?:or replace )?view public\.([a-z_]+)/g)) {
        views.add(m[1]);
      }
    }
    return { tables, views };
  }

  /** The page's account of deletion, which is two paragraphs and reads as one. */
  const deletionClaims = () =>
    CLAIMS.filter((c) => /^(Deleting everything|What deleting leaves behind)$/.test(c.heading));

  it('finds the tables it is supposed to be looking at', () => {
    /*
     * The control, and it is not decoration. A scan that reads no files, or a
     * regex that matches nothing, reports every account perfectly deleted —
     * which is exactly what the narrow version of this guard did for two
     * whole modules. So: the scanner must find the writes we know are there,
     * in the files we know write them, and the schema reader must find the
     * tables we know exist. If either of these four goes quiet the assertions
     * below mean nothing, and this is the test that says so.
     */
    const used = tablesUsedByTheClient();
    expect([...used.keys()].length).toBeGreaterThan(15);
    expect(used.get('courses')?.some((f) => f.endsWith('cloud.ts'))).toBe(true);
    expect(used.get('messages')?.some((f) => f.endsWith('classmates.ts'))).toBe(true);
    expect(used.get('forms')?.some((f) => f.endsWith('formshare.ts'))).toBe(true);

    const { tables, views } = schema();
    expect(tables.size).toBeGreaterThan(20);
    expect(tables).toContain('courses');
    expect(tables).toContain('groups');
    // A view is not a table and cannot be deleted from. Reading them
    // separately is what stops the guard demanding `published_forms` in
    // `OWNED_TABLES`, where a delete would simply error.
    expect(views).toContain('published_forms');
    expect(tables).not.toContain('published_forms');
  });

  it('names every table any module writes to, not just cloud.ts', async () => {
    const { OWNED_TABLES, KEPT_TABLES } = await import('./cloud');
    // A table in either list is a decision somebody made. A table in neither
    // is the bug this test exists for.
    const accounted = new Set([
      ...OWNED_TABLES.map((t) => t.table),
      ...KEPT_TABLES.map((t) => t.table),
    ]);
    const { tables, views } = schema();
    const missing: string[] = [];
    for (const [table, files] of tablesUsedByTheClient()) {
      // A view has no rows of its own; whatever it selects from is a table
      // this loop sees in its own right.
      if (views.has(table) && !tables.has(table)) continue;
      expect(tables, `${table} (in ${files.join(', ')}) is in no migration`).toContain(table);
      if (!accounted.has(table)) missing.push(`${table} (${[...new Set(files)].join(', ')})`);
    }
    expect(missing, 'tables the client writes that a deleted account keeps').toEqual([]);
  });

  it('claims no more than it deletes', async () => {
    const { OWNED_TABLES } = await import('./cloud');
    const names = OWNED_TABLES.map((t) => t.table);
    expect(names.length).toBeGreaterThan(0);
    // The page promises courses, notes, grades and reminders all go. Notes and
    // grades live inside the `state` row, so that row is the one that carries
    // the promise — its absence would make the claim false.
    expect(names).toContain('state');
    expect(names).toContain('courses');
    expect(names).toContain('push_queue');
    // And the page now names these by hand, because they are the ones a person
    // is surprised to learn were being kept.
    expect(names).toContain('profiles');
    expect(names).toContain('messages');
    expect(names).toContain('forms');
  });

  it('deletes each table by the column that actually owns a row', async () => {
    /*
     * Ownership is spelled four different ways in this schema, and a list of
     * bare names deleted `.eq('user_id', id)` is only right while it is
     * spelled one. `forms.owner`, `groups.created_by`, `group_tasks.created_by`
     * and `reports.reporter` are the four, so a name appended to the old list
     * would have sent a delete against a column that is not there.
     *
     * Read off the migrations rather than asserted against a copy of them.
     *
     * ## The regex, and the four tables it used to lose
     *
     * It was `([^;]*?)\n\)` — everything up to a closing paren, as long as no
     * semicolon appeared first. A semicolon in *prose* therefore ended the
     * match, and `forms.sql` has one: "Never the answer key; see the header."
     * So `forms` found no body, hit the `continue` below, and was never
     * checked — the table this comment names as the reason the test exists.
     * `push_devices`, `referral_codes` and `organization_members` went the same
     * way. Nineteen of twenty-three were being read and the other four were
     * silently skipped, which is worse than not having the test, because the
     * output says the same thing either way.
     *
     * Now it runs to the first line beginning `);`, which is where a create
     * table ends and nowhere else — a column definition never starts a line
     * with a paren — and a table in the schema that finds no body is a failure
     * rather than a `continue`.
     */
    const { OWNED_TABLES } = await import('./cloud');
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const dir = path.join(repo.pathname, 'supabase/migrations');
    const sql = fs
      .readdirSync(dir)
      .filter((n) => n.endsWith('.sql'))
      .map((n) => fs.readFileSync(path.join(dir, n), 'utf8'))
      .join('\n');

    const { tables } = schema();
    for (const { table, column, cascadesFrom, via } of OWNED_TABLES) {
      const body = sql.match(
        new RegExp(`create table (?:if not exists )?public\\.${table} \\(([\\s\\S]*?)\\n\\);`),
      )?.[1];
      if (!body) {
        // A table in no migration is the test above's business. A table that
        // *is* in one and whose body this cannot find is this test going
        // quiet, which is the thing it must never do.
        expect(tables.has(table), `${table} is in a migration but its body did not parse`).toBe(
          false,
        );
        continue;
      }
      if (via) {
        /*
         * The third spelling, and the one that is not a column at all. A table
         * whose rows this account cannot reach with a filtered DELETE — because
         * the verb is revoked — goes out through a function instead. What has to
         * be true of that function is the same thing that has to be true of a
         * column: it exists in the schema, and a signed-in account can actually
         * call it. A name here that nothing grants would be a delete that never
         * happens, reported as a success.
         */
        expect(column, table).toBeNull();
        expect(sql, `${table} via ${via}`).toMatch(
          new RegExp(`create or replace function public\\.${via}\\(`),
        );
        expect(sql, `${table} via ${via} granted`).toMatch(
          new RegExp(`grant execute on function public\\.${via}\\([^)]*\\) to [^;]*authenticated`),
        );
        continue;
      }
      if (column === null) {
        // Nothing is sent for this one, so its parent has to be in the list
        // and the cascade has to be in the schema.
        expect(cascadesFrom, table).toBeTruthy();
        expect(OWNED_TABLES.map((t) => t.table), `${table} cascades from`).toContain(cascadesFrom);
        expect(body, `${table} cascade`).toMatch(
          new RegExp(`references public\\.${cascadesFrom} on delete cascade`),
        );
        continue;
      }
      expect(body, `${table}.${column}`).toMatch(new RegExp(`^\\s*${column}\\s`, 'm'));
    }
  });

  it('gives every kept table a reason, and prints it on the page', async () => {
    /*
     * The other half of the decision. These are rows another person is relying
     * on, or a record about another person, so "delete everything" cannot
     * include them — which makes the reason part of the product, not a code
     * comment. An entry with no sentence, or a sentence the page does not
     * print, is the broad-false-claim failure coming back in a smaller shape.
     *
     * `schools` is the one entry that is neither of those. It is reference
     * data no account ever wrote, and it is on the list because the guard
     * above matches every `.from('…')` in the client rather than only the
     * writes — which is the right posture for a privacy check and means a
     * table nobody owns arrives here too. The sentence it carries says that
     * rather than pretending it is somebody's record.
     *
     * The list is pinned rather than derived, so that adding a table to it is
     * an edit somebody made on purpose in two places.
     */
    const { KEPT_TABLES } = await import('./cloud');
    expect(KEPT_TABLES.map((t) => t.table).sort()).toEqual([
      'group_tasks',
      'groups',
      'organizations',
      'reports',
      'schools',
      'support_access_event',
    ]);
    const said = deletionClaims().map((c) => c.body).join(' ');
    for (const { table, why } of KEPT_TABLES) {
      expect(why.length, table).toBeGreaterThan(80);
      expect(said, table).toContain(why);
    }
    expect(said).toContain(whatDeletionLeaves());
  });

  it('stops saying the two things about deletion that were not true', () => {
    /*
     * The defect, in the page's own words. It claimed deletion "cascades in
     * the database" — that cascade hangs off removing the `auth.users` row,
     * which is the one thing a browser holding a publishable key cannot do, so
     * it has never once fired. And it claimed "every row belonging to you"
     * while eleven tables were in no list at all.
     *
     * A narrower true claim beats a broad false one, so what replaces it has
     * to name the account record it cannot reach, and offer the address that
     * can.
     */
    // Two paragraphs rather than one, because the sentence that matters most
    // here — that some rows stay — was the fifteenth line of twenty-seven when
    // this was a single claim. Read as one thing, since a reader does.
    const claims = deletionClaims();
    expect(claims.length).toBe(2);
    const said = claims.map((c) => c.body).join(' ');
    expect(said).not.toMatch(/cascades in the database/i);
    expect(said).not.toMatch(/every row belonging to you/i);
    expect(said).toMatch(/account record/i);
    expect(said).toContain(SUPPORT);
    // The named tables a person would not have guessed were being kept.
    for (const word of ['display name', 'messages', 'blocked', 'group', 'practice paper']) {
      expect(said, word).toContain(word);
    }
  });

  it('names the tables whose SQL shipped before their client half', async () => {
    /*
     * These exist in the database and nothing writes to them yet. Listed now
     * so that whichever half ships first, a deleted account is still empty.
     *
     * `calendar_feeds` is the one that would have hurt: a feed is a public URL
     * serving a timetable to anybody holding the token, so a row left behind
     * keeps answering after the account is gone.
     */
    const { OWNED_TABLES } = await import('./cloud');
    const names = OWNED_TABLES.map((t) => t.table);
    for (const t of ['notes', 'tasks', 'appointments', 'sittings', 'calendar_feeds']) {
      expect(names, t).toContain(t);
    }
  });
});

describe('the page cannot say less than the sync sends', () => {
  /**
   * The failure this exists for.
   *
   * "Your courses and their deadlines… your study card history, and your
   * settings. That is your academic record" was true of the app that wrote
   * it. Since then the sync has carried everything somebody writes in Write,
   * Sheets, Decks and the graphing workspace, their drafted email, what they
   * have recorded a term costing, their degree plan and the people they have
   * logged — all of it, because the payload is `pickPersisted` whole. A
   * privacy page that understates what leaves the device is the one kind of
   * inaccuracy nobody can catch by using the app.
   */
  const sent = () => Object.keys(pickPersisted(state()));

  it('names every field the sync carries', () => {
    const named = new Set(SYNC_GROUPS.flatMap((g) => g.keys));
    const unnamed = sent().filter((f) => !named.has(f));
    expect(unnamed).toEqual([]);
  });

  it('names nothing the sync does not carry', () => {
    const fields = new Set(sent());
    const stale = SYNC_GROUPS.flatMap((g) => g.keys).filter((f) => !fields.has(f));
    expect(stale).toEqual([]);
  });

  it('puts each field in one group, so the sentence does not say it twice', () => {
    const all = SYNC_GROUPS.flatMap((g) => g.keys);
    expect(all.length).toBe(new Set(all).size);
  });

  it('is the sentence the page prints, rather than a second copy of it', () => {
    const page = CLAIMS.find((c) => c.heading === 'What syncs when you are signed in');
    expect(page?.body).toContain(whatSyncs());
    // The specific words somebody would be surprised by, rather than a
    // spot-check of the mechanism: these are the ones the old sentence left
    // out, and a rewrite that drops them is a rewrite that understates again.
    for (const word of ['spreadsheets', 'graphs', 'email', 'costing', 'degree']) {
      expect(page?.body, word).toContain(word);
    }
  });
});
