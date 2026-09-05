import { describe, expect, it } from 'vitest';
import { CLAIMS, NEVER_SYNCED, SUPPORT, SYNCED_FIELDS, region } from './privacy';
import { USAGE_KEY } from './usage';
import { DEFAULT_PERSISTED, initialEphemeral, pickPersisted, type State } from '../state/shape';

/**
 * A privacy page that drifts from what the code does is worse than none — it
 * is a false statement somebody relied on when deciding to hand over their
 * academic record. These are the claims that can be checked.
 */

const state = (): State => ({ ...DEFAULT_PERSISTED, ...initialEphemeral(new Date()) });

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
  it('names every table the app writes to', async () => {
    // Written by hand rather than discovered, so a table added later and
    // forgotten here would leave rows behind after somebody was told their
    // account was empty. This is what catches that — and it caught the first
    // version, whose four names were three guesses.
    const { OWNED_TABLES } = await import('./cloud');
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync(new URL('./cloud.ts', import.meta.url), 'utf8'),
    );
    const written = new Set(
      [...src.matchAll(/\.from\('([a-z_]+)'\)/g)].map((m) => m[1]),
    );
    for (const table of written) {
      expect(OWNED_TABLES, table).toContain(table);
    }
  });

  it('claims no more than it deletes', async () => {
    const { OWNED_TABLES } = await import('./cloud');
    expect(OWNED_TABLES.length).toBeGreaterThan(0);
    // The page promises courses, notes, grades and reminders all go. Notes and
    // grades live inside the `state` row, so that row is the one that carries
    // the promise — its absence would make the claim false.
    expect(OWNED_TABLES).toContain('state');
    expect(OWNED_TABLES).toContain('courses');
    expect(OWNED_TABLES).toContain('push_queue');
  });
});
