import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENTRY_SOURCES, ROLE_HINTS, parseEntry } from './entrycontext';
import { linkedScreen } from './deeplink';

/**
 * The browser and the database apply the same allowlist to what a link says.
 *
 * `lib/entrycontext.ts` cleans an address in the browser; `private.entry_context`
 * in the onboarding migration cleans the same facts on the server, because the
 * browser is not trusted. Two copies of a list are two chances to drift, and a
 * drift in the wrong direction (the server accepting what the browser refuses)
 * is a screen or a role nobody reviewed. This reads the migration as text and
 * holds the two together.
 */

const SQL = readFileSync(
  join(__dirname, '..', '..', '..', 'supabase', 'migrations', '20261006000000_onboarding_journeys_and_handoff.sql'),
  'utf8',
);

/** The quoted words in the first `in ( … )` after a marker. */
function listAfter(marker: string): string[] {
  const at = SQL.indexOf(marker);
  expect(at, `${marker} is not in the migration`).toBeGreaterThan(-1);
  const open = SQL.indexOf('in (', at);
  const close = SQL.indexOf(')', open);
  return [...SQL.slice(open, close).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

describe('the database allowlist is the browser allowlist', () => {
  it('names the same sources', () => {
    expect(listAfter("e.key = 'source'").sort()).toEqual([...ENTRY_SOURCES].sort());
  });

  it('names the same role hints', () => {
    expect(listAfter("e.key = 'roleHint'").sort()).toEqual([...ROLE_HINTS].sort());
  });

  it('allows no destination the browser would refuse', () => {
    const server = listAfter("e.key = 'continueTo'");
    expect(server.length).toBeGreaterThan(0);
    for (const screen of server) expect(linkedScreen(screen, false), screen).toBe(screen);
  });

  it('lets a hand-off land only where a link may', () => {
    const handoff = listAfter('route         text        not null check (route in (');
    expect(handoff.sort()).toEqual(listAfter("e.key = 'continueTo'").sort());
  });

  it('uses the same id pattern', () => {
    expect(SQL).toContain("'^[A-Za-z0-9_-]{1,64}$'");
    expect(parseEntry('?cid=' + 'a'.repeat(64))?.campaignId).toHaveLength(64);
    expect(parseEntry('?src=email&cid=' + 'a'.repeat(65))?.campaignId).toBeUndefined();
  });
});
