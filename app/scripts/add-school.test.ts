import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  claimingCount,
  describe as describeRows,
  parseArgs,
  plausibleDomain,
  plausibleId,
  readConfig,
  refuseRemoval,
  tidyDomains,
  type Db,
} from './add-school.ts';

/**
 * What this script refuses, which is most of what is worth pinning about it.
 *
 * `grant-admin.test.ts` says why the round trips are not mocked here and the
 * same holds: a test that mocked PostgREST would assert the mock was written
 * the way the code was. Two things are exceptions and are tested with a stub
 * that answers one question — the count before a removal, and the removal
 * refusal built on it — because going ahead there does not fail, it succeeds
 * and takes a claim off every student at that school with nothing reporting it.
 */

const MIGRATION = readFileSync(
  new URL('../../supabase/migrations/20260921170000_schools.sql', import.meta.url),
  'utf8',
);

const jwt = (role: string) =>
  `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.sig`;

const SERVICE = jwt('service_role');

describe('the id, against the constraint it has to satisfy', () => {
  /*
   * A structural check rather than a copied string. `plausibleId` exists to
   * turn a constraint violation into a readable sentence, so the one way it
   * can fail is by disagreeing with the constraint — refusing an id the table
   * would take, or promising one it would reject. Reading the pattern out of
   * the migration means a later widening there fails here rather than in a
   * terminal at the moment somebody is adding their university.
   */
  const declared = /id\s+text\s+primary key check \(id ~ '([^']+)'\)/.exec(MIGRATION);

  it('finds the constraint it is mirroring', () => {
    expect(declared, 'the schools migration no longer declares the id check this test reads').not
      .toBeNull();
  });

  it('accepts exactly what the table accepts', () => {
    const table = new RegExp(declared![1]);
    const candidates = [
      'vanderbilt',
      'uc-berkeley',
      '0x',
      'a'.repeat(40),
      'a'.repeat(41),
      'a',
      '',
      '-leading',
      'Vanderbilt',
      'vanderbilt.edu',
      'vander bilt',
      'vanderbilt/ECON 1020',
      'école',
      'a_b',
    ];
    for (const id of candidates) {
      expect(plausibleId(id), id).toBe(table.test(id));
    }
  });

  it('trims, because a shell and a spreadsheet will both hand you whitespace', () => {
    expect(plausibleId('  vanderbilt  ')).toBe(true);
  });
});

describe('a domain, which is the credential', () => {
  it('takes the shapes a university publishes', () => {
    for (const good of ['vanderbilt.edu', 'alumni.vanderbilt.edu', 'u-tokyo.ac.jp', 'x.co']) {
      expect(plausibleDomain(good), good).toBe(true);
    }
  });

  /*
   * The one that matters. `claim_school()` compares against `substring(addr
   * from '[^@]+$')` — the part after the last '@' — so a stored
   * "@vanderbilt.edu" is compared against "vanderbilt.edu" and matches
   * nobody, while sitting in the table looking exactly right. The failure is
   * a university that admits no one and no error anywhere saying why.
   */
  it('refuses an address pasted where a domain goes', () => {
    expect(plausibleDomain('@vanderbilt.edu')).toBe(false);
    expect(plausibleDomain('ada@vanderbilt.edu')).toBe(false);
  });

  it('refuses what is not a domain at all', () => {
    for (const bad of ['', '   ', 'vanderbilt', '.edu', 'vanderbilt.', '-x.edu', 'a b.edu', 'x.e']) {
      expect(plausibleDomain(bad), bad).toBe(false);
    }
  });

  it('stores the form both comparisons are made in', () => {
    expect(tidyDomains([' Vanderbilt.EDU ', 'vanderbilt.edu', 'ALUMNI.vanderbilt.edu', ''])).toEqual(
      ['vanderbilt.edu', 'alumni.vanderbilt.edu'],
    );
  });
});

describe('what it was asked to do', () => {
  it('reads the four commands', () => {
    expect(parseArgs(['list'])).toEqual({ ok: true, verb: 'list' });
    expect(parseArgs(['add', 'vanderbilt', 'Vanderbilt University'])).toEqual({
      ok: true,
      verb: 'add',
      id: 'vanderbilt',
      name: 'Vanderbilt University',
      shortName: '',
    });
    expect(parseArgs(['add', 'vanderbilt', 'Vanderbilt University', 'Vanderbilt'])).toEqual({
      ok: true,
      verb: 'add',
      id: 'vanderbilt',
      name: 'Vanderbilt University',
      shortName: 'Vanderbilt',
    });
    expect(parseArgs(['domains', 'vanderbilt', 'vanderbilt.edu'])).toEqual({
      ok: true,
      verb: 'domains',
      id: 'vanderbilt',
      domains: ['vanderbilt.edu'],
    });
    expect(parseArgs(['remove', 'vanderbilt'])).toEqual({ ok: true, verb: 'remove', id: 'vanderbilt' });
  });

  /*
   * `domains <id>` with nothing after it is not a mistake and must not be read
   * as one: it is how a school stops admitting anybody, and the thing `remove`
   * points at when it refuses.
   */
  it('takes an empty domain list as the instruction it is', () => {
    expect(parseArgs(['domains', 'vanderbilt'])).toEqual({
      ok: true,
      verb: 'domains',
      id: 'vanderbilt',
      domains: [],
    });
  });

  /*
   * `add` used to take domains in this position. Anybody carrying that habit
   * types a legal four-argument command that lists the school, stores the
   * domain as a short name and admits nobody — and reports success.
   */
  it('refuses a domain where the short name goes, and says where it goes instead', () => {
    const got = parseArgs(['add', 'vanderbilt', 'Vanderbilt University', 'vanderbilt.edu']);
    expect(got.ok).toBe(false);
    expect(got.ok === false && got.why).toContain('domains vanderbilt vanderbilt.edu');
  });

  it('refuses a whole list of domains after the name', () => {
    const got = parseArgs([
      'add',
      'vanderbilt',
      'Vanderbilt University',
      'vanderbilt.edu',
      'alumni.vanderbilt.edu',
    ]);
    expect(got.ok).toBe(false);
    expect(got.ok === false && got.why).toContain('Domains are set separately');
  });

  it('refuses an id the table would refuse, before the round trip', () => {
    for (const verb of ['add', 'domains', 'remove']) {
      expect(parseArgs([verb, 'Vanderbilt', 'x']).ok, verb).toBe(false);
      expect(parseArgs([verb]).ok, verb).toBe(false);
    }
  });

  it('refuses a flag where an id goes', () => {
    expect(parseArgs(['remove', '--force']).ok).toBe(false);
  });

  it('refuses the lengths the columns cannot hold, rather than letting the server say so', () => {
    expect(parseArgs(['add', 'x1', 'a']).ok).toBe(false);
    expect(parseArgs(['add', 'x1', 'ab']).ok).toBe(true);
    expect(parseArgs(['add', 'x1', 'a'.repeat(120)]).ok).toBe(true);
    expect(parseArgs(['add', 'x1', 'a'.repeat(121)]).ok).toBe(false);
    expect(parseArgs(['add', 'x1', 'Name', 'a'.repeat(60)]).ok).toBe(true);
    expect(parseArgs(['add', 'x1', 'Name', 'a'.repeat(61)]).ok).toBe(false);
  });

  it('holds those lengths against the columns themselves', () => {
    expect(MIGRATION).toContain('length(trim(name)) between 2 and 120');
    expect(MIGRATION).toContain('length(short_name) <= 60');
  });

  it('refuses arguments the commands do not take, and a command it does not have', () => {
    expect(parseArgs(['list', 'vanderbilt']).ok).toBe(false);
    expect(parseArgs(['remove', 'vanderbilt', 'please']).ok).toBe(false);
    expect(parseArgs([]).ok).toBe(false);
    const got = parseArgs(['seed', 'vanderbilt']);
    expect(got.ok).toBe(false);
    expect(got.ok === false && got.why).toContain('"seed"');
  });
});

describe('the environment it needs', () => {
  it('takes a url and a service key', () => {
    const got = readConfig({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: SERVICE });
    expect(got).toEqual({ ok: true, url: 'https://x.supabase.co', key: SERVICE });
  });

  /*
   * Worse here than one table over. `app_admins` has no policy, so the
   * publishable key reads an empty table; `schools` has `for select using
   * (true)`, so the publishable key reads it *correctly* — list works, every
   * write is refused, and the script looks half broken rather than wrongly
   * keyed.
   */
  it('refuses the key that would read the table perfectly and write nothing', () => {
    const got = readConfig({
      SUPABASE_URL: 'https://x.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: jwt('anon'),
    });
    expect(got.ok).toBe(false);
    expect(got.ok === false && got.why).toContain('does not look like a service key');
  });

  it('says which one is missing rather than failing later', () => {
    const noUrl = readConfig({ SUPABASE_SERVICE_ROLE_KEY: SERVICE });
    expect(noUrl.ok === false && noUrl.why).toContain('SUPABASE_URL');
    const noKey = readConfig({ SUPABASE_URL: 'https://x.supabase.co' });
    expect(noKey.ok === false && noKey.why).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(readConfig({ SUPABASE_URL: '  ', SUPABASE_SERVICE_ROLE_KEY: SERVICE }).ok).toBe(false);
  });
});

describe('what an empty table says', () => {
  /*
   * "No schools." on its own reads as a tidy starting state. It is the state
   * in which `claim_school()` — the function the whole migration exists for —
   * refuses every student who calls it, so the line says that.
   */
  it('says that nobody can claim anything, not just that the list is short', () => {
    expect(describeRows([])).toContain('claim_school');
  });

  it('names a school that admits nobody as one', () => {
    const out = describeRows([
      { id: 'vanderbilt', name: 'Vanderbilt University', email_domains: ['vanderbilt.edu'] },
      { id: 'uvm', name: 'University of Vermont', email_domains: [] },
    ]);
    expect(out).toContain('vanderbilt.edu');
    expect(out).toContain('admits nobody yet');
  });
});

/** A client that answers the one question `remove` asks, and remembers being asked. */
function stub(count: number | null): { db: Db; asked: { table: string; column: string; value: string }[] } {
  const asked: { table: string; column: string; value: string }[] = [];
  const db = {
    from: (table: string) => ({
      select: () => ({
        eq: (column: string, value: string) => {
          asked.push({ table, column, value });
          return Promise.resolve({ count, error: null });
        },
        order: () => Promise.resolve({ data: [], error: null }),
      }),
      upsert: () => Promise.resolve({ error: null }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  } as unknown as Db;
  return { db, asked };
}

describe('the count a removal turns on', () => {
  it('asks profiles which rows point at this school', async () => {
    const { db, asked } = stub(3);
    expect(await claimingCount(db, 'vanderbilt')).toBe(3);
    expect(asked).toEqual([{ table: 'profiles', column: 'school_id', value: 'vanderbilt' }]);
  });

  /*
   * The control, and the reason this is not a mock asserting itself. PostgREST
   * returns `count: null` when it was not asked for one, and `?? 0` would then
   * read as "nobody is claiming this" — a refusal that never fires and a
   * removal that goes ahead. A null count has to reach `refuseRemoval` as a
   * number it will not act on, and this pins which number that is.
   */
  it('reads a missing count as zero, which is the answer that permits a removal', async () => {
    const { db } = stub(null);
    expect(await claimingCount(db, 'vanderbilt')).toBe(0);
    expect(refuseRemoval('vanderbilt', 0)).toBe('');
  });

  it('refuses while anybody is claiming, and says how many', () => {
    expect(refuseRemoval('vanderbilt', 1)).toContain('1 student is claiming vanderbilt');
    expect(refuseRemoval('vanderbilt', 412)).toContain('412 students are claiming vanderbilt');
  });

  /*
   * The refusal has to leave somebody somewhere to go. Without the `domains`
   * line it is a door with no handle, and the next thing tried is the SQL
   * editor against production, which is what this script exists to avoid.
   */
  it('points at the thing to do instead of removing', () => {
    expect(refuseRemoval('vanderbilt', 5)).toContain('add-school.ts domains vanderbilt');
    expect(refuseRemoval('vanderbilt', 5)).toContain('on delete set null');
  });

  it('holds that against the column, which is where the danger is', () => {
    expect(MIGRATION).toContain('references public.schools on delete set null');
  });
});
